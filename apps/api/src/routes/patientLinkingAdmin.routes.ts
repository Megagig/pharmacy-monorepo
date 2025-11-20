import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PatientLinkingAdminController } from '../controllers/patientLinkingAdminController';
import { auth, authorize } from '../middlewares/auth';

const router = Router();

// Rate limiting for admin operations
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin operations
  message: {
    success: false,
    error: {
      message: 'Too many admin requests from this IP, please try again later.',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('workspaceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid workspace ID format')
];

const validatePatientUserId = [
  param('patientUserId')
    .isMongoId()
    .withMessage('Invalid PatientUser ID format')
];

const validateManualLink = [
  ...validatePatientUserId,
  body('patientId')
    .isMongoId()
    .withMessage('Invalid Patient ID format'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const validateCreatePatient = [
  ...validatePatientUserId,
  body('additionalData')
    .optional()
    .isObject()
    .withMessage('Additional data must be an object'),
  body('additionalData.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('additionalData.bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('additionalData.genotype')
    .optional()
    .isIn(['AA', 'AS', 'SS', 'AC', 'SC', 'CC'])
    .withMessage('Invalid genotype')
];

const validateBatchRetry = [
  body('workspaceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid workspace ID format')
];

const validateUnlink = [
  ...validatePatientUserId,
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters')
];

// Apply rate limiting and authentication to all routes
router.use(adminRateLimit);
router.use(auth);

/**
 * @route GET /api/admin/patient-linking/unlinked
 * @desc Get list of PatientUsers without linked Patient records
 * @access Private (Admin)
 */
router.get(
  '/unlinked',
  authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
  validatePagination,
  PatientLinkingAdminController.getUnlinkedPatientUsers
);

/**
 * @route GET /api/admin/patient-linking/:patientUserId/matches
 * @desc Find potential Patient matches for a PatientUser
 * @access Private (Admin)
 */
router.get(
  '/:patientUserId/matches',
  authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
  validatePatientUserId,
  PatientLinkingAdminController.findPotentialMatches
);

/**
 * @route POST /api/admin/patient-linking/:patientUserId/link
 * @desc Manually link PatientUser to existing Patient record
 * @access Private (Admin)
 */
router.post(
  '/:patientUserId/link',
  authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
  validateManualLink,
  PatientLinkingAdminController.manuallyLinkPatient
);

/**
 * @route POST /api/admin/patient-linking/:patientUserId/create
 * @desc Create new Patient record for PatientUser
 * @access Private (Admin)
 */
router.post(
  '/:patientUserId/create',
  authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
  validateCreatePatient,
  PatientLinkingAdminController.createPatientRecord
);

/**
 * @route POST /api/admin/patient-linking/batch-retry
 * @desc Batch retry automatic linking for workspace
 * @access Private (Admin)
 */
router.post(
  '/batch-retry',
  authorize('pharmacy_outlet', 'owner', 'super_admin'),
  validateBatchRetry,
  PatientLinkingAdminController.batchRetryLinking
);

/**
 * @route GET /api/admin/patient-linking/stats
 * @desc Get linking statistics for dashboard
 * @access Private (Admin)
 */
router.get(
  '/stats',
  authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
  query('workspaceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid workspace ID format'),
  PatientLinkingAdminController.getLinkingStats
);

/**
 * @route DELETE /api/admin/patient-linking/:patientUserId/unlink
 * @desc Unlink PatientUser from Patient record
 * @access Private (Admin)
 */
router.delete(
  '/:patientUserId/unlink',
  authorize('pharmacy_outlet', 'owner', 'super_admin'),
  validateUnlink,
  PatientLinkingAdminController.unlinkPatient
);

/**
 * @route POST /api/admin/patient-linking/fix-all
 * @desc Fix all unlinked PatientUsers by creating Patient records
 * @access Private (Admin)
 */
router.post(
  '/fix-all',
  authorize('pharmacy_outlet', 'owner', 'super_admin'),
  body('workspaceId')
    .optional()
    .isMongoId()
    .withMessage('Invalid workspace ID format'),
  PatientLinkingAdminController.fixAllUnlinkedUsers
);

export default router;