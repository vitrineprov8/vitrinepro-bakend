import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserPersona } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByOAuthId(oauthId: string, provider: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { oauthId, authProvider: provider as any },
    });
  }

  async create(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string | null;
    authProvider?: 'local' | 'google' | 'linkedin' | null;
    oauthId?: string | null;
    avatarUrl?: string | null;
    referralCode?: string | null;
    isCompany?: boolean;
    companyName?: string | null;
    companyIndustry?: string | null;
    personas?: UserPersona[];
    /** B17 — true apenas para contas OAuth (provedor já validou o e-mail). */
    emailVerified?: boolean;
  }): Promise<User> {
    const username = await this.generateUniqueUsername(
      userData.firstName,
      userData.lastName,
    );
    const user = this.usersRepository.create({ ...userData, username });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  /**
   * Anonimização LGPD — campos de PII sobrescritos com valores aleatórios,
   * conta desativada. NÃO salva sozinho (deixa o caller decidir quando, pra
   * poder empacotar em audit log/notificação na mesma transação lógica).
   * Compartilhado entre `AdminUsersService.anonymize` (B24, admin exclui
   * conta de terceiro) e `AccountService.deleteAccount` (B26, titular exclui
   * a própria conta) — mesmo efeito, gatilhos diferentes.
   *
   * Não é hard-delete: várias tabelas referenciam `userId` por FK (vagas,
   * placements, applications, invoices etc.) — apagar de verdade quebraria
   * histórico/auditoria de terceiros que não pediram nada.
   */
  applyAnonymization(user: User): User {
    const stamp = Date.now();
    user.email = `anonimizado-${stamp}@removido.vitrinepro.com`;
    user.firstName = 'Usuário';
    user.lastName = 'Removido';
    user.password = null;
    user.authProvider = null;
    user.oauthId = null;
    user.avatarUrl = null;
    user.avatarKey = null;
    user.bannerUrl = null;
    user.bannerKey = null;
    user.username = null;
    user.profession = null;
    user.bio = null;
    user.phone = null;
    user.website = null;
    user.location = null;
    user.socialLinks = null;
    user.isActive = false;
    user.isVisible = false;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    user.verificationDocs = null;
    user.verificationLinkedinUrl = null;
    return user;
  }

  private async generateUniqueUsername(
    firstName: string,
    lastName: string,
  ): Promise<string> {
    const base = `${firstName}${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    let username: string;
    let exists: User | null;

    do {
      const suffix = Math.floor(1000 + Math.random() * 9000).toString();
      username = `${base}${suffix}`;
      exists = await this.usersRepository.findOne({ where: { username } });
    } while (exists);

    return username;
  }
}
