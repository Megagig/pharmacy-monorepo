/**
 * Integration tests for Public Appointment Routes
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../app';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import PublicAppointmentService from '../../services/PublicAppointmentService';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';

// Mock the notification service
jest.mock('../../services/AppointmentNotificationService', () => ({
  AppointmentNotificationService: {
    getInstance: () => ({
      sendAppointmentConfirmation: jest.fn().mockResolvedValue({ success: true }),
    }),
  },
}));

// Mock the Workplace model
jest.mock('../../models/Workplace', () => ({
  default: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        name: 'Test Pharmacy',
        address: '123 Test St',
        phone: '+1234567890',
      }),
    }),
  },
}));

describe('Public Appointment Routes', () => {
  let testPatient: any;
  let testPharmacist: any;
  let testAppointment: any;
  let testWorkplaceId: mongoose.Types.ObjectId;
  let validToken: string;

  beforeAll(async () => {
    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    testWorkplaceId = new mongoose.Types.ObjectId();

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      mrn: 'MRN001',
      workplaceId: testWorkplaceId,
      createdBy: new mongoose.Types.ObjectId(),
    });

    // Create test pharmacist
    testPharmacist = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@pharmacy.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacist',
      currentPlanId: new mongoose.Types.ObjectId(),
      workplaceId: testWorkplaceId,
    });

    // Create test appointment
    testAppointment = await Appointment.create({
      workplaceId: testWorkplaceId,
      patientId: testPatient._id,
      assignedTo: testPharmacist._id,
      type: 'mtm_session',
      title: 'Medication Therapy Management',
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      scheduledTime: '10:00',
      duration: 30,
      status: 'scheduled',
      confirmationStatus: 'pending',
      createdBy: testPharmacist._id,
    });

    // Generate valid token
    const { token } = await PublicAppointmentService.updateAppointmentWithConfirmationToken(
      testAppointment._id
    );
    validToken = token;
  });

  describe('POST /api/public/appointments/:id/confirm', () => {
    it('should confirm appointment with valid token', async () => {
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: validToken,
          patientNotes: 'I have some questions',
          specialRequirements: 'Please speak slowly',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment.status).toBe('confirmed');
      expect(response.body.data.confirmationReceipt.confirmationNumber).toMatch(/^CONF-/);
      expect(response.body.message).toBe('Appointment confirmed successfully');

      // Verify appointment was updated in database
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment?.status).toBe('confirmed');
      expect(updatedAppointment?.description).toContain('Patient Notes');
    });

    it('should confirm appointment without optional data', async () => {
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: validToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment.status).toBe('confirmed');
    });

    it('should return 400 for invalid appointment ID', async () => {
      const response = await request(app)
        .post('/api/public/appointments/invalid-id/confirm')
        .send({
          token: validToken,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: 'invalid-token',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for expired token', async () => {
      const expiredToken = jwt.sign(
        {
          appointmentId: testAppointment._id.toString(),
          patientId: testPatient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: expiredToken,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for already confirmed appointment', async () => {
      // First confirmation
      await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: validToken,
        })
        .expect(200);

      // Generate new token for second attempt
      const { token: newToken } = await PublicAppointmentService.updateAppointmentWithConfirmationToken(
        testAppointment._id
      );

      // Second confirmation should fail
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: newToken,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate patient notes length', async () => {
      const longNotes = 'a'.repeat(1001); // Exceeds 1000 character limit

      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: validToken,
          patientNotes: longNotes,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate special requirements length', async () => {
      const longRequirements = 'a'.repeat(501); // Exceeds 500 character limit

      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({
          token: validToken,
          specialRequirements: longRequirements,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle non-existent appointment', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const fakeToken = jwt.sign(
        {
          appointmentId: nonExistentId.toString(),
          patientId: testPatient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .post(`/api/public/appointments/${nonExistentId}/confirm`)
        .send({
          token: fakeToken,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/public/appointments/:id', () => {
    it('should return appointment details with valid token', async () => {
      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: validToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toMatchObject({
        _id: testAppointment._id.toString(),
        type: 'mtm_session',
        title: 'Medication Therapy Management',
        duration: 30,
        status: 'scheduled',
      });
      expect(response.body.data.patient).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(response.body.data.pharmacist).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
      });
      expect(response.body.data.workplace).toMatchObject({
        name: 'Test Pharmacy',
        address: '123 Test St',
        phone: '+1234567890',
      });
    });

    it('should return 400 for invalid appointment ID', async () => {
      const response = await request(app)
        .get('/api/public/appointments/invalid-id')
        .query({ token: validToken })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for expired token', async () => {
      const expiredToken = jwt.sign(
        {
          appointmentId: testAppointment._id.toString(),
          patientId: testPatient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: expiredToken })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when token patient does not match appointment', async () => {
      const otherPatient = await Patient.create({
        firstName: 'Other',
        lastName: 'Patient',
        email: 'other@example.com',
        phone: '+9876543210',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'female',
        mrn: 'MRN002',
        workplaceId: testWorkplaceId,
        createdBy: new mongoose.Types.ObjectId(),
      });

      const wrongPatientToken = jwt.sign(
        {
          appointmentId: testAppointment._id.toString(),
          patientId: otherPatient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: wrongPatientToken })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to confirmation endpoint', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const promises = Array.from({ length: 12 }, () =>
        request(app)
          .post(`/api/public/appointments/${testAppointment._id}/confirm`)
          .send({ token: validToken })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to details endpoint', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const promises = Array.from({ length: 52 }, () =>
        request(app)
          .get(`/api/public/appointments/${testAppointment._id}`)
          .query({ token: validToken })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    it('should not expose sensitive patient information', async () => {
      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: validToken })
        .expect(200);

      // Should not include sensitive fields like email, phone, etc.
      expect(response.body.data.patient.email).toBeUndefined();
      expect(response.body.data.patient.phone).toBeUndefined();
      expect(response.body.data.patient.dateOfBirth).toBeUndefined();
    });

    it('should not expose sensitive pharmacist information', async () => {
      const response = await request(app)
        .get(`/api/public/appointments/${testAppointment._id}`)
        .query({ token: validToken })
        .expect(200);

      // Should not include sensitive fields like email, password, etc.
      expect(response.body.data.pharmacist.email).toBeUndefined();
      expect(response.body.data.pharmacist.password).toBeUndefined();
    });

    it('should clear confirmation token after successful confirmation', async () => {
      await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({ token: validToken })
        .expect(200);

      // Verify token was cleared
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment?.metadata?.confirmationToken).toBeNull();
      expect(updatedAppointment?.metadata?.confirmationTokenExpiry).toBeNull();
    });

    it('should reject token with wrong action type', async () => {
      const wrongActionToken = jwt.sign(
        {
          appointmentId: testAppointment._id.toString(),
          patientId: testPatient._id.toString(),
          action: 'wrong_action',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({ token: wrongActionToken })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock Appointment.findById to throw an error
      const originalFindById = Appointment.findById;
      Appointment.findById = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .send({ token: validToken })
        .expect(500);

      expect(response.body.success).toBe(false);

      // Restore original method
      Appointment.findById = originalFindById;
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(`/api/public/appointments/${testAppointment._id}/confirm`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});