import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, total, page, limit, unreadCount };
  }

  async markRead(id: number, userId: number) {
    await this.prisma.notification.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async create(
    userId: number,
    type: string,
    title: string,
    message: string,
    referenceType?: string,
    referenceId?: number,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        referenceType: referenceType ?? null,
        referenceId: referenceId ?? null,
      },
    });
  }
}
