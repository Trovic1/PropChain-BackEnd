import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationTemplateEngine } from './TemplateEngine';
import { NotificationChannelManager } from './ChannelManager';
import { NotificationChannel, NotificationPriority, NotificationStatus, SendNotificationInput } from '../models/Notification';

@Injectable()
export class NotificationManager {
  private readonly logger = new Logger(NotificationManager.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateEngine: NotificationTemplateEngine,
    private readonly channelManager: NotificationChannelManager
  ) {}

  /**
   * Main entry point to send notifications
   */
  async send(input: SendNotificationInput) {
    const { userId, templateId, channels = [NotificationChannel.WEB_SOCKET], priority = NotificationPriority.MEDIUM, data = {} } = input;

    this.logger.log(`Starting notification send: ${templateId} for user: ${userId}`);

    // Create the record in the database
    // Assuming 'notification' row exists in Prisma schema
    // @ts-ignore
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        templateId,
        channels,
        priority,
        status: NotificationStatus.PENDING,
        data,
        createdAt: new Date(),
      },
    });

    try {
      // Logic for rendering the template
      const rendered = this.templateEngine.render(templateId, data);
      const deliveryPayload = { userId, ...rendered, data };

      // Dispatch to channels
      const deliveryResults = await this.channelManager.send(channels, deliveryPayload);

      // Final status update - simple logic: if any settled, it's sent
      const anySuccess = deliveryResults.some((res) => res.status === 'fulfilled' && res.value === true);
      const newStatus = anySuccess ? NotificationStatus.SENT : NotificationStatus.FAILED;

      // Update the record
      // @ts-ignore
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: newStatus,
          sentAt: new Date(),
          metadata: { deliveryResults },
        },
      });

      this.logger.log(`Notification ${notification.id} processed with status: ${newStatus}`);
      return { id: notification.id, status: newStatus };
    } catch (error) {
      this.logger.error(`Failed to process notification: ${notification.id}`, error);
      // @ts-ignore
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, metadata: { error: error.message } },
      });
      throw error;
    }
  }

  /**
   * Bulk processing of notifications (e.g., for newsletters or system-wide announcements)
   */
  async sendBulk(inputs: SendNotificationInput[]) {
    this.logger.log(`Bulk processing of ${inputs.length} notifications`);
    // Using simple loop, but could be integrated with BullMQ for better scalability
    const results = [];
    for (const input of inputs) {
      results.push(await this.send(input));
    }
    return results;
  }

  /**
   * Get delivery analytics for a user or template
   */
  async getAnalytics(userId?: string) {
    // Logic for basic delivery analytics
    // @ts-ignore
    const totalSent = await this.prisma.notification.count({
      where: { userId, status: NotificationStatus.SENT },
    });
    // @ts-ignore
    const totalFailed = await this.prisma.notification.count({
      where: { userId, status: NotificationStatus.FAILED },
    });

    return { totalSent, totalFailed, deliveryRate: totalSent > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0 };
  }
}
