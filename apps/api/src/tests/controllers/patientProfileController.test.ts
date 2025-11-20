import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import Patient from '../../models/Patient';
import PatientUser from '../../models/PatientUser';
import Workplace from '../../models/Workplace';
import { PatientProfileController } from '../../controllers/patientProfileController';
import { patientAuth } from '../../middlewares/patientPortalAuth';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('PatientProfileController', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientUserId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let authToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Setup routes
    app.get('/api/patient-portal/profile', patientAuth, PatientProfileController.getProfile);
    app.put('/api/patient-portal/profile', patientAuth, PatientProfileController.updateProfile);
    app.post('/api/patient-portal/profile/allergies', patientAuth, PatientProfileController.addAllergy);
    app.put('/api/patient-portal/profile/allergies/:allergyId', patientAuth, PatientProfileController.updateAllergy);
    app.delete('/api/patient-portal/profile/allergies/:allergyId', patientAuth, PatientProfileController.removeAllergy);
    app.post('/api/patient-portal/profile/conditions', patientAuth, PatientProfileController.addChronicCondition);
    app.put('/api/patient-portal/profile/conditions/:conditionId', patientAuth, PatientProfileController.updateChronicCondition);
    app.delete('/api/patient-portal/profile/conditions/:conditionId', patientAuth, PatientProfileController.removeChronicCondition);
    app.post('/api/patient-portal/profile/emergency-contacts', patientAuth, PatientProfileController.addEmergencyContact);
    app.put('/api/patient-portal/profile/emergency-contacts/:contactId', patientAuth, PatientProfileController.updateEmergencyContact);
    app.delete('/api/patient-portal/profile/emergency-contacts/:contactId', patientAuth, PatientProfileController.removeEmergencyContact);
    app.put('/api/patient-portal/profile/insurance', patientAuth, PatientProfileController.updateInsuranceInfo);
    app.post('/api/patient-portal/profile/vitals', patientAuth, PatientProfileController.logVitals);
    app.get('/api/patient-portal/profile/vitals', patientAuth, PatientProfileController.getVitalsHistory);
    app.get('/api/patient-portal/profile/vitals/latest', patientAuth, PatientProfileController.getLatestVitals);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Patient.deleteMany({});
    await PatientUser.deleteMany({});
    await Workplace.deleteMany({});

    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+2341234567890',
      address: 'Test Address',
      subscriptionStatus: 'active',
      isActive: true,
      createdBy: new mongoose.Types.ObjectId(),
    });
    workplaceId = workplace._id;

    // Create test patient record
    const patient = await Patient.create({
      workplaceId,
      mrn: 'TEST001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2341234567890',
      allergies: [],
      chronicConditions: [],
      enhancedEmergencyContacts: [],
      insuranceInfo: {},
      patientLoggedVitals: [],
      createdBy: new mongoose.Types.ObjectId(),
    });
    patientId = patient._id;

    // Create test patient user
    const patientUser = await PatientUser.create({
      workplaceId,
      email: 'john.doe@example.com',
      passwordHash: 'hashedpassword',
      firstName: 'John',
      lastName: 'Doe',
      status: 'active',
      patientId,
      createdBy: new mongoose.Types.ObjectId(),
    });
    patientUserId = patientUser._id;

    // Create auth token
    authToken = jwt.sign(
      {
        patientUserId: patientUserId.toString(),
        workspaceId: workplaceId.toString(),
        email: 'john.doe@example.com',
        type: 'patient',
      },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  describe('GET /api/patient-portal/profile', () => {
    it('should get patient profile successfully', async () => {
      const response = await request(app)
        .get('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.firstName).toBe('John');
      expect(response.body.data.profile.lastName).toBe('Doe');
      expect(response.body.data.profile.mrn).toBe('TEST001');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/patient-portal/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    it('should return 404 for non-existent patient', async () => {
      // Create patient user without linked patient
      const unlinkedUser = await PatientUser.create({
        workplaceId,
        email: 'unlinked@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'Unlinked',
        lastName: 'User',
        status: 'active',
        createdBy: new mongoose.Types.ObjectId(),
      });

      const unlinkedToken = jwt.sign(
        {
          patientUserId: unlinkedUser._id.toString(),
          workspaceId: workplaceId.toString(),
          email: 'unlinked@example.com',
          type: 'patient',
        },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${unlinkedToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('PUT /api/patient-portal/profile', () => {
    it('should update patient profile successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+2349876543210',
        weightKg: 70,
      };

      const response = await request(app)
        .put('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.firstName).toBe('Jane');
      expect(response.body.data.profile.lastName).toBe('Smith');
      expect(response.body.data.profile.phone).toBe('+2349876543210');
      expect(response.body.data.profile.weightKg).toBe(70);
    });

    it('should return validation error for invalid data', async () => {
      const updateData = {
        email: 'invalid-email',
      };

      const response = await request(app)
        .put('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/patient-portal/profile/allergies', () => {
    it('should add allergy successfully', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
        notes: 'Developed after first dose',
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.allergy.allergen).toBe('Penicillin');
      expect(response.body.data.allergy.severity).toBe('moderate');
    });

    it('should return validation error for missing required fields', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        // Missing reaction and severity
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should prevent duplicate allergies', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
      };

      // Add first allergy
      await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData)
        .expect(201);

      // Try to add duplicate
      const response = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('DUPLICATE_ALLERGY');
    });
  });

  describe('PUT /api/patient-portal/profile/allergies/:allergyId', () => {
    let allergyId: string;

    beforeEach(async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData);

      allergyId = response.body.data.allergy._id;
    });

    it('should update allergy successfully', async () => {
      const updates = {
        severity: 'severe',
        notes: 'Updated notes',
      };

      const response = await request(app)
        .put(`/api/patient-portal/profile/allergies/${allergyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.allergy.severity).toBe('severe');
      expect(response.body.data.allergy.notes).toBe('Updated notes');
    });

    it('should return 400 for invalid allergy ID', async () => {
      const response = await request(app)
        .put('/api/patient-portal/profile/allergies/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ severity: 'severe' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_ALLERGY_ID');
    });
  });

  describe('DELETE /api/patient-portal/profile/allergies/:allergyId', () => {
    let allergyId: string;

    beforeEach(async () => {
      const allergyData = {
        allergen: 'Penicillin',
        reaction: 'Skin rash',
        severity: 'moderate',
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergyData);

      allergyId = response.body.data.allergy._id;
    });

    it('should remove allergy successfully', async () => {
      const response = await request(app)
        .delete(`/api/patient-portal/profile/allergies/${allergyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Allergy removed successfully');
    });
  });

  describe('POST /api/patient-portal/profile/conditions', () => {
    it('should add chronic condition successfully', async () => {
      const conditionData = {
        condition: 'Diabetes Type 2',
        diagnosedDate: '2020-01-01',
        managementPlan: 'Diet and exercise',
        status: 'active',
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/conditions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conditionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.condition.condition).toBe('Diabetes Type 2');
      expect(response.body.data.condition.status).toBe('active');
    });

    it('should return validation error for missing required fields', async () => {
      const conditionData = {
        condition: 'Diabetes Type 2',
        // Missing diagnosedDate
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/conditions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conditionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('POST /api/patient-portal/profile/emergency-contacts', () => {
    it('should add emergency contact successfully', async () => {
      const contactData = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+2349876543210',
        email: 'jane@example.com',
        isPrimary: true,
        priority: 1,
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/emergency-contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contactData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.name).toBe('Jane Doe');
      expect(response.body.data.contact.isPrimary).toBe(true);
    });

    it('should return validation error for missing required fields', async () => {
      const contactData = {
        name: 'Jane Doe',
        // Missing relationship, phone, and priority
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/emergency-contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contactData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('PUT /api/patient-portal/profile/insurance', () => {
    it('should update insurance information successfully', async () => {
      const insuranceData = {
        provider: 'NHIS',
        policyNumber: 'POL123456',
        expiryDate: '2025-12-31',
        coverageDetails: 'Full coverage',
        copayAmount: 1000,
        isActive: true,
      };

      const response = await request(app)
        .put('/api/patient-portal/profile/insurance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(insuranceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insuranceInfo.provider).toBe('NHIS');
      expect(response.body.data.insuranceInfo.policyNumber).toBe('POL123456');
    });
  });

  describe('POST /api/patient-portal/profile/vitals', () => {
    it('should log vitals successfully', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 36.5,
        weight: 70,
        glucose: 95,
        oxygenSaturation: 98,
        notes: 'Feeling good',
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/vitals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vitalsData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals.bloodPressure.systolic).toBe(120);
      expect(response.body.data.vitals.heartRate).toBe(72);
      expect(response.body.data.vitals.source).toBe('patient_portal');
    });

    it('should return validation error for invalid vitals', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 400, diastolic: 80 }, // Invalid systolic
      };

      const response = await request(app)
        .post('/api/patient-portal/profile/vitals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vitalsData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/patient-portal/profile/vitals', () => {
    beforeEach(async () => {
      // Add some vitals entries
      const vitalsEntries = [
        {
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          notes: 'Entry 1',
        },
        {
          bloodPressure: { systolic: 125, diastolic: 85 },
          heartRate: 75,
          notes: 'Entry 2',
        },
      ];

      for (const vitals of vitalsEntries) {
        await request(app)
          .post('/api/patient-portal/profile/vitals')
          .set('Authorization', `Bearer ${authToken}`)
          .send(vitals);
      }
    });

    it('should get vitals history successfully', async () => {
      const response = await request(app)
        .get('/api/patient-portal/profile/vitals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/patient-portal/profile/vitals?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals).toHaveLength(1);
    });
  });

  describe('GET /api/patient-portal/profile/vitals/latest', () => {
    it('should get latest vitals successfully', async () => {
      const vitalsData = {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        notes: 'Latest entry',
      };

      await request(app)
        .post('/api/patient-portal/profile/vitals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vitalsData);

      const response = await request(app)
        .get('/api/patient-portal/profile/vitals/latest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals.notes).toBe('Latest entry');
      expect(response.body.data.vitals.heartRate).toBe(72);
    });

    it('should return null when no vitals exist', async () => {
      const response = await request(app)
        .get('/api/patient-portal/profile/vitals/latest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vitals).toBeNull();
    });
  });
});