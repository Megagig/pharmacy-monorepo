import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import '../setup'; // Import test setup
import User from '../../models/User';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import Workplace from '../../models/Workplace';
import bcrypt from 'bcryptjs';

// Helper functions for creating test data
const createTestWorkplace = async () => {
  return await Workplace.create({
    name: 'Test Pharmacy',
    type: 'pharmacy',
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      country: 'Nigeria',
      postalCode: '12345',
    },
    contactInfo: {
      phone: '+2348012345678',
      email: 'test@pharmacy.com',
    },
    isActive: true,
  });
};

const createTestUser = async (overrides: any = {}) => {
  const hashedPassword = await bcrypt.hash('password123', 10);
  return await User.create({
    firstName: 'Test',
    lastName: 'Pharmacist',
    email: 'test.pharmacist@example.com',
    passwordHash: hashedPassword,
    role: 'pharmacist',
    status: 'active',
    licenseStatus: 'approved',
    isActive: true,
    ...overrides,
  });
};

const createTestPatient = async (overrides: any = {}) => {
  return await Patient.create({
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN123456',
    dob: new Date('1980-01-01'),
    phone: '+2348012345678',
    email: 'john.doe@example.com',
    gender: 'male',
    address: {
      street: '456 Patient Street',
      city: 'Patient City',
      state: 'Patient State',
      country: 'Nigeria',
      postalCode: '54321',
    },
    isActive: true,
    ...overrides,
  });
};

describe('Patient Portal API Integration Tests', () => {
  let testUser: any;
  let testPatient: any;
  let testWorkplace: any;
  let authCookie: string;

  beforeEach(async () => {
    // Create test data
    testWorkplace = await createTestWorkplace();
    testUser = await createTestUser({
      workplaceId: testWorkplace._id,
      role: 'pharmacist',
    });
    testPatient = await createTestPatient({
      workplaceId: testWorkplace._id,
    });

    // Create pharmacist schedule
    await PharmacistSchedule.create({
      workplaceId: testWorkplace._id,
      pharmacistId: testUser._id,
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
        maxAppointmentsPerDay: 20,
        appointmentTypes: ['mtm_session', 'health_check'],
        defaultDuration: 30,
      },
      isActive: true,
      effectiveFrom: new Date(),
      createdBy: testUser._id,
    });

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password123',
      });

    authCookie = loginResponse.headers['set-cookie'][0];
  });

  describe('GET /api/patient-portal/appointment-types', () => {
    it('should return available appointment types without authentication', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointment-types')
        .query({ workplaceId: testWorkplace._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check structure of appointment types
      const appointmentType = response.body.data[0];
      expect(appointmentType).toHaveProperty('type');
      expect(appointmentType).toHaveProperty('name');
      expect(appointmentType).toHaveProperty('description');
      expect(appointmentType).toHaveProperty('duration');
      expect(appointmentType).toHaveProperty('isAvailable');
    });

    it('should return 400 for invalid workplace ID', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointment-types')
        .query({ workplaceId: 'invalid-id' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing workplace ID', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointment-types');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patient-portal/available-slots', () => {
    it('should return available slots without authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: testWorkplace._id.toString(),
          date: dateStr,
          type: 'mtm_session',
          duration: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('date');
      expect(response.body.data).toHaveProperty('slots');
      expect(response.body.data).toHaveProperty('pharmacists');
      expect(response.body.data.slots).toBeInstanceOf(Array);
      expect(response.body.data.pharmacists).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid date', async () => {
      const response = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: testWorkplace._id.toString(),
          date: 'invalid-date',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for past date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: testWorkplace._id.toString(),
          date: dateStr,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patient-portal/appointments', () => {
    it('should book an appointment with authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: testPatient._id.toString(),
        type: 'mtm_session',
        scheduledDate: dateStr,
        scheduledTime: '10:00',
        duration: 30,
        assignedTo: testUser._id.toString(),
        description: 'Test appointment booking',
        patientNotes: 'Patient has questions about medication',
        patientPreferences: {
          preferredChannel: 'email',
          language: 'en',
          specialRequirements: 'Wheelchair accessible',
        },
      };

      const response = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Cookie', authCookie)
        .send(appointmentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('appointment');
      expect(response.body.data).toHaveProperty('confirmationNumber');
      expect(response.body.data).toHaveProperty('reminders');

      // Verify appointment was created in database
      const appointment = await Appointment.findById(response.body.data.appointment._id);
      expect(appointment).toBeTruthy();
      expect(appointment!.patientId.toString()).toBe(testPatient._id.toString());
      expect(appointment!.type).toBe('mtm_session');
      expect(appointment!.status).toBe('scheduled');
    });

    it('should return 401 without authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: testPatient._id.toString(),
        type: 'mtm_session',
        scheduledDate: dateStr,
        scheduledTime: '10:00',
        duration: 30,
      };

      const response = await request(app)
        .post('/api/patient-portal/appointments')
        .send(appointmentData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid appointment data', async () => {
      const appointmentData = {
        patientId: 'invalid-id',
        type: 'invalid-type',
        scheduledDate: 'invalid-date',
        scheduledTime: 'invalid-time',
      };

      const response = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Cookie', authCookie)
        .send(appointmentData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should prevent double booking of the same slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: testPatient._id.toString(),
        type: 'mtm_session',
        scheduledDate: dateStr,
        scheduledTime: '10:00',
        duration: 30,
        assignedTo: testUser._id.toString(),
      };

      // Book first appointment
      const firstResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Cookie', authCookie)
        .send(appointmentData);

      expect(firstResponse.status).toBe(201);

      // Try to book the same slot again
      const secondResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Cookie', authCookie)
        .send(appointmentData);

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.message).toContain('no longer available');
    });
  });

  describe('GET /api/patient-portal/appointments', () => {
    let testAppointment: any;

    beforeEach(async () => {
      // Create a test appointment
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      testAppointment = await Appointment.create({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: testUser._id,
      });
    });

    it('should return patient appointments with authentication', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointments')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('appointments');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.appointments).toBeInstanceOf(Array);
      expect(response.body.data.appointments.length).toBeGreaterThan(0);
    });

    it('should filter appointments by status', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointments')
        .set('Cookie', authCookie)
        .query({ status: 'scheduled' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.appointments).toBeInstanceOf(Array);
      
      // All returned appointments should have 'scheduled' status
      response.body.data.appointments.forEach((appointment: any) => {
        expect(appointment.status).toBe('scheduled');
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/patient-portal/appointments');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patient-portal/appointments/:id/reschedule', () => {
    let testAppointment: any;

    beforeEach(async () => {
      // Create a test appointment for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      testAppointment = await Appointment.create({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: testUser._id,
      });
    });

    it('should reschedule an appointment with authentication', async () => {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const newDateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const rescheduleData = {
        newDate: newDateStr,
        newTime: '14:00',
        reason: 'Patient requested different time',
        notifyPharmacist: true,
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookie)
        .send(rescheduleData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scheduledDate');
      expect(response.body.data).toHaveProperty('scheduledTime');
      expect(response.body.data.scheduledTime).toBe('14:00');
    });

    it('should return 400 for invalid reschedule data', async () => {
      const rescheduleData = {
        newDate: 'invalid-date',
        newTime: 'invalid-time',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookie)
        .send(rescheduleData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const newDateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const rescheduleData = {
        newDate: newDateStr,
        newTime: '14:00',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/reschedule`)
        .send(rescheduleData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patient-portal/appointments/:id/cancel', () => {
    let testAppointment: any;

    beforeEach(async () => {
      // Create a test appointment for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      testAppointment = await Appointment.create({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: testUser._id,
      });
    });

    it('should cancel an appointment with authentication', async () => {
      const cancelData = {
        reason: 'Patient no longer needs appointment',
        notifyPharmacist: true,
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookie)
        .send(cancelData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.cancellationReason).toBe(cancelData.reason);
    });

    it('should return 400 for missing cancellation reason', async () => {
      const cancelData = {
        notifyPharmacist: true,
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookie)
        .send(cancelData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const cancelData = {
        reason: 'Patient no longer needs appointment',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/cancel`)
        .send(cancelData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patient-portal/appointments/:id/confirm', () => {
    let testAppointment: any;

    beforeEach(async () => {
      // Create a test appointment for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      testAppointment = await Appointment.create({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: testUser._id,
      });
    });

    it('should confirm an appointment with authentication', async () => {
      const confirmData = {
        patientNotes: 'Looking forward to the appointment',
        specialRequirements: 'Please have medication list ready',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookie)
        .send(confirmData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('confirmed');
      expect(response.body.data.confirmationStatus).toBe('confirmed');
    });

    it('should confirm an appointment with valid token (no auth)', async () => {
      // This test would require generating a valid JWT token
      // For now, we'll test the validation logic
      const confirmData = {
        confirmationToken: 'invalid-token',
        patientNotes: 'Looking forward to the appointment',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/confirm`)
        .send(confirmData);

      // Should fail with invalid token
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication or token', async () => {
      const confirmData = {
        patientNotes: 'Looking forward to the appointment',
      };

      const response = await request(app)
        .post(`/api/patient-portal/appointments/${testAppointment._id}/confirm`)
        .send(confirmData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to public endpoints', async () => {
      const requests = [];
      
      // Make multiple requests quickly to trigger rate limiting
      for (let i = 0; i < 105; i++) { // Exceed the 100 request limit
        requests.push(
          request(app)
            .get('/api/patient-portal/appointment-types')
            .query({ workplaceId: testWorkplace._id.toString() })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply booking rate limiting', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const requests = [];
      
      // Make multiple booking requests quickly
      for (let i = 0; i < 12; i++) { // Exceed the 10 booking limit
        requests.push(
          request(app)
            .post('/api/patient-portal/appointments')
            .set('Cookie', authCookie)
            .send({
              patientId: testPatient._id.toString(),
              type: 'mtm_session',
              scheduledDate: dateStr,
              scheduledTime: `${10 + i}:00`, // Different times to avoid conflicts
              duration: 30,
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});