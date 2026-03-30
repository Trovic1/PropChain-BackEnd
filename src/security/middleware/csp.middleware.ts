import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getCspPolicy, buildCspHeaderValue } from '../config/csp.config';

/**
 * Extended Request interface to include CSP properties
 */
export interface CspRequest extends Request {
  /** CSP nonce for this request */
  cspNonce?: string;
}

/**
 * Content Security Policy (CSP) Middleware
 * 
 * Sets CSP headers on all responses with:
 * - Environment-specific policies (dev/staging/prod)
 * - Nonce-based inline script support
 * - Report-only mode support
 * - Violation reporting endpoint integration
 */
@Injectable()
export class CspMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CspMiddleware.name);
  private readonly policy = getCspPolicy();

  use(req: CspRequest, res: Response, next: NextFunction): void {
    try {
      // Generate nonce for this request if enabled
      const nonce = this.policy.enableNonce ? this.generateNonce() : undefined;
      
      // Attach nonce to request for use in controllers/templates
      if (nonce) {
        req.cspNonce = nonce;
      }

      // Build CSP header value
      const cspHeaderValue = buildCspHeaderValue(this.policy, nonce);

      // Determine header name based on report-only setting
      const headerName = this.policy.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      // Set CSP header
      res.setHeader(headerName, cspHeaderValue);

      // Add nonce to response headers for client-side use
      if (nonce) {
        res.setHeader('X-CSP-Nonce', nonce);
      }

      // Log CSP mode in development
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(
          `CSP ${this.policy.reportOnly ? 'Report-Only' : 'Enforced'} - ` +
          `Environment: ${this.policy.environment}`
        );
      }

      next();
    } catch (error) {
      this.logger.error('CSP middleware error:', error);
      // Fail open - don't block requests if CSP fails
      next();
    }
  }

  /**
   * Generate a cryptographically secure nonce
   * Uses UUID v4 as a base and adds additional randomness
   */
  private generateNonce(): string {
    // Generate a secure random nonce
    const uuid = uuidv4().replace(/-/g, '');
    const randomBytes = Buffer.from(
      Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    ).toString('base64');
    
    // Combine UUID with random bytes for extra security
    return `${uuid}${randomBytes.substring(0, 8)}`;
  }

  /**
   * Get the current CSP policy (for testing/debugging)
   */
  getPolicy() {
    return this.policy;
  }
}
