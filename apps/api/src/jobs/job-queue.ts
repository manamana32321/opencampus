import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

interface QueuedJob {
  jobId: number;
  type: string;
  handler: () => Promise<void>;
}

@Injectable()
export class JobQueue extends EventEmitter {
  private readonly concurrency = 2;
  private running = 0;
  private queue: QueuedJob[] = [];

  enqueue(job: QueuedJob): void {
    this.queue.push(job);
    this.drain();
  }

  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.run(job);
    }
  }

  private async run(job: QueuedJob): Promise<void> {
    this.running++;
    this.emit('start', { jobId: job.jobId, type: job.type });

    try {
      await job.handler();
      this.emit('complete', { jobId: job.jobId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.emit('error', { jobId: job.jobId, error });
    } finally {
      this.running--;
      this.drain();
    }
  }

  emitProgress(jobId: number, progress: number): void {
    this.emit('progress', { jobId, progress });
  }
}
