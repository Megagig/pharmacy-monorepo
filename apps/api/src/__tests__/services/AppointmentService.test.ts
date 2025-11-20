/**
 * Unit tests for AppointmentService
 * Tests all core methods with edge cases
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import { AppointmentService } from '../../services/AppointmentService';
import Appointment, { IAppointment } from '../../models/Appointment';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import Patient from '../../models/Patient';
import User from '../../models/User';

// Mock uuid before any imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock dependencies
jest.mock('../../models/Appointment');
jest.mock('../../models/PharmacistSchedule');
jest.mock('../../models/Patient');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

// Import setup after mocks
import './setup.test';

// Type the mocked models
const MockedAppointment = Appointment as jest.Mocked<typeof Appointment> & {
  checkConflict: jest.Mock;
};
const MockedPharmacistSchedule = PharmacistSchedule as jest.Mocked<typeof PharmacistSchedule> & {
  findCurrentSchedule: jest.Mock;
};
const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedUser = User as jest.Mocked<typeof User>;

describe('AppointmentService', () => {
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    workplaceId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
  });

  describe('createAppointment', () => {
    const validAppointmentData = {
      patientId: new mongoose.Types.ObjectId(),
      type: 'mtm_session' as const,
      scheduledDate: new Date('2025-12-01'),
      scheduledTime: '10:00',
      duration: 30,
    };

    it('should create an appointment successfully', async () => {
      // Mock patient exists
      (Patient.findById as jest.Mock).mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });

      // Mock pharmacist exists
      (User.findById as jest.Mock).mockResolvedValue({
        _id: pharmacistId,
        name: 'Dr. Smith',
      });

      // Mock no conflict
      (Appointment.checkConflict as any) = jest.fn().mockResolvedValue({
        hasConflict: false,
      });

      // Mock schedule
      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        canHandleAppointmentType: jest.fn().mockReturnValue(true),
      };
      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      // Mock appointment save
      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(),
        ...validAppointmentData,
        assignedTo: pharmacistId,
        save: jest.fn().mockResolvedValue(true),
      };
      (Appointment as any).mockImplementation(() => mockAppointment);

      const result = await AppointmentService.createAppointment(
        validAppointmentData,
        workplaceId,
        userId
      );

      expect(result).toBeDefined();
      expect(mockAppointment.save).toHaveBeenCalled();
      expect(Patient.findById).toHaveBeenCalledWith(validAppointmentData.patientId);
      expect(User.findById).toHaveBeenCalledWith(pharmacistId);
    });

    it('should throw error if patient not found', async () => {
      (Patient.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.createAppointment(validAppointmentData, workplaceId, userId)
      ).rejects.toThrow('Patient');
    });

    it('should throw error if pharmacist not found', async () => {
      (Patient.findById as jest.Mock).mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.createAppointment(
          { ...validAppointmentData, assignedTo: pharmacistId },
          workplaceId,
          userId
        )
      ).rejects.toThrow('Pharmacist');
    });

    it('should throw error if scheduling in the past', async () => {
      const pastDate = new Date('2020-01-01');

      (Patient.findById as jest.Mock).mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: pharmacistId,
        name: 'Dr. Smith',
      });

      await expect(
        AppointmentService.createAppointment(
          { ...validAppointmentData, scheduledDate: pastDate },
          workplaceId,
          userId
        )
      ).rejects.toThrow('Cannot schedule appointments in the past');
    });

    it('should throw error if there is a conflict', async () => {
      (Patient.findById as jest.Mock).mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: pharmacistId,
        name: 'Dr. Smith',
      });
      (Appointment.checkConflict as jest.Mock).mockResolvedValue({
        hasConflict: true,
        conflictingAppointment: { title: 'Existing Appointment' },
      });

      await expect(
        AppointmentService.createAppointment(validAppointmentData, workplaceId, userId)
      ).rejects.toThrow('already has an appointment');
    });

    it('should throw error if pharmacist cannot handle appointment type', async () => {
      (Patient.findById as jest.Mock).mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: pharmacistId,
        name: 'Dr. Smith',
      });
      (Appointment.checkConflict as jest.Mock).mockResolvedValue({
        hasConflict: false,
      });

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        canHandleAppointmentType: jest.fn().mockReturnValue(false),
      };
      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      await expect(
        AppointmentService.createAppointment(validAppointmentData, workplaceId, userId)
      ).rejects.toThrow('not configured to handle');
    });
  });

  describe('getAppointments', () => {
    it('should get appointments with filters and pagination', async () => {
      const mockAppointments = [
        { _id: new mongoose.Types.ObjectId(), title: 'Appointment 1' },
        { _id: new mongoose.Types.ObjectId(), title: 'Appointment 2' },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockAppointments),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);
      (Appointment.countDocuments as jest.Mock).mockResolvedValue(2);

      const result = await AppointmentService.getAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        workplaceId
      );

      expect(result.appointments).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should handle multiple status filters', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);
      (Appointment.countDocuments as jest.Mock).mockResolvedValue(0);

      await AppointmentService.getAppointments(
        { status: ['scheduled', 'confirmed'] },
        { page: 1, limit: 10 },
        workplaceId
      );

      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: ['scheduled', 'confirmed'] },
        })
      );
    });

    it('should handle date range filters', async () => {
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-31');

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);
      (Appointment.countDocuments as jest.Mock).mockResolvedValue(0);

      await AppointmentService.getAppointments(
        { startDate, endDate },
        { page: 1, limit: 10 },
        workplaceId
      );

      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDate: { $gte: startDate, $lte: endDate },
        })
      );
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for a working day', async () => {
      const testDate = new Date('2025-12-01');

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        canHandleAppointmentType: jest.fn().mockReturnValue(true),
        getShiftsForDate: jest.fn().mockReturnValue([
          {
            startTime: '09:00',
            endTime: '12:00',
          },
        ]),
        appointmentPreferences: {
          bufferBetweenAppointments: 0,
        },
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (Appointment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const slots = await AppointmentService.getAvailableSlots(
        pharmacistId,
        testDate,
        30,
        workplaceId
      );

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('time');
      expect(slots[0]).toHaveProperty('available');
      expect(slots[0]).toHaveProperty('pharmacistId');
    });

    it('should return empty array for non-working day', async () => {
      const testDate = new Date('2025-12-01');

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(false),
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      const slots = await AppointmentService.getAvailableSlots(
        pharmacistId,
        testDate,
        30,
        workplaceId
      );

      expect(slots).toEqual([]);
    });

    it('should mark slots as unavailable when conflicting with existing appointments', async () => {
      const testDate = new Date('2025-12-01');

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        canHandleAppointmentType: jest.fn().mockReturnValue(true),
        getShiftsForDate: jest.fn().mockReturnValue([
          {
            startTime: '09:00',
            endTime: '12:00',
          },
        ]),
        appointmentPreferences: {
          bufferBetweenAppointments: 0,
        },
      };

      const existingAppointment = {
        scheduledTime: '10:00',
        duration: 30,
        get: jest.fn((field: string) => {
          if (field === 'appointmentDateTime') {
            const dt = new Date(testDate);
            dt.setHours(10, 0, 0, 0);
            return dt;
          }
          if (field === 'endDateTime') {
            const dt = new Date(testDate);
            dt.setHours(10, 30, 0, 0);
            return dt;
          }
          return null;
        }),
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (Appointment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([existingAppointment]),
      });

      const slots = await AppointmentService.getAvailableSlots(
        pharmacistId,
        testDate,
        30,
        workplaceId
      );

      const slot10am = slots.find(s => s.time === '10:00');
      expect(slot10am?.available).toBe(false);
    });

    it('should throw error if schedule not found', async () => {
      const testDate = new Date('2025-12-01');

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.getAvailableSlots(pharmacistId, testDate, 30, workplaceId)
      ).rejects.toThrow('Pharmacist schedule');
    });
  });

  describe('updateAppointmentStatus', () => {
    it('should update status to confirmed', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        confirm: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await AppointmentService.updateAppointmentStatus(
        appointmentId,
        { status: 'confirmed' },
        userId,
        workplaceId
      );

      expect(mockAppointment.confirm).toHaveBeenCalled();
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should update status to completed with outcome', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'in_progress',
        complete: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      const outcome = {
        status: 'successful' as const,
        notes: 'Completed successfully',
        nextActions: [],
        visitCreated: false,
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await AppointmentService.updateAppointmentStatus(
        appointmentId,
        { status: 'completed', outcome },
        userId,
        workplaceId
      );

      expect(mockAppointment.complete).toHaveBeenCalledWith(outcome);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error if outcome missing when completing', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'in_progress',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await expect(
        AppointmentService.updateAppointmentStatus(
          appointmentId,
          { status: 'completed' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Outcome is required');
    });

    it('should update status to cancelled with reason', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        cancel: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await AppointmentService.updateAppointmentStatus(
        appointmentId,
        { status: 'cancelled', reason: 'Patient requested' },
        userId,
        workplaceId
      );

      expect(mockAppointment.cancel).toHaveBeenCalledWith('Patient requested', userId);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error if reason missing when cancelling', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await expect(
        AppointmentService.updateAppointmentStatus(
          appointmentId,
          { status: 'cancelled' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Reason is required');
    });

    it('should throw error for invalid status transition', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'completed',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await expect(
        AppointmentService.updateAppointmentStatus(
          appointmentId,
          { status: 'scheduled' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw error if appointment not found', async () => {
      const appointmentId = new mongoose.Types.ObjectId();

      (Appointment.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.updateAppointmentStatus(
          appointmentId,
          { status: 'confirmed' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Appointment');
    });
  });

  describe('rescheduleAppointment', () => {
    it('should reschedule appointment successfully', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        assignedTo: pharmacistId,
        duration: 30,
        reschedule: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);
      (Appointment.checkConflict as jest.Mock).mockResolvedValue({
        hasConflict: false,
      });

      const newDate = new Date('2025-12-15');
      const newTime = '14:00';

      await AppointmentService.rescheduleAppointment(
        appointmentId,
        { newDate, newTime, reason: 'Patient requested' },
        userId,
        workplaceId
      );

      expect(mockAppointment.reschedule).toHaveBeenCalledWith(
        newDate,
        newTime,
        'Patient requested',
        userId
      );
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error if rescheduling to past date', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      const pastDate = new Date('2020-01-01');

      await expect(
        AppointmentService.rescheduleAppointment(
          appointmentId,
          { newDate: pastDate, newTime: '10:00', reason: 'Test' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Cannot reschedule to a past date');
    });

    it('should throw error if new time has conflict', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        assignedTo: pharmacistId,
        duration: 30,
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);
      (Appointment.checkConflict as jest.Mock).mockResolvedValue({
        hasConflict: true,
        conflictingAppointment: { title: 'Existing Appointment' },
      });

      const newDate = new Date('2025-12-15');

      await expect(
        AppointmentService.rescheduleAppointment(
          appointmentId,
          { newDate, newTime: '10:00', reason: 'Test' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('already has an appointment');
    });

    it('should throw error if appointment cannot be rescheduled', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'completed',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      const newDate = new Date('2025-12-15');

      await expect(
        AppointmentService.rescheduleAppointment(
          appointmentId,
          { newDate, newTime: '10:00', reason: 'Test' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Cannot reschedule appointment');
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel single appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        isRecurring: false,
        cancel: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      const result = await AppointmentService.cancelAppointment(
        appointmentId,
        { reason: 'Patient requested' },
        userId,
        workplaceId
      );

      expect(result.cancelledCount).toBe(1);
      expect(mockAppointment.cancel).toHaveBeenCalledWith('Patient requested', userId);
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should cancel all future recurring appointments', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const seriesId = new mongoose.Types.ObjectId();

      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
        isRecurring: true,
        recurringSeriesId: seriesId,
        scheduledDate: new Date('2025-12-01'),
        cancel: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      const futureAppointments = [
        {
          _id: new mongoose.Types.ObjectId(),
          cancel: jest.fn(),
          save: jest.fn().mockResolvedValue(true),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          cancel: jest.fn(),
          save: jest.fn().mockResolvedValue(true),
        },
      ];

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);
      (Appointment.find as jest.Mock).mockResolvedValue(futureAppointments);

      const result = await AppointmentService.cancelAppointment(
        appointmentId,
        { reason: 'Series cancelled', cancelType: 'all_future' },
        userId,
        workplaceId
      );

      expect(result.cancelledCount).toBe(2);
      expect(futureAppointments[0].cancel).toHaveBeenCalled();
      expect(futureAppointments[1].cancel).toHaveBeenCalled();
    });

    it('should throw error if appointment cannot be cancelled', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'completed',
      };

      (Appointment.findOne as jest.Mock).mockResolvedValue(mockAppointment);

      await expect(
        AppointmentService.cancelAppointment(
          appointmentId,
          { reason: 'Test' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Cannot cancel appointment');
    });

    it('should throw error if appointment not found', async () => {
      const appointmentId = new mongoose.Types.ObjectId();

      (Appointment.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.cancelAppointment(
          appointmentId,
          { reason: 'Test' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Appointment');
    });
  });
});
