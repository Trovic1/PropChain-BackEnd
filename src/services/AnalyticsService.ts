import { Injectable, Logger } from '@nestjs/common';
import { StreamProcessor, AnalyticsEvent } from '../analytics/StreamProcessor';
import { EventAggregator } from '../analytics/EventAggregator';
import { MetricsCalculator, MetricDefinition } from '../analytics/MetricsCalculator';

export interface AnalyticsPipelineStatus {
  active: boolean;
  totalEvents: number;
  lastEventAt: number | null;
  metrics: Record<string, number>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly stream: StreamProcessor;
  private running = false;

  constructor(
    private readonly aggregator: EventAggregator,
    private readonly calculator: MetricsCalculator,
  ) {
    this.stream = new StreamProcessor(aggregator, calculator);
    this.defineDefaultMetrics();
  }

  start(): void {
    this.stream.start();
    this.running = true;
    this.logger.log('AnalyticsService started');
  }

  stop(): void {
    this.stream.stop();
    this.running = false;
    this.logger.log('AnalyticsService stopped');
  }

  async ingest(event: AnalyticsEvent): Promise<void> {
    if (!this.running) {
      this.start();
    }

    await this.stream.processEvent(event);
  }

  ingestBatch(events: AnalyticsEvent[]): Promise<void> {
    if (!this.running) {
      this.start();
    }

    return this.stream.processBatch(events);
  }

  getAggregateStats() {
    return this.aggregator.getSnapshot();
  }

  getMetrics() {
    return this.calculator.getMetrics();
  }

  defineMetric(definition: MetricDefinition): void {
    this.calculator.defineMetric(definition);
  }

  removeMetric(metricId: string): void {
    this.calculator.removeMetric(metricId);
  }

  reset(): void {
    this.aggregator.reset();
    this.calculator.reset();
    this.logger.log('Analytics pipeline reset');
  }

  setRetentionPolicy(keepMinutes: number): void {
    this.logger.log(`Data retention policy set to ${keepMinutes} minutes`);
  }

  getStatus(): AnalyticsPipelineStatus {
    const snapshot = this.aggregator.getSnapshot();
    return {
      active: this.running,
      totalEvents: snapshot.totalEvents,
      lastEventAt: snapshot.lastEventAt,
      metrics: this.calculator.getMetrics(),
    };
  }

  private defineDefaultMetrics(): void {
    this.calculator.defineMetric({
      metricId: 'events_per_minute',
      description: 'count of events in the last minute',
      formula: (event, snapshot) => {
        const windowKey = new Date(event.timestamp).toISOString().slice(0, 16);
        return snapshot.windowCounts[windowKey] ?? 0;
      },
    });

    this.calculator.defineMetric({
      metricId: 'total_events',
      description: 'total event count',
      formula: (_event, snapshot) => snapshot.totalEvents,
    });
  }
}
