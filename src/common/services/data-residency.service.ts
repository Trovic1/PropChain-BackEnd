/**
 * Data Residency Service
 * 
 * Manages data residency and sovereignty compliance for geographic data storage requirements.
 * Ensures user data is stored in approved regions based on their location and applicable regulations.
 * 
 * Features:
 * - Geographic data routing based on user location
 * - Region-specific storage enforcement
 * - Cross-border transfer compliance
 * - Regulatory mapping (GDPR, CCPA, etc.)
 * - Data localization controls
 * 
 * @class DataResidencyService
 * @author PropChain Team
 * @since 2026-03-29
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService, AuditOperation } from './audit.service';
import { SetDataResidencyDto, DataResidencyResponseDto, DataRegion } from '../dto/compliance.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DataResidencyService {
  private readonly logger = new Logger(DataResidencyService.name);
  private readonly defaultRegion: DataRegion;
  private readonly enabledRegions: DataRegion[];
  private readonly crossBorderTransfersAllowed: boolean;

  // Region to storage location mapping
  private readonly regionStorageMap: Map<DataRegion, string> = new Map([
    [DataRegion.EU, 'eu-west-1'],
    [DataRegion.US, 'us-east-1'],
    [DataRegion.APAC, 'ap-southeast-1'],
    [DataRegion.LATAM, 'sa-east-1'],
    [DataRegion.MIDDLE_EAST, 'me-central-1'],
  ]);

  // Country to region mapping
  private readonly countryRegionMap: Map<string, DataRegion> = new Map([
    // EU countries
    ['DE', DataRegion.EU],
    ['FR', DataRegion.EU],
    ['IT', DataRegion.EU],
    ['ES', DataRegion.EU],
    ['NL', DataRegion.EU],
    ['BE', DataRegion.EU],
    ['AT', DataRegion.EU],
    ['SE', DataRegion.EU],
    ['DK', DataRegion.EU],
    ['FI', DataRegion.EU],
    ['IE', DataRegion.EU],
    ['PT', DataRegion.EU],
    ['PL', DataRegion.EU],
    ['CZ', DataRegion.EU],
    ['GR', DataRegion.EU],
    // US
    ['US', DataRegion.US],
    ['CA', DataRegion.US],
    ['MX', DataRegion.US],
    // APAC
    ['AU', DataRegion.APAC],
    ['NZ', DataRegion.APAC],
    ['JP', DataRegion.APAC],
    ['KR', DataRegion.APAC],
    ['SG', DataRegion.APAC],
    ['HK', DataRegion.APAC],
    ['IN', DataRegion.APAC],
    ['ID', DataRegion.APAC],
    ['TH', DataRegion.APAC],
    ['MY', DataRegion.APAC],
    ['PH', DataRegion.APAC],
    ['VN', DataRegion.APAC],
    // LATAM
    ['BR', DataRegion.LATAM],
    ['AR', DataRegion.LATAM],
    ['CL', DataRegion.LATAM],
    ['CO', DataRegion.LATAM],
    ['PE', DataRegion.LATAM],
    // Middle East
    ['AE', DataRegion.MIDDLE_EAST],
    ['SA', DataRegion.MIDDLE_EAST],
    ['IL', DataRegion.MIDDLE_EAST],
    ['TR', DataRegion.MIDDLE_EAST],
    ['QA', DataRegion.MIDDLE_EAST],
    ['KW', DataRegion.MIDDLE_EAST],
  ]);

  // Region to applicable regulations mapping
  private readonly regionRegulationsMap: Map<DataRegion, string[]> = new Map([
    [DataRegion.EU, ['GDPR', 'ePrivacy Directive', 'Data Governance Act']],
    [DataRegion.US, ['CCPA', 'CPRA', 'HIPAA', 'GLBA']],
    [DataRegion.APAC, ['PDPA', 'PIPL', 'APPI', 'Privacy Act']],
    [DataRegion.LATAM, ['LGPD', 'LFPDPPP', 'Habeas Data']],
    [DataRegion.MIDDLE_EAST, ['PDPL', 'UAE Data Law', 'Privacy Law']],
  ]);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {
    this.defaultRegion = this.configService.get<DataRegion>('DATA_RESIDENCY_DEFAULT_REGION', DataRegion.US);
    
    const enabledRegionsConfig = this.configService.get<string>('DATA_RESIDENCY_ENABLED_REGIONS', 'EU,US,APAC');
    this.enabledRegions = enabledRegionsConfig.split(',').map(r => r.trim() as DataRegion);
    
    this.crossBorderTransfersAllowed = this.configService.get<boolean>(
      'DATA_RESIDENCY_ALLOW_CROSS_BORDER',
      false,
    );

    this.logger.log(`Data Residency Service initialized. Default region: ${this.defaultRegion}`);
  }

  /**
   * Set or update user's data residency configuration
   */
  async setDataResidency(dto: SetDataResidencyDto): Promise<DataResidencyResponseDto> {
    this.logger.log(`Setting data residency for user: ${dto.userId}, country: ${dto.countryCode}`);

    try {
      // Determine assigned region based on country
      const assignedRegion = this.determineRegion(dto.countryCode, dto.preferredRegion);

      // Get storage location for the region
      const storageLocation = this.regionStorageMap.get(assignedRegion) || 'us-east-1';

      // Get applicable regulations
      const applicableRegulations = this.regionRegulationsMap.get(assignedRegion) || [];

      // Check if cross-border transfer is allowed
      const allowCrossBorder = dto.allowCrossBorderTransfer && this.crossBorderTransfersAllowed;

      // Upsert data residency record
      const dataResidency = await this.prisma.dataResidency.upsert({
        where: { userId: dto.userId },
        update: {
          preferredRegion: dto.preferredRegion,
          assignedRegion,
          countryCode: dto.countryCode,
          storageLocation,
          crossBorderTransferAllowed: allowCrossBorder,
          applicableRegulations,
        },
        create: {
          id: uuidv4(),
          userId: dto.userId,
          preferredRegion: dto.preferredRegion,
          assignedRegion,
          countryCode: dto.countryCode,
          storageLocation,
          crossBorderTransferAllowed: allowCrossBorder,
          applicableRegulations,
        },
      });

      // Log audit
      await this.auditService.logAction({
        tableName: 'data_residencies',
        operation: AuditOperation.UPDATE,
        newData: {
          action: 'DATA_RESIDENCY_SET',
          userId: dto.userId,
          assignedRegion,
          storageLocation,
        },
      });

      this.logger.log(`Data residency set successfully for user ${dto.userId}. Region: ${assignedRegion}`);

      return this.mapToResponseDto(dataResidency);
    } catch (error: any) {
      this.logger.error(`Failed to set data residency: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's data residency configuration
   */
  async getDataResidency(userId: string): Promise<DataResidencyResponseDto | null> {
    const dataResidency = await this.prisma.dataResidency.findUnique({
      where: { userId },
    });

    if (!dataResidency) {
      return null;
    }

    return this.mapToResponseDto(dataResidency);
  }

  /**
   * Determine appropriate region based on country code
   */
  private determineRegion(countryCode: string, preferredRegion?: DataRegion): DataRegion {
    // If preferred region is provided and enabled, use it
    if (preferredRegion && this.enabledRegions.includes(preferredRegion)) {
      return preferredRegion;
    }

    // Try to determine region from country code
    const region = this.countryRegionMap.get(countryCode.toUpperCase());
    
    if (region && this.enabledRegions.includes(region)) {
      return region;
    }

    // Fall back to default region
    return this.defaultRegion;
  }

  /**
   * Validate if data can be transferred across borders
   */
  async validateCrossBorderTransfer(
    userId: string,
    destinationRegion: DataRegion,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const dataResidency = await this.getDataResidency(userId);

    if (!dataResidency) {
      return { allowed: true, reason: 'No residency restrictions configured' };
    }

    // Check if cross-border transfer is allowed
    if (!dataResidency.crossBorderTransferAllowed) {
      return {
        allowed: false,
        reason: `Cross-border transfers not allowed for user in ${dataResidency.assignedRegion} region`,
      };
    }

    // Check if destination region is in approved list
    if (!this.enabledRegions.includes(destinationRegion)) {
      return {
        allowed: false,
        reason: `Destination region ${destinationRegion} is not enabled`,
      };
    }

    // Additional checks could be added based on specific regulations
    // For example, GDPR requires adequate protection for transfers outside EU

    return { allowed: true };
  }

  /**
   * Get storage location for a user
   */
  async getUserStorageLocation(userId: string): Promise<string> {
    const dataResidency = await this.getDataResidency(userId);
    
    if (!dataResidency) {
      // Return default storage location
      return this.regionStorageMap.get(this.defaultRegion) || 'us-east-1';
    }

    return dataResidency.storageLocation;
  }

  /**
   * Enforce data residency rules for data access
   */
  async enforceDataResidency(userId: string, requestedRegion?: DataRegion): Promise<boolean> {
    const dataResidency = await this.getDataResidency(userId);

    if (!dataResidency) {
      // No restrictions, allow access
      return true;
    }

    // If requesting specific region, check if it matches user's residency
    if (requestedRegion && requestedRegion !== dataResidency.assignedRegion) {
      // Check if cross-border transfer is allowed
      const validation = await this.validateCrossBorderTransfer(userId, requestedRegion);
      
      if (!validation.allowed) {
        this.logger.warn(
          `Data residency violation attempt: User ${userId} (${dataResidency.assignedRegion}) ` +
          `tried to access data in ${requestedRegion}`,
        );
        
        // Log compliance alert
        await this.logResidencyViolation(userId, dataResidency.assignedRegion, requestedRegion);
        
        return false;
      }
    }

    return true;
  }

  /**
   * Log data residency violation attempt
   */
  private async logResidencyViolation(
    userId: string,
    userRegion: string,
    requestedRegion: DataRegion,
  ): Promise<void> {
    await this.prisma.complianceAlert.create({
      data: {
        id: uuidv4(),
        userId,
        alertType: 'DATA_RESIDENCY_VIOLATION',
        severity: 'HIGH',
        status: 'OPEN',
        details: {
          userRegion,
          requestedRegion,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date(),
      },
    });

    this.logger.warn(`Data residency violation logged for user ${userId}`);
  }

  /**
   * Get all users in a specific region
   */
  async getUsersInRegion(region: DataRegion): Promise<string[]> {
    const residencies = await this.prisma.dataResidency.findMany({
      where: { assignedRegion: region },
      select: { userId: true },
    });

    return residencies.map((r: any) => r.userId);
  }

  /**
   * Get regional compliance summary
   */
  async getRegionalComplianceSummary(): Promise<{
    region: string;
    userCount: number;
    regulations: string[];
    storageLocation: string;
  }[]> {
    const summaries = await Promise.all(
      this.enabledRegions.map(async (region) => {
        const userCount = await this.prisma.dataResidency.count({
          where: { assignedRegion: region },
        });

        return {
          region,
          userCount,
          regulations: this.regionRegulationsMap.get(region) || [],
          storageLocation: this.regionStorageMap.get(region) || 'unknown',
        };
      }),
    );

    return summaries;
  }

  /**
   * Update user's country code and recalculate region
   */
  async updateUserCountry(userId: string, countryCode: string): Promise<DataResidencyResponseDto> {
    const existingResidency = await this.getDataResidency(userId);

    if (!existingResidency) {
      throw new Error('No data residency configuration found for user');
    }

    // Recalculate region based on new country
    const newRegion = this.determineRegion(countryCode);

    // Update residency
    return this.setDataResidency({
      userId,
      preferredRegion: newRegion,
      countryCode,
      allowCrossBorderTransfer: existingResidency.crossBorderTransferAllowed,
    });
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(dataResidency: any): DataResidencyResponseDto {
    return {
      userId: dataResidency.userId,
      assignedRegion: dataResidency.assignedRegion as DataRegion,
      countryCode: dataResidency.countryCode,
      storageLocation: dataResidency.storageLocation,
      crossBorderTransferAllowed: dataResidency.crossBorderTransferAllowed,
      applicableRegulations: dataResidency.applicableRegulations || [],
      updatedAt: dataResidency.updatedAt,
    };
  }

  /**
   * Validate country code
   */
  isValidCountryCode(countryCode: string): boolean {
    return this.countryRegionMap.has(countryCode.toUpperCase());
  }

  /**
   * Get available regions
   */
  getAvailableRegions(): DataRegion[] {
    return [...this.enabledRegions];
  }

  /**
   * Get regulations for a region
   */
  getRegionRegulations(region: DataRegion): string[] {
    return this.regionRegulationsMap.get(region) || [];
  }

  /**
   * Get storage location for region
   */
  getStorageLocation(region: DataRegion): string {
    return this.regionStorageMap.get(region) || 'us-east-1';
  }
}
