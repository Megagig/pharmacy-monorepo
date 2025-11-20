import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

/**
 * Appointment Management RBAC Middleware
 * Implements role-based access control for Appointment Management module
 *
 * Roles:
 * - owner: Full access (create, read, update, delete, manage schedules)
 * - pharmacist: Full access to own appointments and assigned appointments
 * - technician: Read-only access, can view appointments
 * - assistant: Read-only access to appointments
 */

export type AppointmentManagementRole =
  | 'owner'
  | 'pharmacist'
  | 'technician'
  | 'assistant'
  | 'admin';

export type AppointmentManagementAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'reschedule'
  | 'cancel'
  | 'confirm'
  | 'complete';

// Define role permissions for Appointment Management
const APPOINTMENT_MANAGEMENT_PERMISSIONS: Record<
  AppointmentManagementRole,
  AppointmentManagementAction[]
> = {
  owner: ['create', 'read', 'update', 'delete', 'manage', 'reschedule', 'cancel', 'confirm', 'complete'],
  pharmacist: ['create', 'read', 'update', 'reschedule', 'cancel', 'confirm', 'complete'],
  technician: ['read'],
  assistant: ['read'],
  admin: ['create', 'read', 'update', 'delete', 'manage', 'reschedule', 'cancel', 'confirm', 'complete'],
};

/**
 * Map system roles to Appointment Management roles
 */
const mapToAppointmentManagementRole = (
  systemRole: string,
  workplaceRole?: string
): AppointmentManagementRole => {
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
 * Check if user has required permission for Appointment Management
 */
export const hasAppointmentPermission = (
  userRole: string,
  workplaceRole: string | undefined,
  action: AppointmentManagementAction
): boolean => {
  const role = mapToAppointmentManagementRole(userRole, workplaceRole);
  const allowedActions = APPOINTMENT_MANAGEMENT_PERMISSIONS[role] || [];
  return allowedActions.includes(action);
};

/**
 * Middleware to check Appointment Management permissions
 */
export const requireAppointmentPermission = (
  action: AppointmentManagementAction
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn('Appointment RBAC - No user in request');
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      logger.debug('Appointment RBAC - Super admin access granted', {
        userId: req.user._id,
        action,
      });
      return next();
    }

    if (!req.workspaceContext) {
      logger.error('Appointment RBAC - Workspace context missing', {
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
    const hasPermission = hasAppointmentPermission(userRole, workplaceRole, action);

    // Log RBAC check in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Appointment RBAC check:', {
        userRole,
        workplaceRole,
        action,
        hasPermission,
        mappedRole: mapToAppointmentManagementRole(userRole, workplaceRole),
        userId: req.user._id,
        workspaceId: req.workspaceContext.workspace?._id,
      });
    }

    if (!hasPermission) {
      logger.warn('Appointment RBAC - Permission denied', {
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
        userRole: mapToAppointmentManagementRole(userRole, workplaceRole),
      });
      return;
    }

    // Add role info to request for controllers
    (req as any).appointmentRole = mapToAppointmentManagementRole(userRole, workplaceRole);
    (req as any).canManageAppointments = hasAppointmentPermission(userRole, workplaceRole, 'manage');

    next();
  };
};

/**
 * Specific permission middlewares for common patterns
 */
export const requireAppointmentRead = requireAppointmentPermission('read');
export const requireAppointmentCreate = requireAppointmentPermission('create');
export const requireAppointmentUpdate = requireAppointmentPermission('update');
export const requireAppointmentDelete = requireAppointmentPermission('delete');
export const requireAppointmentManage = requireAppointmentPermission('manage');
export const requireAppointmentReschedule = requireAppointmentPermission('reschedule');
export const requireAppointmentCancel = requireAppointmentPermission('cancel');
export const requireAppointmentConfirm = requireAppointmentPermission('confirm');
export const requireAppointmentComplete = requireAppointmentPermission('complete');

/**
 * Middleware to check if user can access specific appointment
 * Pharmacists can only access appointments assigned to them or created by them
 */
export const checkAppointmentOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin and owners can access all appointments
    if (req.user?.role === 'super_admin' || req.user?.workplaceRole === 'Owner') {
      return next();
    }

    const appointmentId = req.params.id || req.params.appointmentId;
    if (!appointmentId) {
      return next(); // No specific appointment to check
    }

    // Import Appointment model
    const Appointment = (await import('../models/Appointment')).default;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found',
        code: 'APPOINTMENT_NOT_FOUND',
      });
      return;
    }

    // Check workspace isolation
    if (appointment.workplaceId.toString() !== req.workspaceContext?.workspace?._id.toString()) {
      logger.warn('Appointment RBAC - Workspace mismatch', {
        userId: req.user?._id,
        appointmentWorkspace: appointment.workplaceId,
        userWorkspace: req.workspaceContext?.workspace?._id,
      });

      res.status(403).json({
        success: false,
        message: 'Access denied to this appointment',
        code: 'WORKSPACE_MISMATCH',
      });
      return;
    }

    // Pharmacists can only access appointments assigned to them or created by them
    const userRole = mapToAppointmentManagementRole(
      req.user?.role as string,
      req.user?.workplaceRole as string
    );

    if (userRole === 'pharmacist') {
      const isAssigned = appointment.assignedTo.toString() === req.user?._id.toString();
      const isCreator = appointment.createdBy.toString() === req.user?._id.toString();

      if (!isAssigned && !isCreator) {
        logger.warn('Appointment RBAC - Pharmacist not assigned', {
          userId: req.user?._id,
          appointmentId,
          assignedTo: appointment.assignedTo,
        });

        res.status(403).json({
          success: false,
          message: 'You can only access appointments assigned to you',
          code: 'NOT_ASSIGNED',
        });
        return;
      }
    }

    // Attach appointment to request for use in controller
    (req as any).appointment = appointment;
    next();
  } catch (error) {
    logger.error('Appointment ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify appointment access',
      code: 'OWNERSHIP_CHECK_ERROR',
    });
  }
};

/**
 * Middleware to check appointment feature access based on subscription plan
 */
export const checkAppointmentFeatureAccess = async (
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

    // Check if appointment scheduling feature is available
    const features = req.workspaceContext.permissions || [];
    const hasAppointmentFeature = features.includes('appointmentScheduling');

    if (!hasAppointmentFeature) {
      logger.warn('Appointment feature not available', {
        userId: req.user?._id,
        workspaceId: req.workspaceContext.workspace?._id,
        plan: req.workspaceContext.plan?.name,
      });

      res.status(402).json({
        success: false,
        message: 'Appointment scheduling feature not available in your plan',
        code: 'FEATURE_NOT_AVAILABLE',
        feature: 'appointmentScheduling',
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
        message: 'Active subscription required for appointment management',
        code: 'SUBSCRIPTION_REQUIRED',
        subscriptionStatus,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Appointment feature access check error:', error);
    next(); // Don't block on feature check errors
  }
};

// Extend AuthRequest interface
declare global {
  namespace Express {
    interface Request {
      appointmentRole?: AppointmentManagementRole;
      canManageAppointments?: boolean;
      appointment?: any;
    }
  }
}
