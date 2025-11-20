import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middlewares/validation';
import { auth } from '../middlewares/auth';
import { authorize } from '../middlewares/auth';
import rateLimit from 'express-rate-limit';
import {
    getPendingVitals,
    verifyVitals,
    unverifyVitals,
    getPatientVitalsHistory,
    bulkVerifyVitals,
} from '../controllers/pharmacistVitalsController';

const router = express.Router();

// Rate limiting
const vitalsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many requests from this IP, please try again later',
});

router.use(vitalsLimiter);

/**
 * @route   GET /api/pharmacist/vitals/pending-verification
 * @desc    Get all unverified vitals in the workplace
 * @access  Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.get(
    '/pending-verification',
    auth,
    authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        validateRequest,
    ],
    getPendingVitals
);

/**
 * @route   PUT /api/pharmacist/vitals/:patientId/:vitalsId/verify
 * @desc    Verify patient vitals
 * @access  Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.put(
    '/:patientId/:vitalsId/verify',
    auth,
    authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    [
        param('patientId').isMongoId().withMessage('Invalid patient ID'),
        // patient vitals entries may not be ObjectIds; accept string
        param('vitalsId').isString().withMessage('Invalid vitals ID'),
        validateRequest,
    ],
    verifyVitals
);

/**
 * @route   PUT /api/pharmacist/vitals/:patientId/:vitalsId/unverify
 * @desc    Unverify patient vitals (for corrections)
 * @access  Private (Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.put(
    '/:patientId/:vitalsId/unverify',
    auth,
    authorize('pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    [
        param('patientId').isMongoId().withMessage('Invalid patient ID'),
        // patient vitals entries may not be ObjectIds; accept string
        param('vitalsId').isString().withMessage('Invalid vitals ID'),
        validateRequest,
    ],
    unverifyVitals
);

/**
 * @route   GET /api/pharmacist/vitals/:patientId/history
 * @desc    Get patient vitals history with verification status
 * @access  Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.get(
    '/:patientId/history',
    auth,
    authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    [
        param('patientId').isMongoId().withMessage('Invalid patient ID'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('verified')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('verified must be "true" or "false"'),
        validateRequest,
    ],
    getPatientVitalsHistory
);

/**
 * @route   POST /api/pharmacist/vitals/bulk-verify
 * @desc    Bulk verify multiple vitals entries
 * @access  Private (Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin)
 */
router.post(
    '/bulk-verify',
    auth,
    authorize('pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'),
    [
        body('vitalsEntries')
            .isArray({ min: 1, max: 50 })
            .withMessage('vitalsEntries must be an array with 1-50 items'),
        body('vitalsEntries.*.patientId').isMongoId().withMessage('Invalid patient ID in entry'),
        body('vitalsEntries.*.vitalsId').isMongoId().withMessage('Invalid vitals ID in entry'),
        validateRequest,
    ],
    bulkVerifyVitals
);

export default router;
