import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

/**
 * CSP Violation Report DTO
 * Based on W3C CSP violation report format
 */
export class CspViolationReportDto {
  /** CSP violation details */
  'csp-report': {
    /** The document URI where the violation occurred */
    'document-uri': string;
    
    /** The referrer URI */
    referrer: string;
    
    /** The blocked URI/resource */
    'blocked-uri': string;
    
    /** The violated CSP directive */
    'violated-directive': string;
    
    /** The effective directive (CSP Level 3) */
    'effective-directive'?: string;
    
    /** The original policy */
    'original-policy': string;
    
    /** Whether the violation was due to enforce or report-only */
    disposition: 'enforce' | 'report';
    
    /** Additional source information */
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'script-sample'?: string;
    'status-code'?: number;
  };
}

/**
 * Processed violation for storage/analysis
 */
export interface ProcessedViolation {
  /** Unique violation ID */
  id: string;
  
  /** Timestamp of violation */
  timestamp: Date;
  
  /** Client IP address */
  clientIp: string;
  
  /** User agent */
  userAgent: string;
  
  /** CSP report data */
  report: CspViolationReportDto['csp-report'];
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether this appears to be an attack */
  isPotentialAttack: boolean;
}

/**
 * CSP Violation Reporting Controller
 * 
 * Receives and processes CSP violation reports from browsers
 */
@ApiTags('Security')
@Controller('/api/v1/security')
export class CspViolationController {
  private readonly logger = new Logger(CspViolationController.name);
  
  /**
   * Handle CSP violation reports from browsers
   * 
   * Browsers automatically send POST requests when they detect CSP violations
   */
  @Post('/csp-report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Receive CSP violation reports',
    description: 'Endpoint for browsers to report Content Security Policy violations'
  })
  @ApiBody({
    description: 'CSP violation report from browser',
    type: CspViolationReportDto,
  })
  @ApiResponse({
    status: 204,
    description: 'CSP violation report received successfully',
  })
  async handleCspViolation(
    @Body() report: CspViolationReportDto,
    @Headers('user-agent') userAgent: string,
    @Headers('x-forwarded-for') forwardedFor: string,
  ): Promise<void> {
    try {
      // Extract client IP
      const clientIp = this.extractClientIp(forwardedFor);
      
      // Process the violation
      const processedViolation = await this.processViolation(report, userAgent, clientIp);
      
      // Log the violation
      this.logViolation(processedViolation);
      
      // Check if this appears to be an attack
      if (processedViolation.isPotentialAttack) {
        this.logger.warn(
          `Potential CSP attack detected from ${clientIp}: ${processedViolation.report['violated-directive']}`
        );
        
        // Log security event for monitoring
        await this.logSecurityEvent(processedViolation);
      }
      
      // In production, you would:
      // - Store in database for analysis
      // - Send to SIEM/monitoring system
      // - Alert on suspicious patterns
      
    } catch (error) {
      this.logger.error('Error processing CSP violation:', error);
      // Don't throw - fail silently to avoid browser retry loops
    }
  }

  /**
   * Extract client IP from headers
   */
  private extractClientIp(forwardedFor?: string): string {
    if (!forwardedFor) {
      return 'unknown';
    }
    
    // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
    return forwardedFor.split(',')[0].trim();
  }

  /**
   * Process violation and determine severity
   */
  private async processViolation(
    report: CspViolationReportDto,
    userAgent: string,
    clientIp: string,
  ): Promise<ProcessedViolation> {
    const cspReport = report['csp-report'];
    
    // Determine severity based on violated directive
    const severity = this.determineSeverity(cspReport['violated-directive']);
    
    // Detect potential attacks
    const isPotentialAttack = this.detectAttackPattern(cspReport, clientIp);
    
    return {
      id: this.generateViolationId(),
      timestamp: new Date(),
      clientIp,
      userAgent: userAgent || 'unknown',
      report: cspReport,
      severity,
      isPotentialAttack,
    };
  }

  /**
   * Determine severity level based on directive
   */
  private determineSeverity(violatedDirective: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Script injection attempts
    if (violatedDirective.includes('script-src')) {
      return 'critical';
    }
    
    // High: Style injection or frame embedding
    if (violatedDirective.includes('style-src') || violatedDirective.includes('frame-')) {
      return 'high';
    }
    
    // Medium: Connection to unauthorized endpoints
    if (violatedDirective.includes('connect-src')) {
      return 'medium';
    }
    
    // Low: Other violations
    return 'low';
  }

  /**
   * Detect attack patterns in violation reports
   */
  private detectAttackPattern(
    report: CspViolationReportDto['csp-report'],
    clientIp: string,
  ): boolean {
    const blockedUri = report['blocked-uri'].toLowerCase();
    const violatedDirective = report['violated-directive'].toLowerCase();
    
    // Suspicious patterns indicating potential XSS
    const attackPatterns = [
      /data:/i, // Data URI injection
      /javascript:/i, // JavaScript protocol
      /blob:/i, // Blob injection
      /eval/i, // Eval attempts
      /inline/i, // Inline script injection
    ];
    
    // Check if blocked URI matches attack patterns
    const hasAttackPattern = attackPatterns.some(pattern => 
      pattern.test(blockedUri) || pattern.test(violatedDirective)
    );
    
    // Multiple violations from same IP (would check rate limiting in real implementation)
    const isRepeatedOffender = false; // Implement rate limiting check
    
    return hasAttackPattern || isRepeatedOffender;
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(): string {
    return `csp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log violation for monitoring
   */
  private logViolation(violation: ProcessedViolation): void {
    const { severity, report, clientIp } = violation;
    
    this.logger.log(
      `[CSP Violation] Severity: ${severity} | ` +
      `Directive: ${report['violated-directive']} | ` +
      `Blocked: ${report['blocked-uri']} | ` +
      `IP: ${clientIp}`
    );
  }

  /**
   * Log security event for serious violations
   */
  private async logSecurityEvent(violation: ProcessedViolation): Promise<void> {
    // In production, integrate with security monitoring service
    // Example: Send to SIEM, log aggregation, or alerting system
    
    this.logger.warn(
      `[SECURITY EVENT] Potential CSP attack from ${violation.clientIp} - ` +
      `Blocked URI: ${violation.report['blocked-uri']} - ` +
      `Directive: ${violation.report['violated-directive']}`
    );
  }
}
