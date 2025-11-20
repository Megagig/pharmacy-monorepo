import express from 'express';
import {
  confirmAppointmentPublic,
  getAppointmentDetailsPublic,
} from '../controllers/publicAppointmentController';
import { generalRateLimiters, createRateLimiter } from '../middlewares/rateLimiting';
import {
  validateRequest,
  confirmAppointmentPublicSchema,
  appointmentParamsSchema,
} from '../validators/publicAppointmentValidators';

const router = express.Router();

// ===============================
// RATE LIMITING FOR PUBLIC APPOINTMENT ENDPOINTS
// ===============================

// Public confirmation rate limiting (prevent spam confirmations)
const confirmationRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 confirmation attempts per IP per 15 minutes
  message: 'Too many confirmation attempts. Please try again later.',
  bypassSuperAdmin: false, // Don't bypass for public endpoints
});

// General public rate limiting
const publicRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP per 15 minutes
  message: 'Too many requests from this IP. Please try again later.',
  bypassSuperAdmin: false,
});

// ===============================
// PUBLIC APPOINTMENT ENDPOINTS (NO AUTH REQUIRED)
// ===============================

/**
 * POST /api/public/appointments/:id/confirm
 * Confirm an appointment using a secure token
 * Public endpoint - no authentication required
 * Used for one-click confirmation from email/SMS links
 */
router.post(
  '/:id/confirm',
  confirmationRateLimit,
  validateRequest(appointmentParamsSchema, 'params'),
  validateRequest(confirmAppointmentPublicSchema, 'body'),
  confirmAppointmentPublic
);

/**
 * GET /api/public/appointments/:id
 * Get appointment details for confirmation page
 * Public endpoint - requires valid token in query params
 * Used to display appointment details before confirmation
 */
router.get(
  '/:id',
  publicRateLimit,
  validateRequest(appointmentParamsSchema, 'params'),
  getAppointmentDetailsPublic
);

export default router;