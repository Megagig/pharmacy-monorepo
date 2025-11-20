/**
 * Integration tests for appointment notification system
 * Tests the complete flow from appointment operations to notification delivery
 * Requirements: 7.6, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Notification from '../../models/Notification';
import { generateTestToken } from '../utils/testHelpers';

describe('Appointment Notification Integration', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let authToken: string;

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
    // Clear all collections
    await Promise.all([
      Appointment.deleteMany({}),
      Patient.deleteMany({}),
      User.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Create test data
    workplaceId = new mongoose.Types.ObjectId();

    // Create test patient
    const patient = new Patient({
      workplaceId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      mrn: 'MRN001',
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
      },
      createdBy: new mongoose.Types.ObjectId(),
    });
    await patient.save();
    patientId = patient._id;

    // Create test pharmacist
    const pharmacist = new User({
      workplaceId,
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      email: 'jane.smith@pharmacy.com',
      phone: '+1987654321',
      role: 'pharmacist',
      isActive: true,
      passwordHash: 'test-hash',
      currentPlanId: new mongoose.Types.ObjectId(),
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
      },
      createdBy: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;

    // Generate auth token
    authToken = generateTestToken(pharmacistId, workplaceId);
  });

  describe('Appointment Reschedule Notifications', () => {
    it('should send notification when appointment is rescheduled', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTM Session - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Reschedule appointment with notification
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
          newTime: '14:00',
          reason: 'Patient requested different time',
          notifyPatient: true,
        });

      expect(response.status).toBe(200);

      // Verify notification was created
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_rescheduled',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Appointment Rescheduled');
      expect(notifications[0].data.appointmentId!.toString()).toBe(appointment._id.toString());
      expect(notifications[0].data.metadata.reason).toBe('Patient requested different time');
    });
  });

  describe('Appointment Cancellation Notifications', () => {
    it('should send notification when appointment is cancelled', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '15:00',
        duration: 45,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Cancel appointment with notification
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Pharmacy emergency closure',
          notifyPatient: true,
        });

      expect(response.status).toBe(200);

      // Verify notification was created
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_cancelled',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Appointment Cancelled');
      expect(notifications[0].priority).toBe('high');
      expect(notifications[0].data.metadata.reason).toBe('Pharmacy emergency closure');
    });
  });

  describe('Appointment Confirmation Flow', () => {
    it('should handle appointment confirmation with token verification', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'vaccination',
        title: 'Vaccination - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '11:00',
        duration: 15,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'manual',
          confirmationToken: 'test-token-123',
          confirmationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Confirm appointment using token
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/confirm`)
        .send({
          confirmationToken: 'test-token-123',
        });

      expect(response.status).toBe(200);

      // Verify appointment status was updated
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment!.confirmationStatus).toBe('confirmed');

      // Verify confirmation notification was sent
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_confirmed',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Appointment Confirmed');
    });

    it('should reject invalid confirmation token', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Follow-up - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '16:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: {
          source: 'manual',
          confirmationToken: 'valid-token-456',
          confirmationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Try to confirm with invalid token
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/confirm`)
        .send({
          confirmationToken: 'invalid-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid confirmation token');

      // Verify appointment status was not updated
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment!.confirmationStatus).toBe('pending');
    });
  });

  describe('Notification Template Integration', () => {
    it('should use correct templates for different notification types', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'chronic_disease_review',
        title: 'Chronic Disease Review - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '09:30',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Send reminder notification
      const response = await request(app)
        .post(`/api/reminders/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointmentId: appointment._id.toString(),
          channels: ['email'],
        });

      expect(response.status).toBe(200);

      // Verify notification uses correct template
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_reminder',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Appointment Reminder');
      expect(notifications[0].content).toContain('Chronic Disease Review');
      expect(notifications[0].content).toContain('John');
      expect(notifications[0].content).toContain('Dr. Jane');
    });
  });

  describe('Multi-channel Delivery', () => {
    it('should respect patient notification preferences for multi-channel delivery', async () => {
      // Update patient preferences to disable SMS
      await Patient.findByIdAndUpdate(patientId, {
        'notificationPreferences.sms': false,
      });

      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'new_medication_consultation',
        title: 'New Medication Consultation - John Doe',
        scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        scheduledTime: '13:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Send reminder through multiple channels
      const response = await request(app)
        .post(`/api/reminders/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointmentId: appointment._id.toString(),
          channels: ['email', 'sms', 'push'],
        });

      expect(response.status).toBe(200);

      // Verify notification was created with correct delivery channels
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_reminder',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].deliveryChannels.email).toBe(true);
      expect(notifications[0].deliveryChannels.sms).toBe(false); // Disabled by patient preference
      expect(notifications[0].deliveryChannels.push).toBe(true);
      expect(notifications[0].deliveryChannels.inApp).toBe(true); // Always enabled
    });
  });

  describe('Delivery Status Tracking', () => {
    it('should track notification delivery status', async () => {
      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'smoking_cessation',
        title: 'Smoking Cessation - John Doe',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '14:30',
        duration: 45,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Send reminder
      const response = await request(app)
        .post(`/api/reminders/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointmentId: appointment._id.toString(),
          channels: ['email'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.remindersSent).toBeDefined();
      expect(response.body.data.remindersSent[0].status).toBe('sent');

      // Verify notification has delivery status
      const notifications = await Notification.find({
        userId: patientId,
        type: 'appointment_reminder',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].deliveryStatus).toBeDefined();
      expect(notifications[0].deliveryStatus.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle notification service failures gracefully', async () => {
      // Create appointment with invalid patient ID to trigger error
      const appointment = new Appointment({
        workplaceId,
        patientId: new mongoose.Types.ObjectId(), // Non-existent patient
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Follow-up - Invalid Patient',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        reminders: [],
        relatedRecords: {},
        metadata: { source: 'manual' },
        createdBy: pharmacistId,
      });
      await appointment.save();

      // Try to reschedule (should succeed even if notification fails)
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
          newTime: '15:00',
          reason: 'Schedule change',
          notifyPatient: true,
        });

      // Appointment reschedule should succeed even if notification fails
      expect(response.status).toBe(200);

      // Verify appointment was rescheduled
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment!.scheduledTime).toBe('15:00');
    });
  });
});