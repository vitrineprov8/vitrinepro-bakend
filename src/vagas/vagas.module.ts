import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaga } from './vaga.entity';
import { VagasService } from './vagas.service';
import { VagasController } from './vagas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vaga])],
  providers: [VagasService],
  controllers: [VagasController],
  exports: [VagasService],
})
export class VagasModule {}
