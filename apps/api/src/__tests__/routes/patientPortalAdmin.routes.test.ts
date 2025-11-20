import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PatientUser from '../../models/PatientUser';
import FollowUpTask from '../../models/FollowUpTask';
import PatientPortalSettings from '../../models/PatientPortalSettings';
import User from '../../models/User';
import patientPortalAdminRoutes from '../../routes/patientPortalAdmin.routes';

// Mock authentication middleware
jest.mock('../../middlewares/auth', () => ({
  auth: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      _id: new mongoose.Types.ObjectId(),
      workplaceId: new mongoose.Types.ObjectId(),
      role: 'owner',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
    };
    next();
  }),
}));

// Mock workspace admin auth middleware
jest.mock('../../middlewares/workspaceAdminAuth', () => ({
  workspaceAdminAuth: jest.fn((req: any, res: any, next: any) => {
    req.workplaceId = req.user.workplaceId;
    next();
  }),
  auditWorkspaceAdminAction: jest.fn(() => (req: any, res: any, next: any) => next()),
  validateWorkspaceContext: jest.fn((req: any, res: any, next: any) => next()),
}));

// Mock rate limiter middleware
jest.mock('../../middlewares/rateLimiter', () => ({
  rateLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock notification service
jest.mock('../../services/notificationService', () => ({
  notificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
  },
}));

describe('Patient Portal Admin Routes', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let adminUserId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/workspace-admin/patient-portal', patientPortalAdminRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await PatientUser.deleteMany({});
    await FollowUpTask.deleteMany({});
    await PatientPortalSettings.deleteMany({});
    await User.deleteMany({});

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    adminUserId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();

    // Create test pharmacist
    await User.create({
      _id: pharmacistId,
      workplaceId,
      firstName: 'John',
      lastName: 'Pharmacist',
      email: 'pharmacist@test.com',
      role: 'pharmacist',
      passwordHash: 'hashedpassword',
      createdBy: adminUserId,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      // Create test patient users
      await PatientUser.create([
        {
          workplaceId,
          email: 'patient1@test.com',
          firstName: 'John',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'patient2@test.com',
          firstName: 'Jane',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'pending',
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get patient portal users successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should filter users by status', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/users?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].status).toBe('active');
    });

    it('should validate invalid status filter', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/users?status=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/users?page=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate date range', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/users?dateFrom=2024-01-31&dateTo=2024-01-01')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /users/:patientUserId/approve', () => {
    let pendingPatientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const pendingPatient = await PatientUser.create({
        workplaceId,
        email: 'pending@test.com',
        firstName: 'Pending',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'pending',
        createdBy: adminUserId,
      });
      pendingPatientId = pendingPatient._id;
    });

    it('should approve patient user successfully', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/users/${pendingPatientId}/approve`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.message).toBe('Patient user approved successfully');
    });

    it('should validate invalid patient user ID', async () => {
      const response = await request(app)
        .post('/api/workspace-admin/patient-portal/users/invalid-id/approve')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid patientUserId format');
    });
  });

  describe('POST /users/:patientUserId/suspend', () => {
    let activePatientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const activePatient = await PatientUser.create({
        workplaceId,
        email: 'active@test.com',
        firstName: 'Active',
        lastName: 'Patient',
        passwordHash: 'hashedpassword',
        status: 'active',
        createdBy: adminUserId,
      });
      activePatientId = activePatient._id;
    });

    it('should suspend patient user successfully', async () => {
      const reason = 'Violation of terms';
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/users/${activePatientId}/suspend`)
        .send({ reason })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('suspended');
      expect(response.body.message).toBe('Patient user suspended successfully');
    });

    it('should validate missing reason', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/users/${activePatientId}/suspend`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate reason length', async () => {
      const longReason = 'a'.repeat(501);
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/users/${activePatientId}/suspend`)
        .send({ reason: longReason })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /refill-requests', () => {
    beforeEach(async () => {
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();
      const patientUserId = new mongoose.Types.ObjectId();

      // Create refill requests
      await FollowUpTask.create([
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 1',
          description: 'Test refill',
          objectives: ['Process refill'],
          priority: 'medium',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med',
              currentRefillsRemaining: 3,
              requestedQuantity: 30,
              urgency: 'routine',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
        {
          workplaceId,
          patientId,
          assignedTo: pharmacistId,
          type: 'medication_refill_request',
          title: 'Refill Request 2',
          description: 'Urgent refill',
          objectives: ['Process urgent refill'],
          priority: 'high',
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          status: 'pending',
          trigger: {
            type: 'manual',
            sourceId: medicationId,
            sourceType: 'Medication',
            triggerDate: new Date(),
          },
          metadata: {
            refillRequest: {
              medicationId,
              medicationName: 'Test Med 2',
              currentRefillsRemaining: 1,
              requestedQuantity: 30,
              urgency: 'urgent',
              requestedBy: patientUserId,
              requestedAt: new Date(),
            },
          },
          createdBy: patientUserId,
        },
      ]);
    });

    it('should get refill requests successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/refill-requests')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should filter requests by status', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/refill-requests?status=pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
    });

    it('should filter requests by urgency', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/refill-requests?urgency=urgent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].metadata.refillRequest.urgency).toBe('urgent');
    });

    it('should validate invalid urgency filter', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/refill-requests?urgency=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /refill-requests/:requestId/approve', () => {
    let refillRequestId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();
      const patientUserId = new mongoose.Types.ObjectId();

      const refillRequest = await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request',
        description: 'Test refill',
        objectives: ['Process refill'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending',
        trigger: {
          type: 'manual',
          sourceId: medicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        metadata: {
          refillRequest: {
            medicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            requestedBy: patientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: patientUserId,
      });
      refillRequestId = refillRequest._id;
    });

    it('should approve refill request successfully', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/approve`)
        .send({
          pharmacistId: pharmacistId.toString(),
          approvedQuantity: 30,
          pharmacistNotes: 'Approved as requested',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.message).toBe('Refill request approved successfully');
    });

    it('should validate missing pharmacist ID', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/approve`)
        .send({
          approvedQuantity: 30,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate invalid approved quantity', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/approve`)
        .send({
          pharmacistId: pharmacistId.toString(),
          approvedQuantity: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate quantity exceeding limit', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/approve`)
        .send({
          pharmacistId: pharmacistId.toString(),
          approvedQuantity: 400,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /refill-requests/:requestId/deny', () => {
    let refillRequestId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const medicationId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();
      const patientUserId = new mongoose.Types.ObjectId();

      const refillRequest = await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_refill_request',
        title: 'Refill Request',
        description: 'Test refill',
        objectives: ['Process refill'],
        priority: 'medium',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending',
        trigger: {
          type: 'manual',
          sourceId: medicationId,
          sourceType: 'Medication',
          triggerDate: new Date(),
        },
        metadata: {
          refillRequest: {
            medicationId,
            medicationName: 'Test Med',
            currentRefillsRemaining: 3,
            requestedQuantity: 30,
            urgency: 'routine',
            requestedBy: patientUserId,
            requestedAt: new Date(),
          },
        },
        createdBy: patientUserId,
      });
      refillRequestId = refillRequest._id;
    });

    it('should deny refill request successfully', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/deny`)
        .send({
          pharmacistId: pharmacistId.toString(),
          denialReason: 'No refills remaining',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.message).toBe('Refill request denied successfully');
    });

    it('should validate missing denial reason', async () => {
      const response = await request(app)
        .post(`/api/workspace-admin/patient-portal/refill-requests/${refillRequestId}/deny`)
        .send({
          pharmacistId: pharmacistId.toString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /analytics', () => {
    beforeEach(async () => {
      // Create some test data
      await PatientUser.create([
        {
          workplaceId,
          email: 'active1@test.com',
          firstName: 'Active1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'pending@test.com',
          firstName: 'Pending',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'pending',
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get portal analytics successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userMetrics');
      expect(response.body.data).toHaveProperty('engagementMetrics');
      expect(response.body.data).toHaveProperty('operationalMetrics');
    });

    it('should handle date range parameters', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/analytics?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userMetrics');
    });

    it('should validate invalid date range', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/analytics?startDate=2024-01-31&endDate=2024-01-01')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /settings', () => {
    it('should get portal settings successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('workplaceId');
      expect(response.body.data).toHaveProperty('isEnabled');
      expect(response.body.data).toHaveProperty('allowedFeatures');
    });
  });

  describe('PUT /settings', () => {
    it('should update portal settings successfully', async () => {
      const settingsUpdate = {
        isEnabled: false,
        requireApproval: false,
        allowedFeatures: {
          messaging: true,
          appointments: false,
          medications: true,
          vitals: true,
          labResults: true,
          billing: false,
          educationalResources: true,
          healthRecords: true,
        },
      };

      const response = await request(app)
        .put('/api/workspace-admin/patient-portal/settings')
        .send(settingsUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(false);
      expect(response.body.data.requireApproval).toBe(false);
      expect(response.body.message).toBe('Portal settings updated successfully');
    });

    it('should validate invalid boolean field', async () => {
      const response = await request(app)
        .put('/api/workspace-admin/patient-portal/settings')
        .send({ isEnabled: 'not a boolean' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate invalid color format', async () => {
      const response = await request(app)
        .put('/api/workspace-admin/patient-portal/settings')
        .send({
          customization: {
            primaryColor: 'invalid-color',
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /settings/reset', () => {
    it('should reset portal settings successfully', async () => {
      const response = await request(app)
        .post('/api/workspace-admin/patient-portal/settings/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(true);
      expect(response.body.data.requireApproval).toBe(true);
      expect(response.body.message).toBe('Portal settings reset to defaults successfully');
    });
  });

  describe('GET /analytics/feature-usage', () => {
    beforeEach(async () => {
      // Create some active users for feature usage stats
      await PatientUser.create([
        {
          workplaceId,
          email: 'user1@test.com',
          firstName: 'User1',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
        {
          workplaceId,
          email: 'user2@test.com',
          firstName: 'User2',
          lastName: 'Patient',
          passwordHash: 'hashedpassword',
          status: 'active',
          createdBy: adminUserId,
        },
      ]);
    });

    it('should get feature usage statistics successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/analytics/feature-usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalFeatureUsage');
      expect(response.body.data).toHaveProperty('featureUsageBreakdown');
      expect(response.body.data).toHaveProperty('mostPopularFeatures');
      expect(response.body.data).toHaveProperty('leastUsedFeatures');
    });
  });

  describe('GET /analytics/communication', () => {
    it('should get communication metrics successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/analytics/communication')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalConversations');
      expect(response.body.data).toHaveProperty('activeConversations');
      expect(response.body.data).toHaveProperty('totalMessages');
      expect(response.body.data).toHaveProperty('messagesByType');
    });
  });

  describe('GET /health', () => {
    it('should return health check successfully', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Patient Portal Admin API is healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/workspace-admin/patient-portal/non-existent')
        .expect(404);
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/workspace-admin/patient-portal/settings')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});