/**
 * Appointment Reminder Processor Unit Tests
 * Tests background job processing for appointment reminders
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

/// <reference types="jest" />

import { Job } from 'bull';
import { appointmentReminderProcessor } from '../../jobs/appointmentReminderProcessor';
import { ReminderSchedulerService } from '../../services/ReminderSchedulerService';
import Appointment from '../../models/Appointment';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/ReminderSchedulerService');
jest.mock('../../models/Appointment');
jest.mock('../../utils/logger');

describe('Appointment Reminder Processor', () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockJob = {
      id: 'test-job-123',
      data: {},
      progress: jest.fn(),
      log: jest.fn(),
    };
  });

  describe('processSingleReminder', () => {
    it('should process single reminder successfully', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        success: true,
        channel: 'email',
        messageId: 'msg-123',
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(ReminderSchedulerService.sendReminder).toHaveBeenCalledWith(
        'appointment-123',
        'reminder-456',
        'workplace-789'
      );
      expect(result).toEqual({
        success: true,
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        result: {
          success: true,
          channel: 'email',
          messageId: 'msg-123',
        },
      });
    });

    it('should handle single reminder failure', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        success: false,
        channel: 'sms',
        error: 'SMS delivery failed',
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(result.success).toBe(false);
      expect(result.result.error).toBe('SMS delivery failed');
    });

    it('should handle service errors for single reminder', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.sendReminder as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Service unavailable');
    });
  });

  describe('processBatchReminders', () => {
    it('should process batch reminders successfully', async () => {
      // Arrange
      const jobData = {
        type: 'batch_reminders',
        workplaceId: 'workplace-789',
        batchSize: 50,
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.processPendingReminders as jest.Mock).mockResolvedValue({
        processed: 25,
        successful: 23,
        failed: 2,
        errors: [
          { appointmentId: 'app-1', error: 'Email failed' },
          { appointmentId: 'app-2', error: 'SMS failed' },
        ],
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(ReminderSchedulerService.processPendingReminders).toHaveBeenCalledWith(
        'workplace-789',
        { batchSize: 50 }
      );
      expect(result).toEqual({
        success: true,
        type: 'batch_reminders',
        workplaceId: 'workplace-789',
        result: {
          processed: 25,
          successful: 23,
          failed: 2,
          errors: [
            { appointmentId: 'app-1', error: 'Email failed' },
            { appointmentId: 'app-2', error: 'SMS failed' },
          ],
        },
      });
    });

    it('should handle batch processing with no pending reminders', async () => {
      // Arrange
      const jobData = {
        type: 'batch_reminders',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.processPendingReminders as jest.Mock).mockResolvedValue({
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(result.success).toBe(true);
      expect(result.result.processed).toBe(0);
    });

    it('should handle batch processing errors', async () => {
      // Arrange
      const jobData = {
        type: 'batch_reminders',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.processPendingReminders as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Database connection failed');
    });
  });

  describe('scheduleAppointmentReminders', () => {
    it('should schedule reminders for new appointment', async () => {
      // Arrange
      const jobData = {
        type: 'schedule_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.scheduleAppointmentReminders as jest.Mock).mockResolvedValue({
        appointmentId: 'appointment-123',
        remindersScheduled: 3,
        reminders: [
          { type: 'email', scheduledFor: new Date() },
          { type: 'sms', scheduledFor: new Date() },
          { type: 'push', scheduledFor: new Date() },
        ],
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(ReminderSchedulerService.scheduleAppointmentReminders).toHaveBeenCalledWith(
        'appointment-123',
        'workplace-789'
      );
      expect(result).toEqual({
        success: true,
        type: 'schedule_reminders',
        appointmentId: 'appointment-123',
        result: {
          appointmentId: 'appointment-123',
          remindersScheduled: 3,
          reminders: expect.any(Array),
        },
      });
    });

    it('should handle scheduling errors', async () => {
      // Arrange
      const jobData = {
        type: 'schedule_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.scheduleAppointmentReminders as jest.Mock).mockRejectedValue(
        new Error('Appointment not found')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Appointment not found');
    });
  });

  describe('cancelAppointmentReminders', () => {
    it('should cancel reminders for cancelled appointment', async () => {
      // Arrange
      const jobData = {
        type: 'cancel_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.cancelAppointmentReminders as jest.Mock).mockResolvedValue({
        appointmentId: 'appointment-123',
        remindersCancelled: 2,
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(ReminderSchedulerService.cancelAppointmentReminders).toHaveBeenCalledWith(
        'appointment-123',
        'workplace-789'
      );
      expect(result).toEqual({
        success: true,
        type: 'cancel_reminders',
        appointmentId: 'appointment-123',
        result: {
          appointmentId: 'appointment-123',
          remindersCancelled: 2,
        },
      });
    });

    it('should handle cancellation errors', async () => {
      // Arrange
      const jobData = {
        type: 'cancel_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.cancelAppointmentReminders as jest.Mock).mockRejectedValue(
        new Error('Appointment not found')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Appointment not found');
    });
  });

  describe('rescheduleAppointmentReminders', () => {
    it('should reschedule reminders for rescheduled appointment', async () => {
      // Arrange
      const jobData = {
        type: 'reschedule_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
        newDate: '2025-12-02',
        newTime: '14:00',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.rescheduleReminders as jest.Mock).mockResolvedValue({
        appointmentId: 'appointment-123',
        remindersRescheduled: 2,
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(ReminderSchedulerService.rescheduleReminders).toHaveBeenCalledWith(
        'appointment-123',
        new Date('2025-12-02'),
        '14:00',
        'workplace-789'
      );
      expect(result).toEqual({
        success: true,
        type: 'reschedule_reminders',
        appointmentId: 'appointment-123',
        result: {
          appointmentId: 'appointment-123',
          remindersRescheduled: 2,
        },
      });
    });

    it('should handle rescheduling errors', async () => {
      // Arrange
      const jobData = {
        type: 'reschedule_reminders',
        appointmentId: 'appointment-123',
        workplaceId: 'workplace-789',
        newDate: '2025-12-02',
        newTime: '14:00',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.rescheduleReminders as jest.Mock).mockRejectedValue(
        new Error('Invalid date format')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Invalid date format');
    });
  });

  describe('medicationReminderJob', () => {
    it('should process medication refill reminders', async () => {
      // Arrange
      const jobData = {
        type: 'medication_reminder',
        workplaceId: 'workplace-789',
        medicationType: 'refill',
        daysBeforeDue: 7,
      };

      mockJob.data = jobData;

      const mockPatients = [
        {
          _id: 'patient-1',
          medications: [
            {
              _id: 'med-1',
              name: 'Lisinopril',
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      ];

      (Appointment.aggregate as jest.Mock).mockResolvedValue(mockPatients);
      (ReminderSchedulerService.sendMedicationReminder as jest.Mock).mockResolvedValue({
        success: true,
        patientId: 'patient-1',
        medicationId: 'med-1',
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(result.success).toBe(true);
      expect(result.type).toBe('medication_reminder');
    });

    it('should process adherence check reminders', async () => {
      // Arrange
      const jobData = {
        type: 'medication_reminder',
        workplaceId: 'workplace-789',
        medicationType: 'adherence_check',
        chronicConditions: ['diabetes', 'hypertension'],
      };

      mockJob.data = jobData;

      const mockPatients = [
        {
          _id: 'patient-1',
          conditions: ['diabetes'],
          lastAdherenceCheck: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      ];

      (Appointment.aggregate as jest.Mock).mockResolvedValue(mockPatients);
      (ReminderSchedulerService.sendAdherenceReminder as jest.Mock).mockResolvedValue({
        success: true,
        patientId: 'patient-1',
      });

      // Act
      const result = await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(result.success).toBe(true);
      expect(result.type).toBe('medication_reminder');
    });
  });

  describe('error handling and logging', () => {
    it('should log job start and completion', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        success: true,
        channel: 'email',
      });

      // Act
      await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Processing appointment reminder job',
        expect.objectContaining({
          jobId: 'test-job-123',
          type: 'single_reminder',
        })
      );
    });

    it('should log errors and re-throw', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      const error = new Error('Service error');
      (ReminderSchedulerService.sendReminder as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Service error');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing appointment reminder job',
        expect.objectContaining({
          jobId: 'test-job-123',
          error: 'Service error',
        })
      );
    });

    it('should update job progress for batch operations', async () => {
      // Arrange
      const jobData = {
        type: 'batch_reminders',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      (ReminderSchedulerService.processPendingReminders as jest.Mock).mockImplementation(
        async (workplaceId, options) => {
          // Simulate progress updates
          if (mockJob.progress) {
            (mockJob.progress as jest.Mock)(50);
          }
          return {
            processed: 10,
            successful: 8,
            failed: 2,
            errors: [],
          };
        }
      );

      // Act
      await appointmentReminderProcessor(mockJob as Job);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledWith(50);
    });

    it('should handle invalid job data', async () => {
      // Arrange
      mockJob.data = {
        type: 'invalid_type',
      };

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Unknown job type');
    });

    it('should handle missing required fields', async () => {
      // Arrange
      mockJob.data = {
        type: 'single_reminder',
        // Missing appointmentId, reminderId, workplaceId
      };

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Missing required fields');
    });
  });

  describe('retry logic', () => {
    it('should handle retryable errors', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      // Mock temporary failure
      (ReminderSchedulerService.sendReminder as jest.Mock).mockRejectedValue(
        new Error('ECONNRESET')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('ECONNRESET');
      
      // Should log as retryable error
      expect(logger.warn).toHaveBeenCalledWith(
        'Retryable error in appointment reminder job',
        expect.objectContaining({
          error: 'ECONNRESET',
        })
      );
    });

    it('should handle non-retryable errors', async () => {
      // Arrange
      const jobData = {
        type: 'single_reminder',
        appointmentId: 'appointment-123',
        reminderId: 'reminder-456',
        workplaceId: 'workplace-789',
      };

      mockJob.data = jobData;

      // Mock permanent failure
      (ReminderSchedulerService.sendReminder as jest.Mock).mockRejectedValue(
        new Error('Appointment not found')
      );

      // Act & Assert
      await expect(appointmentReminderProcessor(mockJob as Job)).rejects.toThrow('Appointment not found');
      
      // Should log as non-retryable error
      expect(logger.error).toHaveBeenCalledWith(
        'Non-retryable error in appointment reminder job',
        expect.objectContaining({
          error: 'Appointment not found',
        })
      );
    });
  });
});