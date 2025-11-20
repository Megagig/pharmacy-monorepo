/**
 * End-to-End Tests for Reminder Delivery and Confirmation Workflows
 * 
 * Tests complete reminder workflows including:
 * - Multi-channel reminder delivery
 * - Patient confirmation via different channels
 * - Reminder effectiveness tracking
 * - Automated reminder scheduling and processing
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import ReminderTemplate from '../../models/ReminderTemplate';
import Notification from '../../models/Notification';
import Workplace from '../../models/Workplace';
import { generateTestToken, createTestUserData, createTestPatientData } from '../utils/testHelpers';
import jwt from 'jsonwebtoken';

// Mock external services
jest.mock('../../services/NotificationService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'email-123' }),
  sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'sms-123' }),
  sendWhatsApp: jest.fn().mockResolvedValue({ success: true, messageId: 'whatsapp-123' }),
  sendPushNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'push-123' }),
}));

describe('Reminder Workflow E2E Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistToken: string;
  let patientToken: string;

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
      ReminderTemplate.deleteMany({}),
      Notification.deleteMany({}),
      Workplace.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();

    // Create workplace
    await Workplace.create({
      _id: workplaceId,
      name: 'Reminder Test Pharmacy',
      type: 'pharmacy',
      address: '123 Reminder Street, Lagos, Nigeria',
      phone: '+234-800-123-4567',
      email: 'reminders@pharmacy.com',
      isActive: true,
    });

    // Create pharmacist
    const pharmacist = new User({
      ...createTestUserData({
        email: 'pharmacist@reminder.com',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
      }),
      workplaceId,
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;
    pharmacistToken = generateTestToken(pharmacist);

    // Create patient with notification preferences
    const patient = new Patient({
      ...createTestPatientData(workplaceId.toString(), {
        email: 'patient@reminder.com',
        mrn: 'REM001',
        phone: '+234-800-001-0001',
      }),
      _id: new mongoose.Types.ObjectId(),
      createdBy: pharmacistId,
      appointmentPreferences: {
        reminderPreferences: {
          email: true,
          sms: true,
          push: true,
          whatsapp: false,
        },
        language: 'en',
        timezone: 'Africa/Lagos',
      },
    });
    await patient.save();
    patientId = patient._id;

    // Create patient token
    patientToken = jwt.sign(
      { 
        userId: patientId, 
        workplaceId, 
        type: 'patient',
        email: patient.email 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create reminder templates
    await ReminderTemplate.create([
      {
        workplaceId,
        name: '24h Appointment Reminder',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['email', 'sms'],
        timing: {
          unit: 'hours',
          value: 24,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          email: {
            subject: 'Appointment Reminder - {{appointmentDate}}',
            body: 'Dear {{patientName}}, you have an appointment tomorrow at {{appointmentTime}} at {{pharmacyName}}. Please confirm by clicking: {{confirmUrl}}',
            htmlBody: '<p>Dear {{patientName}},</p><p>You have an appointment tomorrow at {{appointmentTime}} at {{pharmacyName}}.</p><p><a href="{{confirmUrl}}">Confirm Appointment</a> | <a href="{{rescheduleUrl}}">Reschedule</a></p>',
          },
          sms: {
            message: 'Reminder: Appointment at {{pharmacyName}} on {{appointmentDate}} at {{appointmentTime}}. Confirm: {{confirmUrl}}',
          },
        },
        isActive: true,
        isDefault: true,
        createdBy: pharmacistId,
      },
      {
        workplaceId,
        name: '2h Appointment Reminder',
        type: 'appointment',
        category: 'pre_appointment',
        channels: ['sms', 'push'],
        timing: {
          unit: 'hours',
          value: 2,
          relativeTo: 'before_appointment',
        },
        messageTemplates: {
          sms: {
            message: 'Your appointment at {{pharmacyName}} is in 2 hours ({{appointmentTime}}). See you soon!',
          },
          push: {
            title: 'Appointment in 2 Hours',
            body: 'Your appointment at {{pharmacyName}} is at {{appointmentTime}}',
            actionUrl: '/appointments/{{appointmentId}}',
          },
        },
        isActive: true,
        createdBy: pharmacistId,
      },
      {
        workplaceId,
        name: 'Medication Refill Reminder',
        type: 'medication_refill',
        category: 'medication',
        channels: ['email', 'sms'],
        timing: {
          unit: 'days',
          value: 7,
          relativeTo: 'before_due_date',
        },
        messageTemplates: {
          email: {
            subject: 'Medication Refill Due Soon',
            body: 'Dear {{patientName}}, your {{medicationName}} prescription will run out in 7 days. Please schedule a refill appointment.',
          },
          sms: {
            message: 'Refill reminder: Your {{medicationName}} runs out in 7 days. Call {{pharmacyPhone}} to schedule.',
          },
        },
        isActive: true,
        createdBy: pharmacistId,
      },
    ]);
  });

  describe('Appointment Reminder Workflow', () => {
    it('should complete full appointment reminder workflow with multi-channel delivery', async () => {
      // Step 1: Create appointment (triggers automatic reminder scheduling)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'mtm_session',
        title: 'Medication Therapy Management',
        scheduledDate: appointmentDate,
        scheduledTime: '14:00',
        duration: 60,
        assignedTo: pharmacistId.toString(),
        description: 'Comprehensive medication review',
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      expect(createResponse.status).toBe(201);
      const appointmentId = createResponse.body.data.appointment._id;
      expect(createResponse.body.data.reminders).toHaveLength(3); // 24h, 2h, 15min

      // Step 2: Verify reminders were scheduled
      const remindersResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/reminders`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(remindersResponse.status).toBe(200);
      const reminders = remindersResponse.body.data.reminders;
      
      expect(reminders).toContainEqual(
        expect.objectContaining({
          type: 'email',
          scheduledFor: expect.any(String),
          sent: false,
        })
      );
      expect(reminders).toContainEqual(
        expect.objectContaining({
          type: 'sms',
          scheduledFor: expect.any(String),
          sent: false,
        })
      );

      // Step 3: Process 24-hour reminder
      const process24hResponse = await request(app)
        .post('/api/reminders/process-pending')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          reminderType: '24h_before',
          appointmentId: appointmentId,
        });

      expect(process24hResponse.status).toBe(200);
      expect(process24hResponse.body.data.processed).toBeGreaterThan(0);

      // Step 4: Check delivery status
      const deliveryResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/reminders/delivery-status`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(deliveryResponse.status).toBe(200);
      expect(deliveryResponse.body.data.deliveryStats).toMatchObject({
        totalScheduled: expect.any(Number),
        totalSent: expect.any(Number),
        deliveryRate: expect.any(Number),
      });

      // Step 5: Patient confirms via email link
      const confirmationToken = jwt.sign(
        { 
          appointmentId, 
          patientId, 
          action: 'confirm',
          channel: 'email' 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const confirmResponse = await request(app)
        .post(`/api/appointments/${appointmentId}/confirm`)
        .send({ 
          confirmationToken,
          source: 'email_reminder',
        });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.data.confirmationStatus).toBe('confirmed');
      expect(confirmResponse.body.data.confirmedVia).toBe('email_reminder');

      // Step 6: Process 2-hour reminder (should still send despite confirmation)
      const process2hResponse = await request(app)
        .post('/api/reminders/process-pending')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          reminderType: '2h_before',
          appointmentId: appointmentId,
        });

      expect(process2hResponse.status).toBe(200);

      // Step 7: Verify reminder effectiveness tracking
      const effectivenessResponse = await request(app)
        .get('/api/reminders/effectiveness')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          appointmentId: appointmentId,
        });

      expect(effectivenessResponse.status).toBe(200);
      expect(effectivenessResponse.body.data.summary).toMatchObject({
        totalReminders: expect.any(Number),
        confirmationRate: expect.any(Number),
        responseTime: expect.any(Number),
        channelEffectiveness: expect.any(Object),
      });
    });

    it('should handle reminder delivery failures and retries', async () => {
      // Step 1: Create appointment
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'health_check',
        scheduledDate: appointmentDate,
        scheduledTime: '10:00',
        duration: 30,
        assignedTo: pharmacistId.toString(),
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      const appointmentId = createResponse.body.data.appointment._id;

      // Step 2: Mock delivery failure
      const mockNotificationService = require('../../services/NotificationService');
      mockNotificationService.sendEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      // Step 3: Process reminder (should fail and schedule retry)
      const processResponse = await request(app)
        .post('/api/reminders/process-pending')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          reminderType: '24h_before',
          appointmentId: appointmentId,
        });

      expect(processResponse.status).toBe(200);
      expect(processResponse.body.data.failures).toBeGreaterThan(0);

      // Step 4: Check failure tracking
      const failureResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/reminders/failures`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(failureResponse.status).toBe(200);
      expect(failureResponse.body.data.failures).toContainEqual(
        expect.objectContaining({
          channel: 'email',
          reason: expect.stringContaining('Email service unavailable'),
          retryCount: expect.any(Number),
        })
      );

      // Step 5: Process retry (should succeed)
      mockNotificationService.sendEmail.mockResolvedValueOnce({ success: true, messageId: 'retry-123' });

      const retryResponse = await request(app)
        .post('/api/reminders/retry-failed')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          appointmentId: appointmentId,
          channel: 'email',
        });

      expect(retryResponse.status).toBe(200);
      expect(retryResponse.body.data.retrySuccess).toBe(true);
    });
  });

  describe('Patient-Initiated Reminder Actions', () => {
    it('should handle patient reschedule requests via reminder links', async () => {
      // Step 1: Create appointment
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        scheduledDate: appointmentDate,
        scheduledTime: '11:00',
        duration: 45,
        assignedTo: pharmacistId.toString(),
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      const appointmentId = createResponse.body.data.appointment._id;

      // Step 2: Patient requests reschedule via reminder link
      const rescheduleToken = jwt.sign(
        { 
          appointmentId, 
          patientId, 
          action: 'reschedule',
          channel: 'sms' 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const newDate = dayAfterTomorrow.toISOString().split('T')[0];

      const rescheduleRequestResponse = await request(app)
        .post(`/api/appointments/${appointmentId}/reschedule-request`)
        .send({
          rescheduleToken,
          preferredOptions: [
            { date: newDate, time: '09:00' },
            { date: newDate, time: '14:00' },
            { date: appointmentDate, time: '15:00' },
          ],
          reason: 'Work schedule conflict',
          source: 'sms_reminder',
        });

      expect(rescheduleRequestResponse.status).toBe(200);
      expect(rescheduleRequestResponse.body.data.rescheduleRequestId).toBeTruthy();

      const rescheduleRequestId = rescheduleRequestResponse.body.data.rescheduleRequestId;

      // Step 3: Pharmacist receives notification about reschedule request
      const pharmacistNotifications = await Notification.find({
        userId: pharmacistId,
        type: 'appointment_reschedule_request',
      });

      expect(pharmacistNotifications.length).toBeGreaterThan(0);
      expect(pharmacistNotifications[0].title).toContain('Reschedule Request');

      // Step 4: Pharmacist approves reschedule
      const approveResponse = await request(app)
        .post(`/api/appointments/reschedule-requests/${rescheduleRequestId}/approve`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          selectedOption: { date: newDate, time: '09:00' },
          notifyPatient: true,
          pharmacistNotes: 'Approved - slot available',
        });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.appointment.scheduledDate).toBe(newDate);
      expect(approveResponse.body.data.appointment.scheduledTime).toBe('09:00');

      // Step 5: Patient receives confirmation of reschedule
      const patientNotifications = await Notification.find({
        userId: patientId,
        type: 'appointment_rescheduled',
      });

      expect(patientNotifications.length).toBeGreaterThan(0);
      expect(patientNotifications[0].title).toContain('Appointment Rescheduled');
    });

    it('should handle patient cancellation via reminder links', async () => {
      // Step 1: Create appointment
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'vaccination',
        scheduledDate: appointmentDate,
        scheduledTime: '16:00',
        duration: 15,
        assignedTo: pharmacistId.toString(),
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      const appointmentId = createResponse.body.data.appointment._id;

      // Step 2: Patient cancels via reminder link
      const cancelToken = jwt.sign(
        { 
          appointmentId, 
          patientId, 
          action: 'cancel',
          channel: 'email' 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const cancelResponse = await request(app)
        .post(`/api/appointments/${appointmentId}/cancel`)
        .send({
          cancelToken,
          reason: 'Feeling unwell - will reschedule when better',
          source: 'email_reminder',
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.data.status).toBe('cancelled');
      expect(cancelResponse.body.data.cancellationReason).toContain('Feeling unwell');

      // Step 3: Verify pharmacist notification
      const pharmacistNotifications = await Notification.find({
        userId: pharmacistId,
        type: 'appointment_cancelled',
      });

      expect(pharmacistNotifications.length).toBeGreaterThan(0);

      // Step 4: Verify slot becomes available again
      const availabilityResponse = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: workplaceId.toString(),
          date: appointmentDate,
          type: 'vaccination',
          duration: 15,
        });

      expect(availabilityResponse.status).toBe(200);
      const availableSlots = availabilityResponse.body.data.slots.filter((slot: any) => slot.available);
      expect(availableSlots.some((slot: any) => slot.time === '16:00')).toBe(true);
    });
  });

  describe('Medication Refill Reminders', () => {
    it('should handle medication refill reminder workflow', async () => {
      // Step 1: Create patient with medication that expires soon
      const medicationEndDate = new Date();
      medicationEndDate.setDate(medicationEndDate.getDate() + 8); // 8 days from now

      // Update patient with medication information
      await Patient.findByIdAndUpdate(patientId, {
        $push: {
          medications: {
            name: 'Lisinopril 10mg',
            dosage: '10mg',
            frequency: 'once daily',
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
            endDate: medicationEndDate,
            prescribedBy: 'Dr. Smith',
            isActive: true,
          },
        },
      });

      // Step 2: Process medication refill reminders (simulated daily job)
      const processRefillResponse = await request(app)
        .post('/api/reminders/process-medication-refills')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          workplaceId: workplaceId.toString(),
          daysAhead: 7, // Check for medications expiring in 7 days
        });

      expect(processRefillResponse.status).toBe(200);
      expect(processRefillResponse.body.data.remindersCreated).toBeGreaterThan(0);

      // Step 3: Verify refill reminder was sent
      const refillReminders = await Notification.find({
        userId: patientId,
        type: 'medication_refill_reminder',
      });

      expect(refillReminders.length).toBeGreaterThan(0);
      expect(refillReminders[0].title).toContain('Medication Refill');
      expect(refillReminders[0].message).toContain('Lisinopril');

      // Step 4: Patient responds to refill reminder by booking appointment
      const refillAppointmentData = {
        patientId: patientId.toString(),
        type: 'medication_refill',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scheduledTime: '13:00',
        duration: 15,
        assignedTo: pharmacistId.toString(),
        description: 'Lisinopril refill consultation',
        metadata: {
          source: 'refill_reminder',
          medicationName: 'Lisinopril 10mg',
        },
      };

      const refillBookingResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(refillAppointmentData);

      expect(refillBookingResponse.status).toBe(201);
      expect(refillBookingResponse.body.data.appointment.type).toBe('medication_refill');

      // Step 5: Track refill reminder effectiveness
      const effectivenessResponse = await request(app)
        .get('/api/reminders/medication-refill-effectiveness')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(effectivenessResponse.status).toBe(200);
      expect(effectivenessResponse.body.data.summary).toMatchObject({
        totalRefillReminders: expect.any(Number),
        appointmentsBooked: expect.any(Number),
        responseRate: expect.any(Number),
      });
    });
  });

  describe('Reminder Analytics and Optimization', () => {
    it('should provide comprehensive reminder analytics', async () => {
      // Step 1: Create multiple appointments with different reminder outcomes
      const appointments = [];
      for (let i = 0; i < 5; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i + 1);
        
        const appointmentData = {
          patientId: patientId.toString(),
          type: 'health_check',
          scheduledDate: futureDate.toISOString().split('T')[0],
          scheduledTime: `${10 + i}:00`,
          duration: 30,
          assignedTo: pharmacistId.toString(),
        };

        const response = await request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(appointmentData);

        appointments.push(response.body.data.appointment);
      }

      // Step 2: Simulate different reminder outcomes
      // Confirm first appointment
      const confirmToken1 = jwt.sign(
        { appointmentId: appointments[0]._id, patientId, action: 'confirm' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      await request(app)
        .post(`/api/appointments/${appointments[0]._id}/confirm`)
        .send({ confirmationToken: confirmToken1 });

      // Reschedule second appointment
      const rescheduleToken2 = jwt.sign(
        { appointmentId: appointments[1]._id, patientId, action: 'reschedule' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      await request(app)
        .post(`/api/appointments/${appointments[1]._id}/reschedule-request`)
        .send({
          rescheduleToken: rescheduleToken2,
          preferredOptions: [{ date: appointments[1].scheduledDate, time: '15:00' }],
          reason: 'Schedule conflict',
        });

      // Cancel third appointment
      const cancelToken3 = jwt.sign(
        { appointmentId: appointments[2]._id, patientId, action: 'cancel' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      await request(app)
        .post(`/api/appointments/${appointments[2]._id}/cancel`)
        .send({
          cancelToken: cancelToken3,
          reason: 'No longer needed',
        });

      // Step 3: Generate comprehensive analytics
      const analyticsResponse = await request(app)
        .get('/api/reminders/analytics')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.data).toMatchObject({
        summary: {
          totalReminders: expect.any(Number),
          deliveryRate: expect.any(Number),
          responseRate: expect.any(Number),
          confirmationRate: expect.any(Number),
          rescheduleRate: expect.any(Number),
          cancellationRate: expect.any(Number),
        },
        channelPerformance: expect.any(Object),
        timeBasedAnalysis: expect.any(Object),
        patientEngagement: expect.any(Object),
      });

      // Step 4: Get optimization recommendations
      const optimizationResponse = await request(app)
        .get('/api/reminders/optimization-recommendations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          workplaceId: workplaceId.toString(),
        });

      expect(optimizationResponse.status).toBe(200);
      expect(optimizationResponse.body.data.recommendations).toBeInstanceOf(Array);
      expect(optimizationResponse.body.data.recommendations.length).toBeGreaterThan(0);

      // Should include recommendations like optimal timing, channel preferences, etc.
      const recommendations = optimizationResponse.body.data.recommendations;
      expect(recommendations.some((rec: any) => rec.type === 'timing_optimization')).toBe(true);
      expect(recommendations.some((rec: any) => rec.type === 'channel_optimization')).toBe(true);
    });
  });
});