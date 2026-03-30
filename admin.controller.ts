/**
 * @fileoverview Controller for admin-only endpoints.
 * @issue #206
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import {
  AdminDashboardQueryDto,
  AdminDashboardResponseDto,
} from './dto/dashboard.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get platform-wide analytics for the admin dashboard' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved dashboard data.', type: AdminDashboardResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden. User is not an admin.' })
  getDashboardAnalytics(
    @Query() query: AdminDashboardQueryDto,
  ): Promise<AdminDashboardResponseDto> {
    return this.adminService.getDashboardAnalytics(query);
  }
}