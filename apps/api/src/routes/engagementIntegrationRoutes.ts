import express from 'express';
import { body, param } from 'express-validator';
import {
  createAppointmentFromMTR,
  linkMTRFollowUpToAppointment,
  createMTRWithAppointment,
  getMTRSessionWithAppointment,
  syncMTRFollowUpStatus,
  createVisitFromAppointment,
  createFollowUpFromIntervention,
  updateInterventionFromFollowUp,
  getInterventionWithEngagementData,
  createFollowUpFromDiagnostic,
  getDiagnosticWithEngagementData,
} from '../controllers/engagementIntegrationController';
import { auth } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Validation schemas
const createAppointmentFromMTRSchema = [
  param('mtrSessionId').isMongoId().withMessage('Invalid MTR session ID'),
  body('patientId').isMongoId().withMessage('Invalid patient ID'),
  body('assignedTo').isMongoId().withMessage('Invalid pharmacist ID'),
  body('scheduledDate').isISO8601().withMessage('Invalid scheduled date'),
  body('scheduledTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:mm format'),
  body('duration').optional().isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('locationId').optional().isString(),
];

const linkMTRFollowUpSchema = [
  body('mtrFollowUpId').isMongoId().withMessage('Invalid MTR follow-up ID'),
  body('appointmentId').isMongoId().withMessage('Invalid appointment ID'),
];

const createMTRWithAppointmentSchema = [
  param('mtrSessionId').isMongoId().withMessage('Invalid MTR session ID'),
  body('patientId').isMongoId().withMessage('Invalid patient ID'),
  body('assignedTo').isMongoId().withMessage('Invalid pharmacist ID'),
  body('scheduledDate').isISO8601().withMessage('Invalid scheduled date'),
  body('scheduledTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:mm format'),
  body('duration').optional().isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('description').isString().isLength({ min: 1, max: 1000 }).withMessage('Description is required and cannot exceed 1000 characters'),
  body('objectives').isArray({ min: 1 }).withMessage('At least one objective is required'),
  body('objectives.*').isString().isLength({ max: 300 }).withMessage('Each objective cannot exceed 300 characters'),
  body('priority').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid priority'),
  body('locationId').optional().isString(),
];

const syncStatusSchema = [
  body('sourceId').isMongoId().withMessage('Invalid source ID'),
  body('sourceType').isIn(['appointment', 'mtr_followup']).withMessage('Invalid source type'),
  body('newStatus').isString().isLength({ min: 1 }).withMessage('New status is required'),
];

const mtrSessionParamSchema = [
  param('mtrSessionId').isMongoId().withMessage('Invalid MTR session ID'),
];

const appointmentParamSchema = [
  param('appointmentId').isMongoId().withMessage('Invalid appointment ID'),
];

const createFollowUpFromInterventionSchema = [
  param('interventionId').isMongoId().withMessage('Invalid intervention ID'),
  body('patientId').isMongoId().withMessage('Invalid patient ID'),
  body('assignedTo').isMongoId().withMessage('Invalid pharmacist ID'),
  body('locationId').optional().isString(),
];

const interventionParamSchema = [
  param('interventionId').isMongoId().withMessage('Invalid intervention ID'),
];

const followUpTaskParamSchema = [
  param('followUpTaskId').isMongoId().withMessage('Invalid follow-up task ID'),
];

const createFollowUpFromDiagnosticSchema = [
  param('diagnosticCaseId').isMongoId().withMessage('Invalid diagnostic case ID'),
  body('assignedTo').optional().isMongoId().withMessage('Invalid pharmacist ID'),
  body('locationId').optional().isString(),
];

const diagnosticCaseParamSchema = [
  param('diagnosticCaseId').isMongoId().withMessage('Invalid diagnostic case ID'),
];

// Routes

/**
 * POST /api/engagement-integration/mtr/:mtrSessionId/appointment
 * Create appointment from MTR session
 */
router.post(
  '/mtr/:mtrSessionId/appointment',
  createAppointmentFromMTRSchema,
  validateRequest,
  createAppointmentFromMTR
);

/**
 * POST /api/engagement-integration/link-mtr-followup
 * Link MTR follow-up to appointment
 */
router.post(
  '/link-mtr-followup',
  linkMTRFollowUpSchema,
  validateRequest,
  linkMTRFollowUpToAppointment
);

/**
 * POST /api/engagement-integration/mtr/:mtrSessionId/schedule
 * Create MTR follow-up with appointment
 */
router.post(
  '/mtr/:mtrSessionId/schedule',
  createMTRWithAppointmentSchema,
  validateRequest,
  createMTRWithAppointment
);

/**
 * GET /api/engagement-integration/mtr/:mtrSessionId
 * Get MTR session with linked appointments
 */
router.get(
  '/mtr/:mtrSessionId',
  mtrSessionParamSchema,
  validateRequest,
  getMTRSessionWithAppointment
);

/**
 * POST /api/engagement-integration/sync-status
 * Sync status between MTR follow-up and appointment
 */
router.post(
  '/sync-status',
  syncStatusSchema,
  validateRequest,
  syncMTRFollowUpStatus
);

/**
 * POST /api/engagement-integration/appointment/:appointmentId/create-visit
 * Create visit from completed appointment
 */
router.post(
  '/appointment/:appointmentId/create-visit',
  appointmentParamSchema,
  validateRequest,
  createVisitFromAppointment
);

/**
 * POST /api/engagement-integration/intervention/:interventionId/create-followup
 * Create follow-up task from clinical intervention
 */
router.post(
  '/intervention/:interventionId/create-followup',
  createFollowUpFromInterventionSchema,
  validateRequest,
  createFollowUpFromIntervention
);

/**
 * POST /api/engagement-integration/followup/:followUpTaskId/update-intervention
 * Update intervention status from completed follow-up
 */
router.post(
  '/followup/:followUpTaskId/update-intervention',
  followUpTaskParamSchema,
  validateRequest,
  updateInterventionFromFollowUp
);

/**
 * GET /api/engagement-integration/intervention/:interventionId
 * Get clinical intervention with linked follow-up tasks and appointments
 */
router.get(
  '/intervention/:interventionId',
  interventionParamSchema,
  validateRequest,
  getInterventionWithEngagementData
);

/**
 * POST /api/engagement-integration/diagnostic/:diagnosticCaseId/create-followup
 * Create follow-up task from diagnostic case
 */
router.post(
  '/diagnostic/:diagnosticCaseId/create-followup',
  createFollowUpFromDiagnosticSchema,
  validateRequest,
  createFollowUpFromDiagnostic
);

/**
 * GET /api/engagement-integration/diagnostic/:diagnosticCaseId
 * Get diagnostic case with linked follow-up tasks and appointments
 */
router.get(
  '/diagnostic/:diagnosticCaseId',
  diagnosticCaseParamSchema,
  validateRequest,
  getDiagnosticWithEngagementData
);

export default router;