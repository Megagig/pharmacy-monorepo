import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth';
import {
  requireFollowUpPermission,
  requireFollowUpRead,
  requireFollowUpCreate,
  requireFollowUpUpdate,
  requireFollowUpComplete,
  requireFollowUpEscalate,
  checkFollowUpOwnership,
  checkFollowUpFeatureAccess,
  applyFollowUpDataFiltering,
  hasFollowUpPermission,
} from '../../middlewares/followUpRBAC';
import FollowUpTask from '../../models/FollowUpTask';

// Mock dependencies
jest.mock('../../models/FollowUpTask');
jest.mock('../../utils/logger');

describe('Follow-up RBAC Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: {
        _id: 'user123',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
      } as any,
      workspaceContext: {
        workspace: {
          _id: 'workspace123',
          subscriptionStatus: 'active',
        } as any,
        permissions: ['followUpManagement'],
        plan: {
          name: 'Pro Plan',
        } as any,
      } as any,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasFollowUpPermission', () => {
    it('should grant owner full permissions', () => {
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'create')).toBe(true);
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'read')).toBe(true);
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'update')).toBe(true);
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'delete')).toBe(true);
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'manage')).toBe(true);
      expect(hasFollowUpPermission('pharmacy_outlet', 'Owner', 'assign')).toBe(true);
    });

    it('should grant pharmacist appropriate permissions', () => {
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'create')).toBe(true);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'read')).toBe(true);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'update')).toBe(true);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'complete')).toBe(true);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'escalate')).toBe(true);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'delete')).toBe(false);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'manage')).toBe(false);
      expect(hasFollowUpPermission('pharmacist', 'Pharmacist', 'assign')).toBe(false);
    });

    it('should grant technician read-only permissions', () => {
      expect(hasFollowUpPermission('intern_pharmacist', 'Technician', 'read')).toBe(true);
      expect(hasFollowUpPermission('intern_pharmacist', 'Technician', 'create')).toBe(false);
      expect(hasFollowUpPermission('intern_pharmacist', 'Technician', 'update')).toBe(false);
      expect(hasFollowUpPermission('intern_pharmacist', 'Technician', 'complete')).toBe(false);
    });

    it('should grant super admin full permissions', () => {
      expect(hasFollowUpPermission('super_admin', undefined, 'create')).toBe(true);
      expect(hasFollowUpPermission('super_admin', undefined, 'delete')).toBe(true);
      expect(hasFollowUpPermission('super_admin', undefined, 'manage')).toBe(true);
      expect(hasFollowUpPermission('super_admin', undefined, 'assign')).toBe(true);
    });
  });

  describe('requireFollowUpPermission', () => {
    it('should allow access when user has permission', () => {
      const middleware = requireFollowUpPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks permission', () => {
      const middleware = requireFollowUpPermission('delete');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
        })
      );
    });

    it('should deny access when user is not authenticated', () => {
      mockReq.user = undefined;
      const middleware = requireFollowUpPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'AUTH_REQUIRED',
        })
      );
    });

    it('should bypass checks for super admin', () => {
      mockReq.user!.role = 'super_admin';
      const middleware = requireFollowUpPermission('delete');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should attach role info to request', () => {
      const middleware = requireFollowUpPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect((mockReq as any).followUpRole).toBe('pharmacist');
      expect((mockReq as any).canManageFollowUps).toBe(false);
    });
  });

  describe('checkFollowUpOwnership', () => {
    it('should allow owner to access any follow-up task', async () => {
      mockReq.user!.workplaceRole = 'Owner';
      mockReq.params = { id: 'followup123' };

      await checkFollowUpOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow pharmacist to access assigned follow-up task', async () => {
      mockReq.params = { id: 'followup123' };
      const mockFollowUp = {
        _id: 'followup123',
        workplaceId: 'workspace123',
        assignedTo: 'user123',
        createdBy: 'otherUser',
      };

      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockFollowUp);

      await checkFollowUpOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).followUpTask).toEqual(mockFollowUp);
    });

    it('should deny pharmacist access to unassigned follow-up task', async () => {
      mockReq.params = { id: 'followup123' };
      const mockFollowUp = {
        _id: 'followup123',
        workplaceId: 'workspace123',
        assignedTo: 'otherUser',
        createdBy: 'anotherUser',
      };

      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockFollowUp);

      await checkFollowUpOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'NOT_ASSIGNED',
        })
      );
    });

    it('should deny access to follow-up from different workspace', async () => {
      mockReq.params = { id: 'followup123' };
      const mockFollowUp = {
        _id: 'followup123',
        workplaceId: 'differentWorkspace',
        assignedTo: 'user123',
        createdBy: 'user123',
      };

      (FollowUpTask.findById as jest.Mock).mockResolvedValue(mockFollowUp);

      await checkFollowUpOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'WORKSPACE_MISMATCH',
        })
      );
    });

    it('should return 404 when follow-up task not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      (FollowUpTask.findById as jest.Mock).mockResolvedValue(null);

      await checkFollowUpOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'FOLLOWUP_NOT_FOUND',
        })
      );
    });
  });

  describe('checkFollowUpFeatureAccess', () => {
    it('should allow access when feature is available', async () => {
      await checkFollowUpFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when feature is not available', async () => {
      mockReq.workspaceContext!.permissions = [];

      await checkFollowUpFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'FEATURE_NOT_AVAILABLE',
          feature: 'followUpManagement',
          upgradeRequired: true,
        })
      );
    });

    it('should deny access when subscription is not active', async () => {
      mockReq.workspaceContext!.workspace!.subscriptionStatus = 'cancelled';

      await checkFollowUpFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(402);
    });

    it('should bypass checks for super admin', async () => {
      mockReq.user!.role = 'super_admin';
      mockReq.workspaceContext!.permissions = [];

      await checkFollowUpFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('applyFollowUpDataFiltering', () => {
    it('should not filter for owner', () => {
      mockReq.user!.workplaceRole = 'Owner';

      applyFollowUpDataFiltering(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).followUpFilter).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not filter for super admin', () => {
      mockReq.user!.role = 'super_admin';

      applyFollowUpDataFiltering(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).followUpFilter).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should filter for pharmacist', () => {
      applyFollowUpDataFiltering(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).followUpFilter).toEqual({
        $or: [
          { assignedTo: 'user123' },
          { createdBy: 'user123' },
        ],
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should filter for technician', () => {
      mockReq.user!.role = 'intern_pharmacist';
      mockReq.user!.workplaceRole = 'Technician';

      applyFollowUpDataFiltering(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect((mockReq as any).followUpFilter).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Specific permission middlewares', () => {
    it('requireFollowUpRead should check read permission', () => {
      requireFollowUpRead(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireFollowUpCreate should check create permission', () => {
      requireFollowUpCreate(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireFollowUpUpdate should check update permission', () => {
      requireFollowUpUpdate(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireFollowUpComplete should check complete permission', () => {
      requireFollowUpComplete(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireFollowUpEscalate should check escalate permission', () => {
      requireFollowUpEscalate(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
