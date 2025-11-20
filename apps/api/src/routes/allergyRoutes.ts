import express from 'express';
import {
  createAllergy,
  getAllergies,
  getAllergy,
  updateAllergy,
  deleteAllergy,
  getCriticalAllergies,
  searchAllergies,
} from '../controllers/allergyController';
import { auth } from '../middlewares/auth';
import {
  requirePatientRead,
  requirePatientCreate,
  requirePatientUpdate,
  requirePatientDelete,
  checkPharmacyAccess,
} from '../middlewares/patientRBAC';
import {
  validateRequest,
  createAllergySchema,
  updateAllergySchema,
  allergyParamsSchema,
  patientParamsSchema,
  paginationSchema,
} from '../validators/patientValidators';
import { patientManagementErrorHandler } from '../utils/responseHelpers';

const router = express.Router();

// Apply authentication and pharmacy access check to all routes
router.use(auth);
router.use(checkPharmacyAccess);

// ===============================
// ALLERGY ROUTES FOR PATIENTS
// ===============================

// POST /api/patients/:id/allergies - Add allergy to patient
router.post(
  '/:id/allergies',
  requirePatientCreate,
  validateRequest(patientParamsSchema, 'params'),
  validateRequest(createAllergySchema, 'body'),
  createAllergy
);

// GET /api/patients/:id/allergies - Get all allergies for patient
router.get(
  '/:id/allergies',
  requirePatientRead,
  validateRequest(patientParamsSchema, 'params'),
  validateRequest(paginationSchema, 'query'),
  getAllergies
);

// GET /api/patients/:id/allergies/critical - Get critical allergies
router.get(
  '/:id/allergies/critical',
  requirePatientRead,
  validateRequest(patientParamsSchema, 'params'),
  getCriticalAllergies
);

// ===============================
// INDIVIDUAL ALLERGY ROUTES
// ===============================

// GET /api/allergies/search - Search allergies by substance
router.get('/allergies/search', requirePatientRead, searchAllergies);

// GET /api/allergies/:allergyId - Get specific allergy
router.get(
  '/allergies/:allergyId',
  requirePatientRead,
  validateRequest(allergyParamsSchema, 'params'),
  getAllergy
);

// PATCH /api/allergies/:allergyId - Update allergy
router.patch(
  '/allergies/:allergyId',
  requirePatientUpdate,
  validateRequest(allergyParamsSchema, 'params'),
  validateRequest(updateAllergySchema, 'body'),
  updateAllergy
);

// DELETE /api/allergies/:allergyId - Delete allergy
router.delete(
  '/allergies/:allergyId',
  requirePatientDelete,
  validateRequest(allergyParamsSchema, 'params'),
  deleteAllergy
);

// Error handling middleware
router.use(patientManagementErrorHandler);

export default router;
