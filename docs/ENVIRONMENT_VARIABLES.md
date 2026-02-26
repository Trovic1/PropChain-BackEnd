# Environment Variables Documentation

This document describes all required environment variables for the PropChain Backend.

## DATABASE_URL

**Description:** PostgreSQL connection string

**Type:** url

**Required:** Yes

**Example:** `postgresql://user:password@localhost:5432/propchain`

## JWT_SECRET

**Description:** JWT secret key (minimum 32 characters)

**Type:** string

**Required:** Yes

**Example:** `your-secret-value`

**Additional Validation:** Custom validation rules apply

## JWT_REFRESH_SECRET

**Description:** JWT refresh secret key (minimum 32 characters)

**Type:** string

**Required:** Yes

**Example:** `your-secret-value`

**Additional Validation:** Custom validation rules apply

## ENCRYPTION_KEY

**Description:** 32-character encryption key for AES-256

**Type:** string

**Required:** Yes

**Example:** `your-secret-value`

**Additional Validation:** Custom validation rules apply

## RPC_URL

**Description:** Blockchain RPC endpoint URL

**Type:** url

**Required:** Yes

**Example:** `https://example.com`

## PRIVATE_KEY

**Description:** Ethereum private key (0x followed by 64 hex characters)

**Type:** private-key

**Required:** Yes

**Example:** `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## SESSION_SECRET

**Description:** Session secret key (minimum 32 characters)

**Type:** string

**Required:** Yes

**Example:** `your-secret-value`

**Additional Validation:** Custom validation rules apply

## EMAIL_FROM

**Description:** Default email address for sending emails

**Type:** email

**Required:** Yes

**Example:** `noreply@example.com`

## Security Guidelines

### Production Environment
- Never use default or example values in production
- Ensure all secrets are at least 32 characters long
- Use environment-specific configuration files
- Rotate secrets regularly

### Development Environment
- Use `.env.local` for local development overrides
- Keep sensitive values out of version control
- Use the provided templates as starting points

## Validation Features

The PropChain Backend includes comprehensive environment variable validation:

- **Type Validation**: Ensures values match expected formats (URL, email, etc.)
- **Security Checks**: Detects common insecure patterns
- **Required Variable Checking**: Validates all required variables are present
- **Custom Validation**: Additional rules for sensitive values

## Templates

Environment-specific templates are available in the `docs/` directory:
- `.env.development.template` - Development configuration
- `.env.staging.template` - Staging configuration  
- `.env.production.template` - Production configuration

## Testing

Run environment variable tests:

```bash
npm run test:env
```

Test reports are generated in `test-reports/env-validation.md`.

## Troubleshooting

### Common Issues

1. **Missing Required Variables**
   - Check the validation error messages
   - Ensure all required variables are set
   - Use the provided templates as reference

2. **Invalid Format**
   - Verify URLs are properly formatted
   - Check email addresses are valid
   - Ensure Ethereum addresses and private keys follow correct format

3. **Security Warnings**
   - Replace default values with secure ones
   - Avoid using development values in production
   - Ensure secrets meet minimum length requirements

### Validation Errors

If validation fails on startup, the application will:
1. Display all validation errors
2. Exit with error code 1
3. Prevent startup with invalid configuration

This ensures secure and reliable operation.
