import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma/prisma.service';

/**
 * Property Cleanup Service
 * 
 * Handles scheduled cleanup tasks for soft-deleted properties.
 * This service addresses issue #258 by permanently deleting old soft-deleted properties.
 */
@Injectable()
export class PropertyCleanupService {
  private readonly logger = new Logger(PropertyCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cleanup old soft-deleted properties
   * 
   * Runs daily at 2:00 AM to permanently delete properties that have been soft deleted
   * for more than 30 days. This addresses issue #258.
   */
  @Cron('0 2 * * *') // Daily at 2:00 AM
  async cleanupOldSoftDeletedProperties(): Promise<void> {
    this.logger.log('Starting cleanup of old soft-deleted properties');

    try {
      // Delete properties that have been soft deleted for more than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await (this.prisma as any).property.deleteMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old soft-deleted properties`);
    } catch (error) {
      this.logger.error('Failed to cleanup old soft-deleted properties', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger for testing/admin purposes
   * 
   * @param daysOld - Number of days old to delete (default: 30)
   */
  async manualCleanup(daysOld: number = 30): Promise<{ deletedCount: number }> {
    this.logger.log(`Starting manual cleanup of properties older than ${daysOld} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await (this.prisma as any).property.deleteMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Manual cleanup completed: ${result.count} properties deleted`);
      return { deletedCount: result.count };
    } catch (error) {
      this.logger.error('Manual cleanup failed', error);
      throw error;
    }
  }

  /**
   * Get statistics about soft-deleted properties
   */
  async getSoftDeletedStats(): Promise<{
    totalSoftDeleted: number;
    olderThan30Days: number;
    olderThan60Days: number;
    oldestDeletion: Date | null;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [
        totalSoftDeleted,
        olderThan30Days,
        olderThan60Days,
        oldestProperty,
      ] = await Promise.all([
        (this.prisma as any).property.count({
          where: { isDeleted: true },
        }),
        (this.prisma as any).property.count({
          where: {
            isDeleted: true,
            deletedAt: { lt: thirtyDaysAgo },
          },
        }),
        (this.prisma as any).property.count({
          where: {
            isDeleted: true,
            deletedAt: { lt: sixtyDaysAgo },
          },
        }),
        (this.prisma as any).property.findFirst({
          where: { isDeleted: true },
          orderBy: { deletedAt: 'asc' },
          select: { deletedAt: true },
        }),
      ]);

      return {
        totalSoftDeleted,
        olderThan30Days,
        olderThan60Days,
        oldestDeletion: oldestProperty?.deletedAt || null,
      };
    } catch (error) {
      this.logger.error('Failed to get soft-deleted stats', error);
      throw error;
    }
  }
}
