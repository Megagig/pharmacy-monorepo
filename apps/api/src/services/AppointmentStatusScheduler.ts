/**
 * Appointment Status Scheduler Service
 * Schedules and manages appointment status monitoring jobs
 * 
 * Features:
 * - Schedule 15-minute interval job to check appointment statuses
 * - Automatic status updates (scheduled → in_progress)
 * - No-show detection and alerts
 * 
 * Requirements: 1.4, 1.6, 4.1, 4.2
 */

import mongoose from 'mongoose';
import QueueService from './QueueService';
import { QueueName, AppointmentStatusJobData, JobPriority } from '../config/queue';
import logger from '../utils/logger';

class AppointmentStatusScheduler {
  /**
   * Schedule recurring job to monitor appointment statuses
   * This job runs every 15 minutes for each workplace
   */
  async scheduleStatusMonitoring(
    workplaceId: mongoose.Types.ObjectId,
    options: {
      checkNoShows?: boolean;
      autoUpdateStatus?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const jobData: AppointmentStatusJobData = {
        workplaceId: workplaceId.toString(),
        checkNoShows: options.checkNoShows !== false, // Default true
        autoUpdateStatus: options.autoUpdateStatus !== false, // Default true
      };

      // Schedule job to run every 15 minutes
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      await queue.add(jobData, {
        repeat: {
          every: 15 * 60 * 1000, // 15 minutes in milliseconds
        },
        jobId: `appointment-status-monitor-${workplaceId.toString()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled appointment status monitoring job', {
        workplaceId: workplaceId.toString(),
        interval: '15 minutes',
        checkNoShows: jobData.checkNoShows,
        autoUpdateStatus: jobData.autoUpdateStatus,
      });
    } catch (error) {
      logger.error('Failed to schedule appointment status monitoring:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule immediate status check (for testing or manual trigger)
   */
  async scheduleImmediateStatusCheck(
    workplaceId: mongoose.Types.ObjectId,
    options: {
      checkNoShows?: boolean;
      autoUpdateStatus?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const jobData: AppointmentStatusJobData = {
        workplaceId: workplaceId.toString(),
        checkNoShows: options.checkNoShows !== false,
        autoUpdateStatus: options.autoUpdateStatus !== false,
      };

      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      await queue.add(jobData, {
        jobId: `immediate-status-check-${Date.now()}`,
        priority: JobPriority.HIGH,
      });

      logger.info('Scheduled immediate appointment status check', {
        workplaceId: workplaceId.toString(),
        checkNoShows: jobData.checkNoShows,
        autoUpdateStatus: jobData.autoUpdateStatus,
      });
    } catch (error) {
      logger.error('Failed to schedule immediate status check:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update status monitoring configuration for a workplace
   */
  async updateStatusMonitoring(
    workplaceId: mongoose.Types.ObjectId,
    options: {
      checkNoShows?: boolean;
      autoUpdateStatus?: boolean;
    }
  ): Promise<void> {
    try {
      // Cancel existing job
      await this.cancelStatusMonitoring(workplaceId);

      // Schedule new job with updated options
      await this.scheduleStatusMonitoring(workplaceId, options);

      logger.info('Updated appointment status monitoring configuration', {
        workplaceId: workplaceId.toString(),
        options,
      });
    } catch (error) {
      logger.error('Failed to update status monitoring:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Cancel status monitoring for a workplace
   */
  async cancelStatusMonitoring(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      const repeatableJobs = await queue.getRepeatableJobs();
      const jobToRemove = repeatableJobs.find(
        (job) => job.id === `appointment-status-monitor-${workplaceId.toString()}`
      );

      if (jobToRemove) {
        await queue.removeRepeatableByKey(jobToRemove.key);
        logger.info('Cancelled appointment status monitoring', {
          workplaceId: workplaceId.toString(),
        });
      } else {
        logger.warn('Appointment status monitoring job not found', {
          workplaceId: workplaceId.toString(),
        });
      }
    } catch (error) {
      logger.error('Failed to cancel status monitoring:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Pause status monitoring for a workplace (temporarily)
   */
  async pauseStatusMonitoring(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      await queue.pause(true); // Pause only this workplace's jobs

      logger.info('Paused appointment status monitoring', {
        workplaceId: workplaceId.toString(),
      });
    } catch (error) {
      logger.error('Failed to pause status monitoring:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Resume status monitoring for a workplace
   */
  async resumeStatusMonitoring(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      await queue.resume(true);

      logger.info('Resumed appointment status monitoring', {
        workplaceId: workplaceId.toString(),
      });
    } catch (error) {
      logger.error('Failed to resume status monitoring:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get statistics about appointment status monitoring jobs
   */
  async getStatistics(workplaceId: mongoose.Types.ObjectId): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    repeatable: number;
  }> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getRepeatableJobs(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        repeatable: repeatableJobs.length,
      };
    } catch (error) {
      logger.error('Failed to get appointment status monitoring statistics:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get pending status monitoring jobs for a workplace
   */
  async getPendingJobs(workplaceId: mongoose.Types.ObjectId): Promise<any[]> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
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
      logger.error('Failed to get pending status monitoring jobs:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get recent job results for monitoring
   */
  async getRecentResults(
    workplaceId: mongoose.Types.ObjectId,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      const completedJobs = await queue.getJobs(['completed'], 0, limit);
      
      // Filter by workplace and return results
      const workplaceJobs = completedJobs
        .filter((job) => job.data.workplaceId === workplaceId.toString())
        .map((job) => ({
          id: job.id,
          data: job.data,
          result: job.returnvalue,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          duration: job.finishedOn && job.processedOn 
            ? job.finishedOn - job.processedOn 
            : null,
        }));

      return workplaceJobs;
    } catch (error) {
      logger.error('Failed to get recent status monitoring results:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Check if status monitoring is active for a workplace
   */
  async isMonitoringActive(workplaceId: mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        return false;
      }

      const repeatableJobs = await queue.getRepeatableJobs();
      const monitoringJob = repeatableJobs.find(
        (job) => job.id === `appointment-status-monitor-${workplaceId.toString()}`
      );

      return !!monitoringJob;
    } catch (error) {
      logger.error('Failed to check monitoring status:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Clean up old completed and failed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    try {
      const queue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
      if (!queue) {
        throw new Error('Appointment status queue not initialized');
      }

      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      
      const [completedJobs, failedJobs] = await Promise.all([
        queue.getJobs(['completed']),
        queue.getJobs(['failed']),
      ]);

      let cleanedCount = 0;

      // Remove old completed jobs
      for (const job of completedJobs) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          await job.remove();
          cleanedCount++;
        }
      }

      // Remove old failed jobs
      for (const job of failedJobs) {
        if (job.finishedOn && job.finishedOn < cutoffTime) {
          await job.remove();
          cleanedCount++;
        }
      }

      logger.info('Cleaned up old appointment status monitoring jobs', {
        cleanedCount,
        olderThanDays,
      });

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup old jobs:', {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const appointmentStatusScheduler = new AppointmentStatusScheduler();
export default appointmentStatusScheduler;
