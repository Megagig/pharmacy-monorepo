/**
 * Simplified unit tests for AppointmentService
 * Tests core methods without complex mocking
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import { AppointmentService } from '../../services/AppointmentService';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock all dependencies
jest.mock('../../models/Appointment');
jest.mock('../../models/PharmacistSchedule');
jest.mock('../../models/Patient');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

import Appointment from '../../models/Appointment';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import Patient from '../../models/Patient';
import User from '../../models/User';

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
      (Patient.findById as jest.Mock) = jest.fn().mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });

      // Mock pharmacist exists
      (User.findById as jest.Mock) = jest.fn().mockResolvedValue({
        _id: pharmacistId,
        name: 'Dr. Smith',
      });

      // Mock no conflict
      (Appointment as any).checkConflict = jest.fn().mockResolvedValue({
        hasConflict: false,
      });

      // Mock schedule
      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        canHandleAppointmentType: jest.fn().mockReturnValue(true),
      };
      (PharmacistSchedule as any).findCurrentSchedule = jest.fn().mockResolvedValue(mockSchedule);

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
    });

    it('should throw error if patient not found', async () => {
      (Patient.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      await expect(
        AppointmentService.createAppointment(validAppointmentData, workplaceId, userId)
      ).rejects.toThrow();
    });

    it('should throw error if scheduling in the past', async () => {
      const pastDate = new Date('2020-01-01');

      (Patient.findById as jest.Mock) = jest.fn().mockResolvedValue({
        _id: validAppointmentData.patientId,
        name: 'John Doe',
      });
      (User.findById as jest.Mock) = jest.fn().mockResolvedValue({
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

      (Appointment.find as jest.Mock) = jest.fn().mockReturnValue(mockQuery);
      (Appointment.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(2);

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

      (Appointment.findOne as jest.Mock) = jest.fn().mockResolvedValue(mockAppointment);

      await AppointmentService.updateAppointmentStatus(
        appointmentId,
        { status: 'confirmed' },
        userId,
        workplaceId
      );

      expect(mockAppointment.confirm).toHaveBeenCalled();
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error if outcome missing when completing', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'in_progress',
      };

      (Appointment.findOne as jest.Mock) = jest.fn().mockResolvedValue(mockAppointment);

      await expect(
        AppointmentService.updateAppointmentStatus(
          appointmentId,
          { status: 'completed' },
          userId,
          workplaceId
        )
      ).rejects.toThrow('Outcome is required');
    });
  });

  describe('rescheduleAppointment', () => {
    it('should throw error if rescheduling to past date', async () => {
      const appointmentId = new mongoose.Types.ObjectId();
      const mockAppointment = {
        _id: appointmentId,
        status: 'scheduled',
      };

      (Appointment.findOne as jest.Mock) = jest.fn().mockResolvedValue(mockAppointment);

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

      (Appointment.findOne as jest.Mock) = jest.fn().mockResolvedValue(mockAppointment);

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
  });
});
