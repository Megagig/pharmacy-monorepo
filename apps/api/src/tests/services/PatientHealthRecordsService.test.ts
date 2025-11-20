import mongoose from 'mongoose';
import { PatientHealthRecordsService, IVitalsData } from '../../services/PatientHealthRecordsService';
import Patient from '../../models/Patient';
import Visit from '../../models/Visit';
import DiagnosticCase from '../../models/DiagnosticCase';
import AppError from '../../utils/AppError';

// Mock the models
jest.mock('../../models/Patient');
jest.mock('../../models/Visit');
jest.mock('../../models/DiagnosticCase');
jest.mock('../../utils/logger');

const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedVisit = Visit as jest.Mocked<typeof Visit>;
const MockedDiagnosticCase = DiagnosticCase as jest.Mocked<typeof DiagnosticCase>;

describe('PatientHealthRecordsService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
  const mockResultId = new mongoose.Types.ObjectId().toString();
  const mockVisitId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLabResults', () => {
    it('should fetch lab results successfully', async () => {
      const mockResults = [
        {
          _id: mockResultId,
          patientId: mockPatientId,
          workplaceId: mockWorkplaceId,
          labResults: [
            {
              testName: 'Complete Blood Count',
              value: 'Normal',
              referenceRange: 'Normal',
              abnormal: false
            }
          ],
          status: 'completed',
          createdAt: new Date()
        }
      ];

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockResults)
              })
            })
          })
        })
      });

      MockedDiagnosticCase.countDocuments = jest.fn().mockResolvedValue(1);

      const result = await PatientHealthRecordsService.getLabResults(
        mockPatientId,
        mockWorkplaceId,
        10,
        0
      );

      expect(result).toEqual({
        results: mockResults,
        total: 1,
        hasMore: false
      });

      expect(MockedDiagnosticCase.find).toHaveBeenCalledWith({
        patientId: new mongoose.Types.ObjectId(mockPatientId),
        workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
        labResults: { $exists: true, $ne: [] },
        status: { $in: ['completed', 'follow_up'] }
      });
    });

    it('should throw error for invalid patient ID', async () => {
      await expect(
        PatientHealthRecordsService.getLabResults('invalid-id', mockWorkplaceId)
      ).rejects.toThrow(AppError);
    });

    it('should handle database errors', async () => {
      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error('Database error'))
              })
            })
          })
        })
      });

      await expect(
        PatientHealthRecordsService.getLabResults(mockPatientId, mockWorkplaceId)
      ).rejects.toThrow(AppError);
    });
  });

  describe('getLabResultDetails', () => {
    it('should fetch lab result details successfully', async () => {
      const mockResult = {
        _id: mockResultId,
        patientId: mockPatientId,
        workplaceId: mockWorkplaceId,
        labResults: [
          {
            testName: 'Complete Blood Count',
            value: 'Normal',
            referenceRange: 'Normal',
            abnormal: false
          }
        ],
        pharmacistId: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        }
      };

      MockedDiagnosticCase.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockResult)
        })
      });

      const result = await PatientHealthRecordsService.getLabResultDetails(
        mockPatientId,
        mockResultId,
        mockWorkplaceId
      );

      expect(result).toEqual(mockResult);
    });

    it('should throw error when lab result not found', async () => {
      MockedDiagnosticCase.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      await expect(
        PatientHealthRecordsService.getLabResultDetails(
          mockPatientId,
          mockResultId,
          mockWorkplaceId
        )
      ).rejects.toThrow(new AppError('Lab result not found', 404));
    });
  });

  describe('getVisitHistory', () => {
    it('should fetch visit history successfully', async () => {
      const mockVisits = [
        {
          _id: mockVisitId,
          patientId: mockPatientId,
          workplaceId: mockWorkplaceId,
          date: new Date(),
          soap: {
            subjective: 'Patient complains of headache',
            objective: 'BP: 120/80',
            assessment: 'Tension headache',
            plan: 'Rest and hydration'
          },
          isDeleted: false
        }
      ];

      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockVisits)
              })
            })
          })
        })
      });

      MockedVisit.countDocuments = jest.fn().mockResolvedValue(1);

      const result = await PatientHealthRecordsService.getVisitHistory(
        mockPatientId,
        mockWorkplaceId,
        10,
        0
      );

      expect(result).toEqual({
        visits: mockVisits,
        total: 1,
        hasMore: false
      });
    });
  });

  describe('getVisitDetails', () => {
    it('should fetch visit details successfully', async () => {
      const mockVisit = {
        _id: mockVisitId,
        patientId: mockPatientId,
        workplaceId: mockWorkplaceId,
        date: new Date(),
        soap: {
          subjective: 'Patient complains of headache',
          objective: 'BP: 120/80',
          assessment: 'Tension headache',
          plan: 'Rest and hydration'
        },
        createdBy: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com'
        },
        isDeleted: false
      };

      MockedVisit.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockVisit)
          })
        })
      });

      const result = await PatientHealthRecordsService.getVisitDetails(
        mockPatientId,
        mockVisitId,
        mockWorkplaceId
      );

      expect(result).toEqual(mockVisit);
    });

    it('should throw error when visit not found', async () => {
      MockedVisit.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null)
          })
        })
      });

      await expect(
        PatientHealthRecordsService.getVisitDetails(
          mockPatientId,
          mockVisitId,
          mockWorkplaceId
        )
      ).rejects.toThrow(new AppError('Visit not found', 404));
    });
  });

  describe('logVitals', () => {
    it('should log vitals successfully', async () => {
      const vitalsData: IVitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        notes: 'Feeling good'
      };

      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        patientLoggedVitals: [],
        save: jest.fn().mockResolvedValue(true),
        isDeleted: false
      };

      MockedPatient.findOne = jest.fn().mockResolvedValue(mockPatient);

      const result = await PatientHealthRecordsService.logVitals(
        mockPatientId,
        mockWorkplaceId,
        vitalsData
      );

      expect(mockPatient.patientLoggedVitals).toHaveLength(1);
      expect(mockPatient.patientLoggedVitals[0]).toMatchObject({
        ...vitalsData,
        source: 'patient_portal',
        isVerified: false
      });
      expect(mockPatient.save).toHaveBeenCalled();
    });

    it('should validate vitals data', async () => {
      const invalidVitalsData: IVitalsData = {
        bloodPressure: { systolic: 50, diastolic: 120 }, // Invalid: systolic < diastolic
      };

      await expect(
        PatientHealthRecordsService.logVitals(
          mockPatientId,
          mockWorkplaceId,
          invalidVitalsData
        )
      ).rejects.toThrow(AppError);
    });

    it('should limit vitals history to 100 entries', async () => {
      const vitalsData: IVitalsData = {
        heartRate: 72
      };

      // Create mock patient with 100 existing vitals
      const existingVitals = Array.from({ length: 100 }, (_, i) => ({
        recordedDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        heartRate: 70 + i,
        source: 'patient_portal',
        isVerified: false
      }));

      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        patientLoggedVitals: existingVitals,
        save: jest.fn().mockResolvedValue(true),
        isDeleted: false
      };

      MockedPatient.findOne = jest.fn().mockResolvedValue(mockPatient);

      await PatientHealthRecordsService.logVitals(
        mockPatientId,
        mockWorkplaceId,
        vitalsData
      );

      expect(mockPatient.patientLoggedVitals).toHaveLength(100);
      expect(mockPatient.save).toHaveBeenCalled();
    });
  });

  describe('getVitalsHistory', () => {
    it('should fetch vitals history successfully', async () => {
      const mockVitals = [
        {
          recordedDate: new Date(),
          heartRate: 72,
          source: 'patient_portal',
          isVerified: false
        }
      ];

      const mockPatient = {
        patientLoggedVitals: mockVitals
      };

      MockedPatient.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockPatient)
        })
      });

      const result = await PatientHealthRecordsService.getVitalsHistory(
        mockPatientId,
        mockWorkplaceId,
        10
      );

      expect(result).toEqual(mockVitals);
    });

    it('should throw error when patient not found', async () => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      await expect(
        PatientHealthRecordsService.getVitalsHistory(mockPatientId, mockWorkplaceId)
      ).rejects.toThrow(new AppError('Patient not found', 404));
    });
  });

  describe('getVitalsTrends', () => {
    it('should calculate vitals trends successfully', async () => {
      const mockVitals = [
        {
          recordedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          heartRate: 70,
          bloodPressure: { systolic: 120, diastolic: 80 }
        },
        {
          recordedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          heartRate: 75,
          bloodPressure: { systolic: 125, diastolic: 82 }
        },
        {
          recordedDate: new Date(),
          heartRate: 80,
          bloodPressure: { systolic: 130, diastolic: 85 }
        }
      ];

      const mockPatient = {
        patientLoggedVitals: mockVitals
      };

      MockedPatient.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockPatient)
        })
      });

      const result = await PatientHealthRecordsService.getVitalsTrends(
        mockPatientId,
        mockWorkplaceId,
        30
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('parameter');
      expect(result[0]).toHaveProperty('trend');
      expect(result[0]).toHaveProperty('averageChange');
    });
  });

  describe('checkVitalsAlerts', () => {
    it('should generate critical blood pressure alert', async () => {
      const vitalsData: IVitalsData = {
        bloodPressure: { systolic: 190, diastolic: 125 }
      };

      const alerts = await PatientHealthRecordsService.checkVitalsAlerts(
        mockPatientId,
        vitalsData
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('critical');
      expect(alerts[0].parameter).toBe('blood_pressure');
      expect(alerts[0].message).toContain('Hypertensive crisis');
    });

    it('should generate warning for high heart rate', async () => {
      const vitalsData: IVitalsData = {
        heartRate: 110
      };

      const alerts = await PatientHealthRecordsService.checkVitalsAlerts(
        mockPatientId,
        vitalsData
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('warning');
      expect(alerts[0].parameter).toBe('heart_rate');
    });

    it('should generate critical alert for low glucose', async () => {
      const vitalsData: IVitalsData = {
        glucose: 60
      };

      const alerts = await PatientHealthRecordsService.checkVitalsAlerts(
        mockPatientId,
        vitalsData
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('critical');
      expect(alerts[0].parameter).toBe('glucose');
    });

    it('should generate no alerts for normal vitals', async () => {
      const vitalsData: IVitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        glucose: 100,
        oxygenSaturation: 98
      };

      const alerts = await PatientHealthRecordsService.checkVitalsAlerts(
        mockPatientId,
        vitalsData
      );

      expect(alerts).toHaveLength(0);
    });
  });

  describe('validateVitalsData', () => {
    it('should validate blood pressure correctly', async () => {
      const invalidVitalsData: IVitalsData = {
        bloodPressure: { systolic: 80, diastolic: 90 } // Invalid: systolic <= diastolic
      };

      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        patientLoggedVitals: [],
        save: jest.fn(),
        isDeleted: false
      };

      MockedPatient.findOne = jest.fn().mockResolvedValue(mockPatient);

      await expect(
        PatientHealthRecordsService.logVitals(
          mockPatientId,
          mockWorkplaceId,
          invalidVitalsData
        )
      ).rejects.toThrow('Systolic pressure must be higher than diastolic pressure');
    });

    it('should validate heart rate range', async () => {
      const invalidVitalsData: IVitalsData = {
        heartRate: 300 // Too high
      };

      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        patientLoggedVitals: [],
        save: jest.fn(),
        isDeleted: false
      };

      MockedPatient.findOne = jest.fn().mockResolvedValue(mockPatient);

      await expect(
        PatientHealthRecordsService.logVitals(
          mockPatientId,
          mockWorkplaceId,
          invalidVitalsData
        )
      ).rejects.toThrow('Heart rate must be between 30-250 bpm');
    });

    it('should validate notes length', async () => {
      const invalidVitalsData: IVitalsData = {
        heartRate: 72,
        notes: 'A'.repeat(501) // Too long
      };

      const mockPatient = {
        _id: mockPatientId,
        workplaceId: mockWorkplaceId,
        patientLoggedVitals: [],
        save: jest.fn(),
        isDeleted: false
      };

      MockedPatient.findOne = jest.fn().mockResolvedValue(mockPatient);

      await expect(
        PatientHealthRecordsService.logVitals(
          mockPatientId,
          mockWorkplaceId,
          invalidVitalsData
        )
      ).rejects.toThrow('Notes cannot exceed 500 characters');
    });
  });
});