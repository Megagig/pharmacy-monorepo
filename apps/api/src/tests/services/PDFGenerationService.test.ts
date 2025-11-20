import mongoose from 'mongoose';
import { PDFGenerationService, IPDFOptions } from '../../services/PDFGenerationService';
import Patient from '../../models/Patient';
import Medication from '../../models/Medication';
import Visit from '../../models/Visit';
import DiagnosticCase from '../../models/DiagnosticCase';
import Workplace from '../../models/Workplace';
import AppError from '../../utils/AppError';

// Mock the models
jest.mock('../../models/Patient');
jest.mock('../../models/Medication');
jest.mock('../../models/Visit');
jest.mock('../../models/DiagnosticCase');
jest.mock('../../models/Workplace');
jest.mock('../../utils/logger');

// Mock PDFKit
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'end') {
        setTimeout(() => callback(), 10);
      }
      if (event === 'data') {
        setTimeout(() => callback(Buffer.from('mock-pdf-data')), 5);
      }
    }),
    y: 150,
    page: { height: 800 }
  }));
});

const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const MockedMedication = Medication as jest.Mocked<typeof Medication>;
const MockedVisit = Visit as jest.Mocked<typeof Visit>;
const MockedDiagnosticCase = DiagnosticCase as jest.Mocked<typeof DiagnosticCase>;
const MockedWorkplace = Workplace as jest.Mocked<typeof Workplace>;

describe('PDFGenerationService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();

  const mockPatient = {
    _id: mockPatientId,
    workplaceId: mockWorkplaceId,
    mrn: 'PAT001',
    firstName: 'John',
    lastName: 'Doe',
    otherNames: 'Michael',
    dob: new Date('1990-01-01'),
    age: 33,
    gender: 'male',
    phone: '+2348012345678',
    email: 'john.doe@example.com',
    address: '123 Main Street, Lagos',
    bloodGroup: 'O+',
    genotype: 'AA',
    weightKg: 75,
    allergies: [
      {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
        recordedDate: new Date()
      }
    ],
    chronicConditions: [
      {
        condition: 'Hypertension',
        diagnosedDate: new Date('2020-01-01'),
        status: 'managed'
      }
    ],
    patientLoggedVitals: [
      {
        recordedDate: new Date(),
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 75,
        notes: 'Feeling good'
      }
    ],
    isDeleted: false
  };

  const mockWorkplace = {
    _id: mockWorkplaceId,
    name: 'Test Pharmacy',
    address: '456 Pharmacy Street, Lagos',
    phone: '+2348087654321',
    email: 'info@testpharmacy.com',
    logo: null
  };

  const mockMedications = [
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: mockPatientId,
      workplaceId: mockWorkplaceId,
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      instructions: 'Take with food',
      createdAt: new Date(),
      isDeleted: false
    }
  ];

  const mockVisits = [
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: mockPatientId,
      workplaceId: mockWorkplaceId,
      date: new Date(),
      soap: {
        subjective: 'Patient complains of headache',
        objective: 'BP: 120/80, HR: 72',
        assessment: 'Tension headache',
        plan: 'Rest and hydration'
      },
      isDeleted: false
    }
  ];

  const mockLabResults = [
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: mockPatientId,
      workplaceId: mockWorkplaceId,
      caseId: 'DX-001',
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMedicalRecordsPDF', () => {
    beforeEach(() => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPatient)
      });

      MockedWorkplace.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockWorkplace)
      });

      MockedMedication.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockMedications)
          })
        })
      });

      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockVisits)
          })
        })
      });

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockLabResults)
          })
        })
      });
    });

    it('should generate comprehensive medical records PDF successfully', async () => {
      const options: IPDFOptions = {
        includeProfile: true,
        includeMedications: true,
        includeVitals: true,
        includeLabResults: true,
        includeVisitHistory: true
      };

      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId,
        options
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify that patient data was fetched
      expect(MockedPatient.findOne).toHaveBeenCalledWith({
        _id: new mongoose.Types.ObjectId(mockPatientId),
        workplaceId: new mongoose.Types.ObjectId(mockWorkplaceId),
        isDeleted: false
      });

      // Verify that workplace data was fetched
      expect(MockedWorkplace.findById).toHaveBeenCalledWith(mockWorkplaceId);

      // Verify that medications were fetched
      expect(MockedMedication.find).toHaveBeenCalled();

      // Verify that visits were fetched
      expect(MockedVisit.find).toHaveBeenCalled();

      // Verify that lab results were fetched
      expect(MockedDiagnosticCase.find).toHaveBeenCalled();
    });

    it('should generate PDF with default options when none provided', async () => {
      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate PDF with selective sections', async () => {
      const options: IPDFOptions = {
        includeProfile: true,
        includeMedications: true,
        includeVitals: false,
        includeLabResults: false,
        includeVisitHistory: false
      };

      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId,
        options
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Should still fetch medications
      expect(MockedMedication.find).toHaveBeenCalled();
    });

    it('should throw error for invalid patient ID', async () => {
      await expect(
        PDFGenerationService.generateMedicalRecordsPDF(
          'invalid-id',
          mockWorkplaceId
        )
      ).rejects.toThrow(new AppError('Invalid patient ID', 400));
    });

    it('should throw error for invalid workplace ID', async () => {
      await expect(
        PDFGenerationService.generateMedicalRecordsPDF(
          mockPatientId,
          'invalid-id'
        )
      ).rejects.toThrow(new AppError('Invalid workplace ID', 400));
    });

    it('should throw error when patient not found', async () => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      await expect(
        PDFGenerationService.generateMedicalRecordsPDF(
          mockPatientId,
          mockWorkplaceId
        )
      ).rejects.toThrow(new AppError('Patient not found', 404));
    });

    it('should throw error when workplace not found', async () => {
      MockedWorkplace.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      await expect(
        PDFGenerationService.generateMedicalRecordsPDF(
          mockPatientId,
          mockWorkplaceId
        )
      ).rejects.toThrow(new AppError('Workplace not found', 404));
    });

    it('should handle date range filtering', async () => {
      const dateRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      const options: IPDFOptions = {
        includeVisitHistory: true,
        includeLabResults: true,
        dateRange
      };

      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId,
        options
      );

      expect(result).toBeInstanceOf(Buffer);

      // Verify date range was applied to visits query
      expect(MockedVisit.find).toHaveBeenCalledWith(
        expect.objectContaining({
          date: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        })
      );

      // Verify date range was applied to lab results query
      expect(MockedDiagnosticCase.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await expect(
        PDFGenerationService.generateMedicalRecordsPDF(
          mockPatientId,
          mockWorkplaceId
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe('generateMedicationListPDF', () => {
    beforeEach(() => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPatient)
      });

      MockedWorkplace.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockWorkplace)
      });

      MockedMedication.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockMedications)
          })
        })
      });

      // Mock empty arrays for other data
      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });
    });

    it('should generate medication list PDF successfully', async () => {
      const result = await PDFGenerationService.generateMedicationListPDF(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Should fetch medications
      expect(MockedMedication.find).toHaveBeenCalled();
    });
  });

  describe('generateLabResultsPDF', () => {
    beforeEach(() => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPatient)
      });

      MockedWorkplace.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockWorkplace)
      });

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockLabResults)
          })
        })
      });

      // Mock empty arrays for other data
      MockedMedication.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });
    });

    it('should generate lab results PDF successfully', async () => {
      const result = await PDFGenerationService.generateLabResultsPDF(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate lab results PDF with specific result IDs', async () => {
      const resultIds = [mockLabResults[0]._id.toString()];

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockLabResults)
          })
        })
      });

      const result = await PDFGenerationService.generateLabResultsPDF(
        mockPatientId,
        mockWorkplaceId,
        resultIds
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Should query for specific result IDs
      expect(MockedDiagnosticCase.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: [new mongoose.Types.ObjectId(resultIds[0])] }
        })
      );
    });

    it('should throw error for invalid result IDs', async () => {
      const invalidResultIds = ['invalid-id'];

      await expect(
        PDFGenerationService.generateLabResultsPDF(
          mockPatientId,
          mockWorkplaceId,
          invalidResultIds
        )
      ).rejects.toThrow(new AppError('No valid result IDs provided', 400));
    });
  });

  describe('PDF content validation', () => {
    beforeEach(() => {
      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPatient)
      });

      MockedWorkplace.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockWorkplace)
      });

      MockedMedication.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockMedications)
          })
        })
      });

      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockVisits)
          })
        })
      });

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockLabResults)
          })
        })
      });
    });

    it('should handle patient with minimal data', async () => {
      const minimalPatient = {
        ...mockPatient,
        otherNames: null,
        dob: null,
        age: null,
        gender: null,
        phone: null,
        email: null,
        address: null,
        bloodGroup: null,
        genotype: null,
        weightKg: null,
        allergies: [],
        chronicConditions: [],
        patientLoggedVitals: []
      };

      MockedPatient.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(minimalPatient)
      });

      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty data arrays', async () => {
      MockedMedication.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      MockedVisit.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      MockedDiagnosticCase.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await PDFGenerationService.generateMedicalRecordsPDF(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});