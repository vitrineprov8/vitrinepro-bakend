import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/** B13 — sino de notificações + preferências por evento×canal. */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Request() req: { user: { id: string } },
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.list(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('read-all')
  markAllRead(@Request() req: { user: { id: string } }) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Get('preferences')
  getPreferences(@Request() req: { user: { id: string } }) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(req.user.id, dto);
  }
}
