import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { AnnouncementsService } from './announcements.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('announcements')
@UseGuards(AuthGuard)
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('course_id') courseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.announcements.findAll(
      req.user.userId,
      courseId ? parseInt(courseId, 10) : undefined,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.announcements.markRead(id, req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: AuthRequest) {
    return this.announcements.syncFromCanvas(req.user.userId);
  }
}
