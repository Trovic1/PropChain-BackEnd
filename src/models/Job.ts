import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
}

export enum JobPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum JobType {
  EMAIL_SEND = 'email_send',
  DATA_SYNC = 'data_sync',
  REPORT_GENERATION = 'report_generation',
  CLEANUP = 'cleanup',
  NOTIFICATION = 'notification',
  WEBHOOK = 'webhook',
  BACKUP = 'backup',
  INDEX_REBUILD = 'index_rebuild',
  CACHE_WARM = 'cache_warm',
  CUSTOM = 'custom',
}

@Entity('jobs')
@Index(['status', 'priority'])
@Index(['queue', 'status'])
@Index(['scheduledAt'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  queue: string;

  @Column({ type: 'enum', enum: JobType })
  type: JobType;

  @Column({ type: 'json' })
  data: Record<string, any>;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  @Index()
  status: JobStatus;

  @Column({ type: 'enum', enum: JobPriority, default: JobPriority.MEDIUM })
  @Index()
  priority: JobPriority;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'json', nullable: true })
  result: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: {
    createdAt: Date;
    createdBy?: string;
    tags?: string[];
    timeout?: number;
    retryDelay?: number;
    backoffStrategy?: 'fixed' | 'exponential' | 'linear';
    dependencies?: string[];
    concurrencyKey?: string;
  };

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'text', nullable: true })
  progressMessage: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  assignedWorker: string;

  @Column({ type: 'timestamp', nullable: true })
  lastHeartbeatAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isPending(): boolean {
    return this.status === JobStatus.PENDING;
  }

  isRunning(): boolean {
    return this.status === JobStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === JobStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === JobStatus.FAILED;
  }

  isRetryable(): boolean {
    return this.attempts < this.maxAttempts && this.status === JobStatus.FAILED;
  }

  canRetry(): boolean {
    return this.isRetryable() && (!this.nextRetryAt || this.nextRetryAt <= new Date());
  }

  shouldStart(): boolean {
    return this.isPending() && (!this.scheduledAt || this.scheduledAt <= new Date());
  }

  isExpired(timeout: number = 300000): boolean {
    return this.isRunning() && 
           this.startedAt && 
           Date.now() - this.startedAt.getTime() > timeout;
  }

  getPriorityValue(): number {
    const priorityValues = {
      [JobPriority.LOW]: 1,
      [JobPriority.MEDIUM]: 2,
      [JobPriority.HIGH]: 3,
      [JobPriority.CRITICAL]: 4,
    };
    return priorityValues[this.priority];
  }

  updateProgress(progress: number, message?: string): void {
    this.progress = Math.max(0, Math.min(100, progress));
    if (message) {
      this.progressMessage = message;
    }
  }

  markAsRunning(workerId: string): void {
    this.status = JobStatus.RUNNING;
    this.startedAt = new Date();
    this.assignedWorker = workerId;
    this.lastHeartbeatAt = new Date();
    this.attempts += 1;
  }

  markAsCompleted(result?: Record<string, any>): void {
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
    this.progress = 100;
    if (result) {
      this.result = result;
    }
  }

  markAsFailed(error: string, retryDelay?: number): void {
    this.status = JobStatus.FAILED;
    this.errorMessage = error;
    
    if (this.isRetryable()) {
      this.scheduleRetry(retryDelay);
    }
  }

  private scheduleRetry(delay?: number): void {
    const retryDelay = delay || this.calculateRetryDelay();
    this.nextRetryAt = new Date(Date.now() + retryDelay);
    this.status = JobStatus.RETRYING;
  }

  private calculateRetryDelay(): number {
    const baseDelay = this.metadata?.retryDelay || 5000; // 5 seconds default
    const strategy = this.metadata?.backoffStrategy || 'exponential';
    
    switch (strategy) {
      case 'fixed':
        return baseDelay;
      case 'linear':
        return baseDelay * this.attempts;
      case 'exponential':
        return baseDelay * Math.pow(2, this.attempts - 1);
      default:
        return baseDelay;
    }
  }

  cancel(): void {
    this.status = JobStatus.CANCELLED;
    this.completedAt = new Date();
  }

  sendHeartbeat(): void {
    this.lastHeartbeatAt = new Date();
  }

  static createJob(
    queue: string,
    type: JobType,
    data: Record<string, any>,
    options: {
      priority?: JobPriority;
      scheduledAt?: Date;
      maxAttempts?: number;
      timeout?: number;
      retryDelay?: number;
      backoffStrategy?: 'fixed' | 'exponential' | 'linear';
      createdBy?: string;
      tags?: string[];
      dependencies?: string[];
      concurrencyKey?: string;
    } = {}
  ): Job {
    const job = new Job();
    job.queue = queue;
    job.type = type;
    job.data = data;
    job.priority = options.priority || JobPriority.MEDIUM;
    job.scheduledAt = options.scheduledAt;
    job.maxAttempts = options.maxAttempts || 3;
    job.createdBy = options.createdBy;
    
    job.metadata = {
      createdAt: new Date(),
      createdBy: options.createdBy,
      tags: options.tags || [],
      timeout: options.timeout,
      retryDelay: options.retryDelay,
      backoffStrategy: options.backoffStrategy || 'exponential',
      dependencies: options.dependencies || [],
      concurrencyKey: options.concurrencyKey,
    };

    return job;
  }
}
