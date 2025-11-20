/**
 * Tests for PublicAppointmentService
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import PublicAppointmentService, {
  TokenValidationError,
  AppointmentNotFoundError,
  AppointmentStateError,
} from '../../services/PublicAppointmentService';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';

// Mock the notification service
jest.mock('../../services/AppointmentNotificationService', () => ({
  AppointmentNotificationService: {
    getInstance: jest.fn(() => ({
      sendAppointmentConfirmation: jest.fn().mockResolvedValue({ success: true }),
    })),
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

describe('PublicAppointmentService', () => {
  let testPatient: any;
  let testPharmacist: any;
  let testAppointment: any;
  let testWorkplaceId: mongoose.Types.ObjectId;

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
  });

  describe('generateConfirmationToken', () => {
    it('should generate a valid JWT token with correct payload', () => {
      const { token, expiresAt } = PublicAppointmentService.generateConfirmationToken(
        testAppointment._id,
        testPatient._id
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify token payload
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.appointmentId).toBe(testAppointment._id.toString());
      expect(decoded.patientId).toBe(testPatient._id.toString());
      expect(decoded.action).toBe('confirm_appointment');
    });

    it('should set token expiry to 24 hours from now', () => {
      const { expiresAt } = PublicAppointmentService.generateConfirmationToken(
        testAppointment._id,
        testPatient._id
      );

      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('updateAppointmentWithConfirmationToken', () => {
    it('should update appointment with confirmation token', async () => {
      const { token, expiresAt } = await PublicAppointmentService.updateAppointmentWithConfirmationToken(
        testAppointment._id
      );

      expect(token).toBeDefined();
      expect(expiresAt).toBeInstanceOf(Date);

      // Verify appointment was updated
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment?.metadata?.confirmationToken).toBe(token);
      expect(updatedAppointment?.metadata?.confirmationTokenExpiry).toEqual(expiresAt);
    });

    it('should throw error for non-existent appointment', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        PublicAppointmentService.updateAppointmentWithConfirmationToken(nonExistentId)
      ).rejects.toThrow(AppointmentNotFoundError);
    });
  });

  describe('confirmAppointmentWithToken', () => {
    let validToken: string;

    beforeEach(async () => {
      const { token } = await PublicAppointmentService.updateAppointmentWithConfirmationToken(
        testAppointment._id
      );
      validToken = token;
    });

    it('should successfully confirm appointment with valid token', async () => {
      const confirmationData = {
        patientNotes: 'I have some questions about my medications',
        specialRequirements: 'Please speak slowly',
      };

      const result = await PublicAppointmentService.confirmAppointmentWithToken(
        testAppointment._id,
        validToken,
        confirmationData
      );

      expect(result.appointment.status).toBe('confirmed');
      expect(result.appointment.confirmationStatus).toBe('confirmed');
      expect(result.appointment.confirmedAt).toBeInstanceOf(Date);
      expect(result.confirmationReceipt.confirmationNumber).toMatch(/^CONF-/);
      expect(result.confirmationReceipt.message).toContain('confirmed');
      expect(typeof result.notificationSent).toBe('boolean');

      // Verify appointment was updated in database
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment?.status).toBe('confirmed');
      expect(updatedAppointment?.description).toContain('Patient Notes');
      expect(updatedAppointment?.patientPreferences?.specialRequirements).toBe('Please speak slowly');
      expect(updatedAppointment?.metadata?.confirmationToken).toBeNull();
    });

    it('should confirm appointment without optional data', async () => {
      const result = await PublicAppointmentService.confirmAppointmentWithToken(
        testAppointment._id,
        validToken,
        {}
      );

      expect(result.appointment.status).toBe('confirmed');
      expect(result.confirmationReceipt).toBeDefined();
    });

    it('should throw error with invalid token', async () => {
      await expect(
        PublicAppointmentService.confirmAppointmentWithToken(
          testAppointment._id,
          'invalid-token',
          {}
        )
      ).rejects.toThrow(TokenValidationError);
    });

    it('should throw error with expired token', async () => {
      const expiredToken = jwt.sign(
        {
          appointmentId: testAppointment._id.toString(),
          patientId: testPatient._id.toString(),
          action: 'confirm_appointment',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      await expect(
        PublicAppointmentService.confirmAppointmentWithToken(testAppointment._id, expiredToken, {})
      ).rejects.toThrow(TokenValidationError);
    });

    it('should throw error for already confirmed appointment', async () => {
      // First confirmation
      await PublicAppointmentService.confirmAppointmentWithToken(testAppointment._id, validToken, {});

      // Generate new token for second attempt
      const { token: newToken } = await PublicAppointmentService.updateAppointmentWithConfirmationToken(
        testAppointment._id
      );

      // Second confirmation should fail
      await expect(
        PublicAppointmentService.confirmAppointmentWithToken(testAppointment._id, newToken, {})
      ).rejects.toThrow(AppointmentStateError);
    });

    it('should throw error for cancelled appointment', async () => {
      // Cancel the appointment
      await Appointment.findByIdAndUpdate(testAppointment._id, { status: 'cancelled' });

      await expect(
        PublicAppointmentService.confirmAppointmentWithToken(testAppointment._id, validToken, {})
      ).rejects.toThrow(AppointmentStateError);
    });
  });
});