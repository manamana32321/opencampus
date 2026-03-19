import { Module } from '@nestjs/common';
import { InferenceService } from './inference.service.js';
import { GptInferenceService } from './gpt-inference.js';

@Module({
  providers: [InferenceService, GptInferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
