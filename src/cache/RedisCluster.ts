import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster, ClusterNode, ClusterOptions } from 'ioredis';

@Injectable()
export class RedisClusterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisClusterService.name);
  private cluster: Cluster | Redis;
  private readonly isCluster: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isCluster = this.configService.get<boolean>('REDIS_USE_CLUSTER', false);
  }

  async onModuleInit() {
    try {
      if (this.isCluster) {
        const nodes = this.getClusterNodes();
        const options = this.getClusterOptions();
        this.cluster = new Redis.Cluster(nodes, options);
        this.logger.log('Redis Cluster initialized');
      } else {
        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = this.configService.get<number>('REDIS_PORT', 6379);
        const password = this.configService.get<string>('REDIS_PASSWORD');
        const db = this.configService.get<number>('REDIS_DB', 0);

        this.cluster = new Redis({
          host,
          port,
          password,
          db,
        });
        this.logger.log(`Redis Single Node initialized at ${host}:${port}`);
      }

      this.cluster.on('error', (err) => {
        this.logger.error('Redis connection error', err);
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.cluster) {
      await this.cluster.quit();
    }
  }

  getClient(): Cluster | Redis {
    return this.cluster;
  }

  private getClusterNodes(): ClusterNode[] {
    const nodesString = this.configService.get<string>('REDIS_CLUSTER_NODES');
    if (!nodesString) {
      throw new Error('REDIS_CLUSTER_NODES is required when REDIS_USE_CLUSTER is true');
    }

    return nodesString.split(',').map((node) => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port, 10) };
    });
  }

  private getClusterOptions(): ClusterOptions {
    return {
      redisOptions: {
        password: this.configService.get<string>('REDIS_PASSWORD'),
        tls: this.configService.get<boolean>('REDIS_TLS_ENABLED') ? {} : undefined,
      },
      clusterRetryStrategy: (times) => Math.min(times * 100, 3000),
    };
  }
}
