import { Router } from 'express';
import {
    createClinicalNoteFromDiagnostic,
    addDiagnosticDataToMTR,
    createMTRFromDiagnostic,
    getUnifiedPatientTimeline,
    crossReferenceWithExistingRecords,
    getIntegrationOptions,
} from '../controllers/integrationController';
import { auth } from '../../../middlewares/auth';
import rbac from '../../../middlewares/rbac';

const router = Router();

// All integration routes require authentication
router.use(auth);

/**
 * @route POST /api/diagnostics/integration/clinical-note
 * @desc Create clinical note from diagnostic results
 * @access Private (Pharmacist+)
 */
router.post(
    '/clinical-note',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    createClinicalNoteFromDiagnostic
);

/**
 * @route POST /api/diagnostics/integration/mtr/:mtrId/enrich
 * @desc Add diagnostic data to existing MTR
 * @access Private (Pharmacist+)
 */
router.post(
    '/mtr/:mtrId/enrich',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    addDiagnosticDataToMTR
);

/**
 * @route POST /api/diagnostics/integration/mtr
 * @desc Create new MTR from diagnostic results
 * @access Private (Pharmacist+)
 */
router.post(
    '/mtr',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    createMTRFromDiagnostic
);

/**
 * @route GET /api/diagnostics/integration/timeline/:patientId
 * @desc Get unified patient timeline with diagnostic events
 * @access Private (Pharmacist+)
 */
router.get(
    '/timeline/:patientId',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    getUnifiedPatientTimeline
);

/**
 * @route GET /api/diagnostics/integration/cross-reference/:diagnosticRequestId
 * @desc Cross-reference diagnostic data with existing clinical records
 * @access Private (Pharmacist+)
 */
router.get(
    '/cross-reference/:diagnosticRequestId',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    crossReferenceWithExistingRecords
);

/**
 * @route GET /api/diagnostics/integration/options/:diagnosticRequestId
 * @desc Get integration options for a diagnostic result
 * @access Private (Pharmacist+)
 */
router.get(
    '/options/:diagnosticRequestId',
    rbac.requireRole('pharmacist', 'admin', 'super_admin'),
    getIntegrationOptions
);

export default router;