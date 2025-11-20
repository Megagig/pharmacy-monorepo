/**
 * End-to-End Tests for Recurring Appointments
 * 
 * Tests complete recurring appointment workflows including:
 * - Series creation and management
 * - Exception handling
 * - Bulk operations
 * - Patient and pharmacist interactions
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import Workplace from '../../models/Workplace';
import { generateTestToken, createTestUserData, createTestPatientData } from '../utils/testHelpers';

describe('Recurring Appointments E2E Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistToken: string;

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
    // Clear collections
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      PharmacistSchedule.deleteMany({}),
      Workplace.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();

    // Create test data
    await Workplace.create({
      _id: workplaceId,
      name: 'Recurring Test Pharmacy',
      type: 'pharmacy',
      address: '123 Recurring Street, Lagos, Nigeria',
      phone: '+234-800-123-4567',
      email: 'recurring@pharmacy.com',
      isActive: true,
    });

    const pharmacist = new User({
      ...createTestUserData({
        email: 'pharmacist@recurring.com',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
      }),
      workplaceId,
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;
    pharmacistToken = generateTestToken(pharmacist);

    const patient = new Patient({
      ...createTestPatientData(workplaceId.toString(), {
        email: 'patient@recurring.com',
        mrn: 'REC001',
        phone: '+234-800-001-0001',
      }),
      _id: new mongoose.Types.ObjectId(),
      createdBy: pharmacistId,
    });
    await patient.save();
    patientId = patient._id;

    // Create pharmacist schedule for all weekdays
    await PharmacistSchedule.create({
      workplaceId,
      pharmacistId,
      workingHours: Array.from({ length: 5 }, (_, i) => ({
        dayOfWeek: i + 1, // Monday to Friday
        isWorkingDay: true,
        shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }],
      })),
      appointmentPreferences: {
        maxAppointmentsPerDay: 20,
        appointmentTypes: ['chronic_disease_review', 'mtm_session'],
        defaultDuration: 30,
      },
      isActive: true,
      effectiveFrom: new Date(),
      createdBy: pharmacistId,
    });
  });

  describe('Weekly Recurring Appointments', () => {
    it('should create and manage weekly recurring appointment series', async () => {
      // Step 1: Create weekly recurring appointment
      const nextMonday = getNextWeekday(1); // Monday
      const appointmentDate = nextMonday.toISOString().split('T')[0];

      const recurringData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        title: 'Weekly Diabetes Check',
        description: 'Regular diabetes monitoring and medication review',
        scheduledDate: appointmentDate,
        scheduledTime: '10:00',
        duration: 45,
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'weekly',
          interval: 1,
          endAfterOccurrences: 8, // 8 weeks
          daysOfWeek: [1], // Monday only
        },
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(recurringData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.appointment.isRecurring).toBe(true);
      expect(createResponse.body.data.seriesInfo.totalInstances).toBe(8);

      const seriesId = createResponse.body.data.appointment.recurringSeriesId;

      // Step 2: Verify all instances created
      const seriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(seriesResponse.status).toBe(200);
      expect(seriesResponse.body.data.appointments).toHaveLength(8);

      // All should be on Mondays
      seriesResponse.body.data.appointments.forEach((apt: any) => {
        const date = new Date(apt.scheduledDate);
        expect(date.getDay()).toBe(1); // Monday
        expect(apt.scheduledTime).toBe('10:00');
        expect(apt.duration).toBe(45);
      });

      // Step 3: Complete first appointment
      const firstAppointment = seriesResponse.body.data.appointments[0];
      const completeResponse = await request(app)
        .patch(`/api/appointments/${firstAppointment._id}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Blood sugar levels stable. Continue current regimen.',
            nextActions: ['Continue medication', 'Monitor blood sugar'],
          },
        });

      expect(completeResponse.status).toBe(200);

      // Step 4: Modify second appointment (exception)
      const secondAppointment = seriesResponse.body.data.appointments[1];
      const modifyResponse = await request(app)
        .put(`/api/appointments/${secondAppointment._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          scheduledTime: '14:00',
          duration: 60,
          updateType: 'this_only',
          reason: 'Patient requested afternoon appointment',
        });

      expect(modifyResponse.status).toBe(200);
      expect(modifyResponse.body.data.appointment.isRecurringException).toBe(true);
      expect(modifyResponse.body.data.appointment.scheduledTime).toBe('14:00');

      // Step 5: Update remaining appointments
      const thirdAppointment = seriesResponse.body.data.appointments[2];
      const updateFutureResponse = await request(app)
        .put(`/api/appointments/${thirdAppointment._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          duration: 30, // Reduce duration for remaining appointments
          updateType: 'this_and_future',
          reason: 'Optimize appointment scheduling',
        });

      expect(updateFutureResponse.status).toBe(200);
      expect(updateFutureResponse.body.data.affectedAppointments).toBe(6); // Remaining 6 appointments

      // Step 6: Verify series statistics
      const statsResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}/stats`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.data.stats).toMatchObject({
        totalInstances: 8,
        completed: 1,
        scheduled: 7,
        exceptions: 1,
        completionRate: 12.5, // 1/8 * 100
      });
    });
  });

  describe('Monthly Recurring Appointments', () => {
    it('should handle monthly recurring appointments with date adjustments', async () => {
      // Step 1: Create monthly recurring appointment on the 15th
      const next15th = getNext15thOfMonth();
      const appointmentDate = next15th.toISOString().split('T')[0];

      const monthlyData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        title: 'Monthly Hypertension Review',
        description: 'Monthly blood pressure monitoring and medication adjustment',
        scheduledDate: appointmentDate,
        scheduledTime: '11:00',
        duration: 30,
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'monthly',
          interval: 1,
          endAfterOccurrences: 12, // 1 year
          dayOfMonth: 15,
        },
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(monthlyData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.seriesInfo.totalInstances).toBe(12);

      const seriesId = createResponse.body.data.appointment.recurringSeriesId;

      // Step 2: Verify monthly distribution
      const seriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(seriesResponse.status).toBe(200);
      const appointments = seriesResponse.body.data.appointments;

      // Check that appointments are on 15th of each month (or adjusted for weekends)
      appointments.forEach((apt: any, index: number) => {
        const date = new Date(apt.scheduledDate);
        const dayOfMonth = date.getDate();
        
        // Should be 15th or adjusted for weekend (13-17 range is acceptable)
        expect(dayOfMonth).toBeGreaterThanOrEqual(13);
        expect(dayOfMonth).toBeLessThanOrEqual(17);
      });

      // Step 3: Handle month with no 31st (February edge case)
      // This would be tested with a different day of month
      const feb29Data = {
        patientId: patientId.toString(),
        type: 'mtm_session',
        title: 'End of Month Review',
        scheduledDate: '2024-01-31', // January 31st
        scheduledTime: '15:00',
        duration: 45,
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'monthly',
          interval: 1,
          endAfterOccurrences: 3,
          dayOfMonth: 31,
        },
      };

      const feb29Response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(feb29Data);

      expect(feb29Response.status).toBe(201);

      // Verify February appointment is adjusted to last day of February
      const feb29SeriesId = feb29Response.body.data.appointment.recurringSeriesId;
      const feb29SeriesResponse = await request(app)
        .get(`/api/appointments/series/${feb29SeriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      const febAppointment = feb29SeriesResponse.body.data.appointments.find((apt: any) => {
        const date = new Date(apt.scheduledDate);
        return date.getMonth() === 1; // February (0-indexed)
      });

      if (febAppointment) {
        const febDate = new Date(febAppointment.scheduledDate);
        // Should be last day of February (28 or 29)
        expect([28, 29]).toContain(febDate.getDate());
      }
    });
  });

  describe('Bi-weekly Recurring Appointments', () => {
    it('should manage bi-weekly recurring appointments with patient preferences', async () => {
      // Step 1: Create bi-weekly recurring appointment
      const nextTuesday = getNextWeekday(2); // Tuesday
      const appointmentDate = nextTuesday.toISOString().split('T')[0];

      const biweeklyData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        title: 'Bi-weekly Medication Review',
        description: 'Regular medication adherence check and counseling',
        scheduledDate: appointmentDate,
        scheduledTime: '09:30',
        duration: 30,
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'weekly',
          interval: 2, // Every 2 weeks
          endAfterOccurrences: 10,
          daysOfWeek: [2], // Tuesday
        },
        patientPreferences: {
          preferredChannel: 'sms',
          language: 'en',
          specialRequirements: 'Patient prefers morning appointments',
        },
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(biweeklyData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.seriesInfo.totalInstances).toBe(10);

      const seriesId = createResponse.body.data.appointment.recurringSeriesId;

      // Step 2: Verify bi-weekly pattern
      const seriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      const appointments = seriesResponse.body.data.appointments;
      
      // Check that appointments are 2 weeks apart
      for (let i = 1; i < appointments.length; i++) {
        const prevDate = new Date(appointments[i - 1].scheduledDate);
        const currDate = new Date(appointments[i].scheduledDate);
        const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBe(14); // Exactly 2 weeks
      }

      // Step 3: Patient reschedules one instance via portal
      const thirdAppointment = appointments[2];
      
      // Simulate patient token
      const patientToken = generateTestToken({
        _id: patientId,
        workplaceId,
        email: 'patient@recurring.com',
      });

      const rescheduleResponse = await request(app)
        .post(`/api/patient-portal/appointments/${thirdAppointment._id}/reschedule`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          newDate: thirdAppointment.scheduledDate, // Same date
          newTime: '14:00', // Different time
          reason: 'Work schedule conflict',
          notifyPharmacist: true,
        });

      expect(rescheduleResponse.status).toBe(200);
      expect(rescheduleResponse.body.data.scheduledTime).toBe('14:00');

      // Step 4: Pharmacist adds time-off affecting future appointments
      const timeOffResponse = await request(app)
        .post(`/api/schedules/pharmacist/${pharmacistId}/time-off`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          startDate: appointments[5].scheduledDate,
          endDate: appointments[6].scheduledDate,
          reason: 'Vacation',
          type: 'vacation',
        });

      expect(timeOffResponse.status).toBe(201);
      expect(timeOffResponse.body.data.affectedAppointments).toHaveLength(2);

      // Step 5: System suggests rescheduling affected appointments
      const suggestionsResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}/reschedule-suggestions`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          conflictStartDate: appointments[5].scheduledDate,
          conflictEndDate: appointments[6].scheduledDate,
        });

      expect(suggestionsResponse.status).toBe(200);
      expect(suggestionsResponse.body.data.suggestions).toHaveLength(2);
      
      // Each suggestion should have alternative dates/times
      suggestionsResponse.body.data.suggestions.forEach((suggestion: any) => {
        expect(suggestion.alternatives).toBeInstanceOf(Array);
        expect(suggestion.alternatives.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Quarterly Recurring Appointments', () => {
    it('should handle quarterly recurring appointments with long-term planning', async () => {
      // Step 1: Create quarterly recurring appointment
      const nextQuarter = getNextQuarterStart();
      const appointmentDate = nextQuarter.toISOString().split('T')[0];

      const quarterlyData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        title: 'Quarterly Comprehensive Review',
        description: 'Comprehensive health and medication review every 3 months',
        scheduledDate: appointmentDate,
        scheduledTime: '10:00',
        duration: 90, // Longer appointment
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'quarterly',
          interval: 1,
          endAfterOccurrences: 8, // 2 years
        },
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(quarterlyData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.seriesInfo.totalInstances).toBe(8);

      const seriesId = createResponse.body.data.appointment.recurringSeriesId;

      // Step 2: Verify quarterly spacing
      const seriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      const appointments = seriesResponse.body.data.appointments;
      
      // Check that appointments are approximately 3 months apart
      for (let i = 1; i < appointments.length; i++) {
        const prevDate = new Date(appointments[i - 1].scheduledDate);
        const currDate = new Date(appointments[i].scheduledDate);
        
        // Calculate months difference
        const monthsDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 + 
                          (currDate.getMonth() - prevDate.getMonth());
        expect(monthsDiff).toBe(3);
      }

      // Step 3: Generate long-term calendar view
      const calendarResponse = await request(app)
        .get('/api/appointments/calendar')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          view: 'year',
          startDate: appointmentDate,
          seriesId: seriesId,
        });

      expect(calendarResponse.status).toBe(200);
      expect(calendarResponse.body.data.appointments).toHaveLength(8);

      // Step 4: Plan capacity around quarterly appointments
      const capacityResponse = await request(app)
        .get('/api/schedules/capacity')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          startDate: appointmentDate,
          endDate: appointments[appointments.length - 1].scheduledDate,
          includeRecurring: true,
        });

      expect(capacityResponse.status).toBe(200);
      expect(capacityResponse.body.data.recurringAppointments).toBeDefined();
      expect(capacityResponse.body.data.capacityImpact).toBeDefined();
    });
  });

  describe('Series Management and Bulk Operations', () => {
    it('should handle bulk operations on recurring series', async () => {
      // Step 1: Create multiple recurring series
      const series = [];
      for (let i = 0; i < 3; i++) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7 + i); // Stagger start dates
        
        const seriesData = {
          patientId: patientId.toString(),
          type: 'mtm_session',
          title: `Series ${i + 1} - Weekly MTM`,
          scheduledDate: startDate.toISOString().split('T')[0],
          scheduledTime: `${10 + i}:00`,
          duration: 30,
          assignedTo: pharmacistId.toString(),
          isRecurring: true,
          recurrencePattern: {
            frequency: 'weekly',
            interval: 1,
            endAfterOccurrences: 5,
            daysOfWeek: [1 + i], // Different days
          },
        };

        const response = await request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(seriesData);

        expect(response.status).toBe(201);
        series.push(response.body.data.appointment.recurringSeriesId);
      }

      // Step 2: Bulk update all series
      const bulkUpdateResponse = await request(app)
        .post('/api/appointments/series/bulk-update')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          seriesIds: series,
          updates: {
            duration: 45, // Increase all to 45 minutes
            description: 'Updated via bulk operation',
          },
          updateType: 'future_instances',
          reason: 'Standardizing appointment duration',
        });

      expect(bulkUpdateResponse.status).toBe(200);
      expect(bulkUpdateResponse.body.data.updatedSeries).toBe(3);
      expect(bulkUpdateResponse.body.data.totalUpdatedAppointments).toBeGreaterThan(0);

      // Step 3: Bulk cancel one series
      const cancelResponse = await request(app)
        .post(`/api/appointments/series/${series[1]}/cancel`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          cancelType: 'all_instances',
          reason: 'Patient no longer needs regular appointments',
          notifyPatient: true,
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.data.cancelledCount).toBe(5);

      // Step 4: Generate series report
      const reportResponse = await request(app)
        .get('/api/appointments/series/report')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          patientId: patientId.toString(),
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.data.activeSeries).toBe(2); // One was cancelled
      expect(reportResponse.body.data.totalAppointments).toBeGreaterThan(0);
      expect(reportResponse.body.data.seriesDetails).toHaveLength(2);
    });
  });
});

// Helper functions
function getNextWeekday(dayOfWeek: number): Date {
  const date = new Date();
  const currentDay = date.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  const targetDate = new Date(date);
  targetDate.setDate(date.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return targetDate;
}

function getNext15thOfMonth(): Date {
  const date = new Date();
  const next15th = new Date(date.getFullYear(), date.getMonth(), 15);
  
  if (next15th <= date) {
    next15th.setMonth(next15th.getMonth() + 1);
  }
  
  return next15th;
}

function getNextQuarterStart(): Date {
  const date = new Date();
  const currentQuarter = Math.floor(date.getMonth() / 3);
  const nextQuarter = (currentQuarter + 1) % 4;
  const year = nextQuarter === 0 ? date.getFullYear() + 1 : date.getFullYear();
  
  return new Date(year, nextQuarter * 3, 1);
}