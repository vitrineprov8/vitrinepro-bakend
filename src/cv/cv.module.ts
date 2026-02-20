import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CV } from './cv.entity';
import { CvService } from './cv.service';
import { CvController } from './cv.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CV])],
  providers: [CvService],
  controllers: [CvController],
})
export class CvModule {}
