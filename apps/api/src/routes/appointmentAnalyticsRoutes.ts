import express from 'express';
import {
  getAppointmentAnalytics,
  getFollowUpAnalytics,
  getReminderAnalytics,
  getCapacityAnalytics,
  exportAppointmentAnalytics
} from '../controllers/appointmentAnalyticsController';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import rbac from '../middlewares/rbac';
import { appointmentAnalyticsValidators } from '../validators/appointmentAnalyticsValidators';
import { validateRequest } from '../middlewares/validation';
import rateLimiting from '../middlewares/rateLimiting';

const router = express.Router();

// Apply authentication with workspace context to all routes
router.use(authWithWorkspace);

// Apply rate limiting
router.use(rateLimiting.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many analytics requests, please try again later'
}));

/**
 * @route GET /api/appointments/analytics
 * @desc Get comprehensive appointment analytics
 * @access Private (requires view_appointment_analytics permission)
 */
router.get(
  '/appointments/analytics',
  appointmentAnalyticsValidators.getAppointmentAnalytics,
  rbac.requirePermission('view_appointment_analytics'),
  validateRequest,
  getAppointmentAnalytics
);

/**
 * @route GET /api/follow-ups/analytics
 * @desc Get follow-up task analytics
 * @access Private (requires view_followup_analytics permission)
 */
router.get(
  '/follow-ups/analytics',
  appointmentAnalyticsValidators.getFollowUpAnalytics,
  rbac.requirePermission('view_followup_analytics'),
  validateRequest,
  getFollowUpAnalytics
);

/**
 * @route GET /api/reminders/analytics
 * @desc Get reminder effectiveness analytics
 * @access Private (requires view_reminder_analytics permission)
 */
router.get(
  '/reminders/analytics',
  appointmentAnalyticsValidators.getReminderAnalytics,
  rbac.requirePermission('view_reminder_analytics'),
  validateRequest,
  getReminderAnalytics
);

/**
 * @route GET /api/schedules/capacity
 * @desc Get capacity utilization analytics
 * @access Private (requires view_capacity_analytics permission)
 */
router.get(
  '/schedules/capacity',
  appointmentAnalyticsValidators.getCapacityAnalytics,
  rbac.requirePermission('view_capacity_analytics'),
  validateRequest,
  getCapacityAnalytics
);

/**
 * @route POST /api/appointments/analytics/export
 * @desc Export appointment analytics to PDF/Excel
 * @access Private (requires export_analytics permission)
 */
router.post(
  '/appointments/analytics/export',
  appointmentAnalyticsValidators.exportAnalytics,
  rbac.requirePermission('export_analytics'),
  validateRequest,
  rateLimiting.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit exports to 10 per hour
    message: 'Too many export requests, please try again later'
  }),
  exportAppointmentAnalytics
);

export default router;