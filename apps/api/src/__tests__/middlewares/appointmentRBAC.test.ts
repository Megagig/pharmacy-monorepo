import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth';
import {
  requireAppointmentPermission,
  requireAppointmentRead,
  requireAppointmentCreate,
  requireAppointmentUpdate,
  requireAppointmentDelete,
  checkAppointmentOwnership,
  checkAppointmentFeatureAccess,
  hasAppointmentPermission,
} from '../../middlewares/appointmentRBAC';
import Appointment from '../../models/Appointment';

// Mock dependencies
jest.mock('../../models/Appointment');
jest.mock('../../utils/logger');

describe('Appointment RBAC Middleware', () => {
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
        permissions: ['appointmentScheduling'],
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

  describe('hasAppointmentPermission', () => {
    it('should grant owner full permissions', () => {
      expect(hasAppointmentPermission('pharmacy_outlet', 'Owner', 'create')).toBe(true);
      expect(hasAppointmentPermission('pharmacy_outlet', 'Owner', 'read')).toBe(true);
      expect(hasAppointmentPermission('pharmacy_outlet', 'Owner', 'update')).toBe(true);
      expect(hasAppointmentPermission('pharmacy_outlet', 'Owner', 'delete')).toBe(true);
      expect(hasAppointmentPermission('pharmacy_outlet', 'Owner', 'manage')).toBe(true);
    });

    it('should grant pharmacist appropriate permissions', () => {
      expect(hasAppointmentPermission('pharmacist', 'Pharmacist', 'create')).toBe(true);
      expect(hasAppointmentPermission('pharmacist', 'Pharmacist', 'read')).toBe(true);
      expect(hasAppointmentPermission('pharmacist', 'Pharmacist', 'update')).toBe(true);
      expect(hasAppointmentPermission('pharmacist', 'Pharmacist', 'delete')).toBe(false);
      expect(hasAppointmentPermission('pharmacist', 'Pharmacist', 'manage')).toBe(false);
    });

    it('should grant technician read-only permissions', () => {
      expect(hasAppointmentPermission('intern_pharmacist', 'Technician', 'read')).toBe(true);
      expect(hasAppointmentPermission('intern_pharmacist', 'Technician', 'create')).toBe(false);
      expect(hasAppointmentPermission('intern_pharmacist', 'Technician', 'update')).toBe(false);
    });

    it('should grant super admin full permissions', () => {
      expect(hasAppointmentPermission('super_admin', undefined, 'create')).toBe(true);
      expect(hasAppointmentPermission('super_admin', undefined, 'delete')).toBe(true);
      expect(hasAppointmentPermission('super_admin', undefined, 'manage')).toBe(true);
    });
  });

  describe('requireAppointmentPermission', () => {
    it('should allow access when user has permission', () => {
      const middleware = requireAppointmentPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks permission', () => {
      const middleware = requireAppointmentPermission('delete');
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
      const middleware = requireAppointmentPermission('read');
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

    it('should deny access when workspace context is missing', () => {
      mockReq.workspaceContext = undefined;
      const middleware = requireAppointmentPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'WORKSPACE_CONTEXT_MISSING',
        })
      );
    });

    it('should bypass checks for super admin', () => {
      mockReq.user!.role = 'super_admin';
      const middleware = requireAppointmentPermission('delete');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should attach role info to request', () => {
      const middleware = requireAppointmentPermission('read');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect((mockReq as any).appointmentRole).toBe('pharmacist');
      expect((mockReq as any).canManageAppointments).toBe(false);
    });
  });

  describe('checkAppointmentOwnership', () => {
    it('should allow owner to access any appointment', async () => {
      mockReq.user!.workplaceRole = 'Owner';
      mockReq.params = { id: 'appointment123' };

      await checkAppointmentOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow super admin to access any appointment', async () => {
      mockReq.user!.role = 'super_admin';
      mockReq.params = { id: 'appointment123' };

      await checkAppointmentOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow pharmacist to access assigned appointment', async () => {
      mockReq.params = { id: 'appointment123' };
      const mockAppointment = {
        _id: 'appointment123',
        workplaceId: 'workspace123',
        assignedTo: 'user123',
        createdBy: 'otherUser',
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);

      await checkAppointmentOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).appointment).toEqual(mockAppointment);
    });

    it('should deny pharmacist access to unassigned appointment', async () => {
      mockReq.params = { id: 'appointment123' };
      const mockAppointment = {
        _id: 'appointment123',
        workplaceId: 'workspace123',
        assignedTo: 'otherUser',
        createdBy: 'anotherUser',
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);

      await checkAppointmentOwnership(
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

    it('should deny access to appointment from different workspace', async () => {
      mockReq.params = { id: 'appointment123' };
      const mockAppointment = {
        _id: 'appointment123',
        workplaceId: 'differentWorkspace',
        assignedTo: 'user123',
        createdBy: 'user123',
      };

      (Appointment.findById as jest.Mock).mockResolvedValue(mockAppointment);

      await checkAppointmentOwnership(
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

    it('should return 404 when appointment not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      (Appointment.findById as jest.Mock).mockResolvedValue(null);

      await checkAppointmentOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'APPOINTMENT_NOT_FOUND',
        })
      );
    });

    it('should skip check when no appointment ID in params', async () => {
      mockReq.params = {};

      await checkAppointmentOwnership(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(Appointment.findById).not.toHaveBeenCalled();
    });
  });

  describe('checkAppointmentFeatureAccess', () => {
    it('should allow access when feature is available', async () => {
      await checkAppointmentFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access when feature is not available', async () => {
      mockReq.workspaceContext!.permissions = [];

      await checkAppointmentFeatureAccess(
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
          feature: 'appointmentScheduling',
          upgradeRequired: true,
        })
      );
    });

    it('should deny access when subscription is not active', async () => {
      mockReq.workspaceContext!.workspace!.subscriptionStatus = 'cancelled';

      await checkAppointmentFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'SUBSCRIPTION_REQUIRED',
        })
      );
    });

    it('should allow access during trial period', async () => {
      mockReq.workspaceContext!.workspace!.subscriptionStatus = 'trial';

      await checkAppointmentFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should bypass checks for super admin', async () => {
      mockReq.user!.role = 'super_admin';
      mockReq.workspaceContext!.permissions = [];

      await checkAppointmentFeatureAccess(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Specific permission middlewares', () => {
    it('requireAppointmentRead should check read permission', () => {
      requireAppointmentRead(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAppointmentCreate should check create permission', () => {
      requireAppointmentCreate(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAppointmentUpdate should check update permission', () => {
      requireAppointmentUpdate(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('requireAppointmentDelete should deny delete for pharmacist', () => {
      requireAppointmentDelete(mockReq as AuthRequest, mockRes as Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
