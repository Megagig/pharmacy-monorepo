import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

/**
 * Follow-up Task Management RBAC Middleware
 * Implements role-based access control for Follow-up Task Management module
 *
 * Roles:
 * - owner: Full access (create, read, update, delete, manage, assign)
 * - pharmacist: Full access to own tasks and assigned tasks
 * - technician: Read-only access to tasks
 * - assistant: Read-only access to tasks
 */

export type FollowUpManagementRole =
  | 'owner'
  | 'pharmacist'
  | 'technician'
  | 'assistant'
  | 'admin';

export type FollowUpManagementAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'assign'
  | 'complete'
  | 'escalate'
  | 'convert_to_appointment';

// Define role permissions for Follow-up Task Management
const FOLLOWUP_MANAGEMENT_PERMISSIONS: Record<
  FollowUpManagementRole,
  FollowUpManagementAction[]
> = {
  owner: ['create', 'read', 'update', 'delete', 'manage', 'assign', 'complete', 'escalate', 'convert_to_appointment'],
  pharmacist: ['create', 'read', 'update', 'complete', 'escalate', 'convert_to_appointment'],
  technician: ['read'],
  assistant: ['read'],
  admin: ['create', 'read', 'update', 'delete', 'manage', 'assign', 'complete', 'escalate', 'convert_to_appointment'],
};

/**
 * Map system roles to Follow-up Management roles
 */
const mapToFollowUpManagementRole = (
  systemRole: string,
  workplaceRole?: string
): FollowUpManagementRole => {
  // Super admin has full access
  if (systemRole === 'super_admin') {
    return 'admin';
  }

  // Map workplace roles
  if (workplaceRole) {
    switch (workplaceRole.toLowerCase()) {
      case 'owner':
        return 'owner';
      case 'pharmacist':
        return 'pharmacist';
      case 'technician':
        return 'technician';
      case 'assistant':
      case 'cashier':
        return 'assistant';
      default:
        break;
    }
  }

  // Fallback to system role mapping
  switch (systemRole) {
    case 'pharmacy_outlet':
      return 'owner';
    case 'pharmacist':
    case 'pharmacy_team':
      return 'pharmacist';
    case 'intern_pharmacist':
      return 'technician';
    default:
      return 'assistant'; // Default to most restrictive
  }
};

/**
 * Check if user has required permission for Follow-up Management
 */
export const hasFollowUpPermission = (
  userRole: string,
  workplaceRole: string | undefined,
  action: FollowUpManagementAction
): boolean => {
  const role = mapToFollowUpManagementRole(userRole, workplaceRole);
  const allowedActions = FOLLOWUP_MANAGEMENT_PERMISSIONS[role] || [];
  return allowedActions.includes(action);
};

/**
 * Middleware to check Follow-up Management permissions
 */
export const requireFollowUpPermission = (
  action: FollowUpManagementAction
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn('Follow-up RBAC - No user in request');
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      logger.debug('Follow-up RBAC - Super admin access granted', {
        userId: req.user._id,
        action,
      });
      return next();
    }

    if (!req.workspaceContext) {
      logger.error('Follow-up RBAC - Workspace context missing', {
        userId: req.user._id,
        action,
      });
      res.status(500).json({
        success: false,
        message: 'Workspace context not loaded. Ensure authWithWorkspace middleware is used.',
        code: 'WORKSPACE_CONTEXT_MISSING',
      });
      return;
    }

    const userRole = req.user.role as string;
    const workplaceRole = req.user.workplaceRole as string | undefined;
    const hasPermission = hasFollowUpPermission(userRole, workplaceRole, action);

    // Log RBAC check in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Follow-up RBAC check:', {
        userRole,
        workplaceRole,
        action,
        hasPermission,
        mappedRole: mapToFollowUpManagementRole(userRole, workplaceRole),
        userId: req.user._id,
        workspaceId: req.workspaceContext.workspace?._id,
      });
    }

    if (!hasPermission) {
      logger.warn('Follow-up RBAC - Permission denied', {
        userId: req.user._id,
        userRole,
        workplaceRole,
        action,
        workspaceId: req.workspaceContext.workspace?._id,
      });

      res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this action',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: action,
        userRole: mapToFollowUpManagementRole(userRole, workplaceRole),
      });
      return;
    }

    // Add role info to request for controllers
    (req as any).followUpRole = mapToFollowUpManagementRole(userRole, workplaceRole);
    (req as any).canManageFollowUps = hasFollowUpPermission(userRole, workplaceRole, 'manage');

    next();
  };
};

/**
 * Specific permission middlewares for common patterns
 */
export const requireFollowUpRead = requireFollowUpPermission('read');
export const requireFollowUpCreate = requireFollowUpPermission('create');
export const requireFollowUpUpdate = requireFollowUpPermission('update');
export const requireFollowUpDelete = requireFollowUpPermission('delete');
export const requireFollowUpManage = requireFollowUpPermission('manage');
export const requireFollowUpAssign = requireFollowUpPermission('assign');
export const requireFollowUpComplete = requireFollowUpPermission('complete');
export const requireFollowUpEscalate = requireFollowUpPermission('escalate');
export const requireFollowUpConvert = requireFollowUpPermission('convert_to_appointment');

/**
 * Middleware to check if user can access specific follow-up task
 * Pharmacists can only access tasks assigned to them or created by them
 */
export const checkFollowUpOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin and owners can access all follow-up tasks
    if (req.user?.role === 'super_admin' || req.user?.workplaceRole === 'Owner') {
      return next();
    }

    const followUpId = req.params.id || req.params.followUpId;
    if (!followUpId) {
      return next(); // No specific follow-up to check
    }

    // Import FollowUpTask model
    const FollowUpTask = (await import('../models/FollowUpTask')).default;

    const followUpTask = await FollowUpTask.findById(followUpId);
    if (!followUpTask) {
      res.status(404).json({
        success: false,
        message: 'Follow-up task not found',
        code: 'FOLLOWUP_NOT_FOUND',
      });
      return;
    }

    // Check workspace isolation
    if (followUpTask.workplaceId.toString() !== req.workspaceContext?.workspace?._id.toString()) {
      logger.warn('Follow-up RBAC - Workspace mismatch', {
        userId: req.user?._id,
        followUpWorkspace: followUpTask.workplaceId,
        userWorkspace: req.workspaceContext?.workspace?._id,
      });

      res.status(403).json({
        success: false,
        message: 'Access denied to this follow-up task',
        code: 'WORKSPACE_MISMATCH',
      });
      return;
    }

    // Pharmacists can only access tasks assigned to them or created by them
    const userRole = mapToFollowUpManagementRole(
      req.user?.role as string,
      req.user?.workplaceRole as string
    );

    if (userRole === 'pharmacist') {
      const isAssigned = followUpTask.assignedTo.toString() === req.user?._id.toString();
      const isCreator = followUpTask.createdBy.toString() === req.user?._id.toString();

      if (!isAssigned && !isCreator) {
        logger.warn('Follow-up RBAC - Pharmacist not assigned', {
          userId: req.user?._id,
          followUpId,
          assignedTo: followUpTask.assignedTo,
        });

        res.status(403).json({
          success: false,
          message: 'You can only access follow-up tasks assigned to you',
          code: 'NOT_ASSIGNED',
        });
        return;
      }
    }

    // Attach follow-up task to request for use in controller
    (req as any).followUpTask = followUpTask;
    next();
  } catch (error) {
    logger.error('Follow-up ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify follow-up task access',
      code: 'OWNERSHIP_CHECK_ERROR',
    });
  }
};

/**
 * Middleware to check follow-up feature access based on subscription plan
 */
export const checkFollowUpFeatureAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin bypasses feature checks
    if (req.user?.role === 'super_admin') {
      return next();
    }

    if (!req.workspaceContext) {
      res.status(500).json({
        success: false,
        message: 'Workspace context not loaded',
        code: 'WORKSPACE_CONTEXT_MISSING',
      });
      return;
    }

    // Check if follow-up management feature is available
    const features = req.workspaceContext.permissions || [];
    const hasFollowUpFeature = features.includes('followUpManagement');

    if (!hasFollowUpFeature) {
      logger.warn('Follow-up feature not available', {
        userId: req.user?._id,
        workspaceId: req.workspaceContext.workspace?._id,
        plan: req.workspaceContext.plan?.name,
      });

      res.status(402).json({
        success: false,
        message: 'Follow-up management feature not available in your plan',
        code: 'FEATURE_NOT_AVAILABLE',
        feature: 'followUpManagement',
        upgradeRequired: true,
        currentPlan: req.workspaceContext.plan?.name,
      });
      return;
    }

    // Check subscription status
    const subscriptionStatus = req.workspaceContext.workspace?.subscriptionStatus;
    const allowedStatuses = ['trial', 'active', 'past_due'];

    if (!allowedStatuses.includes(subscriptionStatus)) {
      res.status(402).json({
        success: false,
        message: 'Active subscription required for follow-up management',
        code: 'SUBSCRIPTION_REQUIRED',
        subscriptionStatus,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Follow-up feature access check error:', error);
    next(); // Don't block on feature check errors
  }
};

/**
 * Middleware to filter follow-up tasks based on user role
 * Used in list endpoints to ensure users only see tasks they have access to
 */
export const applyFollowUpDataFiltering = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Super admin and owners see all tasks
    if (req.user?.role === 'super_admin' || req.user?.workplaceRole === 'Owner') {
      return next();
    }

    const userRole = mapToFollowUpManagementRole(
      req.user?.role as string,
      req.user?.workplaceRole as string
    );

    // Pharmacists only see tasks assigned to them or created by them
    if (userRole === 'pharmacist') {
      // Add filter to query params
      (req as any).followUpFilter = {
        $or: [
          { assignedTo: req.user?._id },
          { createdBy: req.user?._id },
        ],
      };
    }

    next();
  } catch (error) {
    logger.error('Follow-up data filtering error:', error);
    next(); // Don't block on filtering errors
  }
};

// Extend AuthRequest interface
declare global {
  namespace Express {
    interface Request {
      followUpRole?: FollowUpManagementRole;
      canManageFollowUps?: boolean;
      followUpTask?: any;
      followUpFilter?: any;
    }
  }
}
