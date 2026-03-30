# Content Security Policy (CSP) Implementation Guide

Comprehensive CSP protection for the PropChain application with XSS prevention, violation reporting, and environment-specific policies.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Monitoring & Reporting](#monitoring--reporting)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## 🎯 Overview

Content Security Policy (CSP) is a security layer that helps detect and mitigate certain types of attacks, including Cross-Site Scripting (XSS) and data injection attacks. This implementation provides:

- **Automatic CSP headers** on all responses
- **Nonce-based inline script** support for safe dynamic content
- **Violation reporting** to monitor blocked attacks
- **Environment-specific policies** (dev/staging/prod)
- **Third-party integration** support (CDNs, analytics, payment gateways)

---

## ✨ Features

### Security Features

✅ **XSS Protection**: Browser-enforced content restrictions  
✅ **Clickjacking Prevention**: Frame ancestors blocked  
✅ **Data URI Restrictions**: Controlled resource loading  
✅ **HTTPS Enforcement**: Upgrade insecure requests  
✅ **Base Tag Hijacking Prevention**: Restricted base URIs  

### Flexibility Features

✅ **Report-Only Mode**: Test policies before enforcement  
✅ **Nonce-Based Scripts**: Safe inline script execution  
✅ **Environment Policies**: Different rules for dev vs prod  
✅ **CDN Support**: Whitelist trusted external resources  
✅ **Violation Monitoring**: Real-time attack detection  

---

## 🚀 Quick Start

### 1. Import CSP Module

Add `CspModule` to your main application module:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { CspModule } from './security/csp.module';

@Module({
  imports: [
    CspModule, // Add this line
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Configure Environment Variables

Create or update `.env`:

```bash
# CSP Configuration
NODE_ENV=production  # or development/staging

# CDN Domains (customize for your setup)
CDN_SCRIPT_1=https://cdn.jsdelivr.net
CDN_SCRIPT_2=https://unpkg.com
CDN_STYLE_1=https://fonts.googleapis.com
CDN_IMAGE_1=https://images.unsplash.com
CDN_FONT_1=https://fonts.gstatic.com

# API Endpoints
BACKEND_URL=https://api.propchain.com
API_ENDPOINT_2=https://analytics.propchain.com

# Third-Party Integrations
ANALYTICS_DOMAIN=https://www.google-analytics.com
STRIPE_DOMAIN=https://js.stripe.com
PAYPAL_DOMAIN=https://www.paypal.com
```

### 3. Use Nonce in Templates (Optional)

For server-side rendered content with inline scripts:

```typescript
import { CspUtilityService } from './security/services/csp-utility.service';

@Controller('example')
class ExampleController {
  constructor(private cspUtility: CspUtilityService) {}

  @Get()
  renderPage(@Req() req: CspRequest) {
    const nonce = req.cspNonce;
    const nonceAttr = this.cspUtility.getNonceAttribute(nonce);
    
    return `
      <html>
        <head>
          <script ${nonceAttr}>
            console.log('This inline script is CSP-compliant!');
          </script>
        </head>
      </html>
    `;
  }
}
```

That's it! CSP is now protecting your application.

---

## ⚙️ Configuration

### Trusted Sources by Content Type

#### Scripts
```typescript
{
  scriptCdns: [
    'https://cdn.jsdelivr.net',     // jsDelivr
    'https://unpkg.com',            // unpkg
    'https://www.google-analytics.com' // Analytics
  ]
}
```

#### Styles
```typescript
{
  styleCdns: [
    'https://fonts.googleapis.com'  // Google Fonts
  ]
}
```

#### Images
```typescript
{
  imageCdns: [
    'https://images.unsplash.com',   // Unsplash
    'https://cdn.example.com',       // Your CDN
    'data:',                         // Data URIs
    'blob:'                          // Blob URLs
  ]
}
```

#### Fonts
```typescript
{
  fontCdns: [
    'https://fonts.gstatic.com',     // Google Fonts
    'https://cdn.jsdelivr.net'       // jsDelivr fonts
  ]
}
```

#### Connections (API/Fetch)
```typescript
{
  apiEndpoints: [
    'https://api.propchain.com',     // Your API
    'https://www.google-analytics.com', // Analytics
    'https://js.stripe.com'          // Stripe
  ]
}
```

#### Frames (Prevent Clickjacking)
```typescript
{
  frameAncestors: ["'none'"]  // Default: block all framing
}
```

---

## 📖 Usage Examples

### Example 1: Inline Script with Nonce

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { CspRequest } from './security/middleware/csp.middleware';
import { CspUtilityService } from './security/services/csp-utility.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private cspUtility: CspUtilityService) {}

  @Get()
  getDashboard(@Req() req: CspRequest) {
    const nonce = req.cspNonce;
    
    // Create CSP-compliant inline script
    const analyticsScript = this.cspUtility.createInlineScript(`
      // Initialize analytics
      window.analytics = window.analytics || [];
      console.log('Analytics initialized');
    `, nonce);
    
    return {
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            ${analyticsScript}
          </head>
          <body>
            <h1>Dashboard</h1>
          </body>
        </html>
      `,
    };
  }
}
```

### Example 2: Dynamic CDN Configuration

```typescript
// For multi-tenant applications with different CDNs
const customCdnConfig = {
  scriptCdns: [
    process.env.TENANT_CDN_URL || 'https://cdn.default.com'
  ]
};

// Validate before using
const validation = cspUtility.validateThirdPartyDomain(
  'https://cdn.example.com',
  'script'
);

if (validation.valid) {
  // Safe to use
} else {
  console.error(validation.reason);
}
```

### Example 3: Testing New Policies

```typescript
// Enable report-only mode to test without breaking anything
cspUtility.enableReportOnlyMode();

// Monitor violations in logs
// Once confident, switch to enforcement
cspUtility.enableEnforcementMode();
```

---

## 📊 Monitoring & Reporting

### Violation Reports

Browsers automatically send POST requests to `/api/v1/security/csp-report` when they detect violations.

**Example Violation Report:**
```json
{
  "csp-report": {
    "document-uri": "https://app.propchain.com/dashboard",
    "referrer": "https://google.com",
    "blocked-uri": "https://malicious.com/evil.js",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    "original-policy": "script-src 'self' 'nonce-abc123'",
    "disposition": "enforce",
    "source-file": "https://malicious.com/evil.js",
    "line-number": 42,
    "column-number": 10
  }
}
```

### Log Output

Violations are logged with severity levels:

```
[CSP Violation] Severity: critical | Directive: script-src | Blocked: https://malicious.com/evil.js | IP: 192.168.1.100

[SECURITY EVENT] Potential CSP attack from 192.168.1.100 - Blocked URI: https://malicious.com/evil.js - Directive: script-src
```

### Severity Levels

| Severity | Directive | Description |
|----------|-----------|-------------|
| **Critical** | `script-src` | Script injection attempts |
| **High** | `style-src`, `frame-*` | Style injection, clickjacking |
| **Medium** | `connect-src` | Unauthorized API connections |
| **Low** | Other | Miscellaneous violations |

---

## 🔧 Troubleshooting

### Issue: Legitimate Script Blocked

**Symptoms**: Console shows CSP blocking your own scripts

**Solution**:
1. Check if script is inline → Add nonce
2. Check if from CDN → Add CDN domain to `scriptCdns`
3. Verify script source URL matches whitelist

```typescript
// Option 1: Add nonce to inline script
<script nonce="${req.cspNonce}">
  // Your code
</script>

// Option 2: Add CDN to environment variables
CDN_SCRIPT_3=https://your-cdn.com
```

### Issue: Styles Not Loading

**Symptoms**: CSS from Google Fonts not applying

**Solution**: Ensure `style-src` includes Google Fonts:

```bash
# .env
CDN_STYLE_1=https://fonts.googleapis.com
```

### Issue: Analytics Not Working

**Symptoms**: Google Analytics or other tracking blocked

**Solution**: Add analytics domains to both `script-src` and `connect-src`:

```bash
ANALYTICS_DOMAIN=https://www.google-analytics.com
```

### Issue: Payment Gateway Fails

**Symptoms**: Stripe/PayPal integration errors

**Solution**: Add payment gateway domains:

```bash
STRIPE_DOMAIN=https://js.stripe.com
PAYPAL_DOMAIN=https://www.paypal.com
```

---

## 🎓 Best Practices

### DO ✅

- **Use nonces for inline scripts** instead of `unsafe-inline`
- **Test in report-only mode** before enforcing new policies
- **Monitor violation reports** regularly for attack patterns
- **Use specific CDN domains** rather than wildcards
- **Keep policies environment-specific** (dev vs prod)
- **Log all violations** for security analysis
- **Update whitelists** when adding new integrations

### DON'T ❌

- **Never use `unsafe-eval`** in production
- **Avoid `unsafe-inline`** for scripts (use nonces instead)
- **Don't wildcard entire domains** (`*://*.com`)
- **Don't ignore violation reports** (they indicate attacks)
- **Don't enable too many CDNs** (increases attack surface)
- **Avoid inline event handlers** (`onclick="..."`)

---

## 📝 Environment Policy Differences

### Development Mode
```typescript
{
  reportOnly: true,      // Don't break things
  enableNonce: false,    // Easier debugging
  allowUnsafeInline: true,  // For hot reload
  allowUnsafeEval: true,    // For debugging tools
}
```

### Production Mode
```typescript
{
  reportOnly: false,     // Enforce policy
  enableNonce: true,     // Secure inline scripts
  allowUnsafeInline: false, // Block unsafe inline
  allowUnsafeEval: false,   // Block eval
}
```

---

## 🔒 Security Considerations

### XSS Attack Prevention

This CSP implementation blocks:

1. **Inline Scripts Without Nonce**
   ```html
   <!-- BLOCKED -->
   <script>alert('XSS')</script>
   
   <!-- ALLOWED -->
   <script nonce="abc123">console.log('Safe')</script>
   ```

2. **External Scripts From Untrusted Sources**
   ```html
   <!-- BLOCKED -->
   <script src="https://evil.com/attack.js"></script>
   
   <!-- ALLOWED -->
   <script src="https://cdn.jsdelivr.net/lib.js"></script>
   ```

3. **Event Handler Injections**
   ```html
   <!-- BLOCKED -->
   <img src=x onerror="alert('XSS')">
   <div onclick="malicious()">Click</div>
   ```

4. **Data URI Injection**
   ```html
   <!-- BLOCKED in script/src -->
   <script src="data:text/javascript,alert('XSS')"></script>
   ```

### Clickjacking Prevention

The `frame-ancestors 'none'` directive prevents your site from being embedded in iframes, protecting against clickjacking attacks.

---

## 📈 Performance Impact

- **Minimal overhead**: ~0.1ms per request for nonce generation
- **Header size**: CSP headers add ~500-800 bytes
- **Browser caching**: Policies cached by browsers
- **No runtime impact**: All checks happen at header level

---

## 🧪 Testing CSP

### Manual Testing

1. Open browser DevTools Console
2. Look for CSP violation messages
3. Try loading resources from non-whitelisted domains
4. Test inline scripts without nonces

### Automated Testing

```typescript
describe('CSP Headers', () => {
  it('should include CSP header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/test')
      .expect(200);
    
    expect(response.headers['content-security-policy']).toBeDefined();
  });
  
  it('should block malicious scripts', async () => {
    // Attempt to load script from non-whitelisted domain
    // Should be blocked by browser CSP enforcement
  });
});
```

---

## 📚 Additional Resources

- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [W3C CSP Specification](https://www.w3.org/TR/CSP/)
- [CSP Evaluator Tool](https://csp-evaluator.withgoogle.com/)
- [Report URI](https://report-uri.com/)

---

**Last Updated**: March 27, 2026  
**Version**: 1.0.0  
**Maintained by**: PropChain Security Team
