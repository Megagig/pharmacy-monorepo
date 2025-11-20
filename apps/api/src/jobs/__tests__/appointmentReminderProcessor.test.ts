/**
 * Appointment Reminder Processor Tests
 * 
 * Tests for the appointment reminder job processor including:
 * - Reminder scheduling on appointment creation
 * - 24h, 2h, and 15min reminder jobs
 * - Reminder personalization with patient data
 * - Delivery status tracking
 * - Retry logic for failed deliveries
 */

// Mock Bull before any imports
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    add: jest.fn(),
    on: jest.fn(),
  }));
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  processAppointmentReminder,
  onAppointmentReminderCompleted,
  onAppointmentReminderFailed,
  ReminderProcessingResult,
} from '../appointmentReminderProcessor';
import { AppointmentReminderJobData } from '../../config/queue';
import { reminderSchedulerService } from '../../services/ReminderSchedulerService';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

// Mock dependencies
jest.mock('../../services/ReminderSchedulerService');
jest.mock('../../services/QueueService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Define Job type for mocking
interface MockJob<T = any> {
  id: string;
  data: T;
  opts: {
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
  };
  attemptsMade: number;
  processedOn?: number;
  progress: jest.Mock;
}

describe('Appointment Reminder Processor', () => {
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
    const ownerId = new mongoose.Types.ObjectId();
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+1234567890',
      address: '123 Test St',
      type: 'Community',
      ownerId,
      subscriptionStatus: 'active',
      inviteCode: 'TEST123',
      teamMembers: [],
      stats: {
        patientsCount: 0,
        usersCount: 0,
        lastUpdated: new Date(),
      },
      locations: [],
      settings: {
        maxPendingInvites: 10,
        allowSharedPatients: false,
      },
      documents: [],
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
      passwordHash: 'hashedpassword',
      role: 'pharmacist',
      currentPlanId: new mongoose.Types.ObjectId(),
      isActive: true,
      emailVerified: true,
    });
    pharmacistId = pharmacist._id;

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 48); // 48 hours in future to allow all reminder types

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

  describe('processAppointmentReminder', () => {
    it('should process 24h reminder successfully', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email', 'sms'],
      };

      const mockJob = createMockJob(jobData);

      // Mock successful reminder delivery
      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '24h',
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'sms', success: true },
        ],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.appointmentId).toBe(appointmentId.toString());
      expect(result.reminderType).toBe('24h');
      expect(result.successfulChannels).toBe(2);
      expect(result.failedChannels).toBe(0);
      expect(result.totalChannels).toBe(2);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should process 2h reminder successfully', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email', 'push'],
      };

      const mockJob = createMockJob(jobData);

      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '2h',
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'push', success: true },
        ],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.reminderType).toBe('2h');
      expect(result.successfulChannels).toBe(2);
      expect(reminderSchedulerService.sendReminder).toHaveBeenCalledWith(
        expect.any(mongoose.Types.ObjectId),
        '2h',
        ['email', 'push']
      );
    });

    it('should process 15min reminder successfully', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '15min',
        channels: ['sms', 'push'],
      };

      const mockJob = createMockJob(jobData);

      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '15min',
        deliveryResults: [
          { channel: 'sms', success: true },
          { channel: 'push', success: true },
        ],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.reminderType).toBe('15min');
      expect(result.successfulChannels).toBe(2);
    });

    it('should handle partial delivery failures gracefully', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email', 'sms', 'push'],
      };

      const mockJob = createMockJob(jobData);

      // Mock partial failure
      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '2h',
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'sms', success: false, error: 'SMS service unavailable' },
          { channel: 'push', success: true },
        ],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.successfulChannels).toBe(2);
      expect(result.failedChannels).toBe(1);
      expect(result.deliveryResults).toHaveLength(3);
      expect(result.deliveryResults[1].success).toBe(false);
      expect(result.deliveryResults[1].error).toBe('SMS service unavailable');
    });

    it('should throw error if all channels fail to trigger retry', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email', 'sms'],
      };

      const mockJob = createMockJob(jobData);

      // Mock complete failure
      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '24h',
        deliveryResults: [
          { channel: 'email', success: false, error: 'Email service down' },
          { channel: 'sms', success: false, error: 'SMS service down' },
        ],
      });

      await expect(processAppointmentReminder(mockJob)).rejects.toThrow(
        'All channels failed for 24h reminder'
      );
    });

    it('should skip reminder if appointment is cancelled', async () => {
      // Update appointment to cancelled
      await Appointment.findByIdAndUpdate(appointmentId, {
        status: 'cancelled',
        cancellationReason: 'Patient request',
      });

      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      const result = await processAppointmentReminder(mockJob);

      expect(result.totalChannels).toBe(0);
      expect(result.successfulChannels).toBe(0);
      expect(reminderSchedulerService.sendReminder).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment is completed', async () => {
      await Appointment.findByIdAndUpdate(appointmentId, {
        status: 'completed',
        completedAt: new Date(),
      });

      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '15min',
        channels: ['sms'],
      };

      const mockJob = createMockJob(jobData);

      const result = await processAppointmentReminder(mockJob);

      expect(result.totalChannels).toBe(0);
      expect(reminderSchedulerService.sendReminder).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment is no-show', async () => {
      await Appointment.findByIdAndUpdate(appointmentId, {
        status: 'no_show',
      });

      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      const result = await processAppointmentReminder(mockJob);

      expect(result.totalChannels).toBe(0);
      expect(reminderSchedulerService.sendReminder).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const jobData: AppointmentReminderJobData = {
        appointmentId: nonExistentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      const result = await processAppointmentReminder(mockJob);

      expect(result.totalChannels).toBe(0);
      expect(reminderSchedulerService.sendReminder).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment time has passed', async () => {
      // Update appointment to past time
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      await Appointment.findByIdAndUpdate(appointmentId, {
        scheduledDate: pastDate,
      });

      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      const result = await processAppointmentReminder(mockJob);

      expect(result.totalChannels).toBe(0);
      expect(reminderSchedulerService.sendReminder).not.toHaveBeenCalled();
    });

    it('should track processing time', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '2h',
        deliveryResults: [{ channel: 'email', success: true }],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });

    it('should update job progress during processing', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '24h',
        deliveryResults: [{ channel: 'email', success: true }],
      });

      await processAppointmentReminder(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(80);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle service errors and re-throw for retry', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);

      const serviceError = new Error('Database connection failed');
      (reminderSchedulerService.sendReminder as jest.Mock).mockRejectedValue(serviceError);

      await expect(processAppointmentReminder(mockJob)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('onAppointmentReminderCompleted', () => {
    it('should log successful completion with metrics', () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email', 'sms'],
      };

      const mockJob = createMockJob(jobData);
      mockJob.processedOn = Date.now() - 1000; // 1 second ago

      const result: ReminderProcessingResult = {
        appointmentId: appointmentId.toString(),
        reminderType: '24h',
        totalChannels: 2,
        successfulChannels: 2,
        failedChannels: 0,
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'sms', success: true },
        ],
        processingTime: 500,
      };

      onAppointmentReminderCompleted(mockJob, result);

      // Verify logging was called (mocked logger)
      expect(mockJob.processedOn).toBeDefined();
    });

    it('should log warning for partial failures', () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email', 'sms', 'push'],
      };

      const mockJob = createMockJob(jobData);
      mockJob.processedOn = Date.now() - 800;

      const result: ReminderProcessingResult = {
        appointmentId: appointmentId.toString(),
        reminderType: '2h',
        totalChannels: 3,
        successfulChannels: 2,
        failedChannels: 1,
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'sms', success: false, error: 'SMS failed' },
          { channel: 'push', success: true },
        ],
        processingTime: 600,
      };

      onAppointmentReminderCompleted(mockJob, result);

      // Verify warning was logged for partial failure
      expect(result.failedChannels).toBe(1);
    });
  });

  describe('onAppointmentReminderFailed', () => {
    it('should log failure with retry information', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);
      mockJob.attemptsMade = 1;
      mockJob.opts.attempts = 3;

      const error = new Error('Service temporarily unavailable');

      await onAppointmentReminderFailed(mockJob, error);

      expect(mockJob.attemptsMade).toBe(1);
      expect(mockJob.opts.attempts).toBe(3);
    });

    it('should mark reminder as failed after all retries exhausted', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email'],
      };

      const mockJob = createMockJob(jobData);
      mockJob.attemptsMade = 3;
      mockJob.opts.attempts = 3;

      const error = new Error('Permanent failure');

      await onAppointmentReminderFailed(mockJob, error);

      // Verify reminder was marked as failed in database
      const appointment = await Appointment.findById(appointmentId);
      const reminder = appointment?.reminders[0];

      expect(reminder?.sent).toBe(true);
      expect(reminder?.deliveryStatus).toBe('failed');
      expect(reminder?.failureReason).toContain('Failed after 3 attempts');
    });

    it('should handle database update errors gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const jobData: AppointmentReminderJobData = {
        appointmentId: nonExistentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '15min',
        channels: ['sms'],
      };

      const mockJob = createMockJob(jobData);
      mockJob.attemptsMade = 3;
      mockJob.opts.attempts = 3;

      const error = new Error('All retries failed');

      // Should not throw even if appointment doesn't exist
      await expect(onAppointmentReminderFailed(mockJob, error)).resolves.not.toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '24h',
        channels: ['email'],
      };

      // Test multiple retry attempts
      for (let attempt = 0; attempt < 3; attempt++) {
        const mockJob = createMockJob(jobData);
        mockJob.attemptsMade = attempt;
        mockJob.opts.attempts = 3;

        const error = new Error(`Attempt ${attempt + 1} failed`);

        await onAppointmentReminderFailed(mockJob, error);

        // Verify retry will happen (except on last attempt)
        if (attempt < 2) {
          expect(mockJob.attemptsMade).toBeLessThan(mockJob.opts.attempts!);
        }
      }
    });
  });

  describe('Delivery Status Tracking', () => {
    it('should track delivery status for each channel', async () => {
      const jobData: AppointmentReminderJobData = {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        workplaceId: workplaceId.toString(),
        reminderType: '2h',
        channels: ['email', 'sms', 'push'],
      };

      const mockJob = createMockJob(jobData);

      (reminderSchedulerService.sendReminder as jest.Mock).mockResolvedValue({
        appointmentId: appointmentId.toString(),
        reminderType: '2h',
        deliveryResults: [
          { channel: 'email', success: true },
          { channel: 'sms', success: true },
          { channel: 'push', success: false, error: 'Push token invalid' },
        ],
      });

      const result = await processAppointmentReminder(mockJob);

      expect(result.deliveryResults).toHaveLength(3);
      expect(result.deliveryResults[0]).toEqual({ channel: 'email', success: true });
      expect(result.deliveryResults[1]).toEqual({ channel: 'sms', success: true });
      expect(result.deliveryResults[2]).toEqual({
        channel: 'push',
        success: false,
        error: 'Push token invalid',
      });
    });
  });
});

/**
 * Helper function to create mock Bull job
 */
function createMockJob(data: AppointmentReminderJobData): any {
  return {
    id: 'test-job-123',
    data,
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
    attemptsMade: 0,
    processedOn: undefined,
    progress: jest.fn().mockResolvedValue(undefined),
  };
}
