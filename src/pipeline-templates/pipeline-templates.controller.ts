import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { PipelineTemplatesService } from './pipeline-templates.service';
import { UpdatePipelineTemplateDto } from './dto/update-pipeline-template.dto';

@Controller('me/pipeline-template')
@UseGuards(JwtAuthGuard)
export class PipelineTemplatesController {
  constructor(private readonly service: PipelineTemplatesService) {}

  /**
   * GET /me/pipeline-template
   *
   * Returns the authenticated user's pipeline template.
   * Creates a default template on first access (lazy-init).
   */
  @Get()
  getMyTemplate(@Request() req: { user: User }) {
    return this.service.getOrCreate(req.user);
  }

  /**
   * PATCH /me/pipeline-template
   *
   * Replaces the stages list.  The 'rejected' stage is appended automatically
   * if the client does not include it.
   */
  @Patch()
  updateMyTemplate(
    @Request() req: { user: User },
    @Body() dto: UpdatePipelineTemplateDto,
  ) {
    return this.service.update(req.user, dto.stages);
  }
}
