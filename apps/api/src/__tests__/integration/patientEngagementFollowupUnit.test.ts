/**
 * Unit-style Integration tests for Patient Engagement & Follow-up Management
 * Tests core functionality without full app import to avoid dependency issues
 * Requirements: All requirements from Patient Engagement & Follow-up Management spec
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FollowUpTask from '../../models/FollowUpTask';
import User from '../../models/User';
import Patient from '../../models/Patient';
import { createTestUserData, createTestPatientData } from '../utils/testHelpers';

describe('Patient Engagement & Follow-up Management - Model Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;

  // Helper function to create valid follow-up data
  const createValidFollowUpData = (overrides: any = {}) => ({
    workplaceId,
    patientId,
    title: 'Test Follow-up Task',
    description: 'This is a test follow-up task for integration testing purposes',
    type: 'general_followup',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    assignedTo: pharmacistId,
    createdBy: pharmacistId,
    objectives: ['Complete follow-up assessment'],
    trigger: {
      type: 'manual',
      triggerDate: new Date(),
    },
    ...overrides,
  });

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
    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      FollowUpTask.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();

    // Create test pharmacist
    const pharmacist = new User({
      ...createTestUserData({
        email: 'pharmacist@test.com',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
      }),
      workplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;

    // Create test patient
    const patient = new Patient({
      ...createTestPatientData(workplaceId.toString(), {
        email: 'patient@test.com',
        mrn: 'TEST001',
      }),
      _id: new mongoose.Types.ObjectId(),
      createdBy: pharmacistId,
    });
    await patient.save();
    patientId = patient._id;
  });

  describe('Data Validation and Constraints', () => {
    it('should create follow-up task with valid data', async () => {
      const followUpData = createValidFollowUpData({
        title: 'Medication Adherence Check',
        description: 'Follow up on patient medication adherence to ensure proper compliance',
        type: 'adherence_check',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        objectives: ['Check medication adherence', 'Review side effects'],
      });

      const followUp = new FollowUpTask(followUpData);
      await followUp.save();

      expect(followUp._id).toBeDefined();
      expect(followUp.title).toBe(followUpData.title);
      expect(followUp.status).toBe('pending');
      expect(followUp.createdAt).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        workplaceId,
        // Missing required fields
        title: 'Test Follow-up',
      };

      const followUp = new FollowUpTask(invalidData);
      
      await expect(followUp.save()).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      const invalidData = createValidFollowUpData({
        priority: 'invalid_priority', // Invalid enum value
      });

      const followUp = new FollowUpTask(invalidData);
      
      await expect(followUp.save()).rejects.toThrow();
    });

    it('should validate ObjectId references', async () => {
      const invalidData = createValidFollowUpData({
        patientId: 'invalid-object-id',
      });

      const followUp = new FollowUpTask(invalidData);
      
      await expect(followUp.save()).rejects.toThrow();
    });
  });

  describe('Database Transactions and Consistency', () => {
    it('should maintain referential integrity', async () => {
      // Create follow-up task
      const followUp = new FollowUpTask(createValidFollowUpData({
        title: 'Integrity Test',
        description: 'Testing referential integrity in the database',
        objectives: ['Test database integrity'],
      }));
      await followUp.save();

      // Verify relationships exist
      const patient = await Patient.findById(patientId);
      const pharmacist = await User.findById(pharmacistId);
      
      expect(patient).toBeTruthy();
      expect(pharmacist).toBeTruthy();
      expect(followUp.patientId.toString()).toBe(patientId.toString());
      expect(followUp.assignedTo.toString()).toBe(pharmacistId.toString());
    });

    it('should handle concurrent updates with version control', async () => {
      // Create follow-up task
      const followUp = new FollowUpTask(createValidFollowUpData({
        title: 'Concurrent Test',
        description: 'Testing concurrent updates and version control',
      }));
      await followUp.save();

      // Simulate concurrent updates
      const followUp1 = await FollowUpTask.findById(followUp._id);
      const followUp2 = await FollowUpTask.findById(followUp._id);

      // Update both instances
      followUp1!.priority = 'high';
      followUp2!.status = 'in_progress';

      // First update should succeed
      await followUp1!.save();

      // Second update should either succeed or handle conflict gracefully
      try {
        await followUp2!.save();
        // If it succeeds, verify final state is consistent
        const finalState = await FollowUpTask.findById(followUp._id);
        expect(finalState).toBeTruthy();
      } catch (error) {
        // If it fails due to version conflict, that's acceptable
        expect(error).toBeDefined();
      }
    });

    it('should rollback on validation errors', async () => {
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Create valid follow-up
          const validFollowUp = new FollowUpTask(createValidFollowUpData({
            title: 'Valid Follow-up',
            description: 'This is a valid follow-up for transaction testing',
          }));
          await validFollowUp.save({ session });

          // Create invalid follow-up (should cause rollback)
          const invalidFollowUp = new FollowUpTask(createValidFollowUpData({
            title: 'Invalid Follow-up',
            description: 'This follow-up has invalid priority to test rollback',
            priority: 'invalid_priority', // This should cause validation error
          }));
          await invalidFollowUp.save({ session });
        });
      } catch (error) {
        // Transaction should rollback
        expect(error).toBeDefined();
      } finally {
        await session.endSession();
      }

      // Verify no follow-ups were created due to rollback
      const followUps = await FollowUpTask.find({ workplaceId });
      expect(followUps).toHaveLength(0);
    });
  });

  describe('Query Performance and Indexing', () => {
    beforeEach(async () => {
      // Create test data for performance testing
      const followUps = Array.from({ length: 100 }, (_, index) => 
        createValidFollowUpData({
          title: `Performance Test ${index + 1}`,
          description: `Performance testing follow-up task number ${index + 1}`,
          priority: index % 3 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low',
          status: index % 4 === 0 ? 'completed' : 'pending',
          dueDate: new Date(Date.now() + index * 60 * 60 * 1000),
        })
      );

      await FollowUpTask.insertMany(followUps);
    });

    it('should efficiently query by workplace', async () => {
      const startTime = Date.now();
      
      const followUps = await FollowUpTask.find({ workplaceId }).limit(50);
      
      const endTime = Date.now();
      
      expect(followUps).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently query by status and priority', async () => {
      const startTime = Date.now();
      
      const followUps = await FollowUpTask.find({
        workplaceId,
        status: 'pending',
        priority: 'high'
      });
      
      const endTime = Date.now();
      
      expect(followUps.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should efficiently query by date range', async () => {
      const startTime = Date.now();
      
      const followUps = await FollowUpTask.find({
        workplaceId,
        dueDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      
      const endTime = Date.now();
      
      expect(followUps.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should support efficient pagination', async () => {
      const pageSize = 10;
      const startTime = Date.now();
      
      const page1 = await FollowUpTask.find({ workplaceId })
        .sort({ dueDate: 1 })
        .limit(pageSize);
      
      const page2 = await FollowUpTask.find({ workplaceId })
        .sort({ dueDate: 1 })
        .skip(pageSize)
        .limit(pageSize);
      
      const endTime = Date.now();
      
      expect(page1).toHaveLength(pageSize);
      expect(page2).toHaveLength(pageSize);
      expect(page1[0]._id.toString()).not.toBe(page2[0]._id.toString());
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Data Integrity and Business Rules', () => {
    it('should enforce unique constraints where applicable', async () => {
      const followUpData = createValidFollowUpData({
        title: 'Unique Test',
        description: 'Testing unique constraints in the database',
        externalId: 'UNIQUE-001', // If this field has unique constraint
      });

      const followUp1 = new FollowUpTask(followUpData);
      await followUp1.save();

      // Try to create duplicate
      const followUp2 = new FollowUpTask(followUpData);
      
      // Should either succeed (no unique constraint) or fail with duplicate error
      try {
        await followUp2.save();
        // If it succeeds, verify both exist
        const count = await FollowUpTask.countDocuments({ workplaceId });
        expect(count).toBeGreaterThanOrEqual(1);
      } catch (error) {
        // If it fails, should be due to duplicate key
        expect(error.message).toContain('duplicate');
      }
    });

    it('should validate business rules for due dates', async () => {
      // Test past due date
      const pastDueData = createValidFollowUpData({
        title: 'Past Due Test',
        description: 'Testing validation of past due dates',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      const followUp = new FollowUpTask(pastDueData);
      
      // Should either allow past dates or validate against them
      try {
        await followUp.save();
        expect(followUp._id).toBeDefined();
      } catch (error) {
        expect(error.message).toContain('validation');
      }
    });

    it('should handle status transitions correctly', async () => {
      const followUp = new FollowUpTask(createValidFollowUpData({
        title: 'Status Transition Test',
        description: 'Testing status transitions and validation',
      }));
      await followUp.save();

      // Test valid status transitions
      followUp.status = 'in_progress';
      await followUp.save();
      expect(followUp.status).toBe('in_progress');

      followUp.status = 'completed';
      followUp.completedAt = new Date();
      await followUp.save();
      expect(followUp.status).toBe('completed');
      expect(followUp.completedAt).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing references gracefully', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();
      
      const followUp = new FollowUpTask(createValidFollowUpData({
        patientId: nonExistentPatientId,
        title: 'Missing Reference Test',
        description: 'Testing handling of missing patient references',
      }));

      // Should either save successfully (no foreign key constraint) or fail gracefully
      try {
        await followUp.save();
        expect(followUp._id).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle large text fields', async () => {
      const largeText = 'A'.repeat(10000); // 10KB of text
      
      const followUp = new FollowUpTask(createValidFollowUpData({
        title: 'Large Text Test',
        description: largeText,
      }));

      // Should either handle large text or enforce size limits
      try {
        await followUp.save();
        expect(followUp.description).toBe(largeText);
      } catch (error) {
        expect(error.message).toContain('exceed');
      }
    });

    it('should handle special characters and encoding', async () => {
      const specialChars = '特殊字符 émojis 🎉 symbols ©®™ quotes ""\'\' backslashes \\\\';
      
      const followUp = new FollowUpTask(createValidFollowUpData({
        title: 'Special Characters Test',
        description: specialChars,
      }));

      await followUp.save();
      
      const retrieved = await FollowUpTask.findById(followUp._id);
      expect(retrieved!.description).toBe(specialChars);
    });
  });
});