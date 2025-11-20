import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import { saasAuditController } from '../controllers/saasAuditController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * SaaS Audit Routes
 * All routes require super admin privileges
 */

// Get audit logs with advanced filtering
router.get(
  '/logs',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('userId').optional().isMongoId().withMessage('User ID must be a valid MongoDB ObjectId'),
    query('action').optional().isString().withMessage('Action must be a string'),
    query('resource').optional().isString().withMessage('Resource must be a string'),
    query('success').optional().isIn(['true', 'false']).withMessage('Success must be true or false'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Severity must be valid'),
    query('category').optional().isIn(['authentication', 'authorization', 'data_access', 'configuration', 'user_management', 'system']).withMessage('Category must be valid'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('ipAddress').optional().isString().withMessage('IP address must be a string'),
    query('workspaceId').optional().isMongoId().withMessage('Workspace ID must be a valid MongoDB ObjectId'),
    query('flagged').optional().isIn(['true', 'false']).withMessage('Flagged must be true or false'),
    query('sortBy').optional().isString().withMessage('Sort by must be a string'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
  ],
  validateRequest,
  saasAuditController.getAuditLogs.bind(saasAuditController)
);

// Get audit summary and statistics
router.get(
  '/summary',
  [
    query('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y')
  ],
  validateRequest,
  saasAuditController.getAuditSummary.bind(saasAuditController)
);

// Generate compliance report
router.post(
  '/compliance-report',
  [
    body('timeRange')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Time range must be one of: 7d, 30d, 90d, 1y'),
    body('includeIncidents')
      .optional()
      .isBoolean()
      .withMessage('Include incidents must be a boolean'),
    body('includeAccessPatterns')
      .optional()
      .isBoolean()
      .withMessage('Include access patterns must be a boolean'),
    body('includeDataAccess')
      .optional()
      .isBoolean()
      .withMessage('Include data access must be a boolean'),
    body('format')
      .optional()
      .isIn(['json', 'pdf', 'excel'])
      .withMessage('Format must be one of: json, pdf, excel')
  ],
  validateRequest,
  saasAuditController.generateComplianceReport.bind(saasAuditController)
);

// Review and resolve flagged audit entries
router.put(
  '/logs/:logId/review',
  [
    param('logId').isMongoId().withMessage('Log ID must be a valid MongoDB ObjectId'),
    body('resolution')
      .notEmpty()
      .withMessage('Resolution is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Resolution must be between 10 and 1000 characters'),
    body('notes')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Notes must not exceed 2000 characters')
  ],
  validateRequest,
  saasAuditController.reviewAuditLog.bind(saasAuditController)
);

// Get flagged audit entries requiring review
router.get(
  '/flagged',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  saasAuditController.getFlaggedAuditLogs.bind(saasAuditController)
);

// Export audit logs
router.post(
  '/export',
  [
    body('format')
      .isIn(['csv', 'excel'])
      .withMessage('Format must be csv or excel'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('includeDetails')
      .optional()
      .isBoolean()
      .withMessage('Include details must be a boolean')
  ],
  validateRequest,
  saasAuditController.exportAuditLogs.bind(saasAuditController)
);

export default router;