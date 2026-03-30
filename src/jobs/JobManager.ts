import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, Not, IsNull } from 'typeorm';
import { Job, JobStatus, JobPriority, JobType } from '../models/Job';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface QueueStats {
  name: string;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
  total: number;
  avgProcessingTime: number;
  throughput: number;
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  timeout: number;
  priorities: JobPriority[];
  enabled: boolean;
}

export interface JobOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  timeout?: number;
  backoffStrategy?: 'fixed' | 'exponential' | 'linear';
  createdBy?: string;
  tags?: string[];
  dependencies?: string[];
  concurrencyKey?: string;
}

@Injectable()
export class JobManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobManager.name);
  private readonly redis: Redis;
  private readonly queueConfigs: Map<string, QueueConfig> = new Map();
  private readonly processingJobs: Map<string, string> = new Map(); // jobId -> workerId
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly metricsInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.redis = new Redis(this.configService.get('redis.url', 'redis://localhost:6379'));
    this.initializeQueueConfigs();
    
    // Cleanup expired jobs every 5 minutes
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredJobs(),
      5 * 60 * 1000
    );
    
    // Update metrics every minute
    this.metricsInterval = setInterval(
      () => this.updateQueueMetrics(),
      60 * 1000
    );
  }

  async onModuleInit(): Promise<void> {
    await this.initializeQueues();
    this.logger.log('Job Manager initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    await this.redis.quit();
  }

  private initializeQueueConfigs(): void {
    const defaultConfig = {
      concurrency: 5,
      maxRetries: 3,
      retryDelay: 5000,
      backoffStrategy: 'exponential' as const,
      timeout: 300000, // 5 minutes
      priorities: [JobPriority.LOW, JobPriority.MEDIUM, JobPriority.HIGH, JobPriority.CRITICAL],
      enabled: true,
    };

    const queueConfigs = this.configService.get<Record<string, Partial<QueueConfig>>>('jobQueues') || {};
    
    for (const [queueName, config] of Object.entries(queueConfigs)) {
      this.queueConfigs.set(queueName, {
        ...defaultConfig,
        name: queueName,
        ...config,
      });
    }

    // Add default queue if not configured
    if (!this.queueConfigs.has('default')) {
      this.queueConfigs.set('default', {
        ...defaultConfig,
        name: 'default',
      });
    }
  }

  private async initializeQueues(): Promise<void> {
    // Initialize Redis queues
    for (const queueName of this.queueConfigs.keys()) {
      await this.redis.del(`queue:${queueName}:pending`);
      await this.redis.del(`queue:${queueName}:processing`);
      await this.redis.del(`queue:${queueName}:completed`);
      await this.redis.del(`queue:${queueName}:failed`);
    }

    // Load existing jobs from database
    await this.loadExistingJobs();
  }

  private async loadExistingJobs(): Promise<void> {
    const pendingJobs = await this.jobRepository.find({
      where: { status: JobStatus.PENDING },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    for (const job of pendingJobs) {
      if (job.shouldStart()) {
        await this.enqueueJob(job);
      }
    }

    this.logger.log(`Loaded ${pendingJobs.length} pending jobs`);
  }

  async addJob(
    queue: string,
    type: JobType,
    data: Record<string, any>,
    options: JobOptions = {}
  ): Promise<Job> {
    const queueConfig = this.getQueueConfig(queue);
    
    const job = Job.createJob(queue, type, data, {
      priority: options.priority,
      maxAttempts: options.attempts || queueConfig.maxRetries,
      timeout: options.timeout || queueConfig.timeout,
      retryDelay: queueConfig.retryDelay,
      backoffStrategy: options.backoffStrategy || queueConfig.backoffStrategy,
      createdBy: options.createdBy,
      tags: options.tags,
      dependencies: options.dependencies,
      concurrencyKey: options.concurrencyKey,
    });

    if (options.delay) {
      job.scheduledAt = new Date(Date.now() + options.delay);
    }

    // Save to database
    const savedJob = await this.jobRepository.save(job);

    // Add to queue if ready to process
    if (job.shouldStart()) {
      await this.enqueueJob(savedJob);
    }

    this.logger.log(`Added job ${savedJob.id} to queue ${queue}`);
    return savedJob;
  }

  private async enqueueJob(job: Job): Promise<void> {
    const queueConfig = this.getQueueConfig(job.queue);
    
    if (!queueConfig.enabled) {
      this.logger.warn(`Queue ${job.queue} is disabled, job ${job.id} will not be processed`);
      return;
    }

    // Check dependencies
    if (job.metadata?.dependencies?.length) {
      const dependenciesCompleted = await this.checkDependencies(job.metadata.dependencies);
      if (!dependenciesCompleted) {
        this.logger.debug(`Job ${job.id} dependencies not met, keeping in pending state`);
        return;
      }
    }

    // Check concurrency limits
    if (job.metadata?.concurrencyKey) {
      const currentConcurrency = await this.getCurrentConcurrency(job.queue, job.metadata.concurrencyKey);
      const maxConcurrency = queueConfig.concurrency;
      
      if (currentConcurrency >= maxConcurrency) {
        this.logger.debug(`Concurrency limit reached for key ${job.metadata.concurrencyKey}`);
        return;
      }
    }

    // Add to Redis queue with priority
    const score = this.calculatePriorityScore(job);
    await this.redis.zadd(`queue:${job.queue}:pending`, score, job.id);
    
    // Update job status
    await this.jobRepository.update(job.id, { status: JobStatus.PENDING });
  }

  private calculatePriorityScore(job: Job): number {
    // Higher priority gets lower score (for min-heap behavior)
    const priorityValue = job.getPriorityValue();
    const timestamp = job.createdAt.getTime();
    return (5 - priorityValue) * 1000000000000 + timestamp;
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    const dependencyJobs = await this.jobRepository.find({
      where: { id: dependencies as any[] },
    });

    return dependencyJobs.every(job => job.isCompleted());
  }

  private async getCurrentConcurrency(queue: string, concurrencyKey: string): Promise<number> {
    const key = `queue:${queue}:concurrency:${concurrencyKey}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  async getNextJob(queue: string, workerId: string): Promise<Job | null> {
    const queueConfig = this.getQueueConfig(queue);
    
    if (!queueConfig.enabled) {
      return null;
    }

    // Get next job from Redis queue (highest priority first)
    const jobIds = await this.redis.zrange(`queue:${queue}:pending`, 0, 0);
    
    if (jobIds.length === 0) {
      return null;
    }

    const jobId = jobIds[0];
    
    // Remove from pending queue and add to processing
    await this.redis.zrem(`queue:${queue}:pending`, jobId);
    await this.redis.sadd(`queue:${queue}:processing`, jobId);
    
    // Update job status in database
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      this.logger.error(`Job ${jobId} not found in database`);
      await this.redis.srem(`queue:${queue}:processing`, jobId);
      return null;
    }

    job.markAsRunning(workerId);
    await this.jobRepository.save(job);
    
    // Track processing job
    this.processingJobs.set(jobId, workerId);
    
    // Update concurrency counter
    if (job.metadata?.concurrencyKey) {
      const key = `queue:${queue}:concurrency:${job.metadata.concurrencyKey}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 3600); // 1 hour expiry
    }

    this.logger.debug(`Worker ${workerId} started processing job ${jobId}`);
    return job;
  }

  async completeJob(jobId: string, result?: Record<string, any>): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      this.logger.error(`Job ${jobId} not found for completion`);
      return;
    }

    job.markAsCompleted(result);
    await this.jobRepository.save(job);

    // Remove from processing queue
    await this.redis.srem(`queue:${job.queue}:processing`, jobId);
    await this.redis.sadd(`queue:${job.queue}:completed`, jobId);
    
    // Update concurrency counter
    if (job.metadata?.concurrencyKey) {
      const key = `queue:${job.queue}:concurrency:${job.metadata.concurrencyKey}`;
      await this.redis.decr(key);
    }

    // Stop tracking
    this.processingJobs.delete(jobId);

    // Process dependent jobs
    await this.processDependentJobs(jobId);

    this.logger.log(`Job ${jobId} completed successfully`);
  }

  async failJob(jobId: string, error: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      this.logger.error(`Job ${jobId} not found for failure`);
      return;
    }

    job.markAsFailed(error);
    await this.jobRepository.save(job);

    // Remove from processing queue
    await this.redis.srem(`queue:${job.queue}:processing`, jobId);
    
    if (job.isRetryable()) {
      // Schedule retry
      await this.redis.zadd(
        `queue:${job.queue}:pending`,
        job.nextRetryAt!.getTime(),
        jobId
      );
      this.logger.log(`Job ${jobId} scheduled for retry at ${job.nextRetryAt}`);
    } else {
      // Move to failed queue
      await this.redis.sadd(`queue:${job.queue}:failed`, jobId);
      this.logger.error(`Job ${jobId} failed permanently: ${error}`);
    }

    // Update concurrency counter
    if (job.metadata?.concurrencyKey) {
      const key = `queue:${job.queue}:concurrency:${job.metadata.concurrencyKey}`;
      await this.redis.decr(key);
    }

    // Stop tracking
    this.processingJobs.delete(jobId);
  }

  async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      progress,
      progressMessage: message,
    });
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      return false;
    }

    if (job.isRunning()) {
      // Cannot cancel running jobs
      return false;
    }

    job.cancel();
    await this.jobRepository.save(job);

    // Remove from all queues
    await this.redis.zrem(`queue:${job.queue}:pending`, jobId);
    await this.redis.srem(`queue:${job.queue}:processing`, jobId);

    this.logger.log(`Job ${jobId} cancelled`);
    return true;
  }

  async getQueueStats(queue?: string): Promise<QueueStats[]> {
    const queues = queue ? [queue] : Array.from(this.queueConfigs.keys());
    const stats: QueueStats[] = [];

    for (const queueName of queues) {
      const config = this.getQueueConfig(queueName);
      
      const [pending, running, completed, failed, retrying] = await Promise.all([
        this.redis.zcard(`queue:${queueName}:pending`),
        this.redis.scard(`queue:${queueName}:processing`),
        this.redis.scard(`queue:${queueName}:completed`),
        this.redis.scard(`queue:${queueName}:failed`),
        this.jobRepository.count({ where: { queue: queueName, status: JobStatus.RETRYING } }),
      ]);

      const total = pending + running + completed + failed + retrying;
      
      // Calculate average processing time and throughput from database
      const avgProcessingTime = await this.calculateAverageProcessingTime(queueName);
      const throughput = await this.calculateThroughput(queueName);

      stats.push({
        name: queueName,
        pending,
        running,
        completed,
        failed,
        retrying,
        total,
        avgProcessingTime,
        throughput,
      });
    }

    return stats;
  }

  private async calculateAverageProcessingTime(queue: string): Promise<number> {
    const result = await this.jobRepository
      .createQueryBuilder('job')
      .select('AVG(EXTRACT(EPOCH FROM (job.completedAt - job.startedAt)) * 1000)', 'avgTime')
      .where('job.queue = :queue', { queue })
      .andWhere('job.status = :status', { status: JobStatus.COMPLETED })
      .andWhere('job.startedAt IS NOT NULL')
      .andWhere('job.completedAt IS NOT NULL')
      .getRawOne();

    return parseFloat(result?.avgTime) || 0;
  }

  private async calculateThroughput(queue: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await this.jobRepository.count({
      where: {
        queue,
        status: JobStatus.COMPLETED,
        completedAt: MoreThan(oneHourAgo),
      },
    });

    return count; // jobs per hour
  }

  private async cleanupExpiredJobs(): Promise<void> {
    const expiredJobs = await this.jobRepository.find({
      where: {
        status: JobStatus.RUNNING,
        startedAt: LessThan(new Date(Date.now() - 30 * 60 * 1000)), // 30 minutes ago
      },
    });

    for (const job of expiredJobs) {
      this.logger.warn(`Cleaning up expired job ${job.id}`);
      await this.failJob(job.id, 'Job expired - no heartbeat received');
    }
  }

  private async updateQueueMetrics(): Promise<void> {
    const stats = await this.getQueueStats();
    
    for (const stat of stats) {
      await this.redis.hmset(`metrics:${stat.name}`, {
        pending: stat.pending,
        running: stat.running,
        completed: stat.completed,
        failed: stat.failed,
        retrying: stat.retrying,
        avgProcessingTime: stat.avgProcessingTime,
        throughput: stat.throughput,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async processDependentJobs(completedJobId: string): Promise<void> {
    // Find jobs that depend on the completed job
    const dependentJobs = await this.jobRepository
      .createQueryBuilder('job')
      .where('job.metadata->>:dependencies ? :jobId', { 
        dependencies: 'dependencies', 
        jobId: completedJobId 
      })
      .andWhere('job.status = :status', { status: JobStatus.PENDING })
      .getMany();

    for (const job of dependentJobs) {
      if (job.shouldStart()) {
        await this.enqueueJob(job);
      }
    }
  }

  private getQueueConfig(queue: string): QueueConfig {
    const config = this.queueConfigs.get(queue);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queue}`);
    }
    return config;
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobRepository.findOne({ where: { id: jobId } });
  }

  async getJobs(
    queue?: string,
    status?: JobStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<Job[]> {
    const where: any = {};
    if (queue) where.queue = queue;
    if (status) where.status = status;

    return this.jobRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job || !job.isFailed()) {
      return false;
    }

    job.status = JobStatus.PENDING;
    job.nextRetryAt = undefined;
    job.errorMessage = undefined;
    
    await this.jobRepository.save(job);
    await this.enqueueJob(job);

    this.logger.log(`Job ${jobId} manually retried`);
    return true;
  }

  async pauseQueue(queue: string): Promise<void> {
    const config = this.getQueueConfig(queue);
    config.enabled = false;
    this.logger.log(`Queue ${queue} paused`);
  }

  async resumeQueue(queue: string): Promise<void> {
    const config = this.getQueueConfig(queue);
    config.enabled = true;
    this.logger.log(`Queue ${queue} resumed`);
  }

  async clearQueue(queue: string): Promise<number> {
    const cleared = await this.redis.del(`queue:${queue}:pending`);
    this.logger.log(`Cleared ${cleared} jobs from queue ${queue}`);
    return cleared;
  }
}
