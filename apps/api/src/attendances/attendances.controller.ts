import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { AttendancesService } from './attendances.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller()
@UseGuards(AuthGuard)
export class AttendancesController {
  constructor(private attendances: AttendancesService) {}

  @Get('courses/:courseId/attendances')
  findByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendances.findByCourse(
      req.user.userId,
      courseId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('attendances')
  create(
    @Req() req: AuthRequest,
    @Body()
    body: {
      courseId: number;
      week: number;
      session?: number;
      status: string;
      note?: string;
    },
  ) {
    return this.attendances.create(req.user.userId, body);
  }

  @Patch('attendances/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() body: { status?: string; note?: string },
  ) {
    return this.attendances.update(id, req.user.userId, body);
  }

  @Post('attendances/sync')
  sync(@Req() req: AuthRequest) {
    return this.attendances.syncFromCanvas(req.user.userId);
  }
}
