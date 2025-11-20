/// <reference types="jest" />
import mongoose from 'mongoose';
import PharmacistSchedule, { IPharmacistSchedule } from '../../models/PharmacistSchedule';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';

describe('PharmacistSchedule Model', () => {
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

  describe('Model Creation', () => {
    it('should create a pharmacist schedule with required fields', async () => {
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
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session', 'health_check'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      expect(schedule).toBeDefined();
      expect(schedule.workplaceId).toEqual(testWorkplaceId);
      expect(schedule.pharmacistId).toEqual(testPharmacistId);
      expect(schedule.isActive).toBe(true);
      expect(schedule.workingHours.length).toBe(1);
    });

    it('should initialize capacity stats', async () => {
      const schedule = await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      expect(schedule.capacityStats.totalSlotsAvailable).toBe(0);
      expect(schedule.capacityStats.slotsBooked).toBe(0);
      expect(schedule.capacityStats.utilizationRate).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const schedule = new PharmacistSchedule({
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
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
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate time format (HH:mm)', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '25:00', // Invalid
                endTime: '17:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate dayOfWeek range', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 7, // Invalid (0-6)
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should require at least one appointment type', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: [],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate shift end time is after start time', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '17:00',
                endTime: '09:00', // Before start time
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow('Shift end time must be after start time');
    });

    it('should validate break is within shift hours', async () => {
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
                breakEnd: '09:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow('Break must be within shift hours');
    });

    it('should validate time off end date is after start date', async () => {
      const schedule = new PharmacistSchedule({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        timeOff: [
          {
            startDate: new Date('2025-12-10'),
            endDate: new Date('2025-12-05'), // Before start
            reason: 'Vacation',
            type: 'vacation',
            status: 'pending',
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });

      await expect(schedule.save()).rejects.toThrow('Time off end date must be after start date');
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
            dayOfWeek: 2,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });
    });

    it('should calculate current utilization', async () => {
      schedule.capacityStats.totalSlotsAvailable = 100;
      schedule.capacityStats.slotsBooked = 75;
      await schedule.save();

      expect(schedule.get('currentUtilization')).toBe(75);
    });

    it('should calculate available slots', async () => {
      schedule.capacityStats.totalSlotsAvailable = 100;
      schedule.capacityStats.slotsBooked = 75;
      await schedule.save();

      expect(schedule.get('availableSlots')).toBe(25);
    });

    it('should determine if currently effective', () => {
      expect(schedule.get('isCurrentlyEffective')).toBe(true);
    });

    it('should count working days', () => {
      expect(schedule.get('workingDaysCount')).toBe(2);
    });

    it('should calculate total weekly hours', () => {
      const hours = schedule.get('totalWeeklyHours');
      expect(hours).toBe(15); // (8-1) + 8 = 15 hours
    });

    it('should filter approved time off', async () => {
      schedule.timeOff = [
        {
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-05'),
          reason: 'Vacation',
          type: 'vacation',
          status: 'approved',
        },
        {
          startDate: new Date('2025-12-10'),
          endDate: new Date('2025-12-12'),
          reason: 'Sick',
          type: 'sick_leave',
          status: 'pending',
        },
      ];
      await schedule.save();

      const approved = schedule.get('approvedTimeOff');
      expect(approved.length).toBe(1);
      expect(approved[0].status).toBe('approved');
    });

    it('should filter pending time off requests', async () => {
      schedule.timeOff = [
        {
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-05'),
          reason: 'Vacation',
          type: 'vacation',
          status: 'approved',
        },
        {
          startDate: new Date('2025-12-10'),
          endDate: new Date('2025-12-12'),
          reason: 'Sick',
          type: 'sick_leave',
          status: 'pending',
        },
      ];
      await schedule.save();

      const pending = schedule.get('pendingTimeOffRequests');
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('pending');
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
                endTime: '17:00',
              },
            ],
          },
          {
            dayOfWeek: 0, // Sunday
            isWorkingDay: false,
            shifts: [],
          },
        ],
        appointmentPreferences: {
          appointmentTypes: ['mtm_session', 'health_check'],
          defaultDuration: 30,
        },
        effectiveFrom: new Date('2025-01-01'),
        createdBy: testPharmacistId,
      });
    });

    describe('isWorkingOn()', () => {
      it('should return true for working day', () => {
        const monday = new Date('2025-12-01'); // A Monday
        expect(schedule.isWorkingOn(monday)).toBe(true);
      });

      it('should return false for non-working day', () => {
        const sunday = new Date('2025-11-30'); // A Sunday
        expect(schedule.isWorkingOn(sunday)).toBe(false);
      });

      it('should return false for approved time off', async () => {
        const monday = new Date('2025-12-01');
        schedule.timeOff = [
          {
            startDate: new Date('2025-12-01'),
            endDate: new Date('2025-12-05'),
            reason: 'Vacation',
            type: 'vacation',
            status: 'approved',
          },
        ];
        await schedule.save();

        expect(schedule.isWorkingOn(monday)).toBe(false);
      });
    });

    describe('getShiftsForDate()', () => {
      it('should return shifts for working day', () => {
        const monday = new Date('2025-12-01');
        const shifts = schedule.getShiftsForDate(monday);

        expect(shifts.length).toBe(1);
        expect(shifts[0].startTime).toBe('09:00');
        expect(shifts[0].endTime).toBe('17:00');
      });

      it('should return empty array for non-working day', () => {
        const sunday = new Date('2025-11-30');
        const shifts = schedule.getShiftsForDate(sunday);

        expect(shifts.length).toBe(0);
      });
    });

    describe('requestTimeOff()', () => {
      it('should add time off request', async () => {
        const startDate = new Date('2025-12-01');
        const endDate = new Date('2025-12-05');

        schedule.requestTimeOff(startDate, endDate, 'Vacation', 'vacation');
        await schedule.save();

        expect(schedule.timeOff.length).toBe(1);
        expect(schedule.timeOff[0].status).toBe('pending');
        expect(schedule.timeOff[0].type).toBe('vacation');
      });

      it('should throw error if end date is before start date', () => {
        const startDate = new Date('2025-12-05');
        const endDate = new Date('2025-12-01');

        expect(() => {
          schedule.requestTimeOff(startDate, endDate, 'Vacation', 'vacation');
        }).toThrow('End date must be after start date');
      });
    });

    describe('approveTimeOff()', () => {
      beforeEach(async () => {
        schedule.timeOff = [
          {
            startDate: new Date('2025-12-01'),
            endDate: new Date('2025-12-05'),
            reason: 'Vacation',
            type: 'vacation',
            status: 'pending',
          },
        ];
        await schedule.save();
      });

      it('should approve time off request', async () => {
        schedule.approveTimeOff(0, testPharmacistId);
        await schedule.save();

        expect(schedule.timeOff[0].status).toBe('approved');
        expect(schedule.timeOff[0].approvedBy).toEqual(testPharmacistId);
      });
    });

    describe('rejectTimeOff()', () => {
      beforeEach(async () => {
        schedule.timeOff = [
          {
            startDate: new Date('2025-12-01'),
            endDate: new Date('2025-12-05'),
            reason: 'Vacation',
            type: 'vacation',
            status: 'pending',
          },
        ];
        await schedule.save();
      });

      it('should reject time off request', async () => {
        schedule.rejectTimeOff(0);
        await schedule.save();

        expect(schedule.timeOff[0].status).toBe('rejected');
      });
    });

    describe('updateCapacityStats()', () => {
      it('should update capacity statistics', async () => {
        schedule.updateCapacityStats(100, 75);
        await schedule.save();

        expect(schedule.capacityStats.totalSlotsAvailable).toBe(100);
        expect(schedule.capacityStats.slotsBooked).toBe(75);
        expect(schedule.capacityStats.utilizationRate).toBe(75);
        expect(schedule.capacityStats.lastCalculatedAt).toBeDefined();
      });
    });

    describe('canHandleAppointmentType()', () => {
      it('should return true for supported appointment type', () => {
        expect(schedule.canHandleAppointmentType('mtm_session')).toBe(true);
      });

      it('should return false for unsupported appointment type', () => {
        expect(schedule.canHandleAppointmentType('vaccination')).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await PharmacistSchedule.create({
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

      await PharmacistSchedule.create({
        workplaceId: testWorkplaceId,
        pharmacistId: testPharmacistId,
        workingHours: [],
        appointmentPreferences: {
          appointmentTypes: ['health_check'],
          defaultDuration: 30,
        },
        isActive: false,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-12-31'),
        createdBy: testPharmacistId,
      });
    });

    describe('findByPharmacist()', () => {
      it('should find schedules by pharmacist', async () => {
        const schedules = await (PharmacistSchedule as any).findByPharmacist(testPharmacistId);
        expect(schedules.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by active status', async () => {
        const schedules = await (PharmacistSchedule as any).findByPharmacist(testPharmacistId, {
          activeOnly: true,
        });
        expect(schedules.every((s: IPharmacistSchedule) => s.isActive)).toBe(true);
      });
    });

    describe('findCurrentSchedule()', () => {
      it('should find current active schedule', async () => {
        const schedule = await (PharmacistSchedule as any).findCurrentSchedule(testPharmacistId);
        expect(schedule).toBeDefined();
        expect(schedule.isActive).toBe(true);
      });
    });

    describe('findWithPendingTimeOff()', () => {
      it('should find schedules with pending time off', async () => {
        const schedule = await PharmacistSchedule.findOne({ isActive: true });
        schedule!.timeOff = [
          {
            startDate: new Date('2025-12-01'),
            endDate: new Date('2025-12-05'),
            reason: 'Vacation',
            type: 'vacation',
            status: 'pending',
          },
        ];
        await schedule!.save();

        const schedules = await (PharmacistSchedule as any).findWithPendingTimeOff();
        expect(schedules.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
