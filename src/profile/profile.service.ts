import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private storageService: StorageService,
  ) {}

  async getMyProfile(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async getPublicProfile(username: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) throw new NotFoundException('Perfil não encontrado.');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (dto.username && dto.username !== user.username) {
      const exists = await this.usersRepository.findOne({
        where: { username: dto.username },
      });
      if (exists) throw new ConflictException('Username já está em uso.');
    }

    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    this.storageService.validateImage(file.buffer, file.mimetype);

    if (user.avatarKey) {
      await this.storageService.deleteFile(user.avatarKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'avatar');
    const key = `avatars/${userId}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    user.avatarUrl = url;
    user.avatarKey = key;
    return this.usersRepository.save(user);
  }

  async uploadBanner(userId: string, file: Express.Multer.File): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    this.storageService.validateImage(file.buffer, file.mimetype);

    if (user.bannerKey) {
      await this.storageService.deleteFile(user.bannerKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'banner');
    const key = `banners/${userId}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    user.bannerUrl = url;
    user.bannerKey = key;
    return this.usersRepository.save(user);
  }
}
