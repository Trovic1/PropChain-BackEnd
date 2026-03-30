import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsEvent } from './StreamProcessor';

export interface AggregatedEventStats {
  totalEvents: number;
  byType: Record<string, number>;
  lastEventAt: number | null;
  windowCounts: Record<string, number>;
}

@Injectable()
export class EventAggregator {
  private readonly logger = new Logger(EventAggregator.name);
  private stats: AggregatedEventStats = {
    totalEvents: 0,
    byType: {},
    lastEventAt: null,
    windowCounts: {},
  };

  ingest(event: AnalyticsEvent): void {
    if (!event || !event.eventType) {
      this.logger.warn('Ignored invalid event');
      return;
    }

    this.stats.totalEvents += 1;
    this.stats.byType[event.eventType] = (this.stats.byType[event.eventType] ?? 0) + 1;
    this.stats.lastEventAt = event.timestamp;

    const windowKey = this.windowKey(event.timestamp);
    this.stats.windowCounts[windowKey] = (this.stats.windowCounts[windowKey] ?? 0) + 1;

    this.logger.debug(`Aggregated event type ${event.eventType} at window ${windowKey}`);
  }

  getSnapshot(): AggregatedEventStats {
    return JSON.parse(JSON.stringify(this.stats));
  }

  reset(): void {
    this.stats = {
      totalEvents: 0,
      byType: {},
      lastEventAt: null,
      windowCounts: {},
    };
    this.logger.log('EventAggregator reset');
  }

  private windowKey(timestamp: number): string {
    const date = new Date(timestamp);
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}T${hour}:${minute}`;
  }
}
