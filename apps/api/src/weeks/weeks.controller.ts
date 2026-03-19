import { Controller, Get, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { WeeksService } from './weeks.service.js';

@Controller('courses/:courseId/weeks')
@UseGuards(AuthGuard)
export class WeeksController {
  constructor(private weeks: WeeksService) {}

  @Get()
  findAll(@Param('courseId', ParseIntPipe) courseId: number, @Req() req: any) {
    return this.weeks.findByCourse(courseId, req.user.userId);
  }
}
