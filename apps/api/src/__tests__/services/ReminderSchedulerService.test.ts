/**
 * ReminderSchedulerService Unit Tests
 * Tests reminder scheduling, delivery, and template management
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.6
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import { ReminderSchedulerService } from '../../services/ReminderSchedulerService';
import ReminderTemplate from '../../models/ReminderTemplate';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import { notificationService } from '../../services/notificationService';

// Mock dependencies
jest.mock('../../models/ReminderTemplate');
jest.mock('../../models/Appointment');
jest.mock('../../models/Patient');
jest.mock('../../services/notificationService');
jest.mock('../../utils/logger');

describe('ReminderSchedulerService', () => {
  const mockWorkplaceId = new mongoose.Types.ObjectId();
  const mockAppointmentId = new mongoose.Types.ObjectId();
  const mockPatientId = new mongoose.Types.ObjectId();

  const mockAppointment = {
    _id: mockAppointmentId,
    workplaceId: mockWorkplaceId,
    patientId: mockPatientId,
    type: 'mtm_session',
    scheduledDate: new Date('2025-12-01'),
    scheduledTime: '10:00',
    duration: 30,
    title: 'MTM Session',
    reminders: [],
    save: jest.fn().mockResolvedValue(true),
  };

  const mockPatient = {
    _id: mockPatientId,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+2348012345678',
    appointmentPreferences: {
      reminderPreferences: {
        email: true,
        sms: true,
        push: false,
        whatsapp: false,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleAppointmentReminders', () => {
    it('should schedule reminders for appointment', async () => {
      // Arrange
      const mockTemplate = {
        _id: new mongoose.Types.ObjectId(),
        type: 'appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Appointment Reminder',
            body: 'Dear {{patientName}}, you have an appointment tomorrow.',
          },
          sms: {
            message: 'Reminder: Appointment at {{pharmacyName}} tomorrow at {{appointmentTime}}',
          },
        },
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);
      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (ReminderTemplate.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockTemplate]),
      });

      // Act
      const result = await ReminderSchedulerService.scheduleAppointmentReminders(
        mockAppointmentId,
        mockWorkplaceId
      );

      // Assert
      expect(result.appointmentId).toEqual(mockAppointmentId);
      expect(result.remindersScheduled).toBeGreaterThan(0);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should respect patient notification preferences', async () => {
      // Arrange
      const patientWithPrefs = {
        ...mockPatient,
        appointmentPreferences: {
          reminderPreferences: {
            email: true,
            sms: false, // SMS disabled
            push: false,
            whatsapp: false,
          },
        },
      };

      const mockTemplate = {
        _id: new mongoose.Types.ObjectId(),
        type: 'appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Appointment Reminder',
            body: 'Dear {{patientName}}, you have an appointment tomorrow.',
          },
          sms: {
            message: 'Reminder: Appointment tomorrow',
          },
        },
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);
      (Patient.findById as jest.Mock).mockResolvedValue(patientWithPrefs);
      (ReminderTemplate.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockTemplate]),
      });

      // Act
      const result = await ReminderSchedulerService.scheduleAppointmentReminders(
        mockAppointmentId,
        mockWorkplaceId
      );

      // Assert
      expect(result.remindersScheduled).toBeGreaterThan(0);
      // Should only schedule email reminders, not SMS
      const emailReminders = mockAppointment.reminders.filter((r: any) => r.type === 'email');
      const smsReminders = mockAppointment.reminders.filter((r: any) => r.type === 'sms');
      expect(emailReminders.length).toBeGreaterThan(0);
      expect(smsReminders.length).toBe(0);
    });

    it('should handle multiple reminder templates', async () => {
      // Arrange
      const mockTemplates = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'appointment',
          channels: ['email'],
          timing: { unit: 'hours', value: 24, relativeTo: 'before_appointment' },
          messageTemplates: { email: { subject: '24h Reminder', body: 'Tomorrow' } },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'appointment',
          channels: ['sms'],
          timing: { unit: 'hours', value: 2, relativeTo: 'before_appointment' },
          messageTemplates: { sms: { message: '2h Reminder' } },
        },
      ];

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);
      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (ReminderTemplate.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTemplates),
      });

      // Act
      const result = await ReminderSchedulerService.scheduleAppointmentReminders(
        mockAppointmentId,
        mockWorkplaceId
      );

      // Assert
      expect(result.remindersScheduled).toBe(2);
    });

    it('should throw error if appointment not found', async () => {
      // Arrange
      (Appointment.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ReminderSchedulerService.scheduleAppointmentReminders(
          mockAppointmentId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Appointment');
    });

    it('should throw error if patient not found', async () => {
      // Arrange
      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);
      (Patient.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ReminderSchedulerService.scheduleAppointmentReminders(
          mockAppointmentId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Patient');
    });
  });

  describe('sendReminder', () => {
    it('should send email reminder successfully', async () => {
      // Arrange
      const reminderId = new mongoose.Types.ObjectId();
      const appointmentWithReminder = {
        ...mockAppointment,
        reminders: [
          {
            _id: reminderId,
            type: 'email',
            scheduledFor: new Date(),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithReminder);
      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (notificationService.sendEmail as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'email-123',
      });

      // Act
      const result = await ReminderSchedulerService.sendReminder(
        mockAppointmentId,
        reminderId,
        mockWorkplaceId
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(notificationService.sendEmail).toHaveBeenCalled();
    });

    it('should send SMS reminder successfully', async () => {
      // Arrange
      const reminderId = new mongoose.Types.ObjectId();
      const appointmentWithReminder = {
        ...mockAppointment,
        reminders: [
          {
            _id: reminderId,
            type: 'sms',
            scheduledFor: new Date(),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithReminder);
      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (notificationService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'sms-123',
      });

      // Act
      const result = await ReminderSchedulerService.sendReminder(
        mockAppointmentId,
        reminderId,
        mockWorkplaceId
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
      expect(notificationService.sendSMS).toHaveBeenCalled();
    });

    it('should handle delivery failure', async () => {
      // Arrange
      const reminderId = new mongoose.Types.ObjectId();
      const appointmentWithReminder = {
        ...mockAppointment,
        reminders: [
          {
            _id: reminderId,
            type: 'email',
            scheduledFor: new Date(),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithReminder);
      (Patient.findById as jest.Mock).mockResolvedValue(mockPatient);
      (notificationService.sendEmail as jest.Mock).mockRejectedValue(
        new Error('Email delivery failed')
      );

      // Act
      const result = await ReminderSchedulerService.sendReminder(
        mockAppointmentId,
        reminderId,
        mockWorkplaceId
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email delivery failed');
    });

    it('should throw error if reminder not found', async () => {
      // Arrange
      const reminderId = new mongoose.Types.ObjectId();
      const appointmentWithoutReminder = {
        ...mockAppointment,
        reminders: [],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithoutReminder);

      // Act & Assert
      await expect(
        ReminderSchedulerService.sendReminder(
          mockAppointmentId,
          reminderId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Reminder');
    });

    it('should throw error if reminder already sent', async () => {
      // Arrange
      const reminderId = new mongoose.Types.ObjectId();
      const appointmentWithSentReminder = {
        ...mockAppointment,
        reminders: [
          {
            _id: reminderId,
            type: 'email',
            scheduledFor: new Date(),
            sent: true,
            deliveryStatus: 'delivered',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithSentReminder);

      // Act & Assert
      await expect(
        ReminderSchedulerService.sendReminder(
          mockAppointmentId,
          reminderId,
          mockWorkplaceId
        )
      ).rejects.toThrow('already been sent');
    });
  });

  describe('processPendingReminders', () => {
    it('should process all pending reminders', async () => {
      // Arrange
      const now = new Date();
      const pastTime = new Date(now.getTime() - 60000); // 1 minute ago

      const appointmentsWithPendingReminders = [
        {
          _id: mockAppointmentId,
          reminders: [
            {
              _id: new mongoose.Types.ObjectId(),
              type: 'email',
              scheduledFor: pastTime,
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
        },
      ];

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(appointmentsWithPendingReminders),
      });

      // Mock sendReminder to succeed
      jest.spyOn(ReminderSchedulerService, 'sendReminder').mockResolvedValue({
        success: true,
        channel: 'email',
        messageId: 'test-123',
      });

      // Act
      const result = await ReminderSchedulerService.processPendingReminders(mockWorkplaceId);

      // Assert
      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should handle failed reminder deliveries', async () => {
      // Arrange
      const now = new Date();
      const pastTime = new Date(now.getTime() - 60000);

      const appointmentsWithPendingReminders = [
        {
          _id: mockAppointmentId,
          reminders: [
            {
              _id: new mongoose.Types.ObjectId(),
              type: 'sms',
              scheduledFor: pastTime,
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
        },
      ];

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(appointmentsWithPendingReminders),
      });

      // Mock sendReminder to fail
      jest.spyOn(ReminderSchedulerService, 'sendReminder').mockResolvedValue({
        success: false,
        channel: 'sms',
        error: 'SMS delivery failed',
      });

      // Act
      const result = await ReminderSchedulerService.processPendingReminders(mockWorkplaceId);

      // Assert
      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should only process reminders that are due', async () => {
      // Arrange
      const now = new Date();
      const futureTime = new Date(now.getTime() + 60000); // 1 minute from now

      const appointmentsWithFutureReminders = [
        {
          _id: mockAppointmentId,
          reminders: [
            {
              _id: new mongoose.Types.ObjectId(),
              type: 'email',
              scheduledFor: futureTime,
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
        },
      ];

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(appointmentsWithFutureReminders),
      });

      // Act
      const result = await ReminderSchedulerService.processPendingReminders(mockWorkplaceId);

      // Assert
      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('cancelAppointmentReminders', () => {
    it('should cancel all pending reminders for appointment', async () => {
      // Arrange
      const appointmentWithReminders = {
        ...mockAppointment,
        reminders: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'email',
            scheduledFor: new Date(Date.now() + 60000),
            sent: false,
            deliveryStatus: 'pending',
          },
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'sms',
            scheduledFor: new Date(Date.now() + 120000),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithReminders);

      // Act
      const result = await ReminderSchedulerService.cancelAppointmentReminders(
        mockAppointmentId,
        mockWorkplaceId
      );

      // Assert
      expect(result.appointmentId).toEqual(mockAppointmentId);
      expect(result.remindersCancelled).toBe(2);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should not cancel already sent reminders', async () => {
      // Arrange
      const appointmentWithMixedReminders = {
        ...mockAppointment,
        reminders: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'email',
            scheduledFor: new Date(Date.now() - 60000),
            sent: true,
            deliveryStatus: 'delivered',
          },
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'sms',
            scheduledFor: new Date(Date.now() + 60000),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithMixedReminders);

      // Act
      const result = await ReminderSchedulerService.cancelAppointmentReminders(
        mockAppointmentId,
        mockWorkplaceId
      );

      // Assert
      expect(result.remindersCancelled).toBe(1); // Only the pending one
    });

    it('should throw error if appointment not found', async () => {
      // Arrange
      (Appointment.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ReminderSchedulerService.cancelAppointmentReminders(
          mockAppointmentId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Appointment');
    });
  });

  describe('rescheduleReminders', () => {
    it('should reschedule reminders for new appointment time', async () => {
      // Arrange
      const newDate = new Date('2025-12-02');
      const newTime = '14:00';

      const appointmentWithReminders = {
        ...mockAppointment,
        reminders: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'email',
            scheduledFor: new Date('2025-11-30T10:00:00Z'), // 24h before old time
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithReminders);

      // Act
      const result = await ReminderSchedulerService.rescheduleReminders(
        mockAppointmentId,
        newDate,
        newTime,
        mockWorkplaceId
      );

      // Assert
      expect(result.appointmentId).toEqual(mockAppointmentId);
      expect(result.remindersRescheduled).toBe(1);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should not reschedule already sent reminders', async () => {
      // Arrange
      const newDate = new Date('2025-12-02');
      const newTime = '14:00';

      const appointmentWithSentReminders = {
        ...mockAppointment,
        reminders: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: 'email',
            scheduledFor: new Date('2025-11-30T10:00:00Z'),
            sent: true,
            deliveryStatus: 'delivered',
          },
        ],
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(appointmentWithSentReminders);

      // Act
      const result = await ReminderSchedulerService.rescheduleReminders(
        mockAppointmentId,
        newDate,
        newTime,
        mockWorkplaceId
      );

      // Assert
      expect(result.remindersRescheduled).toBe(0);
    });

    it('should throw error if appointment not found', async () => {
      // Arrange
      const newDate = new Date('2025-12-02');
      const newTime = '14:00';

      (Appointment.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        ReminderSchedulerService.rescheduleReminders(
          mockAppointmentId,
          newDate,
          newTime,
          mockWorkplaceId
        )
      ).rejects.toThrow('Appointment');
    });
  });

  describe('getDefaultReminderTemplates', () => {
    it('should return default reminder templates', async () => {
      // Arrange
      const mockTemplates = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: '24h Email Reminder',
          type: 'appointment',
          channels: ['email'],
          isDefault: true,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: '2h SMS Reminder',
          type: 'appointment',
          channels: ['sms'],
          isDefault: true,
        },
      ];

      (ReminderTemplate.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTemplates),
      });

      // Act
      const templates = await ReminderSchedulerService.getDefaultReminderTemplates(
        'appointment',
        mockWorkplaceId
      );

      // Assert
      expect(templates).toHaveLength(2);
      expect(templates.every(t => t.isDefault)).toBe(true);
    });

    it('should filter by appointment type conditions', async () => {
      // Arrange
      const mockTemplates = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'MTM Specific Reminder',
          type: 'appointment',
          channels: ['email'],
          conditions: {
            appointmentTypes: ['mtm_session'],
          },
        },
      ];

      (ReminderTemplate.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTemplates),
      });

      // Act
      const templates = await ReminderSchedulerService.getDefaultReminderTemplates(
        'appointment',
        mockWorkplaceId,
        { appointmentType: 'mtm_session' }
      );

      // Assert
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('MTM Specific Reminder');
    });
  });
});