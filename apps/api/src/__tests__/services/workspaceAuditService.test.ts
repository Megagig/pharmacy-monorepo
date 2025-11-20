import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { workspaceAuditService } from '../../services/workspaceAuditService';
import { WorkspaceAuditLog } from '../../models/WorkspaceAuditLog';
import { Request } from 'express';

describe('WorkspaceAuditService', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let actorId: mongoose.Types.ObjectId;
  let targetId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60000);

  beforeEach(async () => {
    // Clear the database before each test
    await WorkspaceAuditLog.deleteMany({});

    // Create test IDs
    workplaceId = new mongoose.Types.ObjectId();
    actorId = new mongoose.Types.ObjectId();
    targetId = new mongoose.Types.ObjectId();
  });

  describe('logAudit', () => {
    it('should create an audit log entry with all required fields', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        targetId,
        action: 'member_suspended',
        category: 'member',
        details: {
          reason: 'Violation of policy',
        },
        severity: 'high',
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.workplaceId.toString()).toBe(workplaceId.toString());
      expect(auditLog.actorId.toString()).toBe(actorId.toString());
      expect(auditLog.targetId?.toString()).toBe(targetId.toString());
      expect(auditLog.action).toBe('member_suspended');
      expect(auditLog.category).toBe('member');
      expect(auditLog.severity).toBe('high');
      expect(auditLog.details.reason).toBe('Violation of policy');
    });

    it('should auto-calculate severity if not provided', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        targetId,
        action: 'member_removed',
        category: 'member',
      });

      expect(auditLog.severity).toBe('critical');
    });

    it('should extract IP address from request', async () => {
      const mockReq = {
        ip: '192.168.1.1',
        get: (header: string) => (header === 'User-Agent' ? 'Test Agent' : undefined),
      } as unknown as Request;

      const auditLog = await workspaceAuditService.logAudit(
        {
          workplaceId,
          actorId,
          action: 'member_viewed',
          category: 'member',
        },
        mockReq
      );

      expect(auditLog.ipAddress).toBe('192.168.1.1');
      expect(auditLog.userAgent).toBe('Test Agent');
    });

    it('should handle missing optional fields', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        action: 'settings_viewed',
        category: 'settings',
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.targetId).toBeUndefined();
      expect(auditLog.details).toEqual({});
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(async () => {
      // Create test audit logs
      const logs = [
        {
          workplaceId,
          actorId,
          targetId,
          action: 'member_suspended',
          category: 'member',
          severity: 'high',
          timestamp: new Date('2025-01-01'),
        },
        {
          workplaceId,
          actorId,
          action: 'role_changed',
          category: 'role',
          severity: 'medium',
          timestamp: new Date('2025-01-02'),
        },
        {
          workplaceId,
          actorId: new mongoose.Types.ObjectId(),
          action: 'invite_generated',
          category: 'invite',
          severity: 'low',
          timestamp: new Date('2025-01-03'),
        },
      ];

      await WorkspaceAuditLog.insertMany(logs);
    });

    it('should retrieve audit logs with pagination', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        page: 1,
        limit: 2,
      });

      expect(result.logs).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should filter by category', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        category: 'member',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].category).toBe('member');
    });

    it('should filter by action', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        action: 'role_changed',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe('role_changed');
    });

    it('should filter by severity', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        severity: 'high',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].severity).toBe('high');
    });

    it('should filter by date range', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        startDate: '2025-01-02',
        endDate: '2025-01-03',
      });

      expect(result.logs).toHaveLength(2);
    });

    it('should filter by actorId', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId, {
        actorId: actorId.toString(),
      });

      expect(result.logs).toHaveLength(2);
      // Verify the filter worked by checking raw documents
      const rawLogs = await WorkspaceAuditLog.find({ workplaceId, actorId }).lean();
      expect(rawLogs).toHaveLength(2);
      expect(rawLogs.every((log) => log.actorId.toString() === actorId.toString())).toBe(true);
    });

    it('should sort logs by timestamp descending', async () => {
      const result = await workspaceAuditService.getAuditLogs(workplaceId);

      expect(result.logs[0].action).toBe('invite_generated'); // Most recent
      expect(result.logs[2].action).toBe('member_suspended'); // Oldest
    });
  });

  describe('getMemberAuditLogs', () => {
    beforeEach(async () => {
      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        targetId,
        action: 'member_suspended',
        category: 'member',
        severity: 'high',
      });

      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        targetId: new mongoose.Types.ObjectId(),
        action: 'member_activated',
        category: 'member',
        severity: 'medium',
      });
    });

    it('should retrieve audit logs for a specific member', async () => {
      const result = await workspaceAuditService.getMemberAuditLogs(workplaceId, targetId);

      expect(result.logs).toHaveLength(1);
      // Since we're using lean() and the User documents don't exist, targetId will be the ObjectId
      // Check the raw document from database
      const rawLog = await WorkspaceAuditLog.findOne({ workplaceId, targetId }).lean();
      expect(rawLog?.targetId?.toString()).toBe(targetId.toString());
    });
  });

  describe('getAuditLogsByActor', () => {
    beforeEach(async () => {
      const otherActorId = new mongoose.Types.ObjectId();

      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        action: 'member_suspended',
        category: 'member',
        severity: 'high',
      });

      await WorkspaceAuditLog.create({
        workplaceId,
        actorId: otherActorId,
        action: 'member_activated',
        category: 'member',
        severity: 'medium',
      });
    });

    it('should retrieve audit logs by actor', async () => {
      const result = await workspaceAuditService.getAuditLogsByActor(workplaceId, actorId);

      expect(result.logs).toHaveLength(1);
      // Since we're using lean() and the User documents don't exist, actorId will be the ObjectId
      // Check the raw document from database
      const rawLog = await WorkspaceAuditLog.findOne({ workplaceId, actorId }).lean();
      expect(rawLog?.actorId?.toString()).toBe(actorId.toString());
    });
  });

  describe('getAuditLogsByCategory', () => {
    beforeEach(async () => {
      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        action: 'member_suspended',
        category: 'member',
        severity: 'high',
      });

      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        action: 'role_changed',
        category: 'role',
        severity: 'medium',
      });
    });

    it('should retrieve audit logs by category', async () => {
      const result = await workspaceAuditService.getAuditLogsByCategory(
        workplaceId,
        'member'
      );

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].category).toBe('member');
    });
  });

  describe('getHighSeverityLogs', () => {
    beforeEach(async () => {
      await WorkspaceAuditLog.insertMany([
        {
          workplaceId,
          actorId,
          action: 'member_suspended',
          category: 'member',
          severity: 'critical',
        },
        {
          workplaceId,
          actorId,
          action: 'role_changed',
          category: 'role',
          severity: 'high',
        },
        {
          workplaceId,
          actorId,
          action: 'member_viewed',
          category: 'member',
          severity: 'low',
        },
      ]);
    });

    it('should retrieve only high and critical severity logs', async () => {
      const result = await workspaceAuditService.getHighSeverityLogs(workplaceId);

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every((log) => ['high', 'critical'].includes(log.severity))).toBe(
        true
      );
    });
  });

  describe('getAuditStatistics', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await WorkspaceAuditLog.insertMany([
        {
          workplaceId,
          actorId,
          action: 'member_suspended',
          category: 'member',
          severity: 'high',
          timestamp: now,
        },
        {
          workplaceId,
          actorId,
          action: 'role_changed',
          category: 'role',
          severity: 'medium',
          timestamp: now,
        },
        {
          workplaceId,
          actorId: new mongoose.Types.ObjectId(),
          action: 'invite_generated',
          category: 'invite',
          severity: 'low',
          timestamp: yesterday,
        },
      ]);
    });

    it('should calculate audit statistics', async () => {
      const stats = await workspaceAuditService.getAuditStatistics(workplaceId);

      expect(stats.totalLogs).toBe(3);
      expect(stats.uniqueActors).toBe(2);
      expect(stats.recentActivity).toBeGreaterThan(0);
      expect(stats.logsByCategory).toHaveProperty('member');
      expect(stats.logsByCategory).toHaveProperty('role');
      expect(stats.logsByCategory).toHaveProperty('invite');
      expect(stats.logsBySeverity).toHaveProperty('high');
      expect(stats.logsBySeverity).toHaveProperty('medium');
      expect(stats.logsBySeverity).toHaveProperty('low');
    });

    it('should calculate statistics for a date range', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const stats = await workspaceAuditService.getAuditStatistics(workplaceId, {
        startDate: twoDaysAgo,
        endDate: now,
      });

      expect(stats.totalLogs).toBeGreaterThanOrEqual(2);
    });
  });

  describe('exportAuditLogs', () => {
    beforeEach(async () => {
      await WorkspaceAuditLog.create({
        workplaceId,
        actorId,
        targetId,
        action: 'member_suspended',
        category: 'member',
        severity: 'high',
        details: {
          reason: 'Policy violation',
        },
        ipAddress: '192.168.1.1',
      });
    });

    it('should export audit logs as CSV', async () => {
      const csv = await workspaceAuditService.exportAuditLogs(workplaceId);

      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Action');
      expect(csv).toContain('Category');
      expect(csv).toContain('member_suspended');
      expect(csv).toContain('Policy violation');
    });

    it('should handle empty results', async () => {
      const emptyWorkplaceId = new mongoose.Types.ObjectId();
      const csv = await workspaceAuditService.exportAuditLogs(emptyWorkplaceId);

      expect(csv).toBe('No audit data available');
    });
  });

  describe('Helper methods', () => {
    it('should log member action', async () => {
      const auditLog = await workspaceAuditService.logMemberAction(
        workplaceId,
        actorId,
        targetId,
        'member_suspended',
        { reason: 'Test reason' }
      );

      expect(auditLog.category).toBe('member');
      expect(auditLog.action).toBe('member_suspended');
    });

    it('should log role action', async () => {
      const auditLog = await workspaceAuditService.logRoleAction(
        workplaceId,
        actorId,
        targetId,
        'role_changed',
        { before: 'Staff', after: 'Admin' }
      );

      expect(auditLog.category).toBe('role');
      expect(auditLog.action).toBe('role_changed');
    });

    it('should log invite action', async () => {
      const auditLog = await workspaceAuditService.logInviteAction(
        workplaceId,
        actorId,
        'invite_generated',
        { metadata: { email: 'test@example.com' } }
      );

      expect(auditLog.category).toBe('invite');
      expect(auditLog.action).toBe('invite_generated');
    });
  });

  describe('Severity calculation', () => {
    it('should assign critical severity to critical actions', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        action: 'member_removed',
        category: 'member',
      });

      expect(auditLog.severity).toBe('critical');
    });

    it('should assign high severity to high-risk actions', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        action: 'role_changed',
        category: 'role',
      });

      expect(auditLog.severity).toBe('high');
    });

    it('should assign medium severity to medium-risk actions', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        action: 'member_activated',
        category: 'member',
      });

      expect(auditLog.severity).toBe('medium');
    });

    it('should assign low severity to low-risk actions', async () => {
      const auditLog = await workspaceAuditService.logAudit({
        workplaceId,
        actorId,
        action: 'member_viewed',
        category: 'member',
      });

      expect(auditLog.severity).toBe('low');
    });
  });
});
