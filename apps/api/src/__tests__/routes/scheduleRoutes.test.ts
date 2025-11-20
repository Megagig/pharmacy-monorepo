import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import scheduleRoutes from '../../routes/scheduleRoutes';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import jwt from 'jsonwebtoken';

// Mock the controller functions
jest.mock('../../controllers/scheduleController', () => ({
  getPharmacistSchedule: jest.fn((req, res) => res.json({ success: true, data: { schedule: {}, upcomingTimeOff: [], capacityStats: {} } })),
  updatePharmacistSchedule: jest.fn((req, res) => res.json({ success: true, data: { schedule: {} } })),
  requestTimeOff: jest.fn((req, res) => res.status(201).json({ success: true, data: { timeOff: {}, affectedAppointments: [] } })),
  updateTimeOffStatus: jest.fn((req, res) => res.json({ success: true, data: { timeOff: {} } })),
  getCapacityReport: jest.fn((req, res) => res.json({ success: true, data: { overall: {}, recommendations: [] } })),
  getAllPharmacistSchedules: jest.fn((req, res) => res.json({ success: true, data: { schedules: [] } })),
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

describe('Schedule Routes', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testWorkplace: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/schedules', scheduleRoutes);

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

  describe('GET /api/schedules/pharmacist/:pharmacistId', () => {
    it('should get pharmacist schedule', async () => {
      const pharmacistId = testUser._id.toString();
      const response = await request(app)
        .get(`/api/schedules/pharmacist/${pharmacistId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedule');
      expect(response.body.data).toHaveProperty('upcomingTimeOff');
      expect(response.body.data).toHaveProperty('capacityStats');
    });
  });

  describe('PUT /api/schedules/pharmacist/:pharmacistId', () => {
    it('should update pharmacist schedule', async () => {
      const pharmacistId = testUser._id.toString();
      const scheduleData = {
        workingHours: [
          {
            dayOfWeek: 1,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
              },
            ],
          },
        ],
        appointmentPreferences: {
          maxAppointmentsPerDay: 10,
          defaultDuration: 30,
          appointmentTypes: ['mtm_session', 'health_check'],
        },
      };

      const response = await request(app)
        .put(`/api/schedules/pharmacist/${pharmacistId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedule');
    });
  });

  describe('POST /api/schedules/pharmacist/:pharmacistId/time-off', () => {
    it('should request time off', async () => {
      const pharmacistId = testUser._id.toString();
      const timeOffData = {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Vacation',
        type: 'vacation',
      };

      const response = await request(app)
        .post(`/api/schedules/pharmacist/${pharmacistId}/time-off`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(timeOffData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeOff');
      expect(response.body.data).toHaveProperty('affectedAppointments');
    });

    it('should return 400 for invalid time-off data', async () => {
      const pharmacistId = testUser._id.toString();
      const invalidData = {
        startDate: 'invalid-date',
        type: 'invalid-type',
      };

      const response = await request(app)
        .post(`/api/schedules/pharmacist/${pharmacistId}/time-off`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/schedules/pharmacist/:pharmacistId/time-off/:timeOffId', () => {
    it('should update time-off status', async () => {
      const pharmacistId = testUser._id.toString();
      const timeOffId = new mongoose.Types.ObjectId().toString();
      const statusData = {
        status: 'approved',
      };

      const response = await request(app)
        .patch(`/api/schedules/pharmacist/${pharmacistId}/time-off/${timeOffId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeOff');
    });
  });

  describe('GET /api/schedules/capacity', () => {
    it('should get capacity report', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/schedules/capacity?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    it('should return 400 for missing required query params', async () => {
      const response = await request(app)
        .get('/api/schedules/capacity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/schedules/pharmacists', () => {
    it('should get all pharmacist schedules', async () => {
      const response = await request(app)
        .get('/api/schedules/pharmacists')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedules');
    });

    it('should filter schedules by location', async () => {
      const response = await request(app)
        .get('/api/schedules/pharmacists?locationId=location-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
