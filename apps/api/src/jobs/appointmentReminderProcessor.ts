/**
 * Appointment Reminder Job Processor
 * Processes appointment reminder jobs from the queue
 * 
 * Features:
 * - Processes 24h, 2h, and 15min reminder jobs
 * - Personalizes reminders with patient data
 * - Tracks delivery status
 * - Implements retry logic for failed deliveries
 * - Handles partial delivery failures gracefully
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import { AppointmentReminderJobData } from '../config/queue';
import { reminderSchedulerService } from '../services/ReminderSchedulerService';
import Appointment from '../models/Appointment';
import logger from '../utils/logger';

/**
 * Reminder processing result
 */
export interface ReminderProcessingResult {
  appointmentId: string;
  reminderType: string;
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  deliveryResults: Array<{
    channel: string;
    success: boolean;
    error?: string;
  }>;
  processingTime: number;
}

/**
 * Process appointment reminder job
 * 
 * This is the main processor that handles reminder delivery through multiple channels.
 * It includes:
 * - Progress tracking for monitoring
 * - Personalized reminder content based on patient data
 * - Delivery status tracking
 * - Partial failure handling
 * - Automatic retry via Bull's retry mechanism
 */
export async function processAppointmentReminder(
  job: Job<AppointmentReminderJobData>
): Promise<ReminderProcessingResult> {
  const startTime = Date.now();
  const { appointmentId, patientId, workplaceId, reminderType, channels } = job.data;

  logger.info(`Processing ${reminderType} reminder for appointment ${appointmentId}`, {
    jobId: job.id,
    patientId,
    workplaceId,
    channels,
    attemptNumber: job.attemptsMade + 1,
  });

  try {
    // Update job progress - validation phase
    await job.progress(10);

    // Validate appointment still exists and is in correct state
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      logger.warn(`Appointment ${appointmentId} not found, skipping reminder`, {
        jobId: job.id,
      });
      return createSkippedResult(appointmentId, reminderType, 'Appointment not found');
    }

    // Check if appointment is still in a state that requires reminders
    if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
      logger.info(`Appointment ${appointmentId} is ${appointment.status}, skipping reminder`, {
        jobId: job.id,
      });
      return createSkippedResult(appointmentId, reminderType, `Appointment ${appointment.status}`);
    }

    // Check if appointment time has passed
    const appointmentDateTime = appointment.get('appointmentDateTime') as Date;
    if (appointmentDateTime && appointmentDateTime < new Date()) {
      logger.warn(`Appointment ${appointmentId} time has passed, skipping reminder`, {
        jobId: job.id,
      });
      return createSkippedResult(appointmentId, reminderType, 'Appointment time passed');
    }

    await job.progress(30);

    // Send reminder through specified channels with personalized content
    logger.debug(`Sending ${reminderType} reminder through channels: ${channels.join(', ')}`, {
      jobId: job.id,
      appointmentId,
    });

    const result = await reminderSchedulerService.sendReminder(
      new mongoose.Types.ObjectId(appointmentId),
      reminderType,
      channels
    );

    await job.progress(80);

    // Analyze delivery results
    const successfulChannels = result.deliveryResults.filter((r) => r.success).length;
    const failedChannels = result.deliveryResults.filter((r) => !r.success);
    const allSuccessful = result.deliveryResults.every((r) => r.success);

    // Log delivery status
    if (!allSuccessful) {
      logger.warn(`Partial delivery failure for appointment ${appointmentId}`, {
        jobId: job.id,
        reminderType,
        successfulChannels,
        failedChannels: failedChannels.map((f) => ({
          channel: f.channel,
          error: f.error,
        })),
      });

      // If all channels failed, throw error to trigger retry
      if (successfulChannels === 0) {
        const errorMsg = `All channels failed for ${reminderType} reminder`;
        logger.error(errorMsg, {
          jobId: job.id,
          appointmentId,
          failures: failedChannels,
        });
        throw new Error(errorMsg);
      }
    }

    await job.progress(100);

    const processingTime = Date.now() - startTime;

    logger.info(`Successfully processed ${reminderType} reminder for appointment ${appointmentId}`, {
      jobId: job.id,
      successfulChannels,
      totalChannels: channels.length,
      processingTime: `${processingTime}ms`,
      deliveryResults: result.deliveryResults,
    });

    return {
      appointmentId: appointmentId.toString(),
      reminderType,
      totalChannels: channels.length,
      successfulChannels,
      failedChannels: failedChannels.length,
      deliveryResults: result.deliveryResults,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error(`Failed to process ${reminderType} reminder for appointment ${appointmentId}:`, {
      jobId: job.id,
      error: (error as Error).message,
      stack: (error as Error).stack,
      attemptsMade: job.attemptsMade,
      processingTime: `${processingTime}ms`,
    });

    // Re-throw to trigger Bull's retry mechanism with exponential backoff
    throw error;
  }
}

/**
 * Create a result object for skipped reminders
 */
function createSkippedResult(
  appointmentId: string,
  reminderType: string,
  reason: string
): ReminderProcessingResult {
  return {
    appointmentId,
    reminderType,
    totalChannels: 0,
    successfulChannels: 0,
    failedChannels: 0,
    deliveryResults: [],
    processingTime: 0,
  };
}

/**
 * Handle job completion
 * 
 * Called when a reminder job completes successfully.
 * Logs completion metrics and updates statistics.
 */
export function onAppointmentReminderCompleted(
  job: Job<AppointmentReminderJobData>,
  result: ReminderProcessingResult
): void {
  const duration = job.processedOn ? Date.now() - job.processedOn : 0;
  
  logger.info(`Appointment reminder job completed successfully`, {
    jobId: job.id,
    appointmentId: job.data.appointmentId,
    reminderType: job.data.reminderType,
    duration: `${duration}ms`,
    processingTime: `${result.processingTime}ms`,
    successfulChannels: result.successfulChannels,
    totalChannels: result.totalChannels,
    deliveryRate: result.totalChannels > 0 
      ? `${((result.successfulChannels / result.totalChannels) * 100).toFixed(1)}%`
      : 'N/A',
  });

  // Track metrics for monitoring
  if (result.failedChannels > 0) {
    logger.warn(`Reminder delivered with partial failures`, {
      jobId: job.id,
      appointmentId: job.data.appointmentId,
      failedChannels: result.failedChannels,
      failedDeliveries: result.deliveryResults.filter((r) => !r.success),
    });
  }
}

/**
 * Handle job failure
 * 
 * Called when a reminder job fails after all retries.
 * Implements escalation logic for critical failures.
 */
export async function onAppointmentReminderFailed(
  job: Job<AppointmentReminderJobData>,
  error: Error
): Promise<void> {
  const { appointmentId, reminderType, patientId, workplaceId } = job.data;
  const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;

  logger.error(`Appointment reminder job failed`, {
    jobId: job.id,
    appointmentId,
    reminderType,
    patientId,
    workplaceId,
    error: error.message,
    stack: error.stack,
    attemptsMade: job.attemptsMade,
    attemptsLeft,
    willRetry: attemptsLeft > 0,
  });

  // If all retries exhausted, take escalation actions
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    logger.error(`Appointment reminder job exhausted all retries - CRITICAL`, {
      jobId: job.id,
      appointmentId,
      reminderType,
      patientId,
      workplaceId,
      totalAttempts: job.attemptsMade,
      finalError: error.message,
    });

    // Mark reminder as permanently failed in appointment
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (appointment) {
        const reminder = appointment.reminders.find(
          (r) => !r.sent && new Date(r.scheduledFor) <= new Date()
        );
        
        if (reminder) {
          reminder.sent = true;
          reminder.sentAt = new Date();
          reminder.deliveryStatus = 'failed';
          reminder.failureReason = `Failed after ${job.attemptsMade} attempts: ${error.message}`;
          await appointment.save();
          
          logger.info(`Marked reminder as permanently failed in appointment ${appointmentId}`);
        }
      }
    } catch (updateError) {
      logger.error(`Failed to update appointment after reminder failure:`, {
        appointmentId,
        error: (updateError as Error).message,
      });
    }

    // TODO: Send alert to admin/manager about critical reminder failure
    // This could be implemented using the notification service:
    // - Create high-priority notification for pharmacy manager
    // - Include appointment details and failure reason
    // - Suggest manual follow-up with patient
    
    logger.warn(`TODO: Implement admin alert for failed reminder`, {
      appointmentId,
      reminderType,
      workplaceId,
    });
  } else {
    // Log retry information
    const nextRetryDelay = calculateNextRetryDelay(job.attemptsMade);
    logger.info(`Reminder job will retry`, {
      jobId: job.id,
      appointmentId,
      reminderType,
      attemptNumber: job.attemptsMade + 1,
      nextRetryIn: `${nextRetryDelay}ms`,
      attemptsLeft,
    });
  }
}

/**
 * Calculate next retry delay based on exponential backoff
 * Matches Bull's exponential backoff strategy
 */
function calculateNextRetryDelay(attemptsMade: number): number {
  const baseDelay = 1000; // 1 second base delay (from queue config)
  return baseDelay * Math.pow(2, attemptsMade);
}

export default {
  processAppointmentReminder,
  onAppointmentReminderCompleted,
  onAppointmentReminderFailed,
};
