import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import logger from '../utils/logger';

// Extend Request interface for patient portal authentication
export interface PatientPortalRequest extends Request {
  patientUser?: {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    patientId?: mongoose.Types.ObjectId;
  };
  workplaceId?: mongoose.Types.ObjectId;
}

/**
 * Patient Portal Authentication Middleware
 * Verifies JWT token and ensures patient user is active
 */
export const patientPortalAuth = async (
  req: PatientPortalRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header OR httpOnly cookie
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer' prefix
    } else if (req.cookies?.patientAccessToken) {
      // Check for httpOnly cookie
      token = req.cookies.patientAccessToken;
    }

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Patient portal auth check', {
        path: req.path,
        hasAuthHeader: !!authHeader,
        hasCookie: !!req.cookies?.patientAccessToken,
        cookieNames: Object.keys(req.cookies || {}),
        hasToken: !!token,
      });
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
      });
      return;
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (jwtError: any) {
      logger.warn('Invalid JWT token for patient portal', {
        error: jwtError.message,
        token: token.substring(0, 20) + '...',
      });

      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    // Validate token payload
    if (!decoded.patientUserId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'TOKEN_INVALID_FORMAT',
      });
      return;
    }

    // Fetch patient user from database
    const patientUser = await PatientUser.findOne({
      _id: decoded.patientUserId,
      isDeleted: false,
    }).lean();

    if (!patientUser) {
      res.status(401).json({
        success: false,
        message: 'Patient user not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Check account status
    if (patientUser.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'Account has been suspended',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    if (patientUser.status === 'pending') {
      res.status(403).json({
        success: false,
        message: 'Account is pending approval',
        code: 'ACCOUNT_PENDING',
      });
      return;
    }

    if (patientUser.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'Account is not active',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Check if account is locked
    if (patientUser.isLocked && patientUser.isLocked()) {
      res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
      });
      return;
    }

    // Attach patient user data to request
    req.patientUser = {
      _id: patientUser._id,
      workplaceId: patientUser.workplaceId,
      firstName: patientUser.firstName,
      lastName: patientUser.lastName,
      email: patientUser.email,
      status: patientUser.status,
      patientId: patientUser.patientId,
    };

    req.workplaceId = patientUser.workplaceId;

    // Update last activity (optional - can be done periodically instead)
    try {
      await PatientUser.updateOne(
        { _id: patientUser._id },
        { lastLoginAt: new Date() }
      );
    } catch (updateError: any) {
      // Don't fail the request if activity update fails
      logger.warn('Failed to update patient last activity', {
        error: updateError.message,
        patientUserId: patientUser._id,
      });
    }

    logger.debug('Patient portal authentication successful', {
      patientUserId: patientUser._id,
      workplaceId: patientUser.workplaceId,
      email: patientUser.email,
    });

    next();
  } catch (error: any) {
    logger.error('Error in patient portal authentication middleware', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR',
    });
  }
};

/**
 * Optional middleware to validate workspace context
 * Ensures the patient belongs to the specified workspace
 */
export const validateWorkspaceContext = (
  req: PatientPortalRequest,
  res: Response,
  next: NextFunction
): void => {
  const workspaceIdParam = req.params.workspaceId;

  if (workspaceIdParam) {
    if (!mongoose.Types.ObjectId.isValid(workspaceIdParam)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace ID format',
        code: 'INVALID_WORKSPACE_ID',
      });
      return;
    }

    const requestedWorkspaceId = new mongoose.Types.ObjectId(workspaceIdParam);

    if (!req.patientUser?.workplaceId.equals(requestedWorkspaceId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this workspace',
        code: 'WORKSPACE_ACCESS_DENIED',
      });
      return;
    }
  }

  next();
};

/**
 * Rate limiting middleware for patient portal endpoints
 */
export const patientPortalRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: PatientPortalRequest, res: Response, next: NextFunction): void => {
    const patientUserId = req.patientUser?._id.toString();

    if (!patientUserId) {
      next();
      return;
    }

    const now = Date.now();
    const userRequests = requests.get(patientUserId);

    if (!userRequests || now > userRequests.resetTime) {
      // Reset or initialize counter
      requests.set(patientUserId, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      });
      return;
    }

    // Increment counter
    userRequests.count++;
    next();
  };
};

/**
 * Middleware to log patient portal activity for audit purposes
 */
export const logPatientActivity = (action: string) => {
  return (req: PatientPortalRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (data: any) {
      // Log activity after response is sent
      setImmediate(() => {
        logger.info('Patient portal activity', {
          action,
          patientUserId: req.patientUser?._id,
          workplaceId: req.patientUser?.workplaceId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date(),
        });
      });

      return originalSend.call(this, data);
    };

    next();
  };
};

export default patientPortalAuth;