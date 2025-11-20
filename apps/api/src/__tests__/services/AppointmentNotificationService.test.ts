/**
 * Integration tests for AppointmentNotificationService
 * Tests the integration with the existing notification system
 * Requirements: 7.6, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Appointment from '../../models/Appointment';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Notification from '../../models/Notification';
import { appointmentNotificationService } from '../../services/AppointmentNotificationService';
import { notificationService } from '../../services/notificationService';

describe('AppointmentNotificationService Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let appointmentId: mongoose.Types.ObjectId;

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
      createdBy: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;

    // Create test appointment
    const appointment = new Appointment({
      workplaceId,
      patientId,
      assignedTo: pharmacistId,
      type: 'mtm_session',
      title: 'MTM Session - John Doe',
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
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
    appointmentId = appointment._id;
  });

  describe('sendAppointmentReminder', () => {
    it('should send appointment reminder notification successfully', async () => {
      const result = await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '24h',
        {
          channels: ['email', 'sms'],
          includeConfirmationLink: true,
          includeRescheduleLink: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();
      expect(result.deliveryChannels.email).toBe(true);
      expect(result.deliveryChannels.sms).toBe(true);

      // Verify notification was created
      const notification = await Notification.findById(result.notificationId);
      expect(notification).toBeTruthy();
      expect(notification!.type).toBe('appointment_reminder');
      expect(notification!.userId.toString()).toBe(patientId.toString());
      expect(notification!.data.appointmentId!.toString()).toBe(appointmentId.toString());
      expect(notification!.data.metadata.confirmationUrl).toContain('confirm');
      expect(notification!.data.metadata.rescheduleUrl).toContain('reschedule');
    });

    it('should generate and store confirmation token', async () => {
      await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '2h',
        {
          includeConfirmationLink: true,
        }
      );

      const appointment = await Appointment.findById(appointmentId);
      expect(appointment!.metadata.confirmationToken).toBeDefined();
      expect(appointment!.metadata.confirmationTokenExpiry).toBeDefined();
      expect(new Date(appointment!.metadata.confirmationTokenExpiry)).toBeInstanceOf(Date);
    });

    it('should handle different reminder types with appropriate priorities', async () => {
      const testCases = [
        { reminderType: '24h' as const, expectedPriority: 'low' as const },
        { reminderType: '2h' as const, expectedPriority: 'normal' as const },
        { reminderType: '15min' as const, expectedPriority: 'high' as const },
      ];

      for (const testCase of testCases) {
        const result = await appointmentNotificationService.sendAppointmentReminder(
          appointmentId,
          testCase.reminderType
        );

        expect(result.success).toBe(true);

        const notification = await Notification.findById(result.notificationId);
        expect(notification!.priority).toBe(testCase.expectedPriority);
      }
    });

    it('should respect patient notification preferences', async () => {
      // Update patient to disable SMS
      await Patient.findByIdAndUpdate(patientId, {
        'notificationPreferences.sms': false,
      });

      const result = await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '24h',
        {
          channels: ['email', 'sms'],
        }
      );

      expect(result.success).toBe(true);
      expect(result.deliveryChannels.email).toBe(true);
      expect(result.deliveryChannels.sms).toBe(false); // Should be disabled due to preferences
    });
  });

  describe('sendAppointmentConfirmation', () => {
    it('should send appointment confirmation notification', async () => {
      const result = await appointmentNotificationService.sendAppointmentConfirmation(
        appointmentId
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('appointment_confirmed');
      expect(notification!.title).toContain('Appointment Confirmed');
      expect(notification!.data.metadata.confirmedAt).toBeDefined();
    });
  });

  describe('sendAppointmentRescheduled', () => {
    it('should send appointment rescheduled notification', async () => {
      const oldDate = new Date('2025-10-25');
      const oldTime = '09:00';

      const result = await appointmentNotificationService.sendAppointmentRescheduled(
        appointmentId,
        oldDate,
        oldTime
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('appointment_rescheduled');
      expect(notification!.priority).toBe('high');
      expect(notification!.data.metadata.oldDate).toBeDefined();
      expect(notification!.data.metadata.oldTime).toBe(oldTime);
    });
  });

  describe('sendAppointmentCancelled', () => {
    it('should send appointment cancelled notification', async () => {
      const reason = 'Patient requested cancellation';

      const result = await appointmentNotificationService.sendAppointmentCancelled(
        appointmentId,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('appointment_cancelled');
      expect(notification!.priority).toBe('high');
      expect(notification!.data.metadata.reason).toBe(reason);
      expect(notification!.data.actionUrl).toContain('/appointments/book');
    });
  });

  describe('sendFollowUpTaskAssigned', () => {
    let followUpTaskId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      followUpTaskId = new mongoose.Types.ObjectId();
      
      // Mock FollowUpTask model
      const mockFollowUpTask = {
        _id: followUpTaskId,
        patientId: { _id: patientId, firstName: 'John', lastName: 'Doe' },
        assignedTo: { _id: pharmacistId, firstName: 'Dr. Jane', lastName: 'Smith', email: 'jane.smith@pharmacy.com' },
        type: 'medication_start_followup',
        title: 'Follow-up for new medication',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: pharmacistId,
      };

      // Mock the require call
      jest.doMock('../../models/FollowUpTask', () => ({
        default: {
          findById: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockFollowUpTask),
          }),
        },
      }));
    });

    it('should send follow-up task assigned notification', async () => {
      const result = await appointmentNotificationService.sendFollowUpTaskAssigned(
        followUpTaskId,
        pharmacistId,
        workplaceId
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('followup_task_assigned');
      expect(notification!.userId.toString()).toBe(pharmacistId.toString());
    });
  });

  describe('sendMedicationRefillDue', () => {
    it('should send medication refill due notification', async () => {
      const medicationName = 'Metformin 500mg';
      const daysUntilDue = 3;

      const result = await appointmentNotificationService.sendMedicationRefillDue(
        patientId,
        medicationName,
        daysUntilDue,
        workplaceId
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('medication_refill_due');
      expect(notification!.priority).toBe('high'); // High priority for 3 days
      expect(notification!.data.medicationName).toBe(medicationName);
      expect(notification!.data.metadata.daysUntilDue).toBe(daysUntilDue);
    });

    it('should set normal priority for refills due in more than 3 days', async () => {
      const result = await appointmentNotificationService.sendMedicationRefillDue(
        patientId,
        'Lisinopril 10mg',
        7,
        workplaceId
      );

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.priority).toBe('normal');
    });
  });

  describe('sendAdherenceCheckReminder', () => {
    it('should send adherence check reminder notification', async () => {
      const medicationName = 'Atorvastatin 20mg';

      const result = await appointmentNotificationService.sendAdherenceCheckReminder(
        patientId,
        medicationName,
        workplaceId
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();

      const notification = await Notification.findById(result.notificationId);
      expect(notification!.type).toBe('adherence_check_reminder');
      expect(notification!.priority).toBe('normal');
      expect(notification!.data.medicationName).toBe(medicationName);
    });
  });

  describe('verifyConfirmationToken', () => {
    it('should verify valid confirmation token', async () => {
      // First send a reminder to generate a token
      await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '24h',
        { includeConfirmationLink: true }
      );

      const appointment = await Appointment.findById(appointmentId);
      const token = appointment!.metadata.confirmationToken;

      const result = await appointmentNotificationService.verifyConfirmationToken(
        appointmentId,
        token
      );

      expect(result.valid).toBe(true);
      expect(result.expired).toBeUndefined();
    });

    it('should reject invalid confirmation token', async () => {
      const result = await appointmentNotificationService.verifyConfirmationToken(
        appointmentId,
        'invalid-token'
      );

      expect(result.valid).toBe(false);
    });

    it('should detect expired confirmation token', async () => {
      // Create appointment with expired token
      await Appointment.findByIdAndUpdate(appointmentId, {
        'metadata.confirmationToken': 'test-token',
        'metadata.confirmationTokenExpiry': new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const result = await appointmentNotificationService.verifyConfirmationToken(
        appointmentId,
        'test-token'
      );

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle appointment not found gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const result = await appointmentNotificationService.sendAppointmentReminder(
        nonExistentId,
        '24h'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle patient not found gracefully', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();

      const result = await appointmentNotificationService.sendMedicationRefillDue(
        nonExistentPatientId,
        'Test Medication',
        7,
        workplaceId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('delivery channel determination', () => {
    it('should default to email when patient has no preferences', async () => {
      // Update patient to have no notification preferences
      await Patient.findByIdAndUpdate(patientId, {
        $unset: { notificationPreferences: 1 },
      });

      const result = await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '24h'
      );

      expect(result.success).toBe(true);
      expect(result.deliveryChannels.inApp).toBe(true); // Always enabled
      expect(result.deliveryChannels.email).toBe(true); // Default fallback
    });

    it('should respect requested channels when provided', async () => {
      const result = await appointmentNotificationService.sendAppointmentReminder(
        appointmentId,
        '24h',
        {
          channels: ['push'], // Only push notifications
        }
      );

      expect(result.success).toBe(true);
      expect(result.deliveryChannels.inApp).toBe(true); // Always enabled
      expect(result.deliveryChannels.email).toBe(false);
      expect(result.deliveryChannels.sms).toBe(false);
      expect(result.deliveryChannels.push).toBe(true);
    });
  });
});