/**
 * Compliance Module
 * 
 * Central module that wires together all compliance-related services:
 * - KYC/AML verification
 * - GDPR compliance automation  
 * - Data residency controls
 * - Consent management
 * - Compliance reporting
 * 
 * @module ComplianceModule
 * @author PropChain Team
 * @since 2026-03-29
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ComplianceController } from '../controllers/compliance.controller';
import { KycAmlService } from '../services/kyc-aml.service';
import { GdprService } from '../services/gdpr.service';
import { DataResidencyService } from '../services/data-residency.service';
import { ComplianceReportingService } from '../services/compliance-reporting.service';
import { AuditService } from '../services/audit.service';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
  ],
  controllers: [ComplianceController],
  providers: [
    KycAmlService,
    GdprService,
    DataResidencyService,
    ComplianceReportingService,
    AuditService,
  ],
  exports: [
    KycAmlService,
    GdprService,
    DataResidencyService,
    ComplianceReportingService,
    AuditService,
  ],
})
export class ComplianceModule {}
