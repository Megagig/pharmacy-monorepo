import { Reminder } from '../../models/chat/Reminder';
import { reminderService } from './ReminderService';
import logger from '../../utils/logger';

/**
 * ReminderJobService - Automated Reminder Job Processing
 * 
 * Handles scheduled reminder sending and missed dose checking
 * Can be integrated with Bull queue or run as cron jobs
 */

export class ReminderJobService {
  private isProcessing: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the reminder job processor
   * Checks for due reminders every minute
   */
  start(intervalMinutes: number = 1): void {
    if (this.intervalId) {
      logger.warn('Reminder job service already running');
      return;
    }

    logger.info('Starting reminder job service', { intervalMinutes });

    // Run immediately
    this.processReminders();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processReminders();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the reminder job processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Reminder job service stopped');
    }
  }

  /**
   * Process due reminders
   * Finds reminders that need to be sent and sends them
   */
  async processReminders(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Reminder processing already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      logger.debug('Processing reminders');

      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // Find all active reminders
      const reminders = await Reminder.find({
        isActive: true,
        isPaused: false,
        startDate: { $lte: now },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } },
        ],
      });

      let sentCount = 0;

      for (const reminder of reminders) {
        try {
          // Get next reminder time
          const nextTime = reminder.getNextReminderTime();

          if (!nextTime) {
            continue;
          }

          // Check if reminder is due (within next 5 minutes)
          if (nextTime <= fiveMinutesFromNow) {
            // Check if we've already sent this reminder
            const alreadySent = reminder.confirmations.some(
              c => c.scheduledTime.getTime() === nextTime.getTime() && c.reminderSentAt
            );

            if (!alreadySent) {
              // Send reminder
              await reminderService.sendReminderMessage(reminder, nextTime);
              sentCount++;

              logger.info('Reminder sent', {
                reminderId: reminder._id,
                patientId: reminder.patientId,
                scheduledTime: nextTime,
              });
            }
          }
        } catch (error) {
          logger.error('Error processing individual reminder', {
            error,
            reminderId: reminder._id,
          });
        }
      }

      if (sentCount > 0) {
        logger.info('Reminders processed', { sentCount });
      }

      // Also check for missed doses
      await reminderService.checkMissedDoses();
    } catch (error) {
      logger.error('Error processing reminders', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process reminders for a specific patient
   * Useful for testing or manual triggering
   */
  async processPatientReminders(patientId: string): Promise<number> {
    try {
      logger.info('Processing reminders for patient', { patientId });

      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      const reminders = await Reminder.find({
        patientId,
        isActive: true,
        isPaused: false,
        startDate: { $lte: now },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } },
        ],
      });

      let sentCount = 0;

      for (const reminder of reminders) {
        const nextTime = reminder.getNextReminderTime();

        if (nextTime && nextTime <= fiveMinutesFromNow) {
          const alreadySent = reminder.confirmations.some(
            c => c.scheduledTime.getTime() === nextTime.getTime() && c.reminderSentAt
          );

          if (!alreadySent) {
            await reminderService.sendReminderMessage(reminder, nextTime);
            sentCount++;
          }
        }
      }

      logger.info('Patient reminders processed', { patientId, sentCount });

      return sentCount;
    } catch (error) {
      logger.error('Error processing patient reminders', { error, patientId });
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  getStats(): {
    isRunning: boolean;
    isProcessing: boolean;
  } {
    return {
      isRunning: this.intervalId !== null,
      isProcessing: this.isProcessing,
    };
  }
}

// Export singleton instance
export const reminderJobService = new ReminderJobService();
export default reminderJobService;
