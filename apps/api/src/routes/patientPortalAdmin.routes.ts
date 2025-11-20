import { Router } from 'express';
import { auth } from '../middlewares/auth';
import {
  workspaceAdminAuth,
  auditWorkspaceAdminAction,
  validateWorkspaceContext,
} from '../middlewares/workspaceAdminAuth';
import {
  validateRequest,
  validateObjectIdParam,
  validateDateRange,
  validatePagination,
} from '../middlewares/patientPortalAdminValidation';
import patientPortalAdminController from '../controllers/patientPortalAdminController';
import { rateLimiter } from '../middlewares/rateLimiter';

const router = Router();

// Apply authentication and workspace admin authorization to all routes
router.use(auth);
router.use(workspaceAdminAuth);

// Apply rate limiting to all admin routes
router.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many admin requests, please try again later',
}));

/**
 * Patient User Management Routes
 */

// Get patient portal users with filtering and pagination
router.get(
  '/users',
  validateRequest('getUsersQuery'),
  validatePagination,
  validateDateRange,
  auditWorkspaceAdminAction('get_patient_users'),
  patientPortalAdminController.getPatientPortalUsers
);

// Approve a patient user account
router.post(
  '/users/:patientUserId/approve',
  validateObjectIdParam('patientUserId'),
  validateRequest('approvePatientUser'),
  auditWorkspaceAdminAction('approve_patient_user'),
  patientPortalAdminController.approvePatientUser
);

// Suspend a patient user account
router.post(
  '/users/:patientUserId/suspend',
  validateObjectIdParam('patientUserId'),
  validateRequest('suspendPatientUser'),
  auditWorkspaceAdminAction('suspend_patient_user'),
  patientPortalAdminController.suspendPatientUser
);

// Reactivate a suspended patient user account
router.post(
  '/users/:patientUserId/reactivate',
  validateObjectIdParam('patientUserId'),
  validateRequest('reactivatePatientUser'),
  auditWorkspaceAdminAction('reactivate_patient_user'),
  patientPortalAdminController.reactivatePatientUser
);

/**
 * Refill Request Management Routes
 */

// Get refill requests with filtering and pagination
router.get(
  '/refill-requests',
  validateRequest('getRefillRequestsQuery'),
  validatePagination,
  validateDateRange,
  auditWorkspaceAdminAction('get_refill_requests'),
  patientPortalAdminController.getRefillRequests
);

// Approve a refill request
router.post(
  '/refill-requests/:requestId/approve',
  validateObjectIdParam('requestId'),
  validateRequest('approveRefillRequest'),
  auditWorkspaceAdminAction('approve_refill_request'),
  patientPortalAdminController.approveRefillRequest
);

// Deny a refill request
router.post(
  '/refill-requests/:requestId/deny',
  validateObjectIdParam('requestId'),
  validateRequest('denyRefillRequest'),
  auditWorkspaceAdminAction('deny_refill_request'),
  patientPortalAdminController.denyRefillRequest
);

// Assign a refill request to a pharmacist
router.post(
  '/refill-requests/:requestId/assign',
  validateObjectIdParam('requestId'),
  validateRequest('assignRefillRequest'),
  auditWorkspaceAdminAction('assign_refill_request'),
  patientPortalAdminController.assignRefillRequest
);

/**
 * Analytics and Reporting Routes
 */

// Get portal analytics and engagement metrics
router.get(
  '/analytics',
  validateRequest('analyticsQuery'),
  validateDateRange,
  auditWorkspaceAdminAction('get_portal_analytics'),
  patientPortalAdminController.getPortalAnalytics
);

// Get detailed analytics report
router.get(
  '/analytics/report',
  validateRequest('analyticsQuery'),
  validateDateRange,
  auditWorkspaceAdminAction('get_analytics_report'),
  patientPortalAdminController.getAnalyticsReport
);

// Get feature usage statistics
router.get(
  '/analytics/feature-usage',
  validateRequest('analyticsQuery'),
  validateDateRange,
  auditWorkspaceAdminAction('get_feature_usage_stats'),
  patientPortalAdminController.getFeatureUsageStats
);

// Get communication metrics
router.get(
  '/analytics/communication',
  validateRequest('analyticsQuery'),
  validateDateRange,
  auditWorkspaceAdminAction('get_communication_metrics'),
  patientPortalAdminController.getCommunicationMetrics
);

// Get patient activity details
router.get(
  '/patients/:patientUserId/activity',
  validateObjectIdParam('patientUserId'),
  validateRequest('patientActivityQuery'),
  validateDateRange,
  auditWorkspaceAdminAction('get_patient_activity'),
  patientPortalAdminController.getPatientActivity
);

/**
 * Portal Settings Management Routes
 */

// Get portal settings
router.get(
  '/settings',
  auditWorkspaceAdminAction('get_portal_settings'),
  patientPortalAdminController.getPortalSettings
);

// Update portal settings
router.put(
  '/settings',
  validateRequest('updatePortalSettings'),
  auditWorkspaceAdminAction('update_portal_settings'),
  patientPortalAdminController.updatePortalSettings
);

// Reset portal settings to defaults
router.post(
  '/settings/reset',
  auditWorkspaceAdminAction('reset_portal_settings'),
  patientPortalAdminController.resetPortalSettings
);

/**
 * Pharmacist Management Routes
 */

// Get list of pharmacists for refill request assignment
router.get(
  '/pharmacists',
  auditWorkspaceAdminAction('get_pharmacists_list'),
  patientPortalAdminController.getPharmacists
);

/**
 * Bulk Operations Routes (with additional rate limiting)
 */

// Bulk approve patient users (more restrictive rate limiting)
router.post(
  '/users/bulk-approve',
  rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit to 10 bulk operations per hour
    message: 'Too many bulk operations, please try again later',
  }),
  auditWorkspaceAdminAction('bulk_approve_patient_users'),
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Bulk operations not yet implemented',
    });
  }
);

// Bulk assign refill requests (more restrictive rate limiting)
router.post(
  '/refill-requests/bulk-assign',
  rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit to 10 bulk operations per hour
    message: 'Too many bulk operations, please try again later',
  }),
  auditWorkspaceAdminAction('bulk_assign_refill_requests'),
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Bulk operations not yet implemented',
    });
  }
);

/**
 * Export and Import Routes (with strict rate limiting)
 */

// Export patient data (very restrictive rate limiting)
router.get(
  '/export/patients',
  rateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // Limit to 5 exports per day
    message: 'Export limit exceeded, please try again tomorrow',
  }),
  auditWorkspaceAdminAction('export_patient_data'),
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Data export not yet implemented',
    });
  }
);

// Export analytics data (very restrictive rate limiting)
router.get(
  '/export/analytics',
  rateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // Limit to 5 exports per day
    message: 'Export limit exceeded, please try again tomorrow',
  }),
  auditWorkspaceAdminAction('export_analytics_data'),
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Analytics export not yet implemented',
    });
  }
);

/**
 * Health Check Route (no authentication required)
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Patient Portal Admin API is healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Error handling middleware for this router
 */
router.use((error: any, req: any, res: any, next: any) => {
  // Log the error
  console.error('Patient Portal Admin Route Error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?._id,
    workplaceId: req.user?.workplaceId,
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
    });
    return;
  }

  if (error.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      details: error.message,
    });
    return;
  }

  if (error.name === 'MongoError' && error.code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      details: 'A record with this information already exists',
    });
    return;
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

export default router;