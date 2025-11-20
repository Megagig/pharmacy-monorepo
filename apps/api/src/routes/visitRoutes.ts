import express from 'express';
import {
  createVisit,
  getVisits,
  getVisit,
  updateVisit,
  addVisitAttachment,
} from '../controllers/patientResourcesController';
import { auth } from '../middlewares/auth';
import {
  requirePatientPermission,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createVisitSchema,
  updateVisitSchema,
  visitParamsSchema,
  paginationSchema,
  attachmentSchema,
} from '../validators/patientValidators';

const router = express.Router();

/**
 * Patient Visit Routes
 * Base path: /api/patients/:id/visits
 * Individual visit path: /api/visits/:visitId
 */

// ===============================
// PATIENT-SCOPED VISIT ROUTES
// ===============================

/**
 * POST /api/patients/:id/visits
 * Create new visit for patient with SOAP notes
 */
router.post(
  '/:id/visits',
  auth as any,
  checkPharmacyAccess as any,
  requirePatientPermission('create') as any,
  validateRequest(visitParamsSchema.pick({ id: true }), 'params') as any,
  validateRequest(createVisitSchema, 'body') as any,
  createVisit as any
);

/**
 * GET /api/patients/:id/visits
 * Get all visits for a patient with pagination
 * Sorted by visit date (most recent first)
 */
router.get(
  '/:id/visits',
  auth as any,
  checkPharmacyAccess as any,
  requirePatientPermission('read') as any,
  validateRequest(visitParamsSchema.pick({ id: true }), 'params') as any,
  validateRequest(paginationSchema, 'query') as any,
  getVisits as any
);

// ===============================
// INDIVIDUAL VISIT ROUTES
// ===============================

/**
 * GET /api/visits/:visitId
 * Get detailed visit information with patient details
 */
router.get(
  '/visits/:visitId',
  auth as any,
  checkPharmacyAccess as any,
  requirePatientPermission('read') as any,
  validateRequest(visitParamsSchema.pick({ visitId: true }), 'params') as any,
  getVisit as any
);

/**
 * PATCH /api/visits/:visitId
 * Update visit information and SOAP notes
 */
router.patch(
  '/visits/:visitId',
  auth as any,
  checkPharmacyAccess as any,
  requirePatientPermission('update') as any,
  validateRequest(visitParamsSchema.pick({ visitId: true }), 'params') as any,
  validateRequest(updateVisitSchema, 'body') as any,
  updateVisit as any
);

/**
 * POST /api/visits/:visitId/attachments
 * Add attachment to visit (lab results, images, etc.)
 */
router.post(
  '/visits/:visitId/attachments',
  auth as any,
  checkPharmacyAccess as any,
  requirePatientPermission('create') as any,
  validateRequest(visitParamsSchema.pick({ visitId: true }), 'params') as any,
  validateRequest(attachmentSchema, 'body') as any,
  addVisitAttachment as any
);

export default router;
