import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { PharmacistLabInterpretationController } from '../controllers/pharmacistLabInterpretationController';
import { auth, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for lab interpretation endpoints
const interpretationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: {
        success: false,
        error: {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply authentication and role authorization to all routes
router.use(auth);
router.use(authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'));

// Validation schemas
const addInterpretationValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid diagnostic case ID'),
    body('summary')
        .notEmpty()
        .withMessage('Summary is required')
        .isString()
        .withMessage('Summary must be a string')
        .trim()
        .isLength({ max: 500 })
        .withMessage('Summary cannot exceed 500 characters'),
    body('keyFindings')
        .optional()
        .isArray()
        .withMessage('Key findings must be an array')
        .custom((value) => {
            if (value.length > 10) {
                throw new Error('Maximum 10 key findings allowed');
            }
            return true;
        }),
    body('whatThisMeans')
        .notEmpty()
        .withMessage('Explanation (what this means) is required')
        .isString()
        .withMessage('Explanation must be a string')
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Explanation cannot exceed 1000 characters'),
    body('recommendations')
        .optional()
        .isArray()
        .withMessage('Recommendations must be an array')
        .custom((value) => {
            if (value.length > 15) {
                throw new Error('Maximum 15 recommendations allowed');
            }
            return true;
        }),
    body('whenToSeekCare')
        .notEmpty()
        .withMessage('When to seek care guidance is required')
        .isString()
        .withMessage('When to seek care must be a string')
        .trim()
        .isLength({ max: 500 })
        .withMessage('When to seek care cannot exceed 500 characters'),
    body('visibleToPatient')
        .optional()
        .isBoolean()
        .withMessage('Visible to patient must be a boolean'),
];

const toggleVisibilityValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid diagnostic case ID'),
    body('visibleToPatient')
        .notEmpty()
        .withMessage('Visibility flag is required')
        .isBoolean()
        .withMessage('Visible to patient must be a boolean'),
];

const getInterpretationValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid diagnostic case ID'),
];

const pendingInterpretationsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
];

/**
 * @route POST /api/pharmacist/lab-results/:id/interpretation
 * @desc Add or update patient-friendly interpretation for lab results
 * @access Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.post(
    '/:id/interpretation',
    interpretationRateLimit,
    addInterpretationValidation,
    validateRequest,
    PharmacistLabInterpretationController.addOrUpdateInterpretation
);

/**
 * @route PUT /api/pharmacist/lab-results/:id/visibility
 * @desc Toggle patient visibility for lab result interpretation
 * @access Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.put(
    '/:id/visibility',
    interpretationRateLimit,
    toggleVisibilityValidation,
    validateRequest,
    PharmacistLabInterpretationController.toggleVisibility
);

/**
 * @route GET /api/pharmacist/lab-results/pending-interpretation
 * @desc Get list of lab results that need patient interpretation
 * @access Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.get(
    '/pending-interpretation',
    interpretationRateLimit,
    pendingInterpretationsValidation,
    validateRequest,
    PharmacistLabInterpretationController.getPendingInterpretations
);

/**
 * @route GET /api/pharmacist/lab-results/:id/interpretation
 * @desc Get patient interpretation for a specific lab result
 * @access Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.get(
    '/:id/interpretation',
    interpretationRateLimit,
    getInterpretationValidation,
    validateRequest,
    PharmacistLabInterpretationController.getInterpretation
);

/**
 * @route DELETE /api/pharmacist/lab-results/:id/interpretation
 * @desc Delete patient interpretation (rarely used, compliance purposes)
 * @access Private (Owner, Super Admin only - elevated permissions)
 */
router.delete(
    '/:id/interpretation',
    interpretationRateLimit,
    authorize('owner', 'super_admin'), // More restrictive - only owner/super_admin can delete
    getInterpretationValidation,
    validateRequest,
    PharmacistLabInterpretationController.deleteInterpretation
);

export default router;
