import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { cleanupTestData } from '../utils/testHelpers';
import User from '../../models/User';
import Patient from '../../models/Patient';
import DiagnosticCase from '../../models/DiagnosticCase';
import FollowUpTask from '../../models/FollowUpTask';
import Appointment from '../../models/Appointment';
import { engagementIntegrationService } from '../../services/EngagementIntegrationService';

describe('Diagnostic Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testPatient: any;
  let testDiagnosticCase: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'test.pharmacist@example.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: new mongoose.Types.ObjectId(),
      isEmailVerified: true,
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      workplaceId: testUser.workplaceId,
      createdBy: testUser._id,
    });

    // Create test diagnostic case
    testDiagnosticCase = await DiagnosticCase.create({
      caseId: 'DX-TEST-001',
      patientId: testPatient._id,
      pharmacistId: testUser._id,
      workplaceId: testUser.workplaceId,
      symptoms: {
        subjective: ['headache', 'fatigue'],
        objective: ['elevated blood pressure'],
        duration: '3 days',
        severity: 'moderate',
        onset: 'acute',
      },
      aiAnalysis: {
        differentialDiagnoses: [
          {
            condition: 'Hypertension',
            probability: 0.85,
            reasoning: 'Elevated blood pressure with associated symptoms',
            severity: 'medium',
          },
        ],
        recommendedTests: [
          {
            testName: 'Blood pressure monitoring',
            priority: 'urgent',
            reasoning: 'Confirm hypertension diagnosis',
          },
        ],
        therapeuticOptions: [
          {
            medication: 'Lisinopril',
            dosage: '10mg',
            frequency: 'once daily',
            duration: '30 days',
            reasoning: 'First-line ACE inhibitor for hypertension',
            safetyNotes: ['Monitor kidney function', 'Watch for dry cough'],
          },
        ],
        redFlags: [
          {
            flag: 'Severe hypertension',
            severity: 'high',
            action: 'Monitor closely and consider immediate intervention',
          },
        ],
        referralRecommendation: {
          recommended: true,
          urgency: 'routine',
          specialty: 'cardiology',
          reason: 'New onset hypertension requiring specialist evaluation',
        },
        disclaimer: 'This is an AI-generated analysis and should be reviewed by a healthcare professional.',
        confidenceScore: 0.75,
        processingTime: 2.5,
      },
      status: 'completed',
      patientConsent: {
        provided: true,
        consentDate: new Date(),
        consentMethod: 'electronic',
      },
      aiRequestData: {
        model: 'test-model',
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        requestId: 'test-request-id',
        processingTime: 2.5,
      },
    });

    // Generate auth token
    authToken = testUser.generateAuthToken();
  });

  afterEach(async () => {
    await cleanupTestData([User, Patient, DiagnosticCase, FollowUpTask, Appointment]);
  });

  describe('POST /api/engagement-integration/diagnostic/:diagnosticCaseId/create-followup', () => {
    it('should create follow-up task from diagnostic case', async () => {
      const response = await request(app)
        .post(`/api/engagement-integration/diagnostic/${testDiagnosticCase._id}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assignedTo: testUser._id.toString(),
          locationId: 'main-pharmacy',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.followUpTask).toBeDefined();
      expect(response.body.data.diagnosticCase).toBeDefined();

      const followUpTask = response.body.data.followUpTask;
      expect(followUpTask.title).toContain('Diagnostic Follow-up: Hypertension');
      expect(followUpTask.priority).toBe('high'); // Based on red flags
      expect(followUpTask.status).toBe('pending');
      expect(followUpTask.relatedRecords.diagnosticCaseId).toBe(testDiagnosticCase._id.toString());

      // Verify task was created in database
      const dbTask = await FollowUpTask.findById(followUpTask._id);
      expect(dbTask).toBeTruthy();
      expect(dbTask!.trigger.type).toBe('system_rule');
      expect(dbTask!.trigger.sourceType).toBe('DiagnosticCase');
    });

    it('should return existing follow-up task if already exists', async () => {
      // Create initial follow-up task
      const firstResponse = await request(app)
        .post(`/api/engagement-integration/diagnostic/${testDiagnosticCase._id}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      // Try to create another one
      const secondResponse = await request(app)
        .post(`/api/engagement-integration/diagnostic/${testDiagnosticCase._id}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      expect(firstResponse.body.data.followUpTask._id).toBe(
        secondResponse.body.data.followUpTask._id
      );

      // Verify only one task exists in database
      const taskCount = await FollowUpTask.countDocuments({
        'relatedRecords.diagnosticCaseId': testDiagnosticCase._id,
      });
      expect(taskCount).toBe(1);
    });

    it('should set priority based on AI confidence score and red flags', async () => {
      // Test case with critical red flags
      const criticalCase = await DiagnosticCase.create({
        ...testDiagnosticCase.toObject(),
        _id: new mongoose.Types.ObjectId(),
        caseId: 'DX-CRITICAL-001',
        aiAnalysis: {
          ...testDiagnosticCase.aiAnalysis,
          redFlags: [
            {
              flag: 'Chest pain with shortness of breath',
              severity: 'critical',
              action: 'Immediate medical attention required',
            },
          ],
          confidenceScore: 0.9,
        },
      });

      const response = await request(app)
        .post(`/api/engagement-integration/diagnostic/${criticalCase._id}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      expect(response.body.data.followUpTask.priority).toBe('critical');
    });

    it('should set due date based on urgency', async () => {
      // Test case with immediate referral recommendation
      const urgentCase = await DiagnosticCase.create({
        ...testDiagnosticCase.toObject(),
        _id: new mongoose.Types.ObjectId(),
        caseId: 'DX-URGENT-001',
        aiAnalysis: {
          ...testDiagnosticCase.aiAnalysis,
          referralRecommendation: {
            recommended: true,
            urgency: 'immediate',
            specialty: 'emergency medicine',
            reason: 'Potential life-threatening condition',
          },
        },
      });

      const response = await request(app)
        .post(`/api/engagement-integration/diagnostic/${urgentCase._id}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      const followUpTask = response.body.data.followUpTask;
      const dueDate = new Date(followUpTask.dueDate);
      const now = new Date();
      const hoursDiff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Should be due within 2 hours for immediate cases
      expect(hoursDiff).toBeLessThanOrEqual(2);
      expect(hoursDiff).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent diagnostic case', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await request(app)
        .post(`/api/engagement-integration/diagnostic/${nonExistentId}/create-followup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(404);
    });

    it('should return 400 for invalid diagnostic case ID', async () => {
      await request(app)
        .post('/api/engagement-integration/diagnostic/invalid-id/create-followup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/engagement-integration/diagnostic/:diagnosticCaseId', () => {
    it('should get diagnostic case with engagement data', async () => {
      // Create follow-up task
      await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: testDiagnosticCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      // Create appointment
      const appointment = await Appointment.create({
        workplaceId: testUser.workplaceId,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'general_followup',
        title: 'Diagnostic Follow-up Appointment',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        relatedRecords: {
          diagnosticCaseId: testDiagnosticCase._id,
        },
        createdBy: testUser._id,
      });

      const response = await request(app)
        .get(`/api/engagement-integration/diagnostic/${testDiagnosticCase._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.diagnosticCase).toBeDefined();
      expect(response.body.data.followUpTasks).toHaveLength(1);
      expect(response.body.data.appointments).toHaveLength(1);

      const followUpTask = response.body.data.followUpTasks[0];
      expect(followUpTask.relatedRecords.diagnosticCaseId).toBe(testDiagnosticCase._id.toString());

      const appointmentData = response.body.data.appointments[0];
      expect(appointmentData.relatedRecords.diagnosticCaseId).toBe(testDiagnosticCase._id.toString());
    });

    it('should return empty arrays when no engagement data exists', async () => {
      const response = await request(app)
        .get(`/api/engagement-integration/diagnostic/${testDiagnosticCase._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.diagnosticCase).toBeDefined();
      expect(response.body.data.followUpTasks).toHaveLength(0);
      expect(response.body.data.appointments).toHaveLength(0);
    });

    it('should return 404 for non-existent diagnostic case', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/engagement-integration/diagnostic/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('EngagementIntegrationService - Diagnostic Methods', () => {
    describe('createFollowUpFromDiagnostic', () => {
      it('should calculate priority correctly based on AI analysis', () => {
        const service = engagementIntegrationService;

        // Test critical red flags
        const criticalCase = {
          aiAnalysis: {
            redFlags: [{ severity: 'critical' }],
            confidenceScore: 0.8,
          },
        } as any;

        const criticalPriority = (service as any).calculateDiagnosticFollowUpPriority(criticalCase);
        expect(criticalPriority).toBe('critical');

        // Test low confidence score
        const lowConfidenceCase = {
          aiAnalysis: {
            redFlags: [],
            confidenceScore: 0.5,
          },
        } as any;

        const urgentPriority = (service as any).calculateDiagnosticFollowUpPriority(lowConfidenceCase);
        expect(urgentPriority).toBe('urgent');

        // Test high confidence with no red flags
        const highConfidenceCase = {
          aiAnalysis: {
            redFlags: [],
            confidenceScore: 0.9,
          },
        } as any;

        const mediumPriority = (service as any).calculateDiagnosticFollowUpPriority(highConfidenceCase);
        expect(mediumPriority).toBe('medium');
      });

      it('should generate appropriate follow-up objectives', () => {
        const service = engagementIntegrationService;

        const objectives = (service as any).generateDiagnosticFollowUpObjectives(testDiagnosticCase);

        expect(objectives).toContain('Monitor patient\'s current condition and symptoms');
        expect(objectives).toContain('Monitor for red flag symptoms and complications');
        expect(objectives).toContain('Follow up on specialist referral and recommendations');
        expect(objectives).toContain('Determine next steps and ongoing care plan');
      });

      it('should generate descriptive follow-up title and description', () => {
        const service = engagementIntegrationService;

        const title = (service as any).generateDiagnosticFollowUpTitle(testDiagnosticCase);
        expect(title).toBe('Diagnostic Follow-up: Hypertension');

        const description = (service as any).generateDiagnosticFollowUpDescription(testDiagnosticCase);
        expect(description).toContain('Follow-up for diagnostic case DX-TEST-001');
        expect(description).toContain('Primary Diagnosis: Hypertension');
        expect(description).toContain('Red Flags Identified:');
        expect(description).toContain('AI Referral Recommendation:');
      });
    });

    describe('getDiagnosticWithEngagementData', () => {
      it('should retrieve all related engagement data', async () => {
        // Create follow-up task
        const { followUpTask } = await engagementIntegrationService.createFollowUpFromDiagnostic({
          diagnosticCaseId: testDiagnosticCase._id,
          patientId: testPatient._id,
          assignedTo: testUser._id,
          workplaceId: testUser.workplaceId,
          createdBy: testUser._id,
        });

        // Create appointment
        const appointment = await Appointment.create({
          workplaceId: testUser.workplaceId,
          patientId: testPatient._id,
          assignedTo: testUser._id,
          type: 'general_followup',
          title: 'Diagnostic Follow-up Appointment',
          scheduledDate: new Date(),
          scheduledTime: '10:00',
          duration: 30,
          timezone: 'Africa/Lagos',
          status: 'scheduled',
          relatedRecords: {
            diagnosticCaseId: testDiagnosticCase._id,
          },
          createdBy: testUser._id,
        });

        const result = await engagementIntegrationService.getDiagnosticWithEngagementData(
          testDiagnosticCase._id
        );

        expect(result.diagnosticCase).toBeDefined();
        expect(result.followUpTasks).toHaveLength(1);
        expect(result.appointments).toHaveLength(1);
        expect(result.followUpTasks[0]._id.toString()).toBe(followUpTask._id.toString());
        expect(result.appointments[0]._id.toString()).toBe(appointment._id.toString());
      });
    });
  });
});