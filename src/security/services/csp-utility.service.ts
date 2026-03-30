import { Injectable, Logger } from '@nestjs/common';

/**
 * CSP Utilities and Helper Services
 */
@Injectable()
export class CspUtilityService {
  private readonly logger = new Logger(CspUtilityService.name);

  /**
   * Generate a nonce attribute string for HTML script tags
   * 
   * @param nonce - The nonce value
   * @returns HTML-safe nonce attribute string
   * 
   * @example
   * // Usage in templates:
   * const nonceAttr = cspUtility.getNonceAttribute(req.cspNonce);
   * // Returns: `nonce="abc123..."`
   */
  getNonceAttribute(nonce?: string): string {
    if (!nonce) {
      return '';
    }
    return `nonce="${nonce}"`;
  }

  /**
   * Check if a URL is allowed by current CSP policy
   * 
   * @param url - URL to check
   * @param directive - CSP directive (e.g., 'script-src', 'img-src')
   * @returns True if URL is allowed
   */
  isUrlAllowed(url: string, directive: string): boolean {
    // In production, this would parse the actual CSP policy
    // For now, implement basic checks
    
    const parsedUrl = this.parseUrl(url);
    
    // Self URLs are always allowed
    if (parsedUrl.isSelf) {
      return true;
    }
    
    // Check against known CDN patterns
    const allowedDomains = this.getAllowedDomainsForDirective(directive);
    
    return allowedDomains.some(domain => {
      if (domain.includes('*')) {
        // Wildcard matching
        const pattern = domain.replace('*', '.*');
        return new RegExp(pattern).test(parsedUrl.domain);
      }
      return parsedUrl.domain === domain;
    });
  }

  /**
   * Get allowed domains for a specific CSP directive
   */
  private getAllowedDomainsForDirective(directive: string): string[] {
    const domainMap: Record<string, string[]> = {
      'script-src': [
        '*.cdn.jsdelivr.net',
        '*.unpkg.com',
        '*.google-analytics.com',
      ],
      'style-src': [
        '*.fonts.googleapis.com',
      ],
      'font-src': [
        '*.fonts.gstatic.com',
        '*.cdn.jsdelivr.net',
      ],
      'img-src': [
        '*.images.unsplash.com',
        '*.cdn.example.com',
        'data:',
        'blob:',
      ],
      'connect-src': [
        '*.api.example.com',
        '*.google-analytics.com',
        '*.stripe.com',
      ],
    };
    
    return domainMap[directive] || [];
  }

  /**
   * Parse URL into components
   */
  private parseUrl(url: string): {
    protocol: string;
    domain: string;
    path: string;
    isSelf: boolean;
  } {
    try {
      if (url.startsWith('/') || url === "'self'") {
        return {
          protocol: '',
          domain: "'self'",
          path: url,
          isSelf: true,
        };
      }
      
      const parsed = new URL(url);
      return {
        protocol: parsed.protocol,
        domain: parsed.hostname,
        path: parsed.pathname,
        isSelf: false,
      };
    } catch {
      // Invalid URL, treat as self
      return {
        protocol: '',
        domain: url,
        path: '',
        isSelf: true,
      };
    }
  }

  /**
   * Validate third-party integration configuration
   * 
   * @param domain - Domain to validate
   * @param purpose - Purpose of the domain (script, style, etc.)
   * @returns Validation result with reason
   */
  validateThirdPartyDomain(
    domain: string,
    purpose: 'script' | 'style' | 'image' | 'font' | 'connect' | 'frame',
  ): { valid: boolean; reason: string } {
    // Check for common security issues
    
    // Must use HTTPS (except localhost)
    if (!domain.startsWith('https://') && !domain.includes('localhost')) {
      return {
        valid: false,
        reason: 'Third-party domains must use HTTPS',
      };
    }
    
    // No wildcards in dangerous positions
    if (domain.startsWith('*') && !domain.startsWith('*.') ) {
      return {
        valid: false,
        reason: 'Invalid wildcard usage',
      };
    }
    
    // Check against blocklist
    const blocklist = [
      /malicious\.com/i,
      /unsafe-cdn\.net/i,
    ];
    
    if (blocklist.some(pattern => pattern.test(domain))) {
      return {
        valid: false,
        reason: 'Domain is on security blocklist',
      };
    }
    
    return { valid: true, reason: 'Domain validated successfully' };
  }

  /**
   * Create CSP-compliant inline script tag
   * 
   * @param content - Script content
   * @param nonce - CSP nonce
   * @returns Complete script tag
   */
  createInlineScript(content: string, nonce?: string): string {
    const nonceAttr = this.getNonceAttribute(nonce);
    const noncePart = nonceAttr ? ` ${nonceAttr}` : '';
    
    return `<script${noncePart}>${content}</script>`;
  }

  /**
   * Create CSP-compliant inline style tag
   * 
   * @param content - CSS content
   * @param nonce - CSP nonce
   * @returns Complete style tag
   */
  createInlineStyle(content: string, nonce?: string): string {
    const nonceAttr = this.getNonceAttribute(nonce);
    const noncePart = nonceAttr ? ` ${nonceAttr}` : '';
    
    return `<style${noncePart}>${content}</style>`;
  }

  /**
   * Log CSP configuration for debugging
   */
  logCspConfiguration(policy: any): void {
    this.logger.debug(`CSP Configuration:
      Environment: ${policy.environment}
      Report Only: ${policy.reportOnly}
      Enable Nonce: ${policy.enableNonce}
      Directives: ${policy.directives.length}
      Report URI: ${policy.reportUri || 'none'}
    `);
  }

  /**
   * Convert CSP policy to meta tag format (for HTML <meta> tags)
   * Note: Meta tags have limited CSP support, but useful for some directives
   */
  policyToMetaTag(policy: any, nonce?: string): string {
    const content = policy.directives
      .map((d: any) => {
        let sources = [...d.sources];
        
        // Add nonce if applicable
        if (
          policy.enableNonce &&
          nonce &&
          d.directive === 'script-src'
        ) {
          sources.push(`'nonce-${nonce}'`);
        }
        
        return `${d.directive} ${sources.join(' ')}`;
      })
      .join('; ');
    
    return `<meta http-equiv="Content-Security-Policy" content="${this.escapeHtml(content)}">`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Test CSP policy without enforcing (report-only mode)
   * Useful for testing new policies before enforcement
   */
  enableReportOnlyMode(): void {
    process.env.CSP_REPORT_ONLY = 'true';
    this.logger.log('CSP switched to report-only mode');
  }

  /**
   * Enable enforcement mode
   */
  enableEnforcementMode(): void {
    process.env.CSP_REPORT_ONLY = 'false';
    this.logger.log('CSP switched to enforcement mode');
  }
}
