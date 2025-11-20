/// <reference types="jest" />
import mongoose from 'mongoose';
import { WorkspaceAuditLog, IWorkspaceAuditLog } from '../../models/WorkspaceAuditLog';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('WorkspaceAuditLog Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testActorId: mongoose.Types.ObjectId;
  let testTargetId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Create test workplace
    const workplace = await Workplace.create({
      name: 'Test Pharmacy',
      type: 'Community',
      licenseNumber: 'TEST123',
      email: 'test@pharmacy.com',
      ownerId: new mongoose.Types.ObjectId(),
    });
    testWorkplaceId = workplace._id;

    // Create test users
    const actor = await User.create({
      email: 'actor@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Actor',
      lastName: 'User',
      role: 'pharmacy_outlet',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testActorId = actor._id;

    const target = await User.create({
      email: 'target@test.com',
      passwordHash: 'hashedpassword',
      firstName: 'Target',
      lastName: 'User',
      role: 'pharmacist',
      workplaceId: testWorkplaceId,
      currentPlanId: new mongoose.Types.ObjectId(),
    });
    testTargetId = target._id;
  });

  describe('Model Creation', () => {
    it('should create an audit log with required fields', async () => {
      const log = await WorkspaceAuditLog.create({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        targetId: testTargetId,
        action: 'member_added',
        category: 'member',
        details: {
          reason: 'New team member',
        },
      });

      expect(log).toBeDefined();
      expect(log.workplaceId).toEqual(testWorkplaceId);
      expect(log.actorId).toEqual(testActorId);
      expect(log.targetId).toEqual(testTargetId);
      expect(log.action).toBe('member_added');
      expect(log.category).toBe('member');
      expect(log.severity).toBe('medium');
      expect(log.timestamp).toBeDefined();
    });

    it('should create audit log without targetId', async () => {
      const log = await WorkspaceAuditLog.create({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_list_viewed',
        category: 'member',
        details: {},
      });

      expect(log).toBeDefined();
      expect(log.targetId).toBeUndefined();
    });

    it('should set default timestamp', async () => {
      const beforeCreate = new Date();
      const log = await WorkspaceAuditLog.create({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_added',
        category: 'member',
        details: {},
      });
      const afterCreate = new Date();

      expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(log.timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should store complex details object', async () => {
      const details = {
        before: { role: 'Cashier', status: 'active' },
        after: { role: 'Pharmacist', status: 'active' },
        reason: 'Promotion',
        metadata: {
          approvedBy: 'Manager',
          effectiveDate: new Date(),
        },
      };

      const log = await WorkspaceAuditLog.create({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        targetId: testTargetId,
        action: 'role_changed',
        category: 'role',
        details,
      });

      expect(log.details).toEqual(details);
    });
  });

  describe('Validation', () => {
    it('should require workplaceId', async () => {
      const log = new WorkspaceAuditLog({
        actorId: testActorId,
        action: 'member_added',
        category: 'member',
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should require actorId', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        action: 'member_added',
        category: 'member',
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should require action', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        category: 'member',
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should require category', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_added',
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should validate action enum', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'invalid_action' as any,
        category: 'member',
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should validate category enum', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_added',
        category: 'invalid_category' as any,
        details: {},
      });

      await expect(log.save()).rejects.toThrow();
    });

    it('should validate severity enum', async () => {
      const log = new WorkspaceAuditLog({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_added',
        category: 'member',
        details: {},
        severity: 'invalid' as any,
      });

      await expect(log.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let log: IWorkspaceAuditLog;

    beforeEach(async () => {
      log = await WorkspaceAuditLog.create({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        targetId: testTargetId,
        action: 'member_suspended',
        category: 'member',
        details: { reason: 'Policy violation' },
        severity: 'high',
      });
    });

    describe('getFormattedTimestamp()', () => {
      it('should return ISO formatted timestamp', () => {
        const formatted = log.getFormattedTimestamp();
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    describe('getSeverityColor()', () => {
      it('should return correct color for low severity', async () => {
        log.severity = 'low';
        await log.save();
        expect(log.getSeverityColor()).toBe('green');
      });

      it('should return correct color for medium severity', async () => {
        log.severity = 'medium';
        await log.save();
        expect(log.getSeverityColor()).toBe('yellow');
      });

      it('should return correct color for high severity', async () => {
        log.severity = 'high';
        await log.save();
        expect(log.getSeverityColor()).toBe('orange');
      });

      it('should return correct color for critical severity', async () => {
        log.severity = 'critical';
        await log.save();
        expect(log.getSeverityColor()).toBe('red');
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await WorkspaceAuditLog.create([
        {
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          targetId: testTargetId,
          action: 'member_added',
          category: 'member',
          details: {},
          severity: 'low',
          timestamp: now,
        },
        {
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          targetId: testTargetId,
          action: 'role_changed',
          category: 'role',
          details: {},
          severity: 'medium',
          timestamp: yesterday,
        },
        {
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          action: 'invite_generated',
          category: 'invite',
          details: {},
          severity: 'low',
          timestamp: twoDaysAgo,
        },
        {
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          targetId: testTargetId,
          action: 'member_suspended',
          category: 'member',
          details: {},
          severity: 'high',
          timestamp: now,
        },
      ]);
    });

    describe('logAction()', () => {
      it('should create a new audit log', async () => {
        const log = await (WorkspaceAuditLog as any).logAction({
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          targetId: testTargetId,
          action: 'member_removed',
          category: 'member',
          details: { reason: 'Left company' },
          severity: 'medium',
        });

        expect(log).toBeDefined();
        expect(log.action).toBe('member_removed');
        expect(log.category).toBe('member');
      });

      it('should set default severity if not provided', async () => {
        const log = await (WorkspaceAuditLog as any).logAction({
          workplaceId: testWorkplaceId,
          actorId: testActorId,
          action: 'member_viewed',
          category: 'member',
          details: {},
        });

        expect(log.severity).toBe('medium');
      });
    });

    describe('getRecentLogs()', () => {
      it('should get recent logs sorted by timestamp', async () => {
        const logs = await (WorkspaceAuditLog as any).getRecentLogs(testWorkplaceId, 10);

        expect(logs).toHaveLength(4);
        expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(logs[1].timestamp.getTime());
      });

      it('should limit results', async () => {
        const logs = await (WorkspaceAuditLog as any).getRecentLogs(testWorkplaceId, 2);

        expect(logs).toHaveLength(2);
      });
    });

    describe('getLogsByCategory()', () => {
      it('should filter logs by category', async () => {
        const logs = await (WorkspaceAuditLog as any).getLogsByCategory(
          testWorkplaceId,
          'member',
          10
        );

        expect(logs.length).toBeGreaterThanOrEqual(2);
        logs.forEach((log: IWorkspaceAuditLog) => {
          expect(log.category).toBe('member');
        });
      });
    });

    describe('getLogsByActor()', () => {
      it('should filter logs by actor', async () => {
        const logs = await (WorkspaceAuditLog as any).getLogsByActor(
          testWorkplaceId,
          testActorId,
          10
        );

        expect(logs).toHaveLength(4);
        // Check the actual stored actorId, not the populated value
        const rawLogs = await WorkspaceAuditLog.find({
          workplaceId: testWorkplaceId,
          actorId: testActorId,
        });
        expect(rawLogs).toHaveLength(4);
      });
    });

    describe('getLogsByTarget()', () => {
      it('should filter logs by target', async () => {
        const logs = await (WorkspaceAuditLog as any).getLogsByTarget(
          testWorkplaceId,
          testTargetId,
          10
        );

        expect(logs).toHaveLength(3);
        // Check the actual stored targetId, not the populated value
        const rawLogs = await WorkspaceAuditLog.find({
          workplaceId: testWorkplaceId,
          targetId: testTargetId,
        });
        expect(rawLogs).toHaveLength(3);
      });
    });

    describe('getLogsByDateRange()', () => {
      it('should filter logs by date range', async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        const logs = await (WorkspaceAuditLog as any).getLogsByDateRange(
          testWorkplaceId,
          threeDaysAgo,
          yesterday,
          10
        );

        expect(logs.length).toBeGreaterThan(0);
        logs.forEach((log: IWorkspaceAuditLog) => {
          expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(threeDaysAgo.getTime());
          expect(log.timestamp.getTime()).toBeLessThanOrEqual(yesterday.getTime());
        });
      });
    });

    describe('getHighSeverityLogs()', () => {
      it('should filter logs by high severity', async () => {
        const logs = await (WorkspaceAuditLog as any).getHighSeverityLogs(testWorkplaceId, 10);

        expect(logs).toHaveLength(1);
        expect(logs[0].severity).toBe('high');
      });
    });

    describe('countLogsByCategory()', () => {
      it('should count logs by category', async () => {
        const counts = await (WorkspaceAuditLog as any).countLogsByCategory(testWorkplaceId);

        expect(counts).toHaveLength(3);
        const memberCount = counts.find((c: any) => c._id === 'member');
        expect(memberCount.count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('countLogsByAction()', () => {
      it('should count logs by action', async () => {
        const counts = await (WorkspaceAuditLog as any).countLogsByAction(testWorkplaceId);

        expect(counts.length).toBeGreaterThan(0);
        const addedCount = counts.find((c: any) => c._id === 'member_added');
        expect(addedCount.count).toBe(1);
      });

      it('should count logs by action within category', async () => {
        const counts = await (WorkspaceAuditLog as any).countLogsByAction(
          testWorkplaceId,
          'member'
        );

        expect(counts.length).toBeGreaterThan(0);
        counts.forEach((count: any) => {
          expect(['member_added', 'member_suspended']).toContain(count._id);
        });
      });
    });
  });

  describe('Indexes', () => {
    it('should query efficiently with compound indexes', async () => {
      // Create many logs to test index performance
      const logs = Array.from({ length: 100 }, (_, i) => ({
        workplaceId: testWorkplaceId,
        actorId: testActorId,
        action: 'member_viewed',
        category: 'member',
        details: {},
        timestamp: new Date(Date.now() - i * 1000),
      }));

      await WorkspaceAuditLog.insertMany(logs);

      const startTime = Date.now();
      await WorkspaceAuditLog.find({
        workplaceId: testWorkplaceId,
        category: 'member',
      })
        .sort({ timestamp: -1 })
        .limit(10);
      const endTime = Date.now();

      // Query should be fast (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
