import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationSettingsService } from './notification-settings.service.js';

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private settings: NotificationSettingsService,
  ) {}

  @Get('notifications')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.findAll(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('notifications/read-all')
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.notifications.markRead(id, req.user.userId);
  }

  @Get('notification-settings')
  getSettings(@Req() req: any) {
    return this.settings.findAll(req.user.userId);
  }

  @Patch('notification-settings/:type')
  updateSetting(@Param('type') type: string, @Req() req: any, @Body() body: any) {
    return this.settings.update(req.user.userId, type, body);
  }
}
