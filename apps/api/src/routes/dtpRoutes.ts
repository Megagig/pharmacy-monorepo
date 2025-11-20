import express from 'express';
import {
  createDTP,
  getDTPs,
  updateDTP,
} from '../controllers/patientResourcesController';
import { auth } from '../middlewares/auth';
import {
  requirePatientPermission,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createDTPSchema,
  updateDTPSchema,
  dtpParamsSchema,
  dtpQuerySchema,
} from '../validators/patientValidators';

const router = express.Router();

/**
 * Patient Drug Therapy Problem (DTP) Routes
 * Base path: /api/patients/:id/dtps
 * Individual DTP path: /api/dtps/:dtpId
 */

// ===============================
// PATIENT-SCOPED DTP ROUTES
// ===============================

/**
 * POST /api/patients/:id/dtps
 * Add new DTP to patient
 */
router.post(
  '/:id/dtps',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('create'),
  validateRequest(dtpParamsSchema.pick({ id: true }), 'params'),
  validateRequest(createDTPSchema, 'body'),
  createDTP
);

/**
 * GET /api/patients/:id/dtps
 * Get all DTPs for a patient with pagination and status filtering
 * Query params: ?status=unresolved|resolved&page=1&limit=20
 */
router.get(
  '/:id/dtps',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('read'),
  validateRequest(dtpParamsSchema.pick({ id: true }), 'params'),
  validateRequest(dtpQuerySchema, 'query'),
  getDTPs
);

// ===============================
// INDIVIDUAL DTP ROUTES
// ===============================

/**
 * PATCH /api/dtps/:dtpId
 * Update DTP information (typically to resolve DTPs)
 */
router.patch(
  '/dtps/:dtpId',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('update'),
  validateRequest(dtpParamsSchema.pick({ dtpId: true }), 'params'),
  validateRequest(updateDTPSchema, 'body'),
  updateDTP
);

export default router;
