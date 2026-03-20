import { Module } from '@nestjs/common';
import { CoursesController, SemestersController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

@Module({
  controllers: [CoursesController, SemestersController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
