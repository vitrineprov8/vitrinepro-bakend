import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CV } from './cv.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(CV)
    private cvRepository: Repository<CV>,
    private storageService: StorageService,
  ) {}

  async findAllByUser(userId: string): Promise<CV[]> {
    return this.cvRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async upload(userId: string, label: string, file: Express.Multer.File): Promise<CV> {
    this.storageService.validatePdf(file.buffer, file.mimetype);
    const timestamp = Date.now();
    const safeLabel = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const key = `cvs/${userId}/${timestamp}_${safeLabel}.pdf`;
    const url = await this.storageService.uploadFile(file.buffer, key, 'application/pdf');
    const cv = this.cvRepository.create({ userId, label, fileUrl: url, fileKey: key });
    return this.cvRepository.save(cv);
  }

  async update(id: string, userId: string, data: { label?: string; isActive?: boolean }): Promise<CV> {
    const cv = await this.findOneOrFail(id, userId);
    Object.assign(cv, data);
    return this.cvRepository.save(cv);
  }

  async delete(id: string, userId: string): Promise<void> {
    const cv = await this.findOneOrFail(id, userId);
    await this.storageService.deleteFile(cv.fileKey);
    await this.cvRepository.remove(cv);
  }

  async getDownloadUrl(id: string): Promise<{ url: string }> {
    const cv = await this.cvRepository.findOne({ where: { id } });
    if (!cv) throw new NotFoundException('CV não encontrado.');
    return { url: cv.fileUrl };
  }

  private async findOneOrFail(id: string, userId: string): Promise<CV> {
    const cv = await this.cvRepository.findOne({ where: { id } });
    if (!cv) throw new NotFoundException('CV não encontrado.');
    if (cv.userId !== userId) throw new ForbiddenException('Acesso negado.');
    return cv;
  }
}
