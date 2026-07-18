import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { UserSession } from './user-session.entity';
import { AuthService, DeviceInfo } from './auth.service';
import {
  generateTotpSecret,
  verifyTotp,
  buildOtpauthUri,
  formatSecretForDisplay,
  generateBackupCodes,
  normalizeBackupCode,
} from './totp.util';
import { TWO_FACTOR_PENDING_CLAIM } from './two-factor.constants';

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: Date | null;
  backupCodesRemaining: number;
  /** true para ADMIN — a UI usa isso para exigir a ativação. */
  enforced: boolean;
  /** true quando a conta é OAuth (sem senha local). Afeta o fluxo de desativar. */
  isOAuthAccount: boolean;
}

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserSession)
    private userSessionsRepository: Repository<UserSession>,
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  /**
   * B27 — TOTP é obrigatório para ADMIN. Contas admin aprovam verificações,
   * resolvem disputas e mexem em splits de dinheiro.
   *
   * **Decisão deliberada: não bloqueia o login do admin sem 2FA.** Bloquear
   * criaria um deadlock — não dá pra ativar 2FA sem antes conseguir entrar na
   * conta. Em vez disso, `enforced:true` volta no login e no status, e o front
   * usa isso pra empurrar a tela de ativação e mostrar o aviso persistente.
   */
  private isEnforcedFor(user: User): boolean {
    return user.role === UserRole.ADMIN;
  }

  /** Lê o usuário incluindo as colunas `select:false` do 2FA. */
  private async findWithSecrets(userId: string): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect([
        'u.password',
        'u.twoFactorSecret',
        'u.twoFactorPendingSecret',
        'u.twoFactorBackupCodes',
      ])
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async getStatus(userId: string): Promise<TwoFactorStatus> {
    const user = await this.findWithSecrets(userId);
    return {
      enabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt ?? null,
      backupCodesRemaining: user.twoFactorBackupCodes?.length ?? 0,
      enforced: this.isEnforcedFor(user),
      isOAuthAccount: !user.password,
    };
  }

  /**
   * Passo 1 — gera um segredo PENDENTE e devolve o material de enrolamento.
   * Não ativa nada ainda: só vira ativo depois do `enable()` com um código
   * válido, provando que o app registrou o segredo de verdade.
   *
   * Chamar de novo sobrescreve o pendente anterior (usuário recomeçou o
   * processo, ex.: trocou de celular no meio) — isso é intencional.
   */
  async setup(userId: string): Promise<{
    secret: string;
    secretFormatted: string;
    otpauthUri: string;
    qrDataUrl: string | null;
  }> {
    const user = await this.findWithSecrets(userId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'A verificação em duas etapas já está ativa. Desative antes de configurar de novo.',
      );
    }

    const secret = generateTotpSecret();
    await this.usersRepository.update(userId, { twoFactorPendingSecret: secret });

    const otpauthUri = buildOtpauthUri(secret, user.email);

    return {
      secret,
      secretFormatted: formatSecretForDisplay(secret),
      otpauthUri,
      qrDataUrl: await this.renderQrDataUrl(otpauthUri),
    };
  }

  /**
   * QR opcional. O pacote `qrcode` está no `package.json` mas o import é
   * dinâmico e tolerante a falha de propósito: o fluxo inteiro funciona sem
   * ele (o usuário digita o segredo manualmente, opção que toda tela de 2FA
   * oferece de qualquer forma), então uma instalação pendente não pode
   * derrubar o backend nem bloquear a ativação.
   *
   * **Nunca** usar um serviço externo de QR aqui (como `api.qrserver.com`, que
   * o front usa para links de processo): a URI `otpauth://` carrega o segredo
   * compartilhado — mandá-la pra um terceiro entregaria a semente do 2FA.
   */
  private async renderQrDataUrl(uri: string): Promise<string | null> {
    try {
      // Especificador em variável: o TypeScript não resolve estaticamente,
      // então compila mesmo com o pacote ausente.
      const moduleName = 'qrcode';
      const qr = (await import(moduleName)) as {
        toDataURL: (text: string, opts?: unknown) => Promise<string>;
      };
      return await qr.toDataURL(uri, { width: 240, margin: 1 });
    } catch {
      return null;
    }
  }

  /**
   * Passo 2 — confirma o segredo pendente com um código do app e ativa.
   * Devolve os códigos de recuperação em claro **uma única vez** (só os hashes
   * ficam no banco; não há como reexibi-los depois, só gerar novos).
   */
  async enable(
    userId: string,
    code: string,
    currentSessionId?: string,
  ): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.findWithSecrets(userId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException('A verificação em duas etapas já está ativa.');
    }

    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException(
        'Nenhuma configuração pendente. Inicie a configuração novamente.',
      );
    }

    if (!verifyTotp(user.twoFactorPendingSecret, code)) {
      // 400 e não 401: o usuário está autenticado, só digitou o código errado.
      // Um 401 aqui derrubaria a sessão dele (ver `useApi.ts` no front, mesma
      // razão documentada em `AuthService.changePassword`).
      throw new BadRequestException(
        'Código inválido. Confira o app e tente novamente.',
      );
    }

    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)),
    );

    await this.usersRepository.update(userId, {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorBackupCodes: hashed,
      twoFactorEnabledAt: new Date(),
    });

    // Ativar 2FA encerra as OUTRAS sessões: se alguma já estava comprometida,
    // ela não deve sobreviver justamente ao ato de proteger a conta. A sessão
    // atual é preservada pra não expulsar quem acabou de configurar.
    await this.revokeOtherSessions(userId, currentSessionId);

    return {
      message: 'Verificação em duas etapas ativada.',
      backupCodes,
    };
  }

  /**
   * Desativa o 2FA. Exige a senha atual (reautenticação) — sem isso, uma
   * sessão sequestrada removeria a proteção sem nenhum atrito.
   * Contas OAuth (sem senha local) confirmam com um código do próprio 2FA.
   */
  async disable(
    userId: string,
    payload: { password?: string; code?: string },
  ): Promise<{ message: string }> {
    const user = await this.findWithSecrets(userId);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('A verificação em duas etapas não está ativa.');
    }

    if (user.password) {
      if (!payload.password) {
        throw new BadRequestException('Informe sua senha para desativar.');
      }
      const ok = await bcrypt.compare(payload.password, user.password);
      if (!ok) throw new BadRequestException('Senha incorreta.');
    } else {
      // Conta OAuth: não há senha para reautenticar, então o 2º fator é o
      // próprio código do app.
      if (!payload.code || !verifyTotp(user.twoFactorSecret, payload.code)) {
        throw new BadRequestException(
          'Código inválido. Confira o app e tente novamente.',
        );
      }
    }

    await this.usersRepository.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorBackupCodes: null,
      twoFactorEnabledAt: null,
    });

    return { message: 'Verificação em duas etapas desativada.' };
  }

  /** Gera um conjunto novo de códigos, invalidando os anteriores. */
  async regenerateBackupCodes(
    userId: string,
    password?: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.findWithSecrets(userId);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Ative a verificação em duas etapas primeiro.');
    }

    if (user.password) {
      if (!password) throw new BadRequestException('Informe sua senha para continuar.');
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new BadRequestException('Senha incorreta.');
    }

    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)),
    );

    await this.usersRepository.update(userId, { twoFactorBackupCodes: hashed });

    return { backupCodes };
  }

  // ===== FLUXO DE LOGIN =====

  /**
   * Segunda etapa do login: troca o challenge token + código por uma sessão
   * real. Aceita tanto código do app quanto código de recuperação.
   */
  async verifyLoginChallenge(
    challengeToken: string,
    code: string,
    device?: DeviceInfo,
  ): Promise<{
    message: string;
    access_token: string;
    user: Record<string, unknown>;
    usedBackupCode: boolean;
    backupCodesRemaining: number;
  }> {
    let payload: Record<string, unknown>;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException(
        'Sessão de verificação expirada. Faça login novamente.',
      );
    }

    const sub = payload?.sub as string | undefined;
    if (!payload?.[TWO_FACTOR_PENDING_CLAIM] || !sub) {
      throw new UnauthorizedException('Token de verificação inválido.');
    }

    const user = await this.findWithSecrets(sub);
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Verificação em duas etapas não está ativa.');
    }

    let usedBackupCode = false;

    if (!verifyTotp(user.twoFactorSecret, code)) {
      // Não bateu como TOTP — tenta como código de recuperação.
      const consumed = await this.consumeBackupCode(user, code);
      if (!consumed) {
        throw new UnauthorizedException('Código inválido.');
      }
      usedBackupCode = true;
    }

    const access_token = await this.authService.createSession(user, device);

    return {
      message: 'Login exitoso',
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personas: user.personas,
      },
      usedBackupCode,
      backupCodesRemaining: usedBackupCode
        ? ((user.twoFactorBackupCodes?.length ?? 1) - 1)
        : (user.twoFactorBackupCodes?.length ?? 0),
    };
  }

  /**
   * Confere o código contra os hashes guardados e, se bater, REMOVE aquele
   * hash (uso único). Retorna false se nenhum bater.
   */
  private async consumeBackupCode(user: User, code: string): Promise<boolean> {
    const codes = user.twoFactorBackupCodes;
    if (!codes?.length || !code) return false;

    const normalized = normalizeBackupCode(code);
    // Formato é XXXX-XXXX (8 hex) — descarta cedo o que nem tem a forma certa,
    // evitando 10 comparações bcrypt (caras) para um código de 6 dígitos.
    if (!/^[0-9A-F]{8}$/.test(normalized)) return false;

    for (let i = 0; i < codes.length; i++) {
      if (await bcrypt.compare(normalized, codes[i])) {
        const remaining = codes.filter((_, idx) => idx !== i);
        await this.usersRepository.update(user.id, {
          twoFactorBackupCodes: remaining,
        });
        return true;
      }
    }

    return false;
  }

  /** Revoga todas as sessões do usuário exceto (opcionalmente) a atual. */
  private async revokeOtherSessions(
    userId: string,
    keepSessionId?: string,
  ): Promise<void> {
    const where = keepSessionId
      ? { userId, revokedAt: IsNull(), id: Not(keepSessionId) }
      : { userId, revokedAt: IsNull() };
    await this.userSessionsRepository.update(where, { revokedAt: new Date() });
  }
}
