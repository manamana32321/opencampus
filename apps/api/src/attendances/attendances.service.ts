import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LearningXClient } from '@opencampus/canvas';

@Injectable()
export class AttendancesService {
  constructor(private prisma: PrismaService) {}

  async findByCourse(userId: number, courseId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId, courseId };

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ week: 'asc' }, { session: 'asc' }],
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(
    userId: number,
    data: { courseId: number; week: number; session?: number; status: string; note?: string },
  ) {
    await this.prisma.course.findFirstOrThrow({ where: { id: data.courseId, userId } });

    return this.prisma.attendance.upsert({
      where: {
        userId_courseId_week_session: {
          userId,
          courseId: data.courseId,
          week: data.week,
          session: data.session ?? 0,
        },
      },
      update: {
        status: data.status,
        note: data.note,
        checkedAt: new Date(),
      },
      create: {
        userId,
        courseId: data.courseId,
        week: data.week,
        session: data.session ?? null,
        status: data.status,
        note: data.note,
        source: 'manual',
        checkedAt: new Date(),
      },
    });
  }

  async update(id: number, userId: number, data: { status?: string; note?: string }) {
    await this.prisma.attendance.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.attendance.update({ where: { id }, data });
  }

  async syncFromCanvas(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.canvasAccessToken) {
      throw new BadRequestException('Canvas access token not set. Update via PATCH /users/me');
    }

    const learningx = new LearningXClient({
      baseUrl: 'https://canvas.skku.edu',
      accessToken: user.canvasAccessToken,
    });

    const courses = await this.prisma.course.findMany({
      where: { userId, canvasId: { not: null } },
    });

    let synced = 0;

    for (const course of courses) {
      let items;
      try {
        items = await learningx.getAttendanceItems(course.canvasId!);
      } catch {
        // Course may not have LearningX data; skip silently
        continue;
      }

      const attendanceItems = items.filter((item) => item.required);

      for (const item of attendanceItems) {
        const canvasItemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
        if (isNaN(canvasItemId)) continue;

        // Derive week from title or use sequential index — fall back to 1
        const week = this.deriveWeek(item.title) ?? 1;

        const existing = await this.prisma.attendance.findFirst({
          where: { userId, courseId: course.id, canvasItemId },
        });

        // Never overwrite manual records
        if (existing?.source === 'manual') continue;

        const status = item.status ?? (item.completedAt ? 'present' : 'absent');

        if (existing) {
          await this.prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status,
              syncedAt: new Date(),
            },
          });
        } else {
          await this.prisma.attendance.create({
            data: {
              userId,
              courseId: course.id,
              week,
              session: null,
              status,
              source: 'canvas_sync',
              canvasItemId,
              syncedAt: new Date(),
            },
          });
        }
        synced++;
      }
    }

    return { synced };
  }

  private deriveWeek(title: string): number | null {
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}
