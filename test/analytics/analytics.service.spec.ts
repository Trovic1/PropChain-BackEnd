import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../src/services/AnalyticsService';
import { EventAggregator } from '../../src/analytics/EventAggregator';
import { MetricsCalculator } from '../../src/analytics/MetricsCalculator';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, EventAggregator, MetricsCalculator],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should start and ingest events', async () => {
    await service.ingest({
      eventId: '1',
      eventType: 'click',
      timestamp: Date.now(),
      payload: { value: 1 },
    });

    const stats = service.getAggregateStats();
    expect(stats.totalEvents).toBe(1);
    expect(stats.byType['click']).toBe(1);

    const metrics = service.getMetrics();
    expect(metrics.total_events).toBe(1);
  });

  it('should reset stats', async () => {
    await service.ingest({
      eventId: '2',
      eventType: 'view',
      timestamp: Date.now(),
      payload: { value: 10 },
    });

    service.reset();
    const stats = service.getAggregateStats();
    expect(stats.totalEvents).toBe(0);
  });
});
