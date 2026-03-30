import { Module, MiddlewareConsumer, RequestMethod, INestModule } from '@nestjs/common';
import { LoggingMiddleware } from '../../src/common/logging/logging.middleware';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { LoggerService } from '../../src/common/logger/logger.service';

/**
 * Minimal Stack Module
 * 
 * Includes only essential middleware:
 * - LoggingMiddleware: Request correlation and logging
 * - AllExceptionsFilter: Global error handling
 * 
 * This represents the bare minimum production configuration.
 */
@Module({
  imports: [ConfigModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class MinimalStackModule implements INestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply logging middleware to all routes
    consumer.apply(LoggingMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}

/**
 * Minimal Stack Configuration
 */
export const MINIMAL_STACK_CONFIG = {
  name: 'Minimal Stack',
  description: 'Bare minimum production middleware (Logger + Error Handler)',
  components: ['LoggingMiddleware', 'AllExceptionsFilter'],
};
