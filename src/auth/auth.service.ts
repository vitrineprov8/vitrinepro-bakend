import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { TagsService } from '../tags/tags.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserPersona } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

/** B2 — token expira 1h após a solicitação. */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** B17 — token de verificação de e-mail expira 24h após emitido/reenviado. */
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tagsService: TagsService,
    private mailService: MailService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async register(registerDto: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    isCompany?: boolean;
    companyName?: string;
    companyIndustry?: string;
    /** B1 — persona escolhida em /cadastro (T13). Ignorado quando isCompany=true. */
    persona?: 'CANDIDATO' | 'HUNTER';
  }) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    if (registerDto.isCompany && !registerDto.companyName?.trim()) {
      throw new BadRequestException(
        'O nome da empresa é obrigatório para contas empresariais.',
      );
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const referralCode = await this.generateReferralCode();

    // B1 — persona inicial: empresa sempre EMPRESA; HUNTER acumula CANDIDATO
    // (o hunter também é um profissional com perfil público); default CANDIDATO.
    const personas: UserPersona[] = registerDto.isCompany
      ? [UserPersona.EMPRESA]
      : registerDto.persona === 'HUNTER'
        ? [UserPersona.CANDIDATO, UserPersona.HUNTER]
        : [UserPersona.CANDIDATO];

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      authProvider: 'local',
      referralCode,
      isCompany: registerDto.isCompany ?? false,
      companyName: registerDto.isCompany ? (registerDto.companyName ?? null) : null,
      companyIndustry: registerDto.companyIndustry ?? null,
      personas,
    });

    await this.tagsService.createDefaultTagsForUser(user.id);

    // B17 — dispara verificação de e-mail em paralelo ao registro. Não é
    // bloqueante: falha no envio não deve impedir o cadastro (mesmo padrão
    // de resiliência do MailService usado em B2/B3).
    const verificationToken = await this.issueEmailVerificationToken(user.id);
    void this.mailService.sendEmailVerification(
      user.email,
      user.firstName,
      verificationToken,
    );

    const token = this.generateToken(user);

    return {
      message: 'Usuario registrado exitosamente',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personas: user.personas,
      },
      // B17 — em dev/staging (sem inbox real disponível para QA), devolve o
      // token no próprio response para permitir validar o fluxo completo.
      // Nunca exposto em produção.
      ...(process.env.NODE_ENV !== 'production'
        ? { devEmailVerificationToken: verificationToken }
        : {}),
    };
  }

  async login(loginDto: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    if (user.authProvider && user.authProvider !== 'local') {
      throw new UnauthorizedException(
        `Esta cuenta usa autenticación de ${user.authProvider}. Por favor inicia sesión con ${user.authProvider}.`,
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada',
      );
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const token = this.generateToken(user);

    return {
      message: 'Login exitoso',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        personas: user.personas,
      },
    };
  }

  async validateUser(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }

  async validateOAuthUser(oauthData: {
    oauthId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    provider: 'google' | 'linkedin';
  }) {
    // Try to find by oauthId + provider first
    let user = await this.usersService.findByOAuthId(
      oauthData.oauthId,
      oauthData.provider,
    );

    if (user) {
      // Existing OAuth user — update profile data
      user = await this.usersService.update(user.id, {
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        avatarUrl: oauthData.avatarUrl,
      });
      return user;
    }

    // Try to find by email to link existing account
    user = await this.usersService.findByEmail(oauthData.email);

    if (user) {
      // Link existing account with OAuth
      user = await this.usersService.update(user.id, {
        oauthId: oauthData.oauthId,
        authProvider: oauthData.provider,
        avatarUrl: oauthData.avatarUrl,
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
      });
      return user;
    }

    // Create brand-new OAuth user with a referral code
    const referralCode = await this.generateReferralCode();

    user = await this.usersService.create({
      email: oauthData.email,
      firstName: oauthData.firstName,
      lastName: oauthData.lastName,
      password: null,
      authProvider: oauthData.provider,
      oauthId: oauthData.oauthId,
      avatarUrl: oauthData.avatarUrl,
      referralCode,
      // B17 — provedor OAuth já validou o e-mail, não precisa de confirmação extra.
      emailVerified: true,
    });

    await this.tagsService.createDefaultTagsForUser(user.id);

    return user;
  }

  /**
   * B2 — Solicita redefinição de senha.
   *
   * Resposta é SEMPRE genérica (anti-enumeração de e-mail): não revela se o
   * e-mail existe, se é conta OAuth (sem senha), etc. Se aplicável, gera um
   * token de 1h e dispara o e-mail via MailService (stub se sem RESEND_API_KEY).
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
    };

    const user = await this.usersService.findByEmail(email);
    // Contas OAuth (sem senha local) não podem redefinir senha por e-mail —
    // segue tudo em silêncio para não vazar essa informação.
    if (!user || !user.password) {
      return genericResponse;
    }

    const token = randomBytes(24).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.usersRepository.save(user);

    await this.mailService.sendPasswordReset(user.email, token);

    return genericResponse;
  }

  /**
   * B2 — Redefine a senha a partir do token emailado.
   * Token é de uso único (limpo após sucesso) e expira em 1h.
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    if (!password || password.length < 8) {
      throw new BadRequestException('A senha precisa ter pelo menos 8 caracteres.');
    }

    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect(['u.passwordResetToken', 'u.passwordResetExpiresAt'])
      .where('u.passwordResetToken = :token', { token })
      .getOne();

    if (!user) {
      throw new NotFoundException('Token inválido ou expirado.');
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      // Token expirado: limpa para não deixar pendurado.
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await this.usersRepository.save(user);
      throw new GoneException('Token inválido ou expirado.');
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepository.save(user);

    return { message: 'Senha redefinida com sucesso.' };
  }

  // ===== B17 — VERIFICAÇÃO DE E-MAIL =====

  /** Gera, salva e retorna um token de verificação de e-mail (24h). */
  private async issueEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(24).toString('hex');
    await this.usersRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    return token;
  }

  /**
   * Confirma o e-mail a partir do token emailado no cadastro. Token é de uso
   * único (limpo após sucesso) e expira em 24h — mesmo padrão de resetPassword.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect(['u.emailVerificationToken', 'u.emailVerificationExpiresAt'])
      .where('u.emailVerificationToken = :token', { token })
      .getOne();

    if (!user) {
      throw new NotFoundException('Token inválido ou expirado.');
    }

    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      user.emailVerificationToken = null;
      user.emailVerificationExpiresAt = null;
      await this.usersRepository.save(user);
      throw new GoneException('Token inválido ou expirado.');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    await this.usersRepository.save(user);

    return { message: 'E-mail confirmado com sucesso.' };
  }

  /**
   * Reenvia o e-mail de confirmação para o usuário autenticado. Resposta
   * genérica quando já verificado (idempotente, não é erro).
   */
  async resendEmailVerification(
    userId: string,
  ): Promise<{ message: string; devEmailVerificationToken?: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      return { message: 'Este e-mail já está confirmado.' };
    }

    const token = await this.issueEmailVerificationToken(user.id);
    await this.mailService.sendEmailVerification(user.email, user.firstName, token);

    return {
      message: 'E-mail de confirmação reenviado.',
      ...(process.env.NODE_ENV !== 'production'
        ? { devEmailVerificationToken: token }
        : {}),
    };
  }

  public generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Generates a unique 8-character alphanumeric uppercase referral code.
   * Retries up to 5 times on uniqueness collision before throwing.
   */
  private async generateReferralCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 8;

    for (let attempt = 0; attempt < 5; attempt++) {
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      const existing = await this.usersRepository.findOne({
        where: { referralCode: code },
        select: ['id'],
      });

      if (!existing) return code;
    }

    throw new BadRequestException(
      'Não foi possível gerar um código de indicação único. Tente novamente.',
    );
  }
}
