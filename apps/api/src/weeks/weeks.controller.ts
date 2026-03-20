import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { WeeksService } from './weeks.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('courses/:courseId/weeks')
@UseGuards(AuthGuard)
export class WeeksController {
  constructor(private weeks: WeeksService) {}

  @Get()
  findAll(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Req() req: AuthRequest,
  ) {
    return this.weeks.findByCourse(courseId, req.user.userId);
  }
}
