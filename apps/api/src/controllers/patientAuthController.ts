import { Response } from 'express';
import mongoose from 'mongoose';
import { PatientPortalRequest } from '../middlewares/patientPortalAuth';
import PatientAuthService from '../services/PatientAuthService';
import PatientUser from '../models/PatientUser';
import {
  sendSuccess,
  sendError,
  asyncHandler,
} from '../utils/responseHelpers';
import logger from '../utils/logger';

/**
 * Patient Authentication Controller
 * Handles patient-specific authentication endpoints
 */

/**
 * POST /api/patient-auth/register
 * Register a new patient user
 */
export const registerPatient = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      workplaceId,
      language,
      timezone,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Missing required fields: firstName, lastName, email, password, and workplaceId are required', 400);
    }

    // Validate workplace ID
    if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid workplace ID', 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return sendError(res, 'BAD_REQUEST', 'Password must be at least 8 characters long', 400);
    }

    const result = await PatientAuthService.registerPatient({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      language,
      timezone,
    });

    // Set httpOnly cookies for tokens
    res.cookie('patientAccessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: result.tokens.expiresIn * 1000, // Convert to milliseconds
    });

    res.cookie('patientRefreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, {
      patientUser: result.patientUser,
      patient: result.patient,
      requiresEmailVerification: !result.patientUser.emailVerified,
    }, 'Patient user registered successfully. Please check your email for verification.', 201);
  }
);

/**
 * POST /api/patient-auth/login
 * Login patient user
 */
export const loginPatient = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const {
      email,
      phone,
      password,
      workplaceId,
    } = req.body;

    // Validate required fields
    if ((!email && !phone) || !password || !workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Email or phone, password, and workplaceId are required', 400);
    }

    // Validate workplace ID
    if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid workplace ID', 400);
    }

    const result = await PatientAuthService.loginPatient({
      email,
      phone,
      password,
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      deviceInfo: req.get('User-Agent'),
      ipAddress: req.ip,
    });

    // Set httpOnly cookies for tokens
    res.cookie('patientAccessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: result.tokens.expiresIn * 1000, // Convert to milliseconds
    });

    res.cookie('patientRefreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, {
      patientUser: result.patientUser,
      patient: result.patient,
      requiresEmailVerification: !result.patientUser.emailVerified,
    }, 'Login successful');
  }
);

/**
 * POST /api/patient-auth/verify-email
 * Verify email address using token
 */
export const verifyEmail = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const { token } = req.body;

    if (!token) {
      return sendError(res, 'BAD_REQUEST', 'Verification token is required', 400);
    }

    const patientUser = await PatientAuthService.verifyEmail(token);

    sendSuccess(res, {
      patientUser,
      message: 'Email verified successfully',
    }, 'Email verified successfully');
  }
);

/**
 * POST /api/patient-auth/forgot-password
 * Send password reset email
 */
export const forgotPassword = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const { email, workplaceId } = req.body;

    if (!email || !workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Email and workplaceId are required', 400);
    }

    // Validate workplace ID
    if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid workplace ID', 400);
    }

    await PatientAuthService.forgotPassword(
      email,
      new mongoose.Types.ObjectId(workplaceId)
    );

    sendSuccess(res, {}, 'If an account with that email exists, a password reset link has been sent');
  }
);

/**
 * POST /api/patient-auth/reset-password
 * Reset password using token
 */
export const resetPassword = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendError(res, 'BAD_REQUEST', 'Token and new password are required', 400);
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return sendError(res, 'BAD_REQUEST', 'Password must be at least 8 characters long', 400);
    }

    const patientUser = await PatientAuthService.resetPassword({
      token,
      newPassword,
    });

    sendSuccess(res, {
      patientUser,
    }, 'Password reset successfully');
  }
);

/**
 * POST /api/patient-auth/refresh-token
 * Refresh access token using refresh token
 */
export const refreshToken = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const refreshToken = req.cookies.patientRefreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return sendError(res, 'BAD_REQUEST', 'Refresh token is required', 400);
    }

    const tokens = await PatientAuthService.refreshAccessToken(refreshToken);

    // Set new httpOnly cookies
    res.cookie('patientAccessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: tokens.expiresIn * 1000, // Convert to milliseconds
    });

    res.cookie('patientRefreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, {
      expiresIn: tokens.expiresIn,
    }, 'Token refreshed successfully');
  }
);

/**
 * POST /api/patient-auth/logout
 * Logout patient user (invalidate current refresh token)
 */
export const logout = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const refreshToken = req.cookies.patientRefreshToken;

    if (req.patientUser && refreshToken) {
      await PatientAuthService.logout(req.patientUser._id, refreshToken);
    }

    // Clear cookies
    res.clearCookie('patientAccessToken');
    res.clearCookie('patientRefreshToken');

    sendSuccess(res, {}, 'Logged out successfully');
  }
);

/**
 * POST /api/patient-auth/logout-all
 * Logout from all devices (invalidate all refresh tokens)
 */
export const logoutAll = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    await PatientAuthService.logoutAll(req.patientUser._id);

    // Clear cookies
    res.clearCookie('patientAccessToken');
    res.clearCookie('patientRefreshToken');

    sendSuccess(res, {}, 'Logged out from all devices successfully');
  }
);

/**
 * GET /api/patient-auth/me
 * Get current patient user profile
 */
export const getMe = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    sendSuccess(res, {
      patientUser: req.patientUser,
      patient: req.patient,
    }, 'Profile retrieved successfully');
  }
);

/**
 * PUT /api/patient-auth/profile
 * Update patient user profile
 */
export const updateProfile = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      language,
      timezone,
      avatar,
      notificationPreferences,
    } = req.body;

    const updatedPatientUser = await PatientAuthService.updateProfile(
      req.patientUser._id,
      {
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        language,
        timezone,
        avatar,
        notificationPreferences,
      }
    );

    sendSuccess(res, {
      patientUser: updatedPatientUser,
    }, 'Profile updated successfully');
  }
);

/**
 * POST /api/patient-auth/link-patient
 * Link patient user to patient record
 */
export const linkPatient = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { patientId } = req.body;

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return sendError(res, 'BAD_REQUEST', 'Valid patient ID is required', 400);
    }

    const updatedPatientUser = await PatientAuthService.linkToPatient(
      req.patientUser._id,
      new mongoose.Types.ObjectId(patientId)
    );

    sendSuccess(res, {
      patientUser: updatedPatientUser,
    }, 'Patient record linked successfully');
  }
);

/**
 * POST /api/patient-auth/resend-verification
 * Resend email verification
 * TODO: Fix - requires full PatientUser document, not just the simplified object from middleware
 */
// export const resendVerification = asyncHandler(
//   async (req: PatientPortalRequest, res: Response) => {
//     if (!req.patientUser) {
//       return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
//     }

//     if (req.patientUser.emailVerified) {
//       return sendError(res, 'BAD_REQUEST', 'Email is already verified', 400);
//     }

//     // Generate new verification token
//     const verificationToken = req.patientUser.generateVerificationToken();
//     await req.patientUser.save();

//     // Send verification email (this would be handled by the service)
//     // For now, we'll just return success
//     sendSuccess(res, {}, 'Verification email sent successfully');
//   }
// );

/**
 * GET /api/patient-auth/check-email
 * Check if email exists for a workplace
 */
export const checkEmail = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    const { email, workplaceId } = req.query;

    if (!email || !workplaceId) {
      return sendError(res, 'BAD_REQUEST', 'Email and workplaceId are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(workplaceId as string)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid workplace ID', 400);
    }

    const existingUser = await PatientUser.findOne({
      email: (email as string).toLowerCase(),
      workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
      isDeleted: false,
    });

    sendSuccess(res, {
      exists: !!existingUser,
      isVerified: existingUser?.emailVerified || false,
      status: existingUser?.status || null,
    }, 'Email check completed');
  }
);

/**
 * GET /api/patient-auth/sessions
 * Get active sessions for patient user
 * TODO: Fix - requires full PatientUser document with refreshTokens
 */
// export const getSessions = asyncHandler(
//   async (req: PatientPortalRequest, res: Response) => {
//     if (!req.patientUser) {
//       return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
//     }

//     const sessions = req.patientUser.refreshTokens.map(rt => ({
//       id: rt.token.substring(0, 8) + '...', // Partial token for identification
//       createdAt: rt.createdAt,
//       expiresAt: rt.expiresAt,
//       deviceInfo: rt.deviceInfo,
//       ipAddress: rt.ipAddress,
//       isCurrentSession: req.cookies.patientRefreshToken === rt.token,
//     }));

//     sendSuccess(res, {
//       sessions,
//       totalSessions: sessions.length,
//     }, 'Sessions retrieved successfully');
//   }
// );

/**
 * DELETE /api/patient-auth/sessions/:sessionId
 * Revoke a specific session
 * TODO: Fix - requires full PatientUser document with refreshTokens
 */
// export const revokeSession = asyncHandler(
//   async (req: PatientPortalRequest, res: Response) => {
//     if (!req.patientUser) {
//       return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
//     }

//     const { sessionId } = req.params;
    
//     // Find the session by partial token match
//     const sessionIndex = req.patientUser.refreshTokens.findIndex(
//       rt => rt.token.startsWith(sessionId)
//     );

//     if (sessionIndex === -1) {
//       return sendError(res, 'NOT_FOUND', 'Session not found', 404);
//     }

//     // Remove the session
//     req.patientUser.refreshTokens.splice(sessionIndex, 1);
//     await req.patientUser.save();

//     sendSuccess(res, {}, 'Session revoked successfully');
//   }
// );