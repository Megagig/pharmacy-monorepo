import express from 'express';
import { auth } from '../../../middlewares/auth';
import rbac from '../../../middlewares/rbac';
import {
    createAdherenceTracking,
    getPatientAdherenceTracking,
    addRefill,
    updateMedicationAdherence,
    assessPatientAdherence,
    addIntervention,
    generateAdherenceReport,
    getPatientsWithPoorAdherence,
    acknowledgeAlert,
    resolveAlert
} from '../controllers/adherenceController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * @route   POST /api/diagnostics/adherence
 * @desc    Create adherence tracking for a patient
 * @access  Private (Pharmacist, Admin)
 */
router.post(
    '/',
    rbac.requireRole('pharmacist', 'admin'),
    createAdherenceTracking
);

/**
 * @route   GET /api/diagnostics/adherence/poor-adherence
 * @desc    Get patients with poor adherence
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/poor-adherence',
    rbac.requireRole('pharmacist', 'admin'),
    getPatientsWithPoorAdherence
);

/**
 * @route   GET /api/diagnostics/adherence/patient/:patientId
 * @desc    Get adherence tracking for a specific patient
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/patient/:patientId',
    rbac.requireRole('pharmacist', 'admin'),
    getPatientAdherenceTracking
);

/**
 * @route   POST /api/diagnostics/adherence/patient/:patientId/refill
 * @desc    Add medication refill for a patient
 * @access  Private (Pharmacist, Admin)
 */
router.post(
    '/patient/:patientId/refill',
    rbac.requireRole('pharmacist', 'admin'),
    addRefill
);

/**
 * @route   PUT /api/diagnostics/adherence/patient/:patientId/medication/:medicationName
 * @desc    Update medication adherence for a patient
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/patient/:patientId/medication/:medicationName',
    rbac.requireRole('pharmacist', 'admin'),
    updateMedicationAdherence
);

/**
 * @route   GET /api/diagnostics/adherence/patient/:patientId/assessment
 * @desc    Assess patient adherence
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/patient/:patientId/assessment',
    rbac.requireRole('pharmacist', 'admin'),
    assessPatientAdherence
);

/**
 * @route   POST /api/diagnostics/adherence/patient/:patientId/intervention
 * @desc    Add adherence intervention for a patient
 * @access  Private (Pharmacist, Admin)
 */
router.post(
    '/patient/:patientId/intervention',
    rbac.requireRole('pharmacist', 'admin'),
    addIntervention
);

/**
 * @route   GET /api/diagnostics/adherence/patient/:patientId/report
 * @desc    Generate adherence report for a patient
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/patient/:patientId/report',
    rbac.requireRole('pharmacist', 'admin'),
    generateAdherenceReport
);

/**
 * @route   PUT /api/diagnostics/adherence/patient/:patientId/alert/:alertIndex/acknowledge
 * @desc    Acknowledge adherence alert
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/patient/:patientId/alert/:alertIndex/acknowledge',
    rbac.requireRole('pharmacist', 'admin'),
    acknowledgeAlert
);

/**
 * @route   PUT /api/diagnostics/adherence/patient/:patientId/alert/:alertIndex/resolve
 * @desc    Resolve adherence alert
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/patient/:patientId/alert/:alertIndex/resolve',
    rbac.requireRole('pharmacist', 'admin'),
    resolveAlert
);

export default router;