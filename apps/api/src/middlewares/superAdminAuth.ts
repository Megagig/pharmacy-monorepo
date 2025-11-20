import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';

/**
 * Extended request interface for Super Admin authentication
 */
export interface SuperAdminAuthRequest extends Request {
  user?: IUser;
  superAdmin?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * Super Admin authentication middleware for patient portal blog management
 * Verifies user is authenticated and has super_admin role
 * Returns 403 if not authorized
 */
export const superAdminAuth = async (
  req: SuperAdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Special bypass for super_admin testing (development only)
    if (process.env.NODE_ENV === 'development' && req.header('X-Super-Admin-Test') === 'true') {
      // Create a mock super_admin user for testing
      req.user = {
        _id: '68b5cb81f1f0f9758b8afadd',
        email: 'super_admin@test.com',
        role: 'super_admin',
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        status: 'active',
      } as any;
      
      req.superAdmin = {
        _id: '68b5cb81f1f0f9758b8afadd',
        email: 'super_admin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
      };
      
      next();
      return;
    }

    // Try to get token from httpOnly cookie first, fallback to Authorization header
    const token =
      req.cookies.accessToken ||
      req.cookies.token ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.',
        code: 'NO_TOKEN',
        requiresAuth: true,
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId?: string;
      id?: string; // Support old token format
    };

    // Handle both old and new token formats
    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Get user from database
    const user = await User.findById(userId)
      .select('-passwordHash -refreshTokens')
      .lean();

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Check if user account is active
    if (!user.isActive || user.status !== 'active') {
      res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
        status: user.status,
      });
      return;
    }

    // Verify user has super_admin role
    if (user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Super Administrator access required. This action is restricted to system administrators.',
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: user.role,
        requiredRole: 'super_admin',
      });
      return;
    }

    // Attach user info to request
    req.user = user as IUser;
    req.superAdmin = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    next();
  } catch (error: any) {
    // Handle JWT-specific errors
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
        requiresRefresh: true,
      });
      return;
    }

    if (error.name === 'NotBeforeError') {
      res.status(401).json({
        success: false,
        message: 'Authentication token is not yet valid.',
        code: 'TOKEN_NOT_ACTIVE',
      });
      return;
    }

    // Log error for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('Super Admin auth middleware error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Middleware to verify Super Admin role without full authentication
 * Assumes user is already authenticated by another middleware
 */
export const requireSuperAdminRole = (
  req: SuperAdminAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Check if user is attached to request (from previous auth middleware)
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 'NO_USER',
    });
    return;
  }

  // Verify super_admin role
  if (req.user.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      message: 'Super Administrator access required.',
      code: 'INSUFFICIENT_PERMISSIONS',
      userRole: req.user.role,
      requiredRole: 'super_admin',
    });
    return;
  }

  // Attach super admin info for convenience
  req.superAdmin = {
    _id: req.user._id.toString(),
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    role: req.user.role,
  };

  next();
};

/**
 * Middleware to check if user has super admin privileges
 * Can be used in combination with other auth middlewares
 */
export const checkSuperAdminAccess = (
  req: SuperAdminAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // If no user is authenticated, deny access
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required for administrative access.',
      code: 'NO_AUTH',
    });
    return;
  }

  // Check for super admin role
  const isSuperAdmin = req.user.role === 'super_admin';
  
  if (!isSuperAdmin) {
    res.status(403).json({
      success: false,
      message: 'Administrative privileges required.',
      code: 'ADMIN_REQUIRED',
      userRole: req.user.role,
    });
    return;
  }

  next();
};

/**
 * Optional Super Admin authentication
 * Allows requests to proceed even if user is not super admin
 * Sets req.isSuperAdmin flag for conditional logic
 */
export const optionalSuperAdminAuth = async (
  req: SuperAdminAuthRequest & { isSuperAdmin?: boolean },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to get token
    const token =
      req.cookies.accessToken ||
      req.cookies.token ||
      req.header('Authorization')?.replace('Bearer ', '');

    // Default to not super admin
    req.isSuperAdmin = false;

    if (!token) {
      next();
      return;
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId?: string;
      id?: string;
    };

    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      next();
      return;
    }

    // Get user
    const user = await User.findById(userId)
      .select('-passwordHash -refreshTokens')
      .lean();

    if (!user || !user.isActive || user.status !== 'active') {
      next();
      return;
    }

    // Check if super admin
    if (user.role === 'super_admin') {
      req.user = user as IUser;
      req.superAdmin = {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
      req.isSuperAdmin = true;
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    req.isSuperAdmin = false;
    next();
  }
};

/**
 * Audit logging middleware for Super Admin actions
 * Logs all Super Admin actions for security and compliance
 */
export const auditSuperAdminAction = (action: string) => {
  return (
    req: SuperAdminAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // Log the action (in production, this would go to a proper audit log)
    const auditData = {
      timestamp: new Date().toISOString(),
      action,
      superAdminId: req.superAdmin?._id,
      superAdminEmail: req.superAdmin?.email,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Super Admin Action Audit:', auditData);
    }

    // In production, this would be sent to a secure audit logging service
    // Example: await AuditLog.create(auditData);

    next();
  };
};

export default {
  superAdminAuth,
  requireSuperAdminRole,
  checkSuperAdminAccess,
  optionalSuperAdminAuth,
  auditSuperAdminAction,
};