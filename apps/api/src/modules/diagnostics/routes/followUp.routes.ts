import express from 'express';
import { auth } from '../../../middlewares/auth';
import rbac from '../../../middlewares/rbac';
import {
    createFollowUp,
    getPatientFollowUps,
    getFollowUpById,
    completeFollowUp,
    rescheduleFollowUp,
    getOverdueFollowUps,
    getFollowUpAnalytics,
    getMyFollowUps,
    updateFollowUpStatus
} from '../controllers/followUpController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * @route   POST /api/diagnostics/follow-ups
 * @desc    Create a new diagnostic follow-up
 * @access  Private (Pharmacist, Admin)
 */
router.post(
    '/',
    rbac.requireRole('pharmacist', 'admin'),
    createFollowUp
);

/**
 * @route   GET /api/diagnostics/follow-ups/my
 * @desc    Get follow-ups assigned to current user
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/my',
    rbac.requireRole('pharmacist', 'admin'),
    getMyFollowUps
);

/**
 * @route   GET /api/diagnostics/follow-ups/overdue
 * @desc    Get overdue follow-ups
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/overdue',
    rbac.requireRole('pharmacist', 'admin'),
    getOverdueFollowUps
);

/**
 * @route   GET /api/diagnostics/follow-ups/analytics
 * @desc    Get follow-up analytics
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/analytics',
    rbac.requireRole('pharmacist', 'admin'),
    getFollowUpAnalytics
);

/**
 * @route   GET /api/diagnostics/follow-ups/patient/:patientId
 * @desc    Get follow-ups for a specific patient
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/patient/:patientId',
    rbac.requireRole('pharmacist', 'admin'),
    getPatientFollowUps
);

/**
 * @route   GET /api/diagnostics/follow-ups/:followUpId
 * @desc    Get follow-up by ID
 * @access  Private (Pharmacist, Admin)
 */
router.get(
    '/:followUpId',
    rbac.requireRole('pharmacist', 'admin'),
    getFollowUpById
);

/**
 * @route   PUT /api/diagnostics/follow-ups/:followUpId/complete
 * @desc    Complete a follow-up with outcome
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/:followUpId/complete',
    rbac.requireRole('pharmacist', 'admin'),
    completeFollowUp
);

/**
 * @route   PUT /api/diagnostics/follow-ups/:followUpId/reschedule
 * @desc    Reschedule a follow-up
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/:followUpId/reschedule',
    rbac.requireRole('pharmacist', 'admin'),
    rescheduleFollowUp
);

/**
 * @route   PUT /api/diagnostics/follow-ups/:followUpId/status
 * @desc    Update follow-up status
 * @access  Private (Pharmacist, Admin)
 */
router.put(
    '/:followUpId/status',
    rbac.requireRole('pharmacist', 'admin'),
    updateFollowUpStatus
);

export default router;