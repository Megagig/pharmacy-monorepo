/**
 * Appointment Status Monitor Job Processor
 * Monitors appointment statuses and handles automatic updates
 * 
 * Features:
 * - 15-minute interval job to check appointment statuses
 * - Automatic status updates (scheduled → in_progress)
 * - No-show detection and alerts
 * - Tracks status transitions
 * 
 * Requirements: 1.4, 1.6, 4.1, 4.2
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import { AppointmentStatusJobData } from '../config/queue';
import Appointment, { IAppointment } from '../models/Appointment';
import User from '../models/User';
import Notification from '../models/Notification';
import logger from '../utils/logger';

/**
 * Appointment status monitoring result
 */
export interface AppointmentStatusMonitorResult {
  workplaceId: string;
  totalChecked: number;
  statusUpdated: number;
  noShowsDetected: number;
  alertsSent: number;
  errors: number;
  processingTime: number;
  details: {
    updatedToInProgress: string[];
    markedAsNoShow: string[];
    statusTransitions: Array<{
      appointmentId: string;
      fromStatus: string;
      toStatus: string;
      reason: string;
    }>;
  };
}

/**
 * Time thresholds for status monitoring (in minutes)
 */
const STATUS_THRESHOLDS = {
  IN_PROGRESS_GRACE_PERIOD: 5, // Start appointment if within 5 minutes of scheduled time
  NO_SHOW_THRESHOLD: 15, // Mark as no-show if 15 minutes past scheduled time and not started
  COMPLETION_REMINDER: 30, // Send reminder if appointment is in progress for more than scheduled duration + 30 min
};

/**
 * Process appointment status monitor job
 * 
 * This is the main processor that monitors appointment statuses and handles automatic updates.
 * It runs every 15 minutes to check for appointments that need status updates.
 */
export async function processAppointmentStatusMonitor(
  job: Job<AppointmentStatusJobData>
): Promise<AppointmentStatusMonitorResult> {
  const startTime = Date.now();
  const { workplaceId, checkNoShows, autoUpdateStatus } = job.data;

  logger.info('Processing appointment status monitor job', {
    jobId: job.id,
    workplaceId,
    checkNoShows,
    autoUpdateStatus,
    attemptNumber: job.attemptsMade + 1,
  });

  const result: AppointmentStatusMonitorResult = {
    workplaceId,
    totalChecked: 0,
    statusUpdated: 0,
    noShowsDetected: 0,
    alertsSent: 0,
    errors: 0,
    processingTime: 0,
    details: {
      updatedToInProgress: [],
      markedAsNoShow: [],
      statusTransitions: [],
    },
  };

  try {
    await job.progress(10);

    // Get current time
    const now = new Date();
    const nowTime = now.getTime();

    // Find appointments that might need status updates
    // Look for appointments scheduled for today or yesterday that are still in scheduled/confirmed status
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      scheduledDate: { $gte: yesterday, $lte: tomorrow },
      status: { $in: ['scheduled', 'confirmed', 'in_progress'] },
      isDeleted: false,
    })
      .populate('patientId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    result.totalChecked = appointments.length;

    logger.debug(`Found ${appointments.length} appointments to check`, {
      jobId: job.id,
      workplaceId,
      dateRange: { from: yesterday, to: tomorrow },
    });

    await job.progress(30);

    if (appointments.length === 0) {
      logger.info('No appointments to check', {
        jobId: job.id,
        workplaceId,
      });
      result.processingTime = Date.now() - startTime;
      return result;
    }

    // Process each appointment
    for (const appointment of appointments) {
      try {
        // Calculate appointment datetime
        const appointmentDateTime = calculateAppointmentDateTime(
          appointment.scheduledDate,
          appointment.scheduledTime
        );

        if (!appointmentDateTime) {
          logger.warn('Invalid appointment datetime', {
            appointmentId: appointment._id.toString(),
            scheduledDate: appointment.scheduledDate,
            scheduledTime: appointment.scheduledTime,
          });
          result.errors++;
          continue;
        }

        const appointmentTime = appointmentDateTime.getTime();
        const minutesSinceScheduled = (nowTime - appointmentTime) / (1000 * 60);
        const endDateTime = new Date(appointmentTime + appointment.duration * 60000);
        const minutesSinceEnd = (nowTime - endDateTime.getTime()) / (1000 * 60);

        // Check if appointment should be marked as in_progress
        if (
          autoUpdateStatus &&
          (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
          minutesSinceScheduled >= -STATUS_THRESHOLDS.IN_PROGRESS_GRACE_PERIOD &&
          minutesSinceScheduled <= STATUS_THRESHOLDS.NO_SHOW_THRESHOLD
        ) {
          await updateAppointmentToInProgress(appointment, workplaceId);
          result.statusUpdated++;
          result.details.updatedToInProgress.push(appointment._id.toString());
          result.details.statusTransitions.push({
            appointmentId: appointment._id.toString(),
            fromStatus: appointment.status,
            toStatus: 'in_progress',
            reason: 'Automatic status update - appointment time reached',
          });

          logger.info('Updated appointment to in_progress', {
            appointmentId: appointment._id.toString(),
            patientName: `${(appointment.patientId as any)?.firstName} ${(appointment.patientId as any)?.lastName}`,
            scheduledTime: appointment.scheduledTime,
          });
        }

        // Check if appointment should be marked as no-show
        if (
          checkNoShows &&
          (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
          minutesSinceScheduled > STATUS_THRESHOLDS.NO_SHOW_THRESHOLD
        ) {
          await markAppointmentAsNoShow(appointment, workplaceId);
          result.noShowsDetected++;
          result.details.markedAsNoShow.push(appointment._id.toString());
          result.details.statusTransitions.push({
            appointmentId: appointment._id.toString(),
            fromStatus: appointment.status,
            toStatus: 'no_show',
            reason: `Patient did not show up - ${Math.floor(minutesSinceScheduled)} minutes past scheduled time`,
          });

          // Send alert to pharmacist
          const alertSent = await sendNoShowAlert(appointment, workplaceId);
          if (alertSent) {
            result.alertsSent++;
          }

          logger.info('Marked appointment as no-show', {
            appointmentId: appointment._id.toString(),
            patientName: `${(appointment.patientId as any)?.firstName} ${(appointment.patientId as any)?.lastName}`,
            minutesPastScheduled: Math.floor(minutesSinceScheduled),
          });
        }

        // Check if in_progress appointment is running overtime
        if (
          appointment.status === 'in_progress' &&
          minutesSinceEnd > STATUS_THRESHOLDS.COMPLETION_REMINDER
        ) {
          const alertSent = await sendOvertimeAlert(appointment, workplaceId, Math.floor(minutesSinceEnd));
          if (alertSent) {
            result.alertsSent++;
          }

          logger.info('Sent overtime alert for in-progress appointment', {
            appointmentId: appointment._id.toString(),
            minutesOvertime: Math.floor(minutesSinceEnd),
          });
        }
      } catch (error) {
        result.errors++;
        logger.error('Error processing appointment status', {
          jobId: job.id,
          appointmentId: appointment._id.toString(),
          error: (error as Error).message,
        });
      }
    }

    await job.progress(90);

    result.processingTime = Date.now() - startTime;

    logger.info('Appointment status monitor job completed successfully', {
      jobId: job.id,
      workplaceId,
      totalChecked: result.totalChecked,
      statusUpdated: result.statusUpdated,
      noShowsDetected: result.noShowsDetected,
      alertsSent: result.alertsSent,
      errors: result.errors,
      processingTime: `${result.processingTime}ms`,
    });

    await job.progress(100);

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Failed to process appointment status monitor job:', {
      jobId: job.id,
      workplaceId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      attemptsMade: job.attemptsMade,
      processingTime: `${processingTime}ms`,
    });

    throw error;
  }
}

/**
 * Calculate appointment datetime from date and time strings
 */
function calculateAppointmentDateTime(scheduledDate: Date, scheduledTime: string): Date | null {
  try {
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    const dateTime = new Date(scheduledDate);
    dateTime.setHours(hours, minutes, 0, 0);

    return dateTime;
  } catch (error) {
    logger.error('Error calculating appointment datetime', {
      scheduledDate,
      scheduledTime,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Update appointment status to in_progress
 */
async function updateAppointmentToInProgress(
  appointment: IAppointment,
  workplaceId: string
): Promise<void> {
  try {
    await Appointment.findByIdAndUpdate(
      appointment._id,
      {
        status: 'in_progress',
        updatedBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
      },
      { new: true }
    );

    logger.debug('Updated appointment status to in_progress', {
      appointmentId: appointment._id.toString(),
      workplaceId,
    });
  } catch (error) {
    logger.error('Error updating appointment to in_progress', {
      appointmentId: appointment._id.toString(),
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Mark appointment as no-show
 */
async function markAppointmentAsNoShow(
  appointment: IAppointment,
  workplaceId: string
): Promise<void> {
  try {
    await Appointment.findByIdAndUpdate(
      appointment._id,
      {
        status: 'no_show',
        updatedBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
      },
      { new: true }
    );

    logger.debug('Marked appointment as no-show', {
      appointmentId: appointment._id.toString(),
      workplaceId,
    });
  } catch (error) {
    logger.error('Error marking appointment as no-show', {
      appointmentId: appointment._id.toString(),
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Send no-show alert to pharmacist
 */
async function sendNoShowAlert(
  appointment: IAppointment,
  workplaceId: string
): Promise<boolean> {
  try {
    const patient = appointment.patientId as any;
    const pharmacist = appointment.assignedTo as any;

    if (!pharmacist || !pharmacist._id) {
      logger.warn('Cannot send no-show alert - pharmacist not found', {
        appointmentId: appointment._id.toString(),
      });
      return false;
    }

    // Create notification
    const notification = new Notification({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId: pharmacist._id,
      type: 'appointment_no_show',
      title: `Patient No-Show: ${appointment.title}`,
      message: `${patient?.firstName || 'Patient'} ${patient?.lastName || ''} did not show up for their ${appointment.type.replace(/_/g, ' ')} appointment scheduled at ${appointment.scheduledTime}. Consider following up with the patient.`,
      priority: 'medium',
      category: 'appointment',
      data: {
        appointmentId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        appointmentType: appointment.type,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        status: 'no_show',
      },
      channels: ['push', 'email'],
      read: false,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
    });

    await notification.save();

    logger.info('Sent no-show alert to pharmacist', {
      appointmentId: appointment._id.toString(),
      pharmacistId: pharmacist._id.toString(),
    });

    return true;
  } catch (error) {
    logger.error('Error sending no-show alert', {
      appointmentId: appointment._id.toString(),
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Send overtime alert for in-progress appointment
 */
async function sendOvertimeAlert(
  appointment: IAppointment,
  workplaceId: string,
  minutesOvertime: number
): Promise<boolean> {
  try {
    const pharmacist = appointment.assignedTo as any;

    if (!pharmacist || !pharmacist._id) {
      logger.warn('Cannot send overtime alert - pharmacist not found', {
        appointmentId: appointment._id.toString(),
      });
      return false;
    }

    // Check if alert was already sent recently (within last hour)
    const recentAlert = await Notification.findOne({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId: pharmacist._id,
      'data.appointmentId': appointment._id.toString(),
      type: 'appointment_overtime',
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });

    if (recentAlert) {
      logger.debug('Skipping overtime alert - alert sent recently', {
        appointmentId: appointment._id.toString(),
      });
      return false;
    }

    // Create notification
    const notification = new Notification({
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      userId: pharmacist._id,
      type: 'appointment_overtime',
      title: `Appointment Running Overtime`,
      message: `The appointment "${appointment.title}" has been in progress for ${minutesOvertime} minutes past its scheduled duration. Consider completing or extending the appointment.`,
      priority: 'low',
      category: 'appointment',
      data: {
        appointmentId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        appointmentType: appointment.type,
        scheduledDuration: appointment.duration,
        minutesOvertime,
      },
      channels: ['push'],
      read: false,
      createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
    });

    await notification.save();

    logger.info('Sent overtime alert to pharmacist', {
      appointmentId: appointment._id.toString(),
      pharmacistId: pharmacist._id.toString(),
      minutesOvertime,
    });

    return true;
  } catch (error) {
    logger.error('Error sending overtime alert', {
      appointmentId: appointment._id.toString(),
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Handle job completion
 */
export function onAppointmentStatusMonitorCompleted(
  job: Job<AppointmentStatusJobData>,
  result: AppointmentStatusMonitorResult
): void {
  const duration = job.processedOn ? Date.now() - job.processedOn : 0;

  logger.info('Appointment status monitor job completed successfully', {
    jobId: job.id,
    workplaceId: job.data.workplaceId,
    duration: `${duration}ms`,
    processingTime: `${result.processingTime}ms`,
    totalChecked: result.totalChecked,
    statusUpdated: result.statusUpdated,
    noShowsDetected: result.noShowsDetected,
    alertsSent: result.alertsSent,
    errors: result.errors,
  });

  // Log warnings if there were issues
  if (result.errors > 0) {
    logger.warn('Appointment status monitor completed with errors', {
      jobId: job.id,
      errors: result.errors,
      totalChecked: result.totalChecked,
    });
  }

  if (result.noShowsDetected > 0) {
    logger.info('No-shows detected in this run', {
      jobId: job.id,
      noShowsDetected: result.noShowsDetected,
      appointmentIds: result.details.markedAsNoShow,
    });
  }
}

/**
 * Handle job failure
 */
export async function onAppointmentStatusMonitorFailed(
  job: Job<AppointmentStatusJobData>,
  error: Error
): Promise<void> {
  const { workplaceId } = job.data;
  const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;

  logger.error('Appointment status monitor job failed', {
    jobId: job.id,
    workplaceId,
    error: error.message,
    stack: error.stack,
    attemptsMade: job.attemptsMade,
    attemptsLeft,
    willRetry: attemptsLeft > 0,
  });

  // If all retries exhausted, send critical alert
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    logger.error('Appointment status monitor job exhausted all retries - CRITICAL', {
      jobId: job.id,
      workplaceId,
      totalAttempts: job.attemptsMade,
      finalError: error.message,
    });

    // Send alert to system administrators
    try {
      const admins = await User.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        role: { $in: ['admin', 'super_admin'] },
        isActive: true,
        isDeleted: false,
      });

      if (admins.length > 0) {
        const notifications = admins.map(admin => ({
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          userId: admin._id,
          type: 'system_alert',
          title: 'CRITICAL: Appointment Status Monitor Failed',
          message: `The appointment status monitoring system has failed after ${job.attemptsMade} attempts. Appointments may not be automatically updated. Technical support required.`,
          priority: 'high',
          category: 'system',
          data: {
            jobId: job.id,
            error: error.message,
            attempts: job.attemptsMade,
          },
          channels: ['push', 'email'],
          read: false,
          createdBy: new mongoose.Types.ObjectId('000000000000000000000000'),
        }));

        await Notification.insertMany(notifications);

        logger.info('Sent critical failure alerts to admins', {
          jobId: job.id,
          adminsNotified: admins.length,
        });
      }
    } catch (alertError) {
      logger.error('Failed to send critical failure alerts', {
        jobId: job.id,
        error: (alertError as Error).message,
      });
    }
  }
}

export default {
  processAppointmentStatusMonitor,
  onAppointmentStatusMonitorCompleted,
  onAppointmentStatusMonitorFailed,
};
