import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { JobsService } from './jobs.service.js';
import { JobQueue } from './job-queue.js';

interface AuthRequest extends Request {
  user: { userId: number };
}

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(
    private jobs: JobsService,
    private jobQueue: JobQueue,
  ) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('status') status?: string,
    @Query('material_id') materialIdRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const materialId = materialIdRaw ? parseInt(materialIdRaw, 10) : undefined;
    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 20;
    return this.jobs.findAll(
      req.user.userId,
      { status, materialId },
      page,
      limit,
    );
  }

  @Get(':id/stream')
  stream(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onStart = (payload: { jobId: number }) => {
      if (payload.jobId === id) send('start', payload);
    };
    const onProgress = (payload: { jobId: number; progress: number }) => {
      if (payload.jobId === id) send('progress', payload);
    };
    const onComplete = (payload: { jobId: number }) => {
      if (payload.jobId === id) {
        send('complete', payload);
        cleanup();
        res.end();
      }
    };
    const onError = (payload: { jobId: number; error: string }) => {
      if (payload.jobId === id) {
        send('error', payload);
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      this.jobQueue.off('start', onStart);
      this.jobQueue.off('progress', onProgress);
      this.jobQueue.off('complete', onComplete);
      this.jobQueue.off('error', onError);
    };

    this.jobQueue.on('start', onStart);
    this.jobQueue.on('progress', onProgress);
    this.jobQueue.on('complete', onComplete);
    this.jobQueue.on('error', onError);

    req.on('close', cleanup);
  }
}
