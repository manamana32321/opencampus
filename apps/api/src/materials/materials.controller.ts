import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard.js';
import { MaterialsService } from './materials.service.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('materials')
@UseGuards(AuthGuard)
export class MaterialsController {
  constructor(private materials: MaterialsService) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('course_id') courseId?: string,
    @Query('week') week?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.materials.findAll(
      req.user.userId,
      {
        courseId: courseId ? parseInt(courseId, 10) : undefined,
        week: week ? parseInt(week, 10) : undefined,
        type,
      },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }),
  )
  upload(@Req() req: AuthRequest, @UploadedFile() file: Express.Multer.File) {
    return this.materials.upload(req.user.userId, file);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.materials.findById(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body()
    body: {
      courseId?: number;
      week?: number;
      session?: number;
      type?: string;
      transcript?: string;
      extractedText?: string;
      summary?: string;
    },
  ) {
    return this.materials.update(id, req.user.userId, body);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.materials.delete(id, req.user.userId);
  }

  @Post(':id/analyze')
  reAnalyze(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.materials.reAnalyze(id, req.user.userId);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  attachPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.materials.attachPhoto(id, req.user.userId, file);
  }
}
