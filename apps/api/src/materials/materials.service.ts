import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { WeeksService } from '../weeks/weeks.service.js';
import { InferenceService } from '../inference/inference.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { ProcessorRegistry } from '../processors/processors.module.js';
import { randomUUID } from 'crypto';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private weeks: WeeksService,
    private inference: InferenceService,
    private jobs: JobsService,
    private processors: ProcessorRegistry,
  ) {}

  async findAll(
    userId: number,
    filters: { courseId?: number; week?: number; type?: string },
    page = 1,
    limit = 20,
  ) {
    const where: {
      userId: number;
      parentId: null;
      type?: string;
      courseWeekId?: number | { in: number[] };
    } = { userId, parentId: null };
    if (filters.type) where.type = filters.type;
    if (filters.courseId && filters.week) {
      const courseWeek = await this.prisma.courseWeek.findUnique({
        where: {
          courseId_userId_week: {
            courseId: filters.courseId,
            userId,
            week: filters.week,
          },
        },
      });
      if (courseWeek) where.courseWeekId = courseWeek.id;
    } else if (filters.courseId) {
      const weeks = await this.prisma.courseWeek.findMany({
        where: { courseId: filters.courseId, userId },
        select: { id: true },
      });
      where.courseWeekId = { in: weeks.map((w) => w.id) };
    }

    const [items, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: { courseWeek: { include: { course: true } }, children: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: number, userId: number) {
    const material = await this.prisma.material.findFirst({
      where: { id, userId },
      include: {
        courseWeek: { include: { course: true } },
        children: true,
        jobs: true,
      },
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async presign(userId: number, filename: string, contentType: string) {
    const ext = filename.split('.').pop() ?? 'bin';
    const uuid = randomUUID().slice(0, 8);
    const key = `materials/pending/${uuid}.${ext}`;
    const uploadUrl = await this.storage.getPresignedPutUrl(key, contentType);
    return { uploadUrl, key };
  }

  async confirm(userId: number, key: string, filename: string) {
    // 1. Run inference
    const inference = await this.inference.infer(userId, filename);

    // 2. Move to organized path if inference resolved
    // (For now, keep the pending key — moving in S3/MinIO requires copy+delete)
    const filePath = this.storage.buildFilePath(key);

    // 3. Get or create course_week
    let courseWeekId: number | null = null;
    if (inference.courseId && inference.week) {
      const courseWeek = await this.weeks.getOrCreate(
        inference.courseId,
        userId,
        inference.week,
      );
      courseWeekId = courseWeek.id;
    }

    if (!courseWeekId) {
      const courses = await this.prisma.course.findMany({
        where: { userId },
        take: 1,
      });
      if (courses.length > 0) {
        const cw = await this.weeks.getOrCreate(courses[0].id, userId, 0);
        courseWeekId = cw.id;
      }
    }

    // 4. Create material record
    const material = await this.prisma.material.create({
      data: {
        userId,
        courseWeekId: courseWeekId!,
        type: inference.type ?? 'unknown',
        session: inference.session,
        filePath,
        originalFilename: filename,
        aiConfidence: inference.confidence,
        partNumber: inference.partNumber ?? 1,
        groupId: inference.partNumber ? randomUUID() : null,
      },
      include: { courseWeek: { include: { course: true } } },
    });

    // 5. Create processing job
    const jobType = this.processors.getJobType(material.type);
    const processor = this.processors.getProcessor(material.type);
    if (jobType && processor) {
      const job = await this.jobs.create(userId, material.id, jobType);
      this.runProcessor(processor, job.id, material.id).catch((err) =>
        this.logger.error(
          `Processor failed for material ${material.id}: ${err}`,
        ),
      );
    }

    return { material, inference };
  }

  async upload(userId: number, file: Express.Multer.File) {
    // Multer decodes filenames as latin1; re-encode to recover UTF-8 (e.g. Korean)
    const originalFilename = Buffer.from(
      file.originalname,
      'latin1',
    ).toString('utf8');

    // 1. Run inference
    const inference = await this.inference.infer(userId, originalFilename);

    // 2. Generate S3 key
    const ext = originalFilename.split('.').pop() ?? 'bin';
    const uuid = randomUUID().slice(0, 8);
    const key =
      inference.courseId && inference.week
        ? `materials/${inference.courseId}/week${String(inference.week).padStart(2, '0')}/${uuid}.${ext}`
        : `materials/unsorted/${uuid}.${ext}`;

    // 3. Upload to MinIO
    const filePath = await this.storage.upload(key, file.buffer, file.mimetype);

    // 4. Get or create course_week (if inference resolved)
    let courseWeekId: number | null = null;
    if (inference.courseId && inference.week) {
      const courseWeek = await this.weeks.getOrCreate(
        inference.courseId,
        userId,
        inference.week,
      );
      courseWeekId = courseWeek.id;
    }

    // 5. Create material record
    // If courseWeekId is null, create a week=0 placeholder for unsorted materials
    if (!courseWeekId) {
      const courses = await this.prisma.course.findMany({
        where: { userId },
        take: 1,
      });
      if (courses.length > 0) {
        const cw = await this.weeks.getOrCreate(courses[0].id, userId, 0);
        courseWeekId = cw.id;
      }
    }

    const material = await this.prisma.material.create({
      data: {
        userId,
        courseWeekId: courseWeekId!,
        type: inference.type ?? 'unknown',
        session: inference.session,
        filePath,
        originalFilename,
        aiConfidence: inference.confidence,
        partNumber: inference.partNumber ?? 1,
        groupId: inference.partNumber ? randomUUID() : null,
      },
      include: { courseWeek: { include: { course: true } } },
    });

    // 6. Create processing job (if processor exists for this type)
    const jobType = this.processors.getJobType(material.type);
    const processor = this.processors.getProcessor(material.type);
    if (jobType && processor) {
      const job = await this.jobs.create(userId, material.id, jobType);
      // Run processor asynchronously (don't block upload response)
      this.runProcessor(processor, job.id, material.id).catch((err) =>
        this.logger.error(
          `Processor failed for material ${material.id}: ${err}`,
        ),
      );
    }

    return { material, inference };
  }

  async update(
    id: number,
    userId: number,
    data: {
      courseId?: number;
      week?: number;
      session?: number;
      type?: string;
      transcript?: string;
      extractedText?: string;
      summary?: string;
    },
  ) {
    await this.findById(id, userId); // verify ownership

    const updateData: {
      courseWeekId?: number;
      session?: number;
      type?: string;
      transcript?: string;
      extractedText?: string;
      summary?: string;
    } = {};
    if (data.courseId && data.week) {
      const courseWeek = await this.weeks.getOrCreate(
        data.courseId,
        userId,
        data.week,
      );
      updateData.courseWeekId = courseWeek.id;
    }
    if (data.session !== undefined) updateData.session = data.session;
    if (data.type) updateData.type = data.type;
    if (data.transcript !== undefined) updateData.transcript = data.transcript;
    if (data.extractedText !== undefined)
      updateData.extractedText = data.extractedText;
    if (data.summary !== undefined) updateData.summary = data.summary;

    return this.prisma.material.update({
      where: { id },
      data: updateData,
      include: { courseWeek: { include: { course: true } } },
    });
  }

  async delete(id: number, userId: number) {
    const material = await this.findById(id, userId);
    // Delete from MinIO
    const key = this.storage.extractKey(material.filePath);
    await this.storage.delete(key);
    // Delete children (attached photos)
    for (const child of material.children) {
      const childKey = this.storage.extractKey(child.filePath);
      await this.storage.delete(childKey);
    }
    // Delete from DB (cascade deletes children)
    await this.prisma.material.deleteMany({ where: { parentId: id } });
    await this.prisma.material.delete({ where: { id } });
    return { deleted: true };
  }

  async attachPhoto(
    parentId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    // Multer decodes filenames as latin1; re-encode to recover UTF-8 (e.g. Korean)
    const originalFilename = Buffer.from(
      file.originalname,
      'latin1',
    ).toString('utf8');

    const parent = await this.findById(parentId, userId);
    const ext = originalFilename.split('.').pop() ?? 'jpg';
    const uuid = randomUUID().slice(0, 8);
    const key = `materials/${parent.courseWeek.courseId}/photos/${uuid}.${ext}`;
    const filePath = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.material.create({
      data: {
        userId,
        courseWeekId: parent.courseWeekId,
        parentId,
        type: 'photo',
        filePath,
        originalFilename,
      },
    });
  }

  private async runProcessor(
    processor: {
      process(
        materialId: number,
        onProgress: (pct: number) => void,
      ): Promise<void>;
    },
    jobId: number,
    materialId: number,
  ) {
    // Track the last progress update to avoid race condition between
    // fire-and-forget onProgress(100) and the subsequent complete() call
    let lastProgressPromise: Promise<unknown> = Promise.resolve();
    try {
      await this.jobs.updateProgress(jobId, 0);
      await processor.process(materialId, (pct: number) => {
        lastProgressPromise = this.jobs.updateProgress(jobId, pct);
      });
      await lastProgressPromise;
      await this.jobs.complete(jobId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.jobs.fail(jobId, message);
    }
  }

  async reAnalyze(id: number, userId: number) {
    const material = await this.findById(id, userId);
    const inference = await this.inference.infer(
      userId,
      material.originalFilename ?? 'unknown',
    );

    if (inference.courseId && inference.week) {
      const courseWeek = await this.weeks.getOrCreate(
        inference.courseId,
        userId,
        inference.week,
      );
      await this.prisma.material.update({
        where: { id },
        data: {
          courseWeekId: courseWeek.id,
          session: inference.session,
          type: inference.type ?? undefined,
          aiConfidence: inference.confidence,
        },
      });
    }

    return { material: await this.findById(id, userId), inference };
  }
}
