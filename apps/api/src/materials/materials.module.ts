import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { WeeksModule } from '../weeks/weeks.module.js';
import { InferenceModule } from '../inference/inference.module.js';

@Module({
  imports: [WeeksModule, InferenceModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
