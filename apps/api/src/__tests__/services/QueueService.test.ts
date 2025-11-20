/**
 * QueueService Tests
 * Tests for job queue infrastructure
 */

import QueueService from '../../services/QueueService';
import { QueueName, JobPriority } from '../../config/queue';

describe('QueueService', () => {
  let queueService: QueueService;

  beforeAll(async () => {
    queueService = QueueService;
    await queueService.initialize();
  });

  afterAll(async () => {
    await queueService.closeAll();
  });

  afterEach(async () => {
    // Clean up queues after each test
    for (const queueName of Object.values(QueueName)) {
      try {
        await queueService.emptyQueue(queueName);
      } catch (error) {
        // Queue might not exist, ignore
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize all queues', async () => {
      const stats = await queueService.getAllQueueStats();
      expect(Object.keys(stats)).toHaveLength(Object.values(QueueName).length);
    });

    it('should not reinitialize if already initialized', async () => {
      await expect(queueService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Queue Operations', () => {
    it('should add a job to a queue', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '24h' as const,
        channels: ['email' as const],
      };

      const job = await queueService.addJob(
        QueueName.APPOINTMENT_REMINDER,
        jobData
      );

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data).toEqual(jobData);
    });

    it('should add a job with priority', async () => {
      const jobData = {
        workplaceId: 'test-workplace-id',
        checkOverdue: true,
        escalateCritical: true,
      };

      const job = await queueService.addJobWithPriority(
        QueueName.FOLLOW_UP_MONITOR,
        jobData,
        JobPriority.HIGH
      );

      expect(job).toBeDefined();
      expect(job.opts.priority).toBe(2); // HIGH priority
    });

    it('should schedule a job for future execution', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '2h' as const,
        channels: ['sms' as const],
      };

      const scheduledTime = new Date(Date.now() + 60000); // 1 minute from now

      const job = await queueService.scheduleJob(
        QueueName.APPOINTMENT_REMINDER,
        jobData,
        scheduledTime
      );

      expect(job).toBeDefined();
      expect(job.opts.delay).toBeGreaterThan(0);
    });

    it('should throw error when scheduling job in the past', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '24h' as const,
        channels: ['email' as const],
      };

      const pastTime = new Date(Date.now() - 60000); // 1 minute ago

      await expect(
        queueService.scheduleJob(
          QueueName.APPOINTMENT_REMINDER,
          jobData,
          pastTime
        )
      ).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should schedule a recurring job', async () => {
      const jobData = {
        workplaceId: 'test-workplace-id',
        checkOverdue: true,
        escalateCritical: true,
      };

      const cronExpression = '0 * * * *'; // Every hour

      const job = await queueService.scheduleRecurringJob(
        QueueName.FOLLOW_UP_MONITOR,
        jobData,
        cronExpression
      );

      expect(job).toBeDefined();
      expect(job.opts.repeat).toBeDefined();
      expect(job.opts.repeat?.cron).toBe(cronExpression);
    });

    it('should get a job by ID', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '15min' as const,
        channels: ['push' as const],
      };

      const addedJob = await queueService.addJob(
        QueueName.APPOINTMENT_REMINDER,
        jobData
      );

      const retrievedJob = await queueService.getJob(
        QueueName.APPOINTMENT_REMINDER,
        addedJob.id as string
      );

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
      expect(retrievedJob?.data).toEqual(jobData);
    });

    it('should remove a job', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '24h' as const,
        channels: ['email' as const],
      };

      const job = await queueService.addJob(
        QueueName.APPOINTMENT_REMINDER,
        jobData
      );

      await queueService.removeJob(
        QueueName.APPOINTMENT_REMINDER,
        job.id as string
      );

      const retrievedJob = await queueService.getJob(
        QueueName.APPOINTMENT_REMINDER,
        job.id as string
      );

      expect(retrievedJob).toBeNull();
    });
  });

  describe('Queue Statistics', () => {
    it('should get queue statistics', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '24h' as const,
        channels: ['email' as const],
      };

      await queueService.addJob(QueueName.APPOINTMENT_REMINDER, jobData);

      const stats = await queueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );

      expect(stats).toBeDefined();
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
      expect(stats.delayed).toBeGreaterThanOrEqual(0);
      expect(typeof stats.paused).toBe('boolean');
    });

    it('should get all queue statistics', async () => {
      const stats = await queueService.getAllQueueStats();

      expect(stats).toBeDefined();
      expect(Object.keys(stats)).toHaveLength(Object.values(QueueName).length);

      for (const queueName of Object.values(QueueName)) {
        expect(stats[queueName]).toBeDefined();
      }
    });

    it('should get queue metrics', async () => {
      const metrics = await queueService.getQueueMetrics(
        QueueName.APPOINTMENT_REMINDER
      );

      expect(metrics).toBeDefined();
      expect(metrics.name).toBe(QueueName.APPOINTMENT_REMINDER);
      expect(metrics.counts).toBeDefined();
      expect(typeof metrics.paused).toBe('boolean');
      expect(Array.isArray(metrics.recentCompleted)).toBe(true);
      expect(Array.isArray(metrics.recentFailed)).toBe(true);
    });
  });

  describe('Queue Health', () => {
    it('should get queue health status', async () => {
      const health = await queueService.getQueueHealth(
        QueueName.APPOINTMENT_REMINDER
      );

      expect(health).toBeDefined();
      expect(health.name).toBe(QueueName.APPOINTMENT_REMINDER);
      expect(typeof health.isHealthy).toBe('boolean');
      expect(health.stats).toBeDefined();
      expect(Array.isArray(health.errors)).toBe(true);
    });

    it('should get health status for all queues', async () => {
      const health = await queueService.getAllQueuesHealth();

      expect(health).toBeDefined();
      expect(health).toHaveLength(Object.values(QueueName).length);

      for (const queueHealth of health) {
        expect(queueHealth.name).toBeDefined();
        expect(typeof queueHealth.isHealthy).toBe('boolean');
        expect(queueHealth.stats).toBeDefined();
        expect(Array.isArray(queueHealth.errors)).toBe(true);
      }
    });
  });

  describe('Queue Management', () => {
    it('should pause and resume a queue', async () => {
      await queueService.pauseQueue(QueueName.APPOINTMENT_REMINDER);

      let stats = await queueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );
      expect(stats.paused).toBe(true);

      await queueService.resumeQueue(QueueName.APPOINTMENT_REMINDER);

      stats = await queueService.getQueueStats(QueueName.APPOINTMENT_REMINDER);
      expect(stats.paused).toBe(false);
    });

    it('should clean a queue', async () => {
      // Add some jobs
      for (let i = 0; i < 5; i++) {
        await queueService.addJob(QueueName.APPOINTMENT_REMINDER, {
          appointmentId: `test-${i}`,
          patientId: 'test-patient-id',
          workplaceId: 'test-workplace-id',
          reminderType: '24h' as const,
          channels: ['email' as const],
        });
      }

      // Clean the queue
      const jobs = await queueService.cleanQueue(
        QueueName.APPOINTMENT_REMINDER,
        0,
        'wait'
      );

      expect(Array.isArray(jobs)).toBe(true);
    });

    it('should empty a queue', async () => {
      // Add some jobs
      for (let i = 0; i < 3; i++) {
        await queueService.addJob(QueueName.APPOINTMENT_REMINDER, {
          appointmentId: `test-${i}`,
          patientId: 'test-patient-id',
          workplaceId: 'test-workplace-id',
          reminderType: '24h' as const,
          channels: ['email' as const],
        });
      }

      await queueService.emptyQueue(QueueName.APPOINTMENT_REMINDER);

      const stats = await queueService.getQueueStats(
        QueueName.APPOINTMENT_REMINDER
      );
      expect(stats.waiting).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid queue name', async () => {
      await expect(
        queueService.addJob('invalid-queue' as QueueName, {})
      ).rejects.toThrow('Queue not found');
    });

    it('should handle job not found', async () => {
      const job = await queueService.getJob(
        QueueName.APPOINTMENT_REMINDER,
        'non-existent-job-id'
      );

      expect(job).toBeNull();
    });
  });

  describe('Job Retry Logic', () => {
    it('should configure retry with exponential backoff', async () => {
      const jobData = {
        appointmentId: 'test-appointment-id',
        patientId: 'test-patient-id',
        workplaceId: 'test-workplace-id',
        reminderType: '24h' as const,
        channels: ['email' as const],
      };

      const job = await queueService.addJob(
        QueueName.APPOINTMENT_REMINDER,
        jobData
      );

      expect(job.opts.attempts).toBeGreaterThan(0);
      expect(job.opts.backoff).toBeDefined();
      expect(job.opts.backoff?.type).toBe('exponential');
    });

    it('should have different retry attempts based on priority', async () => {
      const jobData = {
        workplaceId: 'test-workplace-id',
        checkOverdue: true,
        escalateCritical: true,
      };

      const criticalJob = await queueService.addJobWithPriority(
        QueueName.FOLLOW_UP_MONITOR,
        jobData,
        JobPriority.CRITICAL
      );

      const lowJob = await queueService.addJobWithPriority(
        QueueName.FOLLOW_UP_MONITOR,
        jobData,
        JobPriority.LOW
      );

      expect(criticalJob.opts.attempts).toBeGreaterThan(
        lowJob.opts.attempts || 0
      );
    });
  });
});
