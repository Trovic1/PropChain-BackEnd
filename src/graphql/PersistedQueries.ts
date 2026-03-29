import { Injectable, Logger } from '@nestjs/common';
import { CacheManagerService } from '../cache/CacheManager';
import { createHash } from 'crypto';

@Injectable()
export class GraphQLPersistedQueries {
  private readonly logger = new Logger(GraphQLPersistedQueries.name);
  private readonly prefix = 'graphql:persisted:';

  constructor(private readonly cacheManager: CacheManagerService) {}

  /**
   * Get query by its SHA256 hash or hash the provided query and store it
   */
  async getQuery(hash: string): Promise<string | null> {
    return await this.cacheManager.get<string>(`${this.prefix}${hash}`);
  }

  /**
   * Register a new persisted query
   */
  async registerQuery(query: string): Promise<string> {
    const hash = createHash('sha256').update(query).digest('hex');
    await this.cacheManager.set(`${this.prefix}${hash}`, query, 86400 * 7); // 7 days TTL
    this.logger.log(`Registered persisted query with hash: ${hash}`);
    return hash;
  }

  /**
   * Handle incoming request for persisted query
   */
  async handlePersistedQuery(hash: string, incomingQuery?: string): Promise<string> {
    const cachedQuery = await this.getQuery(hash);
    if (!cachedQuery) {
      if (incomingQuery) {
        // First time query - Register it
        return await this.registerQuery(incomingQuery);
      }
      throw new Error('PersistedQueryNotFound');
    }
    return cachedQuery;
  }
}
