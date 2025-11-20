import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IUser } from '../models/User';
import logger from '../utils/logger';

/**
 * Extended request interface for Workspace Admin authentication
 */
export interface WorkspaceAdminAuthRequest extends Request {
  user?: IUser & {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    role: string;
  };
  workplaceId?: mongoose.Types.ObjectId;
}

/**
 * Workspace Admin authentication middleware
 * Verifies user is authenticated and has workspace admin privileges
 * Returns 403 if not authorized
 */
export const workspaceAdminAuth = async (
  req: WorkspaceAdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated (should be set by auth middleware)
    if (!req.user) {
      logger.warn('Workspace admin auth failed - no user in request', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      return;
    }

    // Check if user has workspace admin role
    const allowedRoles = ['owner', 'pharmacy_outlet', 'pharmacy_team', 'pharmacist', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Workspace admin auth failed - insufficient role', {
        userId: req.user._id,
        userRole: req.user.role,
        allowedRoles,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: 'Workspace administrator access required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    // Check if user has a workplace OR is super admin with workspace override
    // Super admins can specify workspaceId via query parameter to access any workspace
    const superAdminWorkspaceOverride = req.user.role === 'super_admin' && req.query.workspaceId;
    
    if (!req.user.workplaceId && !superAdminWorkspaceOverride) {
      logger.warn('Workspace admin auth failed - no workplace', {
        userId: req.user._id,
        userRole: req.user.role,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: 'Workplace association required',
        code: 'NO_WORKPLACE',
      });
      return;
    }

    // Set workplace context for the request
    // Super admins can override with query parameter
    if (req.user.role === 'super_admin' && req.query.workspaceId) {
      req.workplaceId = new mongoose.Types.ObjectId(req.query.workspaceId as string);
      logger.info('Super admin accessing workspace with override', {
        userId: req.user._id,
        targetWorkspaceId: req.workplaceId,
        path: req.path,
        method: req.method,
      });
    } else {
      req.workplaceId = req.user.workplaceId;
    }

    logger.info('Workspace admin auth successful', {
      userId: req.user._id,
      userRole: req.user.role,
      workplaceId: req.workplaceId,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error: any) {
    logger.error('Workspace admin auth error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Require specific workspace admin role
 * More restrictive than general workspace admin auth
 */
export const requireWorkspaceAdminRole = (...roles: string[]) => {
  return (
    req: WorkspaceAdminAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Workspace admin role check failed', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: 'Insufficient role permissions',
        code: 'INSUFFICIENT_ROLE',
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Check workspace admin access with optional bypass for super admin
 */
export const checkWorkspaceAdminAccess = (
  req: WorkspaceAdminAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
    });
    return;
  }

  // Super admin has access to all workspaces
  if (req.user.role === 'super_admin') {
    logger.info('Super admin access granted for workspace admin operation', {
      userId: req.user._id,
      path: req.path,
      method: req.method,
    });
    next();
    return;
  }

  // Regular workspace admin access check
  const allowedRoles = ['owner', 'pharmacy_outlet', 'pharmacy_team', 'pharmacist'];
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      error: 'Workspace administrator access required',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRoles: allowedRoles,
      userRole: req.user.role,
    });
    return;
  }

  if (!req.user.workplaceId) {
    res.status(403).json({
      success: false,
      error: 'Workplace association required',
      code: 'NO_WORKPLACE',
    });
    return;
  }

  next();
};

/**
 * Optional workspace admin auth - sets flag but doesn't block
 * Useful for endpoints that have different behavior for admins
 */
export const optionalWorkspaceAdminAuth = async (
  req: WorkspaceAdminAuthRequest & { isWorkspaceAdmin?: boolean },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Default to false
    req.isWorkspaceAdmin = false;

    if (req.user) {
      const allowedRoles = ['owner', 'pharmacy_outlet', 'pharmacy_team', 'pharmacist', 'super_admin'];
      if (allowedRoles.includes(req.user.role) && req.user.workplaceId) {
        req.isWorkspaceAdmin = true;
        req.workplaceId = req.user.workplaceId;

        logger.info('Optional workspace admin auth - admin detected', {
          userId: req.user._id,
          userRole: req.user.role,
          workplaceId: req.user.workplaceId,
          path: req.path,
        });
      }
    }

    next();
  } catch (error: any) {
    logger.error('Optional workspace admin auth error', {
      error: error.message,
      path: req.path,
      method: req.method,
      userId: req.user?._id,
    });

    // Don't block the request, just continue without admin flag
    req.isWorkspaceAdmin = false;
    next();
  }
};

/**
 * Audit workspace admin actions
 * Logs important administrative actions for compliance
 */
export const auditWorkspaceAdminAction = (action: string) => {
  return (
    req: WorkspaceAdminAuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (body: any) {
      // Log the action after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.info('Workspace admin action completed', {
          action,
          userId: req.user?._id,
          userRole: req.user?.role,
          workplaceId: req.user?.workplaceId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
          requestBody: req.method !== 'GET' ? req.body : undefined,
          responseSuccess: body?.success,
        });
      } else {
        logger.warn('Workspace admin action failed', {
          action,
          userId: req.user?._id,
          userRole: req.user?.role,
          workplaceId: req.user?.workplaceId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          error: body?.error,
          ip: req.ip,
          timestamp: new Date().toISOString(),
        });
      }

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Validate workspace context
 * Ensures the requested workspace matches user's workspace (unless super admin)
 */
export const validateWorkspaceContext = (
  req: WorkspaceAdminAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
    });
    return;
  }

  // Super admin can access any workspace
  if (req.user.role === 'super_admin') {
    next();
    return;
  }

  // Extract workspace ID from params or body
  const requestedWorkspaceId = req.params.workspaceId || req.body.workspaceId;
  
  if (requestedWorkspaceId && req.user.workplaceId) {
    if (requestedWorkspaceId !== req.user.workplaceId.toString()) {
      logger.warn('Workspace context validation failed', {
        userId: req.user._id,
        userWorkplaceId: req.user.workplaceId,
        requestedWorkspaceId,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: 'Access denied to requested workspace',
        code: 'WORKSPACE_ACCESS_DENIED',
      });
      return;
    }
  }

  next();
};

export default {
  workspaceAdminAuth,
  requireWorkspaceAdminRole,
  checkWorkspaceAdminAccess,
  optionalWorkspaceAdminAuth,
  auditWorkspaceAdminAction,
  validateWorkspaceContext,
};