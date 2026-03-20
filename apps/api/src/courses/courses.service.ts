import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CanvasClient } from '@opencampus/canvas';
import type { Module } from '@opencampus/canvas';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private prisma: PrismaService) {}

  async findAllByUser(userId: number) {
    return this.prisma.course.findMany({
      where: { userId },
      include: { semester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSemesters(userId: number) {
    return this.prisma.semester.findMany({
      where: { userId },
      orderBy: { name: 'desc' },
    });
  }

  async findById(id: number, userId: number) {
    return this.prisma.course.findFirstOrThrow({
      where: { id, userId },
      include: { semester: true },
    });
  }

  async update(
    id: number,
    userId: number,
    data: { shortName?: string; metadata?: any; notes?: string },
  ) {
    // Verify ownership
    await this.prisma.course.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.course.update({ where: { id }, data });
  }

  async syncFromCanvas(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.canvasAccessToken) {
      throw new BadRequestException(
        'Canvas access token not set. Update via PATCH /users/me',
      );
    }

    const canvas = new CanvasClient({
      baseUrl: 'https://canvas.skku.edu',
      accessToken: user.canvasAccessToken,
    });
    const canvasCourses = await canvas.getCourses();

    const results = [];
    for (const cc of canvasCourses) {
      if (!cc.name) continue; // skip access-denied courses
      const semesterName = this.deriveSemesterName(cc.startAt, cc.term?.name);
      if (!semesterName) continue;

      const termStart = cc.term?.startAt ?? cc.startAt;
      const termEnd = cc.term?.endAt ?? cc.endAt;
      const semester = await this.prisma.semester.upsert({
        where: { userId_name: { userId, name: semesterName } },
        update: {
          startDate: termStart ? new Date(termStart) : undefined,
          endDate: termEnd ? new Date(termEnd) : undefined,
        },
        create: {
          userId,
          name: semesterName,
          startDate: termStart ? new Date(termStart) : null,
          endDate: termEnd ? new Date(termEnd) : null,
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

      // Sync modules → course_weeks
      try {
        const modules = await canvas.getModules(cc.id);
        await this.syncWeeksFromModules(userId, course.id, modules);
      } catch {
        this.logger.warn(`Failed to sync modules for course ${cc.name}`);
      }

      results.push(course);
    }
    return results;
  }

  private async syncWeeksFromModules(
    userId: number,
    courseId: number,
    modules: Module[],
  ) {
    for (const mod of modules) {
      const weekNum = this.parseWeekNumber(mod.name);
      if (weekNum === null) continue;

      await this.prisma.courseWeek.upsert({
        where: {
          courseId_userId_week: { courseId, userId, week: weekNum },
        },
        update: {},
        create: {
          courseId,
          userId,
          week: weekNum,
          dateStart: mod.unlockAt ? new Date(mod.unlockAt) : null,
        },
      });
    }
  }

  private parseWeekNumber(name: string): number | null {
    // "1주차", "2주차", "Week 1", "Week 2" etc.
    const match = name.match(/(\d+)\s*주차/) ?? name.match(/[Ww]eek\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private deriveSemesterName(
    startAt: string | null,
    termName?: string,
  ): string | null {
    // Try parsing term name first (e.g., "2026년 1학기" → "2026-1")
    if (termName) {
      const termMatch = termName.match(/(\d{4}).*?(\d)학기/);
      if (termMatch) return `${termMatch[1]}-${termMatch[2]}`;
    }
    // Fallback to startAt date
    if (!startAt) return null;
    const d = new Date(startAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (month >= 2 && month <= 7) return `${year}-1`;
    if (month >= 8) return `${year}-2`;
    return `${year - 1}-2`;
  }
}
