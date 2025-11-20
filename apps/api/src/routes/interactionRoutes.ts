import { Router } from 'express';
import { body, param, query } from 'express-validator';
import interactionController from '../controllers/interactionController';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

// Apply authentication to all routes
router.use(auth);

// Validation rules
const checkInteractionsValidation = [
  body('patientId')
    .isMongoId()
    .withMessage('Invalid patient ID'),
  body('medications')
    .isArray({ min: 2 })
    .withMessage('At least 2 medications are required for interaction checking'),
  body('medications.*.name')
    .notEmpty()
    .withMessage('Medication name is required'),
  body('checkType')
    .optional()
    .isIn(['manual', 'automatic', 'scheduled'])
    .withMessage('Invalid check type')
];

const checkPatientMedicationsValidation = [
  body('patientId')
    .isMongoId()
    .withMessage('Invalid patient ID'),
  body('checkType')
    .optional()
    .isIn(['manual', 'automatic', 'scheduled'])
    .withMessage('Invalid check type')
];

const batchCheckValidation = [
  body('patientIds')
    .isArray({ min: 1 })
    .withMessage('At least one patient ID is required'),
  body('patientIds.*')
    .isMongoId()
    .withMessage('Invalid patient ID format')
];

const reviewInteractionValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid interaction ID'),
  body('action')
    .isIn(['approve', 'modify', 'reject', 'monitor'])
    .withMessage('Invalid review action'),
  body('reason')
    .notEmpty()
    .withMessage('Review reason is required'),
  body('modificationSuggestions')
    .optional()
    .isString(),
  body('monitoringParameters')
    .optional()
    .isString(),
  body('notes')
    .optional()
    .isString()
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

const patientIdValidation = [
  param('patientId')
    .isMongoId()
    .withMessage('Invalid patient ID format')
];

/**
 * @route   POST /api/interactions/check
 * @desc    Check interactions for a list of medications
 * @access  Private (Pharmacist, Admin)
 */
router.post(
  '/check',
  requireRole('pharmacist', 'admin'),
  checkInteractionsValidation,
  interactionController.checkInteractions
);

/**
 * @route   POST /api/interactions/check-patient
 * @desc    Check interactions for all active medications of a patient
 * @access  Private (Pharmacist, Admin)
 */
router.post(
  '/check-patient',
  requireRole('pharmacist', 'admin'),
  checkPatientMedicationsValidation,
  interactionController.checkPatientMedications
);

/**
 * @route   POST /api/interactions/batch-check
 * @desc    Batch check interactions for multiple patients
 * @access  Private (Pharmacist, Admin)
 */
router.post(
  '/batch-check',
  requireRole('pharmacist', 'admin'),
  batchCheckValidation,
  interactionController.batchCheckInteractions
);

/**
 * @route   GET /api/interactions/pending-reviews
 * @desc    Get pending interactions requiring pharmacist review
 * @access  Private (Pharmacist, Admin)
 */
router.get(
  '/pending-reviews',
  requireRole('pharmacist', 'admin'),
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500')
  ],
  interactionController.getPendingReviews
);

/**
 * @route   GET /api/interactions/critical
 * @desc    Get critical interactions for dashboard
 * @access  Private (Pharmacist, Admin)
 */
router.get(
  '/critical',
  requireRole('pharmacist', 'admin'),
  [
    query('from')
      .optional()
      .isISO8601()
      .withMessage('Invalid from date format'),
    query('to')
      .optional()
      .isISO8601()
      .withMessage('Invalid to date format')
  ],
  interactionController.getCriticalInteractions
);

/**
 * @route   GET /api/interactions/analytics
 * @desc    Get interaction analytics and statistics
 * @access  Private (Pharmacist, Admin)
 */
router.get(
  '/analytics',
  requireRole('pharmacist', 'admin'),
  [
    query('from')
      .optional()
      .isISO8601()
      .withMessage('Invalid from date format'),
    query('to')
      .optional()
      .isISO8601()
      .withMessage('Invalid to date format')
  ],
  interactionController.getInteractionAnalytics
);

/**
 * @route   GET /api/interactions/patient/:patientId
 * @desc    Get patient's interaction history
 * @access  Private (Pharmacist, Admin, Patient - own data only)
 */
router.get(
  '/patient/:patientId',
  patientIdValidation,
  [
    query('includeResolved')
      .optional()
      .isBoolean()
      .withMessage('includeResolved must be boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200')
  ],
  interactionController.getPatientInteractions
);

/**
 * @route   GET /api/interactions/:id
 * @desc    Get interaction details by ID
 * @access  Private (Pharmacist, Admin)
 */
router.get(
  '/:id',
  requireRole('pharmacist', 'admin'),
  mongoIdValidation,
  interactionController.getInteraction
);

/**
 * @route   POST /api/interactions/:id/review
 * @desc    Review an interaction (pharmacist action)
 * @access  Private (Pharmacist, Admin)
 */
router.post(
  '/:id/review',
  requireRole('pharmacist', 'admin'),
  reviewInteractionValidation,
  interactionController.reviewInteraction
);

/**
 * @route   POST /api/interactions/:id/acknowledge
 * @desc    Mark interaction as acknowledged by patient
 * @access  Private (Patient, Pharmacist, Admin)
 */
router.post(
  '/:id/acknowledge',
  mongoIdValidation,
  interactionController.acknowledgeInteraction
);

export default router;