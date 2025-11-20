import express from 'express';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import { validateReportGeneration, validateEmailReport, validateScheduleReport } from '../validators/reportValidators';
import {
  generateAppointmentReport,
  generateFollowUpReport,
  generateReminderReport,
  generateCapacityReport,
  emailReport,
  scheduleRecurringReport,
  testEmailConfiguration
} from '../controllers/reportController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * @route   POST /api/reports/appointments/generate
 * @desc    Generate appointment report (PDF/Excel/CSV)
 * @access  Private (requires reports:read permission)
 */
router.post(
  '/appointments/generate',
  rbac.requirePermission('reports:read'),
  validateReportGeneration,
  generateAppointmentReport
);

/**
 * @route   POST /api/reports/follow-ups/generate
 * @desc    Generate follow-up tasks report (PDF/Excel/CSV)
 * @access  Private (requires reports:read permission)
 */
router.post(
  '/follow-ups/generate',
  rbac.requirePermission('reports:read'),
  validateReportGeneration,
  generateFollowUpReport
);

/**
 * @route   POST /api/reports/reminders/generate
 * @desc    Generate reminder effectiveness report (PDF/Excel/CSV)
 * @access  Private (requires reports:read permission)
 */
router.post(
  '/reminders/generate',
  rbac.requirePermission('reports:read'),
  validateReportGeneration,
  generateReminderReport
);

/**
 * @route   POST /api/reports/capacity/generate
 * @desc    Generate capacity utilization report (PDF/Excel/CSV)
 * @access  Private (requires reports:read permission)
 */
router.post(
  '/capacity/generate',
  rbac.requirePermission('reports:read'),
  validateReportGeneration,
  generateCapacityReport
);

/**
 * @route   POST /api/reports/email
 * @desc    Send report via email
 * @access  Private (requires reports:email permission)
 */
router.post(
  '/email',
  rbac.requirePermission('reports:email'),
  validateEmailReport,
  emailReport
);

/**
 * @route   POST /api/reports/schedule
 * @desc    Schedule recurring report
 * @access  Private (requires reports:schedule permission)
 */
router.post(
  '/schedule',
  rbac.requirePermission('reports:schedule'),
  validateScheduleReport,
  scheduleRecurringReport
);

/**
 * @route   POST /api/reports/test-email
 * @desc    Test email configuration
 * @access  Private (requires reports:email permission)
 */
router.post(
  '/test-email',
  rbac.requirePermission('reports:email'),
  testEmailConfiguration
);

export default router;