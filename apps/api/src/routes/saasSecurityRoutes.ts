import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasSecurityController } from '../controllers/saasSecurityController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS Security Routes
 * All routes require super admin privileges
 */

// Get security settings
router.get(
  '/settings',
  saasSecurityController.getSecuritySettings.bind(saasSecurityController)
);

// Update password policy
router.put(
  '/password-policy',
  [
    body('minLength')
      .optional()
      .isInt({ min: 4, max: 128 })
      .withMessage('Minimum length must be between 4 and 128 characters'),
    body('requireUppercase')
      .optional()
      .isBoolean()
      .withMessage('Require uppercase must be a boolean'),
    body('requireLowercase')
      .optional()
      .isBoolean()
      .withMessage('Require lowercase must be a boolean'),
    body('requireNumbers')
      .optional()
      .isBoolean()
      .withMessage('Require numbers must be a boolean'),
    body('requireSpecialChars')
      .optional()
      .isBoolean()
      .withMessage('Require special characters must be a boolean'),
    body('maxAge')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Maximum age must be between 1 and 365 days'),
    body('preventReuse')
      .optional()
      .isInt({ min: 0, max: 24 })
      .withMessage('Prevent reuse must be between 0 and 24 passwords')
  ],
  validateRequest,
  saasSecurityController.updatePasswordPolicy.bind(saasSecurityController)
);

// Update account lockout settings
router.put(
  '/account-lockout',
  [
    body('maxFailedAttempts')
      .optional()
      .isInt({ min: 3, max: 20 })
      .withMessage('Max failed attempts must be between 3 and 20'),
    body('lockoutDuration')
      .optional()
      .isInt({ min: 5, max: 1440 })
      .withMessage('Lockout duration must be between 5 and 1440 minutes'),
    body('autoUnlock')
      .optional()
      .isBoolean()
      .withMessage('Auto unlock must be a boolean'),
    body('notifyOnLockout')
      .optional()
      .isBoolean()
      .withMessage('Notify on lockout must be a boolean')
  ],
  validateRequest,
  saasSecurityController.updateAccountLockout.bind(saasSecurityController)
);

// Get active user sessions
router.get(
  '/sessions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('userId').optional().isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    query('ipAddress').optional().isString().withMessage('IP address must be a string'),
    query('userAgent').optional().isString().withMessage('User agent must be a string'),
    query('isActive').optional().isIn(['true', 'false']).withMessage('isActive must be true or false'),
    query('createdAfter').optional().isISO8601().withMessage('Created after must be a valid ISO 8601 date'),
    query('createdBefore').optional().isISO8601().withMessage('Created before must be a valid ISO 8601 date'),
    query('sortBy').optional().isString().withMessage('Sort by must be a string'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
  ],
  validateRequest,
  saasSecurityController.getActiveSessions.bind(saasSecurityController)
);

// Terminate user session
router.delete(
  '/sessions/:sessionId',
  [
    param('sessionId').notEmpty().withMessage('Session ID is required'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters')
  ],
  validateRequest,
  saasSecurityController.terminateSession.bind(saasSecurityController)
);

// Get security audit logs
router.get(
  '/audit-logs',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('userId').optional().isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    query('action').optional().isString().withMessage('Action must be a string'),
    query('resource').optional().isString().withMessage('Resource must be a string'),
    query('success').optional().isIn(['true', 'false']).withMessage('Success must be true or false'),
    query('ipAddress').optional().isString().withMessage('IP address must be a string'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('sortBy').optional().isString().withMessage('Sort by must be a string'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
  ],
  validateRequest,
  saasSecurityController.getSecurityAuditLogs.bind(saasSecurityController)
);

// Lock user account
router.post(
  '/users/:userId/lock',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    body('reason')
      .notEmpty()
      .withMessage('Lock reason is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Reason must be between 10 and 1000 characters')
  ],
  validateRequest,
  saasSecurityController.lockUserAccount.bind(saasSecurityController)
);

// Unlock user account
router.post(
  '/users/:userId/unlock',
  [
    param('userId').isMongoId().withMessage('User ID must be a valid MongoDB ObjectId')
  ],
  validateRequest,
  saasSecurityController.unlockUserAccount.bind(saasSecurityController)
);

// Get security dashboard metrics
router.get(
  '/dashboard',
  [
    query('timeRange')
      .optional()
      .isIn(['1h', '24h', '7d', '30d'])
      .withMessage('Time range must be one of: 1h, 24h, 7d, 30d')
  ],
  validateRequest,
  saasSecurityController.getSecurityDashboard.bind(saasSecurityController)
);

export default router;