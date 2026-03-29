import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClusterService } from './RedisCluster';
import { LRUCache } from 'lru-cache';

@Injectable()
export class CacheManagerService implements OnModuleInit {
  private readonly logger = new Logger(CacheManagerService.name);
  private l1Cache: LRUCache<string, any>;
  private l1Ttl: number;
  private l1MaxItems: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisClusterService: RedisClusterService
  ) {}

  async onModuleInit() {
    this.l1Ttl = this.configService.get<number>('L1_CACHE_TTL', 60 * 1000); // 1 minute default
    this.l1MaxItems = this.configService.get<number>('L1_CACHE_MAX_ITEMS', 500);

    this.l1Cache = new LRUCache({
      max: this.l1MaxItems,
      ttl: this.l1Ttl,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    // Try L1 (Memory)
    const l1Result = this.l1Cache.get(key) as T;
    if (l1Result !== undefined) {
      return l1Result;
    }

    // Try L2 (Redis)
    const redis = this.redisClusterService.getClient();
    const l2Result = await redis.get(key);
    if (l2Result) {
      const parsed = JSON.parse(l2Result) as T;
      // Populate L1 for future fast access
      this.l1Cache.set(key, parsed);
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Set L1
    this.l1Cache.set(key, value);

    // Set L2 (Redis)
    const redis = this.redisClusterService.getClient();
    const jsonValue = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, jsonValue, 'EX', ttlSeconds);
    } else {
      await redis.set(key, jsonValue);
    }
  }

  async del(key: string): Promise<void> {
    // Delete from L1
    this.l1Cache.delete(key);

    // Delete from L2 (Redis)
    const redis = this.redisClusterService.getClient();
    await redis.del(key);
  }

  async flushAll(): Promise<void> {
    this.l1Cache.clear();
    const redis = this.redisClusterService.getClient();
    await redis.flushall();
  }

  /**
   * Intelligently invalidate based on pattern (Redis) or exact key
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const redis = this.redisClusterService.getClient();
    let keys: string[] = [];

    if (redis instanceof Cluster) {
      const clusterKeys = await redis.keys(pattern);
      keys = clusterKeys;
    } else {
      keys = await redis.keys(pattern);
    }

    if (keys.length > 0) {
      for (const key of keys) {
        this.l1Cache.delete(key);
      }
      return await redis.del(...keys);
    }

    return 0;
  }
}
