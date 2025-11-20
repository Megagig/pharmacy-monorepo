import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import DiagnosticHistory from '../models/DiagnosticHistory';
import DiagnosticCase from '../models/DiagnosticCase';
import Patient from '../models/Patient';
import User from '../models/User';
import { createTestUser, createTestPatient, createTestWorkplace } from './helpers/testHelpers';

describe('Diagnostic History API', () => {
  let authToken: string;
  let userId: mongoose.Types.ObjectId;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let diagnosticCaseId: mongoose.Types.ObjectId;
  let diagnosticHistoryId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test workplace
    const workplace = await createTestWorkplace();
    workplaceId = workplace._id;

    // Create test user
    const { user, token } = await createTestUser({
      workplaceId,
      role: 'pharmacist',
    });
    userId = user._id;
    authToken = token;

    // Create test patient
    const patient = await createTestPatient({ workplaceId });
    patientId = patient._id;

    // Create test diagnostic case
    const diagnosticCase = new DiagnosticCase({
      caseId: 'TEST-CASE-001',
      patientId,
      pharmacistId: userId,
      workplaceId,
      symptoms: {
        subjective: ['headache', 'fatigue'],
        objective: ['fever'],
        duration: '3 days',
        severity: 'moderate',
        onset: 'acute',
      },
      aiAnalysis: {
        differentialDiagnoses: [
          {
            condition: 'Viral infection',
            probability: 85,
            reasoning: 'Common symptoms match viral pattern',
            severity: 'medium',
          },
        ],
        recommendedTests: [],
        therapeuticOptions: [],
        redFlags: [],
        disclaimer: 'Test disclaimer',
        confidenceScore: 85,
        processingTime: 1500,
      },
      status: 'completed',
    });
    await diagnosticCase.save();
    diagnosticCaseId = diagnosticCase._id;

    // Create test diagnostic history
    const diagnosticHistory = new DiagnosticHistory({
      patientId,
      caseId: diagnosticCase.caseId,
      diagnosticCaseId,
      pharmacistId: userId,
      workplaceId,
      analysisSnapshot: diagnosticCase.aiAnalysis,
      clinicalContext: {
        symptoms: diagnosticCase.symptoms,
      },
      notes: [],
      followUp: {
        required: false,
        completed: false,
      },
      status: 'active',
    });
    await diagnosticHistory.save();
    diagnosticHistoryId = diagnosticHistory._id;
  });

  afterAll(async () => {
    // Clean up test data
    await DiagnosticHistory.deleteMany({});
    await DiagnosticCase.deleteMany({});
    await Patient.deleteMany({});
    await User.deleteMany({});
  });

  describe('GET /api/diagnostics/patients/:patientId/history', () => {
    it('should get patient diagnostic history', async () => {
      const response = await request(app)
        .get(`/api/diagnostics/patients/${patientId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(1);
      expect(response.body.data.history[0].caseId).toBe('TEST-CASE-001');
      expect(response.body.data.patient.id).toBe(patientId.toString());
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/diagnostics/patients/${patientId}/history?page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.pagination.current).toBe(1);
      expect(response.body.data.pagination.count).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/diagnostics/history/:historyId/notes', () => {
    it('should add note to diagnostic history', async () => {
      const noteData = {
        content: 'Patient responded well to treatment',
        type: 'clinical',
      };

      const response = await request(app)
        .post(`/api/diagnostics/history/${diagnosticHistoryId}/notes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.noteId).toBeDefined();

      // Verify note was added
      const history = await DiagnosticHistory.findById(diagnosticHistoryId);
      expect(history?.notes).toHaveLength(1);
      expect(history?.notes[0].content).toBe(noteData.content);
    });
  });

  describe('GET /api/diagnostics/analytics', () => {
    it('should get diagnostic analytics', async () => {
      const response = await request(app)
        .get('/api/diagnostics/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.topDiagnoses).toBeDefined();
      expect(response.body.data.completionTrends).toBeDefined();
    });

    it('should support date filtering', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';

      const response = await request(app)
        .get(`/api/diagnostics/analytics?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.dateRange.from).toBe(dateFrom);
      expect(response.body.data.dateRange.to).toBe(dateTo);
    });
  });

  describe('GET /api/diagnostics/cases/all', () => {
    it('should get all diagnostic cases', async () => {
      const response = await request(app)
        .get('/api/diagnostics/cases/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cases).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/diagnostics/cases/all?search=TEST-CASE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.cases.length).toBeGreaterThan(0);
      expect(response.body.data.cases[0].caseId).toContain('TEST-CASE');
    });
  });

  describe('GET /api/diagnostics/referrals', () => {
    it('should get diagnostic referrals', async () => {
      const response = await request(app)
        .get('/api/diagnostics/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.referrals).toBeDefined();
      expect(response.body.data.statistics).toBeDefined();
    });
  });

  describe('POST /api/diagnostics/history/compare', () => {
    it('should compare diagnostic histories', async () => {
      // Create second history for comparison
      const secondHistory = new DiagnosticHistory({
        patientId,
        caseId: 'TEST-CASE-002',
        diagnosticCaseId,
        pharmacistId: userId,
        workplaceId,
        analysisSnapshot: {
          ...diagnosticCaseId.aiAnalysis,
          confidenceScore: 90,
        },
        clinicalContext: {
          symptoms: {
            subjective: ['headache'],
            objective: [],
            duration: '1 day',
            severity: 'mild',
            onset: 'acute',
          },
        },
        status: 'active',
      });
      await secondHistory.save();

      const response = await request(app)
        .post('/api/diagnostics/history/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          historyId1: diagnosticHistoryId.toString(),
          historyId2: secondHistory._id.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comparison).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();

      // Clean up
      await DiagnosticHistory.findByIdAndDelete(secondHistory._id);
    });
  });

  describe('Patient Integration', () => {
    describe('GET /api/patients/:id/diagnostic-history', () => {
      it('should get patient diagnostic history from patient endpoint', async () => {
        const response = await request(app)
          .get(`/api/patients/${patientId}/diagnostic-history`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.history).toBeDefined();
        expect(response.body.data.patient).toBeDefined();
      });
    });

    describe('GET /api/patients/:id/diagnostic-summary', () => {
      it('should get patient diagnostic summary', async () => {
        const response = await request(app)
          .get(`/api/patients/${patientId}/diagnostic-summary`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.diagnosticSummary).toBeDefined();
        expect(response.body.data.diagnosticSummary.totalCases).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent patient', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/diagnostics/patients/${fakePatientId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid history comparison', async () => {
      await request(app)
        .post('/api/diagnostics/history/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          historyId1: diagnosticHistoryId.toString(),
          // Missing historyId2
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/diagnostics/analytics')
        .expect(401);
    });
  });
});