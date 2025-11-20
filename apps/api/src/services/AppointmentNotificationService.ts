/**
 * Appointment Notification Service
 * Integrates appointment system with the existing notification infrastructure
 * Requirements: 7.6, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../models/Appointment';
import Patient from '../models/Patient';
import User from '../models/User';
import { notificationService, CreateNotificationData } from './notificationService';
import { INotificationData } from '../models/Notification';
import PublicAppointmentService from './PublicAppointmentService';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface AppointmentNotificationOptions {
  channels?: ('email' | 'sms' | 'push' | 'whatsapp')[];
  includeConfirmationLink?: boolean;
  includeRescheduleLink?: boolean;
  customMessage?: string;
}

export interface NotificationDeliveryResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  deliveryChannels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

/**
 * Appointment Notification Service
 * Handles all appointment-related notifications through the existing notification system
 */
export class AppointmentNotificationService {
  private static instance: AppointmentNotificationService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AppointmentNotificationService {
    if (!AppointmentNotificationService.instance) {
      AppointmentNotificationService.instance = new AppointmentNotificationService();
    }
    return AppointmentNotificationService.instance;
  }

  /**
   * Send appointment reminder notification
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async sendAppointmentReminder(
    appointmentId: mongoose.Types.ObjectId,
    reminderType: '24h' | '2h' | '15min',
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const appointment = await this.getAppointmentWithDetails(appointmentId);
      const patient = appointment.patientId as any;
      const pharmacist = appointment.assignedTo as any;

      // Generate confirmation token if needed
      let confirmationToken: string | undefined;
      if (options.includeConfirmationLink) {
        const tokenData = await PublicAppointmentService.updateAppointmentWithConfirmationToken(appointmentId);
        confirmationToken = tokenData.token;
      }

      // Determine delivery channels based on patient preferences
      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      // Create notification data
      const notificationData: INotificationData = {
        appointmentId: appointment._id,
        patientId: patient._id,
        pharmacistId: pharmacist._id,
        scheduledTime: appointment.get('appointmentDateTime'),
        actionUrl: `/appointments/${appointment._id}`,
        metadata: {
          appointmentType: appointment.type,
          appointmentTitle: appointment.title,
          duration: appointment.duration,
          scheduledDate: appointment.scheduledDate.toISOString(),
          scheduledTime: appointment.scheduledTime,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          patientName: `${patient.firstName} ${patient.lastName}`,
          reminderType,
          confirmationToken,
          confirmationUrl: confirmationToken 
            ? `${process.env.FRONTEND_URL}/appointments/confirm/${appointmentId}?token=${confirmationToken}`
            : undefined,
          publicConfirmationUrl: confirmationToken
            ? `${process.env.FRONTEND_URL}/public/appointments/${appointmentId}/confirm?token=${confirmationToken}`
            : undefined,
          rescheduleUrl: `${process.env.FRONTEND_URL}/appointments/reschedule/${appointmentId}`,
          customMessage: options.customMessage,
        },
      };

      // Create notification
      const createNotificationData: CreateNotificationData = {
        userId: patient._id,
        type: 'appointment_reminder',
        title: this.getReminderTitle(reminderType, appointment.type),
        content: this.getReminderContent(reminderType, appointment, patient, pharmacist),
        data: notificationData,
        priority: this.getReminderPriority(reminderType),
        deliveryChannels,
        workplaceId: appointment.workplaceId,
        createdBy: appointment.assignedTo,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Appointment reminder sent`, {
        appointmentId: appointmentId.toString(),
        patientId: patient._id.toString(),
        reminderType,
        notificationId: notification._id.toString(),
        channels: Object.entries(deliveryChannels).filter(([_, enabled]) => enabled).map(([channel]) => channel),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending appointment reminder`, {
        appointmentId: appointmentId.toString(),
        reminderType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send appointment confirmation notification
   * Requirements: 2.1, 2.2, 6.3, 6.4
   */
  async sendAppointmentConfirmation(
    appointmentId: mongoose.Types.ObjectId,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const appointment = await this.getAppointmentWithDetails(appointmentId);
      const patient = appointment.patientId as any;
      const pharmacist = appointment.assignedTo as any;

      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      const notificationData: INotificationData = {
        appointmentId: appointment._id,
        patientId: patient._id,
        pharmacistId: pharmacist._id,
        scheduledTime: appointment.get('appointmentDateTime'),
        actionUrl: `/appointments/${appointment._id}`,
        metadata: {
          appointmentType: appointment.type,
          appointmentTitle: appointment.title,
          duration: appointment.duration,
          scheduledDate: appointment.scheduledDate.toISOString(),
          scheduledTime: appointment.scheduledTime,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          patientName: `${patient.firstName} ${patient.lastName}`,
          confirmedAt: new Date().toISOString(),
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: patient._id,
        type: 'appointment_confirmed',
        title: 'Appointment Confirmed',
        content: `Your ${this.formatAppointmentType(appointment.type)} appointment has been confirmed for ${appointment.scheduledDate.toLocaleDateString()} at ${appointment.scheduledTime}`,
        data: notificationData,
        priority: 'normal',
        deliveryChannels,
        workplaceId: appointment.workplaceId,
        createdBy: appointment.assignedTo,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Appointment confirmation sent`, {
        appointmentId: appointmentId.toString(),
        patientId: patient._id.toString(),
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending appointment confirmation`, {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send appointment rescheduled notification
   * Requirements: 2.1, 2.2, 1.7
   */
  async sendAppointmentRescheduled(
    appointmentId: mongoose.Types.ObjectId,
    oldDate: Date,
    oldTime: string,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const appointment = await this.getAppointmentWithDetails(appointmentId);
      const patient = appointment.patientId as any;
      const pharmacist = appointment.assignedTo as any;

      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      const notificationData: INotificationData = {
        appointmentId: appointment._id,
        patientId: patient._id,
        pharmacistId: pharmacist._id,
        scheduledTime: appointment.get('appointmentDateTime'),
        actionUrl: `/appointments/${appointment._id}`,
        metadata: {
          appointmentType: appointment.type,
          appointmentTitle: appointment.title,
          duration: appointment.duration,
          oldDate: oldDate.toISOString(),
          oldTime,
          newDate: appointment.scheduledDate.toISOString(),
          newTime: appointment.scheduledTime,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          patientName: `${patient.firstName} ${patient.lastName}`,
          rescheduledAt: new Date().toISOString(),
          reason: appointment.rescheduledReason,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: patient._id,
        type: 'appointment_rescheduled',
        title: 'Appointment Rescheduled',
        content: `Your ${this.formatAppointmentType(appointment.type)} appointment has been rescheduled from ${oldDate.toLocaleDateString()} at ${oldTime} to ${appointment.scheduledDate.toLocaleDateString()} at ${appointment.scheduledTime}`,
        data: notificationData,
        priority: 'high',
        deliveryChannels,
        workplaceId: appointment.workplaceId,
        createdBy: appointment.assignedTo,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Appointment rescheduled notification sent`, {
        appointmentId: appointmentId.toString(),
        patientId: patient._id.toString(),
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending appointment rescheduled notification`, {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send appointment cancelled notification
   * Requirements: 2.1, 2.2, 1.4
   */
  async sendAppointmentCancelled(
    appointmentId: mongoose.Types.ObjectId,
    reason: string,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const appointment = await this.getAppointmentWithDetails(appointmentId);
      const patient = appointment.patientId as any;
      const pharmacist = appointment.assignedTo as any;

      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      const notificationData: INotificationData = {
        appointmentId: appointment._id,
        patientId: patient._id,
        pharmacistId: pharmacist._id,
        scheduledTime: appointment.get('appointmentDateTime'),
        actionUrl: `/appointments/book`, // Redirect to booking page
        metadata: {
          appointmentType: appointment.type,
          appointmentTitle: appointment.title,
          scheduledDate: appointment.scheduledDate.toISOString(),
          scheduledTime: appointment.scheduledTime,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          patientName: `${patient.firstName} ${patient.lastName}`,
          cancelledAt: new Date().toISOString(),
          reason,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: patient._id,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        content: `Your ${this.formatAppointmentType(appointment.type)} appointment scheduled for ${appointment.scheduledDate.toLocaleDateString()} at ${appointment.scheduledTime} has been cancelled. Reason: ${reason}`,
        data: notificationData,
        priority: 'high',
        deliveryChannels,
        workplaceId: appointment.workplaceId,
        createdBy: appointment.assignedTo,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Appointment cancelled notification sent`, {
        appointmentId: appointmentId.toString(),
        patientId: patient._id.toString(),
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending appointment cancelled notification`, {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send follow-up task assigned notification
   * Requirements: 3.1, 3.2
   */
  async sendFollowUpTaskAssigned(
    followUpTaskId: mongoose.Types.ObjectId,
    assignedToId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      // Import FollowUpTask model dynamically to avoid circular dependencies
      const FollowUpTask = require('../models/FollowUpTask').default;
      
      const followUpTask = await FollowUpTask.findById(followUpTaskId)
        .populate('patientId', 'firstName lastName email phone notificationPreferences')
        .populate('assignedTo', 'firstName lastName email');

      if (!followUpTask) {
        throw new Error(`Follow-up task not found: ${followUpTaskId}`);
      }

      const patient = followUpTask.patientId;
      const assignedTo = followUpTask.assignedTo;

      const deliveryChannels = this.determineDeliveryChannels(assignedTo, options.channels);

      const notificationData: INotificationData = {
        followUpTaskId: followUpTask._id,
        patientId: patient._id,
        pharmacistId: assignedTo._id,
        actionUrl: `/follow-ups/${followUpTask._id}`,
        priority: followUpTask.priority,
        metadata: {
          taskType: followUpTask.type,
          taskTitle: followUpTask.title,
          dueDate: followUpTask.dueDate.toISOString(),
          priority: followUpTask.priority,
          patientName: `${patient.firstName} ${patient.lastName}`,
          assignedToName: `${assignedTo.firstName} ${assignedTo.lastName}`,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: assignedToId,
        type: 'followup_task_assigned',
        title: 'New Follow-up Task Assigned',
        content: `You have been assigned a ${followUpTask.priority} priority follow-up task for patient ${patient.firstName} ${patient.lastName}`,
        data: notificationData,
        priority: followUpTask.priority === 'urgent' || followUpTask.priority === 'critical' ? 'high' : 'normal',
        deliveryChannels,
        workplaceId,
        createdBy: followUpTask.createdBy,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Follow-up task assigned notification sent`, {
        followUpTaskId: followUpTaskId.toString(),
        assignedToId: assignedToId.toString(),
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending follow-up task assigned notification`, {
        followUpTaskId: followUpTaskId.toString(),
        assignedToId: assignedToId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send follow-up task overdue notification
   * Requirements: 3.3, 3.5, 3.6
   */
  async sendFollowUpTaskOverdue(
    followUpTaskId: mongoose.Types.ObjectId,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const FollowUpTask = require('../models/FollowUpTask').default;
      
      const followUpTask = await FollowUpTask.findById(followUpTaskId)
        .populate('patientId', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName email phone notificationPreferences');

      if (!followUpTask) {
        throw new Error(`Follow-up task not found: ${followUpTaskId}`);
      }

      const patient = followUpTask.patientId;
      const assignedTo = followUpTask.assignedTo;

      const deliveryChannels = this.determineDeliveryChannels(assignedTo, options.channels);

      const daysOverdue = Math.floor((new Date().getTime() - followUpTask.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const notificationData: INotificationData = {
        followUpTaskId: followUpTask._id,
        patientId: patient._id,
        pharmacistId: assignedTo._id,
        actionUrl: `/follow-ups/${followUpTask._id}`,
        priority: 'urgent',
        metadata: {
          taskType: followUpTask.type,
          taskTitle: followUpTask.title,
          dueDate: followUpTask.dueDate.toISOString(),
          daysOverdue,
          priority: followUpTask.priority,
          patientName: `${patient.firstName} ${patient.lastName}`,
          assignedToName: `${assignedTo.firstName} ${assignedTo.lastName}`,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: followUpTask.assignedTo,
        type: 'followup_task_overdue',
        title: 'Follow-up Task Overdue',
        content: `Follow-up task for patient ${patient.firstName} ${patient.lastName} is ${daysOverdue} day(s) overdue`,
        data: notificationData,
        priority: 'urgent',
        deliveryChannels,
        workplaceId: followUpTask.workplaceId,
        createdBy: followUpTask.createdBy,
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Follow-up task overdue notification sent`, {
        followUpTaskId: followUpTaskId.toString(),
        assignedToId: followUpTask.assignedTo.toString(),
        daysOverdue,
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending follow-up task overdue notification`, {
        followUpTaskId: followUpTaskId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send medication refill due notification
   * Requirements: 2.3, 2.4, 2.5
   */
  async sendMedicationRefillDue(
    patientId: mongoose.Types.ObjectId,
    medicationName: string,
    daysUntilDue: number,
    workplaceId: mongoose.Types.ObjectId,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const patient = await Patient.findById(patientId).select('firstName lastName email phone notificationPreferences');
      
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      const notificationData: INotificationData = {
        patientId: patient._id,
        medicationName,
        actionUrl: `/medications/refill`,
        metadata: {
          medicationName,
          daysUntilDue,
          patientName: `${patient.firstName} ${patient.lastName}`,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: patientId,
        type: 'medication_refill_due',
        title: 'Medication Refill Due',
        content: `Your ${medicationName} prescription will need a refill in ${daysUntilDue} day(s)`,
        data: notificationData,
        priority: daysUntilDue <= 3 ? 'high' : 'normal',
        deliveryChannels,
        workplaceId,
        createdBy: patientId, // System-generated
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Medication refill due notification sent`, {
        patientId: patientId.toString(),
        medicationName,
        daysUntilDue,
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending medication refill due notification`, {
        patientId: patientId.toString(),
        medicationName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Send adherence check reminder notification
   * Requirements: 2.3, 2.4, 2.5
   */
  async sendAdherenceCheckReminder(
    patientId: mongoose.Types.ObjectId,
    medicationName: string,
    workplaceId: mongoose.Types.ObjectId,
    options: AppointmentNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    try {
      const patient = await Patient.findById(patientId).select('firstName lastName email phone notificationPreferences');
      
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      const deliveryChannels = this.determineDeliveryChannels(patient, options.channels);

      const notificationData: INotificationData = {
        patientId: patient._id,
        medicationName,
        actionUrl: `/medications/adherence`,
        metadata: {
          medicationName,
          patientName: `${patient.firstName} ${patient.lastName}`,
          customMessage: options.customMessage,
        },
      };

      const createNotificationData: CreateNotificationData = {
        userId: patientId,
        type: 'adherence_check_reminder',
        title: 'Medication Adherence Check',
        content: `Please confirm that you are taking your ${medicationName} as prescribed`,
        data: notificationData,
        priority: 'normal',
        deliveryChannels,
        workplaceId,
        createdBy: patientId, // System-generated
      };

      const notification = await notificationService.createNotification(createNotificationData);

      logger.info(`Adherence check reminder sent`, {
        patientId: patientId.toString(),
        medicationName,
        notificationId: notification._id.toString(),
      });

      return {
        success: true,
        notificationId: notification._id.toString(),
        deliveryChannels,
      };
    } catch (error) {
      logger.error(`Error sending adherence check reminder`, {
        patientId: patientId.toString(),
        medicationName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryChannels: { inApp: false, email: false, sms: false, push: false },
      };
    }
  }

  /**
   * Verify appointment confirmation token
   */
  async verifyConfirmationToken(
    appointmentId: mongoose.Types.ObjectId,
    token: string
  ): Promise<{ valid: boolean; expired?: boolean }> {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment || !appointment.metadata?.confirmationToken) {
        return { valid: false };
      }

      const storedToken = appointment.metadata.confirmationToken;
      const expiry = appointment.metadata.confirmationTokenExpiry;

      if (storedToken !== token) {
        return { valid: false };
      }

      if (expiry && new Date() > new Date(expiry)) {
        return { valid: false, expired: true };
      }

      return { valid: true };
    } catch (error) {
      logger.error(`Error verifying confirmation token`, {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { valid: false };
    }
  }

  // Private helper methods

  /**
   * Get appointment with populated details
   */
  private async getAppointmentWithDetails(appointmentId: mongoose.Types.ObjectId): Promise<IAppointment> {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'firstName lastName email phone notificationPreferences')
      .populate('assignedTo', 'firstName lastName email');

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    return appointment;
  }

  /**
   * Determine delivery channels based on patient preferences and options
   */
  private determineDeliveryChannels(
    user: any,
    requestedChannels?: string[]
  ): { inApp: boolean; email: boolean; sms: boolean; push: boolean } {
    const preferences = user?.notificationPreferences || {};
    
    // Default channels
    const channels = {
      inApp: true, // Always enable in-app notifications
      email: false,
      sms: false,
      push: false,
    };

    // Apply user preferences
    if (preferences.email !== false && user.email) {
      channels.email = true;
    }

    if (preferences.sms !== false && user.phone) {
      channels.sms = true;
    }

    if (preferences.push !== false) {
      channels.push = true;
    }

    // Override with requested channels if provided
    if (requestedChannels && requestedChannels.length > 0) {
      channels.email = requestedChannels.includes('email') && !!user.email;
      channels.sms = requestedChannels.includes('sms') && !!user.phone;
      channels.push = requestedChannels.includes('push');
      // inApp always remains true
    }

    return channels;
  }



  /**
   * Get reminder title based on type and appointment type
   */
  private getReminderTitle(reminderType: string, appointmentType: string): string {
    const timeMap = {
      '24h': 'tomorrow',
      '2h': 'in 2 hours',
      '15min': 'in 15 minutes',
    };

    const timeText = timeMap[reminderType as keyof typeof timeMap] || 'soon';
    const formattedType = this.formatAppointmentType(appointmentType);

    return `Appointment Reminder: ${formattedType} ${timeText}`;
  }

  /**
   * Get reminder content
   */
  private getReminderContent(
    reminderType: string,
    appointment: IAppointment,
    patient: any,
    pharmacist: any
  ): string {
    const timeMap = {
      '24h': 'tomorrow',
      '2h': 'in 2 hours',
      '15min': 'in 15 minutes',
    };

    const timeText = timeMap[reminderType as keyof typeof timeMap] || 'soon';
    const formattedType = this.formatAppointmentType(appointment.type);
    const dateStr = appointment.scheduledDate.toLocaleDateString();
    const timeStr = appointment.scheduledTime;

    return `Hi ${patient.firstName}, you have a ${formattedType} appointment ${timeText} on ${dateStr} at ${timeStr} with ${pharmacist.firstName} ${pharmacist.lastName}.`;
  }

  /**
   * Get reminder priority based on type
   */
  private getReminderPriority(reminderType: string): 'low' | 'normal' | 'high' | 'urgent' | 'critical' {
    switch (reminderType) {
      case '15min':
        return 'high';
      case '2h':
        return 'normal';
      case '24h':
        return 'low';
      default:
        return 'normal';
    }
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
}

export const appointmentNotificationService = AppointmentNotificationService.getInstance();
export default appointmentNotificationService;