/**
 * Compliance Controller
 * 
 * REST API controller for regulatory compliance operations including:
 * - KYC/AML verification
 * - GDPR data subject requests
 * - Consent management
 * - Data residency controls
 * - Compliance analytics and reporting
 * 
 * @controller ComplianceController
 * @author PropChain Team
 * @since 2026-03-29
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { RequireScopes } from '../decorators/require-scopes.decorator';
import { Resource } from '../../rbac/enums/resource.enum';
import { Action } from '../../rbac/enums/action.enum';
import {
  InitiateKycDto,
  PerformAmlCheckDto,
  UpdateConsentDto,
  InitiateGdprRequestDto,
  SetDataResidencyDto,
  KycVerificationResponseDto,
  AmlCheckResponseDto,
  ConsentResponseDto,
  GdprRequestResponseDto,
  DataResidencyResponseDto,
  ComplianceAnalyticsDto,
  GdprRequestType,
  DataRegion,
} from '../dto/compliance.dto';
import { KycAmlService } from '../services/kyc-aml.service';
import { GdprService } from '../services/gdpr.service';
import { DataResidencyService } from '../services/data-residency.service';
import { ComplianceReportingService } from '../services/compliance-reporting.service';

@ApiTags('Compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class ComplianceController {
  private readonly logger = new Logger(ComplianceController.name);

  constructor(
    private readonly kycAmlService: KycAmlService,
    private readonly gdprService: GdprService,
    private readonly dataResidencyService: DataResidencyService,
    private readonly complianceReportingService: ComplianceReportingService,
  ) {}

  // ==================== KYC/AML Endpoints ====================

  @Post('kyc/initiate')
  @ApiOperation({ summary: 'Initiate KYC verification for a user' })
  @ApiResponse({ status: 201, description: 'KYC verification initiated', type: KycVerificationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @RequireScopes(Resource.AUDIT, Action.CREATE)
  async initiateKyc(@Body() dto: InitiateKycDto): Promise<KycVerificationResponseDto> {
    this.logger.log(`KYC initiation request for user: ${dto.userId}`);
    return await this.kycAmlService.initiateKycVerification(dto);
  }

  @Get('kyc/status/:userId')
  @ApiOperation({ summary: 'Get KYC verification status for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'KYC status retrieved', type: KycVerificationResponseDto })
  @ApiResponse({ status: 404, description: 'KYC record not found' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getKycStatus(@Param('userId') userId: string): Promise<KycVerificationResponseDto | null> {
    return await this.kycAmlService.getKycStatus(userId);
  }

  @Post('aml/check')
  @ApiOperation({ summary: 'Perform AML screening check' })
  @ApiResponse({ status: 201, description: 'AML check completed', type: AmlCheckResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @RequireScopes(Resource.AUDIT, Action.CREATE)
  async performAmlCheck(@Body() dto: PerformAmlCheckDto): Promise<AmlCheckResponseDto> {
    this.logger.log(`AML check request for user: ${dto.userId}`);
    return await this.kycAmlService.performAmlCheck(dto);
  }

  @Get('aml/history/:userId')
  @ApiOperation({ summary: 'Get AML check history for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to retrieve (default: 10)' })
  @ApiResponse({ status: 200, description: 'AML history retrieved', type: [AmlCheckResponseDto] })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getAmlHistory(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 10,
  ): Promise<AmlCheckResponseDto[]> {
    return await this.kycAmlService.getAmlHistory(userId, limit);
  }

  @Get('kyc-aml/stats')
  @ApiOperation({ summary: 'Get KYC/AML compliance statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getKycAmlStats() {
    return await this.kycAmlService.getComplianceStats();
  }

  // ==================== GDPR & Consent Endpoints ====================

  @Post('gdpr/request')
  @ApiOperation({ summary: 'Initiate a GDPR data subject request' })
  @ApiResponse({ status: 201, description: 'GDPR request initiated', type: GdprRequestResponseDto })
  @RequireScopes(Resource.AUDIT, Action.CREATE)
  async initiateGdprRequest(
    @Body() dto: InitiateGdprRequestDto,
  ): Promise<{ requestId: string; expectedCompletionDate: Date }> {
    this.logger.log(`GDPR request initiated: ${dto.requestType} for user ${dto.userId}`);
    
    return await this.gdprService.initiateGdprRequest(
      dto.userId,
      dto.requestType,
      dto.details,
      dto.fields,
    );
  }

  @Get('gdpr/request/:requestId')
  @ApiOperation({ summary: 'Get GDPR request status' })
  @ApiParam({ name: 'requestId', description: 'GDPR request ID' })
  @ApiResponse({ status: 200, description: 'GDPR request status retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getGdprRequestStatus(@Param('requestId') requestId: string) {
    // This would need a method in GdprService to get a specific request
    // For now, returning a placeholder
    return { requestId, status: 'PENDING' };
  }

  @Get('gdpr/stats')
  @ApiOperation({ summary: 'Get GDPR request statistics' })
  @ApiResponse({ status: 200, description: 'GDPR statistics retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getGdprStats() {
    return await this.gdprService.getGdprRequestStats();
  }

  @Get('gdpr/urgent')
  @ApiOperation({ summary: 'Get urgent GDPR requests approaching deadline' })
  @ApiQuery({ name: 'days', required: false, description: 'Days until deadline (default: 7)' })
  @ApiResponse({ status: 200, description: 'Urgent requests retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getUrgentGdprRequests(@Query('days') days: number = 7) {
    return await this.gdprService.getUrgentGdprRequests(days);
  }

  @Get('consent/:userId')
  @ApiOperation({ summary: 'Get user consent preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Consents retrieved', type: ConsentResponseDto })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getUserConsents(@Param('userId') userId: string): Promise<ConsentResponseDto> {
    const consents = await this.gdprService.getUserConsents(userId);
    
    return {
      userId,
      consents: consents as any,
      updatedAt: new Date(),
    };
  }

  @Put('consent')
  @ApiOperation({ summary: 'Update user consent preferences' })
  @ApiResponse({ status: 200, description: 'Consents updated', type: ConsentResponseDto })
  @RequireScopes(Resource.AUDIT, Action.UPDATE)
  async updateConsent(
    @Body() dto: UpdateConsentDto,
    @Request() req: any,
  ): Promise<ConsentResponseDto> {
    const userId = req.user?.userId || req.user?.id;
    
    const result = await this.gdprService.updateUserConsent(userId, dto.consentTypes, dto.granted, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      ...(dto.notes && { notes: dto.notes }),
    });

    return {
      userId,
      consents: result.consents,
      updatedAt: new Date(),
    };
  }

  // ==================== Data Residency Endpoints ====================

  @Post('residency')
  @ApiOperation({ summary: 'Set or update user data residency configuration' })
  @ApiResponse({ status: 201, description: 'Data residency configured', type: DataResidencyResponseDto })
  @RequireScopes(Resource.AUDIT, Action.CREATE)
  async setDataResidency(@Body() dto: SetDataResidencyDto): Promise<DataResidencyResponseDto> {
    this.logger.log(`Data residency configuration for user: ${dto.userId}`);
    return await this.dataResidencyService.setDataResidency(dto);
  }

  @Get('residency/:userId')
  @ApiOperation({ summary: 'Get user data residency configuration' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Data residency retrieved', type: DataResidencyResponseDto })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getDataResidency(@Param('userId') userId: string): Promise<DataResidencyResponseDto | null> {
    return await this.dataResidencyService.getDataResidency(userId);
  }

  @Get('residency/regions')
  @ApiOperation({ summary: 'Get available data regions' })
  @ApiResponse({ status: 200, description: 'Regions retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getAvailableRegions() {
    return {
      regions: this.dataResidencyService.getAvailableRegions(),
      default: process.env.DATA_RESIDENCY_DEFAULT_REGION || 'US',
    };
  }

  @Get('residency/regulations/:region')
  @ApiOperation({ summary: 'Get applicable regulations for a region' })
  @ApiParam({ name: 'region', description: 'Data region', enum: DataRegion })
  @ApiResponse({ status: 200, description: 'Regulations retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getRegionRegulations(@Param('region') region: DataRegion) {
    return {
      region,
      regulations: this.dataResidencyService.getRegionRegulations(region),
    };
  }

  @Get('residency/summary')
  @ApiOperation({ summary: 'Get regional compliance summary' })
  @ApiResponse({ status: 200, description: 'Regional summary retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getRegionalComplianceSummary() {
    return await this.dataResidencyService.getRegionalComplianceSummary();
  }

  // ==================== Compliance Analytics & Reporting ====================

  @Get('analytics')
  @ApiOperation({ summary: 'Get comprehensive compliance analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved', type: ComplianceAnalyticsDto })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getComplianceAnalytics(): Promise<ComplianceAnalyticsDto> {
    const [kycAmlStats, gdprStats, regionalSummary] = await Promise.all([
      this.kycAmlService.getComplianceStats(),
      this.gdprService.getGdprRequestStats(),
      this.dataResidencyService.getRegionalComplianceSummary(),
    ]);

    // Calculate overall metrics
    const totalKycVerifications = kycAmlStats.totalKycVerifications;
    const kycVerified = kycAmlStats.kycVerified;
    const kycVerificationRate = totalKycVerifications > 0 
      ? (kycVerified / totalKycVerifications) * 100 
      : 0;

    const totalAmlChecks = kycAmlStats.totalAmlChecks;
    const amlFlaggedCases = kycAmlStats.amlFlagged + kycAmlStats.amlBlocked;

    const pendingGdprRequests = gdprStats.pending + gdprStats.inProgress;
    const gdprOnTimeCompletion = gdprStats.completed - gdprStats.overdue;
    const gdprOnTimeRate = gdprStats.completed > 0 
      ? (gdprOnTimeCompletion / gdprStats.completed) * 100 
      : 100;

    // Calculate overall compliance score (weighted average)
    const overallComplianceScore = Math.round(
      (kycVerificationRate * 0.3) + 
      ((100 - (amlFlaggedCases / Math.max(totalAmlChecks, 1)) * 100) * 0.3) +
      (gdprOnTimeRate * 0.2) +
      (regionalSummary.length > 0 ? 100 : 80) * 0.2 // Data residency compliance
    );

    return {
      totalKycVerifications,
      kycVerificationRate: Math.round(kycVerificationRate * 100) / 100,
      totalAmlChecks,
      amlFlaggedCases,
      pendingGdprRequests,
      gdprOnTimeCompletion,
      overallComplianceScore: Math.min(100, Math.max(0, overallComplianceScore)),
      dataResidencyComplianceRate: regionalSummary.length > 0 ? 100 : 80,
      generatedAt: new Date(),
    };
  }

  @Get('report')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Report start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Report end date (ISO 8601)' })
  @ApiQuery({ name: 'format', required: false, description: 'Report format (json, csv)', enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Report generated' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO 8601 format.');
    }

    const report = await this.complianceReportingService.generateComplianceReport(start, end);
    
    if (format === 'csv') {
      return await this.complianceReportingService.exportReport(report, 'csv');
    }

    return report;
  }

  @Get('report/trends')
  @ApiOperation({ summary: 'Get compliance trends over time' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'interval', required: false, enum: ['daily', 'weekly', 'monthly'] })
  @ApiResponse({ status: 200, description: 'Trends retrieved' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async getComplianceTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO 8601 format.');
    }

    return await this.complianceReportingService.getComplianceTrends(start, end, interval);
  }

  // ==================== Administrative Endpoints ====================

  @Post('kyc-aml/enable')
  @ApiOperation({ summary: 'Enable/disable KYC/AML verification (admin only)' })
  @ApiQuery({ name: 'enabled', description: 'Enable or disable', type: Boolean })
  @RequireScopes(Resource.AUDIT, Action.UPDATE)
  async toggleKycAml(@Query('enabled') enabled: boolean) {
    this.kycAmlService.setKycEnabled(enabled);
    this.kycAmlService.setAmlEnabled(enabled);
    
    return {
      success: true,
      kycEnabled: enabled,
      amlEnabled: enabled,
    };
  }

  @Get('data-export/:userId')
  @ApiOperation({ summary: 'Export user data for GDPR compliance' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Data exported' })
  @RequireScopes(Resource.AUDIT, Action.READ)
  async exportUserData(@Param('userId') userId: string) {
    return await this.gdprService.exportUserData(userId);
  }

  @Delete('user/:userId')
  @ApiOperation({ summary: 'Delete/anonymize user data for GDPR right to be forgotten' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User data anonymized' })
  @RequireScopes(Resource.USER, Action.DELETE)
  async deleteUser(@Param('userId') userId: string) {
    await this.gdprService.deleteUser(userId);
    
    return {
      success: true,
      message: 'User data anonymized for GDPR compliance',
    };
  }
}
