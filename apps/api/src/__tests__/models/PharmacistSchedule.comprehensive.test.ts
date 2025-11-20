/**
 * Comprehensive PharmacistSchedule Model Unit Tests
 * Tests all model methods, validations, and edge cases
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import PharmacistSchedule, { IPharmacistSchedule } from '../../models/PharmacistSchedule';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';

describe('PharmacistSchedule Model - Comprehensive Tests', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testPharmacistId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      licenseNumber: 'TEST123',
      email: 'test@pharmacy.com',
      ownerId: new mongoose.Types.ObjectId(),
    });
    testWorkplaceId = workplace._id;

    // Create test pharmacist
    const pharmacist = await User.create({
      email: 'pharmacist@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Test',
      lastName: 'Pharmacist',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testPharmacistId = pharmacist._id;
  });

  describe('Model Creation and Validation', () => {
    it('should create a complete pharmacist schedule', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1, // Monday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
              },
            ],
          },
          {
            dayOfWeek: 2, // Tuesday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
              },
            ],
          },
          {
            dayOfWeek: 6, // Saturday
            isWorkingDay: false,
            shifts: [],
          },
        ],
        appointmentPreferences: {
          maxAppointmentsPerDay: 16,
          maxConcurrentAppointments: 2,
          appointmentTypes: ['mtm_session', 'health_check', 'vaccination'],
          defaultDuration: 30,
          bufferBetweenAppointments: 15,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      expect(schedule).toBeDefined();
      expect(schedule.workplaceId).toEqual(testWorkplaceId);
      expect(schedule.pharmacistId).toEqual(testPharmacistId);
      expect(schedule.workingHours).toHaveLength(3);
      expect(schedule.appointmentPreferences.maxAppointmentsPerDay).toBe(16);
      expect(schedule.isActive).toBe(true);
    });

    it('should require workplaceId', async () => {
      const schedule = new PharmacistSchedule({
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should require pharmacistId', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate dayOfWeek range (0-6)', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 8, // Invalid
            isWorkingDay: true,
            shifts: [],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate time format in shifts', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '25:00', // Invalid hour
                endTime: '17:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate appointment preferences', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          maxAppointmentsPerDay: -1, // Invalid
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate appointment types enum', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['invalid_type'], // Invalid
          defaultDuration: 30,
        },
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let schedule: IPharmacistSchedule;

    beforeEach(async () => {
      schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1, // Monday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '12:00',
              },
              {
                startTime: '13:00',
                endTime: '17:00',
                breakStart: '15:00',
                breakEnd: '15:15',
              },
            ],
          },
          {
            dayOfWeek: 2, // Tuesday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '10:00',
                endTime: '18:00',
                breakStart: '14:00',
                breakEnd: '15:00',
              },
            ],
          },
          {
            dayOfWeek: 6, // Saturday
            isWorkingDay: false,
            shifts: [],
          },
        ],
        timeOff: [
          {
            startDate: new Date('2025-12-25'),
            endDate: new Date('2025-12-25'),
            reason: 'Christmas Day',
            type: 'vacation',
            status: 'approved',
          },
        ],
        appointmentPreferences: {
          maxAppointmentsPerDay: 12,
          appointmentTypes: ['mtm_session', 'health_check'],
          defaultDuration: 30,
          bufferBetweenAppointments: 10,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });
    });

    describe('isWorkingOn()', () => {
      it('should return true for working days', () => {
        const monday = new Date('2025-12-01'); // Monday
        expect(schedule.isWorkingOn(monday)).toBe(true);

        const tuesday = new Date('2025-12-02'); // Tuesday
        expect(schedule.isWorkingOn(tuesday)).toBe(true);
      });

      it('should return false for non-working days', () => {
        const saturday = new Date('2025-12-06'); // Saturday
        expect(schedule.isWorkingOn(saturday)).toBe(false);

        const sunday = new Date('2025-12-07'); // Sunday (not configured)
        expect(schedule.isWorkingOn(sunday)).toBe(false);
      });

      it('should return false for time-off days', () => {
        const christmas = new Date('2025-12-25'); // Christmas (time off)
        expect(schedule.isWorkingOn(christmas)).toBe(false);
      });

      it('should handle dates before effective date', () => {
        const beforeEffective = new Date('2024-12-01');
        expect(schedule.isWorkingOn(beforeEffective)).toBe(false);
      });

      it('should handle dates after effective end date', () => {
        schedule.effectiveTo = new Date('2025-06-01');
        const afterEffective = new Date('2025-07-01');
        expect(schedule.isWorkingOn(afterEffective)).toBe(false);
      });
    });

    describe('getShiftsForDate()', () => {
      it('should return shifts for working day', () => {
        const monday = new Date('2025-12-01'); // Monday
        const shifts = schedule.getShiftsForDate(monday);

        expect(shifts).toHaveLength(2);
        expect(shifts[0].startTime).toBe('09:00');
        expect(shifts[0].endTime).toBe('12:00');
        expect(shifts[1].startTime).toBe('13:00');
        expect(shifts[1].endTime).toBe('17:00');
      });

      it('should return empty array for non-working day', () => {
        const saturday = new Date('2025-12-06'); // Saturday
        const shifts = schedule.getShiftsForDate(saturday);

        expect(shifts).toHaveLength(0);
      });

      it('should return empty array for time-off day', () => {
        const christmas = new Date('2025-12-25'); // Christmas
        const shifts = schedule.getShiftsForDate(christmas);

        expect(shifts).toHaveLength(0);
      });
    });

    describe('canHandleAppointmentType()', () => {
      it('should return true for supported appointment types', () => {
        expect(schedule.canHandleAppointmentType('mtm_session')).toBe(true);
        expect(schedule.canHandleAppointmentType('health_check')).toBe(true);
      });

      it('should return false for unsupported appointment types', () => {
        expect(schedule.canHandleAppointmentType('vaccination')).toBe(false);
        expect(schedule.canHandleAppointmentType('smoking_cessation')).toBe(false);
      });

      it('should handle invalid appointment types', () => {
        expect(schedule.canHandleAppointmentType('invalid_type' as any)).toBe(false);
      });
    });

    describe('getTotalWorkingHours()', () => {
      it('should calculate total working hours for a day', () => {
        const monday = new Date('2025-12-01'); // Monday
        const totalHours = schedule.getTotalWorkingHours(monday);

        // Monday: 09:00-12:00 (3h) + 13:00-17:00 (4h) - 15:00-15:15 break (0.25h) = 6.75h
        expect(totalHours).toBe(6.75);
      });

      it('should return 0 for non-working day', () => {
        const saturday = new Date('2025-12-06'); // Saturday
        const totalHours = schedule.getTotalWorkingHours(saturday);

        expect(totalHours).toBe(0);
      });

      it('should handle shifts without breaks', () => {
        const tuesday = new Date('2025-12-02'); // Tuesday
        const totalHours = schedule.getTotalWorkingHours(tuesday);

        // Tuesday: 10:00-18:00 (8h) - 14:00-15:00 break (1h) = 7h
        expect(totalHours).toBe(7);
      });
    });

    describe('getWorkingDaysInRange()', () => {
      it('should count working days in date range', () => {
        const startDate = new Date('2025-12-01'); // Monday
        const endDate = new Date('2025-12-07'); // Sunday

        const workingDays = schedule.getWorkingDaysInRange(startDate, endDate);

        // Monday and Tuesday are working days in this range
        expect(workingDays).toBe(2);
      });

      it('should exclude time-off days', () => {
        const startDate = new Date('2025-12-23'); // Monday
        const endDate = new Date('2025-12-27'); // Friday

        const workingDays = schedule.getWorkingDaysInRange(startDate, endDate);

        // Should exclude Christmas Day (Dec 25)
        expect(workingDays).toBe(1); // Only Dec 24 (Tuesday) is working
      });

      it('should handle range with no working days', () => {
        const startDate = new Date('2025-12-06'); // Saturday
        const endDate = new Date('2025-12-07'); // Sunday

        const workingDays = schedule.getWorkingDaysInRange(startDate, endDate);

        expect(workingDays).toBe(0);
      });
    });

    describe('getTotalHoursInRange()', () => {
      it('should calculate total working hours in date range', () => {
        const startDate = new Date('2025-12-01'); // Monday
        const endDate = new Date('2025-12-02'); // Tuesday

        const totalHours = schedule.getTotalHoursInRange(startDate, endDate);

        // Monday: 6.75h + Tuesday: 7h = 13.75h
        expect(totalHours).toBe(13.75);
      });

      it('should exclude time-off days from calculation', () => {
        const startDate = new Date('2025-12-24'); // Tuesday
        const endDate = new Date('2025-12-25'); // Wednesday (Christmas)

        const totalHours = schedule.getTotalHoursInRange(startDate, endDate);

        // Only Tuesday counts (Christmas is time off)
        expect(totalHours).toBe(7);
      });
    });

    describe('addTimeOff()', () => {
      it('should add time off successfully', () => {
        const timeOffData = {
          startDate: new Date('2025-12-31'),
          endDate: new Date('2025-12-31'),
          reason: 'New Year Eve',
          type: 'personal' as const,
        };

        schedule.addTimeOff(timeOffData, testPharmacistId);

        const newTimeOff = schedule.timeOff[schedule.timeOff.length - 1];
        expect(newTimeOff.reason).toBe('New Year Eve');
        expect(newTimeOff.type).toBe('personal');
        expect(newTimeOff.status).toBe('pending');
      });

      it('should validate time off dates', () => {
        const invalidTimeOff = {
          startDate: new Date('2025-12-31'),
          endDate: new Date('2025-12-30'), // End before start
          reason: 'Invalid dates',
          type: 'personal' as const,
        };

        expect(() => {
          schedule.addTimeOff(invalidTimeOff, testPharmacistId);
        }).toThrow('End date must be after start date');
      });

      it('should prevent overlapping time off', () => {
        const overlappingTimeOff = {
          startDate: new Date('2025-12-24'),
          endDate: new Date('2025-12-26'), // Overlaps with Christmas
          reason: 'Extended holiday',
          type: 'vacation' as const,
        };

        expect(() => {
          schedule.addTimeOff(overlappingTimeOff, testPharmacistId);
        }).toThrow('Time off period overlaps with existing time off');
      });
    });

    describe('approveTimeOff()', () => {
      it('should approve pending time off', () => {
        // Add pending time off first
        schedule.addTimeOff(
          {
            startDate: new Date('2025-12-30'),
            endDate: new Date('2025-12-30'),
            reason: 'Personal day',
            type: 'personal',
          },
          testPharmacistId
        );

        const timeOffId = schedule.timeOff[schedule.timeOff.length - 1]._id;
        schedule.approveTimeOff(timeOffId, testPharmacistId);

        const approvedTimeOff = schedule.timeOff.find(t => t._id?.equals(timeOffId));
        expect(approvedTimeOff?.status).toBe('approved');
        expect(approvedTimeOff?.approvedBy).toEqual(testPharmacistId);
      });

      it('should throw error for non-existent time off', () => {
        const nonExistentId = new mongoose.Types.ObjectId();

        expect(() => {
          schedule.approveTimeOff(nonExistentId, testPharmacistId);
        }).toThrow('Time off request not found');
      });

      it('should throw error for already processed time off', () => {
        const existingTimeOffId = schedule.timeOff[0]._id; // Christmas (already approved)

        expect(() => {
          schedule.approveTimeOff(existingTimeOffId!, testPharmacistId);
        }).toThrow('Time off request has already been processed');
      });
    });

    describe('updateWorkingHours()', () => {
      it('should update working hours successfully', () => {
        const newWorkingHours = [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '08:00',
                endTime: '16:00',
              },
            ],
          },
        ];

        schedule.updateWorkingHours(newWorkingHours, testPharmacistId);

        expect(schedule.workingHours).toHaveLength(1);
        expect(schedule.workingHours[0].shifts[0].startTime).toBe('08:00');
      });

      it('should validate new working hours', () => {
        const invalidWorkingHours = [
          {
            dayOfWeek: 8, // Invalid
            isWorkingDay: true,
            shifts: [],
          },
        ];

        expect(() => {
          schedule.updateWorkingHours(invalidWorkingHours as any, testPharmacistId);
        }).toThrow('Invalid day of week');
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test schedules
      await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });
    });

    describe('findCurrentSchedule()', () => {
      it('should find current active schedule', async () => {
        const schedule = await (PharmacistSchedule as any).findCurrentSchedule(
          testPharmacistId,
          testWorkplaceId
        );

        expect(schedule).toBeDefined();
        expect(schedule.pharmacistId).toEqual(testPharmacistId);
        expect(schedule.isActive).toBe(true);
      });

      it('should return null if no active schedule found', async () => {
        const nonExistentPharmacistId = new mongoose.Types.ObjectId();

        const schedule = await (PharmacistSchedule as any).findCurrentSchedule(
          nonExistentPharmacistId,
          testWorkplaceId
        );

        expect(schedule).toBeNull();
      });
    });

    describe('findByWorkplace()', () => {
      it('should find all schedules for workplace', async () => {
        const schedules = await (PharmacistSchedule as any).findByWorkplace(testWorkplaceId);

        expect(schedules.length).toBeGreaterThanOrEqual(1);
        expect(schedules.every((s: any) => s.workplaceId.equals(testWorkplaceId))).toBe(true);
      });

      it('should filter by active status', async () => {
        const activeSchedules = await (PharmacistSchedule as any).findByWorkplace(
          testWorkplaceId,
          { activeOnly: true }
        );

        expect(activeSchedules.every((s: any) => s.isActive)).toBe(true);
      });
    });

    describe('findConflictingSchedules()', () => {
      it('should find schedules with time conflicts', async () => {
        // Create another pharmacist
        const pharmacist2 = await User.create({
          email: 'pharmacist2@test.com',
          passwordHash: 'hashedpassword',
          firstName: 'Test2',
          lastName: 'Pharmacist2',
          role: 'pharmacy_outlet',
          workplaceId: testWorkplaceId,
          currentPlanId: new mongoose.Types.ObjectId(),
        });

        // Create overlapping schedule
        await PharmacistSchedule.create({
          workplaceId: testWorkplaceId,
          pharmacistId: pharmacist2._id,
          workingHours: [
            {
              dayOfWeek: 1,
              isWorkingDay: true,
              shifts: [{ startTime: '09:00', endTime: '17:00' }],
            },
          ],
          appointmentPreferences: {
            appointmentTypes: ['mtm_session'],
            defaultDuration: 30,
          },
          isActive: true,
          effectiveFrom: new Date('2025-01-01'),
          createdBy: pharmacist2._id,
        });

        const conflicts = await (PharmacistSchedule as any).findConflictingSchedules(
          testWorkplaceId,
          new Date('2025-01-01'),
          new Date('2025-12-31')
        );

        expect(conflicts.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Virtual Properties', () => {
    let schedule: IPharmacistSchedule;

    beforeEach(async () => {
      schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
          },
          {
            dayOfWeek: 2,
            isWorkingDay: true,
            shifts: [{ startTime: '10:00', endTime: '18:00' }],
          },
        ],
        timeOff: [
          {
            startDate: new Date('2025-12-25'),
            endDate: new Date('2025-12-25'),
            reason: 'Christmas',
            type: 'vacation',
            status: 'approved',
          },
          {
            startDate: new Date('2025-12-31'),
            endDate: new Date('2025-12-31'),
            reason: 'New Year',
            type: 'vacation',
            status: 'pending',
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session', 'health_check'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });
    });

    it('should calculate totalWorkingDays', () => {
      const totalDays = schedule.get('totalWorkingDays');
      expect(totalDays).toBe(2); // Monday and Tuesday
    });

    it('should calculate averageHoursPerDay', () => {
      const avgHours = schedule.get('averageHoursPerDay');
      expect(avgHours).toBe(7.5); // (8h + 8h) / 2 = 8h average
    });

    it('should count pendingTimeOffRequests', () => {
      const pendingCount = schedule.get('pendingTimeOffRequests');
      expect(pendingCount).toBe(1); // New Year request is pending
    });

    it('should count approvedTimeOffDays', () => {
      const approvedDays = schedule.get('approvedTimeOffDays');
      expect(approvedDays).toBe(1); // Christmas is approved
    });

    it('should determine hasActiveTimeOff', () => {
      const hasActive = schedule.get('hasActiveTimeOff');
      expect(hasActive).toBe(true); // Has approved time off
    });

    it('should calculate supportedAppointmentTypesCount', () => {
      const count = schedule.get('supportedAppointmentTypesCount');
      expect(count).toBe(2); // mtm_session and health_check
    });
  });

  describe('Pre-save Middleware', () => {
    it('should calculate capacity stats before saving', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
          maxAppointmentsPerDay: 16,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await schedule.save();

      expect(schedule.capacityStats).toBeDefined();
      expect(schedule.capacityStats.totalSlotsAvailable).toBeGreaterThan(0);
      expect(schedule.capacityStats.lastCalculatedAt).toBeDefined();
    });

    it('should validate working hours consistency', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '17:00', // End before start
                endTime: '09:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow('End time must be after start time');
    });

    it('should validate break times within shift hours', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '08:00', // Before shift start
                breakEnd: '08:30',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow('Break time must be within shift hours');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty working hours array', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      expect(schedule.workingHours).toHaveLength(0);
      expect(schedule.isWorkingOn(new Date())).toBe(false);
    });

    it('should handle multiple shifts on same day', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              { startTime: '08:00', endTime: '12:00' },
              { startTime: '13:00', endTime: '17:00' },
              { startTime: '18:00', endTime: '20:00' },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      const monday = new Date('2025-12-01');
      const shifts = schedule.getShiftsForDate(monday);
      expect(shifts).toHaveLength(3);

      const totalHours = schedule.getTotalWorkingHours(monday);
      expect(totalHours).toBe(10); // 4h + 4h + 2h
    });

    it('should handle overlapping time off periods', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        timeOff: [
          {
            startDate: new Date('2025-12-20'),
            endDate: new Date('2025-12-25'),
            reason: 'Holiday week',
            type: 'vacation',
            status: 'approved',
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      // Try to add overlapping time off
      expect(() => {
        schedule.addTimeOff(
          {
            startDate: new Date('2025-12-23'),
            endDate: new Date('2025-12-27'),
            reason: 'Extended holiday',
            type: 'vacation',
          },
          testPharmacistId
        );
      }).toThrow('overlaps');
    });

    it('should handle timezone considerations', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [{ startTime: '09:00', endTime: '17:00' }],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        isActive: true,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      // Test with different timezone dates
      const mondayUTC = new Date('2025-12-01T00:00:00Z');
      const mondayLocal = new Date('2025-12-01T12:00:00+01:00');

      expect(schedule.isWorkingOn(mondayUTC)).toBe(true);
      expect(schedule.isWorkingOn(mondayLocal)).toBe(true);
    });
  });
});