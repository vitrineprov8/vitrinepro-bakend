import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { TagsService } from '../tags/tags.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tagsService: TagsService,
  ) {}

  async register(registerDto: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    // Validar si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Crear el usuario
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      authProvider: 'local',
    });

    // Criar tags padrão para o novo usuário
    await this.tagsService.createDefaultTagsForUser(user.id);

    // Generar JWT
    const token = this.generateToken(user);

    return {
      message: 'Usuario registrado exitosamente',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async login(loginDto: { email: string; password: string }) {
    // Buscar el usuario por email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // Validar que el usuario no use OAuth
    if (user.authProvider && user.authProvider !== 'local') {
      throw new UnauthorizedException(
        `Esta cuenta usa autenticación de ${user.authProvider}. Por favor inicia sesión con ${user.authProvider}.`
      );
    }

    // Validar que el usuario tenga contraseña
    if (!user.password) {
      throw new UnauthorizedException('Esta cuenta no tiene contraseña configurada');
    }

    // Validar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // Generar JWT
    const token = this.generateToken(user);

    return {
      message: 'Login exitoso',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
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
    // Buscar usuario por oauthId + provider
    let user = await this.usersService.findByOAuthId(oauthData.oauthId, oauthData.provider);

    if (user) {
      // Usuario OAuth existente - actualizar profile data
      user = await this.usersService.update(user.id, {
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        avatarUrl: oauthData.avatarUrl,
      });
      return user;
    }

    // Buscar por email para vincular automáticamente
    user = await this.usersService.findByEmail(oauthData.email);

    if (user) {
      // Vincular cuenta existente con OAuth
      user = await this.usersService.update(user.id, {
        oauthId: oauthData.oauthId,
        authProvider: oauthData.provider,
        avatarUrl: oauthData.avatarUrl,
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
      });
      return user;
    }

    // Crear nuevo usuario OAuth
    user = await this.usersService.create({
      email: oauthData.email,
      firstName: oauthData.firstName,
      lastName: oauthData.lastName,
      password: null,
      authProvider: oauthData.provider,
      oauthId: oauthData.oauthId,
      avatarUrl: oauthData.avatarUrl,
    });

    // Criar tags padrão para o novo usuário OAuth
    await this.tagsService.createDefaultTagsForUser(user.id);

    return user;
  }

  public generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }
}
