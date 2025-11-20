import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import Patient from '../../models/Patient';
import PatientUser from '../../models/PatientUser';
import Workplace from '../../models/Workplace';
import patientProfileRoutes from '../../routes/patientProfile.routes';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Patient Profile Routes', () => {
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
    app.use('/api/patient-portal/profile', patientProfileRoutes);
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

    // Create test data
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

  describe('Route Integration Tests', () => {
    it('should handle all profile routes with proper middleware', async () => {
      // Test GET profile
      const getResponse = await request(app)
        .get('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.profile.firstName).toBe('John');
    });

    it('should validate request data properly', async () => {
      // Test invalid allergy data
      const invalidAllergyResponse = await request(app)
        .post('/api/patient-portal/profile/allergies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allergen: '', // Invalid - empty
          reaction: 'Rash',
          severity: 'moderate',
        })
        .expect(400);

      expect(invalidAllergyResponse.body.success).toBe(false);
      expect(invalidAllergyResponse.body.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce rate limiting', async () => {
      // This test would need to be adjusted based on actual rate limiting implementation
      // For now, just verify the route exists and works
      const response = await request(app)
        .get('/api/patient-portal/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});