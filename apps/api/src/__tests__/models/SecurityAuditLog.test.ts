import mongoose from 'mongoose';
import { SecurityAuditLog, ISecurityAuditLog } from '../../models/SecurityAuditLog';

describe('SecurityAuditLog Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SecurityAuditLog.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid SecurityAuditLog document', async () => {
      const userId = new mongoose.Types.ObjectId();
      const workspaceId = new mongoose.Types.ObjectId();
      
      const validLog = {
        userId,
        sessionId: 'session_123',
        action: 'user_login',
        resource: 'authentication',
        resourceId: userId.toString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        location: {
          country: 'Nigeria',
          region: 'Lagos',
          city: 'Lagos',
        },
        timestamp: new Date(),
        success: true,
        severity: 'low' as const,
        category: 'authentication' as const,
        details: {
          loginMethod: 'email_password',
          deviceType: 'desktop',
        },
        riskScore: 15,
        flagged: false,
        workspaceId,
      };

      const log = new SecurityAuditLog(validLog);
      const savedLog = await log.save();

      expect(savedLog._id).toBeDefined();
      expect(savedLog.action).toBe('user_login');
      expect(savedLog.userId.toString()).toBe(userId.toString());
      expect(savedLog.success).toBe(true);
      expect(savedLog.createdAt).toBeDefined();
    });

    it('should require mandatory fields', async () => {
      const incompleteLog = new SecurityAuditLog({
        action: 'test_action',
        // Missing required fields
      });

      await expect(incompleteLog.save()).rejects.toThrow();
    });

    it('should validate IP address format', async () => {
      const invalidLog = new SecurityAuditLog({
        action: 'test_action',
        resource: 'test_resource',
        ipAddress: 'invalid-ip-format',
        userAgent: 'Mozilla/5.0',
        success: true,
        severity: 'low',
        category: 'authentication',
        details: {},
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      const invalidLog = new SecurityAuditLog({
        action: 'test_action',
        resource: 'test_resource',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        severity: 'invalid_severity' as any,
        category: 'authentication',
        details: {},
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });

    it('should validate risk score range', async () => {
      const invalidLog = new SecurityAuditLog({
        action: 'test_action',
        resource: 'test_resource',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        severity: 'low',
        category: 'authentication',
        details: {},
        riskScore: 150, // Invalid score > 100
      });

      await expect(invalidLog.save()).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let log: ISecurityAuditLog;
    const userId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      log = new SecurityAuditLog({
        userId,
        action: 'login_failed',
        resource: 'authentication',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        severity: 'medium',
        category: 'authentication',
        details: {
          multipleFailures: true,
          newDevice: true,
          offHours: false,
        },
      });
      await log.save();
    });

    it('should calculate risk score correctly', () => {
      const riskScore = log.calculateRiskScore();
      
      // Authentication category (20) + failure (30) + multiple failures (25) + new device (15) = 90
      expect(riskScore).toBeGreaterThanOrEqual(80);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it('should determine flagging correctly', () => {
      // Failed authentication should be flagged
      expect(log.shouldFlag()).toBe(true);

      // Successful low-risk action should not be flagged
      log.success = true;
      log.severity = 'low';
      log.category = 'data_access';
      log.details = {};
      expect(log.shouldFlag()).toBe(false);

      // Critical severity should always be flagged
      log.severity = 'critical';
      expect(log.shouldFlag()).toBe(true);
    });

    it('should mark as reviewed correctly', () => {
      const reviewerId = new mongoose.Types.ObjectId();
      const notes = 'Reviewed and cleared';
      
      log.markReviewed(reviewerId, notes);
      
      expect(log.reviewedBy?.toString()).toBe(reviewerId.toString());
      expect(log.reviewedAt).toBeDefined();
      expect(log.reviewNotes).toBe(notes);
      expect(log.flagged).toBe(false);
    });

    it('should exclude __v field in JSON output', () => {
      const jsonOutput = log.toJSON();
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('action');
    });
  });

  describe('Static Methods', () => {
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await SecurityAuditLog.create([
        {
          userId: userId1,
          action: 'user_login',
          resource: 'authentication',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now,
          success: true,
          severity: 'low',
          category: 'authentication',
          details: {},
          riskScore: 10,
          flagged: false,
        },
        {
          userId: userId2,
          action: 'login_failed',
          resource: 'authentication',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0',
          timestamp: yesterday,
          success: false,
          severity: 'high',
          category: 'authentication',
          details: {},
          riskScore: 85,
          flagged: true,
        },
        {
          userId: userId1,
          action: 'role_changed',
          resource: 'user_management',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: now,
          success: true,
          severity: 'critical',
          category: 'user_management',
          details: {},
          riskScore: 95,
          flagged: true,
        },
      ]);
    });

    it('should create log with auto-calculated risk score and flagging', async () => {
      const logData = {
        action: 'password_reset',
        resource: 'authentication',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        severity: 'medium' as const,
        category: 'authentication' as const,
        details: { newDevice: true },
      };

      const createdLog = await SecurityAuditLog.createLog(logData);
      
      expect(createdLog.riskScore).toBeGreaterThan(0);
      expect(createdLog.flagged).toBe(true); // Failed auth should be flagged
    });

    it('should get flagged logs', async () => {
      const flaggedLogs = await SecurityAuditLog.getFlaggedLogs();
      
      expect(flaggedLogs).toHaveLength(2);
      expect(flaggedLogs[0].riskScore).toBeGreaterThanOrEqual(flaggedLogs[1].riskScore);
    });

    it('should get security summary', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const summary = await SecurityAuditLog.getSecuritySummary({
        start: yesterday,
        end: now,
      });
      
      expect(summary).toHaveLength(1);
      expect(summary[0].totalEvents).toBe(3);
      expect(summary[0].failedEvents).toBe(1);
      expect(summary[0].flaggedEvents).toBe(2);
      expect(summary[0].criticalEvents).toBe(1);
    });

    it('should get user activity', async () => {
      const userActivity = await SecurityAuditLog.getUserActivity(userId1);
      
      expect(userActivity).toHaveLength(2);
      expect(userActivity[0].action).toBe('role_changed'); // Most recent first
    });

    it('should get failed logins', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const failedLogins = await SecurityAuditLog.getFailedLogins({
        start: yesterday,
        end: now,
      });
      
      expect(failedLogins).toHaveLength(1);
      expect(failedLogins[0].action).toBe('login_failed');
    });
  });

  describe('Pre-save Middleware', () => {
    it('should auto-calculate risk score and flagging on save', async () => {
      const log = new SecurityAuditLog({
        action: 'configuration_changed',
        resource: 'system',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        severity: 'critical',
        category: 'configuration',
        details: {},
      });

      await log.save();
      
      expect(log.riskScore).toBeGreaterThan(0);
      expect(log.flagged).toBe(true); // Critical severity should be flagged
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await SecurityAuditLog.collection.getIndexes();
      
      expect(indexes).toHaveProperty('userId_1');
      expect(indexes).toHaveProperty('action_1');
      expect(indexes).toHaveProperty('resource_1');
      expect(indexes).toHaveProperty('timestamp_1');
      expect(indexes).toHaveProperty('severity_1');
      expect(indexes).toHaveProperty('category_1');
      expect(indexes).toHaveProperty('success_1');
      expect(indexes).toHaveProperty('flagged_1');
      expect(indexes).toHaveProperty('riskScore_1');
    });

    it('should have TTL index for automatic cleanup', async () => {
      const indexes = await SecurityAuditLog.collection.getIndexes();
      
      const ttlIndex = Object.values(indexes).find((index: any) => 
        index.expireAfterSeconds !== undefined
      );
      
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(94608000); // 3 years in seconds
    });
  });
});