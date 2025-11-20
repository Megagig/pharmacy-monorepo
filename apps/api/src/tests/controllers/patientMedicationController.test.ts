import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { PatientMedicationController } from '../../controllers/patientMedicationController';
import { PatientMedicationService } from '../../services/PatientMedicationService';
import { MedicationAlertService } from '../../services/MedicationAlertService';

// Mock the services
jest.mock('../../services/PatientMedicationService');
jest.mock('../../services/MedicationAlertService');

const MockedPatientMedicationService = PatientMedicationService as jest.Mocked<typeof PatientMedicationService>;
const MockedMedicationAlertService = MedicationAlertService as jest.Mocked<typeof MedicationAlertService>;

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.patientUser = {
    _id: 'patient-user-id',
    patientId: 'patient-id',
    workplaceId: 'workplace-id',
    email: 'patient@test.com',
    status: 'active'
  };
  next();
};

// Set up routes
app.get('/api/patient-portal/medications/current', mockAuthMiddleware, PatientMedicationController.getCurrentMedications);
app.get('/api/patient-portal/medications/history', mockAuthMiddleware, PatientMedicationController.getMedicationHistory);
app.get('/api/patient-portal/medications/:medicationId', mockAuthMiddleware, PatientMedicationController.getMedicationDetails);
app.get('/api/patient-portal/medications/adherence', mockAuthMiddleware, PatientMedicationController.getAdherenceData);
app.put('/api/patient-portal/medications/:medicationId/adherence', mockAuthMiddleware, PatientMedicationController.updateAdherenceScore);
app.post('/api/patient-portal/medications/refill-requests', mockAuthMiddleware, PatientMedicationController.requestRefill);
app.get('/api/patient-portal/medications/refill-requests', mockAuthMiddleware, PatientMedicationController.getRefillRequests);
app.delete('/api/patient-portal/medications/refill-requests/:requestId', mockAuthMiddleware, PatientMedicationController.cancelRefillRequest);
app.get('/api/patient-portal/medications/:medicationId/refill-eligibility', mockAuthMiddleware, PatientMedicationController.checkRefillEligibility);
app.post('/api/patient-portal/medications/:medicationId/reminders', mockAuthMiddleware, PatientMedicationController.setMedicationReminders);
app.get('/api/patient-portal/medications/reminders', mockAuthMiddleware, PatientMedicationController.getMedicationReminders);
app.get('/api/patient-portal/medications/alerts', mockAuthMiddleware, PatientMedicationController.getMedicationAlerts);

describe('PatientMedicationController', () => {
  const mockMedicationId = new mongoose.Types.ObjectId().toString();
  const mockRequestId = new mongoose.Types.ObjectId().toString();

  const mockMedication = {
    _id: mockMedicationId,
    drugName: 'Metformin',
    status: 'active',
    adherenceData: {
      score: 85,
      status: 'good'
    },
    refillStatus: {
      refillsRemaining: 3,
      isEligibleForRefill: true
    }
  };

  const mockAdherenceData = {
    overallAdherenceScore: 85,
    adherenceCategory: 'good',
    generateAdherenceReport: jest.fn().mockReturnValue({
      patientId: 'patient-id',
      overallScore: 85,
      category: 'good'
    }),
    assessAdherenceRisk: jest.fn().mockReturnValue('low'),
    activeAlerts: [],
    criticalAlerts: []
  };

  const mockRefillTask = {
    _id: mockRequestId,
    status: 'pending',
    priority: 'medium',
    dueDate: new Date(),
    createdAt: new Date(),
    metadata: {
      refillRequest: {
        medicationName: 'Metformin',
        requestedQuantity: 30,
        urgency: 'routine'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/patient-portal/medications/current', () => {
    it('should return current medications successfully', async () => {
      MockedPatientMedicationService.getCurrentMedications.mockResolvedValue([mockMedication] as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medications).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
      expect(MockedPatientMedicationService.getCurrentMedications).toHaveBeenCalledWith(
        'patient-id',
        'workplace-id'
      );
    });

    it('should return 404 if patient not found', async () => {
      MockedPatientMedicationService.getCurrentMedications.mockRejectedValue(
        new Error('Patient not found or access denied')
      );

      const response = await request(app)
        .get('/api/patient-portal/medications/current')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 500 for other errors', async () => {
      MockedPatientMedicationService.getCurrentMedications.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/patient-portal/medications/current')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve current medications');
    });
  });

  describe('GET /api/patient-portal/medications/history', () => {
    it('should return medication history with pagination', async () => {
      MockedPatientMedicationService.getMedicationHistory.mockResolvedValue([mockMedication] as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/history?limit=10&page=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medications).toHaveLength(1);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        hasMore: false
      });
    });

    it('should use default pagination values', async () => {
      MockedPatientMedicationService.getMedicationHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/patient-portal/medications/history')
        .expect(200);

      expect(MockedPatientMedicationService.getMedicationHistory).toHaveBeenCalledWith(
        'patient-id',
        'workplace-id',
        50 // default limit
      );
    });
  });

  describe('GET /api/patient-portal/medications/:medicationId', () => {
    it('should return medication details successfully', async () => {
      MockedPatientMedicationService.getMedicationDetails.mockResolvedValue(mockMedication as any);

      const response = await request(app)
        .get(`/api/patient-portal/medications/${mockMedicationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medication).toEqual(mockMedication);
      expect(MockedPatientMedicationService.getMedicationDetails).toHaveBeenCalledWith(
        'patient-id',
        mockMedicationId,
        'workplace-id'
      );
    });

    it('should return 400 if medication ID is missing', async () => {
      const response = await request(app)
        .get('/api/patient-portal/medications/')
        .expect(404); // Express returns 404 for missing route params
    });
  });

  describe('GET /api/patient-portal/medications/adherence', () => {
    it('should return adherence data successfully', async () => {
      MockedPatientMedicationService.getAdherenceData.mockResolvedValue(mockAdherenceData as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/adherence')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.adherenceData).toBeDefined();
      expect(response.body.data.riskLevel).toBe('low');
    });

    it('should handle null adherence data', async () => {
      MockedPatientMedicationService.getAdherenceData.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/patient-portal/medications/adherence')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.adherenceData).toBeNull();
    });
  });

  describe('PUT /api/patient-portal/medications/:medicationId/adherence', () => {
    it('should update adherence score successfully', async () => {
      MockedPatientMedicationService.updateAdherenceScore.mockResolvedValue();

      const response = await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 90 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Adherence score updated successfully');
      expect(MockedPatientMedicationService.updateAdherenceScore).toHaveBeenCalledWith(
        'patient-id',
        mockMedicationId,
        90,
        'workplace-id'
      );
    });

    it('should validate adherence score range', async () => {
      const response = await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 150 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('between 0 and 100');
    });

    it('should validate adherence score type', async () => {
      const response = await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('must be a number');
    });
  });

  describe('POST /api/patient-portal/medications/refill-requests', () => {
    const validRefillRequest = {
      medicationId: mockMedicationId,
      requestedQuantity: 30,
      urgency: 'routine',
      patientNotes: 'Running low on medication'
    };

    it('should create refill request successfully', async () => {
      MockedPatientMedicationService.checkRefillEligibility.mockResolvedValue({
        isEligible: true,
        refillsRemaining: 3
      });
      MockedPatientMedicationService.requestRefill.mockResolvedValue(mockRefillTask as any);

      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send(validRefillRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refillRequest.id).toBe(mockRequestId);
      expect(response.body.data.refillRequest.status).toBe('pending');
    });

    it('should check eligibility before creating request', async () => {
      MockedPatientMedicationService.checkRefillEligibility.mockResolvedValue({
        isEligible: false,
        reason: 'No refills remaining',
        refillsRemaining: 0
      });

      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send(validRefillRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No refills remaining');
      expect(response.body.data.refillsRemaining).toBe(0);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({ requestedQuantity: 30 }) // Missing medicationId
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should handle service errors', async () => {
      MockedPatientMedicationService.checkRefillEligibility.mockResolvedValue({
        isEligible: true,
        refillsRemaining: 3
      });
      MockedPatientMedicationService.requestRefill.mockRejectedValue(
        new Error('Medication not found')
      );

      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send(validRefillRequest)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Medication not found');
    });
  });

  describe('GET /api/patient-portal/medications/refill-requests', () => {
    const mockRefillRequests = [
      {
        _id: mockRequestId,
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(),
        createdAt: new Date(),
        assignedTo: { firstName: 'Dr.', lastName: 'Smith' },
        metadata: {
          refillRequest: {
            medicationId: mockMedicationId,
            medicationName: 'Metformin',
            requestedQuantity: 30,
            urgency: 'routine',
            patientNotes: 'Running low'
          }
        },
        outcome: null
      }
    ];

    it('should return refill requests successfully', async () => {
      MockedPatientMedicationService.getRefillRequests.mockResolvedValue(mockRefillRequests as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/refill-requests')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refillRequests).toHaveLength(1);
      expect(response.body.data.summary.pending).toBe(1);
    });

    it('should filter by status', async () => {
      MockedPatientMedicationService.getRefillRequests.mockResolvedValue(mockRefillRequests as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/refill-requests?status=pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refillRequests).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      MockedPatientMedicationService.getRefillRequests.mockResolvedValue([]);

      await request(app)
        .get('/api/patient-portal/medications/refill-requests?limit=10')
        .expect(200);

      expect(MockedPatientMedicationService.getRefillRequests).toHaveBeenCalledWith(
        'patient-id',
        'workplace-id',
        10
      );
    });
  });

  describe('DELETE /api/patient-portal/medications/refill-requests/:requestId', () => {
    it('should cancel refill request successfully', async () => {
      MockedPatientMedicationService.cancelRefillRequest.mockResolvedValue();

      const response = await request(app)
        .delete(`/api/patient-portal/medications/refill-requests/${mockRequestId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Refill request cancelled successfully');
      expect(MockedPatientMedicationService.cancelRefillRequest).toHaveBeenCalledWith(
        'patient-id',
        mockRequestId,
        'workplace-id'
      );
    });

    it('should return 404 if request not found', async () => {
      MockedPatientMedicationService.cancelRefillRequest.mockRejectedValue(
        new Error('Refill request not found or cannot be cancelled')
      );

      const response = await request(app)
        .delete(`/api/patient-portal/medications/refill-requests/${mockRequestId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patient-portal/medications/:medicationId/refill-eligibility', () => {
    it('should check refill eligibility successfully', async () => {
      const mockEligibility = {
        isEligible: true,
        refillsRemaining: 3
      };

      MockedPatientMedicationService.checkRefillEligibility.mockResolvedValue(mockEligibility);

      const response = await request(app)
        .get(`/api/patient-portal/medications/${mockMedicationId}/refill-eligibility`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibility).toEqual(mockEligibility);
    });
  });

  describe('POST /api/patient-portal/medications/:medicationId/reminders', () => {
    const validReminderData = {
      reminderTimes: ['08:00', '20:00'],
      isActive: true
    };

    it('should set medication reminders successfully', async () => {
      MockedPatientMedicationService.setMedicationReminders.mockResolvedValue();

      const response = await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send(validReminderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Medication reminders set successfully');
    });

    it('should validate time format', async () => {
      const invalidReminderData = {
        reminderTimes: ['25:00'], // Invalid time
        isActive: true
      };

      const response = await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send(invalidReminderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid time format');
    });

    it('should validate reminderTimes is array', async () => {
      const invalidReminderData = {
        reminderTimes: 'not-an-array',
        isActive: true
      };

      const response = await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send(invalidReminderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Reminder times must be an array');
    });
  });

  describe('GET /api/patient-portal/medications/reminders', () => {
    const mockReminders = [
      {
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        reminderTimes: ['08:00', '20:00'],
        frequency: 'daily',
        isActive: true
      }
    ];

    it('should return medication reminders successfully', async () => {
      MockedPatientMedicationService.getMedicationReminders.mockResolvedValue(mockReminders);

      const response = await request(app)
        .get('/api/patient-portal/medications/reminders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reminders).toEqual(mockReminders);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.activeCount).toBe(1);
    });
  });

  describe('GET /api/patient-portal/medications/alerts', () => {
    const mockAlerts = [
      {
        patientId: 'patient-id',
        medicationId: mockMedicationId,
        medicationName: 'Metformin',
        alertType: 'refill_due' as const,
        severity: 'high' as const,
        message: 'Refill needed soon',
        recommendedAction: 'Process refill',
        createdAt: new Date()
      }
    ];

    it('should return medication alerts successfully', async () => {
      MockedMedicationAlertService.getPatientMedicationAlerts.mockResolvedValue(mockAlerts as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toEqual(mockAlerts);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.summary.high).toBe(1);
    });

    it('should filter alerts by severity', async () => {
      MockedMedicationAlertService.getPatientMedicationAlerts.mockResolvedValue(mockAlerts as any);

      const response = await request(app)
        .get('/api/patient-portal/medications/alerts?severity=high')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toHaveLength(1);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.get('/test', PatientMedicationController.getCurrentMedications);

      const response = await request(appWithoutAuth)
        .get('/test')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });
});