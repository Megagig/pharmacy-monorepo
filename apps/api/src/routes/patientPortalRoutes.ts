import express from 'express';
import {
  getAppointmentTypes,
  getAvailableSlots,
  bookAppointment,
  getMyAppointments,
  rescheduleAppointment,
  cancelAppointment,
  confirmAppointment,
  getDashboardData,
} from '../controllers/patientPortalController';
import { patientPortalAuth } from '../middlewares/patientPortalAuth';
import { generalRateLimiters, createRateLimiter } from '../middlewares/rateLimiting';
import {
  validateRequest,
  bookAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  confirmAppointmentSchema,
  appointmentParamsSchema,
  availableSlotsQuerySchema,
  myAppointmentsQuerySchema,
} from '../validators/patientPortalValidators';
import patientPortalProfileRoutes from './patientPortalProfileRoutes';
import patientMedicationRoutes from './patientMedication.routes';
import patientHealthRecordsRoutes from './patientHealthRecords.routes';
import patientMessagingRoutes from './patientMessaging.routes';
import patientBillingRoutes from './patientBilling.routes';

const router = express.Router();

// ===============================
// RATE LIMITING FOR PATIENT PORTAL
// ===============================

// Public endpoints rate limiting (more restrictive)
const publicRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per 15 minutes
  message: 'Too many requests from this IP. Please try again later.',
  bypassSuperAdmin: false, // Don't bypass for public endpoints
});

// Booking rate limiting (prevent spam bookings)
const bookingRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 booking attempts per IP per hour
  message: 'Too many booking attempts. Please try again later.',
  bypassSuperAdmin: false,
});

// Appointment modification rate limiting
const modificationRateLimit = createRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 20, // 20 modifications per IP per 30 minutes
  message: 'Too many appointment modifications. Please try again later.',
  bypassSuperAdmin: false,
});

// ===============================
// PUBLIC ENDPOINTS (NO AUTH REQUIRED)
// ===============================

/**
 * GET /api/patient-portal/appointment-types
 * Get available appointment types for booking
 * Public endpoint - no authentication required
 */
router.get(
  '/appointment-types',
  publicRateLimit,
  getAppointmentTypes
);

/**
 * GET /api/patient-portal/available-slots
 * Get available appointment slots
 * Public endpoint - no authentication required
 */
router.get(
  '/available-slots',
  publicRateLimit,
  validateRequest(availableSlotsQuerySchema, 'query'),
  getAvailableSlots
);

// ===============================
// AUTHENTICATED ENDPOINTS
// ===============================

/**
 * GET /api/patient-portal/dashboard
 * Get comprehensive dashboard data (stats, appointments, medications, messages, vitals)
 * Requires authentication
 */
router.get(
  '/dashboard',
  patientPortalAuth,
  generalRateLimiters.api,
  getDashboardData
);

/**
 * POST /api/patient-portal/appointments
 * Book a new appointment
 * Requires authentication
 */
router.post(
  '/appointments',
  patientPortalAuth,
  bookingRateLimit,
  validateRequest(bookAppointmentSchema, 'body'),
  bookAppointment
);

/**
 * GET /api/patient-portal/appointments
 * Get my appointments (patient's own appointments)
 * Requires authentication
 */
router.get(
  '/appointments',
  patientPortalAuth,
  generalRateLimiters.api,
  validateRequest(myAppointmentsQuerySchema, 'query'),
  getMyAppointments
);

/**
 * POST /api/patient-portal/appointments/:id/reschedule
 * Reschedule an appointment
 * Requires authentication
 */
router.post(
  '/appointments/:id/reschedule',
  patientPortalAuth,
  modificationRateLimit,
  validateRequest(appointmentParamsSchema, 'params'),
  validateRequest(rescheduleAppointmentSchema, 'body'),
  rescheduleAppointment
);

/**
 * POST /api/patient-portal/appointments/:id/cancel
 * Cancel an appointment
 * Requires authentication
 */
router.post(
  '/appointments/:id/cancel',
  patientPortalAuth,
  modificationRateLimit,
  validateRequest(appointmentParamsSchema, 'params'),
  validateRequest(cancelAppointmentSchema, 'body'),
  cancelAppointment
);

/**
 * POST /api/patient-portal/appointments/:id/confirm
 * Confirm an appointment (can be used with or without auth)
 * Supports both authenticated users and confirmation tokens
 */
router.post(
  '/appointments/:id/confirm',
  // Use optional auth middleware - allows both authenticated and token-based confirmation
  // patientAuthOptional, // TODO: Implement optional auth middleware
  modificationRateLimit,
  validateRequest(appointmentParamsSchema, 'params'),
  validateRequest(confirmAppointmentSchema, 'body'),
  confirmAppointment
);

// ===============================
// PROFILE MANAGEMENT ENDPOINTS
// ===============================

/**
 * Mount patient profile management routes
 * All routes under /api/patient-portal/profile/*
 */
router.use('/profile', patientPortalProfileRoutes);

// ===============================
// MEDICATION MANAGEMENT ENDPOINTS
// ===============================

/**
 * Mount patient medication management routes
 * All routes under /api/patient-portal/medications/*
 */
router.use('/medications', patientPortalAuth, patientMedicationRoutes);

// ===============================
// HEALTH RECORDS ENDPOINTS
// ===============================

/**
 * Mount patient health records routes
 * All routes under /api/patient-portal/health-records/*
 */
router.use('/health-records', patientPortalAuth, patientHealthRecordsRoutes);

// ===============================
// MESSAGING ENDPOINTS
// ===============================

/**
 * Mount patient messaging routes
 * All routes under /api/patient-portal/messages/*
 */
router.use('/messages', patientPortalAuth, patientMessagingRoutes);

// ===============================
// BILLING ENDPOINTS
// ===============================

/**
 * Mount patient billing routes
 * All routes under /api/patient-portal/billing/*
 */
router.use('/billing', patientPortalAuth, patientBillingRoutes);

export default router;