import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { UsersModule } from '../users/users.module';

/**
 * B24 (A6) — admin de usuários/vagas.
 *
 * Registra seu próprio `JwtModule` (mesmo segredo de `AuthModule`, via env)
 * só para assinar o token de suporte de `login-as` — evita reimportar/alterar
 * o `AuthModule` existente (que não exporta `JwtModule` hoje).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
    }),
    UsersModule,
  ],
  providers: [AdminUsersService],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
