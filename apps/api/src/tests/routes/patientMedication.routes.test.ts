import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import patientMedicationRoutes from '../../routes/patientMedication.routes';
import { PatientMedicationController } from '../../controllers/patientMedicationController';

// Mock the controller
jest.mock('../../controllers/patientMedicationController');

const MockedPatientMedicationController = PatientMedicationController as jest.Mocked<typeof PatientMedicationController>;

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

// Apply middleware and routes
app.use('/api/patient-portal/medications', mockAuthMiddleware, patientMedicationRoutes);

describe('Patient Medication Routes', () => {
  const mockMedicationId = new mongoose.Types.ObjectId().toString();
  const mockRequestId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock all controller methods to prevent actual execution
    MockedPatientMedicationController.getCurrentMedications.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { medications: [] } });
    });
    
    MockedPatientMedicationController.getMedicationHistory.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { medications: [] } });
    });
    
    MockedPatientMedicationController.getMedicationDetails.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { medication: {} } });
    });
    
    MockedPatientMedicationController.getAdherenceData.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { adherenceData: null } });
    });
    
    MockedPatientMedicationController.updateAdherenceScore.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, message: 'Updated' });
    });
    
    MockedPatientMedicationController.requestRefill.mockImplementation(async (req, res) => {
      res.status(201).json({ success: true, data: { refillRequest: {} } });
    });
    
    MockedPatientMedicationController.getRefillRequests.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { refillRequests: [] } });
    });
    
    MockedPatientMedicationController.cancelRefillRequest.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, message: 'Cancelled' });
    });
    
    MockedPatientMedicationController.checkRefillEligibility.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { eligibility: {} } });
    });
    
    MockedPatientMedicationController.setMedicationReminders.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, message: 'Reminders set' });
    });
    
    MockedPatientMedicationController.getMedicationReminders.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { reminders: [] } });
    });
    
    MockedPatientMedicationController.getMedicationAlerts.mockImplementation(async (req, res) => {
      res.status(200).json({ success: true, data: { alerts: [] } });
    });
  });

  describe('GET /api/patient-portal/medications/current', () => {
    it('should call getCurrentMedications controller', async () => {
      await request(app)
        .get('/api/patient-portal/medications/current')
        .expect(200);

      expect(MockedPatientMedicationController.getCurrentMedications).toHaveBeenCalled();
    });
  });

  describe('GET /api/patient-portal/medications/history', () => {
    it('should call getMedicationHistory controller', async () => {
      await request(app)
        .get('/api/patient-portal/medications/history')
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationHistory).toHaveBeenCalled();
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/patient-portal/medications/history?limit=150') // Exceeds max limit
        .expect(400);
    });

    it('should accept valid pagination parameters', async () => {
      await request(app)
        .get('/api/patient-portal/medications/history?limit=50&page=2')
        .expect(200);
    });
  });

  describe('GET /api/patient-portal/medications/:medicationId', () => {
    it('should call getMedicationDetails controller with valid ID', async () => {
      await request(app)
        .get(`/api/patient-portal/medications/${mockMedicationId}`)
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationDetails).toHaveBeenCalled();
    });

    it('should validate medication ID format', async () => {
      await request(app)
        .get('/api/patient-portal/medications/invalid-id')
        .expect(400);
    });
  });

  describe('GET /api/patient-portal/medications/adherence', () => {
    it('should call getAdherenceData controller', async () => {
      await request(app)
        .get('/api/patient-portal/medications/adherence')
        .expect(200);

      expect(MockedPatientMedicationController.getAdherenceData).toHaveBeenCalled();
    });
  });

  describe('PUT /api/patient-portal/medications/:medicationId/adherence', () => {
    it('should update adherence score with valid data', async () => {
      await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 85 })
        .expect(200);

      expect(MockedPatientMedicationController.updateAdherenceScore).toHaveBeenCalled();
    });

    it('should validate adherence score range', async () => {
      await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 150 })
        .expect(400);
    });

    it('should validate adherence score is a number', async () => {
      await request(app)
        .put(`/api/patient-portal/medications/${mockMedicationId}/adherence`)
        .send({ adherenceScore: 'invalid' })
        .expect(400);
    });

    it('should validate medication ID format', async () => {
      await request(app)
        .put('/api/patient-portal/medications/invalid-id/adherence')
        .send({ adherenceScore: 85 })
        .expect(400);
    });
  });

  describe('POST /api/patient-portal/medications/refill-requests', () => {
    const validRefillRequest = {
      medicationId: mockMedicationId,
      requestedQuantity: 30,
      urgency: 'routine',
      patientNotes: 'Running low on medication'
    };

    it('should create refill request with valid data', async () => {
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send(validRefillRequest)
        .expect(201);

      expect(MockedPatientMedicationController.requestRefill).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({ requestedQuantity: 30 }) // Missing medicationId
        .expect(400);
    });

    it('should validate medication ID format', async () => {
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: 'invalid-id',
          requestedQuantity: 30
        })
        .expect(400);
    });

    it('should validate requested quantity range', async () => {
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 0 // Below minimum
        })
        .expect(400);

      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 500 // Above maximum
        })
        .expect(400);
    });

    it('should validate urgency values', async () => {
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30,
          urgency: 'invalid-urgency'
        })
        .expect(400);
    });

    it('should validate patient notes length', async () => {
      const longNotes = 'a'.repeat(1001); // Exceeds 1000 character limit
      
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30,
          patientNotes: longNotes
        })
        .expect(400);
    });

    it('should validate pickup date format and future date', async () => {
      // Invalid date format
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30,
          estimatedPickupDate: 'invalid-date'
        })
        .expect(400);

      // Past date
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30,
          estimatedPickupDate: '2020-01-01T00:00:00.000Z'
        })
        .expect(400);
    });

    it('should accept valid pickup date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30,
          estimatedPickupDate: futureDate.toISOString()
        })
        .expect(201);
    });
  });

  describe('GET /api/patient-portal/medications/refill-requests', () => {
    it('should get refill requests', async () => {
      await request(app)
        .get('/api/patient-portal/medications/refill-requests')
        .expect(200);

      expect(MockedPatientMedicationController.getRefillRequests).toHaveBeenCalled();
    });

    it('should validate status filter', async () => {
      await request(app)
        .get('/api/patient-portal/medications/refill-requests?status=invalid-status')
        .expect(400);
    });

    it('should accept valid status filter', async () => {
      await request(app)
        .get('/api/patient-portal/medications/refill-requests?status=pending')
        .expect(200);
    });
  });

  describe('DELETE /api/patient-portal/medications/refill-requests/:requestId', () => {
    it('should cancel refill request with valid ID', async () => {
      await request(app)
        .delete(`/api/patient-portal/medications/refill-requests/${mockRequestId}`)
        .expect(200);

      expect(MockedPatientMedicationController.cancelRefillRequest).toHaveBeenCalled();
    });

    it('should validate request ID format', async () => {
      await request(app)
        .delete('/api/patient-portal/medications/refill-requests/invalid-id')
        .expect(400);
    });
  });

  describe('GET /api/patient-portal/medications/:medicationId/refill-eligibility', () => {
    it('should check refill eligibility with valid ID', async () => {
      await request(app)
        .get(`/api/patient-portal/medications/${mockMedicationId}/refill-eligibility`)
        .expect(200);

      expect(MockedPatientMedicationController.checkRefillEligibility).toHaveBeenCalled();
    });

    it('should validate medication ID format', async () => {
      await request(app)
        .get('/api/patient-portal/medications/invalid-id/refill-eligibility')
        .expect(400);
    });
  });

  describe('POST /api/patient-portal/medications/:medicationId/reminders', () => {
    const validReminderData = {
      reminderTimes: ['08:00', '20:00'],
      isActive: true
    };

    it('should set reminders with valid data', async () => {
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send(validReminderData)
        .expect(200);

      expect(MockedPatientMedicationController.setMedicationReminders).toHaveBeenCalled();
    });

    it('should validate medication ID format', async () => {
      await request(app)
        .post('/api/patient-portal/medications/invalid-id/reminders')
        .send(validReminderData)
        .expect(400);
    });

    it('should validate reminder times array', async () => {
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: 'not-an-array',
          isActive: true
        })
        .expect(400);
    });

    it('should validate time format', async () => {
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: ['25:00'], // Invalid time
          isActive: true
        })
        .expect(400);

      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: ['8:00'], // Should be 08:00
          isActive: true
        })
        .expect(400);
    });

    it('should validate maximum reminder times', async () => {
      const tooManyTimes = Array(11).fill('08:00'); // Exceeds max of 10
      
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: tooManyTimes,
          isActive: true
        })
        .expect(400);
    });

    it('should validate isActive boolean', async () => {
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: ['08:00'],
          isActive: 'not-boolean'
        })
        .expect(400);
    });

    it('should accept valid time formats', async () => {
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: ['00:00', '12:30', '23:59'],
          isActive: true
        })
        .expect(200);
    });
  });

  describe('GET /api/patient-portal/medications/reminders', () => {
    it('should get medication reminders', async () => {
      await request(app)
        .get('/api/patient-portal/medications/reminders')
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationReminders).toHaveBeenCalled();
    });
  });

  describe('GET /api/patient-portal/medications/alerts', () => {
    it('should get medication alerts', async () => {
      await request(app)
        .get('/api/patient-portal/medications/alerts')
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationAlerts).toHaveBeenCalled();
    });

    it('should validate severity filter', async () => {
      await request(app)
        .get('/api/patient-portal/medications/alerts?severity=invalid-severity')
        .expect(400);
    });

    it('should accept valid severity filter', async () => {
      await request(app)
        .get('/api/patient-portal/medications/alerts?severity=high')
        .expect(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      // This test would need to be run with actual rate limiting enabled
      // For now, we just verify the route is accessible
      await request(app)
        .get('/api/patient-portal/medications/current')
        .expect(200);
    });

    it('should apply refill request rate limiting', async () => {
      // This test would need to be run with actual rate limiting enabled
      // For now, we just verify the route is accessible
      await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: mockMedicationId,
          requestedQuantity: 30
        })
        .expect(201);
    });

    it('should apply reminder rate limiting', async () => {
      // This test would need to be run with actual rate limiting enabled
      // For now, we just verify the route is accessible
      await request(app)
        .post(`/api/patient-portal/medications/${mockMedicationId}/reminders`)
        .send({
          reminderTimes: ['08:00'],
          isActive: true
        })
        .expect(200);
    });
  });

  describe('Route Order and Specificity', () => {
    it('should match specific routes before parameterized routes', async () => {
      // Test that /adherence is matched before /:medicationId
      await request(app)
        .get('/api/patient-portal/medications/adherence')
        .expect(200);

      expect(MockedPatientMedicationController.getAdherenceData).toHaveBeenCalled();
      expect(MockedPatientMedicationController.getMedicationDetails).not.toHaveBeenCalled();
    });

    it('should match /reminders before /:medicationId', async () => {
      await request(app)
        .get('/api/patient-portal/medications/reminders')
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationReminders).toHaveBeenCalled();
      expect(MockedPatientMedicationController.getMedicationDetails).not.toHaveBeenCalled();
    });

    it('should match /alerts before /:medicationId', async () => {
      await request(app)
        .get('/api/patient-portal/medications/alerts')
        .expect(200);

      expect(MockedPatientMedicationController.getMedicationAlerts).toHaveBeenCalled();
      expect(MockedPatientMedicationController.getMedicationDetails).not.toHaveBeenCalled();
    });

    it('should match /refill-requests before /:medicationId', async () => {
      await request(app)
        .get('/api/patient-portal/medications/refill-requests')
        .expect(200);

      expect(MockedPatientMedicationController.getRefillRequests).toHaveBeenCalled();
      expect(MockedPatientMedicationController.getMedicationDetails).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({
          medicationId: 'invalid-id',
          requestedQuantity: 'not-a-number'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/patient-portal/medications/refill-requests')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});