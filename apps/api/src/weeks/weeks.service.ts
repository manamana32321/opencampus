import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WeeksService {
  constructor(private prisma: PrismaService) {}

  async findByCourse(courseId: number, userId: number) {
    // Verify course ownership
    await this.prisma.course.findFirstOrThrow({
      where: { id: courseId, userId },
    });

    const weeks = await this.prisma.courseWeek.findMany({
      where: { courseId, userId },
      include: { _count: { select: { materials: true } } },
      orderBy: { week: 'asc' },
    });

    return weeks.map((w) => {
      const { _count, ...week } = w;
      return { ...week, materialCount: _count.materials };
    });
  }

  async getOrCreate(courseId: number, userId: number, week: number) {
    return this.prisma.courseWeek.upsert({
      where: { courseId_userId_week: { courseId, userId, week } },
      update: {},
      create: { courseId, userId, week },
    });
  }
}
