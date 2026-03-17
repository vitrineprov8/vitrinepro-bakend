import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { LinkedInStrategy } from './linkedin.strategy';
import { UsersModule } from '../users/users.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    UsersModule,
    TagsModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, GoogleStrategy, LinkedInStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
