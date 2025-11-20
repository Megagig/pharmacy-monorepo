/**
 * Reminder Scheduler Service
 * Handles scheduling and sending of appointment reminders through multiple channels
 */

import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import Patient from '../models/Patient';
import User from '../models/User';
import QueueService from './QueueService';
import { notificationService } from './notificationService';
import { appointmentNotificationService } from './AppointmentNotificationService';
import { QueueName, AppointmentReminderJobData, JobPriority } from '../config/queue';
import { sendEmail } from '../utils/email';
import { sendSMS } from '../utils/sms';
import logger from '../utils/logger';

/**
 * Reminder template interface
 */
export interface ReminderTemplate {
  subject: string;
  emailBody: string;
  smsBody: string;
  pushTitle: string;
  pushBody: string;
  whatsappBody: string;
}

/**
 * Reminder type
 */
export type ReminderType = '24h' | '2h' | '15min';

/**
 * Reminder channel
 */
export type ReminderChannel = 'email' | 'sms' | 'push' | 'whatsapp';

/**
 * Reminder scheduling result
 */
export interface ReminderSchedulingResult {
  appointmentId: string;
  remindersScheduled: number;
  scheduledReminders: Array<{
    type: ReminderType;
    scheduledFor: Date;
    channels: ReminderChannel[];
  }>;
}

/**
 * Reminder delivery result
 */
export interface ReminderDeliveryResult {
  appointmentId: string;
  reminderType: ReminderType;
  deliveryResults: Array<{
    channel: ReminderChannel;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Reminder Scheduler Service
 */
export class ReminderSchedulerService {
  private static instance: ReminderSchedulerService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ReminderSchedulerService {
    if (!ReminderSchedulerService.instance) {
      ReminderSchedulerService.instance = new ReminderSchedulerService();
    }
    return ReminderSchedulerService.instance;
  }

  /**
   * Schedule appointment reminders
   * Creates reminder jobs for 24h, 2h, and 15min before appointment
   */
  async scheduleAppointmentReminders(
    appointmentId: mongoose.Types.ObjectId,
    channels?: ReminderChannel[]
  ): Promise<ReminderSchedulingResult> {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientId', 'firstName lastName email phone notificationPreferences')
        .populate('assignedTo', 'firstName lastName');

      if (!appointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      // Don't schedule reminders for past appointments or cancelled/completed appointments
      if (
        appointment.status === 'cancelled' ||
        appointment.status === 'completed' ||
        appointment.status === 'no_show'
      ) {
        logger.info(`Skipping reminder scheduling for appointment ${appointmentId} with status ${appointment.status}`);
        return {
          appointmentId: appointmentId.toString(),
          remindersScheduled: 0,
          scheduledReminders: [],
        };
      }

      const appointmentDateTime = appointment.get('appointmentDateTime') as Date;
      if (!appointmentDateTime || appointmentDateTime < new Date()) {
        logger.warn(`Cannot schedule reminders for past appointment: ${appointmentId}`);
        return {
          appointmentId: appointmentId.toString(),
          remindersScheduled: 0,
          scheduledReminders: [],
        };
      }

      // Determine channels to use
      const reminderChannels = this.determineReminderChannels(appointment, channels);

      // Define reminder times
      const reminderTimes: Array<{ type: ReminderType; hoursBeforeAppointment: number }> = [
        { type: '24h', hoursBeforeAppointment: 24 },
        { type: '2h', hoursBeforeAppointment: 2 },
        { type: '15min', hoursBeforeAppointment: 0.25 }, // 15 minutes
      ];

      const scheduledReminders: ReminderSchedulingResult['scheduledReminders'] = [];
      let remindersScheduled = 0;

      for (const reminderTime of reminderTimes) {
        const scheduledFor = new Date(
          appointmentDateTime.getTime() - reminderTime.hoursBeforeAppointment * 60 * 60 * 1000
        );

        // Only schedule if reminder time is in the future
        if (scheduledFor > new Date()) {
          // Add reminder to appointment document
          appointment.reminders.push({
            type: reminderChannels[0], // Primary channel
            scheduledFor,
            sent: false,
            deliveryStatus: 'pending',
          });

          // Schedule job in queue
          const jobData: AppointmentReminderJobData = {
            appointmentId: appointmentId.toString(),
            patientId: appointment.patientId.toString(),
            workplaceId: appointment.workplaceId.toString(),
            reminderType: reminderTime.type,
            channels: reminderChannels,
          };

          await QueueService.scheduleJob(
            QueueName.APPOINTMENT_REMINDER,
            jobData,
            scheduledFor,
            {
              priority: this.getReminderPriority(reminderTime.type),
              jobId: `reminder-${appointmentId}-${reminderTime.type}`,
              removeOnComplete: true,
            }
          );

          scheduledReminders.push({
            type: reminderTime.type,
            scheduledFor,
            channels: reminderChannels,
          });

          remindersScheduled++;

          logger.info(`Scheduled ${reminderTime.type} reminder for appointment ${appointmentId} at ${scheduledFor}`);
        } else {
          logger.debug(`Skipping ${reminderTime.type} reminder for appointment ${appointmentId} - time has passed`);
        }
      }

      // Save appointment with updated reminders
      await appointment.save();

      logger.info(`Scheduled ${remindersScheduled} reminders for appointment ${appointmentId}`);

      return {
        appointmentId: appointmentId.toString(),
        remindersScheduled,
        scheduledReminders,
      };
    } catch (error) {
      logger.error(`Error scheduling appointment reminders for ${appointmentId}:`, error);
      throw error;
    }
  }

  /**
   * Send reminder through multiple channels using the integrated notification service
   */
  async sendReminder(
    appointmentId: mongoose.Types.ObjectId,
    reminderType: ReminderType,
    channels: ReminderChannel[]
  ): Promise<ReminderDeliveryResult> {
    try {
      // Use the integrated appointment notification service
      const result = await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        reminderType,
        {
          channels,
          includeConfirmationLink: true,
          includeRescheduleLink: true,
        }
      );

      // Convert result format to match expected interface
      const deliveryResults: ReminderDeliveryResult['deliveryResults'] = channels.map(channel => ({
        channel,
        success: result.success && result.deliveryChannels[channel as keyof typeof result.deliveryChannels],
        error: result.success ? undefined : result.error,
      }));

      // Update reminder status in appointment
      const appointment = await Appointment.findById(appointmentId);
      if (appointment) {
        const reminder = appointment.reminders.find(
          (r) => !r.sent && new Date(r.scheduledFor) <= new Date()
        );

        if (reminder) {
          reminder.sent = true;
          reminder.sentAt = new Date();
          reminder.deliveryStatus = result.success ? 'delivered' : 'failed';
          if (!result.success) {
            reminder.failureReason = result.error || 'Unknown error';
          }
          await appointment.save();
        }
      }

      logger.info(`Sent ${reminderType} reminder for appointment ${appointmentId} through integrated notification service`);

      return {
        appointmentId: appointmentId.toString(),
        reminderType,
        deliveryResults,
      };
    } catch (error) {
      logger.error(`Error sending reminder for appointment ${appointmentId}:`, error);
      throw error;
    }
  }

  /**
   * Process pending reminders
   * Background job to check and send due reminders
   */
  async processPendingReminders(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    try {
      logger.info('Processing pending reminders...');

      // Find appointments with pending reminders that are due
      const appointments = await Appointment.find({
        status: { $in: ['scheduled', 'confirmed'] },
        'reminders.sent': false,
        'reminders.scheduledFor': { $lte: new Date() },
      })
        .populate('patientId', 'firstName lastName email phone notificationPreferences')
        .populate('assignedTo', 'firstName lastName');

      let processed = 0;
      let sent = 0;
      let failed = 0;

      for (const appointment of appointments) {
        const pendingReminders = appointment.reminders.filter(
          (r) => !r.sent && new Date(r.scheduledFor) <= new Date()
        );

        for (const reminder of pendingReminders) {
          processed++;

          try {
            // Determine reminder type based on time difference
            const appointmentDateTime = appointment.get('appointmentDateTime') as Date;
            const timeDiff = appointmentDateTime.getTime() - new Date().getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            let reminderType: ReminderType;
            if (hoursDiff > 12) {
              reminderType = '24h';
            } else if (hoursDiff > 1) {
              reminderType = '2h';
            } else {
              reminderType = '15min';
            }

            // Determine channels
            const channels = this.determineReminderChannels(appointment);

            // Send reminder
            await this.sendReminder(
              appointment._id,
              reminderType,
              channels
            );

            sent++;
          } catch (error) {
            logger.error(`Failed to process reminder for appointment ${appointment._id}:`, error);
            failed++;

            // Mark as failed
            reminder.sent = true;
            reminder.sentAt = new Date();
            reminder.deliveryStatus = 'failed';
            reminder.failureReason = (error as Error).message;
          }
        }

        // Save appointment if any reminders were processed
        if (pendingReminders.length > 0) {
          await appointment.save();
        }
      }

      logger.info(`Processed ${processed} pending reminders: ${sent} sent, ${failed} failed`);

      return { processed, sent, failed };
    } catch (error) {
      logger.error('Error processing pending reminders:', error);
      throw error;
    }
  }

  /**
   * Cancel appointment reminders
   * Removes scheduled reminder jobs from queue
   */
  async cancelAppointmentReminders(
    appointmentId: mongoose.Types.ObjectId
  ): Promise<{ cancelled: number }> {
    try {
      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      let cancelled = 0;

      // Remove jobs from queue
      const reminderTypes: ReminderType[] = ['24h', '2h', '15min'];
      for (const reminderType of reminderTypes) {
        const jobId = `reminder-${appointmentId}-${reminderType}`;
        try {
          await QueueService.removeJob(QueueName.APPOINTMENT_REMINDER, jobId);
          cancelled++;
          logger.debug(`Cancelled ${reminderType} reminder job for appointment ${appointmentId}`);
        } catch (error) {
          // Job might not exist or already processed
          logger.debug(`Could not cancel ${reminderType} reminder job for appointment ${appointmentId}:`, error);
        }
      }

      // Mark unsent reminders as cancelled in appointment
      let updated = false;
      for (const reminder of appointment.reminders) {
        if (!reminder.sent) {
          reminder.deliveryStatus = 'failed';
          reminder.failureReason = 'Appointment cancelled';
          updated = true;
        }
      }

      if (updated) {
        await appointment.save();
      }

      logger.info(`Cancelled ${cancelled} reminder jobs for appointment ${appointmentId}`);

      return { cancelled };
    } catch (error) {
      logger.error(`Error cancelling reminders for appointment ${appointmentId}:`, error);
      throw error;
    }
  }

  /**
   * Reschedule reminders for a rescheduled appointment
   */
  async rescheduleReminders(
    appointmentId: mongoose.Types.ObjectId,
    newDateTime: Date
  ): Promise<ReminderSchedulingResult> {
    try {
      logger.info(`Rescheduling reminders for appointment ${appointmentId}`);

      // Cancel existing reminders
      await this.cancelAppointmentReminders(appointmentId);

      // Clear existing reminders from appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      appointment.reminders = [];
      await appointment.save();

      // Schedule new reminders
      return await this.scheduleAppointmentReminders(appointmentId);
    } catch (error) {
      logger.error(`Error rescheduling reminders for appointment ${appointmentId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Determine which channels to use for reminders based on patient preferences
   */
  private determineReminderChannels(
    appointment: IAppointment,
    requestedChannels?: ReminderChannel[]
  ): ReminderChannel[] {
    const patient = appointment.patientId as any;
    const generalPreferences = patient?.notificationPreferences || {};
    const appointmentPreferences = patient?.appointmentPreferences?.reminderPreferences || {};

    // If specific channels requested, use those (filtered by preferences)
    if (requestedChannels && requestedChannels.length > 0) {
      return requestedChannels.filter((channel) => {
        switch (channel) {
          case 'email':
            return (appointmentPreferences.email ?? generalPreferences.email ?? true) && patient.email;
          case 'sms':
            return (appointmentPreferences.sms ?? generalPreferences.sms ?? false) && patient.phone;
          case 'push':
            return (appointmentPreferences.push ?? generalPreferences.push ?? true);
          case 'whatsapp':
            return (appointmentPreferences.whatsapp ?? false) && patient.phone;
          default:
            return false;
        }
      });
    }

    // Otherwise, use patient preferences (appointment-specific first, then general)
    const channels: ReminderChannel[] = [];

    // Check appointment-specific preferences first, fall back to general preferences
    if ((appointmentPreferences.email ?? generalPreferences.email ?? true) && patient.email) {
      channels.push('email');
    }

    if ((appointmentPreferences.sms ?? generalPreferences.sms ?? false) && patient.phone) {
      channels.push('sms');
    }

    if (appointmentPreferences.push ?? generalPreferences.push ?? true) {
      channels.push('push');
    }

    if ((appointmentPreferences.whatsapp ?? false) && patient.phone) {
      channels.push('whatsapp');
    }

    // Default to email if no preferences set and email available
    if (channels.length === 0 && patient.email) {
      channels.push('email');
    }

    return channels;
  }

  /**
   * Get reminder priority based on type
   */
  private getReminderPriority(reminderType: ReminderType): number {
    switch (reminderType) {
      case '15min':
        return JobPriority.HIGH;
      case '2h':
        return JobPriority.NORMAL;
      case '24h':
        return JobPriority.LOW;
      default:
        return JobPriority.NORMAL;
    }
  }

  /**
   * Generate reminder template with personalized content
   */
  private getReminderTemplate(
    appointment: IAppointment,
    reminderType: ReminderType,
    patient: any,
    pharmacist: any
  ): ReminderTemplate {
    const appointmentDateTime = appointment.get('appointmentDateTime') as Date;
    const dateStr = appointmentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = appointment.scheduledTime;

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const pharmacistName = `${pharmacist.firstName} ${pharmacist.lastName}`;
    const appointmentType = this.formatAppointmentType(appointment.type);

    let timePrefix = '';
    switch (reminderType) {
      case '24h':
        timePrefix = 'tomorrow';
        break;
      case '2h':
        timePrefix = 'in 2 hours';
        break;
      case '15min':
        timePrefix = 'in 15 minutes';
        break;
    }

    return {
      subject: `Appointment Reminder: ${appointmentType} ${timePrefix}`,
      emailBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Appointment Reminder</h2>
          <p>Dear ${patientName},</p>
          <p>This is a reminder that you have an upcoming appointment ${timePrefix}.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Appointment Details</h3>
            <p><strong>Type:</strong> ${appointmentType}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            <p><strong>Duration:</strong> ${appointment.duration} minutes</p>
            <p><strong>Pharmacist:</strong> ${pharmacistName}</p>
          </div>
          
          ${appointment.description ? `<p><strong>Notes:</strong> ${appointment.description}</p>` : ''}
          
          <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/appointments/${appointment._id}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Appointment Details
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Thank you for choosing our pharmacy services.
          </p>
        </div>
      `,
      smsBody: `Reminder: ${appointmentType} appointment ${timePrefix} on ${dateStr} at ${timeStr} with ${pharmacistName}. Reply CANCEL to cancel.`,
      pushTitle: `Appointment ${timePrefix}`,
      pushBody: `${appointmentType} with ${pharmacistName} on ${dateStr} at ${timeStr}`,
      whatsappBody: `Hi ${patientName}! Reminder: You have a ${appointmentType} appointment ${timePrefix} on ${dateStr} at ${timeStr} with ${pharmacistName}. Duration: ${appointment.duration} min. See you soon!`,
    };
  }

  /**
   * Format appointment type for display
   */
  private formatAppointmentType(type: string): string {
    const typeMap: Record<string, string> = {
      mtm_session: 'Medication Therapy Management',
      chronic_disease_review: 'Chronic Disease Review',
      new_medication_consultation: 'New Medication Consultation',
      vaccination: 'Vaccination',
      health_check: 'Health Check',
      smoking_cessation: 'Smoking Cessation',
      general_followup: 'General Follow-up',
    };

    return typeMap[type] || type;
  }

  /**
   * Send email reminder
   */
  private async sendEmailReminder(
    patient: any,
    appointment: IAppointment,
    template: ReminderTemplate
  ): Promise<void> {
    if (!patient.email) {
      throw new Error('Patient email not available');
    }

    await sendEmail({
      to: patient.email,
      subject: template.subject,
      html: template.emailBody,
      text: template.emailBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    logger.debug(`Email reminder sent to ${patient.email} for appointment ${appointment._id}`);
  }

  /**
   * Send SMS reminder
   */
  private async sendSMSReminder(
    patient: any,
    appointment: IAppointment,
    template: ReminderTemplate
  ): Promise<void> {
    if (!patient.phone) {
      throw new Error('Patient phone number not available');
    }

    await sendSMS(patient.phone, template.smsBody);

    logger.debug(`SMS reminder sent to ${patient.phone} for appointment ${appointment._id}`);
  }

  /**
   * Send push notification reminder
   */
  private async sendPushReminder(
    patient: any,
    appointment: IAppointment,
    template: ReminderTemplate
  ): Promise<void> {
    // Use existing notification service for push notifications
    await notificationService.createNotification({
      userId: patient._id,
      type: 'appointment_reminder',
      title: template.pushTitle,
      content: template.pushBody,
      data: {
        appointmentId: appointment._id,
        actionUrl: `/appointments/${appointment._id}`,
      },
      priority: 'high',
      deliveryChannels: {
        inApp: true,
        email: false,
        sms: false,
        push: true,
      },
      workplaceId: appointment.workplaceId,
      createdBy: appointment.assignedTo,
    });

    logger.debug(`Push notification sent to patient ${patient._id} for appointment ${appointment._id}`);
  }

  /**
   * Send WhatsApp reminder
   */
  private async sendWhatsAppReminder(
    patient: any,
    appointment: IAppointment,
    template: ReminderTemplate
  ): Promise<void> {
    if (!patient.phone) {
      throw new Error('Patient phone number not available');
    }

    // For now, use SMS as WhatsApp fallback
    // TODO: Implement actual WhatsApp Business API integration
    await sendSMS(patient.phone, template.whatsappBody);

    logger.debug(`WhatsApp reminder sent to ${patient.phone} for appointment ${appointment._id}`);
  }
}

export const reminderSchedulerService = ReminderSchedulerService.getInstance();
export default reminderSchedulerService;
