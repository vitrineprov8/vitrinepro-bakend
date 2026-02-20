import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Education } from './education.entity';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EducationService {
  constructor(
    @InjectRepository(Education)
    private educationRepository: Repository<Education>,
    private storageService: StorageService,
  ) {}

  async findAllByUser(userId: string): Promise<Education[]> {
    return this.educationRepository.find({
      where: { userId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateEducationDto): Promise<Education> {
    const education = this.educationRepository.create({ ...dto, userId });
    return this.educationRepository.save(education);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateEducationDto,
  ): Promise<Education> {
    const education = await this.findOneOrFail(id, userId);
    Object.assign(education, dto);
    return this.educationRepository.save(education);
  }

  async delete(id: string, userId: string): Promise<void> {
    const education = await this.findOneOrFail(id, userId);
    if (education.certificateKey) {
      await this.storageService.deleteFile(education.certificateKey);
    }
    await this.educationRepository.remove(education);
  }

  async uploadCertificate(
    id: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<Education> {
    const education = await this.findOneOrFail(id, userId);
    this.storageService.validatePdf(file.buffer, file.mimetype);

    if (education.certificateKey) {
      await this.storageService.deleteFile(education.certificateKey);
    }

    const key = `certificates/${userId}/${id}.pdf`;
    const url = await this.storageService.uploadFile(file.buffer, key, 'application/pdf');

    education.certificateUrl = url;
    education.certificateKey = key;
    return this.educationRepository.save(education);
  }

  private async findOneOrFail(id: string, userId: string): Promise<Education> {
    const education = await this.educationRepository.findOne({ where: { id } });
    if (!education) throw new NotFoundException('Educação não encontrada.');
    if (education.userId !== userId) throw new ForbiddenException('Acesso negado.');
    return education;
  }
}
