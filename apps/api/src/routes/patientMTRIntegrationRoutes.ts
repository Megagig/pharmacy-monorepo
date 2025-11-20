import { Router } from 'express';
import { patientMTRIntegrationController } from '../controllers/patientMTRIntegrationController';

// Simple middleware placeholders
const authenticate = (req: any, res: any, next: any) => next();
const validateWorkplace = (req: any, res: any, next: any) => next();
const auditMiddleware = (action: string) => (req: any, res: any, next: any) => next();

const router = Router();

// Apply authentication and workplace validation to all routes
router.use(authenticate);
router.use(validateWorkplace);

// ===============================
// PATIENT MTR SUMMARY ROUTES
// ===============================

/**
 * @route GET /api/patients/:patientId/mtr/summary
 * @desc Get MTR summary for a patient
 * @access Private
 */
router.get(
    '/:patientId/mtr/summary',
    auditMiddleware('patient_mtr_summary_view'),
    patientMTRIntegrationController.getPatientMTRSummary
);

/**
 * @route GET /api/patients/:patientId/mtr/data
 * @desc Get comprehensive patient data for MTR
 * @access Private
 */
router.get(
    '/:patientId/mtr/data',
    auditMiddleware('patient_mtr_data_view'),
    patientMTRIntegrationController.getPatientDataForMTR
);

/**
 * @route GET /api/patients/:patientId/dashboard/mtr
 * @desc Get MTR dashboard data for patient
 * @access Private
 */
router.get(
    '/:patientId/dashboard/mtr',
    auditMiddleware('patient_dashboard_mtr_view'),
    patientMTRIntegrationController.getPatientDashboardMTRData
);

/**
 * @route POST /api/patients/:patientId/mtr/:mtrId/sync-medications
 * @desc Sync medications between patient records and MTR
 * @access Private
 */
router.post(
    '/:patientId/mtr/:mtrId/sync-medications',
    auditMiddleware('patient_mtr_medications_sync'),
    patientMTRIntegrationController.syncMedicationsWithMTR
);

/**
 * @route GET /api/patients/search/with-mtr
 * @desc Search patients with MTR filters
 * @access Private
 */
router.get(
    '/search/with-mtr',
    auditMiddleware('patients_search_with_mtr'),
    patientMTRIntegrationController.searchPatientsWithMTR
);

export default router;