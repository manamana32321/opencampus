import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationSettingsService } from './notification-settings.service.js';
import { NotificationScheduler } from './notification-scheduler.js';
import { WebhookService } from './webhook.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationSettingsService,
    NotificationScheduler,
    WebhookService,
  ],
  exports: [NotificationsService, NotificationSettingsService],
})
export class NotificationsModule {}
