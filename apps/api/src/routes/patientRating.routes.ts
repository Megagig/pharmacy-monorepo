import { Router } from 'express';
import { PatientRatingController } from '../controllers/patientRatingController';
import { auth } from '../middlewares/auth';
import { validatePatientAccess } from '../middlewares/patientAuth';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middlewares/inputValidation';

const router = Router();

// Apply authentication to all routes
router.use(auth);

// Validation middleware for patient rating routes
const validatePatientId = [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  handleValidationErrors
];

const validatePharmacistId = [
  param('pharmacistId').isMongoId().withMessage('Invalid pharmacist ID'),
  handleValidationErrors
];

const validateRatingId = [
  param('ratingId').isMongoId().withMessage('Invalid rating ID'),
  handleValidationErrors
];

const validateRatingData = [
  body('pharmacistId')
    .isMongoId()
    .withMessage('Valid pharmacist ID is required'),
  body('appointmentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid appointment ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedback')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Feedback must be 2000 characters or less'),
  body('categories.professionalism')
    .isInt({ min: 1, max: 5 })
    .withMessage('Professionalism rating must be between 1 and 5'),
  body('categories.communication')
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  body('categories.expertise')
    .isInt({ min: 1, max: 5 })
    .withMessage('Expertise rating must be between 1 and 5'),
  body('categories.timeliness')
    .isInt({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean'),
  handleValidationErrors
];

const validateResponseData = [
  body('responseText')
    .notEmpty()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Response text is required and must be between 1 and 1000 characters'),
  handleValidationErrors
];

const validatePaginationQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
  handleValidationErrors
];

const validateRatingFilters = [
  query('ratingMin')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Minimum rating must be between 1 and 5'),
  query('ratingMax')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Maximum rating must be between 1 and 5'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateFrom format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateTo format'),
  query('hasResponse')
    .optional()
    .isBoolean()
    .withMessage('hasResponse must be a boolean'),
  ...validatePaginationQuery
];

const validateAnalyticsQuery = [
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateFrom format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateTo format'),
  handleValidationErrors
];

/**
 * @route POST /api/patients/:patientId/ratings
 * @desc Submit a new rating for a consultation
 * @access Patient (own data only)
 */
router.post(
  '/patients/:patientId/ratings',
  validatePatientId,
  validateRatingData,
  validatePatientAccess,
  PatientRatingController.submitRating
);

/**
 * @route GET /api/patients/:patientId/ratings
 * @desc Get ratings submitted by a patient
 * @access Patient (own data), Admin
 */
router.get(
  '/patients/:patientId/ratings',
  validatePatientId,
  validatePaginationQuery,
  validatePatientAccess,
  PatientRatingController.getPatientRatings
);

/**
 * @route GET /api/pharmacists/:pharmacistId/ratings
 * @desc Get ratings for a specific pharmacist
 * @access Pharmacist (own ratings), Admin (any ratings)
 */
router.get(
  '/pharmacists/:pharmacistId/ratings',
  validatePharmacistId,
  validateRatingFilters,
  PatientRatingController.getPharmacistRatings
);

/**
 * @route GET /api/pharmacists/:pharmacistId/ratings/stats
 * @desc Get rating statistics for a pharmacist
 * @access Pharmacist (own stats), Admin (any stats)
 */
router.get(
  '/pharmacists/:pharmacistId/ratings/stats',
  validatePharmacistId,
  PatientRatingController.getPharmacistRatingStats
);

/**
 * @route POST /api/ratings/:ratingId/respond
 * @desc Add response to a rating
 * @access Pharmacist (own ratings), Admin
 */
router.post(
  '/ratings/:ratingId/respond',
  validateRatingId,
  validateResponseData,
  PatientRatingController.addRatingResponse
);

/**
 * @route GET /api/ratings/analytics
 * @desc Get rating analytics for workspace
 * @access Admin only
 */
router.get(
  '/ratings/analytics',
  validateAnalyticsQuery,
  PatientRatingController.getRatingAnalytics
);

/**
 * @route PUT /api/ratings/:ratingId
 * @desc Update a rating (only before pharmacist responds)
 * @access Patient (own ratings only)
 */
router.put(
  '/ratings/:ratingId',
  validateRatingId,
  [
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('feedback')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Feedback must be 2000 characters or less'),
    body('categories.professionalism')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Professionalism rating must be between 1 and 5'),
    body('categories.communication')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Communication rating must be between 1 and 5'),
    body('categories.expertise')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Expertise rating must be between 1 and 5'),
    body('categories.timeliness')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Timeliness rating must be between 1 and 5'),
    handleValidationErrors
  ],
  PatientRatingController.updateRating
);

/**
 * @route DELETE /api/ratings/:ratingId
 * @desc Delete a rating (only before pharmacist responds)
 * @access Patient (own ratings only)
 */
router.delete(
  '/ratings/:ratingId',
  validateRatingId,
  PatientRatingController.deleteRating
);

export default router;