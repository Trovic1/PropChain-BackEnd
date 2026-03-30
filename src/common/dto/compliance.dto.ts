import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsObject, ValidateNested, IsArray, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * KYC Verification Status Enum
 */
export enum KycStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/**
 * AML Check Status Enum
 */
export enum AmlStatus {
  CLEAR = 'CLEAR',
  FLAGGED = 'FLAGGED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BLOCKED = 'BLOCKED',
}

/**
 * Identity Document Type Enum
 */
export enum DocumentType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  NATIONAL_ID = 'NATIONAL_ID',
  RESIDENCE_PERMIT = 'RESIDENCE_PERMIT',
}

/**
 * Data Residency Region Enum
 */
export enum DataRegion {
  EU = 'EU',
  US = 'US',
  APAC = 'APAC',
  LATAM = 'LATAM',
  MIDDLE_EAST = 'MIDDLE_EAST',
}

/**
 * Consent Type Enum
 */
export enum ConsentType {
  DATA_PROCESSING = 'DATA_PROCESSING',
  MARKETING = 'MARKETING',
  THIRD_PARTY_SHARING = 'THIRD_PARTY_SHARING',
  ANALYTICS = 'ANALYTICS',
  ESSENTIAL = 'ESSENTIAL',
}

/**
 * GDPR Request Type Enum
 */
export enum GdprRequestType {
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETION = 'DATA_DELETION',
  DATA_CORRECTION = 'DATA_CORRECTION',
  CONSENT_WITHDRAWAL = 'CONSENT_WITHDRAWAL',
}

/**
 * GDPR Request Status Enum
 */
export enum GdprRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * DTO for KYC verification initiation
 */
export class InitiateKycDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Document type', enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'Document number' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ description: 'Full name as on document' })
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Date of birth' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Country of residence' })
  @IsString()
  countryOfResidence: string;

  @ApiPropertyOptional({ description: 'Document front image URL' })
  @IsOptional()
  @IsString()
  documentFrontUrl?: string;

  @ApiPropertyOptional({ description: 'Document back image URL' })
  @IsOptional()
  @IsString()
  documentBackUrl?: string;

  @ApiPropertyOptional({ description: 'Selfie image URL for liveness check' })
  @IsOptional()
  @IsString()
  selfieUrl?: string;
}

/**
 * DTO for KYC verification response
 */
export class KycVerificationResponseDto {
  @ApiProperty({ description: 'KYC request ID' })
  kycRequestId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'KYC status', enum: KycStatus })
  status: KycStatus;

  @ApiProperty({ description: 'Verification provider reference ID' })
  providerReferenceId: string;

  @ApiProperty({ description: 'Verification timestamp' })
  verifiedAt: Date;

  @ApiPropertyOptional({ description: 'Expiry date of KYC verification' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  rejectionReason?: string;

  @ApiProperty({ description: 'Risk score (0-100)' })
  riskScore: number;

  @ApiProperty({ description: 'Additional verification data' })
  metadata: Record<string, any>;
}

/**
 * DTO for AML check initiation
 */
export class PerformAmlCheckDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Wallet address to check' })
  @IsString()
  walletAddress: string;

  @ApiPropertyOptional({ description: 'Transaction amount for screening' })
  @IsOptional()
  transactionAmount?: number;

  @ApiPropertyOptional({ description: 'Transaction currency' })
  @IsOptional()
  @IsString()
  currency?: string;
}

/**
 * DTO for AML check response
 */
export class AmlCheckResponseDto {
  @ApiProperty({ description: 'AML check ID' })
  checkId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'AML status', enum: AmlStatus })
  status: AmlStatus;

  @ApiProperty({ description: 'Sanctions list match result' })
  sanctionsMatch: boolean;

  @ApiProperty({ description: 'PEP (Politically Exposed Person) match result' })
  pepMatch: boolean;

  @ApiProperty({ description: 'Adverse media match result' })
  adverseMediaMatch: boolean;

  @ApiProperty({ description: 'Risk level (LOW, MEDIUM, HIGH, CRITICAL)' })
  riskLevel: string;

  @ApiProperty({ description: 'Risk score (0-100)' })
  riskScore: number;

  @ApiProperty({ description: 'Screening timestamp' })
  screenedAt: Date;

  @ApiPropertyOptional({ description: 'Match details if any matches found' })
  matchDetails?: Array<{
    source: string;
    matchType: string;
    confidence: number;
    details: string;
  }>;
}

/**
 * DTO for consent update
 */
export class UpdateConsentDto {
  @ApiProperty({ description: 'Consent types to update', enum: ConsentType, isArray: true })
  @IsArray()
  @IsEnum(ConsentType, { each: true })
  consentTypes: ConsentType[];

  @ApiProperty({ description: 'Whether consent is granted or withdrawn' })
  @IsBoolean()
  granted: boolean;

  @ApiPropertyOptional({ description: 'Additional context or notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for consent response
 */
export class ConsentResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Consent records' })
  consents: Array<{
    type: ConsentType;
    granted: boolean;
    grantedAt: Date;
    withdrawnAt?: Date;
    version: string;
  }>;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

/**
 * DTO for GDPR request initiation
 */
export class InitiateGdprRequestDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'GDPR request type', enum: GdprRequestType })
  @IsEnum(GdprRequestType)
  requestType: GdprRequestType;

  @ApiPropertyOptional({ description: 'Additional details or justification' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: 'Specific fields to export or correct' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

/**
 * DTO for GDPR request response
 */
export class GdprRequestResponseDto {
  @ApiProperty({ description: 'GDPR request ID' })
  requestId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Request type', enum: GdprRequestType })
  requestType: GdprRequestType;

  @ApiProperty({ description: 'Request status', enum: GdprRequestStatus })
  status: GdprRequestStatus;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Expected completion date (within 30 days)' })
  expectedCompletionDate?: Date;

  @ApiPropertyOptional({ description: 'Completed timestamp' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Result data (e.g., export URL)' })
  resultData?: any;

  @ApiPropertyOptional({ description: 'Failure reason if failed' })
  failureReason?: string;
}

/**
 * DTO for data residency configuration
 */
export class SetDataResidencyDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Preferred data region', enum: DataRegion })
  @IsEnum(DataRegion)
  preferredRegion: DataRegion;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsString()
  countryCode: string;

  @ApiPropertyOptional({ description: 'Allow cross-border transfers if required' })
  @IsOptional()
  @IsBoolean()
  allowCrossBorderTransfer?: boolean;
}

/**
 * DTO for data residency response
 */
export class DataResidencyResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Assigned data region', enum: DataRegion })
  assignedRegion: DataRegion;

  @ApiProperty({ description: 'Country code' })
  countryCode: string;

  @ApiProperty({ description: 'Data storage location' })
  storageLocation: string;

  @ApiProperty({ description: 'Cross-border transfer allowed' })
  crossBorderTransferAllowed: boolean;

  @ApiProperty({ description: 'Applicable regulations' })
  applicableRegulations: string[];

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

/**
 * DTO for compliance analytics response
 */
export class ComplianceAnalyticsDto {
  @ApiProperty({ description: 'Total KYC verifications' })
  totalKycVerifications: number;

  @ApiProperty({ description: 'KYC verification rate (percentage)' })
  kycVerificationRate: number;

  @ApiProperty({ description: 'Total AML checks performed' })
  totalAmlChecks: number;

  @ApiProperty({ description: 'AML flagged cases' })
  amlFlaggedCases: number;

  @ApiProperty({ description: 'Pending GDPR requests' })
  pendingGdprRequests: number;

  @ApiProperty({ description: 'GDPR requests completed on time' })
  gdprOnTimeCompletion: number;

  @ApiProperty({ description: 'Overall compliance score (0-100)' })
  overallComplianceScore: number;

  @ApiProperty({ description: 'Data residency compliance rate' })
  dataResidencyComplianceRate: number;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt: Date;
}
