import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobManager } from './JobManager';
import { FailureHandler } from './FailureHandler';
import { Job, JobType, JobStatus } from '../models/Job';
import { SchedulerRegistry } from '@nestjs/schedule';

export interface JobHandler {
  type: JobType;
  handle(job: Job): Promise<Record<string, any> | void>;
  onProgress?(job: Job, progress: number, message?: string): Promise<void>;
  onTimeout?(job: Job): Promise<void>;
}

export interface WorkerStats {
  workerId: string;
  queue: string;
  status: 'idle' | 'processing' | 'stopped';
  currentJob?: string;
  jobsProcessed: number;
  jobsFailed: number;
  averageProcessingTime: number;
  uptime: number;
  lastActivity: Date;
}

export interface ProcessorConfig {
  workerId: string;
  queues: string[];
  concurrency: number;
  pollInterval: number;
  maxProcessingTime: number;
  enableHeartbeat: boolean;
  heartbeatInterval: number;
}

@Injectable()
export class QueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessor.name);
  private readonly jobHandlers: Map<JobType, JobHandler> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly config: ProcessorConfig;
  private readonly heartbeatInterval: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly jobManager: JobManager,
    private readonly failureHandler: FailureHandler,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.config = this.loadConfig();
    this.heartbeatInterval = setInterval(
      () => this.sendHeartbeat(),
      this.config.heartbeatInterval
    );
  }

  private loadConfig(): ProcessorConfig {
    return {
      workerId: this.configService.get('worker.id', `worker-${process.pid}-${Date.now()}`),
      queues: this.configService.get('worker.queues', ['default']),
      concurrency: this.configService.get('worker.concurrency', 5),
      pollInterval: this.configService.get('worker.pollInterval', 5000),
      maxProcessingTime: this.configService.get('worker.maxProcessingTime', 300000),
      enableHeartbeat: this.configService.get('worker.enableHeartbeat', true),
      heartbeatInterval: this.configService.get('worker.heartbeatInterval', 30000),
    };
  }

  async onModuleInit(): Promise<void> {
    await this.registerDefaultHandlers();
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  registerHandler(handler: JobHandler): void {
    this.jobHandlers.set(handler.type, handler);
    this.logger.log(`Registered handler for job type: ${handler.type}`);
  }

  private async registerDefaultHandlers(): Promise<void> {
    // Email Send Handler
    this.registerHandler({
      type: JobType.EMAIL_SEND,
      handle: async (job: Job) => {
        const { to, subject, template, data } = job.data;
        
        // Simulate email sending
        await this.simulateWork(1000, 3000);
        
        this.logger.log(`Email sent to ${to} with subject: ${subject}`);
        
        return {
          messageId: `msg-${Date.now()}`,
          status: 'sent',
          timestamp: new Date(),
        };
      },
      onProgress: async (job, progress) => {
        await this.jobManager.updateJobProgress(job.id, progress, `Sending email... ${progress}%`);
      },
    });

    // Data Sync Handler
    this.registerHandler({
      type: JobType.DATA_SYNC,
      handle: async (job: Job) => {
        const { source, target, syncType } = job.data;
        
        // Simulate data synchronization
        const totalSteps = 10;
        for (let step = 1; step <= totalSteps; step++) {
          await this.simulateWork(500, 1500);
          const progress = Math.round((step / totalSteps) * 100);
          await this.jobManager.updateJobProgress(job.id, progress, `Syncing step ${step}/${totalSteps}`);
        }
        
        this.logger.log(`Data sync completed from ${source} to ${target}`);
        
        return {
          recordsProcessed: Math.floor(Math.random() * 1000) + 100,
          syncType,
          completedAt: new Date(),
        };
      },
    });

    // Report Generation Handler
    this.registerHandler({
      type: JobType.REPORT_GENERATION,
      handle: async (job: Job) => {
        const { reportType, parameters, format } = job.data;
        
        // Simulate report generation
        await this.simulateWork(2000, 5000);
        
        const reportUrl = `https://reports.example.com/${reportType}-${Date.now()}.${format}`;
        
        this.logger.log(`Report generated: ${reportType} at ${reportUrl}`);
        
        return {
          reportUrl,
          reportType,
          format,
          size: Math.floor(Math.random() * 10000000) + 1000000, // 1MB - 10MB
          generatedAt: new Date(),
        };
      },
      onProgress: async (job, progress) => {
        await this.jobManager.updateJobProgress(job.id, progress, `Generating report... ${progress}%`);
      },
    });

    // Cleanup Handler
    this.registerHandler({
      type: JobType.CLEANUP,
      handle: async (job: Job) => {
        const { resource, olderThan } = job.data;
        
        // Simulate cleanup operation
        await this.simulateWork(1000, 3000);
        
        const itemsDeleted = Math.floor(Math.random() * 100) + 10;
        
        this.logger.log(`Cleanup completed: ${itemsDeleted} items deleted from ${resource}`);
        
        return {
          resource,
          itemsDeleted,
          olderThan,
          completedAt: new Date(),
        };
      },
    });

    // Notification Handler
    this.registerHandler({
      type: JobType.NOTIFICATION,
      handle: async (job: Job) => {
        const { userId, message, channels } = job.data;
        
        // Simulate notification sending
        await this.simulateWork(500, 1500);
        
        this.logger.log(`Notification sent to user ${userId} via ${channels.join(', ')}`);
        
        return {
          userId,
          message,
          channels,
          sentAt: new Date(),
        };
      },
    });

    // Webhook Handler
    this.registerHandler({
      type: JobType.WEBHOOK,
      handle: async (job: Job) => {
        const { url, method, payload, headers } = job.data;
        
        // Simulate webhook call
        await this.simulateWork(1000, 2000);
        
        this.logger.log(`Webhook called: ${method} ${url}`);
        
        return {
          url,
          method,
          statusCode: 200,
          responseTime: Math.floor(Math.random() * 1000) + 100,
          timestamp: new Date(),
        };
      },
    });

    // Backup Handler
    this.registerHandler({
      type: JobType.BACKUP,
      handle: async (job: Job) => {
        const { database, type, destination } = job.data;
        
        // Simulate backup process
        const totalSteps = 5;
        for (let step = 1; step <= totalSteps; step++) {
          await this.simulateWork(2000, 4000);
          const progress = Math.round((step / totalSteps) * 100);
          await this.jobManager.updateJobProgress(job.id, progress, `Backup step ${step}/${totalSteps}`);
        }
        
        const backupSize = Math.floor(Math.random() * 1000000000) + 100000000; // 100MB - 1GB
        
        this.logger.log(`Backup completed: ${database} (${backupSize} bytes)`);
        
        return {
          database,
          type,
          destination,
          backupSize,
          completedAt: new Date(),
        };
      },
    });

    // Index Rebuild Handler
    this.registerHandler({
      type: JobType.INDEX_REBUILD,
      handle: async (job: Job) => {
        const { index, collection } = job.data;
        
        // Simulate index rebuilding
        await this.simulateWork(3000, 8000);
        
        this.logger.log(`Index rebuilt: ${index} on ${collection}`);
        
        return {
          index,
          collection,
          documentsIndexed: Math.floor(Math.random() * 100000) + 10000,
          completedAt: new Date(),
        };
      },
    });

    // Cache Warm Handler
    this.registerHandler({
      type: JobType.CACHE_WARM,
      handle: async (job: Job) => {
        const { keys, pattern } = job.data;
        
        // Simulate cache warming
        const totalKeys = keys?.length || 100;
        for (let i = 0; i < totalKeys; i++) {
          await this.simulateWork(10, 50);
          if (i % 10 === 0) {
            const progress = Math.round((i / totalKeys) * 100);
            await this.jobManager.updateJobProgress(job.id, progress, `Warmed ${i}/${totalKeys} keys`);
          }
        }
        
        this.logger.log(`Cache warmed: ${totalKeys} keys`);
        
        return {
          keysWarmed: totalKeys,
          pattern,
          completedAt: new Date(),
        };
      },
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Queue processor is already running');
      return;
    }

    this.isRunning = true;
    
    // Create workers for each queue
    for (const queue of this.config.queues) {
      for (let i = 0; i < this.config.concurrency; i++) {
        const workerId = `${this.config.workerId}-${queue}-${i}`;
        const worker = new Worker(workerId, queue, this);
        this.workers.set(workerId, worker);
        await worker.start();
      }
    }

    this.logger.log(`Started ${this.workers.size} workers for queues: ${this.config.queues.join(', ')}`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
    await Promise.all(stopPromises);
    
    this.workers.clear();
    this.logger.log('Queue processor stopped');
  }

  async processJob(job: Job): Promise<void> {
    const handler = this.jobHandlers.get(job.type);
    
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    const startTime = Date.now();
    
    try {
      // Set up timeout
      const timeout = setTimeout(async () => {
        this.logger.warn(`Job ${job.id} timed out after ${this.config.maxProcessingTime}ms`);
        
        if (handler.onTimeout) {
          await handler.onTimeout(job);
        }
        
        await this.jobManager.failJob(job.id, `Job timed out after ${this.config.maxProcessingTime}ms`);
      }, this.config.maxProcessingTime);

      // Process the job
      const result = await handler.handle(job);
      
      clearTimeout(timeout);
      
      // Mark job as completed
      await this.jobManager.completeJob(job.id, result);
      
      const processingTime = Date.now() - startTime;
      this.logger.debug(`Job ${job.id} completed in ${processingTime}ms`);
      
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      
      // Handle failure through failure handler
      await this.failureHandler.handleJobFailure(job, error);
    }
  }

  async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    await this.jobManager.updateJobProgress(jobId, progress, message);
  }

  getWorkerStats(): WorkerStats[] {
    return Array.from(this.workers.values()).map(worker => worker.getStats());
  }

  getQueueStats() {
    return this.jobManager.getQueueStats();
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.config.enableHeartbeat) {
      return;
    }

    try {
      const stats = this.getWorkerStats();
      
      // Send heartbeat to job manager for each worker
      for (const stat of stats) {
        if (stat.currentJob) {
          const job = await this.jobManager.getJob(stat.currentJob);
          if (job) {
            job.sendHeartbeat();
            await this.jobManager.updateJobProgress(job.id, job.progress, job.progressMessage);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', error);
    }
  }

  private async simulateWork(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

class Worker {
  private readonly logger = new Logger(Worker.name);
  private readonly processor: QueueProcessor;
  private readonly pollInterval: NodeJS.Timeout;
  private isRunning = false;
  private currentJob: Job | null = null;
  private stats = {
    jobsProcessed: 0,
    jobsFailed: 0,
    totalProcessingTime: 0,
    startTime: new Date(),
    lastActivity: new Date(),
  };

  constructor(
    public readonly workerId: string,
    public readonly queue: string,
    processor: QueueProcessor,
  ) {
    this.processor = processor;
    this.pollInterval = setInterval(
      () => this.poll(),
      processor['config'].pollInterval
    );
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.stats.startTime = new Date();
    this.logger.debug(`Worker ${this.workerId} started for queue ${this.queue}`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    // Wait for current job to finish or timeout
    if (this.currentJob) {
      this.logger.debug(`Worker ${this.workerId} waiting for current job to finish`);
      // Give the job 30 seconds to finish
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    this.logger.debug(`Worker ${this.workerId} stopped`);
  }

  private async poll(): Promise<void> {
    if (!this.isRunning || this.currentJob) {
      return;
    }

    try {
      const job = await this.processor['jobManager'].getNextJob(this.queue, this.workerId);
      
      if (job) {
        this.currentJob = job;
        this.stats.lastActivity = new Date();
        
        const startTime = Date.now();
        
        try {
          await this.processor.processJob(job);
          this.stats.jobsProcessed++;
        } catch (error) {
          this.stats.jobsFailed++;
          throw error;
        } finally {
          this.stats.totalProcessingTime += Date.now() - startTime;
          this.currentJob = null;
        }
      }
    } catch (error) {
      this.logger.error(`Worker ${this.workerId} error:`, error);
      this.currentJob = null;
    }
  }

  getStats(): WorkerStats {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const avgProcessingTime = this.stats.jobsProcessed > 0 
      ? this.stats.totalProcessingTime / this.stats.jobsProcessed 
      : 0;

    return {
      workerId: this.workerId,
      queue: this.queue,
      status: this.isRunning ? (this.currentJob ? 'processing' : 'idle') : 'stopped',
      currentJob: this.currentJob?.id,
      jobsProcessed: this.stats.jobsProcessed,
      jobsFailed: this.stats.jobsFailed,
      averageProcessingTime: avgProcessingTime,
      uptime,
      lastActivity: this.stats.lastActivity,
    };
  }
}
