import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import PatientUser from '../../../models/PatientUser';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import Medication from '../../../models/Medication';
import AdherenceTracking from '../../../models/AdherenceTracking';
import FollowUpTask from '../../../models/FollowUpTask';
import { generateToken } from '../../../utils/token';

describe('Patient Medications Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let testPharmacist: any;
  let testMedication: any;
  let testAdherence: any;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'admin@testpharmacy.com',
      phone: '+2348012345678',
      address: '123 Test Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Lagos Island',
      licenseNumber: 'PCN-TEST-001',
      isActive: true,
      subscriptionStatus: 'active'
    });

    // Create test pharmacist
    testPharmacist = await User.create({
      firstName: 'Dr. Jane',
      lastName: 'Pharmacist',
      email: 'pharmacist@testpharmacy.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isEmailVerified: true,
      status: 'active'
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348087654321',
      email: 'john.doe@example.com',
      address: '456 Patient Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Ikeja',
      workplaceId: testWorkplace._id
    });

    // Create test patient user
    testPatientUser = await PatientUser.create({
      email: 'john.doe@example.com',
      password: 'password123',
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      status: 'active',
      isEmailVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        appointmentReminders: true,
        medicationReminders: true,
        refillReminders: true
      }
    });

    // Create test medication
    testMedication = await Medication.create({
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      prescribedBy: testPharmacist._id,
      drugName: 'Lisinopril',
      strength: '10mg',
      dosageForm: 'tablet',
      route: 'oral',
      frequency: 'once daily',
      duration: '30 days',
      quantity: 30,
      instructions: 'Take with food in the morning',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      refillsRemaining: 2,
      totalRefills: 3,
      indication: 'Hypertension',
      sideEffects: ['Dizziness', 'Dry cough'],
      interactions: ['Potassium supplements'],
      monitoringParameters: ['Blood pressure', 'Kidney function'],
      cost: 5000,
      insuranceCovered: true,
      createdBy: testPharmacist._id
    });

    // Create adherence tracking
    testAdherence = await AdherenceTracking.create({
      patientId: testPatient._id,
      medicationId: testMedication._id,
      workplaceId: testWorkplace._id,
      adherenceScore: 85,
      missedDoses: 3,
      totalDoses: 20,
      lastUpdated: new Date(),
      adherenceHistory: [
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          taken: true,
          timeOfDay: 'morning'
        },
        {
          date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          taken: false,
          timeOfDay: 'morning'
        }
      ]
    });

    // Generate patient token
    patientToken = generateToken(testPatientUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
    await Medication.deleteMany({});
    await AdherenceTracking.deleteMany({});
    await FollowUpTask.deleteMany({});
  });

  describe('Current Medications', () => {
    describe('GET /api/patient-portal/medications/current', () => {
      it('should return current active medications', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/medications/current')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].drugName).toBe('Lisinopril');
        expect(response.body.data[0].status).toBe('active');
        expect(response.body.data[0].refillsRemaining).toBe(2);
      });

      it('should reject unauthenticated requests', async () => {
        await request(testApp)
          .get('/api/patient-portal/medications/current')
          .expect(401);
      });
    });

    describe('GET /api/patient-portal/medications/:medicationId', () => {
      it('should return detailed medication information', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/medications/${testMedication._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.drugName).toBe('Lisinopril');
        expect(response.body.data.instructions).toBe('Take with food in the morning');
      });

      it('should return 404 for non-existent medication', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/medications/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });
    });
  });

  describe('Refill Requests', () => {
    describe('POST /api/patient-portal/medications/:medicationId/refill', () => {
      it('should create refill request for eligible medication', async () => {
        const refillData = {
          requestedQuantity: 30,
          notes: 'Running low on medication',
          urgency: 'normal'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/medications/${testMedication._id}/refill`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(refillData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.medicationId).toBe(testMedication._id.toString());
        expect(response.body.data.requestedQuantity).toBe(30);
        expect(response.body.data.status).toBe('pending');
      });

      it('should reject refill request when no refills remaining', async () => {
        // Update medication to have no refills remaining
        await Medication.findByIdAndUpdate(testMedication._id, {
          refillsRemaining: 0
        });

        const refillData = {
          requestedQuantity: 30,
          notes: 'Need refill'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/medications/${testMedication._id}/refill`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(refillData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('refills remaining');
      });
    });
  });

  describe('Adherence Tracking', () => {
    describe('GET /api/patient-portal/medications/adherence', () => {
      it('should return adherence data for patient medications', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/medications/adherence')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        
        const adherenceData = response.body.data[0];
        expect(adherenceData.medicationId).toBe(testMedication._id.toString());
        expect(adherenceData.adherenceScore).toBe(85);
      });
    });

    describe('POST /api/patient-portal/medications/:medicationId/adherence', () => {
      it('should update adherence for medication', async () => {
        const adherenceData = {
          taken: true,
          timeOfDay: 'evening',
          notes: 'Took with dinner'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/medications/${testMedication._id}/adherence`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(adherenceData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should apply rate limiting to medication endpoints', async () => {
      // Make multiple requests quickly
      const requests = Array(15).fill(null).map(() => 
        request(testApp)
          .get('/api/patient-portal/medications/current')
          .set('Cookie', `patientToken=${patientToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent access to other patients medication data', async () => {
      // Create another patient
      const otherPatient = await Patient.create({
        firstName: 'Other',
        lastName: 'Patient',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'female',
        phone: '+2348087654999',
        email: 'other@example.com',
        workplaceId: testWorkplace._id
      });

      const otherPatientUser = await PatientUser.create({
        email: 'other@example.com',
        password: 'password123',
        patientId: otherPatient._id,
        workplaceId: testWorkplace._id,
        status: 'active',
        isEmailVerified: true
      });

      const otherToken = generateToken(otherPatientUser._id);

      // Try to access original patient's medications with other patient's token
      const response = await request(testApp)
        .get('/api/patient-portal/medications/current')
        .set('Cookie', `patientToken=${otherToken}`)
        .expect(200);

      // Should return empty array (no medications for other patient)
      expect(response.body.data).toHaveLength(0);
    });
  });
});