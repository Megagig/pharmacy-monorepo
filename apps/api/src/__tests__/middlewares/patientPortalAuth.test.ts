/**
 * Patient Portal Authentication Middleware Unit Tests
 * Tests enhanced authentication with account status checks and workspace validation
 * Requirements: 3.4, 3.5, 14.1
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  patientAuth,
  patientAuthOptional,
  requireActivePatient,
  requireEmailVerification,
  requireLinkedPatient,
  validateWorkspaceContext,
  patientRateLimit,
  auditPatientAction,
  PatientAuthRequest,
} from '../../middlewares/patientPortalAuth';
import PatientUser from '../../models/PatientUser';
import Workplace from '../../models/Workplace';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/PatientUser');
jest.mock('../../models/Workplace');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockPatientUser = PatientUser as jest.Mocked<typeof PatientUser>;
const mockWorkplace = Workplace as jest.Mocked<typeof Workplace>;

describe('Patient Portal Authentication Middleware', () => {
  let req: Partial<PatientAuthRequest>;
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
      params: {},
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

  describe('patientAuth', () => {
    const mockWorkplaceId = new mongoose.Types.ObjectId();
    const mockPatientId = new mongoose.Types.ObjectId();
    const mockPatientUserId = new mongoose.Types.ObjectId();

    const createMockPatient = (overrides = {}) => ({
      _id: mockPatientUserId,
      email: 'patient@test.com',
      firstName: 'John',
      lastName: 'Doe',
      workplaceId: mockWorkplaceId,
      status: 'active',
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      lockUntil: null,
      patientId: mockPatientId,
      ...overrides,
    });

    const createMockWorkplace = (overrides = {}) => ({
      _id: mockWorkplaceId,
      name: 'Test Pharmacy',
      subscriptionStatus: 'active',
      ...overrides,
    });

    it('should authenticate valid active patient', async () => {
      // Arrange
      const mockPatient = createMockPatient();
      const mockWorkplaceData = createMockWorkplace();

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        email: 'patient@test.com',
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      mockWorkplace.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockWorkplaceData),
        }),
      } as any);

      mockPatientUser.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.patient).toEqual({
        _id: mockPatientUserId.toString(),
        email: 'patient@test.com',
        workplaceId: mockWorkplaceId.toString(),
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        patientId: mockPatientId.toString(),
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      });
      expect(req.workplaceId).toBe(mockWorkplaceId.toString());
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request with no token', async () => {
      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Please log in to continue.',
        code: 'NO_TOKEN',
        requiresAuth: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token type', async () => {
      // Arrange
      req.cookies!.patientAccessToken = 'invalid-type-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        type: 'admin', // Wrong type
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token type. Patient authentication required.',
        code: 'INVALID_TOKEN_TYPE',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when patient not found', async () => {
      // Arrange
      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Patient account not found. Please register or contact support.',
        code: 'PATIENT_NOT_FOUND',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject locked account', async () => {
      // Arrange
      const lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const mockPatient = createMockPatient({ lockUntil });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(423);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'ACCOUNT_LOCKED',
          lockUntil: lockUntil,
          minutesRemaining: expect.any(Number),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject pending account without email verification', async () => {
      // Arrange
      const mockPatient = createMockPatient({
        status: 'pending',
        emailVerified: false,
      });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Please verify your email address before accessing the patient portal.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
        status: 'pending',
        requiresAction: 'email_verification',
        email: 'patient@test.com',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject pending account awaiting approval', async () => {
      // Arrange
      const mockPatient = createMockPatient({
        status: 'pending',
        emailVerified: true,
      });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your account is pending approval from the pharmacy administrator. You will be notified once approved.',
        code: 'ACCOUNT_PENDING_APPROVAL',
        status: 'pending',
        requiresAction: 'admin_approval',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject suspended account', async () => {
      // Arrange
      const mockPatient = createMockPatient({ status: 'suspended' });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your account has been suspended. Please contact the pharmacy for assistance.',
        code: 'ACCOUNT_SUSPENDED',
        status: 'suspended',
        requiresAction: 'contact_support',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject inactive account', async () => {
      // Arrange
      const mockPatient = createMockPatient({ isActive: false });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your account access has been disabled. Please contact the pharmacy.',
        code: 'ACCOUNT_DISABLED',
        requiresAction: 'contact_support',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when workplace not found', async () => {
      // Arrange
      const mockPatient = createMockPatient();

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      mockWorkplace.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Associated pharmacy not found. Please contact support.',
        code: 'WORKPLACE_NOT_FOUND',
        requiresAction: 'contact_support',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when workplace is inactive', async () => {
      // Arrange
      const mockPatient = createMockPatient();
      const mockWorkplaceData = createMockWorkplace({
        subscriptionStatus: 'suspended',
      });

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      mockWorkplace.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockWorkplaceData),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'The associated pharmacy is currently inactive. Please contact them directly.',
        code: 'WORKPLACE_INACTIVE',
        workplaceStatus: 'suspended',
        requiresAction: 'contact_pharmacy',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject workspace context mismatch', async () => {
      // Arrange
      const differentWorkplaceId = new mongoose.Types.ObjectId();
      const mockPatient = createMockPatient();

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: differentWorkplaceId.toString(), // Different from patient's workspace
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      const mockWorkplaceData = createMockWorkplace();
      mockWorkplace.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockWorkplaceData),
        }),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Workspace context mismatch. Please log in again.',
        code: 'WORKSPACE_MISMATCH',
        requiresAuth: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle Authorization header token', async () => {
      // Arrange
      const mockPatient = createMockPatient();
      const mockWorkplaceData = createMockWorkplace();

      (req.header as jest.Mock).mockReturnValue('Bearer valid-token');
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        workspaceId: mockWorkplaceId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      mockWorkplace.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockWorkplaceData),
        }),
      } as any);

      mockPatientUser.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as any);

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(req.header).toHaveBeenCalledWith('Authorization');
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(next).toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      // Arrange
      req.cookies!.patientAccessToken = 'expired-token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      // Act
      await patientAuth(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
        requiresRefresh: true,
        requiresAuth: true,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('patientAuthOptional', () => {
    it('should proceed without token', async () => {
      // Act
      await patientAuthOptional(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(req.patient).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set patient info for valid token', async () => {
      // Arrange
      const mockPatientUserId = new mongoose.Types.ObjectId();
      const mockWorkplaceId = new mongoose.Types.ObjectId();
      const mockPatient = {
        _id: mockPatientUserId,
        email: 'patient@test.com',
        firstName: 'John',
        lastName: 'Doe',
        workplaceId: mockWorkplaceId,
        status: 'active',
        isActive: true,
        emailVerified: true,
        phoneVerified: false,
        lockUntil: null,
      };

      req.cookies!.patientAccessToken = 'valid-token';
      mockJwt.verify.mockReturnValue({
        patientUserId: mockPatientUserId.toString(),
        type: 'patient',
      } as any);

      mockPatientUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPatient),
          }),
        }),
      } as any);

      // Act
      await patientAuthOptional(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(req.patient).toBeDefined();
      expect(req.patient!.email).toBe('patient@test.com');
      expect(next).toHaveBeenCalled();
    });

    it('should ignore errors and proceed', async () => {
      // Arrange
      req.cookies!.patientAccessToken = 'invalid-token';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      await patientAuthOptional(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(req.patient).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireActivePatient', () => {
    it('should allow active patient', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        status: 'active',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireActivePatient(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when no patient auth', () => {
      // Act
      requireActivePatient(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Patient authentication required.',
        code: 'NO_PATIENT_AUTH',
        requiresAuth: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-active patient', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        status: 'pending',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireActivePatient(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Active patient account required.',
        code: 'PATIENT_NOT_ACTIVE',
        status: 'pending',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireEmailVerification', () => {
    it('should allow verified email', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        emailVerified: true,
        status: 'active',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireEmailVerification(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject unverified email', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        emailVerified: false,
        status: 'active',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireEmailVerification(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email verification required to access this feature.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
        requiresAction: 'email_verification',
        email: 'patient@test.com',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireLinkedPatient', () => {
    it('should allow linked patient', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        patientId: 'linked-patient-id',
        status: 'active',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireLinkedPatient(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject unlinked patient', () => {
      // Arrange
      req.patient = {
        _id: 'patient-id',
        email: 'patient@test.com',
        status: 'active',
        workplaceId: 'workplace-id',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      };

      // Act
      requireLinkedPatient(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your account must be linked to a patient record to access this feature. Please contact the pharmacy.',
        code: 'PATIENT_RECORD_NOT_LINKED',
        requiresAction: 'contact_pharmacy',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkspaceContext', () => {
    it('should allow matching workspace', () => {
      // Arrange
      req.patient = { workplaceId: 'workspace-123' } as any;
      req.workplaceId = 'workspace-123';
      req.params = { workspaceId: 'workspace-123' };

      // Act
      validateWorkspaceContext(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject workspace mismatch', () => {
      // Arrange
      req.patient = { workplaceId: 'workspace-123' } as any;
      req.workplaceId = 'workspace-123';
      req.params = { workspaceId: 'workspace-456' };

      // Act
      validateWorkspaceContext(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. You can only access resources from your associated pharmacy.',
        code: 'WORKSPACE_ACCESS_DENIED',
        userWorkspaceId: 'workspace-123',
        requestedWorkspaceId: 'workspace-456',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('patientRateLimit', () => {
    it('should allow first request', () => {
      // Arrange
      req.patient = { _id: 'patient-123' } as any;
      const middleware = patientRateLimit(5, 60000); // 5 requests per minute

      // Act
      middleware(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests within limit', () => {
      // Arrange
      req.patient = { _id: 'patient-123' } as any;
      const middleware = patientRateLimit(5, 60000);

      // Act - Make multiple requests
      for (let i = 0; i < 5; i++) {
        middleware(req as PatientAuthRequest, res as Response, next);
      }

      // Assert
      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject requests over limit', () => {
      // Arrange
      req.patient = { _id: 'patient-123' } as any;
      const middleware = patientRateLimit(2, 60000); // 2 requests per minute

      // Act - Make requests over limit
      middleware(req as PatientAuthRequest, res as Response, next);
      middleware(req as PatientAuthRequest, res as Response, next);
      middleware(req as PatientAuthRequest, res as Response, next); // This should be rejected

      // Assert
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: 2,
        })
      );
    });

    it('should skip rate limiting for unauthenticated requests', () => {
      // Arrange
      const middleware = patientRateLimit(1, 60000);

      // Act
      middleware(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('auditPatientAction', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log patient action in development', () => {
      // Arrange
      req.patient = {
        _id: 'patient-123',
        email: 'patient@test.com',
        workplaceId: 'workspace-123',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
        isAccountLocked: false,
      };
      req.workplaceId = 'workspace-123';
      req.method = 'POST';
      req.url = '/api/patient-portal/profile';
      req.body = { firstName: 'John' };
      req.query = { tab: 'personal' };
      (req.get as jest.Mock).mockReturnValue('Mozilla/5.0');

      const middleware = auditPatientAction('UPDATE_PROFILE');

      // Act
      middleware(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '👤 Patient Action Audit:',
        expect.objectContaining({
          action: 'UPDATE_PROFILE',
          patientId: 'patient-123',
          patientEmail: 'patient@test.com',
          workplaceId: 'workspace-123',
          method: 'POST',
          url: '/api/patient-portal/profile',
          body: { firstName: 'John' },
          query: { tab: 'personal' },
          userAgent: 'Mozilla/5.0',
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not log in production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      req.patient = { _id: 'patient-123', email: 'patient@test.com' } as any;

      const middleware = auditPatientAction('TEST_ACTION');

      // Act
      middleware(req as PatientAuthRequest, res as Response, next);

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});