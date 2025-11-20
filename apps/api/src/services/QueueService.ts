/**
 * Queue Service
 * Manages Bull job queues for background processing
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import {
  QueueName,
  getRedisConfig,
  queueConfigs,
  JobPriority,
  getJobOptionsByPriority,
  AppointmentReminderJobData,
  FollowUpMonitorJobData,
  MedicationReminderJobData,
  AdherenceCheckJobData,
  AppointmentStatusJobData,
} from '../config/queue';
import logger from '../utils/logger';
import { getRedisClient } from '../config/redis';

/**
 * Queue statistics interface
 */
interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Queue health status
 */
interface QueueHealth {
  name: string;
  isHealthy: boolean;
  stats: QueueStats;
  errors: string[];
}

/**
 * QueueService - Centralized queue management
 */
export class QueueService {
  private static instance: QueueService;
  private queues: Map<QueueName, Queue> = new Map();
  private isInitialized: boolean = false;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Initialize all queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('QueueService already initialized');
      return;
    }

    try {
      logger.info('Initializing QueueService...');

      // Create all queues
      for (const queueName of Object.values(QueueName)) {
        await this.createQueue(queueName);
      }

      this.isInitialized = true;
      logger.info('QueueService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize QueueService:', error);
      // Don't throw - allow app to continue without queues
      logger.warn('⏸️ QueueService disabled due to initialization error');
      this.isInitialized = true;
    }
  }

  /**
   * Create a queue
   */
  private async createQueue(name: QueueName): Promise<Queue> {
    try {
      const queueConfig = queueConfigs[name] || {};

      // Get the shared Redis client to avoid "max clients" error
      const sharedClient = await getRedisClient();

      if (!sharedClient) {
        throw new Error('Redis client not available');
      }

      // Bull options using shared Redis client
      const options = {
        // Use the shared client for all Bull connections
        createClient: (type: string) => {
          logger.debug(`Bull queue ${name} requesting ${type} client - returning shared connection`);

          // All Bull clients need enableOfflineQueue: true to prevent crashes
          // when Redis connection temporarily fails
          return sharedClient.duplicate({
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            enableOfflineQueue: true, // Critical: Prevents "Stream isn't writeable" errors
          });
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential' as const,
            delay: 2000,
          },
          removeOnComplete: {
            age: 24 * 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600,
          },
        },
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 2,
          lockDuration: 30000,
          lockRenewTime: 15000,
        },
        ...queueConfig,
      };

      const queue = new Bull(name, options);

      // Set up event handlers
      this.setupQueueEventHandlers(queue, name);

      this.queues.set(name, queue);
      logger.info(`Queue created: ${name}`);

      return queue;
    } catch (error) {
      logger.error(`Failed to create queue ${name}:`, error);
      throw error;
    }
  }

  /**
   * Set up event handlers for a queue
   */
  private setupQueueEventHandlers(queue: Queue, name: QueueName): void {
    // Job completed
    queue.on('completed', (job: Job, result: any) => {
      logger.info(`Job completed in queue ${name}:`, {
        jobId: job.id,
        data: job.data,
        result,
        duration: Date.now() - job.processedOn!,
      });
    });

    // Job failed
    queue.on('failed', (job: Job, error: Error) => {
      logger.error(`Job failed in queue ${name}:`, {
        jobId: job.id,
        data: job.data,
        error: error.message,
        stack: error.stack,
        attemptsMade: job.attemptsMade,
        attemptsLeft: (job.opts.attempts || 0) - job.attemptsMade,
      });
    });

    // Job stalled
    queue.on('stalled', (job: Job) => {
      logger.warn(`Job stalled in queue ${name}:`, {
        jobId: job.id,
        data: job.data,
      });
    });

    // Job progress
    queue.on('progress', (job: Job, progress: number) => {
      logger.debug(`Job progress in queue ${name}:`, {
        jobId: job.id,
        progress,
      });
    });

    // Queue error
    queue.on('error', (error: Error) => {
      // Suppress Redis connection errors - app continues without queues
      if (error.message.includes('max retries') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('SSL') ||
        error.message.includes('ECONNRESET')) {
        logger.debug(`Queue ${name} Redis connection issue (gracefully degraded):`, error.message);
        return;
      }
      logger.error(`Queue error in ${name}:`, error);
    });

    // Queue waiting
    queue.on('waiting', (jobId: string) => {
      logger.debug(`Job waiting in queue ${name}:`, { jobId });
    });

    // Queue active
    queue.on('active', (job: Job) => {
      logger.debug(`Job active in queue ${name}:`, {
        jobId: job.id,
        data: job.data,
      });
    });

    // Queue paused
    queue.on('paused', () => {
      logger.warn(`Queue paused: ${name}`);
    });

    // Queue resumed
    queue.on('resumed', () => {
      logger.info(`Queue resumed: ${name}`);
    });

    // Queue cleaned
    queue.on('cleaned', (jobs: Job[], type: string) => {
      logger.info(`Queue cleaned in ${name}:`, {
        count: jobs.length,
        type,
      });
    });
  }

  /**
   * Get a queue by name
   */
  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = any>(
    queueName: QueueName,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    try {
      const job = await queue.add(data, options);
      logger.info(`Job added to queue ${queueName}:`, {
        jobId: job.id,
        data,
      });
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Add a job with priority
   */
  async addJobWithPriority<T = any>(
    queueName: QueueName,
    data: T,
    priority: JobPriority,
    additionalOptions?: Partial<JobOptions>
  ): Promise<Job<T>> {
    const options = {
      ...getJobOptionsByPriority(priority),
      ...additionalOptions,
    };

    return this.addJob(queueName, data, options);
  }

  /**
   * Schedule a job to run at a specific time
   */
  async scheduleJob<T = any>(
    queueName: QueueName,
    data: T,
    scheduledTime: Date,
    options?: Partial<JobOptions>
  ): Promise<Job<T>> {
    const delay = scheduledTime.getTime() - Date.now();
    if (delay < 0) {
      throw new Error('Scheduled time must be in the future');
    }

    return this.addJob(queueName, data, {
      ...options,
      delay,
    });
  }

  /**
   * Schedule a recurring job
   */
  async scheduleRecurringJob<T = any>(
    queueName: QueueName,
    data: T,
    cronExpression: string,
    options?: Partial<JobOptions>
  ): Promise<Job<T>> {
    return this.addJob(queueName, data, {
      ...options,
      repeat: {
        cron: cronExpression,
      },
    });
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return queue.getJob(jobId);
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      logger.info(`Job removed from queue ${queueName}:`, { jobId });
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.retry();
      logger.info(`Job retried in queue ${queueName}:`, { jobId });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName): Promise<QueueStats> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<QueueName, QueueStats>> {
    const stats: Record<string, QueueStats> = {};

    for (const queueName of Object.values(QueueName)) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats as Record<QueueName, QueueStats>;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.pause();
    logger.info(`Queue paused: ${queueName}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.resume();
    logger.info(`Queue resumed: ${queueName}`);
  }

  /**
   * Clean a queue
   */
  async cleanQueue(
    queueName: QueueName,
    grace: number = 0,
    status: 'completed' | 'failed' | 'delayed' | 'active' | 'wait' = 'completed'
  ): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const jobs = await queue.clean(grace, status);
    logger.info(`Queue cleaned: ${queueName}`, {
      count: jobs.length,
      status,
    });

    return jobs;
  }

  /**
   * Empty a queue (remove all jobs)
   */
  async emptyQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.empty();
    logger.info(`Queue emptied: ${queueName}`);
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(queueName: QueueName): Promise<QueueHealth> {
    const errors: string[] = [];
    let isHealthy = true;

    try {
      const queue = this.getQueue(queueName);
      if (!queue) {
        errors.push('Queue not found');
        isHealthy = false;
      }

      const stats = await this.getQueueStats(queueName);

      // Check for unhealthy conditions
      if (stats.failed > 100) {
        errors.push(`High number of failed jobs: ${stats.failed}`);
        isHealthy = false;
      }

      if (stats.active > 1000) {
        errors.push(`High number of active jobs: ${stats.active}`);
        isHealthy = false;
      }

      if (stats.paused) {
        errors.push('Queue is paused');
        isHealthy = false;
      }

      return {
        name: queueName,
        isHealthy,
        stats,
        errors,
      };
    } catch (error) {
      errors.push(`Health check failed: ${error.message}`);
      return {
        name: queueName,
        isHealthy: false,
        stats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        },
        errors,
      };
    }
  }

  /**
   * Get health status for all queues
   */
  async getAllQueuesHealth(): Promise<QueueHealth[]> {
    const healthChecks: QueueHealth[] = [];

    for (const queueName of Object.values(QueueName)) {
      const health = await this.getQueueHealth(queueName);
      healthChecks.push(health);
    }

    return healthChecks;
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all queues...');

    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );

    await Promise.all(closePromises);
    this.queues.clear();
    this.isInitialized = false;

    logger.info('All queues closed');
  }

  /**
   * Get queue metrics for monitoring
   */
  async getQueueMetrics(queueName: QueueName): Promise<any> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      repeatableJobs,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
      queue.getRepeatableJobs(),
    ]);

    // Get recent jobs
    const [recentCompleted, recentFailed] = await Promise.all([
      queue.getCompleted(0, 10),
      queue.getFailed(0, 10),
    ]);

    return {
      name: queueName,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      paused,
      repeatableJobs: repeatableJobs.length,
      recentCompleted: recentCompleted.map((job) => ({
        id: job.id,
        data: job.data,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        duration: job.finishedOn! - job.processedOn!,
      })),
      recentFailed: recentFailed.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
      })),
    };
  }
}

export default QueueService.getInstance();
