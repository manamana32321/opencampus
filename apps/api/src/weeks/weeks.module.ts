import { Module } from '@nestjs/common';
import { WeeksController } from './weeks.controller.js';
import { WeeksService } from './weeks.service.js';

@Module({
  controllers: [WeeksController],
  providers: [WeeksService],
  exports: [WeeksService],
})
export class WeeksModule {}
