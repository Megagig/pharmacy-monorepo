import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { PatientHealthRecordsController } from '../../controllers/patientHealthRecordsController';
import { PatientHealthRecordsService } from '../../services/PatientHealthRecordsService';
import { PDFGenerationService } from '../../services/PDFGenerationService';
import AppError from '../../utils/AppError';

// Mock the services
jest.mock('../../services/PatientHealthRecordsService');
jest.mock('../../services/PDFGenerationService');
jest.mock('../../utils/logger');

const MockedPatientHealthRecordsService = PatientHealthRecordsService as jest.Mocked<typeof PatientHealthRecordsService>;
const MockedPDFGenerationService = PDFGenerationService as jest.Mocked<typeof PDFGenerationService>;

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockPatientAuth = (req: any, res: any, next: any) => {
  req.patientUser = {
    _id: 'user123',
    patientId: 'patient123',
    workplaceId: 'workplace123',
    email: 'patient@example.com',
    status: 'active'
  };
  next();
};

// Mock validation middleware
const mockValidation = (req: any, res: any, next: any) => {
  next();
};

// Set up routes
app.get('/lab-results', mockPatientAuth, mockValidation, PatientHealthRecordsController.getLabResults);
app.get('/lab-results/:resultId', mockPatientAuth, mockValidation, PatientHealthRecordsController.getLabResultDetails);
app.get('/visits', mockPatientAuth, mockValidation, PatientHealthRecordsController.getVisitHistory);
app.get('/visits/:visitId', mockPatientAuth, mockValidation, PatientHealthRecordsController.getVisitDetails);
app.post('/vitals', mockPatientAuth, mockValidation, PatientHealthRecordsController.logVitals);
app.get('/vitals', mockPatientAuth, mockValidation, PatientHealthRecordsController.getVitalsHistory);
app.get('/vitals/trends', mockPatientAuth, mockValidation, PatientHealthRecordsController.getVitalsTrends);
app.get('/download', mockPatientAuth, mockValidation, PatientHealthRecordsController.downloadMedicalRecords);
app.get('/medications/download', mockPatientAuth, mockValidation, PatientHealthRecordsController.downloadMedicationList);
app.post('/lab-results/download', mockPatientAuth, mockValidation, PatientHealthRecordsController.downloadLabResults);
app.get('/summary', mockPatientAuth, mockValidation, PatientHealthRecordsController.getHealthSummary);

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code
      }
    });
  }
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error'
    }
  });
});

describe('PatientHealthRecordsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /lab-results', () => {
    it('should fetch lab results successfully', async () => {
      const mockResults = {
        results: [
          {
            _id: 'result123',
            caseId: 'DX-001',
            labResults: [
              {
                testName: 'Complete Blood Count',
                value: 'Normal',
                referenceRange: 'Normal',
                abnormal: false
              }
            ],
            createdAt: new Date()
          }
        ],
        total: 1,
        hasMore: false
      };

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/lab-results')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults.results);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalResults).toBe(1);

      expect(MockedPatientHealthRecordsService.getLabResults).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        20,
        0
      );
    });

    it('should handle pagination correctly', async () => {
      const mockResults = {
        results: [],
        total: 50,
        hasMore: true
      };

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/lab-results')
        .query({ page: 2, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.currentPage).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(5);
      expect(response.body.data.pagination.hasMore).toBe(true);

      expect(MockedPatientHealthRecordsService.getLabResults).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        10,
        10
      );
    });

    it('should handle service errors', async () => {
      MockedPatientHealthRecordsService.getLabResults.mockRejectedValue(
        new AppError('Service error', 500)
      );

      const response = await request(app).get('/lab-results');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Service error');
    });
  });

  describe('GET /lab-results/:resultId', () => {
    it('should fetch lab result details successfully', async () => {
      const mockResult = {
        _id: 'result123',
        caseId: 'DX-001',
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

      MockedPatientHealthRecordsService.getLabResultDetails.mockResolvedValue(mockResult);

      const response = await request(app).get('/lab-results/result123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);

      expect(MockedPatientHealthRecordsService.getLabResultDetails).toHaveBeenCalledWith(
        'patient123',
        'result123',
        'workplace123'
      );
    });

    it('should handle not found error', async () => {
      MockedPatientHealthRecordsService.getLabResultDetails.mockRejectedValue(
        new AppError('Lab result not found', 404)
      );

      const response = await request(app).get('/lab-results/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Lab result not found');
    });
  });

  describe('GET /visits', () => {
    it('should fetch visit history successfully', async () => {
      const mockVisits = {
        visits: [
          {
            _id: 'visit123',
            date: new Date(),
            soap: {
              subjective: 'Patient complains of headache',
              objective: 'BP: 120/80',
              assessment: 'Tension headache',
              plan: 'Rest and hydration'
            }
          }
        ],
        total: 1,
        hasMore: false
      };

      MockedPatientHealthRecordsService.getVisitHistory.mockResolvedValue(mockVisits);

      const response = await request(app).get('/visits');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.visits).toEqual(mockVisits.visits);
      expect(response.body.data.pagination).toBeDefined();

      expect(MockedPatientHealthRecordsService.getVisitHistory).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        20,
        0
      );
    });
  });

  describe('GET /visits/:visitId', () => {
    it('should fetch visit details successfully', async () => {
      const mockVisit = {
        _id: 'visit123',
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
        }
      };

      MockedPatientHealthRecordsService.getVisitDetails.mockResolvedValue(mockVisit);

      const response = await request(app).get('/visits/visit123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVisit);

      expect(MockedPatientHealthRecordsService.getVisitDetails).toHaveBeenCalledWith(
        'patient123',
        'visit123',
        'workplace123'
      );
    });
  });

  describe('POST /vitals', () => {
    it('should log vitals successfully', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        notes: 'Feeling good'
      };

      const mockPatient = {
        patientLoggedVitals: [
          {
            ...vitalsData,
            recordedDate: new Date(),
            source: 'patient_portal',
            isVerified: false
          }
        ]
      };

      const mockAlerts = [];

      MockedPatientHealthRecordsService.logVitals.mockResolvedValue(mockPatient as any);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .post('/vitals')
        .send(vitalsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Vitals logged successfully');
      expect(response.body.data.vitalsLogged).toBe(true);
      expect(response.body.data.latestVitals).toBeDefined();

      expect(MockedPatientHealthRecordsService.logVitals).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        vitalsData
      );
      expect(MockedPatientHealthRecordsService.checkVitalsAlerts).toHaveBeenCalledWith(
        'patient123',
        vitalsData
      );
    });

    it('should return alerts when abnormal vitals detected', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 190, diastolic: 125 }
      };

      const mockPatient = {
        patientLoggedVitals: [
          {
            ...vitalsData,
            recordedDate: new Date(),
            source: 'patient_portal',
            isVerified: false
          }
        ]
      };

      const mockAlerts = [
        {
          type: 'critical',
          message: 'Hypertensive crisis - immediate medical attention required',
          parameter: 'blood_pressure',
          value: '190/125',
          recommendation: 'Seek immediate medical care'
        }
      ];

      MockedPatientHealthRecordsService.logVitals.mockResolvedValue(mockPatient as any);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .post('/vitals')
        .send(vitalsData);

      expect(response.status).toBe(201);
      expect(response.body.data.alerts).toEqual(mockAlerts);
    });

    it('should handle validation errors', async () => {
      MockedPatientHealthRecordsService.logVitals.mockRejectedValue(
        new AppError('Systolic pressure must be higher than diastolic pressure', 400)
      );

      const response = await request(app)
        .post('/vitals')
        .send({
          bloodPressure: { systolic: 80, diastolic: 90 }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /vitals', () => {
    it('should fetch vitals history successfully', async () => {
      const mockVitals = [
        {
          recordedDate: new Date(),
          heartRate: 72,
          source: 'patient_portal',
          isVerified: false
        }
      ];

      MockedPatientHealthRecordsService.getVitalsHistory.mockResolvedValue(mockVitals);

      const response = await request(app)
        .get('/vitals')
        .query({ limit: 25 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals).toEqual(mockVitals);
      expect(response.body.data.count).toBe(1);

      expect(MockedPatientHealthRecordsService.getVitalsHistory).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        25
      );
    });
  });

  describe('GET /vitals/trends', () => {
    it('should fetch vitals trends successfully', async () => {
      const mockTrends = [
        {
          parameter: 'heart_rate',
          data: [
            { date: new Date(), value: 70, unit: 'bpm' },
            { date: new Date(), value: 72, unit: 'bpm' }
          ],
          trend: 'increasing',
          averageChange: 1
        }
      ];

      MockedPatientHealthRecordsService.getVitalsTrends.mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/vitals/trends')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toEqual(mockTrends);
      expect(response.body.data.period.days).toBe(30);

      expect(MockedPatientHealthRecordsService.getVitalsTrends).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        30
      );
    });
  });

  describe('GET /download', () => {
    it('should download medical records PDF successfully', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');

      MockedPDFGenerationService.generateMedicalRecordsPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .get('/download')
        .query({
          includeProfile: 'true',
          includeMedications: 'true',
          includeVitals: 'true',
          includeLabResults: 'true',
          includeVisitHistory: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('medical-records-patient123');

      expect(MockedPDFGenerationService.generateMedicalRecordsPDF).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        expect.objectContaining({
          includeProfile: true,
          includeMedications: true,
          includeVitals: true,
          includeLabResults: true,
          includeVisitHistory: true
        })
      );
    });

    it('should handle date range in PDF generation', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');

      MockedPDFGenerationService.generateMedicalRecordsPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .get('/download')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        });

      expect(response.status).toBe(200);

      expect(MockedPDFGenerationService.generateMedicalRecordsPDF).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        expect.objectContaining({
          dateRange: {
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-12-31')
          }
        })
      );
    });
  });

  describe('GET /medications/download', () => {
    it('should download medication list PDF successfully', async () => {
      const mockPDFBuffer = Buffer.from('mock-medication-pdf');

      MockedPDFGenerationService.generateMedicationListPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app).get('/medications/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('medication-list-patient123');

      expect(MockedPDFGenerationService.generateMedicationListPDF).toHaveBeenCalledWith(
        'patient123',
        'workplace123'
      );
    });
  });

  describe('POST /lab-results/download', () => {
    it('should download lab results PDF successfully', async () => {
      const mockPDFBuffer = Buffer.from('mock-lab-results-pdf');
      const resultIds = ['result1', 'result2'];

      MockedPDFGenerationService.generateLabResultsPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .post('/lab-results/download')
        .send({ resultIds });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('lab-results-patient123');

      expect(MockedPDFGenerationService.generateLabResultsPDF).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        resultIds
      );
    });
  });

  describe('GET /summary', () => {
    it('should fetch health summary successfully', async () => {
      const mockLabResults = {
        results: [{ _id: 'result1' }],
        total: 5
      };
      const mockVisits = {
        visits: [{ _id: 'visit1' }],
        total: 3
      };
      const mockVitals = [
        {
          recordedDate: new Date(),
          heartRate: 72,
          bloodPressure: { systolic: 120, diastolic: 80 }
        }
      ];
      const mockTrends = [
        {
          parameter: 'heart_rate',
          trend: 'stable',
          averageChange: 0
        }
      ];
      const mockAlerts = [];

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockLabResults);
      MockedPatientHealthRecordsService.getVisitHistory.mockResolvedValue(mockVisits);
      MockedPatientHealthRecordsService.getVitalsHistory.mockResolvedValue(mockVitals);
      MockedPatientHealthRecordsService.getVitalsTrends.mockResolvedValue(mockTrends);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app).get('/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recentLabResults.total).toBe(5);
      expect(response.body.data.recentVisits.total).toBe(3);
      expect(response.body.data.recentVitals.total).toBe(1);
      expect(response.body.data.vitalsTrends).toEqual(mockTrends);
      expect(response.body.data.healthAlerts).toEqual(mockAlerts);
      expect(response.body.data.lastUpdated).toBeDefined();

      // Verify service calls with correct parameters
      expect(MockedPatientHealthRecordsService.getLabResults).toHaveBeenCalledWith('patient123', 'workplace123', 3, 0);
      expect(MockedPatientHealthRecordsService.getVisitHistory).toHaveBeenCalledWith('patient123', 'workplace123', 3, 0);
      expect(MockedPatientHealthRecordsService.getVitalsHistory).toHaveBeenCalledWith('patient123', 'workplace123', 5);
      expect(MockedPatientHealthRecordsService.getVitalsTrends).toHaveBeenCalledWith('patient123', 'workplace123', 30);
    });

    it('should handle empty vitals in summary', async () => {
      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue({ results: [], total: 0 });
      MockedPatientHealthRecordsService.getVisitHistory.mockResolvedValue({ visits: [], total: 0 });
      MockedPatientHealthRecordsService.getVitalsHistory.mockResolvedValue([]);
      MockedPatientHealthRecordsService.getVitalsTrends.mockResolvedValue([]);

      const response = await request(app).get('/summary');

      expect(response.status).toBe(200);
      expect(response.body.data.healthAlerts).toEqual([]);
      expect(MockedPatientHealthRecordsService.checkVitalsAlerts).not.toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should require patient authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.get('/lab-results', PatientHealthRecordsController.getLabResults);
      appWithoutAuth.use((error: any, req: any, res: any, next: any) => {
        if (error instanceof AppError) {
          return res.status(error.statusCode).json({
            success: false,
            error: { message: error.message }
          });
        }
        res.status(500).json({ success: false, error: { message: 'Internal server error' } });
      });

      const response = await request(appWithoutAuth).get('/lab-results');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Patient authentication required');
    });
  });
});