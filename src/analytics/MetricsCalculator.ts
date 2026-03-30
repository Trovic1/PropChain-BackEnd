import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsEvent } from './StreamProcessor';
import { AggregatedEventStats } from './EventAggregator';

export interface MetricDefinition {
  metricId: string;
  description?: string;
  formula: (event: AnalyticsEvent, snapshot: AggregatedEventStats) => number;
}

export interface CalculatedMetrics {
  [metricId: string]: number;
}

@Injectable()
export class MetricsCalculator {
  private readonly logger = new Logger(MetricsCalculator.name);
  private metricDefinitions: Record<string, MetricDefinition> = {};
  private metricValues: CalculatedMetrics = {};

  defineMetric(metric: MetricDefinition): void {
    this.metricDefinitions[metric.metricId] = metric;
    this.metricValues[metric.metricId] = 0;
    this.logger.log(`Metric defined: ${metric.metricId}`);
  }

  removeMetric(metricId: string): void {
    delete this.metricDefinitions[metricId];
    delete this.metricValues[metricId];
    this.logger.log(`Metric removed: ${metricId}`);
  }

  updateMetrics(event: AnalyticsEvent, snapshot: AggregatedEventStats): void {
    for (const metric of Object.values(this.metricDefinitions)) {
      const value = metric.formula(event, snapshot);
      this.metricValues[metric.metricId] = value;
      this.logger.debug(`Metric updated: ${metric.metricId} = ${value}`);
    }
  }

  getMetrics(): CalculatedMetrics {
    return { ...this.metricValues };
  }

  getMetric(metricId: string): number | undefined {
    return this.metricValues[metricId];
  }

  reset(): void {
    this.metricValues = {};
    Object.keys(this.metricDefinitions).forEach(id => {
      this.metricValues[id] = 0;
    });
    this.logger.log('MetricsCalculator reset');
  }
}
