import express from 'express';
import { body, param } from 'express-validator';
import * as pharmacistVisitSummaryController from '../controllers/pharmacistVisitSummaryController';
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

// Apply rate limiter, authentication, and authorization to all routes
router.use(limiter);
router.use(auth);
router.use(
    authorize(
        'pharmacist',
        'pharmacy_team',
        'pharmacy_outlet',
        'owner',
        'super_admin'
    )
);

/**
 * @route   GET /api/pharmacist/visit-summaries/pending
 * @desc    Get visits with pending summaries
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.get('/pending', pharmacistVisitSummaryController.getPendingSummaries);

/**
 * @route   PATCH /api/pharmacist/visit-summaries/bulk/visibility
 * @desc    Bulk toggle visibility for multiple visit summaries
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.patch(
    '/bulk/visibility',
    [
        body('visitIds')
            .isArray({ min: 1, max: 50 })
            .withMessage('Visit IDs must be an array with 1-50 items'),
        body('visitIds.*')
            .isMongoId()
            .withMessage('Each visit ID must be a valid MongoDB ID'),
        body('visible')
            .isBoolean()
            .withMessage('Visible must be a boolean'),
        validateRequest,
    ],
    pharmacistVisitSummaryController.bulkToggleVisibility
);

/**
 * @route   GET /api/pharmacist/visit-summaries/:visitId
 * @desc    Get a specific visit summary
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.get(
    '/:visitId',
    [
        param('visitId')
            .isMongoId()
            .withMessage('Visit ID must be a valid MongoDB ID'),
        validateRequest,
    ],
    pharmacistVisitSummaryController.getSummary
);

/**
 * @route   POST /api/pharmacist/visit-summaries/:visitId
 * @desc    Add or update patient summary for a visit
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.post(
    '/:visitId',
    [
        param('visitId')
            .isMongoId()
            .withMessage('Visit ID must be a valid MongoDB ID'),
        body('summary')
            .trim()
            .notEmpty()
            .withMessage('Summary is required')
            .isLength({ max: 1000 })
            .withMessage('Summary must not exceed 1000 characters'),
        body('keyPoints')
            .optional()
            .isArray({ max: 10 })
            .withMessage('Key points must be an array with maximum 10 items'),
        body('keyPoints.*')
            .optional()
            .trim()
            .isLength({ max: 300 })
            .withMessage('Each key point must not exceed 300 characters'),
        body('nextSteps')
            .optional()
            .isArray({ max: 10 })
            .withMessage('Next steps must be an array with maximum 10 items'),
        body('nextSteps.*')
            .optional()
            .trim()
            .isLength({ max: 300 })
            .withMessage('Each next step must not exceed 300 characters'),
        validateRequest,
    ],
    pharmacistVisitSummaryController.addOrUpdateSummary
);

/**
 * @route   PATCH /api/pharmacist/visit-summaries/:visitId/visibility
 * @desc    Toggle visibility of patient summary
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.patch(
    '/:visitId/visibility',
    [
        param('visitId')
            .isMongoId()
            .withMessage('Visit ID must be a valid MongoDB ID'),
        body('visible')
            .isBoolean()
            .withMessage('Visible must be a boolean'),
        validateRequest,
    ],
    pharmacistVisitSummaryController.toggleVisibility
);

/**
 * @route   DELETE /api/pharmacist/visit-summaries/:visitId
 * @desc    Delete a visit summary
 * @access  Pharmacist, Pharmacy Team, Outlet, Owner, Super Admin
 */
router.delete(
    '/:visitId',
    [
        param('visitId')
            .isMongoId()
            .withMessage('Visit ID must be a valid MongoDB ID'),
        validateRequest,
    ],
    pharmacistVisitSummaryController.deleteSummary
);

export default router;
