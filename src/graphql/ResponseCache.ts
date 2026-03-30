import { Injectable, Logger } from '@nestjs/common';
import { CacheManagerService } from '../cache/CacheManager';
import { createHash } from 'crypto';

@Injectable()
export class GraphQLResponseCache {
  private readonly logger = new Logger(GraphQLResponseCache.name);
  private readonly prefix = 'graphql:response:';

  constructor(private readonly cacheManager: CacheManagerService) {}

  /**
   * Get cached response for query/variables combo
   */
  async getResponse(query: string, variables: any, context?: any): Promise<any | null> {
    const key = this.generateCacheKey(query, variables, context);
    return await this.cacheManager.get(`${this.prefix}${key}`);
  }

  /**
   * Set cached response
   */
  async setResponse(query: string, variables: any, response: any, ttlSeconds = 600, context?: any): Promise<void> {
    const key = this.generateCacheKey(query, variables, context);
    await this.cacheManager.set(`${this.prefix}${key}`, response, ttlSeconds);
    this.logger.debug(`Cached GraphQL response with key prefix: ${this.prefix}${key}`);
  }

  /**
   * Invalidate based on key pattern
   */
  async invalidateResponses(pattern: string): Promise<number> {
    return await this.cacheManager.invalidatePattern(`${this.prefix}*${pattern}*`);
  }

  private generateCacheKey(query: string, variables: any, context?: any): string {
    const dataString = JSON.stringify({
      query,
      variables,
      userId: context?.user?.id || 'anonymous',
      role: context?.user?.role || 'public',
    });
    return createHash('md5').update(dataString).digest('hex');
  }
}
