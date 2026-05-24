import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedVaga } from './saved-vaga.entity';
import { Vaga } from '../vagas/vaga.entity';
import { SavedVagasService } from './saved-vagas.service';
import { SavedVagasController } from './saved-vagas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedVaga, Vaga])],
  providers: [SavedVagasService],
  controllers: [SavedVagasController],
})
export class SavedVagasModule {}
