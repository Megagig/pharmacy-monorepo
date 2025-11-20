import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PatientMedicationController } from '../controllers/patientMedicationController';

const router = Router();

// Rate limiting configurations
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const refillRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit refill requests to 10 per hour per IP
  message: {
    success: false,
    message: 'Too many refill requests. Please wait before submitting another request.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const reminderRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit reminder updates to 20 per 5 minutes
  message: {
    success: false,
    message: 'Too many reminder updates. Please wait before making changes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation middleware
const validateMedicationId = [
  param('medicationId')
    .isMongoId()
    .withMessage('Invalid medication ID format')
];

const validateRefillRequest = [
  body('medicationId')
    .isMongoId()
    .withMessage('Invalid medication ID format'),
  body('requestedQuantity')
    .isInt({ min: 1, max: 365 })
    .withMessage('Requested quantity must be between 1 and 365'),
  body('urgency')
    .optional()
    .isIn(['routine', 'urgent'])
    .withMessage('Urgency must be either routine or urgent'),
  body('patientNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Patient notes cannot exceed 1000 characters')
    .trim(),
  body('estimatedPickupDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid pickup date format')
    .custom((value) => {
      if (value && new Date(value) < new Date()) {
        throw new Error('Pickup date cannot be in the past');
      }
      return true;
    })
];

const validateAdherenceScore = [
  body('adherenceScore')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Adherence score must be a number between 0 and 100')
];

const validateReminders = [
  body('reminderTimes')
    .isArray({ min: 0, max: 10 })
    .withMessage('Reminder times must be an array with maximum 10 items'),
  body('reminderTimes.*')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Each reminder time must be in HH:MM format (e.g., 08:00)'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

const validateRequestId = [
  param('requestId')
    .isMongoId()
    .withMessage('Invalid request ID format')
];

const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
];

const validateSeverityFilter = [
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be one of: low, medium, high, critical')
];

const validateStatusFilter = [
  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled, overdue')
];

// Apply general rate limiting to all routes
router.use(generalRateLimit);

/**
 * @route GET /api/patient-portal/medications/current
 * @desc Get current active medications for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/current',
  PatientMedicationController.getCurrentMedications
);

/**
 * @route GET /api/patient-portal/medications/history
 * @desc Get medication history for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/history',
  validatePagination,
  PatientMedicationController.getMedicationHistory
);

/**
 * @route GET /api/patient-portal/medications/adherence
 * @desc Get adherence data for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/adherence',
  PatientMedicationController.getAdherenceData
);

/**
 * @route GET /api/patient-portal/medications/reminders
 * @desc Get medication reminders for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/reminders',
  PatientMedicationController.getMedicationReminders
);

/**
 * @route GET /api/patient-portal/medications/alerts
 * @desc Get medication alerts for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/alerts',
  validateSeverityFilter,
  PatientMedicationController.getMedicationAlerts
);

/**
 * @route GET /api/patient-portal/medications/refill-requests
 * @desc Get refill requests for the authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/refill-requests',
  validatePagination,
  validateStatusFilter,
  PatientMedicationController.getRefillRequests
);

/**
 * @route GET /api/patient-portal/medications/:medicationId
 * @desc Get detailed information about a specific medication
 * @access Private (Patient)
 */
router.get(
  '/:medicationId',
  validateMedicationId,
  PatientMedicationController.getMedicationDetails
);

/**
 * @route GET /api/patient-portal/medications/:medicationId/refill-eligibility
 * @desc Check refill eligibility for a specific medication
 * @access Private (Patient)
 */
router.get(
  '/:medicationId/refill-eligibility',
  validateMedicationId,
  PatientMedicationController.checkRefillEligibility
);

/**
 * @route PUT /api/patient-portal/medications/:medicationId/adherence
 * @desc Update adherence score for a specific medication
 * @access Private (Patient)
 */
router.put(
  '/:medicationId/adherence',
  validateMedicationId,
  validateAdherenceScore,
  PatientMedicationController.updateAdherenceScore
);

/**
 * @route POST /api/patient-portal/medications/refill-requests
 * @desc Request a medication refill
 * @access Private (Patient)
 */
router.post(
  '/refill-requests',
  refillRequestRateLimit,
  validateRefillRequest,
  PatientMedicationController.requestRefill
);

/**
 * @route POST /api/patient-portal/medications/:medicationId/reminders
 * @desc Set medication reminders for a specific medication
 * @access Private (Patient)
 */
router.post(
  '/:medicationId/reminders',
  reminderRateLimit,
  validateMedicationId,
  validateReminders,
  PatientMedicationController.setMedicationReminders
);

/**
 * @route DELETE /api/patient-portal/medications/refill-requests/:requestId
 * @desc Cancel a refill request
 * @access Private (Patient)
 */
router.delete(
  '/refill-requests/:requestId',
  validateRequestId,
  PatientMedicationController.cancelRefillRequest
);

export default router;