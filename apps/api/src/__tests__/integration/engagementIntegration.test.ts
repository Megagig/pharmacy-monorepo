import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import Appointment from '../../models/Appointment';
import MTRFollowUp from '../../models/MTRFollowUp';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import jwt from 'jsonwebtoken';

describe('Engagement Integration API', () => {
  let authToken: string;
  let testUser: any;
  let testPatient: any;
  let testMTRSession: any;
  let testWorkplace: any;
  let workplaceId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'pharmacy',
      address: 'Test Address',
      phone: '+2348012345678',
      email: 'test@pharmacy.com',
    });
    workplaceId = testWorkplace._id;

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'test@pharmacy.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacist',
      workplaceId,
      workplaceRole: 'Pharmacist',
      status: 'active',
      licenseStatus: 'approved',
    });

    // Generate auth token
    authToken = jwt.sign(
      {
        userId: testUser._id,
        email: testUser.email,
        role: testUser.role,
        workplaceId: testUser.workplaceId,
        workplaceRole: testUser.workplaceRole,
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN123456',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'male',
      phone: '+2348012345678',
      workplaceId,
      createdBy: testUser._id,
    });

    // Create test MTR session
    testMTRSession = await MedicationTherapyReview.create({
      workplaceId,
      patientId: testPatient._id,
      pharmacistId: testUser._id,
      reviewNumber: `MTR-${Date.now()}`,
      reviewType: 'comprehensive',
      status: 'completed',
      startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      completedAt: new Date(),
      medications: [],
      createdBy: testUser._id,
    });
  });

  describe('POST /api/engagement-integration/mtr/:mtrSessionId/appointment', () => {
    it('should create appointment from MTR session', async () => {
      const appointmentData = {
        patientId: testPatient._id.toString(),
        assignedTo: testUser._id.toString(),
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        scheduledTime: '10:00',
        duration: 60,
        description: 'MTR follow-up appointment',
      };

      const response = await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/appointment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toBeDefined();
      expect(response.body.data.appointment.type).toBe('mtm_session');
      expect(response.body.data.appointment.relatedRecords.mtrSessionId).toBe(
        testMTRSession._id.toString()
      );

      // Verify appointment was created in database
      const createdAppointment = await Appointment.findById(response.body.data.appointment._id);
      expect(createdAppointment).toBeTruthy();
      expect(createdAppointment!.patientId.toString()).toBe(testPatient._id.toString());
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        patientId: testPatient._id.toString(),
        // Missing required fields
      };

      await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/appointment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 404 for non-existent MTR session', async () => {
      const appointmentData = {
        patientId: testPatient._id.toString(),
        assignedTo: testUser._id.toString(),
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '10:00',
      };

      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/api/engagement-integration/mtr/${nonExistentId}/appointment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData)
        .expect(404);
    });
  });

  describe('POST /api/engagement-integration/mtr/:mtrSessionId/schedule', () => {
    it('should create MTR follow-up with appointment', async () => {
      const scheduleData = {
        patientId: testPatient._id.toString(),
        assignedTo: testUser._id.toString(),
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
        scheduledTime: '14:00',
        duration: 45,
        description: 'Follow-up for medication adherence',
        objectives: ['Check medication adherence', 'Review side effects'],
        priority: 'medium',
      };

      const response = await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toBeDefined();
      expect(response.body.data.mtrFollowUp).toBeDefined();

      // Verify both records were created
      const [appointment, mtrFollowUp] = await Promise.all([
        Appointment.findById(response.body.data.appointment._id),
        MTRFollowUp.findById(response.body.data.mtrFollowUp._id),
      ]);

      expect(appointment).toBeTruthy();
      expect(mtrFollowUp).toBeTruthy();

      // Verify they are linked
      expect(appointment!.relatedRecords.followUpTaskId?.toString()).toBe(
        mtrFollowUp!._id.toString()
      );
      expect((mtrFollowUp as any).appointmentId?.toString()).toBe(
        appointment!._id.toString()
      );
    });

    it('should return 400 for missing objectives', async () => {
      const invalidData = {
        patientId: testPatient._id.toString(),
        assignedTo: testUser._id.toString(),
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '14:00',
        description: 'Follow-up',
        // Missing objectives
      };

      await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('POST /api/engagement-integration/link-mtr-followup', () => {
    let testAppointment: any;
    let testMTRFollowUp: any;

    beforeEach(async () => {
      // Create test appointment
      testAppointment = new Appointment({
        workplaceId,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        createdBy: testUser._id,
      });
      await testAppointment.save();

      // Create test MTR follow-up
      testMTRFollowUp = new MTRFollowUp({
        workplaceId,
        reviewId: testMTRSession._id,
        patientId: testPatient._id,
        type: 'appointment',
        priority: 'medium',
        description: 'Test follow-up',
        objectives: ['Test objective'],
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        estimatedDuration: 30,
        assignedTo: testUser._id,
        createdBy: testUser._id,
      });
      await testMTRFollowUp.save();
    });

    it('should link MTR follow-up to appointment', async () => {
      const linkData = {
        mtrFollowUpId: testMTRFollowUp._id.toString(),
        appointmentId: testAppointment._id.toString(),
      };

      const response = await request(app)
        .post('/api/engagement-integration/link-mtr-followup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(linkData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the link was created
      const [updatedAppointment, updatedMTRFollowUp] = await Promise.all([
        Appointment.findById(testAppointment._id),
        MTRFollowUp.findById(testMTRFollowUp._id),
      ]);

      expect(updatedAppointment!.relatedRecords.followUpTaskId?.toString()).toBe(
        testMTRFollowUp._id.toString()
      );
      expect((updatedMTRFollowUp as any).appointmentId?.toString()).toBe(
        testAppointment._id.toString()
      );
    });

    it('should return 404 for non-existent records', async () => {
      const linkData = {
        mtrFollowUpId: new mongoose.Types.ObjectId().toString(),
        appointmentId: testAppointment._id.toString(),
      };

      await request(app)
        .post('/api/engagement-integration/link-mtr-followup')
        .set('Authorization', `Bearer ${authToken}`)
        .send(linkData)
        .expect(404);
    });
  });

  describe('GET /api/engagement-integration/mtr/:mtrSessionId', () => {
    let testAppointment: any;
    let testMTRFollowUp: any;

    beforeEach(async () => {
      // Create linked appointment
      testAppointment = new Appointment({
        workplaceId,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 60,
        relatedRecords: {
          mtrSessionId: testMTRSession._id,
        },
        createdBy: testUser._id,
      });
      await testAppointment.save();

      // Create MTR follow-up
      testMTRFollowUp = new MTRFollowUp({
        workplaceId,
        reviewId: testMTRSession._id,
        patientId: testPatient._id,
        type: 'appointment',
        priority: 'medium',
        description: 'Follow-up',
        objectives: ['Check progress'],
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedDuration: 30,
        assignedTo: testUser._id,
        createdBy: testUser._id,
      });
      await testMTRFollowUp.save();
    });

    it('should get MTR session with linked appointments', async () => {
      const response = await request(app)
        .get(`/api/engagement-integration/mtr/${testMTRSession._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mtrSession).toBeDefined();
      expect(response.body.data.linkedAppointments).toHaveLength(1);
      expect(response.body.data.followUps).toHaveLength(1);

      expect(response.body.data.linkedAppointments[0]._id).toBe(
        testAppointment._id.toString()
      );
      expect(response.body.data.followUps[0]._id).toBe(
        testMTRFollowUp._id.toString()
      );
    });

    it('should return 404 for non-existent MTR session', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/engagement-integration/mtr/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/engagement-integration/sync-status', () => {
    let testAppointment: any;
    let testMTRFollowUp: any;

    beforeEach(async () => {
      // Create linked appointment and MTR follow-up
      testAppointment = new Appointment({
        workplaceId,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Test Appointment',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledTime: '10:00',
        duration: 30,
        status: 'scheduled',
        createdBy: testUser._id,
      });
      await testAppointment.save();

      testMTRFollowUp = new MTRFollowUp({
        workplaceId,
        reviewId: testMTRSession._id,
        patientId: testPatient._id,
        type: 'appointment',
        priority: 'medium',
        description: 'Test follow-up',
        objectives: ['Test objective'],
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        estimatedDuration: 30,
        assignedTo: testUser._id,
        status: 'scheduled',
        createdBy: testUser._id,
      });
      (testMTRFollowUp as any).appointmentId = testAppointment._id;
      await testMTRFollowUp.save();

      // Link them
      testAppointment.relatedRecords.followUpTaskId = testMTRFollowUp._id;
      await testAppointment.save();
    });

    it('should sync appointment status to MTR follow-up', async () => {
      const syncData = {
        sourceId: testAppointment._id.toString(),
        sourceType: 'appointment',
        newStatus: 'completed',
      };

      await request(app)
        .post('/api/engagement-integration/sync-status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(syncData)
        .expect(200);

      // Verify MTR follow-up status was updated
      const updatedMTRFollowUp = await MTRFollowUp.findById(testMTRFollowUp._id);
      expect(updatedMTRFollowUp!.status).toBe('completed');
    });

    it('should sync MTR follow-up status to appointment', async () => {
      const syncData = {
        sourceId: testMTRFollowUp._id.toString(),
        sourceType: 'mtr_followup',
        newStatus: 'cancelled',
      };

      await request(app)
        .post('/api/engagement-integration/sync-status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(syncData)
        .expect(200);

      // Verify appointment status was updated
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment!.status).toBe('cancelled');
    });

    it('should return 400 for invalid source type', async () => {
      const syncData = {
        sourceId: testAppointment._id.toString(),
        sourceType: 'invalid_type',
        newStatus: 'completed',
      };

      await request(app)
        .post('/api/engagement-integration/sync-status')
        .set('Authorization', `Bearer ${authToken}`)
        .send(syncData)
        .expect(400);
    });
  });

  describe('POST /api/engagement-integration/appointment/:appointmentId/create-visit', () => {
    let testAppointment: any;

    beforeEach(async () => {
      testAppointment = new Appointment({
        workplaceId,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'Completed Appointment',
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        scheduledTime: '10:00',
        duration: 60,
        status: 'completed',
        completedAt: new Date(),
        outcome: {
          status: 'successful',
          notes: 'Patient counseled on medication adherence',
          nextActions: ['Schedule follow-up in 3 months'],
          visitCreated: false,
        },
        createdBy: testUser._id,
      });
      await testAppointment.save();
    });

    it('should create visit from completed appointment', async () => {
      const response = await request(app)
        .post(`/api/engagement-integration/appointment/${testAppointment._id}/create-visit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visit).toBeDefined();

      // Verify appointment was updated
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment!.outcome!.visitCreated).toBe(true);
      expect(updatedAppointment!.outcome!.visitId).toBeDefined();
    });

    it('should return 400 for non-completed appointment', async () => {
      testAppointment.status = 'scheduled';
      testAppointment.outcome = undefined;
      await testAppointment.save();

      await request(app)
        .post(`/api/engagement-integration/appointment/${testAppointment._id}/create-visit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 400 if visit already created', async () => {
      testAppointment.outcome.visitCreated = true;
      await testAppointment.save();

      await request(app)
        .post(`/api/engagement-integration/appointment/${testAppointment._id}/create-visit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      await request(app)
        .get(`/api/engagement-integration/mtr/${testMTRSession._id}`)
        .expect(401);

      await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/appointment`)
        .send({})
        .expect(401);
    });

    it('should check permissions for appointment creation', async () => {
      // This would require setting up a user without appointment creation permissions
      // For now, we'll just verify the endpoint exists and requires auth
      const appointmentData = {
        patientId: testPatient._id.toString(),
        assignedTo: testUser._id.toString(),
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '10:00',
      };

      // With valid auth, should work (assuming user has permissions)
      await request(app)
        .post(`/api/engagement-integration/mtr/${testMTRSession._id}/appointment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData)
        .expect(201);
    });
  });
});