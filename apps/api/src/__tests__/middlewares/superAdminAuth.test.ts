/**
 * Super Admin Authentication Middleware Unit Tests
 * Tests authentication and authorization for Super Admin users
 * Requirements: 2.1, 2.10
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  superAdminAuth,
  requireSuperAdminRole,
  checkSuperAdminAccess,
  optionalSuperAdminAuth,
  auditSuperAdminAction,
  SuperAdminAuthRequest,
} from '../../middlewares/superAdminAuth';
import User from '../../models/User';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/User');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockUser = User as jest.Mocked<typeof User>;

describe('Super Admin Authentication Middleware', () => {
  let req: Partial<SuperAdminAuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      cookies: {},
      header: jest.fn(),
      url: '/test',
      method: 'GET',
      body: {},
      query: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
      get: jest.fn(),
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Set default environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('superAdminAuth', () => {
    it('should authenticate valid super admin user', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const mockSuperAdmin = {
        _id: mockUserId,
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
        isActive: true,
        status: 'active',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSuperAdmin),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockUser.findById).toHaveBeenCalledWith(mockUserId.toString());
      expect(req.user).toEqual(mockSuperAdmin);
      expect(req.superAdmin).toEqual({
        _id: mockUserId.toString(),
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request with no token', async () => {
      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Authentication required.',
        code: 'NO_TOKEN',
        requiresAuth: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      // Arrange
      req.cookies!.accessToken = 'invalid-token';
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid authentication token.',
        code: 'INVALID_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Arrange
      req.cookies!.accessToken = 'expired-token';
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
        requiresRefresh: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token with no user ID', async () => {
      // Arrange
      req.cookies!.accessToken = 'token-without-userid';
      mockJwt.verify.mockReturnValue({} as any); // No userId or id field

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user not found', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found. Please log in again.',
        code: 'USER_NOT_FOUND',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject inactive user', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const inactiveUser = {
        _id: mockUserId,
        email: 'admin@test.com',
        role: 'super_admin',
        isActive: false,
        status: 'suspended',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(inactiveUser),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is not active. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
        status: 'suspended',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-super-admin user', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const regularUser = {
        _id: mockUserId,
        email: 'user@test.com',
        role: 'pharmacist',
        isActive: true,
        status: 'active',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(regularUser),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Super Administrator access required. This action is restricted to system administrators.',
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: 'pharmacist',
        requiredRole: 'super_admin',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle Authorization header token', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const mockSuperAdmin = {
        _id: mockUserId,
        email: 'admin@test.com',
        role: 'super_admin',
        isActive: true,
        status: 'active',
        firstName: 'Super',
        lastName: 'Admin',
      };

      (req.header as jest.Mock).mockReturnValue('Bearer valid-token');
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSuperAdmin),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(next).toHaveBeenCalled();
    });

    it('should handle old token format with id field', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const mockSuperAdmin = {
        _id: mockUserId,
        email: 'admin@test.com',
        role: 'super_admin',
        isActive: true,
        status: 'active',
        firstName: 'Super',
        lastName: 'Admin',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ id: mockUserId.toString() } as any); // Old format
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSuperAdmin),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(mockUser.findById).toHaveBeenCalledWith(mockUserId.toString());
      expect(next).toHaveBeenCalled();
    });

    it('should handle development bypass', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      (req.header as jest.Mock).mockReturnValue('true');

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(req.user).toBeDefined();
      expect(req.user!.role).toBe('super_admin');
      expect(req.superAdmin).toBeDefined();
      expect(next).toHaveBeenCalled();
      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      // Act
      await superAdminAuth(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication failed due to server error.',
        code: 'AUTH_ERROR',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperAdminRole', () => {
    it('should allow super admin user', () => {
      // Arrange
      req.user = {
        role: 'super_admin',
        _id: 'user-id',
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
      } as any;

      // Act
      requireSuperAdminRole(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(req.superAdmin).toEqual({
        _id: 'user-id',
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when no user in request', () => {
      // Act
      requireSuperAdminRole(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required.',
        code: 'NO_USER',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-super-admin user', () => {
      // Arrange
      req.user = {
        role: 'pharmacist',
        _id: 'user-id',
        email: 'user@test.com',
      } as any;

      // Act
      requireSuperAdminRole(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Super Administrator access required.',
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: 'pharmacist',
        requiredRole: 'super_admin',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkSuperAdminAccess', () => {
    it('should allow super admin access', () => {
      // Arrange
      req.user = { role: 'super_admin' } as any;

      // Act
      checkSuperAdminAccess(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when no user authenticated', () => {
      // Act
      checkSuperAdminAccess(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required for administrative access.',
        code: 'NO_AUTH',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      // Arrange
      req.user = { role: 'pharmacist' } as any;

      // Act
      checkSuperAdminAccess(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrative privileges required.',
        code: 'ADMIN_REQUIRED',
        userRole: 'pharmacist',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalSuperAdminAuth', () => {
    it('should set isSuperAdmin true for valid super admin', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const mockSuperAdmin = {
        _id: mockUserId,
        email: 'admin@test.com',
        role: 'super_admin',
        isActive: true,
        status: 'active',
        firstName: 'Super',
        lastName: 'Admin',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSuperAdmin),
        }),
      } as any);

      // Act
      await optionalSuperAdminAuth(req as any, res as Response, next);

      // Assert
      expect((req as any).isSuperAdmin).toBe(true);
      expect(req.user).toEqual(mockSuperAdmin);
      expect(req.superAdmin).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set isSuperAdmin false for no token', async () => {
      // Act
      await optionalSuperAdminAuth(req as any, res as Response, next);

      // Assert
      expect((req as any).isSuperAdmin).toBe(false);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set isSuperAdmin false for non-super-admin', async () => {
      // Arrange
      const mockUserId = new mongoose.Types.ObjectId();
      const regularUser = {
        _id: mockUserId,
        email: 'user@test.com',
        role: 'pharmacist',
        isActive: true,
        status: 'active',
      };

      req.cookies!.accessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({ userId: mockUserId.toString() } as any);
      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(regularUser),
        }),
      } as any);

      // Act
      await optionalSuperAdminAuth(req as any, res as Response, next);

      // Assert
      expect((req as any).isSuperAdmin).toBe(false);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      req.cookies!.accessToken = 'invalid-token';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token error');
      });

      // Act
      await optionalSuperAdminAuth(req as any, res as Response, next);

      // Assert
      expect((req as any).isSuperAdmin).toBe(false);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('auditSuperAdminAction', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log super admin action in development', () => {
      // Arrange
      req.superAdmin = {
        _id: 'admin-id',
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
      };
      req.method = 'POST';
      req.url = '/api/blog/posts';
      req.body = { title: 'Test Post' };
      req.query = { category: 'health' };
      (req.get as jest.Mock).mockReturnValue('Mozilla/5.0');

      const middleware = auditSuperAdminAction('CREATE_BLOG_POST');

      // Act
      middleware(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔐 Super Admin Action Audit:',
        expect.objectContaining({
          action: 'CREATE_BLOG_POST',
          superAdminId: 'admin-id',
          superAdminEmail: 'admin@test.com',
          method: 'POST',
          url: '/api/blog/posts',
          body: { title: 'Test Post' },
          query: { category: 'health' },
          userAgent: 'Mozilla/5.0',
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not log in production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      req.superAdmin = {
        _id: 'admin-id',
        email: 'admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
      };

      const middleware = auditSuperAdminAction('DELETE_BLOG_POST');

      // Act
      middleware(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing super admin info', () => {
      // Arrange
      const middleware = auditSuperAdminAction('TEST_ACTION');

      // Act
      middleware(req as SuperAdminAuthRequest, res as Response, next);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔐 Super Admin Action Audit:',
        expect.objectContaining({
          action: 'TEST_ACTION',
          superAdminId: undefined,
          superAdminEmail: undefined,
        })
      );
      expect(next).toHaveBeenCalled();
    });
  });
});