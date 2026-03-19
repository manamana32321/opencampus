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
import { AuthGuard } from '../auth/auth.guard.js';
import { AnnouncementsService } from './announcements.service.js';

@Controller('announcements')
@UseGuards(AuthGuard)
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  findAll(
    @Req() req: any,
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
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.announcements.markRead(id, req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: any) {
    return this.announcements.syncFromCanvas(req.user.userId);
  }
}
