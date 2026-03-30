/**
 * @fileoverview DTOs for the admin dashboard endpoint.
 * @issue #206
 */

import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class AdminDashboardQueryDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

export class AdminDashboardResponseDto {
  userStats: {
    total: number;
    byRole: Record<string, number>;
  };
  projectStats: {
    total: number;
    byStatus: Record<string, number>;
  };
  donationStats: {
    totalAmount: number;
    totalCount: number;
  };
  platformFees: {
    totalCollected: number;
  };
  recentActivity: any[];
  query: {
    startDate?: Date;
    endDate?: Date;
  };
}