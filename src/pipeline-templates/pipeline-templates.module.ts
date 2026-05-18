import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineTemplate } from './pipeline-template.entity';
import { PipelineTemplatesService } from './pipeline-templates.service';
import { PipelineTemplatesController } from './pipeline-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PipelineTemplate])],
  providers: [PipelineTemplatesService],
  controllers: [PipelineTemplatesController],
  exports: [PipelineTemplatesService],
})
export class PipelineTemplatesModule {}
