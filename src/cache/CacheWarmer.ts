import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { CacheManagerService } from './CacheManager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheWarmerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmerService.name);
  private readonly warmupOnStart: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheManager: CacheManagerService
  ) {
    this.warmupOnStart = this.configService.get<boolean>('CACHE_WARMUP_ON_START', true);
  }

  async onApplicationBootstrap() {
    if (this.warmupOnStart) {
      this.logger.log('Starting cache warming processes...');
      await this.warmupCriticalData();
      this.logger.log('Cache warming complete.');
    }
  }

  /**
   * Warm up critical data like system settings, frequent property lookups, etc.
   */
  async warmupCriticalData() {
    this.logger.log('Warming critical data...');
    // Simulated warmup logic
    // fetch property metadata and store in cache
    const systemSettings = { version: '1.0.0', status: 'operational', metadata: { lastWarmup: new Date().toISOString() } };
    await this.cacheManager.set('system:settings', systemSettings, 3600); // 1 hour TTL
  }

  /**
   * Intelligent cache warming based on usage patterns or predicted frequent lookups.
   */
  async predictiveWarmup(assetIds: string[]) {
    this.logger.log(`Predictive cache warming triggered for ${assetIds.length} assets`);
    for (const assetId of assetIds) {
      // Simulate fetching and caching
      const assetData = { id: assetId, timestamp: Date.now(), cached: true };
      await this.cacheManager.set(`asset:${assetId}`, assetData, 1800); // 30 minute TTL
    }
  }
}
