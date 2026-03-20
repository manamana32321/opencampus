import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { WeeksModule } from '../weeks/weeks.module.js';
import { InferenceModule } from '../inference/inference.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ProcessorsModule } from '../processors/processors.module.js';

@Module({
  imports: [WeeksModule, InferenceModule, JobsModule, ProcessorsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
