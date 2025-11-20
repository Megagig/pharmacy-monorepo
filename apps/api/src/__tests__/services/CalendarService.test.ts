/**
 * CalendarService Unit Tests
 * Tests calendar view generation, slot calculation, and capacity metrics
 * Requirements: 1.1, 1.3, 8.1, 8.2, 8.3
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import { CalendarService } from '../../services/CalendarService';
import Appointment from '../../models/Appointment';
import PharmacistSchedule from '../../models/PharmacistSchedule';

// Mock dependencies
jest.mock('../../models/Appointment');
jest.mock('../../models/PharmacistSchedule');
jest.mock('../../utils/logger');

describe('CalendarService', () => {
  const mockWorkplaceId = new mongoose.Types.ObjectId();
  const mockPharmacistId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCalendarView', () => {
    it('should get day view appointments', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const mockAppointments = [
        {
          _id: new mongoose.Types.ObjectId(),
          scheduledDate: date,
          scheduledTime: '10:00',
          duration: 30,
          title: 'MTM Session',
          type: 'mtm_session',
          status: 'scheduled',
        },
        {
          _id: new mongoose.Types.ObjectId(),
          scheduledDate: date,
          scheduledTime: '14:00',
          duration: 45,
          title: 'Health Check',
          type: 'health_check',
          status: 'confirmed',
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockAppointments),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);

      // Act
      const result = await CalendarService.getCalendarView(
        'day',
        date,
        mockWorkplaceId,
        { pharmacistId: mockPharmacistId }
      );

      // Assert
      expect(result.view).toBe('day');
      expect(result.date).toEqual(date);
      expect(result.appointments).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.byStatus.scheduled).toBe(1);
      expect(result.summary.byStatus.confirmed).toBe(1);
    });

    it('should get week view appointments', async () => {
      // Arrange
      const date = new Date('2025-12-01'); // Monday
      const mockAppointments = [
        {
          _id: new mongoose.Types.ObjectId(),
          scheduledDate: new Date('2025-12-01'),
          scheduledTime: '10:00',
          duration: 30,
          title: 'Monday Appointment',
        },
        {
          _id: new mongoose.Types.ObjectId(),
          scheduledDate: new Date('2025-12-03'),
          scheduledTime: '14:00',
          duration: 30,
          title: 'Wednesday Appointment',
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockAppointments),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);

      // Act
      const result = await CalendarService.getCalendarView(
        'week',
        date,
        mockWorkplaceId
      );

      // Assert
      expect(result.view).toBe('week');
      expect(result.appointments).toHaveLength(2);
      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDate: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        })
      );
    });

    it('should get month view appointments', async () => {
      // Arrange
      const date = new Date('2025-12-15');
      const mockAppointments = [];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockAppointments),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);

      // Act
      const result = await CalendarService.getCalendarView(
        'month',
        date,
        mockWorkplaceId
      );

      // Assert
      expect(result.view).toBe('month');
      expect(result.appointments).toHaveLength(0);
      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDate: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        })
      );
    });

    it('should filter by pharmacist when provided', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);

      // Act
      await CalendarService.getCalendarView(
        'day',
        date,
        mockWorkplaceId,
        { pharmacistId: mockPharmacistId }
      );

      // Assert
      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: mockPharmacistId,
        })
      );
    });

    it('should filter by location when provided', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const locationId = 'location-123';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      (Appointment.find as jest.Mock).mockReturnValue(mockQuery);

      // Act
      await CalendarService.getCalendarView(
        'day',
        date,
        mockWorkplaceId,
        { locationId }
      );

      // Assert
      expect(Appointment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId,
        })
      );
    });
  });

  describe('calculateAvailableSlots', () => {
    it('should calculate available slots correctly', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const duration = 30;

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
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

      const mockExistingAppointments = [
        {
          scheduledTime: '10:00',
          duration: 30,
          get: jest.fn((field: string) => {
            if (field === 'appointmentDateTime') {
              const dt = new Date(date);
              dt.setHours(10, 0, 0, 0);
              return dt;
            }
            if (field === 'endDateTime') {
              const dt = new Date(date);
              dt.setHours(10, 30, 0, 0);
              return dt;
            }
            return null;
          }),
        },
      ];

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (Appointment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExistingAppointments),
      });

      // Act
      const slots = await CalendarService.calculateAvailableSlots(
        mockPharmacistId,
        date,
        duration,
        mockWorkplaceId
      );

      // Assert
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.some(s => s.time === '09:00' && s.available)).toBe(true);
      expect(slots.some(s => s.time === '10:00' && !s.available)).toBe(true);
    });

    it('should return empty array for non-working day', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const duration = 30;

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(false),
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      // Act
      const slots = await CalendarService.calculateAvailableSlots(
        mockPharmacistId,
        date,
        duration,
        mockWorkplaceId
      );

      // Assert
      expect(slots).toEqual([]);
    });

    it('should handle break times correctly', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const duration = 30;

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        getShiftsForDate: jest.fn().mockReturnValue([
          {
            startTime: '09:00',
            endTime: '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
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

      // Act
      const slots = await CalendarService.calculateAvailableSlots(
        mockPharmacistId,
        date,
        duration,
        mockWorkplaceId
      );

      // Assert
      // Should not have slots during break time (12:00-13:00)
      expect(slots.some(s => s.time === '12:00')).toBe(false);
      expect(slots.some(s => s.time === '12:15')).toBe(false);
      expect(slots.some(s => s.time === '12:30')).toBe(false);
      expect(slots.some(s => s.time === '12:45')).toBe(false);
    });

    it('should apply buffer time between appointments', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const duration = 30;

      const mockSchedule = {
        isWorkingOn: jest.fn().mockReturnValue(true),
        getShiftsForDate: jest.fn().mockReturnValue([
          {
            startTime: '09:00',
            endTime: '12:00',
          },
        ]),
        appointmentPreferences: {
          bufferBetweenAppointments: 15, // 15 minute buffer
        },
      };

      const mockExistingAppointments = [
        {
          scheduledTime: '10:00',
          duration: 30,
          get: jest.fn((field: string) => {
            if (field === 'appointmentDateTime') {
              const dt = new Date(date);
              dt.setHours(10, 0, 0, 0);
              return dt;
            }
            if (field === 'endDateTime') {
              const dt = new Date(date);
              dt.setHours(10, 30, 0, 0);
              return dt;
            }
            return null;
          }),
        },
      ];

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (Appointment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockExistingAppointments),
      });

      // Act
      const slots = await CalendarService.calculateAvailableSlots(
        mockPharmacistId,
        date,
        duration,
        mockWorkplaceId
      );

      // Assert
      // Slots should be unavailable until 10:45 (10:30 + 15 min buffer)
      expect(slots.some(s => s.time === '10:30' && !s.available)).toBe(true);
    });

    it('should throw error if schedule not found', async () => {
      // Arrange
      const date = new Date('2025-12-01');
      const duration = 30;

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        CalendarService.calculateAvailableSlots(
          mockPharmacistId,
          date,
          duration,
          mockWorkplaceId
        )
      ).rejects.toThrow('Pharmacist schedule');
    });
  });

  describe('getPharmacistAvailability', () => {
    it('should get pharmacist availability for date range', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');

      const mockSchedule = {
        workingHours: [
          { dayOfWeek: 1, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 2, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 3, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 4, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 5, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 6, isWorkingDay: false, shifts: [] },
          { dayOfWeek: 0, isWorkingDay: false, shifts: [] },
        ],
        timeOff: [],
        isWorkingOn: jest.fn().mockImplementation((date: Date) => {
          const dayOfWeek = date.getDay();
          return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
        }),
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      // Act
      const availability = await CalendarService.getPharmacistAvailability(
        mockPharmacistId,
        startDate,
        endDate,
        mockWorkplaceId
      );

      // Assert
      expect(availability.pharmacistId).toEqual(mockPharmacistId);
      expect(availability.dateRange.start).toEqual(startDate);
      expect(availability.dateRange.end).toEqual(endDate);
      expect(availability.workingDays).toHaveLength(5); // Monday to Friday
      expect(availability.timeOff).toHaveLength(0);
    });

    it('should include time off in availability', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');

      const mockSchedule = {
        workingHours: [
          { dayOfWeek: 1, isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '17:00' }] },
        ],
        timeOff: [
          {
            startDate: new Date('2025-12-03'),
            endDate: new Date('2025-12-03'),
            reason: 'Personal leave',
            type: 'personal',
            status: 'approved',
          },
        ],
        isWorkingOn: jest.fn().mockImplementation((date: Date) => {
          const timeOffDate = new Date('2025-12-03');
          return date.getTime() !== timeOffDate.getTime();
        }),
      };

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(mockSchedule);

      // Act
      const availability = await CalendarService.getPharmacistAvailability(
        mockPharmacistId,
        startDate,
        endDate,
        mockWorkplaceId
      );

      // Assert
      expect(availability.timeOff).toHaveLength(1);
      expect(availability.timeOff[0].reason).toBe('Personal leave');
    });

    it('should throw error if schedule not found', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');

      (PharmacistSchedule.findCurrentSchedule as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        CalendarService.getPharmacistAvailability(
          mockPharmacistId,
          startDate,
          endDate,
          mockWorkplaceId
        )
      ).rejects.toThrow('Pharmacist schedule');
    });
  });

  describe('getCapacityMetrics', () => {
    it('should calculate capacity metrics correctly', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');

      const mockSchedules = [
        {
          pharmacistId: mockPharmacistId,
          appointmentPreferences: {
            maxAppointmentsPerDay: 16,
          },
          getWorkingDaysInRange: jest.fn().mockReturnValue(5),
          getTotalHoursInRange: jest.fn().mockReturnValue(40),
        },
      ];

      const mockAppointments = [
        { assignedTo: mockPharmacistId, duration: 30 },
        { assignedTo: mockPharmacistId, duration: 45 },
        { assignedTo: mockPharmacistId, duration: 30 },
      ];

      (PharmacistSchedule.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAppointments),
      });

      // Act
      const metrics = await CalendarService.getCapacityMetrics(
        startDate,
        endDate,
        mockWorkplaceId
      );

      // Assert
      expect(metrics.dateRange.start).toEqual(startDate);
      expect(metrics.dateRange.end).toEqual(endDate);
      expect(metrics.overall.totalPharmacists).toBe(1);
      expect(metrics.overall.totalAppointments).toBe(3);
      expect(metrics.byPharmacist).toHaveLength(1);
      expect(metrics.byPharmacist[0].pharmacistId).toEqual(mockPharmacistId);
    });

    it('should handle multiple pharmacists', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');
      const pharmacist2Id = new mongoose.Types.ObjectId();

      const mockSchedules = [
        {
          pharmacistId: mockPharmacistId,
          appointmentPreferences: { maxAppointmentsPerDay: 16 },
          getWorkingDaysInRange: jest.fn().mockReturnValue(5),
          getTotalHoursInRange: jest.fn().mockReturnValue(40),
        },
        {
          pharmacistId: pharmacist2Id,
          appointmentPreferences: { maxAppointmentsPerDay: 12 },
          getWorkingDaysInRange: jest.fn().mockReturnValue(3),
          getTotalHoursInRange: jest.fn().mockReturnValue(24),
        },
      ];

      const mockAppointments = [
        { assignedTo: mockPharmacistId, duration: 30 },
        { assignedTo: pharmacist2Id, duration: 45 },
      ];

      (PharmacistSchedule.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAppointments),
      });

      // Act
      const metrics = await CalendarService.getCapacityMetrics(
        startDate,
        endDate,
        mockWorkplaceId
      );

      // Assert
      expect(metrics.overall.totalPharmacists).toBe(2);
      expect(metrics.byPharmacist).toHaveLength(2);
    });

    it('should filter by pharmacist when provided', async () => {
      // Arrange
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-07');

      const mockSchedules = [
        {
          pharmacistId: mockPharmacistId,
          appointmentPreferences: { maxAppointmentsPerDay: 16 },
          getWorkingDaysInRange: jest.fn().mockReturnValue(5),
          getTotalHoursInRange: jest.fn().mockReturnValue(40),
        },
      ];

      (PharmacistSchedule.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // Act
      await CalendarService.getCapacityMetrics(
        startDate,
        endDate,
        mockWorkplaceId,
        { pharmacistId: mockPharmacistId }
      );

      // Assert
      expect(PharmacistSchedule.find).toHaveBeenCalledWith(
        expect.objectContaining({
          pharmacistId: mockPharmacistId,
        })
      );
    });
  });

  describe('suggestOptimalTimes', () => {
    it('should suggest optimal appointment times', async () => {
      // Arrange
      const patientId = new mongoose.Types.ObjectId();
      const appointmentType = 'mtm_session';
      const duration = 30;

      const mockHistoricalData = [
        { scheduledTime: '10:00', outcome: { status: 'successful' } },
        { scheduledTime: '14:00', outcome: { status: 'successful' } },
        { scheduledTime: '16:00', outcome: { status: 'unsuccessful' } },
      ];

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockHistoricalData),
      });

      // Act
      const suggestions = await CalendarService.suggestOptimalTimes(
        patientId,
        appointmentType,
        duration,
        mockWorkplaceId
      );

      // Assert
      expect(suggestions.patientId).toEqual(patientId);
      expect(suggestions.appointmentType).toBe(appointmentType);
      expect(suggestions.recommendedTimes).toBeDefined();
      expect(suggestions.recommendedTimes.length).toBeGreaterThan(0);
    });

    it('should handle no historical data', async () => {
      // Arrange
      const patientId = new mongoose.Types.ObjectId();
      const appointmentType = 'health_check';
      const duration = 30;

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // Act
      const suggestions = await CalendarService.suggestOptimalTimes(
        patientId,
        appointmentType,
        duration,
        mockWorkplaceId
      );

      // Assert
      expect(suggestions.patientId).toEqual(patientId);
      expect(suggestions.recommendedTimes).toBeDefined();
      // Should provide default recommendations
      expect(suggestions.recommendedTimes.length).toBeGreaterThan(0);
    });

    it('should consider patient preferences', async () => {
      // Arrange
      const patientId = new mongoose.Types.ObjectId();
      const appointmentType = 'vaccination';
      const duration = 15;
      const preferences = {
        preferredDays: [1, 2, 3], // Monday, Tuesday, Wednesday
        preferredTimeSlots: [
          { start: '09:00', end: '12:00' },
          { start: '14:00', end: '16:00' },
        ],
      };

      (Appointment.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // Act
      const suggestions = await CalendarService.suggestOptimalTimes(
        patientId,
        appointmentType,
        duration,
        mockWorkplaceId,
        { patientPreferences: preferences }
      );

      // Assert
      expect(suggestions.patientId).toEqual(patientId);
      expect(suggestions.patientPreferences).toEqual(preferences);
      expect(suggestions.recommendedTimes).toBeDefined();
    });
  });
});