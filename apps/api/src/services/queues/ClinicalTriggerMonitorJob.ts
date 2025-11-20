/**
 * Clinical Trigger Monitor Job
 * Background job to monitor clinical triggers and create alerts
 * Requirements: 4.5
 */

import Bull from 'bull';
import mongoose from 'mongoose';
import AlertService from '../AlertService';
import Workplace from '../../models/Workplace';
import logger from '../../utils/logger';

export interface ClinicalTriggerMonitorJobData {
  workplaceId?: string;
  triggerTypes?: string[];
}

export class ClinicalTriggerMonitorJob {
  private queue: Bull.Queue;

  constructor(redisConfig?: Bull.QueueOptions) {
    this.queue = new Bull('clinical-trigger-monitor', {
      redis: redisConfig?.redis || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupProcessor();
    this.setupScheduledJobs();
  }

  private setupProcessor(): void {
    this.queue.process('monitor-clinical-triggers', 5, async (job) => {
      const { workplaceId, triggerTypes } = job.data as ClinicalTriggerMonitorJobData;

      try {
        logger.info('Processing clinical trigger monitor job', {
          jobId: job.id,
          workplaceId,
          triggerTypes,
        });

        if (workplaceId) {
          // Monitor specific workplace
          await AlertService.monitorClinicalTriggers(
            new mongoose.Types.ObjectId(workplaceId)
          );
        } else {
          // Monitor all active workplaces
          const workplaces = await Workplace.find({
            isActive: true,
            isDeleted: false,
          }).select('_id name');

          for (const workplace of workplaces) {
            try {
              await AlertService.monitorClinicalTriggers(workplace._id);
            } catch (error) {
              logger.error('Error monitoring clinical triggers for workplace', {
                workplaceId: workplace._id.toString(),
                workplaceName: workplace.name,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              // Continue with other workplaces
            }
          }
        }

        // Clean up expired alerts
        AlertService.cleanupExpiredAlerts();

        logger.info('Clinical trigger monitor job completed', {
          jobId: job.id,
          workplaceId,
        });

        return { success: true, processedAt: new Date() };
      } catch (error) {
        logger.error('Clinical trigger monitor job failed', {
          jobId: job.id,
          workplaceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    // Error handling
    this.queue.on('failed', (job, err) => {
      logger.error('Clinical trigger monitor job failed', {
        jobId: job.id,
        error: err.message,
        data: job.data,
      });
    });

    this.queue.on('completed', (job, result) => {
      logger.info('Clinical trigger monitor job completed', {
        jobId: job.id,
        result,
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn('Clinical trigger monitor job stalled', {
        jobId: job.id,
        data: job.data,
      });
    });
  }

  private setupScheduledJobs(): void {
    // Schedule monitoring job to run every hour
    this.queue.add(
      'monitor-clinical-triggers',
      {},
      {
        repeat: { cron: '0 * * * *' }, // Every hour at minute 0
        jobId: 'clinical-trigger-monitor-hourly',
      }
    );

    // Schedule cleanup job to run daily at 2 AM
    this.queue.add(
      'monitor-clinical-triggers',
      { cleanupOnly: true },
      {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        jobId: 'clinical-trigger-cleanup-daily',
      }
    );

    logger.info('Clinical trigger monitor scheduled jobs set up');
  }

  /**
   * Manually trigger monitoring for a specific workplace
   */
  async triggerMonitoring(
    workplaceId: string,
    options?: {
      delay?: number;
      priority?: number;
    }
  ): Promise<Bull.Job> {
    return this.queue.add(
      'monitor-clinical-triggers',
      { workplaceId },
      {
        delay: options?.delay || 0,
        priority: options?.priority || 0,
      }
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get recent job results
   */
  async getRecentJobs(limit: number = 10): Promise<Bull.Job[]> {
    return this.queue.getJobs(['completed', 'failed'], 0, limit - 1, true);
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info('Clinical trigger monitor queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info('Clinical trigger monitor queue resumed');
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Clinical trigger monitor queue closed');
  }

  /**
   * Get the Bull queue instance
   */
  getQueue(): Bull.Queue {
    return this.queue;
  }
}

// Export singleton instance
export const clinicalTriggerMonitorJob = new ClinicalTriggerMonitorJob();

export default ClinicalTriggerMonitorJob;