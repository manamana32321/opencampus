import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CanvasClient } from '@opencampus/canvas';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number, courseId?: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = courseId ? { userId, courseId } : { userId };

    const [items, total] = await Promise.all([
      this.prisma.announcementRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { postedAt: 'desc' },
      }),
      this.prisma.announcementRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async markRead(id: number, userId: number) {
    await this.prisma.announcementRecord.findFirstOrThrow({
      where: { id, userId },
    });
    return this.prisma.announcementRecord.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async syncFromCanvas(
    userId: number,
  ): Promise<{ synced: number; new: number }> {
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

    const courses = await this.prisma.course.findMany({
      where: { userId, canvasId: { not: null } },
    });

    let synced = 0;
    let newCount = 0;

    for (const course of courses) {
      let announcements;
      try {
        announcements = await canvas.getAnnouncements(course.canvasId!);
      } catch {
        continue;
      }

      for (const ca of announcements) {
        const existing = await this.prisma.announcementRecord.findFirst({
          where: { userId, canvasId: ca.id },
        });

        if (existing) {
          await this.prisma.announcementRecord.update({
            where: { id: existing.id },
            data: {
              title: ca.title,
              message: ca.message,
              author: ca.author?.displayName ?? null,
              postedAt: ca.postedAt ? new Date(ca.postedAt) : null,
              canvasUrl: ca.htmlUrl,
              syncedAt: new Date(),
            },
          });
        } else {
          await this.prisma.announcementRecord.create({
            data: {
              userId,
              courseId: course.id,
              canvasId: ca.id,
              title: ca.title,
              message: ca.message,
              author: ca.author?.displayName ?? null,
              postedAt: ca.postedAt ? new Date(ca.postedAt) : null,
              canvasUrl: ca.htmlUrl,
              syncedAt: new Date(),
            },
          });
          newCount++;
        }
        synced++;
      }
    }

    return { synced, new: newCount };
  }
}
