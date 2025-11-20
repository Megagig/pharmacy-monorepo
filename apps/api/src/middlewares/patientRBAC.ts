import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Extend AuthRequest to include Patient Management specific properties
export interface PatientAuthRequest extends AuthRequest {
  isAdmin?: boolean;
  canManage?: boolean;
  patientRole?: PatientManagementRole;
}

/**
 * Patient Management RBAC Middleware
 * Implements role-based access control for Patient Management module
 *
 * Roles:
 * - owner: Full access (create, read, update, delete all)
 * - pharmacist: Full access (create, read, update, delete all)
 * - technician: Limited access (view, add vitals/assessments only)
 * - admin: Cross-tenant view access (read all across pharmacies)
 */

export type PatientManagementRole =
  | 'owner'
  | 'pharmacist'
  | 'technician'
  | 'admin';
export type PatientManagementAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage';

// Define role permissions for Patient Management
const PATIENT_MANAGEMENT_PERMISSIONS: Record<
  PatientManagementRole,
  PatientManagementAction[]
> = {
  owner: ['create', 'read', 'update', 'delete', 'manage'],
  pharmacist: ['create', 'read', 'update', 'delete', 'manage'],
  technician: ['read'], // Technicians can only view and add specific data
  admin: ['create', 'read', 'update', 'delete', 'manage'], // Admins have full access across tenants
};

// Special permissions for technicians - they can create/update these specific data types
const TECHNICIAN_ALLOWED_RESOURCES = ['clinical-assessments', 'vitals', 'labs'];

/**
 * Check if user has required permission for Patient Management
 */
export const hasPatientManagementPermission = (
  userRole: string,
  action: PatientManagementAction,
  resource?: string
): boolean => {
  const role = mapToPatientManagementRole(userRole);
  const allowedActions = PATIENT_MANAGEMENT_PERMISSIONS[role] || [];

  // Check basic permission
  if (allowedActions.includes(action)) {
    return true;
  }

  // Special case for technicians - they can create/update specific resources
  if (
    role === 'technician' &&
    ['create', 'update'].includes(action) &&
    resource
  ) {
    return TECHNICIAN_ALLOWED_RESOURCES.some((allowedResource) =>
      resource.includes(allowedResource)
    );
  }

  return false;
};

/**
 * Map system roles to Patient Management roles
 */
const mapToPatientManagementRole = (
  systemRole: string
): PatientManagementRole => {
  switch (systemRole) {
    case 'super_admin':
      return 'admin';
    case 'pharmacy_outlet':
      return 'owner';
    case 'pharmacist':
    case 'pharmacy_team':
      return 'pharmacist';
    case 'intern_pharmacist':
      return 'technician';
    default:
      return 'technician'; // Default to most restrictive
  }
};

/**
 * Middleware to check Patient Management permissions
 */
export const requirePatientPermission = (
  action: PatientManagementAction,
  resource?: string
) => {
  return (req: PatientAuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.log('RBAC - No user in request');
      res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const userRole = req.user.role as string;
    const hasPermission = hasPatientManagementPermission(
      userRole,
      action,
      resource
    );

    // RBAC check (logging disabled for performance in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('RBAC check:', {
        userRole,
        action,
        resource,
        hasPermission,
        mappedRole: mapToPatientManagementRole(userRole),
        userId: req.user._id,
      });
    }

    if (!hasPermission) {
      res.status(403).json({
        message: 'Insufficient permissions for this action',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: action,
        userRole: mapToPatientManagementRole(userRole),
        resource: resource,
      });
      return;
    }

    // Add role info to request for controllers
    req.patientRole = mapToPatientManagementRole(userRole);
    req.canManage = hasPatientManagementPermission(userRole, 'manage');
    req.isAdmin = mapToPatientManagementRole(userRole) === 'admin';

    next();
  };
};

/**
 * Specific permission middlewares for common patterns
 */
export const requirePatientRead = requirePatientPermission('read');
export const requirePatientCreate = requirePatientPermission('create');
export const requirePatientUpdate = requirePatientPermission('update');
export const requirePatientDelete = requirePatientPermission('delete');
export const requirePatientManage = requirePatientPermission('manage');

// Resource-specific permissions
export const requireClinicalAssessmentAccess = requirePatientPermission(
  'create',
  'clinical-assessments'
);
export const requireVitalsAccess = requirePatientPermission('create', 'vitals');

/**
 * Middleware to check workplace ownership for non-admin users
 */
export const checkWorkplaceAccess = async (
  req: PatientAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip workplace check for admin users (they have cross-tenant access)
  if (req.isAdmin || req.user?.role === 'super_admin') {
    // Super admin access granted (logging disabled for performance)
    next();
    return;
  }

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('checkWorkplaceAccess debug:', {
      userId: req.user?._id,
      workplaceId: req.user?.workplaceId,
      currentPlanId: req.user?.currentPlanId,
      role: req.user?.role,
      status: req.user?.status,
      isAdmin: req.isAdmin,
    });
  }

  // For non-admin users, ensure they have a workplace association OR an active subscription plan
  // Users with an active subscription plan can access patient management features even without a workplace
  if (!req.user?.workplaceId && !req.user?.currentPlanId) {
    res.status(403).json({
      message: 'No workplace association found',
      code: 'NO_WORKPLACE_ACCESS',
      requiresAction: 'workplace_setup',
    });
    return;
  }

  // If user has a plan but no workplace, allow access for development/trial users
  if (!req.user?.workplaceId && req.user?.currentPlanId) {
    // This allows trial users to access patient management without setting up a workplace first
    console.log(
      'Allowing access with plan but no workplace:',
      req.user?.currentPlanId
    );
    next();
    return;
  }

  next();
};

// Backward compatibility alias
export const checkPharmacyAccess = checkWorkplaceAccess;

/**
 * Plan gate middleware for Patient Management features
 */
export const checkPatientPlanLimits = async (
  req: PatientAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip plan checks for admin users
    if (req.isAdmin || req.user?.role === 'super_admin') {
      next();
      return;
    }

    const subscription = req.subscription;

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('checkPatientPlanLimits debug:', {
        hasSubscription: !!subscription,
        subscriptionStatus: subscription?.status,
        hasPlanId: !!subscription?.planId,
        tier: subscription?.tier,
        workplaceId: req.user?.workplaceId,
      });
    }

    // Check if subscription exists and is active
    // Allow users in 'trial', 'active', or 'past_due' status
    if (!subscription) {
      res.status(402).json({
        message: 'Active subscription required for Patient Management',
        code: 'SUBSCRIPTION_REQUIRED',
        feature: 'patient_management',
      });
      return;
    }

    // Allow users in trial, active, or grace period (past_due) to proceed
    const allowedStatuses = ['trial', 'active', 'past_due'];
    if (!allowedStatuses.includes(subscription.status)) {
      res.status(402).json({
        message: 'Active subscription required for Patient Management',
        code: 'SUBSCRIPTION_EXPIRED',
        feature: 'patient_management',
        subscriptionStatus: subscription.status,
      });
      return;
    }

    // If planId is not populated but subscription is active, allow access
    // This handles cases where subscription exists but planId isn't populated
    if (!subscription.planId) {
      console.warn('Subscription found but planId not populated:', {
        subscriptionId: subscription._id,
        workplaceId: req.user?.workplaceId,
        status: subscription.status,
      });
      // Allow access if subscription is active/trial but skip plan limit checks
      next();
      return;
    }

    // Check if creating a new patient (for plan limits)
    if (req.method === 'POST' && req.path === '/') {
      const planFeatures = (subscription.planId as any).features || {};
      const maxPatients = planFeatures.maxPatients || 0;

      if (maxPatients > 0) {
        // Get current patient count for this workplace
        const Patient = require('../models/Patient').default;
        const currentCount = await Patient.countDocuments({
          workplaceId: req.user?.workplaceId,
          isDeleted: false,
        });

        if (currentCount >= maxPatients) {
          res.status(402).json({
            message: `Patient limit reached. Your plan allows up to ${maxPatients} patients.`,
            code: 'PATIENT_LIMIT_REACHED',
            current: currentCount,
            limit: maxPatients,
            upgradeUrl: '/api/subscriptions/plans',
          });
          return;
        }
      }
    }

    next();
  } catch (error) {
    console.error('Plan limit check error:', error);
    next(); // Don't block on plan check errors
  }
};

// Extend AuthRequest interface
declare global {
  namespace Express {
    interface Request {
      patientRole?: PatientManagementRole;
      canManage?: boolean;
      isAdmin?: boolean;
    }
  }
}
