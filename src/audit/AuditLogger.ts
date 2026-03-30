import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuditLogAction, AuditLogSource, CreateAuditLogInput } from '../models/AuditLog';
import { createHash } from 'crypto';

@Injectable()
export class AuditLogger {
  private readonly logger = new Logger(AuditLogger.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an action with GDPR compliance and data retention logic
   */
  async log(input: CreateAuditLogInput) {
    const { userId, action, source, resourceType, resourceId, ipAddress, userAgent, metadata } = input;

    // Sanitize metadata for GDPR (hash sensitive PII)
    const sanitizedMetadata = this.sanitizeMetadata(metadata || {});
    const retentionDays = this.getRetentionDaysForAction(action);
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

    try {
      // Logic for adding audit log row to DB via Prisma
      // Assuming audit log name in prisma is 'auditLog'
      // @ts-ignore
      const log = await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          source,
          resourceType,
          resourceId,
          ipAddress,
          userAgent,
          metadata: sanitizedMetadata,
          isImmutable: true,
          retentionUntil,
          timestamp: new Date(),
        },
      });
      this.logger.debug(`Audit log created: ${log.id} - ${action} on ${resourceType}`);
      return log;
    } catch (error) {
      this.logger.error('Failed to save audit log', error);
      // In critical systems, failure to audit log should perhaps block the action or trigger an alert
    }
  }

  private sanitizeMetadata(metadata: Record<string, any>) {
    const sensitiveKeys = ['email', 'phone', 'ssn', 'taxId', 'address'];
    const sanitized = { ...metadata };

    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[`hashed_${key}`] = createHash('sha256').update(String(sanitized[key])).digest('hex');
        delete sanitized[key];
      }
    }
    return sanitized;
  }

  private getRetentionDaysForAction(action: AuditLogAction): number {
    switch (action) {
      case AuditLogAction.DELETE:
        return 2250; // ~7 years for deletion audit
      case AuditLogAction.SECURITY_VIOLATION:
        return 3650; // 10 years for security incidents
      default:
        return 365; // 1 year by default
    }
  }
}
