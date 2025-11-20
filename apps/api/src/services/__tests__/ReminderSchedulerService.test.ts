/**
 * ReminderSchedulerService Tests
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { reminderSchedulerService } from '../ReminderSchedulerService';
import type { ReminderType } from '../ReminderSchedulerService';
import QueueService from '../QueueService';
import { notificationService } from '../notificationService';
import { sendEmail } from '../../utils/email';
import { sendSMS } from '../../utils/sms';
import { QueueName } from '../../config/queue';

// Mock dependencies
jest.mock('../QueueService');
jest.mock('../notificationService');
jest.mock('../../utils/email');
jest.mock('../../utils/sms');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('ReminderSchedulerService', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let appointmentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      Appointment.deleteMany({}),
      Patient.deleteMany({}),
      User.deleteMany({}),
      Workplace.deleteMany({}),
    ]);

    // Reset mocks
    jest.clearAllMocks();

    // Create test data
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+1234567890',
      address: '123 Test St',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
    });
    workplaceId = workplace._id;

    const patient = await Patient.create({
      workplaceId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      mrn: 'MRN001',
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
      },
      createdBy: new mongoose.Types.ObjectId(),
    });
    patientId = patient._id;

    const pharmacist = await User.create({
      workplaceId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@pharmacy.com',
      password: 'hashedpassword',
      role: 'pharmacist',
    });
    pharmacistId = pharmacist._id;

    // Mock QueueService methods
    (QueueService.scheduleJob as jest.Mock).mockResolvedValue({ id: 'job-123' });
    (QueueService.removeJob as jest.Mock).mockResolvedValue(undefined);
    (QueueService.getQueue as jest.Mock).mockReturnValue({
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    });

    // Mock notification service
    (notificationService.createNotification as jest.Mock).mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
    });

    // Mock email and SMS
    (sendEmail as jest.Mock).mockResolvedValue(undefined);
    (sendSMS as jest.Mock).mockResolvedValue(undefined);
  });

  describe('scheduleAppointmentReminders', () => {
    it('should schedule reminders for a future appointment', async () => {
      // Create appointment 48 hours in the future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: futureDate,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      appointmentId = appointment._id;

      const result = await reminderSchedulerService.scheduleAppointmentReminders(appointmentId);

      expect(result.appointmentId).toBe(appointmentId.toString());
      expect(result.remindersScheduled).toBe(3); // 24h, 2h, 15min
      expect(result.scheduledReminders).toHaveLength(3);

      // Verify queue jobs were scheduled
      expect(QueueService.scheduleJob).toHaveBeenCalledTimes(3);

      // Verify reminders were added to appointment
      const updatedAppointment = await Appointment.findById(appointmentId);
      expect(updatedAppointment?.reminders).toHaveLength(3);
    });

    it('should not schedule reminders for past appointments', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 24);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: pastDate,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.scheduleAppointmentReminders(appointment._id);

      expect(result.remindersScheduled).toBe(0);
      expect(QueueService.scheduleJob).not.toHaveBeenCalled();
    });

    it('should not schedule reminders for cancelled appointments', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'vaccination',
        title: 'Vaccination',
        scheduledDate: futureDate,
        scheduledTime: '14:00',
        duration: 15,
        status: 'cancelled',
        cancellationReason: 'Patient request',
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.scheduleAppointmentReminders(appointment._id);

      expect(result.remindersScheduled).toBe(0);
      expect(QueueService.scheduleJob).not.toHaveBeenCalled();
    });

    it('should only schedule reminders that are in the future', async () => {
      // Create appointment 1 hour in the future (only 15min reminder should be scheduled)
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Follow-up',
        scheduledDate: futureDate,
        scheduledTime: '15:00',
        duration: 20,
        status: 'scheduled',
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.scheduleAppointmentReminders(appointment._id);

      // Only 15min reminder should be scheduled (1 hour > 15 minutes)
      expect(result.remindersScheduled).toBeGreaterThan(0);
      expect(result.remindersScheduled).toBeLessThan(3);
    });

    it('should respect patient notification preferences', async () => {
      // Update patient to only allow email
      await Patient.findByIdAndUpdate(patientId, {
        notificationPreferences: {
          email: true,
          sms: false,
          push: false,
        },
      });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'chronic_disease_review',
        title: 'Chronic Disease Review',
        scheduledDate: futureDate,
        scheduledTime: '11:00',
        duration: 45,
        status: 'scheduled',
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.scheduleAppointmentReminders(appointment._id);

      expect(result.remindersScheduled).toBe(3);

      // Verify that only email channel was used
      const scheduleJobCalls = (QueueService.scheduleJob as jest.Mock).mock.calls;
      scheduleJobCalls.forEach((call) => {
        const jobData = call[1];
        expect(jobData.channels).toContain('email');
        expect(jobData.channels).not.toContain('sms');
      });
    });
  });

  describe('sendReminder', () => {
    beforeEach(async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: futureDate,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
        createdBy: pharmacistId,
      });
      appointmentId = appointment._id;
    });

    it('should send reminder through email channel', async () => {
      const result = await reminderSchedulerService.sendReminder(
        appointmentId,
        '2h',
        ['email']
      );

      expect(result.appointmentId).toBe(appointmentId.toString());
      expect(result.reminderType).toBe('2h');
      expect(result.deliveryResults).toHaveLength(1);
      expect(result.deliveryResults[0].channel).toBe('email');
      expect(result.deliveryResults[0].success).toBe(true);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john.doe@example.com',
          subject: expect.stringContaining('Appointment Reminder'),
        })
      );
    });

    it('should send reminder through SMS channel', async () => {
      const result = await reminderSchedulerService.sendReminder(
        appointmentId,
        '2h',
        ['sms']
      );

      expect(result.deliveryResults[0].channel).toBe('sms');
      expect(result.deliveryResults[0].success).toBe(true);

      expect(sendSMS).toHaveBeenCalledTimes(1);
      expect(sendSMS).toHaveBeenCalledWith(
        '+1234567890',
        expect.stringContaining('Reminder')
      );
    });

    it('should send reminder through push notification channel', async () => {
      const result = await reminderSchedulerService.sendReminder(
        appointmentId,
        '15min',
        ['push']
      );

      expect(result.deliveryResults[0].channel).toBe('push');
      expect(result.deliveryResults[0].success).toBe(true);

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'appointment_reminder',
          priority: 'high',
        })
      );
    });

    it('should send reminder through multiple channels', async () => {
      const result = await reminderSchedulerService.sendReminder(
        appointmentId,
        '24h',
        ['email', 'sms', 'push']
      );

      expect(result.deliveryResults).toHaveLength(3);
      expect(result.deliveryResults.every((r) => r.success)).toBe(true);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendSMS).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    });

    it('should handle delivery failures gracefully', async () => {
      (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('Email service unavailable'));

      const result = await reminderSchedulerService.sendReminder(
        appointmentId,
        '2h',
        ['email', 'sms']
      );

      expect(result.deliveryResults).toHaveLength(2);
      expect(result.deliveryResults[0].success).toBe(false);
      expect(result.deliveryResults[0].error).toBe('Email service unavailable');
      expect(result.deliveryResults[1].success).toBe(true);
    });

    it('should update reminder status in appointment after sending', async () => {
      await reminderSchedulerService.sendReminder(appointmentId, '2h', ['email']);

      const updatedAppointment = await Appointment.findById(appointmentId);
      const reminder = updatedAppointment?.reminders[0];

      expect(reminder?.sent).toBe(true);
      expect(reminder?.sentAt).toBeDefined();
      expect(reminder?.deliveryStatus).toBe('delivered');
    });

    it('should mark reminder as failed if all deliveries fail', async () => {
      (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('Email failed'));
      (sendSMS as jest.Mock).mockRejectedValueOnce(new Error('SMS failed'));

      await reminderSchedulerService.sendReminder(appointmentId, '2h', ['email', 'sms']);

      const updatedAppointment = await Appointment.findById(appointmentId);
      const reminder = updatedAppointment?.reminders[0];

      expect(reminder?.deliveryStatus).toBe('failed');
      expect(reminder?.failureReason).toContain('Email failed');
      expect(reminder?.failureReason).toContain('SMS failed');
    });
  });

  describe('processPendingReminders', () => {
    it('should process all pending reminders that are due', async () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      // Create appointments with pending reminders
      await Appointment.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: 'MTM 1',
          scheduledDate: futureDate,
          scheduledTime: '10:00',
          duration: 30,
          status: 'scheduled',
          reminders: [
            {
              type: 'email',
              scheduledFor: new Date(now.getTime() - 60000), // 1 minute ago
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
          createdBy: pharmacistId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'health_check',
          title: 'Health Check',
          scheduledDate: futureDate,
          scheduledTime: '11:00',
          duration: 20,
          status: 'scheduled',
          reminders: [
            {
              type: 'email',
              scheduledFor: new Date(now.getTime() - 120000), // 2 minutes ago
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
          createdBy: pharmacistId,
        },
      ]);

      const result = await reminderSchedulerService.processPendingReminders();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should not process reminders that are not yet due', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'vaccination',
        title: 'Vaccination',
        scheduledDate: futureDate,
        scheduledTime: '14:00',
        duration: 15,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000), // 24h before
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.processPendingReminders();

      expect(result.processed).toBe(0);
    });

    it('should handle failures and continue processing other reminders', async () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      await Appointment.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: 'MTM 1',
          scheduledDate: futureDate,
          scheduledTime: '10:00',
          duration: 30,
          status: 'scheduled',
          reminders: [
            {
              type: 'email',
              scheduledFor: new Date(now.getTime() - 60000),
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
          createdBy: pharmacistId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'health_check',
          title: 'Health Check',
          scheduledDate: futureDate,
          scheduledTime: '11:00',
          duration: 20,
          status: 'scheduled',
          reminders: [
            {
              type: 'email',
              scheduledFor: new Date(now.getTime() - 120000),
              sent: false,
              deliveryStatus: 'pending',
            },
          ],
          createdBy: pharmacistId,
        },
      ]);

      // Make first reminder fail
      (sendEmail as jest.Mock)
        .mockRejectedValueOnce(new Error('Email failed'))
        .mockResolvedValueOnce(undefined);

      const result = await reminderSchedulerService.processPendingReminders();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('cancelAppointmentReminders', () => {
    it('should cancel all scheduled reminder jobs', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: futureDate,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000),
            sent: false,
            deliveryStatus: 'pending',
          },
          {
            type: 'email',
            scheduledFor: new Date(futureDate.getTime() - 2 * 60 * 60 * 1000),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
        createdBy: pharmacistId,
      });

      const result = await reminderSchedulerService.cancelAppointmentReminders(appointment._id);

      expect(result.cancelled).toBeGreaterThan(0);
      expect(QueueService.removeJob).toHaveBeenCalled();
    });

    it('should mark unsent reminders as cancelled in appointment', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'vaccination',
        title: 'Vaccination',
        scheduledDate: futureDate,
        scheduledTime: '14:00',
        duration: 15,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
        createdBy: pharmacistId,
      });

      await reminderSchedulerService.cancelAppointmentReminders(appointment._id);

      const updatedAppointment = await Appointment.findById(appointment._id);
      const reminder = updatedAppointment?.reminders[0];

      expect(reminder?.deliveryStatus).toBe('failed');
      expect(reminder?.failureReason).toBe('Appointment cancelled');
    });
  });

  describe('rescheduleReminders', () => {
    it('should cancel old reminders and schedule new ones', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() + 48);

      const appointment = await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'chronic_disease_review',
        title: 'Chronic Disease Review',
        scheduledDate: oldDate,
        scheduledTime: '10:00',
        duration: 45,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(oldDate.getTime() - 24 * 60 * 60 * 1000),
            sent: false,
            deliveryStatus: 'pending',
          },
        ],
        createdBy: pharmacistId,
      });

      const newDate = new Date();
      newDate.setHours(newDate.getHours() + 72);

      // Update appointment date
      appointment.scheduledDate = newDate;
      await appointment.save();

      const result = await reminderSchedulerService.rescheduleReminders(
        appointment._id,
        newDate
      );

      expect(result.remindersScheduled).toBeGreaterThan(0);
      expect(QueueService.removeJob).toHaveBeenCalled();
      expect(QueueService.scheduleJob).toHaveBeenCalled();
    });
  });
});
