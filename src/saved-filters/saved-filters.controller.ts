import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Controller('me/saved-filters')
@UseGuards(JwtAuthGuard)
export class SavedFiltersController {
  constructor(private readonly savedFiltersService: SavedFiltersService) {}

  /** Create a new saved filter. If isDefault = true, previous default is unset. */
  @Post()
  create(
    @Request() req: { user: User },
    @Body() dto: CreateSavedFilterDto,
  ) {
    return this.savedFiltersService.create(req.user.id, dto);
  }

  /** List all saved filters for the current user, ordered by position then createdAt. */
  @Get()
  listMine(@Request() req: { user: User }) {
    return this.savedFiltersService.listMine(req.user.id);
  }

  /** Update a saved filter's name, filters blob, default flag, or position. */
  @Patch(':id')
  update(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateSavedFilterDto,
  ) {
    return this.savedFiltersService.update(id, req.user.id, dto);
  }

  /** Delete a saved filter. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: { user: User },
    @Param('id') id: string,
  ) {
    return this.savedFiltersService.remove(id, req.user.id);
  }

  /**
   * Mark a filter as the default for the Radar.
   * Atomically unsets the previous default and sets this one.
   */
  @Post(':id/default')
  setDefault(
    @Request() req: { user: User },
    @Param('id') id: string,
  ) {
    return this.savedFiltersService.setDefault(id, req.user.id);
  }
}
