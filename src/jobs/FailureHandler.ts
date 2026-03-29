import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobStatus, JobType } from '../models/Job';
import { JobManager } from './JobManager';
import { DataSource } from 'typeorm';

export interface FailureAnalysis {
  jobId: string;
  errorType: 'timeout' | 'network' | 'database' | 'validation' | 'business_logic' | 'system' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  recommendedAction: 'retry' | 'escalate' | 'manual_intervention' | 'ignore';
  retryDelay?: number;
  maxRetries?: number;
  analysis: string;
}

export interface FailurePattern {
  errorType: string;
  frequency: number;
  timeWindow: number;
  affectedJobs: string[];
  pattern: 'sporadic' | 'burst' | 'continuous' | 'scheduled';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RecoveryAction {
  type: 'retry' | 'requeue' | 'escalate' | 'notify' | 'isolate' | 'pause_queue';
  description: string;
  executedAt: Date;
  result: 'success' | 'failed' | 'pending';
}

export interface FailureMetrics {
  totalFailures: number;
  failuresByType: Record<string, number>;
  failuresByQueue: Record<string, number);
  failuresByHour: Record<string, number>;
  averageRetryCount: number;
  successRateAfterRetry: number;
  criticalFailures: number;
  patterns: FailurePattern[];
}

@Injectable()
export class FailureHandler {
  private readonly logger = new Logger(FailureHandler.name);
  private readonly failureHistory: Map<string, FailureAnalysis[]> = new Map();
  private readonly recoveryActions: Map<string, RecoveryAction[]> = new Map();
  private readonly metricsInterval: NodeJS.Timeout;
  private readonly maxHistorySize = 1000;

  constructor(
    private readonly jobManager: JobManager,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    // Update metrics every 5 minutes
    this.metricsInterval = setInterval(
      () => this.updateMetrics(),
      5 * 60 * 1000
    );
  }

  async handleJobFailure(job: Job, error: Error): Promise<void> {
    const analysis = this.analyzeFailure(job, error);
    
    // Store failure analysis
    this.storeFailureAnalysis(job.id, analysis);
    
    // Log the failure
    this.logger.error(`Job ${job.id} failed: ${analysis.analysis}`, error);
    
    // Execute recovery action based on analysis
    await this.executeRecoveryAction(job, analysis);
    
    // Check for patterns and take preventive measures
    await this.checkFailurePatterns(job.queue, analysis);
  }

  private analyzeFailure(job: Job, error: Error): FailureAnalysis {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';
    
    // Determine error type
    let errorType: FailureAnalysis['errorType'] = 'unknown';
    let severity: FailureAnalysis['severity'] = 'medium';
    let isRetryable = true;
    let recommendedAction: FailureAnalysis['recommendedAction'] = 'retry';
    let retryDelay = 5000;
    let maxRetries = 3;
    let analysis = '';

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorType = 'timeout';
      severity = 'medium';
      isRetryable = job.attempts < 3;
      recommendedAction = isRetryable ? 'retry' : 'escalate';
      retryDelay = Math.min(30000, 5000 * Math.pow(2, job.attempts));
      analysis = 'Job execution timed out. May require more time or resource optimization.';
    }
    
    // Network errors
    else if (errorMessage.includes('network') || errorMessage.includes('connection') || 
             errorMessage.includes('econnrefused') || errorMessage.includes('etimedout')) {
      errorType = 'network';
      severity = 'medium';
      isRetryable = true;
      recommendedAction = 'retry';
      retryDelay = Math.min(60000, 10000 * Math.pow(2, job.attempts));
      maxRetries = 5;
      analysis = 'Network connectivity issue. Retrying with exponential backoff.';
    }
    
    // Database errors
    else if (errorMessage.includes('database') || errorMessage.includes('sql') || 
             errorMessage.includes('connection') && errorMessage.includes('database') ||
             errorStack.includes('typeorm') || errorStack.includes('pg')) {
      errorType = 'database';
      severity = job.attempts > 2 ? 'high' : 'medium';
      isRetryable = job.attempts < 3;
      recommendedAction = isRetryable ? 'retry' : 'escalate';
      retryDelay = Math.min(30000, 5000 * Math.pow(2, job.attempts));
      analysis = 'Database operation failed. May be a temporary issue or data consistency problem.';
    }
    
    // Validation errors
    else if (errorMessage.includes('validation') || errorMessage.includes('invalid') || 
             errorMessage.includes('required') || errorMessage.includes('format')) {
      errorType = 'validation';
      severity = 'medium';
      isRetryable = false; // Validation errors won't fix themselves
      recommendedAction = 'manual_intervention';
      analysis = 'Input validation failed. Job data is invalid and requires correction.';
    }
    
    // Business logic errors
    else if (errorMessage.includes('business') || errorMessage.includes('logic') || 
             errorMessage.includes('rule') || errorMessage.includes('constraint')) {
      errorType = 'business_logic';
      severity = 'medium';
      isRetryable = false;
      recommendedAction = 'manual_intervention';
      analysis = 'Business rule violation. Requires review of business logic or data.';
    }
    
    // System errors
    else if (errorMessage.includes('memory') || errorMessage.includes('disk') || 
             errorMessage.includes('system') || errorMessage.includes('resource')) {
      errorType = 'system';
      severity = 'high';
      isRetryable = job.attempts < 2;
      recommendedAction = isRetryable ? 'retry' : 'escalate';
      analysis = 'System resource issue. May indicate infrastructure problems.';
    }
    
    // Unknown errors
    else {
      errorType = 'unknown';
      severity = job.attempts > 1 ? 'high' : 'medium';
      isRetryable = job.attempts < 3;
      recommendedAction = isRetryable ? 'retry' : 'escalate';
      analysis = 'Unknown error occurred. Further investigation required.';
    }

    // Adjust severity based on job priority and queue
    if (job.priority === 'critical') {
      severity = 'critical';
    }

    // Check if this is a recurring failure
    const failureCount = this.getFailureCount(job.id);
    if (failureCount > 3) {
      severity = 'critical';
      recommendedAction = 'escalate';
    }

    return {
      jobId: job.id,
      errorType,
      severity,
      isRetryable,
      recommendedAction,
      retryDelay,
      maxRetries,
      analysis,
    };
  }

  private storeFailureAnalysis(jobId: string, analysis: FailureAnalysis): void {
    if (!this.failureHistory.has(jobId)) {
      this.failureHistory.set(jobId, []);
    }
    
    const history = this.failureHistory.get(jobId)!;
    history.push(analysis);
    
    // Keep only recent failures
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  private getFailureCount(jobId: string): number {
    return this.failureHistory.get(jobId)?.length || 0;
  }

  private async executeRecoveryAction(job: Job, analysis: FailureAnalysis): Promise<void> {
    let action: RecoveryAction;
    
    switch (analysis.recommendedAction) {
      case 'retry':
        action = await this.retryJob(job, analysis);
        break;
      case 'escalate':
        action = await this.escalateFailure(job, analysis);
        break;
      case 'manual_intervention':
        action = await this.requestManualIntervention(job, analysis);
        break;
      case 'ignore':
        action = await this.ignoreFailure(job, analysis);
        break;
      default:
        action = await this.retryJob(job, analysis);
    }
    
    // Store recovery action
    this.storeRecoveryAction(job.id, action);
  }

  private async retryJob(job: Job, analysis: FailureAnalysis): Promise<RecoveryAction> {
    try {
      const retryDelay = analysis.retryDelay || 5000;
      
      // Update job with retry information
      job.nextRetryAt = new Date(Date.now() + retryDelay);
      job.status = JobStatus.RETRYING;
      
      await this.jobManager.failJob(job.id, `Retrying in ${retryDelay}ms: ${analysis.analysis}`);
      
      this.logger.log(`Job ${job.id} scheduled for retry in ${retryDelay}ms`);
      
      return {
        type: 'retry',
        description: `Job scheduled for retry in ${retryDelay}ms`,
        executedAt: new Date(),
        result: 'success',
      };
    } catch (error) {
      this.logger.error(`Failed to retry job ${job.id}:`, error);
      return {
        type: 'retry',
        description: `Failed to schedule retry: ${error.message}`,
        executedAt: new Date(),
        result: 'failed',
      };
    }
  }

  private async escalateFailure(job: Job, analysis: FailureAnalysis): Promise<RecoveryAction> {
    try {
      // Send notification to administrators
      await this.sendEscalationNotification(job, analysis);
      
      // Mark job as requiring manual intervention
      await this.jobManager.failJob(job.id, `Escalated: ${analysis.analysis}`);
      
      // Pause queue if critical
      if (analysis.severity === 'critical') {
        await this.jobManager.pauseQueue(job.queue);
      }
      
      this.logger.warn(`Job ${job.id} escalated due to ${analysis.severity} severity`);
      
      return {
        type: 'escalate',
        description: `Job escalated to administrators due to ${analysis.severity} severity`,
        executedAt: new Date(),
        result: 'success',
      };
    } catch (error) {
      return {
        type: 'escalate',
        description: `Failed to escalate: ${error.message}`,
        executedAt: new Date(),
        result: 'failed',
      };
    }
  }

  private async requestManualIntervention(job: Job, analysis: FailureAnalysis): Promise<RecoveryAction> {
    try {
      // Create manual intervention task
      await this.createManualInterventionTask(job, analysis);
      
      // Mark job as failed permanently
      await this.jobManager.failJob(job.id, `Manual intervention required: ${analysis.analysis}`);
      
      this.logger.warn(`Job ${job.id} requires manual intervention: ${analysis.analysis}`);
      
      return {
        type: 'escalate',
        description: `Manual intervention requested for job`,
        executedAt: new Date(),
        result: 'success',
      };
    } catch (error) {
      return {
        type: 'escalate',
        description: `Failed to request manual intervention: ${error.message}`,
        executedAt: new Date(),
        result: 'failed',
      };
    }
  }

  private async ignoreFailure(job: Job, analysis: FailureAnalysis): Promise<RecoveryAction> {
    try {
      // Mark job as failed but don't retry
      await this.jobManager.failJob(job.id, `Ignored: ${analysis.analysis}`);
      
      this.logger.debug(`Job ${job.id} failure ignored: ${analysis.analysis}`);
      
      return {
        type: 'ignore',
        description: `Job failure ignored based on analysis`,
        executedAt: new Date(),
        result: 'success',
      };
    } catch (error) {
      return {
        type: 'ignore',
        description: `Failed to ignore failure: ${error.message}`,
        executedAt: new Date(),
        result: 'failed',
      };
    }
  }

  private storeRecoveryAction(jobId: string, action: RecoveryAction): void {
    if (!this.recoveryActions.has(jobId)) {
      this.recoveryActions.set(jobId, []);
    }
    
    const actions = this.recoveryActions.get(jobId)!;
    actions.push(action);
    
    // Keep only recent actions
    if (actions.length > 100) {
      actions.shift();
    }
  }

  private async checkFailurePatterns(queue: string, analysis: FailureAnalysis): Promise<void> {
    // Get recent failures for this queue
    const recentFailures = this.getRecentFailures(queue, 60); // Last 60 minutes
    
    if (recentFailures.length < 5) {
      return; // Not enough failures to detect patterns
    }

    // Group failures by type
    const failuresByType = recentFailures.reduce((acc, failure) => {
      acc[failure.errorType] = (acc[failure.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for high-frequency failures
    for (const [errorType, count] of Object.entries(failuresByType)) {
      if (count >= 10) { // 10+ failures of same type in 60 minutes
        await this.handleFailurePattern(queue, errorType, count, 60, 'burst');
      }
    }

    // Check for continuous failures
    if (recentFailures.length >= 30) { // 30+ failures in 60 minutes
      await this.handleFailurePattern(queue, 'mixed', recentFailures.length, 60, 'continuous');
    }
  }

  private getRecentFailures(queue: string, minutes: number): FailureAnalysis[] {
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    const recentFailures: FailureAnalysis[] = [];

    for (const analyses of this.failureHistory.values()) {
      for (const analysis of analyses) {
        // This is a simplified check - in production, you'd store timestamps
        recentFailures.push(analysis);
      }
    }

    return recentFailures;
  }

  private async handleFailurePattern(
    queue: string, 
    errorType: string, 
    frequency: number, 
    timeWindow: number, 
    pattern: FailurePattern['pattern']
  ): Promise<void> {
    this.logger.warn(`Failure pattern detected in queue ${queue}: ${frequency} ${errorType} errors in ${timeWindow} minutes (${pattern})`);

    // Take preventive actions based on pattern
    switch (pattern) {
      case 'burst':
        // Temporary pause to prevent overload
        await this.jobManager.pauseQueue(queue);
        setTimeout(() => this.jobManager.resumeQueue(queue), 5 * 60 * 1000); // Resume in 5 minutes
        break;
      
      case 'continuous':
        // Immediate escalation
        await this.sendPatternAlert(queue, errorType, frequency, timeWindow);
        await this.jobManager.pauseQueue(queue);
        break;
    }
  }

  private async sendEscalationNotification(job: Job, analysis: FailureAnalysis): Promise<void> {
    // In production, this would send email, Slack, or other notifications
    this.logger.warn(`ESCALATION: Job ${job.id} (${job.type}) failed with ${analysis.severity} severity: ${analysis.analysis}`);
  }

  private async createManualInterventionTask(job: Job, analysis: FailureAnalysis): Promise<void> {
    // In production, this would create a ticket or task in your issue tracking system
    this.logger.warn(`MANUAL INTERVENTION REQUIRED: Job ${job.id} - ${analysis.analysis}`);
  }

  private async sendPatternAlert(queue: string, errorType: string, frequency: number, timeWindow: number): Promise<void> {
    // In production, this would send alerts to monitoring systems
    this.logger.error(`PATTERN ALERT: ${frequency} ${errorType} failures in queue ${queue} over ${timeWindow} minutes`);
  }

  async getFailureMetrics(): Promise<FailureMetrics> {
    const allFailures = Array.from(this.failureHistory.values()).flat();
    
    const totalFailures = allFailures.length;
    
    const failuresByType = allFailures.reduce((acc, failure) => {
      acc[failure.errorType] = (acc[failure.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const failuresByQueue = {}; // Would need to track queue info
    const failuresByHour = {}; // Would need to track timestamps
    
    const retryableFailures = allFailures.filter(f => f.isRetryable).length;
    const averageRetryCount = totalFailures > 0 ? retryableFailures / totalFailures : 0;
    
    const criticalFailures = allFailures.filter(f => f.severity === 'critical').length;
    
    // This would be more sophisticated in production
    const successRateAfterRetry = 0.75; // Placeholder
    const patterns: FailurePattern[] = []; // Would be calculated from history

    return {
      totalFailures,
      failuresByType,
      failuresByQueue,
      failuresByHour,
      averageRetryCount,
      successRateAfterRetry,
      criticalFailures,
      patterns,
    };
  }

  private async updateMetrics(): Promise<void> {
    const metrics = await this.getFailureMetrics();
    
    // Store metrics for monitoring
    this.logger.debug('Failure metrics updated:', {
      total: metrics.totalFailures,
      critical: metrics.criticalFailures,
      byType: metrics.failuresByType,
    });
  }

  async getJobFailureHistory(jobId: string): Promise<{
    analyses: FailureAnalysis[];
    actions: RecoveryAction[];
  }> {
    return {
      analyses: this.failureHistory.get(jobId) || [],
      actions: this.recoveryActions.get(jobId) || [],
    };
  }

  async retryFailedJob(jobId: string): Promise<boolean> {
    return this.jobManager.retryJob(jobId);
  }

  async clearFailureHistory(jobId?: string): Promise<void> {
    if (jobId) {
      this.failureHistory.delete(jobId);
      this.recoveryActions.delete(jobId);
    } else {
      this.failureHistory.clear();
      this.recoveryActions.clear();
    }
  }
}
