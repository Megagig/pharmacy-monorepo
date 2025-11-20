import express from 'express';
import {
  createAssessment,
  getAssessments,
  updateAssessment,
} from '../controllers/patientResourcesController';
import { auth } from '../middlewares/auth';
import {
  requirePatientPermission,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentParamsSchema,
  paginationSchema,
} from '../validators/patientValidators';

const router = express.Router();

/**
 * Patient Clinical Assessment Routes
 * Base path: /api/patients/:id/assessments
 * Individual assessment path: /api/assessments/:assessmentId
 */

// ===============================
// PATIENT-SCOPED ASSESSMENT ROUTES
// ===============================

/**
 * POST /api/patients/:id/assessments
 * Add new clinical assessment to patient (vitals and/or labs)
 */
router.post(
  '/:id/assessments',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('create'),
  validateRequest(assessmentParamsSchema.pick({ id: true }), 'params'),
  validateRequest(createAssessmentSchema, 'body'),
  createAssessment
);

/**
 * GET /api/patients/:id/assessments
 * Get all clinical assessments for a patient with pagination
 * Sorted by recordedAt date (most recent first)
 */
router.get(
  '/:id/assessments',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('read'),
  validateRequest(assessmentParamsSchema.pick({ id: true }), 'params'),
  validateRequest(paginationSchema, 'query'),
  getAssessments
);

// ===============================
// INDIVIDUAL ASSESSMENT ROUTES
// ===============================

/**
 * PATCH /api/assessments/:assessmentId
 * Update clinical assessment information
 */
router.patch(
  '/assessments/:assessmentId',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('update'),
  validateRequest(
    assessmentParamsSchema.pick({ assessmentId: true }),
    'params'
  ),
  validateRequest(updateAssessmentSchema, 'body'),
  updateAssessment
);

export default router;
