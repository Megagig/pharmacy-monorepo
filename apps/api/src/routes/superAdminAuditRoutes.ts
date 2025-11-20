import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { auth, requireSuperAdmin } from '../middlewares/auth';
import SuperAdminAuditController from '../controllers/superAdminAuditController';
import { validateRequest } from '../middlewares/validation';

const router = Router();

/**
 * Super Admin Audit Trail Routes
 * All routes require super admin authentication
 */

// Apply authentication and super admin authorization to all routes
router.use(auth);
router.use(requireSuperAdmin);

/**
 * @route   GET /api/super-admin/audit-trail
 * @desc    Get comprehensive audit trail with filters
 * @access  Super Admin
 */
router.get(
    '/',
    [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 200 })
            .withMessage('Limit must be between 1 and 200'),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
        query('userId')
            .optional()
            .isMongoId()
            .withMessage('User ID must be a valid MongoDB ObjectId'),
        query('workplaceId')
            .optional()
            .isMongoId()
            .withMessage('Workplace ID must be a valid MongoDB ObjectId'),
        query('activityType')
            .optional()
            .isString()
            .withMessage('Activity type must be a string'),
        query('action')
            .optional()
            .isString()
            .withMessage('Action must be a string'),
        query('riskLevel')
            .optional()
            .isIn(['low', 'medium', 'high', 'critical'])
            .withMessage('Risk level must be valid'),
        query('success')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('Success must be true or false'),
        query('flagged')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('Flagged must be true or false'),
        query('complianceCategory')
            .optional()
            .isIn(['HIPAA', 'SOX', 'GDPR', 'PCI_DSS', 'GENERAL'])
            .withMessage('Compliance category must be valid'),
        query('searchQuery')
            .optional()
            .isString()
            .withMessage('Search query must be a string'),
        query('entityType')
            .optional()
            .isString()
            .withMessage('Entity type must be a string'),
        query('entityId')
            .optional()
            .isMongoId()
            .withMessage('Entity ID must be a valid MongoDB ObjectId'),
    ],
    validateRequest,
    SuperAdminAuditController.getAuditTrail
);

/**
 * @route   GET /api/super-admin/audit-trail/stats
 * @desc    Get audit statistics and analytics
 * @access  Super Admin
 */
router.get(
    '/stats',
    [
        query('workplaceId')
            .optional()
            .isMongoId()
            .withMessage('Workplace ID must be a valid MongoDB ObjectId'),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
    ],
    validateRequest,
    SuperAdminAuditController.getAuditStats
);

/**
 * @route   GET /api/super-admin/audit-trail/export
 * @desc    Export audit data in JSON or CSV format
 * @access  Super Admin
 */
router.get(
    '/export',
    [
        query('format')
            .optional()
            .isIn(['json', 'csv'])
            .withMessage('Format must be json or csv'),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date'),
        query('userId')
            .optional()
            .isMongoId()
            .withMessage('User ID must be a valid MongoDB ObjectId'),
        query('workplaceId')
            .optional()
            .isMongoId()
            .withMessage('Workplace ID must be a valid MongoDB ObjectId'),
        query('activityType')
            .optional()
            .isString()
            .withMessage('Activity type must be a string'),
        query('riskLevel')
            .optional()
            .isIn(['low', 'medium', 'high', 'critical'])
            .withMessage('Risk level must be valid'),
    ],
    validateRequest,
    SuperAdminAuditController.exportAuditData
);

/**
 * @route   GET /api/super-admin/audit-trail/users/:userId
 * @desc    Get user activity timeline
 * @access  Super Admin
 */
router.get(
    '/users/:userId',
    [
        param('userId')
            .isMongoId()
            .withMessage('User ID must be a valid MongoDB ObjectId'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 500 })
            .withMessage('Limit must be between 1 and 500'),
    ],
    validateRequest,
    SuperAdminAuditController.getUserActivityTimeline
);

/**
 * @route   GET /api/super-admin/audit-trail/entities/:entityType/:entityId
 * @desc    Get entity activity history
 * @access  Super Admin
 */
router.get(
    '/entities/:entityType/:entityId',
    [
        param('entityType')
            .isString()
            .withMessage('Entity type must be a string'),
        param('entityId')
            .isMongoId()
            .withMessage('Entity ID must be a valid MongoDB ObjectId'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 500 })
            .withMessage('Limit must be between 1 and 500'),
    ],
    validateRequest,
    SuperAdminAuditController.getEntityActivityHistory
);

/**
 * @route   GET /api/super-admin/audit-trail/search
 * @desc    Search audit logs
 * @access  Super Admin
 */
router.get(
    '/search',
    [
        query('q')
            .notEmpty()
            .withMessage('Search query is required')
            .isString()
            .withMessage('Search query must be a string'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 200 })
            .withMessage('Limit must be between 1 and 200'),
    ],
    validateRequest,
    SuperAdminAuditController.searchAuditLogs
);

/**
 * @route   PUT /api/super-admin/audit-trail/:auditId/flag
 * @desc    Flag/unflag an audit entry for review
 * @access  Super Admin
 */
router.put(
    '/:auditId/flag',
    [
        param('auditId')
            .isMongoId()
            .withMessage('Audit ID must be a valid MongoDB ObjectId'),
        body('flagged')
            .isBoolean()
            .withMessage('Flagged must be a boolean'),
    ],
    validateRequest,
    SuperAdminAuditController.flagAuditEntry
);

/**
 * @route   PUT /api/super-admin/audit-trail/:auditId/review
 * @desc    Review an audit entry
 * @access  Super Admin
 */
router.put(
    '/:auditId/review',
    [
        param('auditId')
            .isMongoId()
            .withMessage('Audit ID must be a valid MongoDB ObjectId'),
        body('reviewNotes')
            .notEmpty()
            .withMessage('Review notes are required')
            .isString()
            .withMessage('Review notes must be a string'),
    ],
    validateRequest,
    SuperAdminAuditController.reviewAuditEntry
);

/**
 * @route   GET /api/super-admin/audit-trail/activity-types
 * @desc    Get all available activity types
 * @access  Super Admin
 */
router.get(
    '/activity-types',
    SuperAdminAuditController.getActivityTypes
);

/**
 * @route   GET /api/super-admin/audit-trail/risk-levels
 * @desc    Get all available risk levels
 * @access  Super Admin
 */
router.get(
    '/risk-levels',
    SuperAdminAuditController.getRiskLevels
);

export default router;
