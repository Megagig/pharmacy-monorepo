import express from 'express';
import { auth } from '../middlewares/auth';
import { param } from 'express-validator';
import {
    getAppointmentHealthRecords,
    getAppointmentHealthRecordsSummary,
} from '../controllers/appointmentHealthRecordsController';
import { rateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

/**
 * @route GET /api/appointments/:appointmentId/health-records
 * @desc Get all health records for a specific appointment
 * @access Private (Pharmacist, Admin)
 */
router.get(
    '/:appointmentId/health-records',
    auth,
    rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }), // 100 requests per 15 minutes
    [param('appointmentId').isMongoId().withMessage('Invalid appointment ID')],
    getAppointmentHealthRecords
);

/**
 * @route GET /api/appointments/:appointmentId/health-records/summary
 * @desc Get health records summary for an appointment (lightweight)
 * @access Private (Pharmacist, Admin)
 */
router.get(
    '/:appointmentId/health-records/summary',
    auth,
    rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }),
    [param('appointmentId').isMongoId().withMessage('Invalid appointment ID')],
    getAppointmentHealthRecordsSummary
);

export default router;
