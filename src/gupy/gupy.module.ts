import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GupyConfig } from './gupy-config.entity';
import { GupyService } from './gupy.service';
import { GupyController } from './gupy.controller';
import { Vaga } from '../vagas/vaga.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GupyConfig, Vaga])],
  providers: [GupyService],
  controllers: [GupyController],
  exports: [GupyService],
})
export class GupyModule {}
