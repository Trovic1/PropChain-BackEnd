import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { CspMiddleware } from '../middleware/csp.middleware';
import { CspViolationController } from '../controllers/csp-violation.controller';
import { CspUtilityService } from '../services/csp-utility.service';

/**
 * Content Security Policy (CSP) Module
 * 
 * Provides comprehensive CSP protection with:
 * - Automatic CSP headers on all responses
 * - Nonce-based inline script support
 * - Violation reporting and monitoring
 * - Environment-specific policies
 */
@Module({
  controllers: [CspViolationController],
  providers: [CspUtilityService],
  exports: [CspUtilityService],
})
export class CspModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply CSP middleware to all routes
    consumer
      .apply(CspMiddleware)
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}
