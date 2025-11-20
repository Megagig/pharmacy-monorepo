import express from 'express';
import { query, param } from 'express-validator';
import { auth } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';
import {
    getHealthRecordsAnalytics,
    getHealthRecordsByWorkspace,
    searchHealthRecords,
    getWorkspacesWithHealthRecordsSummary,
} from '../controllers/superAdminHealthRecordsController';

const router = express.Router();

// Rate limiter for super admin routes (more generous limits)
const superAdminRateLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes
});

/**
 * @route   GET /api/super-admin/health-records/analytics
 * @desc    Get aggregate health records analytics across all workspaces
 * @access  Super Admin only
 */
router.get(
    '/analytics',
    auth,
    superAdminRateLimiter,
    [
        query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
        query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
        query('workspaceId')
            .optional()
            .isMongoId()
            .withMessage('Invalid workspace ID format'),
    ],
    getHealthRecordsAnalytics
);

/**
 * @route   GET /api/super-admin/health-records/by-workspace
 * @desc    Get health records filtered by workspace
 * @access  Super Admin only
 */
router.get(
    '/by-workspace',
    auth,
    superAdminRateLimiter,
    [
        query('workspaceId')
            .notEmpty()
            .withMessage('Workspace ID is required')
            .isMongoId()
            .withMessage('Invalid workspace ID format'),
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('type')
            .optional()
            .isIn(['lab', 'vitals', 'visits'])
            .withMessage('Type must be lab, vitals, or visits'),
    ],
    getHealthRecordsByWorkspace
);

/**
 * @route   GET /api/super-admin/health-records/search
 * @desc    Global search across all health records
 * @access  Super Admin only
 */
router.get(
    '/search',
    auth,
    superAdminRateLimiter,
    [
        query('query')
            .notEmpty()
            .withMessage('Search query is required')
            .isLength({ min: 2 })
            .withMessage('Search query must be at least 2 characters'),
        query('type')
            .optional()
            .isIn(['lab', 'vitals', 'visits'])
            .withMessage('Type must be lab, vitals, or visits'),
        query('workspaceId')
            .optional()
            .isMongoId()
            .withMessage('Invalid workspace ID format'),
        query('status')
            .optional()
            .isIn(['pending', 'completed', 'cancelled'])
            .withMessage('Invalid status value'),
        query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
        query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
    ],
    searchHealthRecords
);

/**
 * @route   GET /api/super-admin/health-records/workspaces
 * @desc    Get list of all workspaces with health records summary
 * @access  Super Admin only
 */
router.get(
    '/workspaces',
    auth,
    superAdminRateLimiter,
    getWorkspacesWithHealthRecordsSummary
);

export default router;
