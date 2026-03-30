/**
 * Content Security Policy (CSP) Configuration
 * 
 * Defines trusted sources for different content types and policies
 * for development vs production environments.
 */

export interface CspDirective {
  /** Directive name (e.g., 'default-src', 'script-src') */
  directive: string;
  /** Allowed sources */
  sources: string[];
}

export interface CspPolicy {
  /** Environment name */
  environment: 'development' | 'staging' | 'production';
  /** Whether to use report-only mode */
  reportOnly: boolean;
  /** CSP directives */
  directives: CspDirective[];
  /** Report URI for violations */
  reportUri?: string;
  /** Enable nonce-based inline scripts */
  enableNonce: boolean;
}

/**
 * Trusted source definitions
 */
export const TRUSTED_SOURCES = {
  // Scripts
  SCRIPT_SELF: "'self'",
  SCRIPT_UNSAFE_INLINE: "'unsafe-inline'",
  SCRIPT_UNSAFE_EVAL: "'unsafe-eval'",
  SCRIPT_STRICT_DYNAMIC: "'strict-dynamic'",
  
  // Styles
  STYLE_SELF: "'self'",
  STYLE_UNSAFE_INLINE: "'unsafe-inline'",
  STYLE_INLINE: "'inline-speculation-rules'",
  
  // Images
  IMG_SELF: "'self'",
  IMG_DATA: 'data:',
  IMG_BLOB: 'blob:',
  
  // Fonts
  FONT_SELF: "'self'",
  
  // Connections
  CONNECT_SELF: "'self'",
  
  // Frames
  FRAME_NONE: "'none'",
  FRAME_SELF: "'self'",
  
  // General
  NONE: "'none'",
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  UNSAFE_EVAL: "'unsafe-eval'",
  STRICT_DYNAMIC: "'strict-dynamic'",
};

/**
 * CDN and third-party domain configurations
 * These should be configured via environment variables
 */
export const DEFAULT_CDN_CONFIG = {
  // Script CDNs
  scriptCdns: [
    process.env.CDN_SCRIPT_1 || 'https://cdn.jsdelivr.net',
    process.env.CDN_SCRIPT_2 || 'https://unpkg.com',
  ].filter(Boolean),
  
  // Style CDNs
  styleCdns: [
    process.env.CDN_STYLE_1 || 'https://fonts.googleapis.com',
  ].filter(Boolean),
  
  // Image CDNs
  imageCdns: [
    process.env.CDN_IMAGE_1 || 'https://images.unsplash.com',
    process.env.CDN_IMAGE_2 || 'https://cdn.example.com',
  ].filter(Boolean),
  
  // Font CDNs
  fontCdns: [
    process.env.CDN_FONT_1 || 'https://fonts.gstatic.com',
    process.env.CDN_FONT_2 || 'https://cdn.jsdelivr.net',
  ].filter(Boolean),
  
  // API endpoints for connect-src
  apiEndpoints: [
    process.env.API_ENDPOINT_1 || process.env.BACKEND_URL || 'http://localhost:3000',
    process.env.API_ENDPOINT_2 || '',
  ].filter(Boolean),
  
  // Third-party integrations
  analyticsDomains: [
    process.env.ANALYTICS_DOMAIN || 'https://www.google-analytics.com',
  ].filter(Boolean),
  
  paymentGateways: [
    process.env.STRIPE_DOMAIN || 'https://js.stripe.com',
    process.env.PAYPAL_DOMAIN || 'https://www.paypal.com',
  ].filter(Boolean),
  
  // Frame ancestors (if needed for specific integrations)
  frameAncestors: [
    process.env.FRAME_ANCESTOR_1 || '',
  ].filter(Boolean),
};

/**
 * Development CSP Policy
 * More permissive for debugging and development
 */
export const DEVELOPMENT_CSP_POLICY: CspPolicy = {
  environment: 'development',
  reportOnly: true, // Use report-only mode in development
  enableNonce: false, // Disable nonces in dev for easier debugging
  
  directives: [
    {
      directive: 'default-src',
      sources: ["'self'"],
    },
    {
      directive: 'script-src',
      sources: [
        "'self'",
        "'unsafe-inline'", // Allow inline scripts in development
        "'unsafe-eval'",   // Allow eval in development
        ...DEFAULT_CDN_CONFIG.scriptCdns,
        ...DEFAULT_CDN_CONFIG.analyticsDomains,
      ],
    },
    {
      directive: 'style-src',
      sources: [
        "'self'",
        "'unsafe-inline'", // Allow inline styles in development
        ...DEFAULT_CDN_CONFIG.styleCdns,
      ],
    },
    {
      directive: 'img-src',
      sources: [
        "'self'",
        'data:',
        'blob:',
        ...DEFAULT_CDN_CONFIG.imageCdns,
      ],
    },
    {
      directive: 'font-src',
      sources: [
        "'self'",
        ...DEFAULT_CDN_CONFIG.fontCdns,
      ],
    },
    {
      directive: 'connect-src',
      sources: [
        "'self'",
        ...DEFAULT_CDN_CONFIG.apiEndpoints,
        ...DEFAULT_CDN_CONFIG.analyticsDomains,
        'ws:', // Allow WebSocket in development
        'wss:',
      ],
    },
    {
      directive: 'frame-src',
      sources: ["'none'"],
    },
    {
      directive: 'frame-ancestors',
      sources: ["'none'"], // Prevent clickjacking
    },
    {
      directive: 'base-uri',
      sources: ["'self'"],
    },
    {
      directive: 'form-action',
      sources: ["'self'"],
    },
    {
      directive: 'upgrade-insecure-requests',
      sources: [],
    },
  ],
  
  reportUri: '/api/v1/security/csp-report',
};

/**
 * Production CSP Policy
 * Strict security policies for production
 */
export const PRODUCTION_CSP_POLICY: CspPolicy = {
  environment: 'production',
  reportOnly: false, // Enforce policy in production
  enableNonce: true, // Enable nonce-based inline scripts
  
  directives: [
    {
      directive: 'default-src',
      sources: ["'self'"],
    },
    {
      directive: 'script-src',
      sources: [
        "'self'",
        "'strict-dynamic'", // Prefer strict-dynamic over unsafe-inline
        // Nonce will be added dynamically by middleware
        ...DEFAULT_CDN_CONFIG.scriptCdns,
        ...DEFAULT_CDN_CONFIG.analyticsDomains,
      ],
    },
    {
      directive: 'style-src',
      sources: [
        "'self'",
        // No unsafe-inline in production - use nonces or hashes
        ...DEFAULT_CDN_CONFIG.styleCdns,
      ],
    },
    {
      directive: 'img-src',
      sources: [
        "'self'",
        'data:', // Allow data URIs (necessary for some features)
        'blob:',
        ...DEFAULT_CDN_CONFIG.imageCdns,
      ],
    },
    {
      directive: 'font-src',
      sources: [
        "'self'",
        ...DEFAULT_CDN_CONFIG.fontCdns,
      ],
    },
    {
      directive: 'connect-src',
      sources: [
        "'self'",
        ...DEFAULT_CDN_CONFIG.apiEndpoints,
        ...DEFAULT_CDN_CONFIG.analyticsDomains,
        ...DEFAULT_CDN_CONFIG.paymentGateways,
      ],
    },
    {
      directive: 'frame-src',
      sources: [
        "'none'", // Default: no frames
        // Add specific trusted domains if needed
        // process.env.STRIPE_DOMAIN || '',
      ].filter(Boolean),
    },
    {
      directive: 'frame-ancestors',
      sources: ["'none'"], // Prevent clickjacking
    },
    {
      directive: 'base-uri',
      sources: ["'self'"], // Prevent base tag hijacking
    },
    {
      directive: 'form-action',
      sources: ["'self'"], // Restrict form submissions
    },
    {
      directive: 'object-src',
      sources: ["'none'"], // Block plugins
    },
    {
      directive: 'worker-src',
      sources: ["'self'"], // Restrict web workers
    },
    {
      directive: 'child-src',
      sources: ["'self'"], // Restrict nested browsing contexts
    },
    {
      directive: 'manifest-src',
      sources: ["'self'"],
    },
    {
      directive: 'media-src',
      sources: ["'self'"],
    },
    {
      directive: 'upgrade-insecure-requests',
      sources: [],
    },
  ],
  
  reportUri: '/api/v1/security/csp-report',
};

/**
 * Staging CSP Policy
 * Similar to production but with report-only mode for testing
 */
export const STAGING_CSP_POLICY: CspPolicy = {
  environment: 'staging',
  reportOnly: true, // Test in report-only mode
  enableNonce: true,
  
  directives: PRODUCTION_CSP_POLICY.directives,
  reportUri: '/api/v1/security/csp-report',
};

/**
 * Get CSP policy based on environment
 */
export function getCspPolicy(environment?: string): CspPolicy {
  const env = environment || process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return PRODUCTION_CSP_POLICY;
    case 'staging':
      return STAGING_CSP_POLICY;
    default:
      return DEVELOPMENT_CSP_POLICY;
  }
}

/**
 * Build CSP header value from policy and nonce
 */
export function buildCspHeaderValue(
  policy: CspPolicy,
  nonce?: string,
): string {
  const directiveStrings = policy.directives.map((directive) => {
    let sources = [...directive.sources];
    
    // Add nonce to script-src if enabled and provided
    if (
      policy.enableNonce &&
      nonce &&
      directive.directive === 'script-src'
    ) {
      sources.push(`'nonce-${nonce}'`);
    }
    
    // Add report-uri to the end
    if (policy.reportUri && directive.directive === 'report-uri') {
      return `report-uri ${policy.reportUri}`;
    }
    
    return `${directive.directive} ${sources.join(' ')}`;
  });
  
  // Add report-uri if not already added
  if (policy.reportUri && !directiveStrings.some(d => d.startsWith('report-uri'))) {
    directiveStrings.push(`report-uri ${policy.reportUri}`);
  }
  
  return directiveStrings.join('; ');
}
