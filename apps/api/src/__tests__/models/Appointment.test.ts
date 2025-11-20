/// <reference types="jest" />
import mongoose from 'mongoose';
import Appointment, { IAppointment } from '../../models/Appointment';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';
import Patient from '../../models/Patient';

describe('Appointment Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testPharmacistId: mongoose.Types.ObjectId;
  let testPatientId: mongoose.Types.ObjectId;

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

    // Create test patient
    const patient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348012345678',
      workplaceId: testWorkplaceId,
      createdBy: testPharmacistId,
    });
    testPatientId = patient._id;
  });

  describe('Model Creation', () => {
    it('should create an appointment with required fields', async () => {
      const appointment = await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
        createdBy: testPharmacistId,
      });

      expect(appointment).toBeDefined();
      expect(appointment.workplaceId).toEqual(testWorkplaceId);
      expect(appointment.patientId).toEqual(testPatientId);
      expect(appointment.assignedTo).toEqual(testPharmacistId);
      expect(appointment.type).toBe('mtm_session');
      expect(appointment.status).toBe('scheduled');
      expect(appointment.confirmationStatus).toBe('pending');
      expect(appointment.isRecurring).toBe(false);
    });

    it('should set default values correctly', async () => {
      const appointment = await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '14:00',
        createdBy: testPharmacistId,
      });

      expect(appointment.duration).toBe(30); // Default duration
      expect(appointment.timezone).toBe('Africa/Lagos'); // Default timezone
      expect(appointment.status).toBe('scheduled');
      expect(appointment.confirmationStatus).toBe('pending');
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const appointment = new Appointment({
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should require patientId', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should validate appointment type enum', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'invalid_type' as any,
        title: 'Test',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should validate time format (HH:mm)', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '25:00', // Invalid hour
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should enforce duration minimum', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 2, // Below minimum
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should enforce duration maximum', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 500, // Above maximum
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow();
    });

    it('should require outcome when status is completed', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        status: 'completed',
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow('Outcome is required');
    });

    it('should require cancellation reason when status is cancelled', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        status: 'cancelled',
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow('Cancellation reason is required');
    });
  });

  describe('Virtual Properties', () => {
    let appointment: IAppointment;

    beforeEach(async () => {
      appointment = await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 60,
        createdBy: testPharmacistId,
      });
    });

    it('should calculate appointmentDateTime correctly', () => {
      const dateTime = appointment.get('appointmentDateTime');
      expect(dateTime).toBeDefined();
      expect(dateTime.getHours()).toBe(10);
      expect(dateTime.getMinutes()).toBe(0);
    });

    it('should calculate endDateTime correctly', () => {
      const endTime = appointment.get('endDateTime');
      expect(endTime).toBeDefined();
      expect(endTime.getHours()).toBe(11); // 10:00 + 60 minutes
      expect(endTime.getMinutes()).toBe(0);
    });

    it('should determine if appointment is today', async () => {
      const today = new Date();
      appointment.scheduledDate = today;
      await appointment.save();

      expect(appointment.get('isToday')).toBe(true);
    });

    it('should count pending reminders', async () => {
      appointment.reminders = [
        {
          type: 'email',
          scheduledFor: new Date(),
          sent: false,
        },
        {
          type: 'sms',
          scheduledFor: new Date(),
          sent: true,
        },
      ];
      await appointment.save();

      expect(appointment.get('pendingRemindersCount')).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    let appointment: IAppointment;

    beforeEach(async () => {
      appointment = await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
        createdBy: testPharmacistId,
      });
    });

    describe('reschedule()', () => {
      it('should reschedule appointment', async () => {
        const newDate = new Date('2025-12-02');
        const newTime = '14:00';
        const reason = 'Patient requested change';

        appointment.reschedule(newDate, newTime, reason, testPharmacistId);
        await appointment.save();

        expect(appointment.scheduledDate).toEqual(newDate);
        expect(appointment.scheduledTime).toBe(newTime);
        expect(appointment.rescheduledReason).toBe(reason);
        expect(appointment.status).toBe('rescheduled');
      });
    });

    describe('cancel()', () => {
      it('should cancel appointment', async () => {
        const reason = 'Patient no longer needs service';

        appointment.cancel(reason, testPharmacistId);
        await appointment.save();

        expect(appointment.status).toBe('cancelled');
        expect(appointment.cancellationReason).toBe(reason);
        expect(appointment.cancelledBy).toEqual(testPharmacistId);
        expect(appointment.cancelledAt).toBeDefined();
      });
    });

    describe('complete()', () => {
      it('should complete appointment with outcome', async () => {
        const outcome = {
          status: 'successful' as const,
          notes: 'Session completed successfully',
          nextActions: ['Follow up in 3 months'],
          visitCreated: false,
        };

        appointment.complete(outcome);
        await appointment.save();

        expect(appointment.status).toBe('completed');
        expect(appointment.outcome).toEqual(outcome);
        expect(appointment.completedAt).toBeDefined();
      });
    });

    describe('confirm()', () => {
      it('should confirm appointment', async () => {
        appointment.confirm(testPharmacistId);
        await appointment.save();

        expect(appointment.status).toBe('confirmed');
        expect(appointment.confirmationStatus).toBe('confirmed');
        expect(appointment.confirmedAt).toBeDefined();
        expect(appointment.confirmedBy).toEqual(testPharmacistId);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test appointments
      await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'mtm_session',
        title: 'MTM Session 1',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        status: 'scheduled',
        createdBy: testPharmacistId,
      });

      await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: new Date('2025-12-02'),
        scheduledTime: '14:00',
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Completed',
          nextActions: [],
          visitCreated: false,
        },
        createdBy: testPharmacistId,
      });
    });

    describe('findByPatient()', () => {
      it('should find appointments by patient', async () => {
        const appointments = await (Appointment as any).findByPatient(testPatientId);
        expect(appointments.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by status', async () => {
        const appointments = await (Appointment as any).findByPatient(testPatientId, {
          status: 'scheduled',
        });
        expect(appointments.every((a: IAppointment) => a.status === 'scheduled')).toBe(true);
      });
    });

    describe('findByPharmacist()', () => {
      it('should find appointments by pharmacist', async () => {
        const appointments = await (Appointment as any).findByPharmacist(testPharmacistId);
        expect(appointments.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('findUpcoming()', () => {
      it('should find upcoming appointments', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2);

        await Appointment.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'vaccination',
          title: 'Vaccination',
          scheduledDate: futureDate,
          scheduledTime: '10:00',
          status: 'scheduled',
          createdBy: testPharmacistId,
        });

        const appointments = await (Appointment as any).findUpcoming(7);
        expect(appointments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('checkConflict()', () => {
      it('should detect conflicting appointments', async () => {
        const testDate = new Date('2025-12-15');

        await Appointment.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'mtm_session',
          title: 'Existing Appointment',
          scheduledDate: testDate,
          scheduledTime: '10:00',
          duration: 60,
          createdBy: testPharmacistId,
        });

        const result = await (Appointment as any).checkConflict(
          testPharmacistId,
          testDate,
          '10:30',
          30
        );

        expect(result.hasConflict).toBe(true);
        expect(result.conflictingAppointment).toBeDefined();
      });

      it('should not detect conflict for non-overlapping times', async () => {
        const testDate = new Date('2025-12-16');

        await Appointment.create({
          workplaceId: testWorkplaceId,
          patientId: testPatientId,
          assignedTo: testPharmacistId,
          type: 'mtm_session',
          title: 'Existing Appointment',
          scheduledDate: testDate,
          scheduledTime: '10:00',
          duration: 30,
          createdBy: testPharmacistId,
        });

        const result = await (Appointment as any).checkConflict(
          testPharmacistId,
          testDate,
          '11:00',
          30
        );

        expect(result.hasConflict).toBe(false);
      });
    });
  });

  describe('Recurring Appointments', () => {
    it('should create recurring appointment with pattern', async () => {
      const appointment = await Appointment.create({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'chronic_disease_review',
        title: 'Monthly Review',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        duration: 30,
        isRecurring: true,
        recurrencePattern: {
          frequency: 'monthly',
          interval: 1,
          endAfterOccurrences: 6,
        },
        createdBy: testPharmacistId,
      });

      expect(appointment.isRecurring).toBe(true);
      expect(appointment.recurrencePattern).toBeDefined();
      expect(appointment.recurrencePattern?.frequency).toBe('monthly');
    });

    it('should require recurrence pattern when isRecurring is true', async () => {
      const appointment = new Appointment({
        workplaceId: testWorkplaceId,
        patientId: testPatientId,
        assignedTo: testPharmacistId,
        type: 'chronic_disease_review',
        title: 'Monthly Review',
        scheduledDate: new Date('2025-12-01'),
        scheduledTime: '10:00',
        isRecurring: true,
        createdBy: testPharmacistId,
      });

      await expect(appointment.save()).rejects.toThrow('Recurrence pattern is required');
    });
  });
});
