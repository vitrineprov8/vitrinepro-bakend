import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { SavedVagasService } from './saved-vagas.service';
import { PaginationDto } from '../common/pagination.dto';

@Controller()
export class SavedVagasController {
  constructor(private readonly savedVagasService: SavedVagasService) {}

  /** Bookmark a published vaga. Returns 409 if already saved. */
  @Post('vagas/:id/save')
  @UseGuards(JwtAuthGuard)
  save(
    @Request() req: { user: User },
    @Param('id') id: string,
  ) {
    return this.savedVagasService.save(req.user.id, id);
  }

  /** Remove a vaga from bookmarks. Returns 404 if not previously saved. */
  @Delete('vagas/:id/save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unsave(
    @Request() req: { user: User },
    @Param('id') id: string,
  ) {
    return this.savedVagasService.unsave(req.user.id, id);
  }

  /** List the current user's saved vagas (paginated, vaga details included). */
  @Get('me/saved-vagas')
  @UseGuards(JwtAuthGuard)
  listMine(
    @Request() req: { user: User },
    @Query() query: PaginationDto,
  ) {
    return this.savedVagasService.listMine(req.user.id, query);
  }
}
