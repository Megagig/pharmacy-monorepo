import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import reportRoutes from '../../routes/reportRoutes';
import { auth } from '../../middlewares/auth';
import { checkPermission } from '../../middlewares/rbac';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import { subDays } from 'date-fns';

// Mock middleware
jest.mock('../../middlewares/auth');
jest.mock('../../middlewares/rbac');
jest.mock('../../services/ReportEmailService');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;

describe('Report Controller', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/reports', reportRoutes);

    // Mock authentication middleware
    mockAuth.mockImplementation((req: any, res: any, next: any) => {
      req.user = {
        userId: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
        role: 'pharmacist'
      };
      next();
    });

    // Mock permission middleware
    mockCheckPermission.mockImplementation((permission: string) => {
      return (req: any, res: any, next: any) => {
        next();
      };
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Appointment.deleteMany({});
    await FollowUpTask.deleteMany({});

    // Create test data
    await Appointment.create({
      workplaceId,
      patientId,
      assignedTo: pharmacistId,
      type: 'mtm_session',
      title: 'Test Appointment',
      scheduledDate: subDays(new Date(), 1),
      scheduledTime: '10:00',
      duration: 30,
      status: 'completed',
      outcome: {
        status: 'successful',
        notes: 'Test notes'
      },
      createdBy: pharmacistId
    });
  });

  describe('POST /api/reports/appointments/generate', () => {
    it('should generate PDF appointment report', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'pdf',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('appointment-report');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    it('should generate Excel appointment report', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'excel',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('appointment-report');
    });

    it('should generate CSV appointment report', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'csv',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('appointment-report');
    });

    it('should filter by pharmacist ID', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          pharmacistId: pharmacistId.toString(),
          format: 'csv'
        });

      expect(response.status).toBe(200);
    });

    it('should filter by appointment type', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          appointmentType: 'mtm_session',
          format: 'csv'
        });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid date range', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          startDate: new Date().toISOString(),
          endDate: subDays(new Date(), 7).toISOString(),
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Start date cannot be after end date');
    });

    it('should use default date range when not provided', async () => {
      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          format: 'pdf'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/reports/follow-ups/generate', () => {
    beforeEach(async () => {
      await FollowUpTask.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'medication_start_followup',
        title: 'Test Follow-up',
        description: 'Test description',
        objectives: ['Test objective'],
        priority: 'medium',
        dueDate: new Date(),
        status: 'pending',
        trigger: {
          type: 'manual',
          triggerDate: new Date()
        },
        createdBy: pharmacistId
      });
    });

    it('should generate PDF follow-up report', async () => {
      const response = await request(app)
        .post('/api/reports/follow-ups/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'pdf',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('followup-report');
    });

    it('should generate CSV follow-up report', async () => {
      const response = await request(app)
        .post('/api/reports/follow-ups/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'csv'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
    });
  });

  describe('POST /api/reports/reminders/generate', () => {
    beforeEach(async () => {
      // Create appointment with reminders
      await Appointment.create({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Appointment with Reminders',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '14:00',
        duration: 30,
        status: 'completed',
        reminders: [
          {
            type: 'email',
            scheduledFor: subDays(new Date(), 2),
            sent: true,
            sentAt: subDays(new Date(), 2),
            deliveryStatus: 'delivered'
          }
        ],
        createdBy: pharmacistId
      });
    });

    it('should generate PDF reminder report', async () => {
      const response = await request(app)
        .post('/api/reports/reminders/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'pdf',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('reminder-report');
    });
  });

  describe('POST /api/reports/capacity/generate', () => {
    it('should generate PDF capacity report', async () => {
      const response = await request(app)
        .post('/api/reports/capacity/generate')
        .send({
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'pdf',
          includeDetails: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('capacity-report');
    });
  });

  describe('POST /api/reports/email', () => {
    it('should send report via email', async () => {
      const response = await request(app)
        .post('/api/reports/email')
        .send({
          reportType: 'appointment',
          recipientEmails: ['test@example.com'],
          startDate: subDays(new Date(), 7).toISOString(),
          endDate: new Date().toISOString(),
          format: 'pdf',
          subject: 'Test Report',
          message: 'This is a test report'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe('appointment');
      expect(response.body.data.recipients).toBe(1);
    });

    it('should return 400 for missing report type', async () => {
      const response = await request(app)
        .post('/api/reports/email')
        .send({
          recipientEmails: ['test@example.com'],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email addresses', async () => {
      const response = await request(app)
        .post('/api/reports/email')
        .send({
          reportType: 'appointment',
          recipientEmails: ['invalid-email'],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid report type', async () => {
      const response = await request(app)
        .post('/api/reports/email')
        .send({
          reportType: 'invalid',
          recipientEmails: ['test@example.com'],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/reports/schedule', () => {
    it('should schedule recurring report', async () => {
      const response = await request(app)
        .post('/api/reports/schedule')
        .send({
          reportType: 'appointment',
          recipientEmails: ['test@example.com'],
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 1,
            time: '09:00'
          },
          format: 'pdf'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe('appointment');
      expect(response.body.data.frequency).toBe('weekly');
    });

    it('should return 400 for missing schedule', async () => {
      const response = await request(app)
        .post('/api/reports/schedule')
        .send({
          reportType: 'appointment',
          recipientEmails: ['test@example.com'],
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid frequency', async () => {
      const response = await request(app)
        .post('/api/reports/schedule')
        .send({
          reportType: 'appointment',
          recipientEmails: ['test@example.com'],
          schedule: {
            frequency: 'invalid',
            time: '09:00'
          },
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for weekly frequency without dayOfWeek', async () => {
      const response = await request(app)
        .post('/api/reports/schedule')
        .send({
          reportType: 'appointment',
          recipientEmails: ['test@example.com'],
          schedule: {
            frequency: 'weekly',
            time: '09:00'
          },
          format: 'pdf'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/reports/test-email', () => {
    it('should send test email', async () => {
      const response = await request(app)
        .post('/api/reports/test-email')
        .send({
          testEmail: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recipient).toBe('test@example.com');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/reports/test-email')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/reports/test-email')
        .send({
          testEmail: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('authentication and authorization', () => {
    it('should require authentication', async () => {
      // Mock auth to fail
      mockAuth.mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ success: false, message: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          format: 'pdf'
        });

      expect(response.status).toBe(401);
    });

    it('should require proper permissions', async () => {
      // Mock permission check to fail
      mockCheckPermission.mockImplementationOnce((permission: string) => {
        return (req: any, res: any, next: any) => {
          res.status(403).json({ success: false, message: 'Forbidden' });
        };
      });

      const response = await request(app)
        .post('/api/reports/appointments/generate')
        .send({
          format: 'pdf'
        });

      expect(response.status).toBe(403);
    });
  });
});