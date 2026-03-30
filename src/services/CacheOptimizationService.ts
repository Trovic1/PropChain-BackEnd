import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CacheManagerService } from '../cache/CacheManager';
import { RedisClusterService } from '../cache/RedisCluster';

@Injectable()
export class CacheOptimizationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheOptimizationService.name);
  private hitRateAnalytics: Map<string, { hits: number; misses: number; lastReset: number }>;

  constructor(
    private readonly cacheManager: CacheManagerService,
    private readonly redisClusterService: RedisClusterService
  ) {
    this.hitRateAnalytics = new Map();
  }

  async onApplicationBootstrap() {
    this.logger.log('Starting cache optimization monitoring...');
  }

  /**
   * Monitor cache health and suggest optimizations
   */
  async getHealthReport() {
    const redis = this.redisClusterService.getClient();
    const info = await redis.info('memory');
    const memoryUsed = info.split('\n').find((line) => line.startsWith('used_memory_human:'));

    return {
      memoryUsed,
      totalKeys: await this.getTotalKeys(),
      optimizationStatus: 'healthy',
      suggestions: this.generateSuggestions(),
    };
  }

  /**
   * Track hit/miss rates for different cache namespaces
   */
  trackAccess(keyPrefix: string, isHit: boolean) {
    const stats = this.hitRateAnalytics.get(keyPrefix) || { hits: 0, misses: 0, lastReset: Date.now() };
    if (isHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    this.hitRateAnalytics.set(keyPrefix, stats);
  }

  /**
   * Analyze performance and provide suggestions
   */
  async getPerformanceAnalytics() {
    const analytics = Array.from(this.hitRateAnalytics.entries()).map(([prefix, stats]) => {
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
      return {
        prefix,
        hitRate: `${hitRate.toFixed(2)}%`,
        totalAccesses: total,
        suggestion: hitRate < 20 ? 'Consider warming up this prefix atau adjust TTL' : 'Optimized',
      };
    });

    return analytics;
  }

  private generateSuggestions() {
    const suggestions: string[] = [];
    // Dynamic suggestions based on tracked analytics
    if (this.hitRateAnalytics.size === 0) {
      suggestions.push('No analytics tracked yet. Enable monitoring to receive suggestions.');
    }
    return suggestions;
  }

  private async getTotalKeys(): Promise<number> {
    const redis = this.redisClusterService.getClient();
    const info = await redis.info('keyspace');
    const keysLine = info.split('\n').find((line) => line.startsWith('db0:'));
    if (!keysLine) return 0;
    const matches = keysLine.match(/keys=(\d+)/);
    return matches ? parseInt(matches[1], 10) : 0;
  }
}
