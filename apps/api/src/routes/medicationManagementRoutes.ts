import express from 'express';
import {
  createMedication,
  getMedicationsByPatient,
  getMedicationById,
  updateMedication,
  archiveMedication,
  logAdherence,
  getAdherenceLogs,
  checkInteractions,
  getMedicationDashboardStats,
  getMedicationAdherenceTrends,
  getRecentPatientsWithMedications,
  getPatientMedicationSettings,
  updatePatientMedicationSettings,
  sendTestNotification,
} from '../controllers/medicationManagementController';
import {
  createMedicationSchema,
  updateMedicationSchema,
  getMedicationsByPatientSchema,
  createAdherenceLogSchema,
  getAdherenceByPatientSchema,
  checkInteractionsSchema,
  updateMedicationSettingsSchema,
  getMedicationSettingsSchema,
} from '../validators/medicationValidators';
import { auth } from '../middlewares/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Middleware for validation
const validate = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

// Medication Management Routes
// POST /api/medication-management - Create a new medication
router.post('/', createMedicationSchema, validate, createMedication);

// GET /api/medication-management/patient/:patientId - Get all medications for a patient
router.get('/patient/:patientId', getMedicationsByPatient);

// GET /api/medication-management/:id - Get a specific medication
router.get('/:id', getMedicationById);

// PUT /api/medication-management/:id - Update a medication
router.put('/:id', updateMedicationSchema, validate, updateMedication);

// PATCH /api/medication-management/:id/archive - Archive a medication
router.patch(
  '/:id/archive',
  [body('reason').optional().isString().trim()],
  validate,
  archiveMedication
);

// Adherence Log Routes
// POST /api/medication-management/adherence - Log adherence/refill
router.post('/adherence', createAdherenceLogSchema, validate, logAdherence);

// GET /api/medication-management/adherence/patient/:patientId - Get adherence history
router.get('/adherence/patient/:patientId', getAdherenceLogs);

// Drug Interaction Routes
// POST /api/medication-management/check-interactions - Check medication interactions
router.post(
  '/check-interactions',
  checkInteractionsSchema,
  validate,
  checkInteractions
);

// Dashboard Routes
// GET /api/medication-management/dashboard/stats - Get medication dashboard statistics
router.get('/dashboard/stats', getMedicationDashboardStats);

// GET /api/medication-management/dashboard/adherence-trends - Get medication adherence trends for chart
router.get('/dashboard/adherence-trends', getMedicationAdherenceTrends);

// GET /api/medication-management/dashboard/recent-patients - Get recent patients with medications
router.get('/dashboard/recent-patients', getRecentPatientsWithMedications);

// Settings Routes
// GET /api/medication-management/settings/:patientId - Get patient medication settings
router.get('/settings/:patientId', getMedicationSettingsSchema, validate, getPatientMedicationSettings);

// PUT /api/medication-management/settings/:patientId - Update patient medication settings
router.put('/settings/:patientId', updateMedicationSettingsSchema, validate, updatePatientMedicationSettings);

// POST /api/medication-management/settings/:patientId/test-notification - Send test notification (deprecated)
router.post('/settings/:patientId/test-notification', sendTestNotification);

export default router;
