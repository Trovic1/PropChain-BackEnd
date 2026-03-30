/**
 * @fileoverview Service for admin-specific functionalities, like dashboard analytics.
 * @issue #206
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  AdminDashboardQueryDto,
  AdminDashboardResponseDto,
} from './dto/dashboard.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardAnalytics(
    query: AdminDashboardQueryDto,
  ): Promise<AdminDashboardResponseDto> {
    const { startDate, endDate } = query;

    const dateFilter =
      startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    const [
      userCounts,
      projectCounts,
      donationStats,
      feeStats,
      recentActivity,
    ] = await this.prisma.$transaction([
      // 1. Get user counts by role
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 2. Get project counts by status
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { id: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 3. Get total donation amount and count
      this.prisma.donation.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 4. Get total platform fees collected
      this.prisma.platformFee.aggregate({
        _sum: { amount: true },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      // 5. Get recent platform activity
      this.prisma.activityLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    // Format user stats
    const usersByRole = userCounts.reduce((acc, item) => {
      acc[item.role] = item._count.id;
      return acc;
    }, {});
    const totalUsers = userCounts.reduce((sum, item) => sum + item._count.id, 0);

    // Format project stats
    const projectsByStatus = projectCounts.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});
    const totalProjects = projectCounts.reduce(
      (sum, item) => sum + item._count.id,
      0,
    );

    return {
      userStats: {
        total: totalUsers,
        byRole: usersByRole,
      },
      projectStats: {
        total: totalProjects,
        byStatus: projectsByStatus,
      },
      donationStats: {
        totalAmount: donationStats._sum.amount || 0,
        totalCount: donationStats._count.id || 0,
      },
      platformFees: {
        totalCollected: feeStats._sum.amount || 0,
      },
      recentActivity,
      query: {
        startDate,
        endDate,
      },
    };
  }
}