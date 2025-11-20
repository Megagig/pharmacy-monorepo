/**
 * Adherence Check Scheduler Service
 * Schedules and manages adherence check reminder jobs
 * 
 * Features:
 * - Schedule weekly job to identify chronic disease patients
 * - Create adherence check reminders
 * - Track reminder effectiveness
 * 
 * Requirements: 2.3, 2.4, 2.5, 3.1
 */

import mongoose from 'mongoose';
import QueueService from './QueueService';
import { QueueName, AdherenceCheckJobData, JobPriority } from '../config/queue';
import logger from '../utils/logger';

class AdherenceCheckScheduler {
  /**
   * Schedule weekly job to check adherence for all chronic disease patients
   * This job runs once per week for each workplace
   */
  async scheduleWeeklyAdherenceCheck(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const jobData: AdherenceCheckJobData = {
        workplaceId: workplaceId.toString(),
      };

      // Schedule job to run weekly on Monday at 10 AM
      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      await queue.add(jobData, {
        repeat: {
          cron: '0 10 * * 1', // 10 AM every Monday
          tz: 'Africa/Lagos', // Adjust timezone as needed
        },
        jobId: `weekly-adherence-check-${workplaceId.toString()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled weekly adherence check job', {
        workplaceId: workplaceId.toString(),
        schedule: '10 AM every Monday',
      });
    } catch (error) {
      logger.error('Failed to schedule weekly adherence check:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule adherence check for specific patients
   */
  async schedulePatientAdherenceCheck(
    patientIds: mongoose.Types.ObjectId[],
    workplaceId: mongoose.Types.ObjectId,
    delay: number = 0
  ): Promise<void> {
    try {
      const jobData: AdherenceCheckJobData = {
        workplaceId: workplaceId.toString(),
        patientIds: patientIds.map((id) => id.toString()),
      };

      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      await queue.add(jobData, {
        delay,
        jobId: `patient-adherence-check-${Date.now()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled patient adherence check', {
        workplaceId: workplaceId.toString(),
        patientCount: patientIds.length,
        delayMs: delay,
      });
    } catch (error) {
      logger.error('Failed to schedule patient adherence check:', {
        workplaceId: workplaceId.toString(),
        patientCount: patientIds.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule adherence check for specific condition types
   */
  async scheduleConditionAdherenceCheck(
    conditionTypes: string[],
    workplaceId: mongoose.Types.ObjectId,
    delay: number = 0
  ): Promise<void> {
    try {
      const jobData: AdherenceCheckJobData = {
        workplaceId: workplaceId.toString(),
        conditionTypes,
      };

      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      await queue.add(jobData, {
        delay,
        jobId: `condition-adherence-check-${conditionTypes.join('-')}-${Date.now()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled condition adherence check', {
        workplaceId: workplaceId.toString(),
        conditionTypes: conditionTypes.join(', '),
        delayMs: delay,
      });
    } catch (error) {
      logger.error('Failed to schedule condition adherence check:', {
        workplaceId: workplaceId.toString(),
        conditionTypes: conditionTypes.join(', '),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule immediate adherence check (for testing or manual trigger)
   */
  async scheduleImmediateAdherenceCheck(
    workplaceId: mongoose.Types.ObjectId,
    patientIds?: mongoose.Types.ObjectId[],
    conditionTypes?: string[]
  ): Promise<void> {
    try {
      const jobData: AdherenceCheckJobData = {
        workplaceId: workplaceId.toString(),
        patientIds: patientIds?.map((id) => id.toString()),
        conditionTypes,
      };

      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      await queue.add(jobData, {
        jobId: `immediate-adherence-check-${Date.now()}`,
        priority: JobPriority.HIGH,
      });

      logger.info('Scheduled immediate adherence check', {
        workplaceId: workplaceId.toString(),
        patientCount: patientIds?.length || 'all',
        conditionTypes: conditionTypes?.join(', ') || 'all',
      });
    } catch (error) {
      logger.error('Failed to schedule immediate adherence check:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Cancel weekly adherence check for a workplace
   */
  async cancelWeeklyAdherenceCheck(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      const repeatableJobs = await queue.getRepeatableJobs();
      const jobToRemove = repeatableJobs.find(
        (job) => job.id === `weekly-adherence-check-${workplaceId.toString()}`
      );

      if (jobToRemove) {
        await queue.removeRepeatableByKey(jobToRemove.key);
        logger.info('Cancelled weekly adherence check', {
          workplaceId: workplaceId.toString(),
        });
      } else {
        logger.warn('Weekly adherence check job not found', {
          workplaceId: workplaceId.toString(),
        });
      }
    } catch (error) {
      logger.error('Failed to cancel weekly adherence check:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get statistics about adherence check jobs
   */
  async getStatistics(workplaceId: mongoose.Types.ObjectId): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      logger.error('Failed to get adherence check statistics:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get pending adherence check jobs for a workplace
   */
  async getPendingJobs(workplaceId: mongoose.Types.ObjectId): Promise<any[]> {
    try {
      const queue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
      if (!queue) {
        throw new Error('Adherence check queue not initialized');
      }

      const jobs = await queue.getJobs(['waiting', 'active', 'delayed']);
      
      // Filter by workplace
      const workplaceJobs = jobs.filter(
        (job) => job.data.workplaceId === workplaceId.toString()
      );

      return workplaceJobs.map((job) => ({
        id: job.id,
        data: job.data,
        state: job.getState(),
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      }));
    } catch (error) {
      logger.error('Failed to get pending adherence check jobs:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const adherenceCheckScheduler = new AdherenceCheckScheduler();
export default adherenceCheckScheduler;
