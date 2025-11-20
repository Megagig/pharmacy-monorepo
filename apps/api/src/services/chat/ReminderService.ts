import mongoose from 'mongoose';
import { Reminder, IReminder } from '../../models/chat/Reminder';
import { chatService } from './ChatService';
import { notificationService } from '../notificationService';
import User from '../../models/User';
import Patient from '../../models/Patient';
import logger from '../../utils/logger';

/**
 * ReminderService - Medication Reminder Management
 * 
 * Handles creation, scheduling, and tracking of medication reminders
 */

export interface CreateReminderDTO {
  patientId: string;
  medicationId?: string;
  medicationName: string;
  dosage: string;
  instructions?: string;
  frequency: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times: string[];
  daysOfWeek?: number[];
  customSchedule?: string;
  startDate: Date;
  endDate?: Date;
  missedDoseThreshold?: number;
  notifyPharmacistOnMissed?: boolean;
  pharmacistId?: string;
  workplaceId: string;
  createdBy: string;
}

export interface UpdateReminderDTO {
  medicationName?: string;
  dosage?: string;
  instructions?: string;
  frequency?: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times?: string[];
  daysOfWeek?: number[];
  customSchedule?: string;
  endDate?: Date;
  isActive?: boolean;
  isPaused?: boolean;
  missedDoseThreshold?: number;
  notifyPharmacistOnMissed?: boolean;
  pharmacistId?: string;
}

export interface ReminderFilters {
  patientId?: string;
  isActive?: boolean;
  isPaused?: boolean;
  medicationId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class ReminderService {
  /**
   * Create a new reminder
   */
  async createReminder(data: CreateReminderDTO): Promise<IReminder> {
    try {
      logger.info('Creating reminder', {
        patientId: data.patientId,
        medicationName: data.medicationName,
        frequency: data.frequency,
      });

      // Validate patient exists
      const patient = await Patient.findById(data.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      // Create reminder
      const reminder = new Reminder({
        patientId: new mongoose.Types.ObjectId(data.patientId),
        medicationId: data.medicationId ? new mongoose.Types.ObjectId(data.medicationId) : undefined,
        medicationName: data.medicationName,
        dosage: data.dosage,
        instructions: data.instructions,
        frequency: data.frequency,
        times: data.times,
        daysOfWeek: data.daysOfWeek,
        customSchedule: data.customSchedule,
        startDate: data.startDate,
        endDate: data.endDate,
        missedDoseThreshold: data.missedDoseThreshold || 60,
        notifyPharmacistOnMissed: data.notifyPharmacistOnMissed !== false,
        pharmacistId: data.pharmacistId ? new mongoose.Types.ObjectId(data.pharmacistId) : undefined,
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
      });

      await reminder.save();

      // Send confirmation notification to patient
      await this.sendReminderSetupNotification(reminder);

      logger.info('Reminder created successfully', {
        reminderId: reminder._id,
        patientId: data.patientId,
      });

      return reminder;
    } catch (error) {
      logger.error('Error creating reminder', { error, data });
      throw error;
    }
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(reminderId: string, workplaceId: string): Promise<IReminder | null> {
    try {
      const reminder = await Reminder.findOne({
        _id: new mongoose.Types.ObjectId(reminderId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      })
        .populate('patientId', 'firstName lastName dateOfBirth')
        .populate('medicationId', 'name')
        .populate('pharmacistId', 'firstName lastName')
        .lean();

      return reminder as IReminder;
    } catch (error) {
      logger.error('Error getting reminder', { error, reminderId });
      throw error;
    }
  }

  /**
   * Get reminders with filters
   */
  async getReminders(
    workplaceId: string,
    filters: ReminderFilters = {}
  ): Promise<IReminder[]> {
    try {
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      if (filters.patientId) {
        query.patientId = new mongoose.Types.ObjectId(filters.patientId);
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.isPaused !== undefined) {
        query.isPaused = filters.isPaused;
      }
      if (filters.medicationId) {
        query.medicationId = new mongoose.Types.ObjectId(filters.medicationId);
      }
      if (filters.startDate) {
        query.startDate = { $gte: filters.startDate };
      }
      if (filters.endDate) {
        query.endDate = { $lte: filters.endDate };
      }

      const reminders = await Reminder.find(query)
        .populate('patientId', 'firstName lastName dateOfBirth')
        .populate('medicationId', 'name')
        .populate('pharmacistId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return reminders as IReminder[];
    } catch (error) {
      logger.error('Error getting reminders', { error, workplaceId, filters });
      throw error;
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(
    reminderId: string,
    workplaceId: string,
    updates: UpdateReminderDTO
  ): Promise<IReminder> {
    try {
      const reminder = await Reminder.findOne({
        _id: new mongoose.Types.ObjectId(reminderId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      // Apply updates
      Object.assign(reminder, updates);
      await reminder.save();

      logger.info('Reminder updated', { reminderId });

      return reminder;
    } catch (error) {
      logger.error('Error updating reminder', { error, reminderId });
      throw error;
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(reminderId: string, workplaceId: string): Promise<void> {
    try {
      const result = await Reminder.deleteOne({
        _id: new mongoose.Types.ObjectId(reminderId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (result.deletedCount === 0) {
        throw new Error('Reminder not found');
      }

      logger.info('Reminder deleted', { reminderId });
    } catch (error) {
      logger.error('Error deleting reminder', { error, reminderId });
      throw error;
    }
  }

  /**
   * Confirm medication taken
   */
  async confirmMedication(
    reminderId: string,
    scheduledTime: Date,
    workplaceId: string
  ): Promise<IReminder> {
    try {
      const reminder = await Reminder.findOne({
        _id: new mongoose.Types.ObjectId(reminderId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      // Add confirmation
      reminder.addConfirmation(scheduledTime);
      await reminder.save();

      logger.info('Medication confirmed', {
        reminderId,
        scheduledTime,
      });

      return reminder;
    } catch (error) {
      logger.error('Error confirming medication', { error, reminderId });
      throw error;
    }
  }

  /**
   * Send reminder message to patient
   */
  async sendReminderMessage(reminder: IReminder, scheduledTime: Date): Promise<void> {
    try {
      logger.info('Sending reminder message', {
        reminderId: reminder._id,
        patientId: reminder.patientId,
        scheduledTime,
      });

      // Get patient info
      const patient = await Patient.findById(reminder.patientId);
      if (!patient) {
        logger.error('Patient not found for reminder', { reminderId: reminder._id });
        return;
      }

      // Create reminder message
      const messageText = `💊 Medication Reminder\n\n` +
        `It's time to take your medication:\n` +
        `${reminder.medicationName} - ${reminder.dosage}\n\n` +
        `${reminder.instructions ? `Instructions: ${reminder.instructions}\n\n` : ''}` +
        `Please confirm when you've taken your medication.`;

      // Send notification
      await notificationService.createNotification({
        userId: reminder.patientId,
        type: 'medication_reminder',
        title: '💊 Medication Reminder',
        content: `Time to take ${reminder.medicationName}`,
        data: {
          reminderId: reminder._id,
          medicationName: reminder.medicationName,
          dosage: reminder.dosage,
          scheduledTime,
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: false,
          sms: true, // Send SMS for medication reminders
          push: true,
        },
        workplaceId: reminder.workplaceId,
        createdBy: reminder.createdBy,
      });

      // Update confirmation record
      const existingConfirmation = reminder.confirmations.find(
        c => c.scheduledTime.getTime() === scheduledTime.getTime()
      );

      if (existingConfirmation) {
        existingConfirmation.reminderSentAt = new Date();
      } else {
        reminder.confirmations.push({
          scheduledTime,
          status: 'pending',
          reminderSentAt: new Date(),
        });
      }

      await reminder.save();

      logger.info('Reminder message sent', {
        reminderId: reminder._id,
        patientId: reminder.patientId,
      });
    } catch (error) {
      logger.error('Error sending reminder message', { error, reminderId: reminder._id });
      throw error;
    }
  }

  /**
   * Check for missed doses and notify pharmacist
   */
  async checkMissedDoses(): Promise<void> {
    try {
      const now = new Date();

      // Find all active reminders
      const reminders = await Reminder.find({
        isActive: true,
        isPaused: false,
      });

      for (const reminder of reminders) {
        // Check pending confirmations
        const pendingConfirmations = reminder.confirmations.filter(
          c => c.status === 'pending'
        );

        for (const confirmation of pendingConfirmations) {
          const minutesSinceScheduled = 
            (now.getTime() - confirmation.scheduledTime.getTime()) / 1000 / 60;

          if (minutesSinceScheduled >= reminder.missedDoseThreshold) {
            // Mark as missed
            confirmation.status = 'missed';
            await reminder.save();

            // Notify pharmacist if enabled
            if (reminder.notifyPharmacistOnMissed && reminder.pharmacistId) {
              await this.notifyPharmacistOfMissedDose(reminder, confirmation.scheduledTime);
            }

            logger.info('Missed dose detected', {
              reminderId: reminder._id,
              patientId: reminder.patientId,
              scheduledTime: confirmation.scheduledTime,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking missed doses', { error });
    }
  }

  /**
   * Notify pharmacist of missed dose
   */
  private async notifyPharmacistOfMissedDose(
    reminder: IReminder,
    scheduledTime: Date
  ): Promise<void> {
    try {
      if (!reminder.pharmacistId) return;

      const patient = await Patient.findById(reminder.patientId).select('firstName lastName');
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';

      await notificationService.createNotification({
        userId: reminder.pharmacistId,
        type: 'missed_medication',
        title: '⚠️ Missed Medication Dose',
        content: `${patientName} missed their ${reminder.medicationName} dose scheduled for ${scheduledTime.toLocaleTimeString()}`,
        data: {
          reminderId: reminder._id,
          patientId: reminder.patientId,
          medicationName: reminder.medicationName,
          scheduledTime,
        },
        priority: 'high',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: false,
          push: true,
        },
        workplaceId: reminder.workplaceId,
        createdBy: reminder.createdBy,
      });

      logger.info('Pharmacist notified of missed dose', {
        reminderId: reminder._id,
        pharmacistId: reminder.pharmacistId,
      });
    } catch (error) {
      logger.error('Error notifying pharmacist of missed dose', { error });
    }
  }

  /**
   * Send reminder setup notification
   */
  private async sendReminderSetupNotification(reminder: IReminder): Promise<void> {
    try {
      await notificationService.createNotification({
        userId: reminder.patientId,
        type: 'reminder_setup',
        title: '✅ Medication Reminder Set Up',
        content: `Your medication reminder for ${reminder.medicationName} has been set up successfully.`,
        data: {
          reminderId: reminder._id,
          medicationName: reminder.medicationName,
          frequency: reminder.frequency,
          times: reminder.times,
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: false,
          push: false,
        },
        workplaceId: reminder.workplaceId,
        createdBy: reminder.createdBy,
      });
    } catch (error) {
      logger.error('Error sending reminder setup notification', { error });
    }
  }
}

// Export singleton instance
export const reminderService = new ReminderService();
export default reminderService;
