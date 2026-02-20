import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

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
