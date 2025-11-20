/**
 * Queue Monitoring Integration Tests
 * Tests for queue monitoring API endpoints
 */

import request from 'supertest';
import app from '../../app';
import QueueService from '../../services/QueueService';
import { QueueName } from '../../config/queue';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { generateToken } from '../../utils/token';

describe('Queue Monitoring API', () => {
  let adminToken: string;
  let adminUser: any;
  let workplace: any;

  beforeAll(async () => {
    // Initialize queue service
    await QueueService.initialize();

    // Create test workplace
    workplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'test@pharmacy.com',
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
    });

    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'Password123!',
      role: 'super_admin',
      workplaceId: workplace._id,
      isEmailVerified: true,
    });

    adminToken = generateToken(adminUser._id.toString());
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Workplace.deleteMany({});
    await QueueService.closeAll();
  });

  afterEach(async () => {
    // Clean up queues after each test
    for (const queueName of Object.values(QueueName)) {
      try {
        await QueueService.emptyQueue(queueName);
      } catch (error) {
        // Queue might not exist, ignore
      }
    }
  });

  describe('GET /api/queue-monitoring/dashboard', () => {
    it('should get queue dashboard', async () => {
      const response = await request(app)
        .get('/api/queue-monitoring/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totals).toBeDefined();
      expect(response.body.data.overallHealth).toBeDefined();
      expect(Array.isArray(response.body.data.queues)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/queue-monitoring/dashboard')
        .expect(401);
    });
  });

  describe('GET /api/queue-monitoring/stats', () => {
    it('should get all queue statistics', async () => {
      const response = await request(app)
        .get('/api/queue-monitoring/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Object.keys(response.body.data)).toHaveLength(
        Object.values(QueueName).length
      );
    });
  });

  describe('GET /api/queue-monitoring/:queueName/stats', () => {
    it('should get statistics for a specific queue', async () => {
      const response = await request(app)
        .get(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.waiting).toBeDefined();
      expect(response.body.data.active).toBeDefined();
      expect(response.body.data.completed).toBeDefined();
      expect(response.body.data.failed).toBeDefined();
    });

    it('should return 400 for invalid queue name', async () => {
      const response = await request(app)
        .get('/api/queue-monitoring/invalid-queue/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid queue name');
    });
  });

  describe('GET /api/queue-monitoring/:queueName/metrics', () => {
    it('should get detailed metrics for a queue', async () => {
      // Add a test job
      await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
        appointmentId: 'test-id',
        patientId: 'test-patient',
        workplaceId: workplace._id.toString(),
        reminderType: '24h',
        channels: ['email'],
      });

      const response = await request(app)
        .get(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(QueueName.APPOINTMENT_REMINDER);
      expect(response.body.data.counts).toBeDefined();
      expect(Array.isArray(response.body.data.recentCompleted)).toBe(true);
      expect(Array.isArray(response.body.data.recentFailed)).toBe(true);
    });
  });

  describe('GET /api/queue-monitoring/health', () => {
    it('should get health status for all queues', async () => {
      const response = await request(app)
        .get('/api/queue-monitoring/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.overallHealth).toBeDefined();
      expect(Array.isArray(response.body.data.queues)).toBe(true);
      expect(response.body.data.queues).toHaveLength(
        Object.values(QueueName).length
      );
    });
  });

  describe('GET /api/queue-monitoring/:queueName/health', () => {
    it('should get health status for a specific queue', async () => {
      const response = await request(app)
        .get(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/health`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(QueueName.APPOINTMENT_REMINDER);
      expect(typeof response.body.data.isHealthy).toBe('boolean');
      expect(response.body.data.stats).toBeDefined();
      expect(Array.isArray(response.body.data.errors)).toBe(true);
    });
  });

  describe('POST /api/queue-monitoring/:queueName/pause', () => {
    it('should pause a queue', async () => {
      const response = await request(app)
        .post(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('paused successfully');

      // Verify queue is paused
      const stats = await QueueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );
      expect(stats.paused).toBe(true);
    });
  });

  describe('POST /api/queue-monitoring/:queueName/resume', () => {
    it('should resume a paused queue', async () => {
      // First pause the queue
      await QueueService.pauseQueue(QueueName.APPOINTMENT_REMINDER);

      const response = await request(app)
        .post(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/resume`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resumed successfully');

      // Verify queue is resumed
      const stats = await QueueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );
      expect(stats.paused).toBe(false);
    });
  });

  describe('POST /api/queue-monitoring/:queueName/clean', () => {
    it('should clean a queue', async () => {
      // Add some jobs
      for (let i = 0; i < 3; i++) {
        await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
          appointmentId: `test-${i}`,
          patientId: 'test-patient',
          workplaceId: workplace._id.toString(),
          reminderType: '24h',
          channels: ['email'],
        });
      }

      const response = await request(app)
        .post(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/clean`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ grace: 0, status: 'wait' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleaned successfully');
      expect(response.body.data.removedCount).toBeDefined();
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/clean`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('POST /api/queue-monitoring/:queueName/empty', () => {
    it('should empty a queue', async () => {
      // Add some jobs
      for (let i = 0; i < 3; i++) {
        await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
          appointmentId: `test-${i}`,
          patientId: 'test-patient',
          workplaceId: workplace._id.toString(),
          reminderType: '24h',
          channels: ['email'],
        });
      }

      const response = await request(app)
        .post(`/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/empty`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('emptied successfully');

      // Verify queue is empty
      const stats = await QueueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );
      expect(stats.waiting).toBe(0);
    });
  });

  describe('GET /api/queue-monitoring/:queueName/jobs/:jobId', () => {
    it('should get a specific job', async () => {
      const job = await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
        appointmentId: 'test-id',
        patientId: 'test-patient',
        workplaceId: workplace._id.toString(),
        reminderType: '24h',
        channels: ['email'],
      });

      const response = await request(app)
        .get(
          `/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/jobs/${job.id}`
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(job.id);
      expect(response.body.data.data).toEqual(job.data);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get(
          `/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/jobs/non-existent`
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Job not found');
    });
  });

  describe('DELETE /api/queue-monitoring/:queueName/jobs/:jobId', () => {
    it('should remove a job', async () => {
      const job = await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
        appointmentId: 'test-id',
        patientId: 'test-patient',
        workplaceId: workplace._id.toString(),
        reminderType: '24h',
        channels: ['email'],
      });

      const response = await request(app)
        .delete(
          `/api/queue-monitoring/${QueueName.APPOINTMENT_REMINDER}/jobs/${job.id}`
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed successfully');

      // Verify job is removed
      const retrievedJob = await QueueService.getJob(
        QueueName.APPOINTMENT_REMINDER,
        job.id as string
      );
      expect(retrievedJob).toBeNull();
    });
  });
});
