import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { PatientHealthRecordsController } from '../controllers/patientHealthRecordsController';

const router = Router();

// Rate limiting configurations
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const vitalsLoggingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit vitals logging to 20 requests per hour
  message: {
    success: false,
    error: {
      message: 'Too many vitals logging attempts. Please wait before logging more vitals.',
      code: 'VITALS_RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit PDF downloads to 10 per 15 minutes
  message: {
    success: false,
    error: {
      message: 'Too many download requests. Please wait before downloading more files.',
      code: 'DOWNLOAD_RATE_LIMIT_EXCEEDED'
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
    .withMessage('Limit must be between 1 and 100')
];

const validateObjectId = [
  param('resultId')
    .isMongoId()
    .withMessage('Invalid result ID format'),
];

const validateVisitId = [
  param('visitId')
    .isMongoId()
    .withMessage('Invalid visit ID format'),
];

const validateVitalsData = [
  body('bloodPressure')
    .optional()
    .isObject()
    .withMessage('Blood pressure must be an object'),
  body('bloodPressure.systolic')
    .optional()
    .isFloat({ min: 50, max: 300 })
    .withMessage('Systolic pressure must be between 50-300 mmHg'),
  body('bloodPressure.diastolic')
    .optional()
    .isFloat({ min: 30, max: 200 })
    .withMessage('Diastolic pressure must be between 30-200 mmHg'),
  body('heartRate')
    .optional()
    .isFloat({ min: 30, max: 250 })
    .withMessage('Heart rate must be between 30-250 bpm'),
  body('temperature')
    .optional()
    .isFloat({ min: 30, max: 45 })
    .withMessage('Temperature must be between 30-45°C'),
  body('weight')
    .optional()
    .isFloat({ min: 0.1, max: 1000 })
    .withMessage('Weight must be between 0.1-1000 kg'),
  body('glucose')
    .optional()
    .isFloat({ min: 20, max: 800 })
    .withMessage('Glucose level must be between 20-800 mg/dL'),
  body('oxygenSaturation')
    .optional()
    .isFloat({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50-100%'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const validateVitalsQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const validateTrendsQuery = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const validateDownloadQuery = [
  query('includeProfile')
    .optional()
    .isBoolean()
    .withMessage('includeProfile must be a boolean'),
  query('includeMedications')
    .optional()
    .isBoolean()
    .withMessage('includeMedications must be a boolean'),
  query('includeVitals')
    .optional()
    .isBoolean()
    .withMessage('includeVitals must be a boolean'),
  query('includeLabResults')
    .optional()
    .isBoolean()
    .withMessage('includeLabResults must be a boolean'),
  query('includeVisitHistory')
    .optional()
    .isBoolean()
    .withMessage('includeVisitHistory must be a boolean'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const validateLabResultsDownload = [
  body('resultIds')
    .optional()
    .isArray()
    .withMessage('Result IDs must be an array'),
  body('resultIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each result ID must be a valid MongoDB ObjectId')
];

// Apply general rate limiting to all routes
router.use(generalRateLimit);

/**
 * @route GET /api/patient-portal/health-records/lab-results
 * @desc Get lab results list for authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/lab-results',
  validatePagination,
  PatientHealthRecordsController.getLabResults
);

/**
 * @route GET /api/patient-portal/health-records/lab-results/:resultId
 * @desc Get detailed lab result by ID
 * @access Private (Patient)
 */
router.get(
  '/lab-results/:resultId',
  validateObjectId,
  PatientHealthRecordsController.getLabResultDetails
);

/**
 * @route GET /api/patient-portal/health-records/visits
 * @desc Get visit history for authenticated patient
 * @access Private (Patient)
 */
router.get(
  '/visits',
  validatePagination,
  PatientHealthRecordsController.getVisitHistory
);

/**
 * @route GET /api/patient-portal/health-records/visits/:visitId
 * @desc Get detailed visit information by ID
 * @access Private (Patient)
 */
router.get(
  '/visits/:visitId',
  validateVisitId,
  PatientHealthRecordsController.getVisitDetails
);

/**
 * @route POST /api/patient-portal/health-records/vitals
 * @desc Log patient vitals
 * @access Private (Patient)
 */
router.post(
  '/vitals',
  vitalsLoggingRateLimit,
  validateVitalsData,
  PatientHealthRecordsController.logVitals
);

/**
 * @route GET /api/patient-portal/health-records/vitals
 * @desc Get patient vitals history
 * @access Private (Patient)
 */
router.get(
  '/vitals',
  validateVitalsQuery,
  PatientHealthRecordsController.getVitalsHistory
);

/**
 * @route GET /api/patient-portal/health-records/vitals/trends
 * @desc Get patient vitals trends
 * @access Private (Patient)
 */
router.get(
  '/vitals/trends',
  validateTrendsQuery,
  PatientHealthRecordsController.getVitalsTrends
);

/**
 * @route GET /api/patient-portal/health-records/download
 * @desc Download comprehensive medical records as PDF
 * @access Private (Patient)
 */
router.get(
  '/download',
  downloadRateLimit,
  validateDownloadQuery,
  PatientHealthRecordsController.downloadMedicalRecords
);

/**
 * @route GET /api/patient-portal/health-records/medications/download
 * @desc Download medication list as PDF
 * @access Private (Patient)
 */
router.get(
  '/medications/download',
  downloadRateLimit,
  PatientHealthRecordsController.downloadMedicationList
);

/**
 * @route POST /api/patient-portal/health-records/lab-results/download
 * @desc Download specific lab results as PDF
 * @access Private (Patient)
 */
router.post(
  '/lab-results/download',
  downloadRateLimit,
  validateLabResultsDownload,
  PatientHealthRecordsController.downloadLabResults
);

/**
 * @route GET /api/patient-portal/health-records/summary
 * @desc Get health summary dashboard data
 * @access Private (Patient)
 */
router.get(
  '/summary',
  PatientHealthRecordsController.getHealthSummary
);

export default router;