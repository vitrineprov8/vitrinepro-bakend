import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { LinkedInStrategy } from './linkedin.strategy';
import { UsersModule } from '../users/users.module';
import { TagsModule } from '../tags/tags.module';
import { User } from '../users/user.entity';
import { UserSession } from './user-session.entity';

@Module({
  imports: [
    UsersModule,
    TagsModule,
    PassportModule,
    TypeOrmModule.forFeature([User, UserSession]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    AuthService,
    TwoFactorService,
    JwtStrategy,
    GoogleStrategy,
    LinkedInStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
