import { Module } from '@nestjs/common';
import { EventAggregator } from './EventAggregator';
import { MetricsCalculator } from './MetricsCalculator';
import { StreamProcessor } from './StreamProcessor';
import { AnalyticsService } from '../services/AnalyticsService';

@Module({
  providers: [EventAggregator, MetricsCalculator, StreamProcessor, AnalyticsService],
  exports: [AnalyticsService, EventAggregator, MetricsCalculator],
})
export class AnalyticsModule {}
