import mongoose from 'mongoose';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import FollowUpTask from '../../models/FollowUpTask';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { engagementIntegrationService } from '../../services/EngagementIntegrationService';
import { createTestUserData, createTestWorkplaceData, createTestPatientData } from '../utils/testHelpers';

describe('Clinical Intervention Integration Service', () => {
  let testWorkplace: any;
  let testUser: any;
  let testPatient: any;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pharma-care-test');
    }

    // Create test workplace
    const workplaceData = createTestWorkplaceData();
    testWorkplace = new Workplace(workplaceData);
    await testWorkplace.save();
    
    // Create test user (pharmacist)
    const userData = createTestUserData({
      workplaceId: testWorkplace._id,
      role: 'pharmacist',
      email: 'test.pharmacist@example.com',
    });
    testUser = new User(userData);
    await testUser.save();
    
    // Create test patient
    const patientData = createTestPatientData(testWorkplace._id.toString(), {
      email: 'test.patient@example.com',
    });
    testPatient = new Patient(patientData);
    await testPatient.save();
  });

  afterAll(async () => {
    // Clean up test data
    await ClinicalIntervention.deleteMany({});
    await FollowUpTask.deleteMany({});
    await Patient.deleteMany({});
    await User.deleteMany({});
    await Workplace.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up before each test
    await ClinicalIntervention.deleteMany({});
    await FollowUpTask.deleteMany({});
  });

  describe('createFollowUpFromIntervention', () => {
    it('should create follow-up task from clinical intervention', async () => {
      // Create a clinical intervention that requires follow-up
      const intervention = new ClinicalIntervention({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        interventionNumber: 'CI-202410-0001',
        category: 'drug_therapy_problem',
        priority: 'high',
        issueDescription: 'Patient experiencing adverse drug reaction to medication',
        identifiedDate: new Date(),
        identifiedBy: testUser._id,
        strategies: [{
          type: 'medication_review',
          description: 'Review current medication regimen',
          rationale: 'Identify potential causes of ADR',
          expectedOutcome: 'Reduced adverse effects',
          priority: 'primary',
        }],
        status: 'identified',
        followUp: {
          required: true,
          scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        },
        startedAt: new Date(),
        createdBy: testUser._id,
      });
      await intervention.save();

      const result = await engagementIntegrationService.createFollowUpFromIntervention({
        interventionId: intervention._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        workplaceId: testWorkplace._id,
        createdBy: testUser._id,
      });

      expect(result.followUpTask).toBeDefined();
      expect(result.intervention).toBeDefined();

      // Verify follow-up task was created
      const followUpTask = result.followUpTask;
      expect(followUpTask.patientId.toString()).toBe(testPatient._id.toString());
      expect(followUpTask.assignedTo.toString()).toBe(testUser._id.toString());
      expect(followUpTask.type).toBe('general_followup');
      expect(followUpTask.priority).toBe('urgent'); // High intervention priority maps to urgent follow-up
      expect(followUpTask.relatedRecords.clinicalInterventionId.toString()).toBe(intervention._id.toString());
      expect(followUpTask.trigger.type).toBe('system_rule');
      expect(followUpTask.trigger.sourceId.toString()).toBe(intervention._id.toString());
      expect(followUpTask.trigger.sourceType).toBe('ClinicalIntervention');

      // Verify follow-up task exists in database
      const dbFollowUpTask = await FollowUpTask.findById(followUpTask._id);
      expect(dbFollowUpTask).toBeTruthy();
      expect(dbFollowUpTask?.title).toContain('Drug Therapy Problem Follow-up');
    });

    it('should map intervention priority to follow-up priority correctly', async () => {
      const testCases = [
        { interventionPriority: 'critical', expectedFollowUpPriority: 'critical' },
        { interventionPriority: 'high', expectedFollowUpPriority: 'urgent' },
        { interventionPriority: 'medium', expectedFollowUpPriority: 'high' },
        { interventionPriority: 'low', expectedFollowUpPriority: 'medium' },
      ];

      for (const testCase of testCases) {
        const intervention = new ClinicalIntervention({
          workplaceId: testWorkplace._id,
          patientId: testPatient._id,
          interventionNumber: `CI-202410-${Math.random().toString().substr(2, 4)}`,
          category: 'drug_therapy_problem',
          priority: testCase.interventionPriority as any,
          issueDescription: 'Test intervention',
          identifiedDate: new Date(),
          identifiedBy: testUser._id,
          strategies: [{
            type: 'medication_review',
            description: 'Test strategy',
            rationale: 'Test rationale',
            expectedOutcome: 'Test outcome',
            priority: 'primary',
          }],
          status: 'identified',
          followUp: {
            required: true,
          },
          startedAt: new Date(),
          createdBy: testUser._id,
        });
        await intervention.save();

        const result = await engagementIntegrationService.createFollowUpFromIntervention({
          interventionId: intervention._id,
          patientId: testPatient._id,
          assignedTo: testUser._id,
          workplaceId: testWorkplace._id,
          createdBy: testUser._id,
        });

        expect(result.followUpTask.priority).toBe(testCase.expectedFollowUpPriority);

        // Clean up
        await ClinicalIntervention.findByIdAndDelete(intervention._id);
        await FollowUpTask.findByIdAndDelete(result.followUpTask._id);
      }
    });

    it('should not create follow-up if intervention does not require it', async () => {
      const intervention = new ClinicalIntervention({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        interventionNumber: 'CI-202410-0002',
        category: 'drug_therapy_problem',
        priority: 'medium',
        issueDescription: 'Test intervention without follow-up',
        identifiedDate: new Date(),
        identifiedBy: testUser._id,
        strategies: [{
          type: 'medication_review',
          description: 'Test strategy',
          rationale: 'Test rationale',
          expectedOutcome: 'Test outcome',
          priority: 'primary',
        }],
        status: 'identified',
        followUp: {
          required: false,
        },
        startedAt: new Date(),
        createdBy: testUser._id,
      });
      await intervention.save();

      await expect(
        engagementIntegrationService.createFollowUpFromIntervention({
          interventionId: intervention._id,
          patientId: testPatient._id,
          assignedTo: testUser._id,
          workplaceId: testWorkplace._id,
          createdBy: testUser._id,
        })
      ).rejects.toThrow('Follow-up is not required');
    });
  });

  describe('updateInterventionFromFollowUp', () => {
    it('should update intervention status when follow-up is completed', async () => {
      // Create intervention
      const intervention = new ClinicalIntervention({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        interventionNumber: 'CI-202410-0004',
        category: 'medication_nonadherence',
        priority: 'medium',
        issueDescription: 'Patient not taking medication as prescribed',
        identifiedDate: new Date(),
        identifiedBy: testUser._id,
        strategies: [{
          type: 'patient_counseling',
          description: 'Counsel patient on medication importance',
          rationale: 'Improve adherence',
          expectedOutcome: 'Better medication compliance',
          priority: 'primary',
        }],
        status: 'in_progress',
        followUp: {
          required: true,
        },
        startedAt: new Date(),
        createdBy: testUser._id,
      });
      await intervention.save();

      // Create follow-up task
      const followUpTask = new FollowUpTask({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'general_followup',
        title: 'Medication Adherence Follow-up',
        description: 'Follow-up on patient medication adherence',
        objectives: ['Assess adherence improvement', 'Identify barriers'],
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'completed',
        completedAt: new Date(),
        completedBy: testUser._id,
        outcome: {
          status: 'successful',
          notes: 'Patient adherence improved significantly',
          nextActions: ['Continue current regimen', 'Schedule next review in 3 months'],
          appointmentCreated: false,
        },
        trigger: {
          type: 'system_rule',
          sourceId: intervention._id,
          sourceType: 'ClinicalIntervention',
          triggerDate: new Date(),
        },
        relatedRecords: {
          clinicalInterventionId: intervention._id,
        },
        createdBy: testUser._id,
      });
      await followUpTask.save();

      const result = await engagementIntegrationService.updateInterventionFromFollowUp(
        followUpTask._id,
        testUser._id
      );

      expect(result.intervention).toBeDefined();
      expect(result.followUpTask).toBeDefined();

      // Verify intervention was updated
      const updatedIntervention = await ClinicalIntervention.findById(intervention._id);
      expect(updatedIntervention?.followUp.completedDate).toBeTruthy();
      expect(updatedIntervention?.followUp.notes).toBe('Patient adherence improved significantly');
      expect(updatedIntervention?.status).toBe('implemented'); // Should advance from in_progress to implemented
    });
  });

  describe('getInterventionWithEngagementData', () => {
    it('should get intervention with linked follow-up tasks and appointments', async () => {
      // Create intervention
      const intervention = new ClinicalIntervention({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        interventionNumber: 'CI-202410-0006',
        category: 'drug_interaction',
        priority: 'high',
        issueDescription: 'Potential drug interaction detected',
        identifiedDate: new Date(),
        identifiedBy: testUser._id,
        strategies: [{
          type: 'medication_review',
          description: 'Review medication timing',
          rationale: 'Minimize interaction risk',
          expectedOutcome: 'Reduced interaction potential',
          priority: 'primary',
        }],
        status: 'in_progress',
        followUp: {
          required: true,
        },
        startedAt: new Date(),
        createdBy: testUser._id,
      });
      await intervention.save();

      // Create linked follow-up task
      const followUpTask = new FollowUpTask({
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'general_followup',
        title: 'Drug Interaction Follow-up',
        description: 'Monitor for drug interaction symptoms',
        objectives: ['Assess for interaction symptoms', 'Verify timing separation'],
        priority: 'urgent',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'pending',
        trigger: {
          type: 'system_rule',
          sourceId: intervention._id,
          sourceType: 'ClinicalIntervention',
          triggerDate: new Date(),
        },
        relatedRecords: {
          clinicalInterventionId: intervention._id,
        },
        createdBy: testUser._id,
      });
      await followUpTask.save();

      const result = await engagementIntegrationService.getInterventionWithEngagementData(intervention._id);

      expect(result.intervention).toBeDefined();
      expect(result.followUpTasks).toBeDefined();
      expect(result.appointments).toBeDefined();

      // Verify linked follow-up task is included
      expect(result.followUpTasks).toHaveLength(1);
      expect(result.followUpTasks[0]._id.toString()).toBe(followUpTask._id.toString());
      expect(result.followUpTasks[0].relatedRecords.clinicalInterventionId.toString()).toBe(intervention._id.toString());
    });
  });
});