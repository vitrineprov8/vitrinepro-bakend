import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

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
