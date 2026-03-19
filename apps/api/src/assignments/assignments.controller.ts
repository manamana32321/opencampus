import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AssignmentsService } from './assignments.service.js';

@Controller('assignments')
@UseGuards(AuthGuard)
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('course_id') courseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assignments.findAll(
      req.user.userId,
      courseId ? parseInt(courseId, 10) : undefined,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.assignments.findById(id, req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: any) {
    return this.assignments.syncFromCanvas(req.user.userId);
  }
}
