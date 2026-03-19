import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CanvasClient } from '@opencampus/canvas';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAllByUser(userId: number) {
    return this.prisma.course.findMany({
      where: { userId },
      include: { semester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number, userId: number) {
    return this.prisma.course.findFirstOrThrow({
      where: { id, userId },
      include: { semester: true },
    });
  }

  async update(id: number, userId: number, data: { shortName?: string; metadata?: any; notes?: string }) {
    // Verify ownership
    await this.prisma.course.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.course.update({ where: { id }, data });
  }

  async syncFromCanvas(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.canvasAccessToken) {
      throw new BadRequestException('Canvas access token not set. Update via PATCH /users/me');
    }

    const canvas = new CanvasClient({
      baseUrl: 'https://canvas.skku.edu',
      accessToken: user.canvasAccessToken,
    });
    const canvasCourses = await canvas.getCourses();

    const results = [];
    for (const cc of canvasCourses) {
      const semesterName = this.deriveSemesterName(cc.startAt);
      if (!semesterName) continue;

      const semester = await this.prisma.semester.upsert({
        where: { userId_name: { userId, name: semesterName } },
        update: {},
        create: {
          userId,
          name: semesterName,
          startDate: cc.startAt ? new Date(cc.startAt) : null,
          endDate: cc.endAt ? new Date(cc.endAt) : null,
        },
      });

      const existing = await this.prisma.course.findFirst({
        where: { userId, canvasId: cc.id },
      });

      const course = existing
        ? await this.prisma.course.update({
            where: { id: existing.id },
            data: { name: cc.name },
          })
        : await this.prisma.course.create({
            data: {
              userId,
              semesterId: semester.id,
              name: cc.name,
              canvasId: cc.id,
            },
          });

      results.push(course);
    }
    return results;
  }

  private deriveSemesterName(startAt: string | null): string | null {
    if (!startAt) return null;
    const d = new Date(startAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (month >= 2 && month <= 7) return `${year}-1`;
    if (month >= 8) return `${year}-2`;
    return `${year - 1}-2`;
  }
}
