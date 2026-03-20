import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { CoursesService } from './courses.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.courses.findAllByUser(req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: AuthRequest) {
    return this.courses.syncFromCanvas(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.courses.findById(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body()
    body: {
      shortName?: string;
      metadata?: Record<string, unknown>;
      notes?: string;
    },
  ) {
    return this.courses.update(id, req.user.userId, body);
  }
}
