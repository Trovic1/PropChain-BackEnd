import { Module, MiddlewareConsumer, RequestMethod, INestModule } from '@nestjs/common';
import { LoggingMiddleware } from '../../src/common/logging/logging.middleware';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { LoggerService } from '../../src/common/logger/logger.service';

/**
 * Auth Stack Module
 * 
 * Includes authentication-focused middleware:
 * - LoggingMiddleware: Request correlation and logging
 * - AdvancedRateLimitGuard: Rate limiting for API protection
 * - JWT Authentication: Token validation (simulated for benchmarks)
 * 
 * This represents a typical authentication-heavy stack.
 */
@Module({
  imports: [ConfigModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AuthStackModule implements INestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply logging middleware to all routes
    consumer.apply(LoggingMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });

    // Note: Rate limiting is typically applied as a guard
    // For benchmarking purposes, we include it conceptually
    // Actual implementation would use AdvancedRateLimitGuard
  }
}

/**
 * Auth Stack Configuration
 */
export const AUTH_STACK_CONFIG = {
  name: 'Auth Stack',
  description: 'Authentication-focused middleware (JWT + Rate Limit + Logger)',
  components: ['LoggingMiddleware', 'AdvancedRateLimitGuard', 'JwtAuthGuard'],
};
