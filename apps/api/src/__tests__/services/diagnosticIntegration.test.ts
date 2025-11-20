import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { engagementIntegrationService } from '../../services/EngagementIntegrationService';
import DiagnosticCase from '../../models/DiagnosticCase';
import FollowUpTask from '../../models/FollowUpTask';
import User from '../../models/User';
import Patient from '../../models/Patient';

describe('Diagnostic Integration Service Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testPatient: any;
  let testDiagnosticCase: any;

  beforeAll(async () => {
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
      passwordHash: 'hashedpassword123',
      role: 'pharmacist',
      workplaceId: new mongoose.Types.ObjectId(),
      currentPlanId: new mongoose.Types.ObjectId(),
      isEmailVerified: true,
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'TEST001',
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
        recommendedTests: [],
        therapeuticOptions: [],
        redFlags: [
          {
            flag: 'Severe hypertension',
            severity: 'high',
            action: 'Monitor closely',
          },
        ],
        referralRecommendation: {
          recommended: true,
          urgency: 'routine',
          specialty: 'cardiology',
          reason: 'New onset hypertension',
        },
        disclaimer: 'AI-generated analysis',
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
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Patient.deleteMany({});
    await DiagnosticCase.deleteMany({});
    await FollowUpTask.deleteMany({});
  });

  describe('createFollowUpFromDiagnostic', () => {
    it('should create follow-up task from diagnostic case', async () => {
      const result = await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: testDiagnosticCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      expect(result.followUpTask).toBeDefined();
      expect(result.diagnosticCase).toBeDefined();
      expect(result.followUpTask.title).toContain('Diagnostic Follow-up: Hypertension');
      expect(result.followUpTask.priority).toBe('urgent'); // Based on red flags and confidence score
      expect(result.followUpTask.status).toBe('pending');
      expect(result.followUpTask.relatedRecords.diagnosticCaseId.toString()).toBe(
        testDiagnosticCase._id.toString()
      );

      // Verify task was created in database
      const dbTask = await FollowUpTask.findById(result.followUpTask._id);
      expect(dbTask).toBeTruthy();
      expect(dbTask!.trigger.type).toBe('system_rule');
      expect(dbTask!.trigger.sourceType).toBe('DiagnosticCase');
    });

    it('should return existing follow-up task if already exists', async () => {
      // Create initial follow-up task
      const firstResult = await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: testDiagnosticCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      // Try to create another one
      const secondResult = await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: testDiagnosticCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      expect(firstResult.followUpTask._id.toString()).toBe(
        secondResult.followUpTask._id.toString()
      );

      // Verify only one task exists in database
      const taskCount = await FollowUpTask.countDocuments({
        'relatedRecords.diagnosticCaseId': testDiagnosticCase._id,
      });
      expect(taskCount).toBe(1);
    });

    it('should set priority based on red flag severity', async () => {
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

      const result = await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: criticalCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      expect(result.followUpTask.priority).toBe('critical');
    });
  });

  describe('getDiagnosticWithEngagementData', () => {
    it('should retrieve diagnostic case with engagement data', async () => {
      // Create follow-up task
      await engagementIntegrationService.createFollowUpFromDiagnostic({
        diagnosticCaseId: testDiagnosticCase._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testUser.workplaceId,
        createdBy: testUser._id,
      });

      const result = await engagementIntegrationService.getDiagnosticWithEngagementData(
        testDiagnosticCase._id
      );

      expect(result.diagnosticCase).toBeDefined();
      expect(result.followUpTasks).toHaveLength(1);
      expect(result.appointments).toHaveLength(0);
      expect(result.followUpTasks[0].relatedRecords.diagnosticCaseId.toString()).toBe(
        testDiagnosticCase._id.toString()
      );
    });

    it('should return empty arrays when no engagement data exists', async () => {
      const result = await engagementIntegrationService.getDiagnosticWithEngagementData(
        testDiagnosticCase._id
      );

      expect(result.diagnosticCase).toBeDefined();
      expect(result.followUpTasks).toHaveLength(0);
      expect(result.appointments).toHaveLength(0);
    });
  });

  describe('Priority calculation', () => {
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
  });
});