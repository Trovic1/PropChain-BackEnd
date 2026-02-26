# API Security Guide

This guide covers the comprehensive API security implementation in the PropChain Backend project to ensure robust protection against various security threats.

## Table of Contents

- [Overview](#overview)
- [Security Headers](#security-headers)
- [Request Validation and Sanitization](#request-validation-and-sanitization)
- [Threat Detection and Prevention](#threat-detection-and-prevention)
- [Authentication Hardening](#authentication-hardening)
- [Authorization and RBAC](#authorization-and-rbac)
- [Abuse Detection and Prevention](#abuse-detection-and-prevention)
- [Security Testing](#security-testing)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Overview

The API security system provides comprehensive protection against:

- **Injection Attacks** - SQL injection, XSS, NoSQL injection
- **Authentication Threats** - Token manipulation, brute force attacks
- **Authorization Bypass** - Privilege escalation, role bypass
- **Abuse and DDoS** - Rate limiting, burst protection
- **Data Exposure** - Information leakage, insecure headers
- **Session Security** - Session hijacking, fixation

## Security Headers

### Automatic Security Headers

The `SecurityHeadersInterceptor` automatically adds comprehensive security headers to all API responses:

```typescript
// Applied headers include:
- Content-Security-Policy: Prevents XSS and code injection
- Strict-Transport-Security: Enforces HTTPS
- X-Frame-Options: Prevents clickjacking
- X-Content-Type-Options: Prevents MIME sniffing
- Referrer-Policy: Controls referrer information
- Permissions-Policy: Restricts browser features
- X-XSS-Protection: Enables XSS filtering
```

### CSP Configuration

```typescript
// Default CSP Policy
const cspPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');
```

## Request Validation and Sanitization

### Input Sanitization

The `RequestValidationInterceptor` provides comprehensive request validation:

```typescript
// Automatic sanitization includes:
- Null byte removal
- Control character filtering
- SQL injection pattern detection
- XSS pattern detection
- Path traversal prevention
- Request size validation
```

### Validation Rules

```typescript
// Suspicious patterns detected:
- <script> tags and JavaScript code
- SQL keywords (SELECT, DROP, UNION, etc.)
- Path traversal sequences (../)
- System file access attempts
- Executable code patterns
```

### Request Size Limits

```typescript
// Default limits:
- Maximum request size: 10MB
- Maximum parameter length: 1000 characters
- Maximum array size: 100 items
- Maximum object depth: 10 levels
```

## Threat Detection and Prevention

### Threat Analysis

The `ThreatDetectionService` analyzes every request for potential threats:

```typescript
const analysis = threatDetectionService.analyzeRequest(request);

// Analysis includes:
- Rate limiting violations
- Brute force attacks
- SQL injection attempts
- XSS attempts
- CSRF vulnerabilities
- Suspicious patterns
- Blacklisted IPs
- Anomalous behavior
```

### Threat Types

1. **Rate Limiting**
   - Per-minute request limits
   - Per-hour request limits
   - Burst protection
   - Endpoint-specific limits

2. **Brute Force Detection**
   - Failed login tracking
   - Password spraying detection
   - Credential stuffing prevention
   - Account lockout

3. **Injection Attacks**
   - SQL injection patterns
   - NoSQL injection patterns
   - Command injection attempts
   - Code injection detection

4. **Behavioral Analysis**
   - Request pattern analysis
   - User agent consistency
   - IP address validation
   - Automated behavior detection

### Blacklist Management

```typescript
// IP Blacklisting
threatDetectionService.addToBlacklist('192.168.1.100', 'Brute force attack', 3600000);

// Automatic Blacklisting
const analysis = threatDetectionService.analyzeRequest(request);
if (analysis.shouldBlock) {
  // Block request automatically
}
```

## Authentication Hardening

### Enhanced JWT Validation

The `AuthHardeningGuard` provides robust JWT validation:

```typescript
// Enhanced validation includes:
- Token format validation
- Expiration buffer checking
- Issued-at time validation
- User agent consistency
- IP address validation (optional)
- Token blacklist checking
```

### Token Security Features

```typescript
// Security checks:
- Token format: 3 parts with base64url encoding
- Expiration: 5-minute buffer before expiry
- Age limit: Maximum 24 hours
- User agent: Must match original
- IP address: Optional consistency check
```

### Multi-Factor Authentication

```typescript
// 2FA Requirements
const twoFaRequired = configService.get<boolean>('TWO_FA_REQUIRED', false);
if (twoFaRequired && !user.twoFactorVerified) {
  throw new ForbiddenException('Two-factor authentication required');
}
```

### API Key Authentication

```typescript
// API Key Features
- Format validation: 32+ alphanumeric characters
- Database verification
- Rate limiting per API key
- Usage tracking and analytics
- Key rotation support
```

### Request Signing

```typescript
// Request Signing Features
- HMAC signature verification
- Timestamp validation (5-minute window)
- Replay attack prevention
- Nonce support
- Algorithm flexibility
```

## Authorization and RBAC

### Role-Based Access Control

The `RbacHardeningGuard` provides enhanced RBAC:

```typescript
// RBAC Features
- Role validation
- Permission checking
- Account status validation
- Suspension checking
- Session timeout enforcement
```

### Permission Model

```typescript
// Permission Levels
- User: Basic access to own resources
- Moderator: Limited administrative access
- Admin: Full administrative access
- Super Admin: System-level access
```

### Security Context Validation

```typescript
// Security Checks
- Account status: active/suspended/blocked
- Suspension expiration: Time-based validation
- 2FA verification: When required
- Session timeout: Configurable limits
- Last activity: Session freshness
```

## Abuse Detection and Prevention

### Rate Limiting

The `AbuseDetectionService` provides sophisticated rate limiting:

```typescript
// Rate Limiting Features
- Per-minute limits: 100 requests default
- Per-hour limits: 1000 requests default
- Daily limits: 10000 requests default
- Endpoint-specific limits
- API key limits
- IP-based limits
```

### Burst Protection

```typescript
// Burst Detection
- 10-second window monitoring
- Maximum 30 requests in burst
- Automatic blocking on violation
- Configurable thresholds
- Graduated penalties
```

### Behavioral Analysis

```typescript
// Pattern Detection
- Request interval consistency
- Endpoint variety analysis
- User agent consistency
- Automated behavior flags
- Scanning detection
- Anomaly scoring
```

### Abuse Prevention

```typescript
// Prevention Measures
- Automatic IP blocking
- Temporary suspensions
- Rate limit adjustments
- CAPTCHA challenges
- Account verification
- Progressive penalties
```

## Security Testing

### Automated Security Testing

The `SecurityTestingService` provides comprehensive security testing:

```typescript
// Test Categories
- Authentication security
- Authorization security
- Input validation
- Rate limiting
- SQL injection protection
- XSS protection
- CSRF protection
- Security headers
- Encryption implementation
```

### Vulnerability Scanning

```typescript
// Security Report
const report = await securityTestingService.runSecurityTests();

// Report includes:
- Overall security score (0-100)
- Vulnerability details
- Risk assessment
- Remediation recommendations
- Compliance status
```

### Test Coverage

```typescript
// Test Coverage Areas
- JWT token validation
- Password security
- RBAC implementation
- Parameter validation
- File upload security
- Rate limiting enforcement
- Injection attack prevention
- Header security
- Data encryption
```

## Configuration

### Environment Variables

```bash
# Security Configuration
SECURITY_HEADERS_ENABLED=true
CSP_REPORT_URI=https://your-domain.com/csp-report
HSTS_MAX_AGE=31536000
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_PER_HOUR=1000
MAX_BURST_REQUESTS=30
MAX_PAYLOAD_SIZE=10485760
TWO_FA_REQUIRED=false
IP_VALIDATION_ENABLED=false
SESSION_TIMEOUT=3600000
BLACKLISTED_IPS=192.168.1.100,10.0.0.1
```

### Security Module Configuration

```typescript
// app.module.ts
import { SecurityModule } from './security/api';

@Module({
  imports: [
    SecurityModule.forRoot({
      securityHeaders: {
        enabled: true,
        csp: {
          enabled: true,
          reportUri: 'https://your-domain.com/csp-report'
        }
      },
      threatDetection: {
        enabled: true,
        autoBlock: true,
        blockDuration: 3600000 // 1 hour
      },
      abuseDetection: {
        enabled: true,
        rateLimiting: {
          perMinute: 100,
          perHour: 1000,
          daily: 10000
        }
      }
    })
  ],
})
export class AppModule {}
```

## Best Practices

### 1. Defense in Depth

```typescript
// Multiple layers of security
@UseGuards(
  JwtAuthGuard,           // Authentication
  RbacGuard,             // Authorization
  ThreatDetectionGuard,   // Threat detection
  RateLimitGuard,         // Rate limiting
  SecurityHeadersGuard    // Security headers
)
```

### 2. Secure Defaults

```typescript
// Secure by default
const defaultConfig = {
  securityHeaders: true,
  threatDetection: true,
  rateLimiting: true,
  inputValidation: true,
  encryption: true,
};
```

### 3. Comprehensive Logging

```typescript
// Security event logging
this.logger.warn(`Security threat detected: ${analysis.threats[0].type}`, {
  clientIp: analysis.clientIp,
  userAgent: analysis.userAgent,
  endpoint: analysis.endpoint,
  riskScore: analysis.riskScore,
});
```

### 4. Regular Security Testing

```typescript
// Automated security testing
@Cron('0 2 * * *') // Daily at 2 AM
async function runSecurityTests() {
  const report = await securityTestingService.runSecurityTests();
  
  if (report.score < 80) {
    // Alert security team
    await alertSecurityTeam(report);
  }
}
```

### 5. Incident Response

```typescript
// Security incident response
if (analysis.shouldBlock) {
  // Block request
  throw new TooManyRequestsException('Security violation detected');
  
  // Log incident
  await securityLogger.logIncident(analysis);
  
  // Alert administrators
  await alertService.sendSecurityAlert(analysis);
}
```

## Monitoring and Alerting

### Security Metrics

```typescript
// Key security metrics
const metrics = {
  totalRequests: 10000,
  blockedRequests: 150,
  threatDetections: 25,
  averageRiskScore: 15.5,
  topThreats: ['RATE_LIMIT_EXCEEDED', 'SQL_INJECTION', 'XSS'],
  blacklistedIPs: 12,
};
```

### Alert Configuration

```typescript
// Alert thresholds
const alertThresholds = {
  riskScore: 50,
  blockRate: 0.05, // 5%
  threatRate: 0.01, // 1%
  failedAuthRate: 0.1, // 10%
};
```

## Compliance

### Security Standards

The implementation addresses:

- **OWASP Top 10** - All major vulnerability categories
- **NIST Cybersecurity Framework** - Security controls
- **GDPR** - Data protection and privacy
- **SOC 2** - Security controls and procedures
- **ISO 27001** - Information security management

### Audit Trail

```typescript
// Comprehensive audit logging
auditLog.info('Security event', {
  event: 'AUTHENTICATION_SUCCESS',
  userId: user.id,
  clientIp: clientIp,
  userAgent: userAgent,
  timestamp: new Date(),
  riskScore: analysis.riskScore,
});
```

## Troubleshooting

### Common Issues

1. **False Positives**
   - Adjust sensitivity thresholds
   - Review whitelist configurations
   - Monitor false positive rates

2. **Performance Impact**
   - Optimize security checks
   - Use caching where appropriate
   - Monitor response times

3. **Configuration Errors**
   - Validate environment variables
   - Check module dependencies
   - Review security configurations

### Debug Mode

```typescript
// Enable security debugging
if (process.env.SECURITY_DEBUG) {
  console.log('Security analysis:', analysis);
}
```

## Conclusion

The API security system provides comprehensive protection against modern web application threats while maintaining performance and usability. Regular security testing, monitoring, and updates ensure continued protection against emerging threats.

For questions or contributions to the security system, please refer to the development team or create an issue in the project repository.
