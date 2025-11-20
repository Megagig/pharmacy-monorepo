/**
 * Follow-up Task Routes
 * 
 * Routes for follow-up task management with feature flag protection
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import { validateRequest } from '../middlewares/validation';
import {
  requirePatientEngagementModule,
  requireFollowUpManagement,
  requireModuleIntegration,
  PATIENT_ENGAGEMENT_FLAGS
} from '../middlewares/patientEngagementFeatureFlags';
import followUpController from '../controllers/followUpController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Apply patient engagement module check to all routes
router.use(requirePatientEngagementModule);

// Apply follow-up management feature flag to all routes
router.use(requireFollowUpManagement);

/**
 * @route   GET /api/follow-ups
 * @desc    Get follow-up tasks with filtering
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.get(
  '/',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    query('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'converted_to_appointment'])
      .withMessage('Invalid status filter'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority filter'),
    query('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
    query('patientId')
      .optional()
      .isMongoId()
      .withMessage('Patient ID must be valid'),
    query('type')
      .optional()
      .isIn(['medication_start_followup', 'lab_result_review', 'hospital_discharge_followup',
             'medication_change_followup', 'chronic_disease_monitoring', 'adherence_check',
             'refill_reminder', 'preventive_care', 'general_followup'])
      .withMessage('Invalid follow-up type'),
    query('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Due date must be in ISO format'),
    query('overdue')
      .optional()
      .isBoolean()
      .withMessage('Overdue filter must be boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
  ],
  validateRequest,
  followUpController.getFollowUpTasks
);

/**
 * @route   POST /api/follow-ups
 * @desc    Create new follow-up task
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    body('patientId')
      .isMongoId()
      .withMessage('Patient ID is required and must be valid'),
    body('type')
      .isIn(['medication_start_followup', 'lab_result_review', 'hospital_discharge_followup',
             'medication_change_followup', 'chronic_disease_monitoring', 'adherence_check',
             'refill_reminder', 'preventive_care', 'general_followup'])
      .withMessage('Valid follow-up type is required'),
    body('title')
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage('Title is required and must not exceed 200 characters'),
    body('description')
      .notEmpty()
      .isLength({ max: 1000 })
      .withMessage('Description is required and must not exceed 1000 characters'),
    body('objectives')
      .isArray({ min: 1 })
      .withMessage('At least one objective is required'),
    body('objectives.*')
      .isString()
      .isLength({ max: 200 })
      .withMessage('Each objective must be a string not exceeding 200 characters'),
    body('priority')
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Valid priority is required'),
    body('dueDate')
      .isISO8601()
      .withMessage('Due date is required and must be in ISO format'),
    body('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
    body('estimatedDuration')
      .optional()
      .isInt({ min: 5, max: 480 })
      .withMessage('Estimated duration must be between 5 and 480 minutes'),
    body('trigger')
      .isObject()
      .withMessage('Trigger information is required'),
    body('trigger.type')
      .isIn(['manual', 'medication_start', 'lab_result', 'hospital_discharge',
             'medication_change', 'scheduled_monitoring', 'missed_appointment', 'system_rule'])
      .withMessage('Valid trigger type is required'),
    body('trigger.sourceId')
      .optional()
      .isMongoId()
      .withMessage('Trigger source ID must be valid'),
    body('trigger.sourceType')
      .optional()
      .isString()
      .withMessage('Trigger source type must be a string'),
  ],
  validateRequest,
  followUpController.createFollowUpTask
);

/**
 * @route   GET /api/follow-ups/:id
 * @desc    Get single follow-up task
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.get(
  '/:id',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('id')
      .isMongoId()
      .withMessage('Follow-up task ID must be valid'),
  ],
  validateRequest,
  followUpController.getFollowUpTask
);

/**
 * @route   PUT /api/follow-ups/:id
 * @desc    Update follow-up task
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.put(
  '/:id',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('id')
      .isMongoId()
      .withMessage('Follow-up task ID must be valid'),
    body('title')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Title must not exceed 200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('objectives')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one objective is required'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Due date must be in ISO format'),
    body('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
    body('estimatedDuration')
      .optional()
      .isInt({ min: 5, max: 480 })
      .withMessage('Estimated duration must be between 5 and 480 minutes'),
  ],
  validateRequest,
  followUpController.updateFollowUpTask
);

/**
 * @route   POST /api/follow-ups/:id/complete
 * @desc    Complete follow-up task
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/:id/complete',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('id')
      .isMongoId()
      .withMessage('Follow-up task ID must be valid'),
    body('outcome')
      .isObject()
      .withMessage('Outcome information is required'),
    body('outcome.status')
      .isIn(['successful', 'partially_successful', 'unsuccessful'])
      .withMessage('Valid outcome status is required'),
    body('outcome.notes')
      .notEmpty()
      .isLength({ max: 1000 })
      .withMessage('Outcome notes are required and must not exceed 1000 characters'),
    body('outcome.nextActions')
      .optional()
      .isArray()
      .withMessage('Next actions must be an array'),
    body('outcome.appointmentCreated')
      .optional()
      .isBoolean()
      .withMessage('appointmentCreated must be boolean'),
    body('outcome.appointmentId')
      .optional()
      .isMongoId()
      .withMessage('Appointment ID must be valid'),
  ],
  validateRequest,
  followUpController.completeFollowUpTask
);

/**
 * @route   POST /api/follow-ups/:id/convert-to-appointment
 * @desc    Convert follow-up task to appointment
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/:id/convert-to-appointment',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('id')
      .isMongoId()
      .withMessage('Follow-up task ID must be valid'),
    body('scheduledDate')
      .isISO8601()
      .withMessage('Scheduled date is required and must be in ISO format'),
    body('scheduledTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Scheduled time is required and must be in HH:mm format'),
    body('duration')
      .optional()
      .isInt({ min: 5, max: 120 })
      .withMessage('Duration must be between 5 and 120 minutes'),
    body('type')
      .optional()
      .isIn(['mtm_session', 'chronic_disease_review', 'new_medication_consultation', 
             'vaccination', 'health_check', 'smoking_cessation', 'general_followup'])
      .withMessage('Invalid appointment type'),
    body('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
  ],
  validateRequest,
  followUpController.convertToAppointment
);

/**
 * @route   GET /api/follow-ups/overdue
 * @desc    Get overdue follow-up tasks
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.get(
  '/overdue',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    query('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority filter'),
    query('daysPastDue')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Days past due must be a non-negative integer'),
  ],
  validateRequest,
  followUpController.getOverdueFollowUps
);

/**
 * @route   POST /api/follow-ups/:id/escalate
 * @desc    Escalate follow-up task priority
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/:id/escalate',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('id')
      .isMongoId()
      .withMessage('Follow-up task ID must be valid'),
    body('newPriority')
      .isIn(['medium', 'high', 'urgent', 'critical'])
      .withMessage('Valid new priority is required'),
    body('reason')
      .notEmpty()
      .isLength({ max: 500 })
      .withMessage('Escalation reason is required and must not exceed 500 characters'),
  ],
  validateRequest,
  followUpController.escalateFollowUp
);

/**
 * @route   GET /api/follow-ups/patient/:patientId
 * @desc    Get follow-up tasks for a specific patient
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.get(
  '/patient/:patientId',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    param('patientId')
      .isMongoId()
      .withMessage('Patient ID must be valid'),
    query('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue'])
      .withMessage('Invalid status filter'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  followUpController.getPatientFollowUps
);

/**
 * @route   GET /api/follow-ups/dashboard/summary
 * @desc    Get follow-up dashboard summary
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.get(
  '/dashboard/summary',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    query('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Assigned pharmacist ID must be valid'),
    query('dateRange')
      .optional()
      .isIn(['today', 'week', 'month'])
      .withMessage('Date range must be today, week, or month'),
  ],
  validateRequest,
  followUpController.getDashboardSummary
);

/**
 * Integration Routes (require module integration feature flag)
 */

/**
 * @route   POST /api/follow-ups/from-intervention
 * @desc    Create follow-up task from clinical intervention
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/from-intervention',
  requireModuleIntegration,
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    body('interventionId')
      .isMongoId()
      .withMessage('Clinical intervention ID is required and must be valid'),
    body('followUpType')
      .optional()
      .isIn(['medication_start_followup', 'medication_change_followup', 'adherence_check'])
      .withMessage('Invalid follow-up type for intervention'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority'),
    body('dueInDays')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('Due in days must be between 1 and 90'),
  ],
  validateRequest,
  followUpController.createFromIntervention
);

/**
 * @route   POST /api/follow-ups/from-lab-result
 * @desc    Create follow-up task from lab result
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/from-lab-result',
  requireModuleIntegration,
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    body('labResultId')
      .isMongoId()
      .withMessage('Lab result ID is required and must be valid'),
    body('abnormalValues')
      .optional()
      .isArray()
      .withMessage('Abnormal values must be an array'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority'),
  ],
  validateRequest,
  followUpController.createFromLabResult
);

/**
 * @route   POST /api/follow-ups/from-medication-start
 * @desc    Create follow-up task from medication start
 * @access  Private (Pharmacist, Manager, Admin)
 */
router.post(
  '/from-medication-start',
  requireModuleIntegration,
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),
  [
    body('medicationId')
      .isMongoId()
      .withMessage('Medication ID is required and must be valid'),
    body('patientId')
      .isMongoId()
      .withMessage('Patient ID is required and must be valid'),
    body('isHighRisk')
      .optional()
      .isBoolean()
      .withMessage('isHighRisk must be boolean'),
    body('followUpDays')
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage('Follow-up days must be between 1 and 30'),
  ],
  validateRequest,
  followUpController.createFromMedicationStart
);

/**
 * @route   GET /api/follow-ups/analytics/summary
 * @desc    Get follow-up analytics summary
 * @access  Private (Manager, Admin)
 */
router.get(
  '/analytics/summary',
  rbac.requireRole('pharmacy_manager', 'admin'),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO format'),
    query('pharmacistId')
      .optional()
      .isMongoId()
      .withMessage('Pharmacist ID must be valid'),
  ],
  validateRequest,
  followUpController.getAnalyticsSummary
);

export default router;