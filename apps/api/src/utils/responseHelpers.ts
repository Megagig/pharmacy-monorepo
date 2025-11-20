import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../middlewares/auth';

/**
 * Enhanced Error Handler and Response Formatters
 * Provides consistent error handling and response formatting for Patient Management API
 */

// Error code types
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'TENANT_VIOLATION'
  | 'BUSINESS_RULE_VIOLATION'
  | 'SERVER_ERROR'
  | 'BAD_REQUEST'
  | 'SERVICE_UNAVAILABLE'
  // User Management Error Codes
  | 'USER_FETCH_ERROR'
  | 'INVALID_USER_ID'
  | 'USER_NOT_FOUND'
  | 'USER_DETAIL_ERROR'
  | 'INVALID_ROLE_ID'
  | 'ROLE_NOT_FOUND'
  | 'ROLE_ALREADY_ASSIGNED'
  | 'ROLE_UPDATE_ERROR'
  | 'REASON_REQUIRED'
  | 'USER_ALREADY_SUSPENDED'
  | 'SUSPEND_ERROR'
  | 'USER_NOT_SUSPENDED'
  | 'REACTIVATE_ERROR'
  | 'INVALID_USER_IDS'
  | 'BULK_ASSIGN_ERROR'
  | 'IMPERSONATION_FORBIDDEN'
  | 'IMPERSONATION_ERROR'
  | 'STATISTICS_ERROR'
  | 'SEARCH_ERROR'
  | 'USER_NOT_PENDING'
  | 'APPROVE_ERROR'
  | 'REJECT_ERROR'
  | 'BULK_APPROVE_ERROR'
  | 'BULK_REJECT_ERROR'
  | 'BULK_SUSPEND_ERROR'
  | 'MISSING_FIELDS'
  | 'USER_EXISTS'
  | 'CREATE_ERROR'
  // Analytics Error Codes
  | 'SUBSCRIPTION_ANALYTICS_ERROR'
  | 'PHARMACY_USAGE_ERROR'
  | 'CLINICAL_OUTCOMES_ERROR'
  | 'INVALID_FORMAT'
  | 'EXPORT_ERROR'
  | 'SCHEDULE_ERROR'
  // Audit Error Codes
  | 'AUDIT_LOGS_ERROR'
  | 'AUDIT_SUMMARY_ERROR'
  | 'COMPLIANCE_REPORT_ERROR'
  | 'AUDIT_LOG_NOT_FOUND'
  | 'AUDIT_REVIEW_ERROR'
  | 'FLAGGED_LOGS_ERROR'
  // Feature Flags Error Codes
  | 'FEATURE_FLAGS_ERROR'
  | 'INVALID_FLAG_ID'
  | 'FLAG_NOT_FOUND'
  | 'INVALID_TARGETING_RULES'
  | 'TARGETING_UPDATE_ERROR'
  | 'USAGE_METRICS_ERROR'
  | 'FLAG_TOGGLE_ERROR'
  // Notification Error Codes
  | 'NOTIFICATION_SETTINGS_ERROR'
  | 'NOTIFICATION_SETTINGS_UPDATE_ERROR'
  | 'NOTIFICATION_RULES_ERROR'
  | 'NOTIFICATION_SEND_ERROR'
  | 'NOTIFICATION_TEMPLATES_ERROR'
  | 'NOTIFICATION_HISTORY_ERROR'
  | 'NOTIFICATION_TEST_ERROR'
  | 'NOTIFICATION_STATS_ERROR'
  // Overview Error Codes
  | 'OVERVIEW_ERROR'
  | 'RECENT_ACTIVITY_ERROR'
  | 'SYSTEM_HEALTH_ERROR'
  // Security Error Codes
  | 'SECURITY_SETTINGS_ERROR'
  | 'SECURITY_SETTINGS_UPDATE_ERROR'
  | 'ACTIVE_SESSIONS_ERROR'
  | 'SESSION_TERMINATION_ERROR'
  | 'SECURITY_LOGS_ERROR'
  | 'SECURITY_ALERTS_ERROR'
  | 'MFA_ENFORCEMENT_ERROR'
  | 'PASSWORD_POLICY_ERROR'
  | 'PASSWORD_POLICY_UPDATE_ERROR'
  | 'ACCOUNT_LOCKOUT_UPDATE_ERROR'
  // Additional Error Codes
  | 'IMPACT_ANALYSIS_ERROR'
  | 'INVALID_FLAG_IDS'
  | 'INVALID_UPDATES'
  | 'BULK_UPDATE_ERROR'
  | 'ROLLOUT_STATUS_ERROR'
  | 'CHANNELS_ERROR'
  | 'CHANNEL_UPDATE_ERROR'
  | 'RULES_ERROR'
  | 'RULE_CREATE_ERROR'
  | 'RULE_NOT_FOUND'
  | 'RULE_UPDATE_ERROR'
  | 'RULE_DELETE_ERROR'
  | 'RULE_TOGGLE_ERROR'
  | 'TEMPLATES_ERROR'
  | 'TEMPLATE_CREATE_ERROR'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_UPDATE_ERROR'
  | 'TEMPLATE_DELETE_ERROR'
  | 'HISTORY_ERROR'
  | 'TEST_NOTIFICATION_ERROR'
  | 'METRICS_ERROR'
  | 'HEALTH_CHECK_ERROR'
  | 'ACTIVITIES_ERROR'
  | 'PERFORMANCE_ERROR'
  | 'REFRESH_ERROR'
  | 'INVALID_PASSWORD_POLICY'
  | 'PASSWORD_POLICY_UPDATE_ERROR'
  | 'SESSIONS_ERROR'
  | 'INVALID_SESSION_ID'
  | 'SESSION_NOT_FOUND'
  | 'USER_ALREADY_LOCKED'
  | 'ACCOUNT_LOCK_ERROR'
  | 'USER_NOT_LOCKED'
  | 'ACCOUNT_UNLOCK_ERROR'
  | 'SECURITY_DASHBOARD_ERROR'
  // Support System Error Codes
  | 'TICKET_CREATION_ERROR'
  | 'TICKETS_FETCH_ERROR'
  | 'TICKET_NOT_FOUND'
  | 'TICKET_FETCH_ERROR'
  | 'TICKET_ASSIGNMENT_ERROR'
  | 'TICKET_UPDATE_ERROR'
  | 'TICKET_ESCALATION_ERROR'
  | 'COMMENT_CREATION_ERROR'
  | 'COMMENTS_FETCH_ERROR'
  | 'ARTICLE_CREATION_ERROR'
  | 'ARTICLES_FETCH_ERROR'
  | 'ANALYTICS_ERROR'
  // Help System Error Codes
  | 'HELP_CONTENT_ERROR'
  | 'CATEGORIES_ERROR'
  | 'FEEDBACK_ERROR'
  | 'SETTINGS_ERROR'
  | 'SETTINGS_UPDATE_ERROR'
  | 'PDF_GENERATION_ERROR'
  | 'FAQ_CREATION_ERROR'
  | 'FAQ_NOT_FOUND'
  | 'FAQ_UPDATE_ERROR'
  | 'FAQ_DELETE_ERROR'
  | 'VIDEO_CREATION_ERROR'
  | 'VIDEO_NOT_FOUND'
  | 'VIDEO_UPDATE_ERROR'
  | 'VIDEO_DELETE_ERROR'
  | 'FEEDBACK_FETCH_ERROR'
  | 'FEEDBACK_NOT_FOUND'
  | 'FEEDBACK_RESPONSE_ERROR'
  | 'ARTICLE_NOT_FOUND'
  | 'ARTICLE_FETCH_ERROR'
  | 'ARTICLE_UPDATE_ERROR'
  | 'ARTICLE_DELETE_ERROR';

// Standard API response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    nextCursor?: string | null;
  };
  timestamp: string;
}

// Success response formatter
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message: message || 'Operation successful',
    data,
    meta,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

// Error response formatter
export const sendError = (
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number = 400,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};

// Pagination helper
export const createPaginationMeta = (
  total: number,
  page: number,
  limit: number
): ApiResponse['meta'] => {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

// Custom error class for Patient Management
export class PatientManagementError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 400,
    code: ErrorCode = 'BAD_REQUEST',
    details?: any
  ) {
    super(message);
    this.name = 'PatientManagementError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error creators
export const createNotFoundError = (resource: string, identifier?: string) =>
  new PatientManagementError(
    `${resource}${identifier ? ` with ID ${identifier}` : ''} not found`,
    404,
    'NOT_FOUND'
  );

export const createValidationError = (message: string, details?: any) =>
  new PatientManagementError(message, 422, 'VALIDATION_ERROR', details);

export const createForbiddenError = (message: string = 'Access forbidden') =>
  new PatientManagementError(message, 403, 'FORBIDDEN');

export const createPlanLimitError = (
  feature: string,
  current: number,
  limit: number
) =>
  new PatientManagementError(
    `${feature} limit exceeded. Current: ${current}, Limit: ${limit}`,
    402,
    'PLAN_LIMIT_EXCEEDED',
    { current, limit, feature }
  );

export const createTenantViolationError = () =>
  new PatientManagementError(
    'Access denied: Resource belongs to different pharmacy',
    403,
    'TENANT_VIOLATION'
  );

export const createDuplicateError = (resource: string, field?: string) =>
  new PatientManagementError(
    `${resource} already exists${field ? ` with this ${field}` : ''}`,
    409,
    'DUPLICATE_RESOURCE'
  );

export const createBusinessRuleError = (rule: string) =>
  new PatientManagementError(
    `Business rule violation: ${rule}`,
    400,
    'BUSINESS_RULE_VIOLATION'
  );

// Enhanced error handler middleware
export const patientManagementErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Patient Management Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    user: (req as AuthRequest).user?.id,
    timestamp: new Date().toISOString(),
  });

  // Handle PatientManagementError
  if (error instanceof PatientManagementError) {
    sendError(res, error.code, error.message, error.statusCode, error.details);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details = error.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    sendError(res, 'VALIDATION_ERROR', 'Validation failed', 422, details);
    return;
  }

  // Handle Mongoose errors
  if (error.name === 'ValidationError') {
    const mongooseError = error as any;
    const details = Object.values(mongooseError.errors || {}).map(
      (err: any) => ({
        field: err.path,
        message: err.message,
      })
    );

    sendError(
      res,
      'VALIDATION_ERROR',
      'Database validation failed',
      422,
      details
    );
    return;
  }

  if (error.name === 'CastError') {
    sendError(res, 'BAD_REQUEST', 'Invalid ID format', 400);
    return;
  }

  if ((error as any).code === 11000) {
    const duplicateField = Object.keys((error as any).keyValue || {})[0];
    sendError(
      res,
      'DUPLICATE_RESOURCE',
      `Resource already exists${duplicateField ? ` with this ${duplicateField}` : ''
      }`,
      409
    );
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    sendError(res, 'UNAUTHORIZED', 'Invalid token', 401);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    sendError(res, 'UNAUTHORIZED', 'Token expired', 401);
    return;
  }

  // Handle syntax errors (malformed JSON)
  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, 'BAD_REQUEST', 'Invalid JSON format in request body', 400);
    return;
  }

  // Generic server error
  sendError(res, 'SERVER_ERROR', 'Internal server error', 500);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Tenant access checker helper
export const checkTenantAccess = (
  resourceWorkplaceId: string,
  userWorkplaceId: string,
  isAdmin: boolean = false,
  isSuperAdmin: boolean = false
): void => {
  // Skip tenant access check for super_admin (highest privilege level)
  if (isSuperAdmin) {
    console.log('Super admin bypassing tenant check for resource');
    return;
  }

  // Standard tenant access check for other roles
  if (!isAdmin && resourceWorkplaceId !== userWorkplaceId) {
    throw createTenantViolationError();
  }
};

// Enhanced version that directly takes the request to check for super_admin
export const checkTenantAccessWithRequest = (
  resourceWorkplaceId: string,
  userWorkplaceId: string,
  isAdmin: boolean = false,
  req: AuthRequest
): void => {
  // Check if user is super_admin
  const userIsSuperAdmin = req.user?.role === 'super_admin';

  // Skip tenant access check for super_admin
  if (userIsSuperAdmin) {
    console.log('Super admin bypassing tenant check for resource');
    return;
  }

  // Standard tenant access check
  if (!isAdmin && resourceWorkplaceId !== userWorkplaceId) {
    throw createTenantViolationError();
  }
}; // Resource existence checker
export const ensureResourceExists = <T>(
  resource: T | null,
  name: string,
  id?: string
): T => {
  if (!resource) {
    throw createNotFoundError(name, id);
  }
  return resource;
};

// Business rule validators
export const validateBusinessRules = {
  // Ensure BP readings are valid
  validateBloodPressure: (systolic?: number, diastolic?: number) => {
    if (systolic && diastolic && systolic <= diastolic) {
      throw createBusinessRuleError(
        'Systolic blood pressure must be higher than diastolic'
      );
    }
  },

  // Ensure medication dates are logical
  validateMedicationDates: (startDate?: Date, endDate?: Date) => {
    if (startDate && endDate && startDate > endDate) {
      throw createBusinessRuleError(
        'Medication start date cannot be after end date'
      );
    }
  },

  // Ensure follow-up date is in future
  validateFollowUpDate: (followUpDate?: Date) => {
    if (followUpDate && followUpDate <= new Date()) {
      throw createBusinessRuleError('Follow-up date must be in the future');
    }
  },

  // Ensure patient age/DOB consistency
  validatePatientAge: (dob?: Date, age?: number) => {
    if (dob && age) {
      const calculatedAge = Math.floor(
        (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      );
      if (Math.abs(calculatedAge - age) > 1) {
        throw createBusinessRuleError('Age does not match date of birth');
      }
    }
  },
};

// Response helpers
export const respondWithPatient = (
  res: Response,
  patient: any,
  message?: string
) => {
  // Remove sensitive fields and add computed properties
  const cleanPatient = {
    ...patient.toObject(),
    age: patient.getAge?.() || patient.age,
    displayName:
      patient.getDisplayName?.() || `${patient.firstName} ${patient.lastName}`,
  };

  sendSuccess(res, { patient: cleanPatient }, message);
};

export const respondWithPaginatedResults = <T>(
  res: Response,
  results: T[],
  total: number,
  page: number,
  limit: number,
  message?: string
) => {
  const meta = createPaginationMeta(total, page, limit);
  sendSuccess(res, { results }, message, 200, meta);
};

// Helper to check if user is super_admin
export const isSuperAdmin = (req: AuthRequest): boolean => {
  return req.user?.role === 'super_admin';
};

// Request context helpers
export const getRequestContext = (req: AuthRequest) => {
  const userIsSuperAdmin = isSuperAdmin(req);
  return {
    userId: req.user?._id,
    userRole: req.user?.role,
    workplaceId: req.user?.workplaceId?.toString() || '',
    isAdmin: (req as any).isAdmin || userIsSuperAdmin, // Super admin should be treated as admin
    isSuperAdmin: userIsSuperAdmin,
    canManage: (req as any).canManage || userIsSuperAdmin, // Super admin can manage everything
    timestamp: new Date().toISOString(),
  };
};

// Audit log helper
export const createAuditLog = (
  action: string,
  resourceType: string,
  resourceId: string,
  context: ReturnType<typeof getRequestContext>,
  changes?: any
) => ({
  action,
  resourceType,
  resourceId,
  userId: context.userId,
  userRole: context.userRole,
  workplaceId: context.workplaceId,
  changes,
  timestamp: context.timestamp,
});
