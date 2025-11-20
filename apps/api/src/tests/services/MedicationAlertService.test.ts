import mongoose from 'mongoose';
import cron from 'node-cron';
import { MedicationAlertService } from '../../services/MedicationAlertService';
import Medication from '../../models/Medication';
import AdherenceTracking from '../../modules/diagnostics/models/AdherenceTracking';
import FollowUpTask from '../../models/FollowUpTask';
import Patient from '../../models/Patient';
import notificationService from '../../services/notificationService';

// Mock the dependencies
jest.mock('node-cron');
jest.mock('../../models/Medication');
jest.mock('../../modules/diagnostics/models/AdherenceTracking');
jest.mock('../../models/FollowUpTask');
jest.mock('../../models/Patient');
jest.mock('../../services/notificationService');

const MockedCron = cron as jest.Mocked<typeof cron>;
const MockedMedication = Medication as jest.Mocked<typeof Medication>;
const MockedAdherenceTracking = AdherenceTracking as jest.Mocked<typeof AdherenceTracking>;
const MockedFollowUpTask = FollowUpTask as jest.Mocked<typeof FollowUpTask>;
const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedNotificationService = notificationService as jest.Mocked<typeof notificationService>;

describe('MedicationAlertService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
  const mockMedicationId = new mongoose.Types.ObjectId().toString();
  const mockPharmacistId = new mongoose.Types.ObjectId().toString();

  const mockPatient = {
    _id: mockPatientId,
    workplaceId: mockWorkplaceId,
    firstName: 'John',
    lastName: 'Doe'
  };

  const mockMedication = {
    _id: mockMedicationId,
    patient: mockPatient,
    pharmacist: { _id: mockPharmacistId, firstName: 'Dr. Smith', lastName: 'Pharmacist' },
    drugName: 'Metformin',
    status: 'active',
    instructions: {
      duration: '30 days'
    },
    prescription: {
      refillsRemaining: 3,
      dateExpires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
    },
    adherence: {
      lastReported: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 days ago
    }
  };

  const mockAdherenceTracking = {
    _id: new mongoose.Types.ObjectId(),
    patientId: mockPatientId,
    workplaceId: mockWorkplaceId,
    overallAdherenceScore: 65,
    medications: [
      {
        medicationName: 'Metformin',
        adherenceScore: 65,
        adherenceStatus: 'fair',
        missedDoses: 5,
        totalDoses: 20
      }
    ],
    monitoringActive: true,
    monitoringFrequency: 'weekly',
    nextAssessmentDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    createAlert: jest.fn(),
    save: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeDailyAlertJob', () => {
    it('should initialize cron job successfully', () => {
      const mockScheduledTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      MockedCron.schedule.mockReturnValue(mockScheduledTask as any);

      MedicationAlertService.initializeDailyAlertJob();

      expect(MockedCron.schedule).toHaveBeenCalledWith(
        '0 8 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'Africa/Lagos'
        }
      );
    });
  });

  describe('stopDailyAlertJob', () => {
    it('should stop cron job if running', () => {
      const mockScheduledTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      MockedCron.schedule.mockReturnValue(mockScheduledTask as any);

      MedicationAlertService.initializeDailyAlertJob();
      MedicationAlertService.stopDailyAlertJob();

      expect(mockScheduledTask.stop).toHaveBeenCalled();
    });
  });

  describe('checkMedicationRefillStatus', () => {
    it('should calculate refill status correctly for medication due soon', async () => {
      const result = await MedicationAlertService.checkMedicationRefillStatus(mockMedication as any);

      expect(result).toEqual({
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        patientId: mockPatientId,
        patientName: 'John Doe',
        refillsRemaining: 3,
        lastRefillDate: mockMedication.adherence.lastReported,
        estimatedDaysRemaining: 5, // 30 - 25 = 5 days
        isOverdue: false,
        urgencyLevel: 'urgent'
      });
    });

    it('should mark medication as overdue when past duration', async () => {
      const overdueMedication = {
        ...mockMedication,
        adherence: {
          lastReported: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days ago
        }
      };

      const result = await MedicationAlertService.checkMedicationRefillStatus(overdueMedication as any);

      expect(result.isOverdue).toBe(true);
      expect(result.urgencyLevel).toBe('critical');
      expect(result.estimatedDaysRemaining).toBe(0);
    });

    it('should handle medication without duration information', async () => {
      const medicationWithoutDuration = {
        ...mockMedication,
        instructions: {}
      };

      const result = await MedicationAlertService.checkMedicationRefillStatus(medicationWithoutDuration as any);

      expect(result.estimatedDaysRemaining).toBeUndefined();
      expect(result.isOverdue).toBe(false);
      expect(result.urgencyLevel).toBe('routine');
    });
  });

  describe('generateRefillAlert', () => {
    it('should generate critical alert for overdue medication', () => {
      const overdueStatus = {
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        patientId: mockPatientId,
        patientName: 'John Doe',
        refillsRemaining: 3,
        isOverdue: true,
        urgencyLevel: 'critical' as const,
        estimatedDaysRemaining: 0
      };

      const alert = MedicationAlertService.generateRefillAlert(mockMedication as any, overdueStatus);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('refill_overdue');
      expect(alert?.severity).toBe('critical');
      expect(alert?.message).toContain('overdue');
    });

    it('should generate high priority alert for medication due within 3 days', () => {
      const urgentStatus = {
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        patientId: mockPatientId,
        patientName: 'John Doe',
        refillsRemaining: 3,
        isOverdue: false,
        urgencyLevel: 'urgent' as const,
        estimatedDaysRemaining: 2
      };

      const alert = MedicationAlertService.generateRefillAlert(mockMedication as any, urgentStatus);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('refill_due');
      expect(alert?.severity).toBe('high');
      expect(alert?.daysUntilCritical).toBe(2);
    });

    it('should generate medium priority alert for medication due within 7 days', () => {
      const mediumStatus = {
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        patientId: mockPatientId,
        patientName: 'John Doe',
        refillsRemaining: 3,
        isOverdue: false,
        urgencyLevel: 'urgent' as const,
        estimatedDaysRemaining: 5
      };

      const alert = MedicationAlertService.generateRefillAlert(mockMedication as any, mediumStatus);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('refill_due');
      expect(alert?.severity).toBe('medium');
    });

    it('should return null for medication not needing alert', () => {
      const routineStatus = {
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        patientId: mockPatientId,
        patientName: 'John Doe',
        refillsRemaining: 3,
        isOverdue: false,
        urgencyLevel: 'routine' as const,
        estimatedDaysRemaining: 15
      };

      const alert = MedicationAlertService.generateRefillAlert(mockMedication as any, routineStatus);

      expect(alert).toBeNull();
    });
  });

  describe('performDailyRefillCheck', () => {
    it('should process all active medications and generate alerts', async () => {
      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([mockMedication])
        })
      } as any);

      // Mock the alert processing
      jest.spyOn(MedicationAlertService, 'checkMedicationRefillStatus')
        .mockResolvedValue({
          medicationId: mockMedicationId,
          medicationName: 'Metformin',
          patientId: mockPatientId,
          patientName: 'John Doe',
          refillsRemaining: 3,
          isOverdue: false,
          urgencyLevel: 'urgent',
          estimatedDaysRemaining: 2
        });

      jest.spyOn(MedicationAlertService, 'processAlerts')
        .mockResolvedValue();

      await MedicationAlertService.performDailyRefillCheck();

      expect(MockedMedication.find).toHaveBeenCalledWith({
        status: 'active',
        'prescription.refillsRemaining': { $gt: 0 }
      });
    });

    it('should handle errors gracefully during refill check', async () => {
      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([mockMedication])
        })
      } as any);

      jest.spyOn(MedicationAlertService, 'checkMedicationRefillStatus')
        .mockRejectedValue(new Error('Database error'));

      jest.spyOn(MedicationAlertService, 'processAlerts')
        .mockResolvedValue();

      // Should not throw error
      await expect(MedicationAlertService.performDailyRefillCheck()).resolves.not.toThrow();
    });
  });

  describe('generateAdherenceAlerts', () => {
    it('should generate low adherence alert for poor overall score', async () => {
      const alerts = await MedicationAlertService.generateAdherenceAlerts(mockAdherenceTracking as any);

      expect(alerts).toHaveLength(2); // Overall + individual medication
      
      const overallAlert = alerts.find(alert => alert.medicationName === 'Overall Medication Adherence');
      expect(overallAlert).toBeDefined();
      expect(overallAlert?.alertType).toBe('low_adherence');
      expect(overallAlert?.severity).toBe('high'); // 65% is between 50-70
    });

    it('should generate missed doses alert for high missed dose ratio', async () => {
      const alerts = await MedicationAlertService.generateAdherenceAlerts(mockAdherenceTracking as any);

      const missedDosesAlert = alerts.find(alert => alert.alertType === 'missed_doses');
      expect(missedDosesAlert).toBeDefined();
      expect(missedDosesAlert?.medicationName).toBe('Metformin');
    });

    it('should generate critical alert for very low adherence', async () => {
      const criticalAdherenceTracking = {
        ...mockAdherenceTracking,
        overallAdherenceScore: 40,
        medications: [
          {
            ...mockAdherenceTracking.medications[0],
            adherenceScore: 40
          }
        ]
      };

      const alerts = await MedicationAlertService.generateAdherenceAlerts(criticalAdherenceTracking as any);

      const criticalAlert = alerts.find(alert => alert.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });
  });

  describe('performPrescriptionExpiryCheck', () => {
    it('should find medications expiring within 30 days', async () => {
      const expiringMedication = {
        ...mockMedication,
        prescription: {
          ...mockMedication.prescription,
          dateExpires: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
        }
      };

      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([expiringMedication])
      } as any);

      jest.spyOn(MedicationAlertService, 'processAlerts')
        .mockResolvedValue();

      await MedicationAlertService.performPrescriptionExpiryCheck();

      expect(MockedMedication.find).toHaveBeenCalledWith({
        status: 'active',
        'prescription.dateExpires': {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
    });
  });

  describe('sendAlertNotifications', () => {
    const mockAlert = {
      patientId: mockPatientId,
      medicationId: mockMedicationId,
      medicationName: 'Metformin',
      alertType: 'refill_due' as const,
      severity: 'high' as const,
      message: 'Refill needed soon',
      recommendedAction: 'Process refill',
      createdAt: new Date()
    };

    it('should send notifications to pharmacist and patient', async () => {
      MockedPatient.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPatient)
      } as any);

      MockedMedication.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          pharmacist: { _id: mockPharmacistId }
        })
      } as any);

      MockedNotificationService.createNotification.mockResolvedValue({} as any);

      await MedicationAlertService.sendAlertNotifications(mockAlert);

      expect(MockedNotificationService.createNotification).toHaveBeenCalledTimes(2);
      
      // Check pharmacist notification
      expect(MockedNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'clinical_alert'
        })
      );

      // Check patient notification
      expect(MockedNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_notification'
        })
      );
    });

    it('should use multiple channels for critical alerts', async () => {
      const criticalAlert = { ...mockAlert, severity: 'critical' as const };

      MockedPatient.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPatient)
      } as any);

      MockedMedication.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          pharmacist: { _id: mockPharmacistId }
        })
      } as any);

      MockedNotificationService.createNotification.mockResolvedValue({} as any);

      await MedicationAlertService.sendAlertNotifications(criticalAlert);

      const pharmacistNotificationCall = MockedNotificationService.createNotification.mock.calls
        .find(call => call[0].type === 'clinical_alert');

      expect(pharmacistNotificationCall?.[0].priority).toBe('urgent');
    });
  });

  describe('getPatientMedicationAlerts', () => {
    it('should return all alerts for a patient', async () => {
      MockedMedication.find.mockResolvedValue([mockMedication] as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      jest.spyOn(MedicationAlertService, 'checkMedicationRefillStatus')
        .mockResolvedValue({
          medicationId: mockMedicationId,
          medicationName: 'Metformin',
          patientId: mockPatientId,
          patientName: 'John Doe',
          refillsRemaining: 3,
          isOverdue: false,
          urgencyLevel: 'urgent',
          estimatedDaysRemaining: 2
        });

      const alerts = await MedicationAlertService.getPatientMedicationAlerts(
        mockPatientId,
        mockWorkplaceId
      );

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveProperty('alertType');
      expect(alerts[0]).toHaveProperty('severity');
    });

    it('should sort alerts by severity', async () => {
      MockedMedication.find.mockResolvedValue([mockMedication] as any);
      MockedAdherenceTracking.findOne.mockResolvedValue({
        ...mockAdherenceTracking,
        overallAdherenceScore: 30 // Critical
      } as any);

      jest.spyOn(MedicationAlertService, 'checkMedicationRefillStatus')
        .mockResolvedValue({
          medicationId: mockMedicationId,
          medicationName: 'Metformin',
          patientId: mockPatientId,
          patientName: 'John Doe',
          refillsRemaining: 3,
          isOverdue: true, // Critical
          urgencyLevel: 'critical',
          estimatedDaysRemaining: 0
        });

      const alerts = await MedicationAlertService.getPatientMedicationAlerts(
        mockPatientId,
        mockWorkplaceId
      );

      // Should be sorted with critical alerts first
      expect(alerts[0].severity).toBe('critical');
    });
  });

  describe('getWorkspaceMedicationAlerts', () => {
    it('should return alerts for all patients in workspace', async () => {
      MockedPatient.find.mockResolvedValue([mockPatient] as any);

      jest.spyOn(MedicationAlertService, 'getPatientMedicationAlerts')
        .mockResolvedValue([
          {
            patientId: mockPatientId,
            medicationId: mockMedicationId,
            medicationName: 'Metformin',
            alertType: 'refill_due',
            severity: 'high',
            message: 'Test alert',
            recommendedAction: 'Test action',
            createdAt: new Date()
          }
        ]);

      const alerts = await MedicationAlertService.getWorkspaceMedicationAlerts(mockWorkplaceId);

      expect(alerts).toHaveLength(1);
      expect(MockedPatient.find).toHaveBeenCalledWith({
        workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId)
      });
    });

    it('should filter alerts by severity when specified', async () => {
      MockedPatient.find.mockResolvedValue([mockPatient] as any);

      jest.spyOn(MedicationAlertService, 'getPatientMedicationAlerts')
        .mockResolvedValue([
          {
            patientId: mockPatientId,
            medicationId: mockMedicationId,
            medicationName: 'Metformin',
            alertType: 'refill_due',
            severity: 'high',
            message: 'High alert',
            recommendedAction: 'Test action',
            createdAt: new Date()
          },
          {
            patientId: mockPatientId,
            medicationId: mockMedicationId,
            medicationName: 'Aspirin',
            alertType: 'refill_due',
            severity: 'medium',
            message: 'Medium alert',
            recommendedAction: 'Test action',
            createdAt: new Date()
          }
        ]);

      const alerts = await MedicationAlertService.getWorkspaceMedicationAlerts(
        mockWorkplaceId,
        'high'
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('high');
    });
  });

  describe('triggerPatientAlertCheck', () => {
    it('should trigger alert check and process urgent alerts', async () => {
      const mockAlerts = [
        {
          patientId: mockPatientId,
          medicationId: mockMedicationId,
          medicationName: 'Metformin',
          alertType: 'refill_due' as const,
          severity: 'critical' as const,
          message: 'Critical alert',
          recommendedAction: 'Immediate action',
          createdAt: new Date()
        }
      ];

      jest.spyOn(MedicationAlertService, 'getPatientMedicationAlerts')
        .mockResolvedValue(mockAlerts);

      jest.spyOn(MedicationAlertService, 'processAlerts')
        .mockResolvedValue();

      const result = await MedicationAlertService.triggerPatientAlertCheck(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toEqual(mockAlerts);
      expect(MedicationAlertService.processAlerts).toHaveBeenCalledWith(mockAlerts);
    });
  });
});