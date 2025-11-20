/**
 * Medication Reminder Scheduler Service
 * Schedules and manages medication refill and adherence reminder jobs
 * 
 * Features:
 * - Schedule daily job to check for medications needing refills
 * - Schedule adherence check reminders
 * - Integrate with existing Medication model
 * - Respect patient notification preferences
 * 
 * Requirements: 2.3, 2.4, 2.5, 3.1, 7.1
 */

import mongoose from 'mongoose';
import QueueService from './QueueService';
import { QueueName, MedicationReminderJobData, JobPriority } from '../config/queue';
import logger from '../utils/logger';

class MedicationReminderScheduler {
  /**
   * Schedule daily job to check for medications needing refills
   * This job runs once per day for each workplace
   */
  async scheduleDailyRefillCheck(workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const jobData: MedicationReminderJobData = {
        workplaceId: workplaceId.toString(),
        patientId: '',
        medicationId: '',
        reminderType: 'refill',
      };

      // Schedule job to run daily at 9 AM
      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      await queue.add(jobData, {
        repeat: {
          cron: '0 9 * * *', // 9 AM every day
          tz: 'Africa/Lagos', // Adjust timezone as needed
        },
        jobId: `daily-refill-check-${workplaceId.toString()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled daily refill check job', {
        workplaceId: workplaceId.toString(),
        schedule: '9 AM daily',
      });
    } catch (error) {
      logger.error('Failed to schedule daily refill check:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule refill reminder for a specific medication
   */
  async scheduleRefillReminder(
    medicationId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    daysUntilDue: number = 7
  ): Promise<void> {
    try {
      const jobData: MedicationReminderJobData = {
        workplaceId: workplaceId.toString(),
        patientId: patientId.toString(),
        medicationId: medicationId.toString(),
        reminderType: 'refill',
        daysUntilDue,
      };

      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      // Calculate delay based on days until due
      const delay = Math.max(0, (daysUntilDue - 7) * 24 * 60 * 60 * 1000);

      await queue.add(jobData, {
        delay,
        jobId: `refill-reminder-${medicationId.toString()}-${Date.now()}`,
        priority: daysUntilDue <= 3 ? JobPriority.HIGH : JobPriority.NORMAL,
      });

      logger.info('Scheduled refill reminder', {
        medicationId: medicationId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        daysUntilDue,
        delayMs: delay,
      });
    } catch (error) {
      logger.error('Failed to schedule refill reminder:', {
        medicationId: medicationId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule adherence check reminder for a specific medication
   */
  async scheduleAdherenceCheck(
    medicationId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    intervalDays: number = 7
  ): Promise<void> {
    try {
      const jobData: MedicationReminderJobData = {
        workplaceId: workplaceId.toString(),
        patientId: patientId.toString(),
        medicationId: medicationId.toString(),
        reminderType: 'adherence',
      };

      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      await queue.add(jobData, {
        repeat: {
          every: intervalDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
        },
        jobId: `adherence-check-${medicationId.toString()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled adherence check reminder', {
        medicationId: medicationId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        intervalDays,
      });
    } catch (error) {
      logger.error('Failed to schedule adherence check:', {
        medicationId: medicationId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Schedule adherence checks for all active medications of a patient
   */
  async schedulePatientAdherenceChecks(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const jobData: MedicationReminderJobData = {
        workplaceId: workplaceId.toString(),
        patientId: patientId.toString(),
        medicationId: '',
        reminderType: 'adherence',
      };

      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      await queue.add(jobData, {
        repeat: {
          cron: '0 10 * * 1', // 10 AM every Monday
          tz: 'Africa/Lagos',
        },
        jobId: `patient-adherence-check-${patientId.toString()}`,
        priority: JobPriority.NORMAL,
      });

      logger.info('Scheduled patient adherence checks', {
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        schedule: '10 AM every Monday',
      });
    } catch (error) {
      logger.error('Failed to schedule patient adherence checks:', {
        patientId: patientId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Cancel refill reminder for a medication
   */
  async cancelRefillReminder(medicationId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      // Remove repeatable job
      const repeatableJobs = await queue.getRepeatableJobs();
      const jobToRemove = repeatableJobs.find(
        (job) => job.id === `refill-reminder-${medicationId.toString()}`
      );

      if (jobToRemove) {
        await queue.removeRepeatableByKey(jobToRemove.key);
        logger.info('Cancelled refill reminder', {
          medicationId: medicationId.toString(),
        });
      }

      // Also remove any pending jobs
      const jobs = await queue.getJobs(['waiting', 'delayed']);
      for (const job of jobs) {
        if (job.data.medicationId === medicationId.toString()) {
          await job.remove();
          logger.info('Removed pending refill reminder job', {
            jobId: job.id,
            medicationId: medicationId.toString(),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cancel refill reminder:', {
        medicationId: medicationId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Cancel adherence check for a medication
   */
  async cancelAdherenceCheck(medicationId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
      }

      const repeatableJobs = await queue.getRepeatableJobs();
      const jobToRemove = repeatableJobs.find(
        (job) => job.id === `adherence-check-${medicationId.toString()}`
      );

      if (jobToRemove) {
        await queue.removeRepeatableByKey(jobToRemove.key);
        logger.info('Cancelled adherence check', {
          medicationId: medicationId.toString(),
        });
      }
    } catch (error) {
      logger.error('Failed to cancel adherence check:', {
        medicationId: medicationId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get statistics about medication reminder jobs
   */
  async getStatistics(workplaceId: mongoose.Types.ObjectId): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const queue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
      if (!queue) {
        throw new Error('Medication reminder queue not initialized');
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
      logger.error('Failed to get medication reminder statistics:', {
        workplaceId: workplaceId.toString(),
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const medicationReminderScheduler = new MedicationReminderScheduler();
export default medicationReminderScheduler;
