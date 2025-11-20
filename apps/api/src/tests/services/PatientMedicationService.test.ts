import mongoose from 'mongoose';
import { PatientMedicationService } from '../../services/PatientMedicationService';
import Medication from '../../models/Medication';
import AdherenceTracking from '../../modules/diagnostics/models/AdherenceTracking';
import FollowUpTask from '../../models/FollowUpTask';
import Patient from '../../models/Patient';
import notificationService from '../../services/notificationService';

// Mock the models and services
jest.mock('../../models/Medication');
jest.mock('../../modules/diagnostics/models/AdherenceTracking');
jest.mock('../../models/FollowUpTask');
jest.mock('../../models/Patient');
jest.mock('../../services/notificationService');

const MockedMedication = Medication as jest.Mocked<typeof Medication>;
const MockedAdherenceTracking = AdherenceTracking as jest.Mocked<typeof AdherenceTracking>;
const MockedFollowUpTask = FollowUpTask as jest.Mocked<typeof FollowUpTask>;
const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedNotificationService = notificationService as jest.Mocked<typeof notificationService>;

describe('PatientMedicationService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
  const mockMedicationId = new mongoose.Types.ObjectId().toString();
  const mockPharmacistId = new mongoose.Types.ObjectId().toString();
  const mockPatientUserId = new mongoose.Types.ObjectId().toString();

  const mockPatient = {
    _id: mockPatientId,
    workplaceId: mockWorkplaceId,
    firstName: 'John',
    lastName: 'Doe'
  };

  const mockMedication = {
    _id: mockMedicationId,
    patient: mockPatientId,
    pharmacist: mockPharmacistId,
    drugName: 'Metformin',
    genericName: 'Metformin HCl',
    strength: { value: 500, unit: 'mg' },
    dosageForm: 'tablet',
    instructions: {
      dosage: '1 tablet',
      frequency: 'twice daily',
      duration: '30 days'
    },
    prescription: {
      rxNumber: 'RX123456',
      dateIssued: new Date(),
      dateExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      refillsRemaining: 5
    },
    status: 'active',
    adherence: {
      lastReported: new Date(),
      score: 85
    },
    createdAt: new Date(),
    toObject: jest.fn().mockReturnValue({
      _id: mockMedicationId,
      patient: mockPatientId,
      pharmacist: mockPharmacistId,
      drugName: 'Metformin',
      genericName: 'Metformin HCl',
      strength: { value: 500, unit: 'mg' },
      dosageForm: 'tablet',
      instructions: {
        dosage: '1 tablet',
        frequency: 'twice daily',
        duration: '30 days'
      },
      prescription: {
        rxNumber: 'RX123456',
        dateIssued: new Date(),
        dateExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        refillsRemaining: 5
      },
      status: 'active',
      adherence: {
        lastReported: new Date(),
        score: 85
      },
      createdAt: new Date()
    })
  };

  const mockAdherenceTracking = {
    _id: new mongoose.Types.ObjectId(),
    patientId: mockPatientId,
    workplaceId: mockWorkplaceId,
    medications: [
      {
        medicationName: 'Metformin',
        adherenceScore: 85,
        adherenceStatus: 'good',
        refillHistory: [
          {
            date: new Date(),
            daysSupply: 30,
            source: 'pharmacy'
          }
        ],
        missedDoses: 2,
        totalDoses: 60
      }
    ],
    overallAdherenceScore: 85,
    monitoringActive: true,
    updateMedicationAdherence: jest.fn(),
    save: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentMedications', () => {
    it('should return current active medications with adherence data', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockMedication])
        })
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      const result = await PatientMedicationService.getCurrentMedications(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('adherenceData');
      expect(result[0]).toHaveProperty('refillStatus');
      expect(result[0].adherenceData?.score).toBe(85);
      expect(result[0].refillStatus?.refillsRemaining).toBe(5);
    });

    it('should throw error if patient not found', async () => {
      MockedPatient.findOne.mockResolvedValue(null);

      await expect(
        PatientMedicationService.getCurrentMedications(mockPatientId, mockWorkplaceId)
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should return medications without adherence data if tracking not found', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockMedication])
        })
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(null);

      const result = await PatientMedicationService.getCurrentMedications(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toHaveLength(1);
      expect(result[0].adherenceData).toBeUndefined();
      expect(result[0]).toHaveProperty('refillStatus');
    });
  });

  describe('getMedicationHistory', () => {
    it('should return medication history for patient', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockMedication])
          })
        })
      } as any);

      const result = await PatientMedicationService.getMedicationHistory(
        mockPatientId,
        mockWorkplaceId,
        10
      );

      expect(result).toHaveLength(1);
      expect(MockedMedication.find).toHaveBeenCalledWith({
        patient: new mongoose.Types.ObjectId(mockPatientId)
      });
    });

    it('should throw error if patient not found', async () => {
      MockedPatient.findOne.mockResolvedValue(null);

      await expect(
        PatientMedicationService.getMedicationHistory(mockPatientId, mockWorkplaceId)
      ).rejects.toThrow('Patient not found or access denied');
    });
  });

  describe('getMedicationDetails', () => {
    it('should return detailed medication information', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMedication)
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      const result = await PatientMedicationService.getMedicationDetails(
        mockPatientId,
        mockMedicationId,
        mockWorkplaceId
      );

      expect(result).toHaveProperty('adherenceData');
      expect(result).toHaveProperty('refillStatus');
      expect(result.adherenceData).toHaveProperty('refillHistory');
    });

    it('should throw error if medication not found', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      } as any);

      await expect(
        PatientMedicationService.getMedicationDetails(
          mockPatientId,
          mockMedicationId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Medication not found or access denied');
    });
  });

  describe('getAdherenceData', () => {
    it('should return adherence tracking data', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      const result = await PatientMedicationService.getAdherenceData(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBe(mockAdherenceTracking);
    });

    it('should return null if no adherence data found', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(null);

      const result = await PatientMedicationService.getAdherenceData(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeNull();
    });
  });

  describe('updateAdherenceScore', () => {
    it('should update adherence score for existing tracking', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue({
        ...mockMedication,
        save: jest.fn()
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      await PatientMedicationService.updateAdherenceScore(
        mockPatientId,
        mockMedicationId,
        90,
        mockWorkplaceId
      );

      expect(mockAdherenceTracking.updateMedicationAdherence).toHaveBeenCalledWith(
        'Metformin',
        { adherenceScore: 90 }
      );
      expect(mockAdherenceTracking.save).toHaveBeenCalled();
    });

    it('should create new adherence tracking if none exists', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue({
        ...mockMedication,
        save: jest.fn()
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(null);

      const mockNewAdherenceTracking = {
        ...mockAdherenceTracking,
        constructor: jest.fn()
      };
      (MockedAdherenceTracking as any).mockImplementation(() => mockNewAdherenceTracking as any);

      await PatientMedicationService.updateAdherenceScore(
        mockPatientId,
        mockMedicationId,
        90,
        mockWorkplaceId
      );

      expect(MockedAdherenceTracking).toHaveBeenCalled();
    });

    it('should clamp adherence score between 0 and 100', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue({
        ...mockMedication,
        save: jest.fn()
      } as any);
      MockedAdherenceTracking.findOne.mockResolvedValue(mockAdherenceTracking as any);

      await PatientMedicationService.updateAdherenceScore(
        mockPatientId,
        mockMedicationId,
        150, // Should be clamped to 100
        mockWorkplaceId
      );

      expect(mockAdherenceTracking.updateMedicationAdherence).toHaveBeenCalledWith(
        'Metformin',
        { adherenceScore: 100 }
      );
    });
  });

  describe('requestRefill', () => {
    const mockRefillData = {
      medicationId: mockMedicationId,
      requestedQuantity: 30,
      urgency: 'routine' as const,
      patientNotes: 'Running low on medication'
    };

    const mockRefillTask = {
      _id: new mongoose.Types.ObjectId(),
      type: 'medication_refill_request',
      status: 'pending'
    };

    it('should create refill request successfully', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);
      MockedFollowUpTask.findOne.mockResolvedValue(null); // No existing request
      MockedFollowUpTask.create.mockResolvedValue(mockRefillTask as any);
      MockedNotificationService.createNotification.mockResolvedValue({} as any);

      const result = await PatientMedicationService.requestRefill(
        mockPatientId,
        mockWorkplaceId,
        mockRefillData,
        mockPatientUserId
      );

      expect(result).toBe(mockRefillTask);
      expect(MockedFollowUpTask.create).toHaveBeenCalled();
      expect(MockedNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should throw error if no refills remaining', async () => {
      const medicationWithNoRefills = {
        ...mockMedication,
        prescription: {
          ...mockMedication.prescription,
          refillsRemaining: 0
        }
      };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(medicationWithNoRefills as any);

      await expect(
        PatientMedicationService.requestRefill(
          mockPatientId,
          mockWorkplaceId,
          mockRefillData,
          mockPatientUserId
        )
      ).rejects.toThrow('No refills remaining');
    });

    it('should throw error if existing request pending', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);
      MockedFollowUpTask.findOne.mockResolvedValue(mockRefillTask as any); // Existing request

      await expect(
        PatientMedicationService.requestRefill(
          mockPatientId,
          mockWorkplaceId,
          mockRefillData,
          mockPatientUserId
        )
      ).rejects.toThrow('A refill request for this medication is already pending');
    });

    it('should set high priority for urgent requests', async () => {
      const urgentRefillData = { ...mockRefillData, urgency: 'urgent' as const };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);
      MockedFollowUpTask.findOne.mockResolvedValue(null);
      MockedFollowUpTask.create.mockResolvedValue(mockRefillTask as any);
      MockedNotificationService.createNotification.mockResolvedValue({} as any);

      await PatientMedicationService.requestRefill(
        mockPatientId,
        mockWorkplaceId,
        urgentRefillData,
        mockPatientUserId
      );

      const createCall = MockedFollowUpTask.create.mock.calls[0][0] as any;
      expect(createCall.priority).toBe('high');
    });
  });

  describe('getRefillRequests', () => {
    it('should return refill requests for patient', async () => {
      const mockRefillRequests = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'medication_refill_request',
          status: 'pending'
        }
      ];

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedFollowUpTask.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockRefillRequests)
            })
          })
        })
      } as any);

      const result = await PatientMedicationService.getRefillRequests(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBe(mockRefillRequests);
    });
  });

  describe('cancelRefillRequest', () => {
    const mockRequestId = new mongoose.Types.ObjectId().toString();

    it('should cancel pending refill request', async () => {
      const mockRefillRequest = {
        _id: mockRequestId,
        type: 'medication_refill_request',
        status: 'pending',
        save: jest.fn()
      };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedFollowUpTask.findOne.mockResolvedValue(mockRefillRequest as any);

      await PatientMedicationService.cancelRefillRequest(
        mockPatientId,
        mockRequestId,
        mockWorkplaceId
      );

      expect(mockRefillRequest.status).toBe('cancelled');
      expect(mockRefillRequest.save).toHaveBeenCalled();
    });

    it('should throw error if request not found', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedFollowUpTask.findOne.mockResolvedValue(null);

      await expect(
        PatientMedicationService.cancelRefillRequest(
          mockPatientId,
          mockRequestId,
          mockWorkplaceId
        )
      ).rejects.toThrow('Refill request not found or cannot be cancelled');
    });
  });

  describe('checkRefillEligibility', () => {
    it('should return eligible for valid medication', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);
      MockedFollowUpTask.findOne.mockResolvedValue(null); // No pending request

      const result = await PatientMedicationService.checkRefillEligibility(
        mockPatientId,
        mockMedicationId,
        mockWorkplaceId
      );

      expect(result.isEligible).toBe(true);
      expect(result.refillsRemaining).toBe(5);
    });

    it('should return not eligible if no refills remaining', async () => {
      const medicationWithNoRefills = {
        ...mockMedication,
        prescription: {
          ...mockMedication.prescription,
          refillsRemaining: 0
        }
      };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(medicationWithNoRefills as any);

      const result = await PatientMedicationService.checkRefillEligibility(
        mockPatientId,
        mockMedicationId,
        mockWorkplaceId
      );

      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('No refills remaining');
    });

    it('should return not eligible if prescription expired', async () => {
      const expiredMedication = {
        ...mockMedication,
        prescription: {
          ...mockMedication.prescription,
          dateExpires: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      };

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(expiredMedication as any);

      const result = await PatientMedicationService.checkRefillEligibility(
        mockPatientId,
        mockMedicationId,
        mockWorkplaceId
      );

      expect(result.isEligible).toBe(false);
      expect(result.reason).toBe('Prescription has expired');
    });
  });

  describe('setMedicationReminders', () => {
    const mockReminderSettings = {
      reminderTimes: ['08:00', '20:00'],
      isActive: true
    };

    it('should set medication reminders successfully', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);
      MockedNotificationService.createNotification.mockResolvedValue({} as any);

      await PatientMedicationService.setMedicationReminders(
        mockPatientId,
        mockMedicationId,
        mockReminderSettings,
        mockWorkplaceId
      );

      expect(MockedNotificationService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should not schedule reminders if not active', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.findOne.mockResolvedValue(mockMedication as any);

      await PatientMedicationService.setMedicationReminders(
        mockPatientId,
        mockMedicationId,
        { ...mockReminderSettings, isActive: false },
        mockWorkplaceId
      );

      expect(MockedNotificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('getMedicationReminders', () => {
    it('should return medication reminders', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.find.mockResolvedValue([mockMedication] as any);
      const result = await PatientMedicationService.getMedicationReminders(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toHaveLength(1);
      expect(result[0].medicationName).toBe('Metformin');
      expect(result[0].isActive).toBe(false); // Mock implementation returns inactive
    });

    it('should return inactive reminders for medications without scheduled notifications', async () => {
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedMedication.find.mockResolvedValue([mockMedication] as any);
      const result = await PatientMedicationService.getMedicationReminders(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
      expect(result[0].reminderTimes).toHaveLength(0);
    });
  });
});