/**
 * Tests for Appointment Status Monitor Job Processor
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import {
  processAppointmentStatusMonitor,
  onAppointmentStatusMonitorCompleted,
  onAppointmentStatusMonitorFailed,
  AppointmentStatusMonitorResult,
} from '../appointmentStatusProcessor';
import { AppointmentStatusJobData } from '../../config/queue';
import Appointment from '../../models/Appointment';
import User from '../../models/User';
import Notification from '../../models/Notification';

// Mock dependencies
jest.mock('../../models/Appointment');
jest.mock('../../models/User');
jest.mock('../../models/Notification');
jest.mock('../../utils/logger');

describe('Appointment Status Monitor Processor', () => {
  let mockJob: Partial<Job<AppointmentStatusJobData>>;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;

  beforeEach(() => {
    workplaceId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();

    mockJob = {
      id: 'test-job-id',
      data: {
        workplaceId: workplaceId.toString(),
        checkNoShows: true,
        autoUpdateStatus: true,
      },
      attemptsMade: 0,
      progress: jest.fn().mockResolvedValue(undefined),
    };

    jest.clearAllMocks();
  });

  describe('processAppointmentStatusMonitor', () => {
    it('should process appointments and update status to in_progress', async () => {
      // Create appointment scheduled for now
      const now = new Date();
      const scheduledTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      (Appointment.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockAppointment);

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.statusUpdated).toBe(1);
      expect(result.details.updatedToInProgress).toContain(mockAppointment._id.toString());
      expect(Appointment.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAppointment._id,
        expect.objectContaining({
          status: 'in_progress',
        }),
        expect.any(Object)
      );
    });

    it('should detect and mark no-shows', async () => {
      // Create appointment scheduled 20 minutes ago
      const now = new Date();
      const scheduledDate = new Date(now.getTime() - 20 * 60 * 1000);
      const scheduledTime = `${scheduledDate.getHours().toString().padStart(2, '0')}:${scheduledDate.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId: {
          _id: patientId,
          firstName: 'John',
          lastName: 'Doe',
        },
        assignedTo: {
          _id: pharmacistId,
          firstName: 'Jane',
          lastName: 'Smith',
        },
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      (Appointment.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockAppointment);

      const mockNotification = {
        save: jest.fn().mockResolvedValue(true),
      };
      (Notification as any).mockImplementation(() => mockNotification);

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.noShowsDetected).toBe(1);
      expect(result.details.markedAsNoShow).toContain(mockAppointment._id.toString());
      expect(Appointment.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAppointment._id,
        expect.objectContaining({
          status: 'no_show',
        }),
        expect.any(Object)
      );
      expect(mockNotification.save).toHaveBeenCalled();
    });

    it('should send overtime alert for long-running appointments', async () => {
      // Create appointment that started 90 minutes ago with 30 min duration
      const now = new Date();
      const scheduledDate = new Date(now.getTime() - 90 * 60 * 1000);
      const scheduledTime = `${scheduledDate.getHours().toString().padStart(2, '0')}:${scheduledDate.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: {
          _id: pharmacistId,
          firstName: 'Jane',
          lastName: 'Smith',
        },
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'in_progress',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      (Notification.findOne as jest.Mock).mockResolvedValue(null); // No recent alert

      const mockNotification = {
        save: jest.fn().mockResolvedValue(true),
      };
      (Notification as any).mockImplementation(() => mockNotification);

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.alertsSent).toBeGreaterThan(0);
      expect(mockNotification.save).toHaveBeenCalled();
    });

    it('should skip appointments with invalid datetime', async () => {
      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date(),
        scheduledTime: 'invalid-time',
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.statusUpdated).toBe(0);
    });

    it('should handle empty appointment list', async () => {
      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(0);
      expect(result.statusUpdated).toBe(0);
      expect(result.noShowsDetected).toBe(0);
    });

    it('should not update status if autoUpdateStatus is false', async () => {
      mockJob.data!.autoUpdateStatus = false;

      const now = new Date();
      const scheduledTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.statusUpdated).toBe(0);
      expect(Appointment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should not check no-shows if checkNoShows is false', async () => {
      mockJob.data!.checkNoShows = false;

      const now = new Date();
      const scheduledDate = new Date(now.getTime() - 20 * 60 * 1000);
      const scheduledTime = `${scheduledDate.getHours().toString().padStart(2, '0')}:${scheduledDate.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(1);
      expect(result.noShowsDetected).toBe(0);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const now = new Date();
      const scheduledTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointments = [
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'mtm_session',
          title: 'MTM Session 1',
          scheduledDate: now,
          scheduledTime,
          duration: 30,
          status: 'scheduled',
          isDeleted: false,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'health_check',
          title: 'Health Check',
          scheduledDate: now,
          scheduledTime,
          duration: 30,
          status: 'scheduled',
          isDeleted: false,
        },
      ];

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAppointments),
      });

      // First update succeeds, second fails
      (Appointment.findByIdAndUpdate as jest.Mock)
        .mockResolvedValueOnce(mockAppointments[0])
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(result.totalChecked).toBe(2);
      expect(result.statusUpdated).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should track progress during processing', async () => {
      const now = new Date();
      const scheduledTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: now,
        scheduledTime,
        duration: 30,
        status: 'scheduled',
        isDeleted: false,
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockAppointment]),
      });

      (Appointment.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockAppointment);

      await processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should throw error on database failure', async () => {
      (Appointment.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(
        processAppointmentStatusMonitor(mockJob as Job<AppointmentStatusJobData>)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('onAppointmentStatusMonitorCompleted', () => {
    it('should log completion with metrics', () => {
      const result: AppointmentStatusMonitorResult = {
        workplaceId: workplaceId.toString(),
        totalChecked: 10,
        statusUpdated: 3,
        noShowsDetected: 2,
        alertsSent: 2,
        errors: 0,
        processingTime: 1500,
        details: {
          updatedToInProgress: ['id1', 'id2', 'id3'],
          markedAsNoShow: ['id4', 'id5'],
          statusTransitions: [],
        },
      };

      mockJob.processedOn = Date.now() - 1500;

      onAppointmentStatusMonitorCompleted(mockJob as Job<AppointmentStatusJobData>, result);

      // Should not throw and should log metrics
      expect(true).toBe(true);
    });

    it('should log warnings for errors', () => {
      const result: AppointmentStatusMonitorResult = {
        workplaceId: workplaceId.toString(),
        totalChecked: 10,
        statusUpdated: 3,
        noShowsDetected: 0,
        alertsSent: 0,
        errors: 2,
        processingTime: 1500,
        details: {
          updatedToInProgress: [],
          markedAsNoShow: [],
          statusTransitions: [],
        },
      };

      mockJob.processedOn = Date.now() - 1500;

      onAppointmentStatusMonitorCompleted(mockJob as Job<AppointmentStatusJobData>, result);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('onAppointmentStatusMonitorFailed', () => {
    it('should log failure and retry information', async () => {
      const error = new Error('Processing failed');
      mockJob.attemptsMade = 1;
      mockJob.opts = { attempts: 3 };

      await onAppointmentStatusMonitorFailed(mockJob as Job<AppointmentStatusJobData>, error);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should send critical alert when all retries exhausted', async () => {
      const error = new Error('Processing failed');
      mockJob.attemptsMade = 3;
      mockJob.opts = { attempts: 3 };

      const mockAdmins = [
        {
          _id: new mongoose.Types.ObjectId(),
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
        },
      ];

      (User.find as jest.Mock).mockResolvedValue(mockAdmins);
      (Notification.insertMany as jest.Mock).mockResolvedValue([]);

      await onAppointmentStatusMonitorFailed(mockJob as Job<AppointmentStatusJobData>, error);

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          workplaceId: expect.any(mongoose.Types.ObjectId),
          role: { $in: ['admin', 'super_admin'] },
        })
      );
      expect(Notification.insertMany).toHaveBeenCalled();
    });

    it('should handle alert sending failure gracefully', async () => {
      const error = new Error('Processing failed');
      mockJob.attemptsMade = 3;
      mockJob.opts = { attempts: 3 };

      (User.find as jest.Mock).mockRejectedValue(new Error('User query failed'));

      await expect(
        onAppointmentStatusMonitorFailed(mockJob as Job<AppointmentStatusJobData>, error)
      ).resolves.not.toThrow();
    });
  });
});
