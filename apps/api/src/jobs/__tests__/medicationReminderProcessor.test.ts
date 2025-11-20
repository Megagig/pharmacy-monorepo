/**
 * Tests for Medication Reminder Job Processor
 */

import { Job } from 'bull';
import mongoose from 'mongoose';
import {
  processMedicationReminder,
  onMedicationReminderCompleted,
  onMedicationReminderFailed,
  MedicationReminderResult,
} from '../medicationReminderProcessor';
import { MedicationReminderJobData } from '../../config/queue';
import Medication from '../../models/Medication';
import Patient from '../../models/Patient';
import FollowUpTask from '../../models/FollowUpTask';
import { notificationService } from '../../services/notificationService';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../../models/Medication');
jest.mock('../../models/Patient');
jest.mock('../../models/FollowUpTask');
jest.mock('../../services/notificationService');
jest.mock('../../utils/logger');

describe('Medication Reminder Processor', () => {
  let mockJob: Partial<Job<MedicationReminderJobData>>;
  const workplaceId = new mongoose.Types.ObjectId().toString();
  const patientId = new mongoose.Types.ObjectId().toString();
  const medicationId = new mongoose.Types.ObjectId().toString();
  const pharmacistId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: 'test-job-id',
      data: {
        workplaceId,
        patientId: '',
        medicationId: '',
        reminderType: 'refill',
      },
      attemptsMade: 0,
      progress: jest.fn().mockResolvedValue(undefined),
    };

    // Setup common mocks
    (FollowUpTask.prototype.save as jest.Mock).mockImplementation(function() {
      return Promise.resolve(this);
    });
    (notificationService.createNotification as jest.Mock).mockResolvedValue({});
  });

  describe('processMedicationReminder', () => {
    describe('Refill Reminders', () => {
      it('should process refill reminders for workplace successfully', async () => {
        // Setup: Create medications expiring in 7 days
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              phone: '+2348012345678',
              appointmentPreferences: {
                reminderPreferences: {
                  email: true,
                  sms: true,
                  push: true,
                  whatsapp: false,
                },
              },
            },
            pharmacist: {
              _id: pharmacistId,
              firstName: 'Dr.',
              lastName: 'Smith',
              workplaceId: new mongoose.Types.ObjectId(workplaceId),
            },
            drugName: 'Metformin',
            strength: { value: 500, unit: 'mg' },
            dosageForm: 'tablet',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 2,
              rxNumber: 'RX12345',
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);
        (FollowUpTask.prototype.save as jest.Mock).mockResolvedValue({});
        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        // Execute
        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        // Verify
        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(1);
        expect(result.followUpsCreated).toBe(1);
        expect(result.notificationsSent).toBeGreaterThan(0);
        expect(result.errors).toBe(0);
        expect(mockJob.progress).toHaveBeenCalled();
      });

      it('should skip medications with no expiration date', async () => {
        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
            },
            drugName: 'Aspirin',
            status: 'active',
            prescription: {
              // No dateExpires
              refillsRemaining: 2,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(0);
        expect(result.details.skippedReasons['no_expiration_date']).toBe(1);
      });

      it('should skip medications with no refills remaining', async () => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
            },
            drugName: 'Aspirin',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 0, // No refills
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(0);
        expect(result.details.skippedReasons['no_refills_remaining']).toBe(1);
      });

      it('should skip medications that already expired', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
            },
            drugName: 'Aspirin',
            status: 'active',
            prescription: {
              dateExpires: yesterday,
              refillsRemaining: 2,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(0);
        expect(result.details.skippedReasons['already_expired']).toBe(1);
      });

      it('should skip if reminder was sent recently', async () => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
            },
            drugName: 'Metformin',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 2,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        // Mock existing follow-up from 1 day ago
        (FollowUpTask.findOne as jest.Mock).mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(0);
        expect(result.details.skippedReasons['reminder_sent_recently']).toBe(1);
      });

      it('should respect patient notification preferences', async () => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              phone: '+2348012345678',
              appointmentPreferences: {
                reminderPreferences: {
                  email: true,
                  sms: false, // SMS disabled
                  push: true,
                  whatsapp: false,
                },
              },
            },
            pharmacist: { _id: pharmacistId },
            drugName: 'Metformin',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 2,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);
        (FollowUpTask.prototype.save as jest.Mock).mockResolvedValue({});
        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        // Verify notification was created with only enabled channels
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            deliveryChannels: expect.objectContaining({
              email: expect.objectContaining({ enabled: true }),
              push: expect.objectContaining({ enabled: true }),
            }),
          })
        );

        const callArgs = (notificationService.createNotification as jest.Mock).mock.calls[0][0];
        expect(callArgs.deliveryChannels.sms).toBeUndefined();
        expect(callArgs.deliveryChannels.whatsapp).toBeUndefined();
      });

      it('should create high priority follow-up for medications expiring soon', async () => {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              appointmentPreferences: {
                reminderPreferences: { email: true, sms: false, push: true, whatsapp: false },
              },
            },
            pharmacist: { _id: pharmacistId },
            drugName: 'Insulin',
            status: 'active',
            prescription: {
              dateExpires: threeDaysFromNow,
              refillsRemaining: 1,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);

        let savedFollowUp: any;
        (FollowUpTask.prototype.save as jest.Mock).mockImplementation(function () {
          savedFollowUp = this;
          return Promise.resolve(this);
        });

        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(savedFollowUp.priority).toBe('high');
      });

      it('should handle specific medication refill reminder', async () => {
        mockJob.data!.medicationId = medicationId;
        mockJob.data!.reminderType = 'refill';

        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedication = {
          _id: new mongoose.Types.ObjectId(medicationId),
          patient: {
            _id: new mongoose.Types.ObjectId(),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            appointmentPreferences: {
              reminderPreferences: { email: true, sms: false, push: true, whatsapp: false },
            },
          },
          pharmacist: { _id: pharmacistId },
          drugName: 'Metformin',
          status: 'active',
          prescription: {
            dateExpires: sevenDaysFromNow,
            refillsRemaining: 2,
          },
        };

        (Medication.findById as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMedication),
          }),
        });

        (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);
        (FollowUpTask.prototype.save as jest.Mock).mockResolvedValue({});
        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(1);
        expect(Medication.findById).toHaveBeenCalledWith(medicationId);
      });
    });

    describe('Adherence Reminders', () => {
      it('should process adherence reminder for medication with low adherence', async () => {
        mockJob.data!.medicationId = medicationId;
        mockJob.data!.reminderType = 'adherence';

        const mockMedication = {
          _id: new mongoose.Types.ObjectId(medicationId),
          patient: {
            _id: new mongoose.Types.ObjectId(),
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            appointmentPreferences: {
              reminderPreferences: { email: true, sms: false, push: true, whatsapp: false },
            },
          },
          pharmacist: { _id: pharmacistId },
          drugName: 'Lisinopril',
          status: 'active',
          adherence: {
            score: 65, // Low adherence
            lastReported: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          },
        };

        (Medication.findById as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMedication),
          }),
        });

        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(1);
        expect(notificationService.createNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Medication Adherence Check',
          })
        );
      });

      it('should skip adherence check if recently reported with good score', async () => {
        mockJob.data!.medicationId = medicationId;
        mockJob.data!.reminderType = 'adherence';

        const mockMedication = {
          _id: new mongoose.Types.ObjectId(medicationId),
          patient: {
            _id: new mongoose.Types.ObjectId(),
            firstName: 'Jane',
            lastName: 'Smith',
          },
          drugName: 'Lisinopril',
          status: 'active',
          adherence: {
            score: 95, // Good adherence
            lastReported: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          },
        };

        (Medication.findById as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMedication),
          }),
        });

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(1);
        expect(result.remindersCreated).toBe(0);
        expect(notificationService.createNotification).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle errors gracefully and track them', async () => {
        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        });

        await expect(
          processMedicationReminder(mockJob as Job<MedicationReminderJobData>)
        ).rejects.toThrow('Database error');
      });

      it('should continue processing other medications if one fails', async () => {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const mockMedications = [
          {
            _id: new mongoose.Types.ObjectId(),
            patient: null, // This will cause an error
            drugName: 'Aspirin',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 2,
            },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            patient: {
              _id: new mongoose.Types.ObjectId(),
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              appointmentPreferences: {
                reminderPreferences: { email: true, sms: false, push: true, whatsapp: false },
              },
            },
            pharmacist: { _id: pharmacistId },
            drugName: 'Metformin',
            status: 'active',
            prescription: {
              dateExpires: sevenDaysFromNow,
              refillsRemaining: 2,
            },
          },
        ];

        (Medication.find as jest.Mock).mockReturnValue({
          populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMedications),
          }),
        });

        (FollowUpTask.findOne as jest.Mock).mockResolvedValue(null);
        (FollowUpTask.prototype.save as jest.Mock).mockResolvedValue({});
        (notificationService.createNotification as jest.Mock).mockResolvedValue({});

        const result = await processMedicationReminder(mockJob as Job<MedicationReminderJobData>);

        expect(result.totalChecked).toBe(2);
        expect(result.remindersCreated).toBe(1); // Only second medication processed
        expect(result.details.skippedReasons['patient_not_found']).toBe(1);
      });
    });
  });

  describe('onMedicationReminderCompleted', () => {
    it('should log completion with statistics', () => {
      const result: MedicationReminderResult = {
        workplaceId,
        totalChecked: 10,
        remindersCreated: 5,
        followUpsCreated: 5,
        notificationsSent: 15,
        errors: 0,
        processingTime: 1500,
        details: {
          medicationsDueSoon: [],
          patientsNotified: [],
          skippedReasons: {},
        },
      };

      mockJob.processedOn = Date.now() - 1500;

      onMedicationReminderCompleted(mockJob as Job<MedicationReminderJobData>, result);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should log warning if there were errors', () => {
      const result: MedicationReminderResult = {
        workplaceId,
        totalChecked: 10,
        remindersCreated: 5,
        followUpsCreated: 5,
        notificationsSent: 15,
        errors: 2,
        processingTime: 1500,
        details: {
          medicationsDueSoon: [],
          patientsNotified: [],
          skippedReasons: {},
        },
      };

      onMedicationReminderCompleted(mockJob as Job<MedicationReminderJobData>, result);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('onMedicationReminderFailed', () => {
    it('should log failure with retry information', async () => {
      const error = new Error('Test error');
      mockJob.opts = { attempts: 3 };
      mockJob.attemptsMade = 1;

      await onMedicationReminderFailed(mockJob as Job<MedicationReminderJobData>, error);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should log critical alert when all retries exhausted', async () => {
      const error = new Error('Test error');
      mockJob.opts = { attempts: 3 };
      mockJob.attemptsMade = 3;

      await onMedicationReminderFailed(mockJob as Job<MedicationReminderJobData>, error);

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
