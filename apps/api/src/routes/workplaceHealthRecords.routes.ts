import express from 'express';
import { body, param } from 'express-validator';
import * as workplaceHealthRecordsController from '../controllers/workplaceHealthRecordsController';
import { auth, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
});

// Apply rate limiter and authentication to all routes
router.use(limiter);
router.use(auth);

/**
 * @route   GET /api/workplace/health-records-features
 * @desc    Get health records feature flags for current workplace
 * @access  Authenticated users (any role)
 */
router.get(
    '/',
    workplaceHealthRecordsController.getHealthRecordsFeatures
);

/**
 * @route   GET /api/workplace/health-records-features/stats
 * @desc    Get feature statistics across all workplaces
 * @access  Super Admin only
 */
router.get(
    '/stats',
    authorize('super_admin'),
    workplaceHealthRecordsController.getFeatureStats
);

/**
 * @route   PATCH /api/workplace/health-records-features
 * @desc    Update health records feature flags
 * @access  Pharmacy Outlet, Owner, Super Admin
 */
router.patch(
    '/',
    authorize('pharmacy_outlet', 'owner', 'super_admin'),
    [
        body('labResults')
            .optional()
            .isBoolean()
            .withMessage('labResults must be a boolean'),
        body('vitalsTracking')
            .optional()
            .isBoolean()
            .withMessage('vitalsTracking must be a boolean'),
        body('visitHistory')
            .optional()
            .isBoolean()
            .withMessage('visitHistory must be a boolean'),
        body('downloadRecords')
            .optional()
            .isBoolean()
            .withMessage('downloadRecords must be a boolean'),
        body('vitalsVerification')
            .optional()
            .isBoolean()
            .withMessage('vitalsVerification must be a boolean'),
        body('visitSummaries')
            .optional()
            .isBoolean()
            .withMessage('visitSummaries must be a boolean'),
        validateRequest,
    ],
    workplaceHealthRecordsController.updateHealthRecordsFeatures
);

/**
 * @route   PATCH /api/workplace/health-records-features/:featureName/toggle
 * @desc    Toggle a specific feature on/off
 * @access  Pharmacy Outlet, Owner, Super Admin
 */
router.patch(
    '/:featureName/toggle',
    authorize('pharmacy_outlet', 'owner', 'super_admin'),
    [
        param('featureName')
            .isIn([
                'labResults',
                'vitalsTracking',
                'visitHistory',
                'downloadRecords',
                'vitalsVerification',
                'visitSummaries',
            ])
            .withMessage('Invalid feature name'),
        validateRequest,
    ],
    workplaceHealthRecordsController.toggleFeature
);

/**
 * @route   POST /api/workplace/health-records-features/reset
 * @desc    Reset all features to default (all enabled)
 * @access  Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/reset',
    authorize('pharmacy_outlet', 'owner', 'super_admin'),
    workplaceHealthRecordsController.resetFeaturesToDefault
);

export default router;
