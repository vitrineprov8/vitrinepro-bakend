import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const seedService = app.get(SeedService);
  try {
    const result = await seedService.run();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e: any) {
    console.error('Seed failed:', e.message);
    if (e.detail) console.error('Detail:', e.detail);
    if (e.code) console.error('PG code:', e.code);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
