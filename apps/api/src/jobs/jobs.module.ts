import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { JobQueue } from './job-queue.js';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobQueue],
  exports: [JobsService, JobQueue],
})
export class JobsModule {}
