import express from 'express';
import {
  registerPatient,
  loginPatient,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  updateProfile,
  linkPatient,
  // resendVerification, // TODO: Fix type issues
  checkEmail,
  // getSessions, // TODO: Fix type issues
  // revokeSession, // TODO: Fix type issues
} from '../controllers/patientAuthController';
import {
  patientPortalAuth as patientAuth,
  validateWorkspaceContext,
  logPatientActivity,
} from '../middlewares/patientPortalAuth';
import { createRateLimiter } from '../middlewares/rateLimiting';
import {
  validateRequest,
  registerPatientSchema,
  loginPatientSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  linkPatientSchema,
  checkEmailSchema,
} from '../validators/patientAuthValidators';

const router = express.Router();

// ===============================
// RATE LIMITING FOR PATIENT AUTH
// ===============================

// Authentication rate limiting (more restrictive)
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
  bypassSuperAdmin: false,
});

// Registration rate limiting
const registerRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registration attempts per IP per hour
  message: 'Too many registration attempts. Please try again later.',
  bypassSuperAdmin: false,
});

// Password reset rate limiting
const passwordResetRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per IP per hour
  message: 'Too many password reset attempts. Please try again later.',
  bypassSuperAdmin: false,
});

// General API rate limiting
const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per 15 minutes
  message: 'Too many requests. Please try again later.',
  bypassSuperAdmin: false,
});

// ===============================
// PUBLIC ENDPOINTS (NO AUTH REQUIRED)
// ===============================

/**
 * POST /api/patient-auth/register
 * Register a new patient user
 */
router.post(
  '/register',
  registerRateLimit,
  validateRequest(registerPatientSchema, 'body'),
  registerPatient
);

/**
 * POST /api/patient-auth/login
 * Login patient user
 */
router.post(
  '/login',
  authRateLimit,
  validateRequest(loginPatientSchema, 'body'),
  loginPatient
);

/**
 * POST /api/patient-auth/verify-email
 * Verify email address using token
 */
router.post(
  '/verify-email',
  apiRateLimit,
  validateRequest(verifyEmailSchema, 'body'),
  verifyEmail
);

/**
 * POST /api/patient-auth/forgot-password
 * Send password reset email
 */
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  validateRequest(forgotPasswordSchema, 'body'),
  forgotPassword
);

/**
 * POST /api/patient-auth/reset-password
 * Reset password using token
 */
router.post(
  '/reset-password',
  passwordResetRateLimit,
  validateRequest(resetPasswordSchema, 'body'),
  resetPassword
);

/**
 * POST /api/patient-auth/refresh-token
 * Refresh access token using refresh token
 */
router.post(
  '/refresh-token',
  apiRateLimit,
  refreshToken
);

/**
 * GET /api/patient-auth/check-email
 * Check if email exists for a workplace (public endpoint for registration flow)
 */
router.get(
  '/check-email',
  apiRateLimit,
  validateRequest(checkEmailSchema, 'query'),
  checkEmail
);

// ===============================
// AUTHENTICATED ENDPOINTS
// ===============================

/**
 * POST /api/patient-auth/logout
 * Logout patient user
 */
router.post(
  '/logout',
  logout
);

/**
 * POST /api/patient-auth/logout-all
 * Logout from all devices
 * Requires authentication
 */
router.post(
  '/logout-all',
  patientAuth,
  logoutAll
);

/**
 * GET /api/patient-auth/me
 * Get current patient user profile
 * Requires authentication
 */
router.get(
  '/me',
  patientAuth,
  getMe
);

/**
 * PUT /api/patient-auth/profile
 * Update patient user profile
 * Requires authentication
 */
router.put(
  '/profile',
  patientAuth,
  validateRequest(updateProfileSchema, 'body'),
  updateProfile
);

/**
 * POST /api/patient-auth/link-patient
 * Link patient user to patient record
 * Requires authentication
 */
router.post(
  '/link-patient',
  patientAuth,
  validateRequest(linkPatientSchema, 'body'),
  linkPatient
);

// TODO: Fix type issues with these endpoints
/**
 * POST /api/patient-auth/resend-verification
 * Resend email verification
 * Requires authentication
 */
// router.post(
//   '/resend-verification',
//   patientAuth,
//   apiRateLimit,
//   resendVerification
// );

/**
 * GET /api/patient-auth/sessions
 * Get active sessions for patient user
 * Requires authentication
 */
// router.get(
//   '/sessions',
//   patientAuth,
//   getSessions
// );

/**
 * DELETE /api/patient-auth/sessions/:sessionId
 * Revoke a specific session
 * Requires authentication
 */
// router.delete(
//   '/sessions/:sessionId',
//   patientAuth,
//   revokeSession
// );

export default router;