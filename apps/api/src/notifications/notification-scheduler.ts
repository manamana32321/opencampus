import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { WebhookService } from './webhook.service.js';

@Injectable()
export class NotificationScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationScheduler.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private webhooks: WebhookService,
  ) {}

  onModuleInit() {
    // Run every 60 seconds
    this.interval = setInterval(
      () => this.tick().catch((e) => this.logger.error('Scheduler tick failed', e)),
      60_000,
    );
    // Also run once on startup after 5s delay
    setTimeout(
      () => this.tick().catch((e) => this.logger.error('Initial tick failed', e)),
      5_000,
    );
  }

  private async tick() {
    await this.checkAssignmentDeadlines();
    // Future: checkAttendanceDeadlines()
  }

  private async checkAssignmentDeadlines() {
    const settings = await this.prisma.notificationSetting.findMany({
      where: { type: 'assignment_due', enabled: true },
      include: { user: true },
    });

    for (const setting of settings) {
      const now = new Date();
      const deadline = new Date(now.getTime() + setting.advanceMinutes * 60_000);

      // Find assignments due between now and deadline, not yet notified
      const assignments = await this.prisma.assignment.findMany({
        where: {
          userId: setting.userId,
          dueAt: { gte: now, lte: deadline },
          status: { in: ['pending', 'late'] },
        },
        include: { course: true },
      });

      for (const assignment of assignments) {
        // Check if already notified
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: setting.userId,
            type: 'assignment_due',
            referenceType: 'assignment',
            referenceId: assignment.id,
          },
        });
        if (existing) continue;

        const title = `과제 마감 임박: ${assignment.title}`;
        const message = `${assignment.course.name} — ${assignment.dueAt?.toLocaleString('ko-KR')} 마감`;

        await this.notifications.create(
          setting.userId,
          'assignment_due',
          title,
          message,
          'assignment',
          assignment.id,
        );

        // Dispatch webhook if enabled
        if (setting.channels.includes('webhook') && setting.webhookUrl) {
          await this.webhooks.dispatch(setting.webhookUrl, {
            type: 'assignment_due',
            title,
            message,
            assignmentId: assignment.id,
            dueAt: assignment.dueAt,
          });
        }
      }
    }
  }
}
