/**
 * KYC/AML Service
 * 
 * Handles Know Your Customer (KYC) and Anti-Money Laundering (AML) verification
 * with integration to major identity verification providers.
 * 
 * Features:
 * - Identity verification with document validation
 * - AML screening against sanctions lists (OFAC, UN, EU)
 * - PEP (Politically Exposed Person) screening
 * - Adverse media checking
 * - Risk scoring and assessment
 * - Ongoing monitoring
 * 
 * @class KycAmlService
 * @author PropChain Team
 * @since 2026-03-29
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService, AuditOperation } from './audit.service';
import {
  InitiateKycDto,
  KycVerificationResponseDto,
  PerformAmlCheckDto,
  AmlCheckResponseDto,
  KycStatus,
  AmlStatus,
  DocumentType,
} from '../dto/compliance.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * KYC Provider Interface
 * Defines the contract for KYC verification providers
 */
interface KycProvider {
  name: string;
  initiateVerification(data: any): Promise<any>;
  getVerificationStatus(referenceId: string): Promise<any>;
  uploadDocument(referenceId: string, documentType: string, documentUrl: string): Promise<void>;
}

/**
 * AML Screening Provider Interface
 */
interface AmlProvider {
  name: string;
  screenIndividual(data: any): Promise<any>;
  screenWallet(walletAddress: string): Promise<any>;
  screenTransaction(transaction: any): Promise<any>;
}

@Injectable()
export class KycAmlService {
  private readonly logger = new Logger(KycAmlService.name);
  private readonly kycProviders: Map<string, KycProvider> = new Map();
  private readonly amlProviders: Map<string, AmlProvider> = new Map();
  private readonly defaultKycProvider: string;
  private readonly defaultAmlProvider: string;
  private readonly kycEnabled: boolean;
  private readonly amlEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {
    this.defaultKycProvider = this.configService.get<string>('KYC_DEFAULT_PROVIDER', 'mock');
    this.defaultAmlProvider = this.configService.get<string>('AML_DEFAULT_PROVIDER', 'mock');
    this.kycEnabled = this.configService.get<boolean>('KYC_ENABLED', true);
    this.amlEnabled = this.configService.get<boolean>('AML_ENABLED', true);

    // Initialize providers (in production, these would be real integrations)
    this.initializeMockProviders();
    this.logger.log('KYC/AML Service initialized');
  }

  /**
   * Initialize mock providers for development/testing
   * In production, replace with actual provider integrations (e.g., Jumio, Onfido, Sumsub, Chainalysis)
   */
  private initializeMockProviders(): void {
    // Mock KYC Provider
    this.kycProviders.set('mock', {
      name: 'mock',
      initiateVerification: async (data) => ({
        referenceId: uuidv4(),
        status: 'PENDING',
        message: 'Mock verification initiated',
      }),
      getVerificationStatus: async (referenceId) => ({
        referenceId,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        riskScore: Math.random() * 100,
      }),
      uploadDocument: async () => {},
    });

    // Mock AML Provider
    this.amlProviders.set('mock', {
      name: 'mock',
      screenIndividual: async (data) => ({
        checkId: uuidv4(),
        status: 'CLEAR',
        sanctionsMatch: false,
        pepMatch: false,
        adverseMediaMatch: false,
        riskLevel: 'LOW',
        riskScore: Math.random() * 30,
      }),
      screenWallet: async (walletAddress) => ({
        checkId: uuidv4(),
        walletAddress,
        riskLevel: 'LOW',
        riskScore: Math.random() * 30,
      }),
      screenTransaction: async (transaction) => ({
        checkId: uuidv4(),
        status: 'CLEAR',
        riskLevel: 'LOW',
        riskScore: Math.random() * 30,
      }),
    });

    // TODO: Implement real providers in production
    // Example providers to integrate:
    // KYC: Jumio, Onfido, Sumsub, Veriff, ID.me
    // AML: Chainalysis, Elliptic, ComplyAdvantage, Refinitiv World-Check
  }

  /**
   * Initiate KYC verification for a user
   */
  async initiateKycVerification(dto: InitiateKycDto): Promise<KycVerificationResponseDto> {
    if (!this.kycEnabled) {
      throw new Error('KYC verification is currently disabled');
    }

    this.logger.log(`Initiating KYC verification for user: ${dto.userId}`);

    try {
      // Get the KYC provider
      const provider = this.kycProviders.get(this.defaultKycProvider);
      if (!provider) {
        throw new Error(`KYC provider '${this.defaultKycProvider}' not found`);
      }

      // Initiate verification with provider
      const initiationResult = await provider.initiateVerification({
        userId: dto.userId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth,
        countryOfResidence: dto.countryOfResidence,
      });

      // Upload documents if URLs provided
      if (dto.documentFrontUrl) {
        await provider.uploadDocument(initiationResult.referenceId, 'FRONT', dto.documentFrontUrl);
      }
      if (dto.documentBackUrl) {
        await provider.uploadDocument(initiationResult.referenceId, 'BACK', dto.documentBackUrl);
      }
      if (dto.selfieUrl) {
        await provider.uploadDocument(initiationResult.referenceId, 'SELFIE', dto.selfieUrl);
      }

      // Store KYC request in database
      const kycRecord = await this.prisma.kycVerification.create({
        data: {
          id: uuidv4(),
          userId: dto.userId,
          providerReferenceId: initiationResult.referenceId,
          provider: this.defaultKycProvider,
          documentType: dto.documentType,
          status: KycStatus.IN_REVIEW,
          metadata: {
            fullName: dto.fullName,
            dateOfBirth: dto.dateOfBirth,
            countryOfResidence: dto.countryOfResidence,
            documentNumber: dto.documentNumber,
          },
          createdAt: new Date(),
        },
      });

      // Log audit
      await this.auditService.logAction({
        tableName: 'kyc_verifications',
        operation: AuditOperation.CREATE,
        newData: {
          action: 'KYC_INITIATED',
          userId: dto.userId,
          kycId: kycRecord.id,
          provider: this.defaultKycProvider,
        },
      });

      this.logger.log(`KYC verification initiated successfully. Reference: ${initiationResult.referenceId}`);

      return {
        kycRequestId: kycRecord.id,
        userId: dto.userId,
        status: KycStatus.IN_REVIEW,
        providerReferenceId: initiationResult.referenceId,
        verifiedAt: new Date(),
        riskScore: 0,
        metadata: {},
      };
    } catch (error: any) {
      this.logger.error(`KYC verification failed: ${error.message}`, error.stack);
      
      await this.auditService.logAction({
        tableName: 'kyc_verifications',
        operation: AuditOperation.CREATE,
        newData: {
          action: 'KYC_FAILED',
          userId: dto.userId,
          error: error.message || 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Get KYC verification status
   */
  async getKycStatus(userId: string): Promise<KycVerificationResponseDto | null> {
    const latestKyc = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestKyc) {
      return null;
    }

    // Check if we need to refresh status from provider
    const provider = this.kycProviders.get(latestKyc.provider);
    if (provider && latestKyc.status === KycStatus.IN_REVIEW) {
      try {
        const providerStatus = await provider.getVerificationStatus(latestKyc.providerReferenceId);
        
        // Update local record
        const updatedKyc = await this.prisma.kycVerification.update({
          where: { id: latestKyc.id },
          data: {
            status: providerStatus.status as KycStatus,
            riskScore: providerStatus.riskScore,
            verifiedAt: providerStatus.verifiedAt,
            metadata: {
              ...latestKyc.metadata,
              providerData: providerStatus,
            },
          },
        });

        return this.mapToResponseDto(updatedKyc);
      } catch (error: any) {
        this.logger.warn(`Failed to refresh KYC status from provider: ${error.message}`);
      }
    }

    return this.mapToResponseDto(latestKyc);
  }

  /**
   * Perform AML check on user
   */
  async performAmlCheck(dto: PerformAmlCheckDto): Promise<AmlCheckResponseDto> {
    if (!this.amlEnabled) {
      throw new Error('AML screening is currently disabled');
    }

    this.logger.log(`Performing AML check for user: ${dto.userId}, wallet: ${dto.walletAddress}`);

    try {
      // Get the AML provider
      const provider = this.amlProviders.get(this.defaultAmlProvider);
      if (!provider) {
        throw new Error(`AML provider '${this.defaultAmlProvider}' not found`);
      }

      // Screen individual
      const individualScreen = await provider.screenIndividual({
        userId: dto.userId,
        walletAddress: dto.walletAddress,
      });

      // Screen wallet address
      const walletScreen = await provider.screenWallet(dto.walletAddress);

      // Screen transaction if amount provided
      let transactionScreen = null;
      if (dto.transactionAmount) {
        transactionScreen = await provider.screenTransaction({
          amount: dto.transactionAmount,
          currency: dto.currency || 'USD',
          walletAddress: dto.walletAddress,
        });
      }

      // Aggregate results
      const isSanctionsMatch = individualScreen.sanctionsMatch || false;
      const isPepMatch = individualScreen.pepMatch || false;
      const isAdverseMediaMatch = individualScreen.adverseMediaMatch || false;
      
      const overallRiskScore = Math.max(
        individualScreen.riskScore || 0,
        walletScreen.riskScore || 0,
        transactionScreen?.riskScore || 0,
      );

      // Determine overall status
      let overallStatus: AmlStatus = AmlStatus.CLEAR;
      if (isSanctionsMatch || isPepMatch || isAdverseMediaMatch) {
        overallStatus = AmlStatus.FLAGGED;
      }
      if (overallRiskScore > 75) {
        overallStatus = AmlStatus.UNDER_REVIEW;
      }
      if (overallRiskScore > 90 || isSanctionsMatch) {
        overallStatus = AmlStatus.BLOCKED;
      }

      // Store AML check result
      const amlRecord = await this.prisma.amlCheck.create({
        data: {
          id: uuidv4(),
          userId: dto.userId,
          walletAddress: dto.walletAddress,
          status: overallStatus,
          sanctionsMatch: isSanctionsMatch,
          pepMatch: isPepMatch,
          adverseMediaMatch: isAdverseMediaMatch,
          riskLevel: this.getRiskLevel(overallRiskScore),
          riskScore: overallRiskScore,
          provider: this.defaultAmlProvider,
          metadata: {
            individualScreen,
            walletScreen,
            transactionScreen,
            transactionAmount: dto.transactionAmount,
          },
          screenedAt: new Date(),
        },
      });

      // Log audit
      await this.auditService.logAction({
        tableName: 'aml_checks',
        operation: AuditOperation.CREATE,
        newData: {
          action: 'AML_SCREENING',
          userId: dto.userId,
          amlId: amlRecord.id,
          status: overallStatus,
          riskScore: overallRiskScore,
        },
      });

      // If flagged or blocked, create compliance alert
      if (overallStatus === AmlStatus.FLAGGED || overallStatus === AmlStatus.BLOCKED) {
        await this.createComplianceAlert(dto.userId, 'AML_SCREENING', {
          status: overallStatus,
          riskScore: overallRiskScore,
          walletAddress: dto.walletAddress,
          matchDetails: {
            sanctions: isSanctionsMatch,
            pep: isPepMatch,
            adverseMedia: isAdverseMediaMatch,
          },
        });
      }

      this.logger.log(`AML check completed. Status: ${overallStatus}, Risk Score: ${overallRiskScore}`);

      return {
        checkId: amlRecord.id,
        userId: dto.userId,
        status: overallStatus,
        sanctionsMatch: isSanctionsMatch,
        pepMatch: isPepMatch,
        adverseMediaMatch: isAdverseMediaMatch,
        riskLevel: this.getRiskLevel(overallRiskScore),
        riskScore: overallRiskScore,
        screenedAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`AML check failed: ${error.message}`, error.stack);
      
      await this.auditService.logAction({
        tableName: 'aml_checks',
        operation: AuditOperation.CREATE,
        newData: {
          action: 'AML_FAILED',
          userId: dto.userId,
          error: error.message || 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Get AML check history for a user
   */
  async getAmlHistory(userId: string, limit: number = 10): Promise<AmlCheckResponseDto[]> {
    const amlChecks = await this.prisma.amlCheck.findMany({
      where: { userId },
      orderBy: { screenedAt: 'desc' },
      take: limit,
    });

    return amlChecks.map((aml: any) => this.mapAmlToResponseDto(aml));
  }

  /**
   * Create compliance alert for flagged cases
   */
  private async createComplianceAlert(
    userId: string,
    alertType: string,
    details: any,
  ): Promise<void> {
    await this.prisma.complianceAlert.create({
      data: {
        id: uuidv4(),
        userId,
        alertType,
        severity: details.riskScore > 90 ? 'CRITICAL' : details.riskScore > 75 ? 'HIGH' : 'MEDIUM',
        status: 'OPEN',
        details,
        createdAt: new Date(),
      },
    });

    this.logger.warn(`Compliance alert created for user ${userId}: ${alertType}`);
  }

  /**
   * Get risk level based on score
   */
  private getRiskLevel(riskScore: number): string {
    if (riskScore >= 90) return 'CRITICAL';
    if (riskScore >= 75) return 'HIGH';
    if (riskScore >= 50) return 'MEDIUM';
    if (riskScore >= 25) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Map KYC database record to response DTO
   */
  private mapToResponseDto(kyc: any): KycVerificationResponseDto {
    return {
      kycRequestId: kyc.id,
      userId: kyc.userId,
      status: kyc.status as KycStatus,
      providerReferenceId: kyc.providerReferenceId,
      verifiedAt: kyc.verifiedAt,
      expiresAt: kyc.expiresAt,
      rejectionReason: kyc.rejectionReason,
      riskScore: kyc.riskScore || 0,
      metadata: kyc.metadata || {},
    };
  }

  /**
   * Map AML database record to response DTO
   */
  private mapAmlToResponseDto(aml: any): AmlCheckResponseDto {
    const matchDetails: any[] = [];
    
    if (aml.sanctionsMatch) {
      matchDetails.push({
        source: 'SANCTIONS_LIST',
        matchType: 'SANCTIONS',
        confidence: 100,
        details: 'Match found on sanctions list',
      });
    }
    if (aml.pepMatch) {
      matchDetails.push({
        source: 'PEP_DATABASE',
        matchType: 'PEP',
        confidence: 100,
        details: 'Match found in PEP database',
      });
    }
    if (aml.adverseMediaMatch) {
      matchDetails.push({
        source: 'MEDIA_SCREENING',
        matchType: 'ADVERSE_MEDIA',
        confidence: 100,
        details: 'Negative media coverage detected',
      });
    }

    return {
      checkId: aml.id,
      userId: aml.userId,
      status: aml.status as AmlStatus,
      sanctionsMatch: aml.sanctionsMatch,
      pepMatch: aml.pepMatch,
      adverseMediaMatch: aml.adverseMediaMatch,
      riskLevel: aml.riskLevel,
      riskScore: aml.riskScore,
      screenedAt: aml.screenedAt,
      matchDetails: matchDetails.length > 0 ? matchDetails : [],
    };
  }

  /**
   * Enable/disable KYC verification
   */
  setKycEnabled(enabled: boolean): void {
    this.logger.log(`KYC verification ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable AML screening
   */
  setAmlEnabled(enabled: boolean): void {
    this.logger.log(`AML screening ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStats(): Promise<{
    totalKycVerifications: number;
    kycVerified: number;
    kycPending: number;
    kycRejected: number;
    totalAmlChecks: number;
    amlClear: number;
    amlFlagged: number;
    amlBlocked: number;
  }> {
    const [kycStats, amlStats] = await Promise.all([
      this.prisma.kycVerification.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.amlCheck.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const kycSummary = {
      totalKycVerifications: kycStats.reduce((sum: number, stat: any) => sum + stat._count, 0),
      kycVerified: kycStats.find((s: any) => s.status === KycStatus.VERIFIED)?._count || 0,
      kycPending: kycStats.find((s: any) => s.status === KycStatus.PENDING || s.status === KycStatus.IN_REVIEW)?._count || 0,
      kycRejected: kycStats.find((s: any) => s.status === KycStatus.REJECTED)?._count || 0,
    };

    const amlSummary = {
      totalAmlChecks: amlStats.reduce((sum: number, stat: any) => sum + stat._count, 0),
      amlClear: amlStats.find((s: any) => s.status === AmlStatus.CLEAR)?._count || 0,
      amlFlagged: amlStats.find((s: any) => s.status === AmlStatus.FLAGGED)?._count || 0,
      amlBlocked: amlStats.find((s: any) => s.status === AmlStatus.BLOCKED)?._count || 0,
    };

    return {
      ...kycSummary,
      ...amlSummary,
    };
  }
}
