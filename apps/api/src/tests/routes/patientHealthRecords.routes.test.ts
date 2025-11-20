import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import patientHealthRecordsRoutes from '../../routes/patientHealthRecords.routes';
import { PatientHealthRecordsService } from '../../services/PatientHealthRecordsService';
import { PDFGenerationService } from '../../services/PDFGenerationService';

// Mock the services
jest.mock('../../services/PatientHealthRecordsService');
jest.mock('../../services/PDFGenerationService');
jest.mock('../../utils/logger');

const MockedPatientHealthRecordsService = PatientHealthRecordsService as jest.Mocked<typeof PatientHealthRecordsService>;
const MockedPDFGenerationService = PDFGenerationService as jest.Mocked<typeof PDFGenerationService>;

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock patient authentication middleware
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

// Apply mock authentication to all routes
app.use('/api/patient-portal/health-records', mockPatientAuth, patientHealthRecordsRoutes);

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: error.code
    }
  });
});

describe('Patient Health Records Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/patient-portal/health-records/lab-results', () => {
    it('should fetch lab results with valid pagination', async () => {
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
            ]
          }
        ],
        total: 1,
        hasMore: false
      };

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/patient-portal/health-records/lab-results')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults.results);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/lab-results')
        .query({ page: 0, limit: 101 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should use default pagination when not provided', async () => {
      const mockResults = {
        results: [],
        total: 0,
        hasMore: false
      };

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/patient-portal/health-records/lab-results');

      expect(response.status).toBe(200);
      expect(MockedPatientHealthRecordsService.getLabResults).toHaveBeenCalledWith(
        'patient123',
        'workplace123',
        20, // default limit
        0   // default skip
      );
    });
  });

  describe('GET /api/patient-portal/health-records/lab-results/:resultId', () => {
    it('should fetch lab result details with valid ObjectId', async () => {
      const resultId = new mongoose.Types.ObjectId().toString();
      const mockResult = {
        _id: resultId,
        caseId: 'DX-001',
        labResults: [
          {
            testName: 'Complete Blood Count',
            value: 'Normal',
            referenceRange: 'Normal',
            abnormal: false
          }
        ]
      };

      MockedPatientHealthRecordsService.getLabResultDetails.mockResolvedValue(mockResult);

      const response = await request(app)
        .get(`/api/patient-portal/health-records/lab-results/${resultId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should validate ObjectId format', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/lab-results/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid result ID format');
    });
  });

  describe('GET /api/patient-portal/health-records/visits', () => {
    it('should fetch visit history with pagination', async () => {
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

      const response = await request(app)
        .get('/api/patient-portal/health-records/visits')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.visits).toEqual(mockVisits.visits);
    });
  });

  describe('GET /api/patient-portal/health-records/visits/:visitId', () => {
    it('should fetch visit details with valid ObjectId', async () => {
      const visitId = new mongoose.Types.ObjectId().toString();
      const mockVisit = {
        _id: visitId,
        date: new Date(),
        soap: {
          subjective: 'Patient complains of headache',
          objective: 'BP: 120/80',
          assessment: 'Tension headache',
          plan: 'Rest and hydration'
        }
      };

      MockedPatientHealthRecordsService.getVisitDetails.mockResolvedValue(mockVisit);

      const response = await request(app)
        .get(`/api/patient-portal/health-records/visits/${visitId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVisit);
    });

    it('should validate visit ID format', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/visits/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid visit ID format');
    });
  });

  describe('POST /api/patient-portal/health-records/vitals', () => {
    it('should log vitals with valid data', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        glucose: 100,
        oxygenSaturation: 98,
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

      MockedPatientHealthRecordsService.logVitals.mockResolvedValue(mockPatient as any);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/patient-portal/health-records/vitals')
        .send(vitalsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Vitals logged successfully');
    });

    it('should validate vitals data ranges', async () => {
      const invalidVitalsData = {
        bloodPressure: { systolic: 400, diastolic: 250 }, // Too high
        heartRate: 300, // Too high
        temperature: 50, // Too high
        weight: -5, // Negative
        glucose: 1000, // Too high
        oxygenSaturation: 150 // Too high
      };

      const response = await request(app)
        .post('/api/patient-portal/health-records/vitals')
        .send(invalidVitalsData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate notes length', async () => {
      const vitalsData = {
        heartRate: 72,
        notes: 'A'.repeat(501) // Too long
      };

      const response = await request(app)
        .post('/api/patient-portal/health-records/vitals')
        .send(vitalsData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Notes cannot exceed 500 characters');
    });

    it('should accept optional fields', async () => {
      const vitalsData = {
        heartRate: 72
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

      MockedPatientHealthRecordsService.logVitals.mockResolvedValue(mockPatient as any);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/patient-portal/health-records/vitals')
        .send(vitalsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/patient-portal/health-records/vitals', () => {
    it('should fetch vitals history with valid limit', async () => {
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
        .get('/api/patient-portal/health-records/vitals')
        .query({ limit: 25 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals).toEqual(mockVitals);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/vitals')
        .query({ limit: 101 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Limit must be between 1 and 100');
    });
  });

  describe('GET /api/patient-portal/health-records/vitals/trends', () => {
    it('should fetch vitals trends with valid days parameter', async () => {
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
        .get('/api/patient-portal/health-records/vitals/trends')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toEqual(mockTrends);
    });

    it('should validate days parameter range', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/vitals/trends')
        .query({ days: 400 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Days must be between 1 and 365');
    });
  });

  describe('GET /api/patient-portal/health-records/download', () => {
    it('should download medical records PDF with valid parameters', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');

      MockedPDFGenerationService.generateMedicalRecordsPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .get('/api/patient-portal/health-records/download')
        .query({
          includeProfile: 'true',
          includeMedications: 'true',
          includeVitals: 'true',
          includeLabResults: 'true',
          includeVisitHistory: 'true',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-12-31T23:59:59.999Z'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should validate boolean parameters', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/download')
        .query({
          includeProfile: 'invalid-boolean'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('includeProfile must be a boolean');
    });

    it('should validate date parameters', async () => {
      const response = await request(app)
        .get('/api/patient-portal/health-records/download')
        .query({
          startDate: 'invalid-date',
          endDate: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patient-portal/health-records/medications/download', () => {
    it('should download medication list PDF', async () => {
      const mockPDFBuffer = Buffer.from('mock-medication-pdf');

      MockedPDFGenerationService.generateMedicationListPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .get('/api/patient-portal/health-records/medications/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('medication-list');
    });
  });

  describe('POST /api/patient-portal/health-records/lab-results/download', () => {
    it('should download lab results PDF with valid result IDs', async () => {
      const mockPDFBuffer = Buffer.from('mock-lab-results-pdf');
      const resultIds = [
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString()
      ];

      MockedPDFGenerationService.generateLabResultsPDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .post('/api/patient-portal/health-records/lab-results/download')
        .send({ resultIds });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('lab-results');
    });

    it('should validate result IDs format', async () => {
      const response = await request(app)
        .post('/api/patient-portal/health-records/lab-results/download')
        .send({ resultIds: ['invalid-id', 'another-invalid-id'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Each result ID must be a valid MongoDB ObjectId');
    });

    it('should validate result IDs as array', async () => {
      const response = await request(app)
        .post('/api/patient-portal/health-records/lab-results/download')
        .send({ resultIds: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Result IDs must be an array');
    });
  });

  describe('GET /api/patient-portal/health-records/summary', () => {
    it('should fetch health summary', async () => {
      const mockLabResults = { results: [], total: 0 };
      const mockVisits = { visits: [], total: 0 };
      const mockVitals: any[] = [];
      const mockTrends: any[] = [];

      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue(mockLabResults);
      MockedPatientHealthRecordsService.getVisitHistory.mockResolvedValue(mockVisits);
      MockedPatientHealthRecordsService.getVitalsHistory.mockResolvedValue(mockVitals);
      MockedPatientHealthRecordsService.getVitalsTrends.mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/api/patient-portal/health-records/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recentLabResults).toBeDefined();
      expect(response.body.data.recentVisits).toBeDefined();
      expect(response.body.data.recentVitals).toBeDefined();
      expect(response.body.data.vitalsTrends).toBeDefined();
      expect(response.body.data.healthAlerts).toBeDefined();
      expect(response.body.data.lastUpdated).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      MockedPatientHealthRecordsService.getLabResults.mockResolvedValue({
        results: [],
        total: 0,
        hasMore: false
      });

      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app).get('/api/patient-portal/health-records/lab-results')
      );

      const responses = await Promise.all(requests);

      // All requests should succeed initially (within rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should apply vitals logging rate limiting', async () => {
      const vitalsData = {
        heartRate: 72
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

      MockedPatientHealthRecordsService.logVitals.mockResolvedValue(mockPatient as any);
      MockedPatientHealthRecordsService.checkVitalsAlerts.mockResolvedValue([]);

      // Make multiple vitals logging requests
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/patient-portal/health-records/vitals')
          .send(vitalsData)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed initially (within rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });

    it('should apply download rate limiting', async () => {
      const mockPDFBuffer = Buffer.from('mock-pdf-content');

      MockedPDFGenerationService.generateMedicalRecordsPDF.mockResolvedValue(mockPDFBuffer);

      // Make multiple download requests
      const requests = Array.from({ length: 3 }, () =>
        request(app).get('/api/patient-portal/health-records/download')
      );

      const responses = await Promise.all(requests);

      // All requests should succeed initially (within rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Authentication', () => {
    it('should require patient authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/patient-portal/health-records', patientHealthRecordsRoutes);
      appWithoutAuth.use((error: any, req: any, res: any, next: any) => {
        res.status(error.statusCode || 500).json({
          success: false,
          error: { message: error.message || 'Internal server error' }
        });
      });

      const response = await request(appWithoutAuth)
        .get('/api/patient-portal/health-records/lab-results');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});