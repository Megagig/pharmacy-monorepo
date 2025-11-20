import express from 'express';
import {
  createMedication,
  getMedications,
  updateMedication,
  deleteMedication,
} from '../controllers/patientResourcesController';
import { auth } from '../middlewares/auth';
import {
  requirePatientPermission,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createMedicationSchema,
  updateMedicationSchema,
  medicationParamsSchema,
  medicationQuerySchema,
} from '../validators/patientValidators';

const router = express.Router();

/**
 * Patient Medication Routes
 * Base path: /api/patients/:id/medications
 * Individual medication path: /api/medications/:medId
 */

// ===============================
// PATIENT-SCOPED MEDICATION ROUTES
// ===============================

/**
 * POST /api/patients/:id/medications
 * Add new medication to patient
 */
router.post(
  '/:id/medications',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('create'),
  validateRequest(medicationParamsSchema.pick({ id: true }), 'params'),
  validateRequest(createMedicationSchema, 'body'),
  createMedication
);

/**
 * GET /api/patients/:id/medications
 * Get all medications for a patient with pagination and phase filtering
 * Query params: ?phase=current|past&page=1&limit=20
 */
router.get(
  '/:id/medications',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('read'),
  validateRequest(medicationParamsSchema.pick({ id: true }), 'params'),
  validateRequest(medicationQuerySchema, 'query'),
  getMedications
);

// ===============================
// INDIVIDUAL MEDICATION ROUTES
// ===============================

/**
 * PATCH /api/medications/:medId
 * Update medication information
 */
router.patch(
  '/medications/:medId',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('update'),
  validateRequest(medicationParamsSchema.pick({ medId: true }), 'params'),
  validateRequest(updateMedicationSchema, 'body'),
  updateMedication
);

/**
 * DELETE /api/medications/:medId
 * Delete medication (soft delete)
 */
router.delete(
  '/medications/:medId',
  auth,
  checkPharmacyAccess,
  requirePatientPermission('delete'),
  validateRequest(medicationParamsSchema.pick({ medId: true }), 'params'),
  deleteMedication
);

export default router;
