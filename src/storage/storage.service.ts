import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export type ImageContext = 'avatar' | 'banner' | 'cover' | 'content';

const IMAGE_SIZES: Record<ImageContext, { width: number; height: number }> = {
  avatar: { width: 400, height: 400 },
  banner: { width: 1920, height: 600 },
  cover: { width: 1280, height: 720 },
  content: { width: 1280, height: 960 },
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PDF_TYPE = 'application/pdf';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.R2_BUCKET_NAME!;
    this.publicUrl = process.env.R2_PUBLIC_URL!;
  }

  validateImage(buffer: Buffer, mimeType: string): void {
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de arquivo inválido. Aceitos: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Imagem muito grande. Máximo 8MB.');
    }
  }

  validatePdf(buffer: Buffer, mimeType: string): void {
    if (mimeType !== ALLOWED_PDF_TYPE) {
      throw new BadRequestException('Apenas arquivos PDF são aceitos.');
    }
    if (buffer.length > MAX_PDF_SIZE) {
      throw new BadRequestException('PDF muito grande. Máximo 20MB.');
    }
  }

  async processImage(buffer: Buffer, context: ImageContext): Promise<Buffer> {
    const { width, height } = IMAGE_SIZES[context];
    const processed = await sharp(buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .withMetadata({ exif: {} })
      .toBuffer();
    return processed;
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      // Silently ignore if file doesn't exist
    }
  }
}
