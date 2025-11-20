import express from 'express';
import {
  createCarePlan,
  getCarePlans,
  updateCarePlan,
} from '../controllers/patientResourcesController';
import { auth } from '../middlewares/auth';
import {
  requirePatientPermission,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createCarePlanSchema,
  updateCarePlanSchema,
  carePlanParamsSchema,
  paginationSchema,
} from '../validators/patientValidators';

const router = express.Router();

/**
 * Patient Care Plan Routes
 * Base path: /api/patients/:id/careplans
 * Individual care plan path: /api/careplans/:carePlanId
 */

// ===============================
// PATIENT-SCOPED CARE PLAN ROUTES
// ===============================

/**
 * POST /api/patients/:id/careplans
 * Create new care plan for patient
 */
router.post(
  '/:id/careplans',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('create'),
  validateRequest(carePlanParamsSchema.pick({ id: true }), 'params'),
  validateRequest(createCarePlanSchema, 'body'),
  createCarePlan
);

/**
 * GET /api/patients/:id/careplans
 * Get all care plans for a patient with pagination
 * Sorted by creation date (most recent first)
 */
router.get(
  '/:id/careplans',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('read'),
  validateRequest(carePlanParamsSchema.pick({ id: true }), 'params'),
  validateRequest(paginationSchema, 'query'),
  getCarePlans
);

// ===============================
// INDIVIDUAL CARE PLAN ROUTES
// ===============================

/**
 * PATCH /api/careplans/:carePlanId
 * Update care plan information
 */
router.patch(
  '/careplans/:carePlanId',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('update'),
  validateRequest(carePlanParamsSchema.pick({ carePlanId: true }), 'params'),
  validateRequest(updateCarePlanSchema, 'body'),
  updateCarePlan
);

export default router;
