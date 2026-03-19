import { Module } from '@nestjs/common';
import { AttendancesController } from './attendances.controller.js';
import { AttendancesService } from './attendances.service.js';

@Module({
  controllers: [AttendancesController],
  providers: [AttendancesService],
  exports: [AttendancesService],
})
export class AttendancesModule {}
