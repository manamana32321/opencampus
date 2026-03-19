import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CoursesService } from './courses.service.js';

@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.courses.findAllByUser(req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: any) {
    return this.courses.syncFromCanvas(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.courses.findById(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() body: any) {
    return this.courses.update(id, req.user.userId, body);
  }
}
