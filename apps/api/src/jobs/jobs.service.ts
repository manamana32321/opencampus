import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobQueue } from './job-queue.js';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private jobQueue: JobQueue,
  ) {}

  async create(userId: number, materialId: number, type: string) {
    const job = await this.prisma.job.create({
      data: { userId, materialId, type, status: 'pending', progress: 0 },
    });

    this.jobQueue.enqueue({
      jobId: job.id,
      type: job.type,
      handler: async () => {
        // No-op handler — Phase 3 will register real handlers
      },
    });

    return job;
  }

  async findAll(
    userId: number,
    filters?: { status?: string; materialId?: number },
    page = 1,
    limit = 20,
  ) {
    const where: Record<string, unknown> = { userId };
    if (filters?.status) where['status'] = filters.status;
    if (filters?.materialId) where['materialId'] = filters.materialId;

    const [total, items] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { total, page, limit, items };
  }

  async findById(id: number, userId: number) {
    const job = await this.prisma.job.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async updateProgress(id: number, progress: number) {
    const job = await this.prisma.job.update({
      where: { id },
      data: { progress, status: 'running' },
    });
    this.jobQueue.emitProgress(id, progress);
    return job;
  }

  async complete(id: number) {
    return this.prisma.job.update({
      where: { id },
      data: { status: 'done', progress: 100 },
    });
  }

  async fail(id: number, error: string) {
    return this.prisma.job.update({
      where: { id },
      data: { status: 'failed', error },
    });
  }
}
