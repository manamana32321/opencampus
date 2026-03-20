import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_SETTINGS: Record<
  string,
  { enabled: boolean; advanceMinutes: number; channels: string[] }
> = {
  assignment_due: { enabled: true, advanceMinutes: 60, channels: ['web'] },
  attendance_due: { enabled: true, advanceMinutes: 360, channels: ['web'] },
  announcement_new: { enabled: true, advanceMinutes: 0, channels: ['web'] },
  stt_complete: { enabled: true, advanceMinutes: 0, channels: ['web'] },
};

@Injectable()
export class NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    const existing = await this.prisma.notificationSetting.findMany({
      where: { userId },
    });
    const existingMap = new Map(existing.map((s) => [s.type, s]));

    const results = [];
    for (const [type, defaults] of Object.entries(DEFAULT_SETTINGS)) {
      if (existingMap.has(type)) {
        results.push(existingMap.get(type)!);
      } else {
        const created = await this.prisma.notificationSetting.create({
          data: {
            userId,
            type,
            enabled: defaults.enabled,
            advanceMinutes: defaults.advanceMinutes,
            channels: defaults.channels,
          },
        });
        results.push(created);
      }
    }

    // Include any non-default types already in DB
    for (const s of existing) {
      if (!DEFAULT_SETTINGS[s.type]) {
        results.push(s);
      }
    }

    return results;
  }

  async update(
    userId: number,
    type: string,
    data: {
      enabled?: boolean;
      advanceMinutes?: number;
      channels?: string[];
      webhookUrl?: string;
    },
  ) {
    return this.prisma.notificationSetting.upsert({
      where: { userId_type: { userId, type } },
      update: data,
      create: {
        userId,
        type,
        enabled: data.enabled ?? DEFAULT_SETTINGS[type]?.enabled ?? true,
        advanceMinutes:
          data.advanceMinutes ?? DEFAULT_SETTINGS[type]?.advanceMinutes ?? 0,
        channels: data.channels ?? DEFAULT_SETTINGS[type]?.channels ?? ['web'],
        webhookUrl: data.webhookUrl ?? null,
      },
    });
  }
}
