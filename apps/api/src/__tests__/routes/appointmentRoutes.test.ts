import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import appointmentRoutes from '../../routes/appointmentRoutes';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import jwt from 'jsonwebtoken';

// Mock the controller functions
jest.mock('../../controllers/appointmentController', () => ({
  createAppointment: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getCalendarAppointments: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getAppointments: jest.fn((req, res) => res.json({ success: true, data: { appointments: [] } })),
  getAppointment: jest.fn((req, res) => res.json({ success: true, data: { appointment: {} } })),
  updateAppointment: jest.fn((req, res) => res.json({ success: true, data: { appointment: {} } })),
  updateAppointmentStatus: jest.fn((req, res) => res.json({ success: true, data: { appointment: {} } })),
  rescheduleAppointment: jest.fn((req, res) => res.json({ success: true, data: { appointment: {} } })),
  cancelAppointment: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getAvailableSlots: jest.fn((req, res) => res.json({ success: true, data: { slots: [] } })),
  getPatientAppointments: jest.fn((req, res) => res.json({ success: true, data: { appointments: [] } })),
  getUpcomingAppointments: jest.fn((req, res) => res.json({ success: true, data: { appointments: [] } })),
  confirmAppointment: jest.fn((req, res) => res.json({ success: true, data: { appointment: {} } })),
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

describe('Appointment Routes', () => {
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
    app.use('/api/appointments', appointmentRoutes);

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

  describe('POST /api/appointments', () => {
    it('should create a new appointment with valid data', async () => {
      const appointmentData = {
        patientId: testPatient._id.toString(),
        type: 'mtm_session',
        scheduledDate: new Date().toISOString(),
        scheduledTime: '10:00',
        duration: 30,
        description: 'Test appointment',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid appointment data', async () => {
      const invalidData = {
        patientId: 'invalid-id',
        type: 'invalid-type',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/appointments', () => {
    it('should get appointments list', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('appointments');
    });

    it('should filter appointments by status', async () => {
      const response = await request(app)
        .get('/api/appointments?status=scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/appointments/calendar', () => {
    it('should get calendar view', async () => {
      const response = await request(app)
        .get('/api/appointments/calendar?view=week')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/appointments/available-slots', () => {
    it('should get available slots', async () => {
      const date = new Date().toISOString();
      const response = await request(app)
        .get(`/api/appointments/available-slots?date=${date}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('slots');
    });
  });

  describe('GET /api/appointments/:id', () => {
    it('should get single appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/appointments/:id', () => {
    it('should update appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        scheduledTime: '14:00',
        duration: 45,
      };

      const response = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/appointments/:id/status', () => {
    it('should update appointment status', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const statusData = {
        status: 'confirmed',
      };

      const response = await request(app)
        .patch(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/appointments/:id/reschedule', () => {
    it('should reschedule appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const rescheduleData = {
        newDate: new Date().toISOString(),
        newTime: '15:00',
        reason: 'Patient requested change',
      };

      const response = await request(app)
        .post(`/api/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(rescheduleData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/appointments/:id/cancel', () => {
    it('should cancel appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const cancelData = {
        reason: 'Patient no longer needs service',
      };

      const response = await request(app)
        .post(`/api/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/appointments/:id/confirm', () => {
    it('should confirm appointment', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/api/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/appointments/upcoming', () => {
    it('should get upcoming appointments', async () => {
      const response = await request(app)
        .get('/api/appointments/upcoming?days=7')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/appointments/patient/:patientId', () => {
    it('should get patient appointments', async () => {
      const response = await request(app)
        .get(`/api/appointments/patient/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
