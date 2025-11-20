import express from 'express';
import { authWithWorkspace } from '../../../middlewares/authWithWorkspace';
import { requireRole, requirePermission, requireFeature } from '../../../middlewares/rbac';
import * as labIntegrationController from '../controllers/labIntegrationController';

const router = express.Router();

// All routes require authentication and workspace context
router.use(authWithWorkspace);

// All routes require lab_integration feature access
router.use(requireFeature('lab_integration'));

/**
 * @route   POST /api/lab-integration
 * @desc    Create a new lab integration case
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/',
    requirePermission('lab_integration:create'),
    labIntegrationController.createLabIntegration
);

/**
 * @route   GET /api/lab-integration/pending-reviews
 * @desc    Get all pending reviews for the workplace
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/pending-reviews',
    requirePermission('lab_integration:read'),
    labIntegrationController.getPendingReviews
);

/**
 * @route   GET /api/lab-integration/critical-cases
 * @desc    Get all critical cases for the workplace
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/critical-cases',
    requirePermission('lab_integration:read'),
    labIntegrationController.getCriticalCases
);

/**
 * @route   GET /api/lab-integration/escalation-required
 * @desc    Get all cases requiring physician escalation
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/escalation-required',
    requirePermission('lab_integration:read'),
    labIntegrationController.getCasesRequiringEscalation
);

/**
 * @route   GET /api/lab-integration/approved
 * @desc    Get all approved lab integration cases
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/approved',
    requirePermission('lab_integration:read'),
    labIntegrationController.getApprovedCases
);

/**
 * @route   GET /api/lab-integration/patient/:patientId
 * @desc    Get all lab integrations for a specific patient
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/patient/:patientId',
    requirePermission('lab_integration:read'),
    labIntegrationController.getLabIntegrationsByPatient
);

/**
 * @route   GET /api/lab-integration/patient/:patientId/trends/:testCode
 * @desc    Get lab value trends for a patient
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/patient/:patientId/trends/:testCode',
    requirePermission('lab_integration:read'),
    labIntegrationController.getLabTrends
);

/**
 * @route   GET /api/lab-integration/:id
 * @desc    Get a specific lab integration case by ID
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/:id',
    requirePermission('lab_integration:read'),
    labIntegrationController.getLabIntegrationById
);

/**
 * @route   POST /api/lab-integration/:id/request-interpretation
 * @desc    Request AI interpretation for a lab integration case
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/:id/request-interpretation',
    requirePermission('lab_integration:create'),
    labIntegrationController.requestAIInterpretation
);

/**
 * @route   POST /api/lab-integration/:id/approve
 * @desc    Approve or review therapy recommendations
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/:id/approve',
    requirePermission('lab_integration:approve'),
    labIntegrationController.approveRecommendations
);

/**
 * @route   POST /api/lab-integration/:id/implement
 * @desc    Implement medication adjustments
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/:id/implement',
    requirePermission('lab_integration:approve'),
    labIntegrationController.implementAdjustments
);

/**
 * @route   POST /api/lab-integration/:id/escalate
 * @desc    Escalate case to physician
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/:id/escalate',
    requirePermission('lab_integration:escalate'),
    labIntegrationController.escalateToPhysician
);

/**
 * @route   PUT /api/lab-integration/:id/patient-interpretation
 * @desc    Update patient-friendly interpretation for a lab integration case
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.put(
    '/:id/patient-interpretation',
    requirePermission('lab_integration:update'),
    labIntegrationController.updatePatientInterpretation
);

/**
 * @route   GET /api/lab-integration/:id/patient-interpretation
 * @desc    Get patient-friendly interpretation for a lab integration case
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/:id/patient-interpretation',
    requirePermission('lab_integration:read'),
    labIntegrationController.getPatientInterpretation
);

export default router;

