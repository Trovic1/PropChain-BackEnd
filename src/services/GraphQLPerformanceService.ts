import { Injectable, Logger } from '@nestjs/common';
import { GraphQLQueryOptimizer } from '../graphql/QueryOptimizer';
import { GraphQLResponseCache } from '../graphql/ResponseCache';
import { RedisClusterService } from '../cache/RedisCluster';

@Injectable()
export class GraphQLPerformanceService {
  private readonly logger = new Logger(GraphQLPerformanceService.name);
  private queryStats: Map<string, { duration: number; count: number; lastAccess: number }>;

  constructor(
    private readonly queryOptimizer: GraphQLQueryOptimizer,
    private readonly responseCache: GraphQLResponseCache,
    private readonly redisClusterService: RedisClusterService
  ) {
    this.queryStats = new Map();
  }

  /**
   * Track specific query execution time and performance
   */
  trackExecutionTime(queryType: string, duration: number) {
    const stats = this.queryStats.get(queryType) || { duration: 0, count: 0, lastAccess: Date.now() };
    stats.duration = (stats.duration * stats.count + duration) / (stats.count + 1);
    stats.count++;
    stats.lastAccess = Date.now();
    this.queryStats.set(queryType, stats);
  }

  /**
   * Get suggestions based on performance analytics
   */
  getOptimizationSuggestions() {
    const slowQueries = Array.from(this.queryStats.entries())
      .filter(([_, stats]) => stats.duration > 150) // More than 150ms is slow for a query
      .map(([name, stats]) => ({
        name,
        averageDuration: `${stats.duration.toFixed(2)}ms`,
        suggestion: 'Consider adding field resolvers or optimizing database indexes',
      }));

    return {
      slowQueries,
      cacheEfficiency: this.calculateCacheEfficiency(),
      optimizationStatus: slowQueries.length > 0 ? 'warning' : 'optimized',
    };
  }

  private calculateCacheEfficiency() {
    // This could also be integrated with hit/miss analytics from ResponseCache
    return {
      hitRatio: '84.5%', // Placeholder for actual reported cache hits
      evictionRate: '2.1 per min',
    };
  }
}
