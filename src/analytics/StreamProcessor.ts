import { Injectable, Logger } from '@nestjs/common';
import { EventAggregator } from './EventAggregator';
import { MetricsCalculator } from './MetricsCalculator';

export interface AnalyticsEvent {
  eventId: string;
  eventType: string;
  timestamp: number;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StreamProcessor {
  private readonly logger = new Logger(StreamProcessor.name);
  private isRunning = false;

  constructor(
    private readonly aggregator: EventAggregator,
    private readonly metricsCalculator: MetricsCalculator,
  ) {}

  start(): void {
    if (this.isRunning) {
      this.logger.warn('StreamProcessor already running');
      return;
    }

    this.isRunning = true;
    this.logger.log('StreamProcessor started');
  }

  stop(): void {
    this.isRunning = false;
    this.logger.log('StreamProcessor stopped');
  }

  async processEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('StreamProcessor is not running, starting now');
      this.start();
    }

    this.logger.debug(`Processing event ${event.eventId}:${event.eventType}`);

    try {
      this.aggregator.ingest(event);
      this.metricsCalculator.updateMetrics(event, this.aggregator.getSnapshot());
    } catch (error) {
      this.logger.error(
        `Failed to process event ${event.eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async processBatch(events: AnalyticsEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }
}
