/**
 * Job Workers
 * Registers job processors with their respective queues
 */

import QueueService from '../services/QueueService';
import { QueueName } from '../config/queue';
import {
  processAppointmentReminder,
  onAppointmentReminderCompleted,
  onAppointmentReminderFailed,
} from './appointmentReminderProcessor';
import {
  processFollowUpMonitor,
  onFollowUpMonitorCompleted,
  onFollowUpMonitorFailed,
} from './followUpMonitorProcessor';
import {
  processMedicationReminder,
  onMedicationReminderCompleted,
  onMedicationReminderFailed,
} from './medicationReminderProcessor';
import {
  processAdherenceCheck,
  onAdherenceCheckCompleted,
  onAdherenceCheckFailed,
} from './adherenceCheckProcessor';
import {
  processAppointmentStatusMonitor,
  onAppointmentStatusMonitorCompleted,
  onAppointmentStatusMonitorFailed,
} from './appointmentStatusProcessor';
import logger from '../utils/logger';

/**
 * Initialize all job workers
 */
export async function initializeWorkers(): Promise<void> {

  // Check if Redis URL is available
  if (!process.env.REDIS_URL || process.env.REDIS_URL.trim() === '') {
    logger.info('⏸️ Job workers disabled (no REDIS_URL configured)');
    return;
  }

  try {
    logger.info('Initializing job workers...');

    // Register appointment reminder processor
    const appointmentReminderQueue = QueueService.getQueue(QueueName.APPOINTMENT_REMINDER);
    if (appointmentReminderQueue) {
      appointmentReminderQueue.process(processAppointmentReminder);
      appointmentReminderQueue.on('completed', onAppointmentReminderCompleted);
      appointmentReminderQueue.on('failed', onAppointmentReminderFailed);
      logger.info('Appointment reminder worker registered');
    } else {
      logger.warn('Appointment reminder queue not found');
    }

    // Register follow-up monitor processor
    const followUpMonitorQueue = QueueService.getQueue(QueueName.FOLLOW_UP_MONITOR);
    if (followUpMonitorQueue) {
      followUpMonitorQueue.process(processFollowUpMonitor);
      followUpMonitorQueue.on('completed', onFollowUpMonitorCompleted);
      followUpMonitorQueue.on('failed', onFollowUpMonitorFailed);
      logger.info('Follow-up monitor worker registered');
    } else {
      logger.warn('Follow-up monitor queue not found');
    }

    // Register medication reminder processor
    const medicationReminderQueue = QueueService.getQueue(QueueName.MEDICATION_REMINDER);
    if (medicationReminderQueue) {
      medicationReminderQueue.process(processMedicationReminder);
      medicationReminderQueue.on('completed', onMedicationReminderCompleted);
      medicationReminderQueue.on('failed', onMedicationReminderFailed);
      logger.info('Medication reminder worker registered');
    } else {
      logger.warn('Medication reminder queue not found');
    }

    // Register adherence check processor
    const adherenceCheckQueue = QueueService.getQueue(QueueName.ADHERENCE_CHECK);
    if (adherenceCheckQueue) {
      adherenceCheckQueue.process(processAdherenceCheck);
      adherenceCheckQueue.on('completed', onAdherenceCheckCompleted);
      adherenceCheckQueue.on('failed', onAdherenceCheckFailed);
      logger.info('Adherence check worker registered');
    } else {
      logger.warn('Adherence check queue not found');
    }

    // Register appointment status monitor processor
    const appointmentStatusQueue = QueueService.getQueue(QueueName.APPOINTMENT_STATUS);
    if (appointmentStatusQueue) {
      appointmentStatusQueue.process(processAppointmentStatusMonitor);
      appointmentStatusQueue.on('completed', onAppointmentStatusMonitorCompleted);
      appointmentStatusQueue.on('failed', onAppointmentStatusMonitorFailed);
      logger.info('Appointment status monitor worker registered');
    } else {
      logger.warn('Appointment status monitor queue not found');
    }

    logger.info('Job workers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job workers:', error);
    throw error;
  }
}

/**
 * Shutdown all workers gracefully
 */
export async function shutdownWorkers(): Promise<void> {
  try {
    logger.info('Shutting down job workers...');

    // Close all queues
    await QueueService.closeAll();

    logger.info('Job workers shut down successfully');
  } catch (error) {
    logger.error('Error shutting down job workers:', error);
    throw error;
  }
}

export default {
  initializeWorkers,
  shutdownWorkers,
};
