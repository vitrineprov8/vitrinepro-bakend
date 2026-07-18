import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { TWO_FACTOR_PENDING_CLAIM } from './two-factor.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    // B27 — o "challenge token" do login em 2 etapas carrega esta marca. Ele
    // prova só que a SENHA estava certa, não que o 2º fator foi apresentado —
    // aceitá-lo aqui tornaria o 2FA completamente contornável (bastaria usar o
    // challenge token como Bearer). A única rota que o aceita é
    // `POST /auth/2fa/verify`, que o valida direto pelo JwtService.
    if (payload?.[TWO_FACTOR_PENDING_CLAIM]) {
      throw new UnauthorizedException(
        'Verificação em duas etapas pendente. Conclua o login.',
      );
    }

    const user = await this.authService.validateUser(payload.sub);

    // B26 — sessões ativas com revogar. Tokens emitidos ANTES desta feature
    // não têm `jti` no payload — tratados como "sessão não rastreada" (não
    // desloga quem já estava logado no momento do deploy). Tokens novos
    // sempre têm `jti` e precisam de uma sessão válida (não revogada).
    if (!payload.jti) {
      return user;
    }

    const session = await this.authService.touchSession(payload.jti, payload.sub);
    if (!session) {
      throw new UnauthorizedException('Sessão encerrada. Faça login novamente.');
    }

    return { ...user, sessionId: session.id };
  }
}
