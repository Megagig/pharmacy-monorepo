import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import followUpRoutes from '../../routes/followUpRoutes';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Patient from '../../models/Patient';
import jwt from 'jsonwebtoken';

// Mock the controller functions
jest.mock('../../controllers/followUpController', () => ({
  createFollowUp: jest.fn((req, res) => res.status(201).json({ success: true, data: { followUpTask: {} } })),
  getFollowUps: jest.fn((req, res) => res.json({ success: true, data: { tasks: [], summary: {} } })),
  getFollowUp: jest.fn((req, res) => res.json({ success: true, data: { task: {} } })),
  updateFollowUp: jest.fn((req, res) => res.json({ success: true, data: { task: {} } })),
  completeFollowUp: jest.fn((req, res) => res.json({ success: true, data: { task: {} } })),
  convertToAppointment: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getOverdueFollowUps: jest.fn((req, res) => res.json({ success: true, data: { tasks: [], summary: {} } })),
  escalateFollowUp: jest.fn((req, res) => res.json({ success: true, data: { task: {} } })),
  getPatientFollowUps: jest.fn((req, res) => res.json({ success: true, data: { tasks: [] } })),
}));

// Mock middleware
jest.mock('../../middlewares/auth', () => ({
  auth: jest.fn((req, res, next) => {
    req.user = {
      _id: new mongoose.Types.ObjectId(),
      email: 'test@pharmacist.com',
      role: 'pharmacist',
      workplaceId: new mongoose.Types.ObjectId(),
      workplaceRole: 'Pharmacist',
    };
    req.workspaceContext = {
      workspace: { _id: req.user.workplaceId },
      user: req.user,
    };
    next();
  }),
}));

jest.mock('../../middlewares/rbac', () => ({
  requireDynamicPermission: jest.fn(() => (req, res, next) => next()),
}));

describe('Follow-up Routes', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testWorkplace: any;
  let testPatient: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/follow-ups', followUpRoutes);

    // Create test data
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      address: 'Test Address',
      phone: '+2341234567890',
      email: 'test@pharmacy.com',
      licenseNumber: 'TEST123',
      subscriptionStatus: 'active',
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'test@pharmacist.com',
      passwordHash: 'hashedpassword',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      workplaceRole: 'Pharmacist',
      status: 'active',
    });

    testPatient = await Patient.create({
      firstName: 'Test',
      lastName: 'Patient',
      dob: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2341234567890',
      email: 'patient@test.com',
      workplaceId: testWorkplace._id,
      createdBy: testUser._id,
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, workplaceId: testWorkplace._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST /api/follow-ups', () => {
    it('should create a new follow-up task with valid data', async () => {
      const followUpData = {
        patientId: testPatient._id.toString(),
        type: 'medication_start_followup',
        title: 'Follow up on new medication',
        description: 'Check for side effects',
        priority: 'high',
        dueDate: new Date().toISOString(),
        trigger: {
          type: 'medication_start',
          triggerDate: new Date().toISOString(),
        },
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(followUpData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('followUpTask');
    });

    it('should return 400 for invalid follow-up data', async () => {
      const invalidData = {
        patientId: 'invalid-id',
        type: 'invalid-type',
      };

      const response = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/follow-ups', () => {
    it('should get follow-up tasks list', async () => {
      const response = await request(app)
        .get('/api/follow-ups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should filter follow-ups by status', async () => {
      const response = await request(app)
        .get('/api/follow-ups?status=pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter follow-ups by priority', async () => {
      const response = await request(app)
        .get('/api/follow-ups?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/follow-ups/overdue', () => {
    it('should get overdue follow-up tasks', async () => {
      const response = await request(app)
        .get('/api/follow-ups/overdue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
      expect(response.body.data).toHaveProperty('summary');
    });
  });

  describe('GET /api/follow-ups/:id', () => {
    it('should get single follow-up task', async () => {
      const followUpId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/follow-ups/${followUpId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('task');
    });
  });

  describe('PUT /api/follow-ups/:id', () => {
    it('should update follow-up task', async () => {
      const followUpId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        priority: 'urgent',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/follow-ups/${followUpId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/follow-ups/:id/complete', () => {
    it('should complete follow-up task', async () => {
      const followUpId = new mongoose.Types.ObjectId().toString();
      const outcomeData = {
        outcome: {
          status: 'successful',
          notes: 'Patient is doing well',
          nextActions: ['Schedule next check-up'],
        },
      };

      const response = await request(app)
        .post(`/api/follow-ups/${followUpId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(outcomeData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/follow-ups/:id/convert-to-appointment', () => {
    it('should convert follow-up to appointment', async () => {
      const followUpId = new mongoose.Types.ObjectId().toString();
      const appointmentData = {
        scheduledDate: new Date().toISOString(),
        scheduledTime: '10:00',
        duration: 30,
        type: 'general_followup',
      };

      const response = await request(app)
        .post(`/api/follow-ups/${followUpId}/convert-to-appointment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/follow-ups/:id/escalate', () => {
    it('should escalate follow-up priority', async () => {
      const followUpId = new mongoose.Types.ObjectId().toString();
      const escalateData = {
        newPriority: 'critical',
        reason: 'Patient condition worsening',
      };

      const response = await request(app)
        .post(`/api/follow-ups/${followUpId}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(escalateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/follow-ups/patient/:patientId', () => {
    it('should get patient follow-up tasks', async () => {
      const response = await request(app)
        .get(`/api/follow-ups/patient/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tasks');
    });
  });
});
