import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuditLogAction, AuditLogSource } from '../models/AuditLog';

@Injectable()
export class ForensicAnalyzer {
  private readonly logger = new Logger(ForensicAnalyzer.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run forensic analysis to detect security violations or suspicious actions
   */
  async detectSuspiciousActivity(userId: string) {
    // Get last login logs for the user
    // @ts-ignore
    const recentLoginFailures = await this.prisma.auditLog.findMany({
      where: {
        userId,
        action: AuditLogAction.SECURITY_VIOLATION, // Could also look for LOGIN and check metadata for failure
        timestamp: { gte: new Date(Date.now() - 3600000) }, // Past hour
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (recentLoginFailures.length > 5) {
      this.logger.warn(`Suspicious login activity detected for user: ${userId}`);
      return {
        level: 'high',
        threat: 'Likely brute force / credential stuffing attack',
        evidence: recentLoginFailures.length,
        actionRecommended: 'Lock account temporary and alert the user',
      };
    }

    return { level: 'low', threat: 'No immediate issues detected' };
  }

  /**
   * Trace the lifecycle of a resource through audit logs (e.g. tracking a property's history)
   */
  async traceResourceHistory(resourceType: string, resourceId: string) {
    // @ts-ignore
    const history = await this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { timestamp: 'asc' },
    });

    return history;
  }

  /**
   * Detect data anomalies or potential breaches (e.g. unusual data exports)
   */
  async detectDataHeist(userId: string) {
    // Check for multiple export requests in a short time
    // @ts-ignore
    const exports = await this.prisma.auditLog.findMany({
      where: {
        userId,
        action: AuditLogAction.EXPORT,
        timestamp: { gte: new Date(Date.now() - 86400000) }, // Past 24 hours
      },
    });

    if (exports.length > 2) {
      this.logger.error(`Possible data breach: ${exports.length} data exports by user: ${userId}`);
      return true;
    }
    return false;
  }
}
