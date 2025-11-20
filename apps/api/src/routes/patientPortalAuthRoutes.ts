import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PatientUser from '../models/PatientUser';
import Patient from '../models/Patient';
import { Workplace } from '../models/Workplace';
import { generalRateLimiters } from '../middlewares/rateLimiting';
import { sendEmail } from '../utils/email';
import { auth } from '../middlewares/auth';
import { PatientSyncService } from '../services/patientSyncService';

const router = express.Router();

/**
 * @route POST /api/patient-portal/auth/register
 * @desc Register a new patient user for a specific workspace
 * @access Public
 */
router.post(
  '/register',
  generalRateLimiters.auth, // Use existing rate limiter
  [
    body('workspaceId')
      .notEmpty()
      .withMessage('Workspace ID is required')
      .isMongoId()
      .withMessage('Invalid workspace ID'),
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters')
      .trim(),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Valid date of birth is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const {
        workspaceId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        password,
      } = req.body;

      // Verify workspace exists and is active
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      if (workspace.verificationStatus !== 'verified') {
        return res.status(400).json({
          success: false,
          message: 'This workspace is not currently accepting new patient registrations',
        });
      }

      // Check if user already exists in this workspace
      const existingUser = await PatientUser.findOne({
        workspaceId,
        email,
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists for this workspace',
        });
      }

      // Create new patient user with pending status
      const patientUser = new PatientUser({
        workplaceId: workspaceId, // Correct field name for PatientUser model
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        passwordHash: password, // Will be hashed by pre-save middleware
        status: 'pending', // Requires approval
        isActive: false, // Not active until approved
        emailVerified: false,
        phoneVerified: false,
        createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // Self-registration - use null ObjectId
      });

      await patientUser.save();

      // Generate verification token
      const verificationToken = patientUser.generateVerificationToken();
      await patientUser.save();

      // Send welcome email and notify workspace owner
      try {
        // Send welcome email to patient
        await sendEmail({
          to: email,
          subject: `Welcome to ${workspace.name} Patient Portal`,
          html: `
            <h2>Welcome to ${workspace.name} Patient Portal</h2>
            <p>Dear ${firstName} ${lastName},</p>
            <p>Your account has been created and is pending approval by the workspace administrator.</p>
            <p>You will receive an email notification once your account is approved.</p>
            <p>Thank you for choosing ${workspace.name}.</p>
          `,
        });

        // Notify workspace owner about new patient registration
        const workspaceOwner = await PatientUser.findById(workspace.ownerId);
        if (workspaceOwner) {
          await sendEmail({
            to: workspaceOwner.email,
            subject: `New Patient Registration - ${workspace.name}`,
            html: `
              <h2>New Patient Registration</h2>
              <p>A new patient has registered for your workspace: ${workspace.name}</p>
              <p><strong>Patient Name:</strong> ${firstName} ${lastName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p>Please review and approve this registration in your dashboard.</p>
              <a href="${process.env.FRONTEND_URL}/workspace/team?tab=patients&filter=pending">Review Registration</a>
            `,
          });
        }
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't fail registration if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful! Your account is pending approval by the workspace administrator. You will be notified via email when your account is approved, typically within 24 hours.',
        data: {
          patientUserId: patientUser._id,
          status: patientUser.status,
          workspaceName: workspace.name,
        },
      });
    } catch (error) {
      console.error('Patient registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @route POST /api/patient-portal/auth/login
 * @desc Login patient user
 * @access Public
 */
router.post(
  '/login',
  generalRateLimiters.auth, // Use existing rate limiter
  [
    body('workspaceId')
      .notEmpty()
      .withMessage('Workspace ID is required')
      .isMongoId()
      .withMessage('Invalid workspace ID'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid login credentials',
          errors: errors.array(),
        });
      }

      const { workspaceId, email, password } = req.body;

      // Find patient user in the specific workspace
      const patientUser = await PatientUser.findOne({
        workplaceId: workspaceId,
        email,
        isDeleted: false,
      }).populate('workplaceId', 'name type');

      if (!patientUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check if account is locked
      if (patientUser.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.',
        });
      }

      // Check password
      const isPasswordValid = await patientUser.comparePassword(password);
      if (!isPasswordValid) {
        await patientUser.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check account status
      if (patientUser.status === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending approval by the administrator. You will be notified through email when your account is approved, typically within 24 hours.',
        });
      }

      if (patientUser.status === 'suspended' || !patientUser.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact the administrator for assistance.',
        });
      }

      // Reset login attempts on successful login
      await patientUser.resetLoginAttempts();

      // Update last login
      patientUser.lastLoginAt = new Date();
      await patientUser.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          patientUserId: patientUser._id,
          workspaceId: patientUser.workplaceId,
          email: patientUser.email,
          type: 'patient',
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        {
          patientUserId: patientUser._id,
          workspaceId: patientUser.workplaceId,
          type: 'patient_refresh',
        },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '30d' }
      );

      // Store refresh token
      patientUser.refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // Keep only last 5 refresh tokens
      if (patientUser.refreshTokens.length > 5) {
        patientUser.refreshTokens = patientUser.refreshTokens.slice(-5);
      }

      await patientUser.save();

      // Set httpOnly cookies for secure token storage
      res.cookie('patientAccessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.cookie('patientRefreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Patient login successful - cookies set:', {
          patientUserId: patientUser._id,
          email: patientUser.email,
          cookiesSet: ['patientAccessToken', 'patientRefreshToken'],
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          patientUser: {
            id: patientUser._id,
            firstName: patientUser.firstName,
            lastName: patientUser.lastName,
            email: patientUser.email,
            phone: patientUser.phone,
            status: patientUser.status,
            emailVerified: patientUser.emailVerified,
            workspaceId: (patientUser.workplaceId as any)?._id?.toString() || patientUser.workplaceId.toString(),
            workspaceName: (patientUser.workplaceId as any)?.name || 'Healthcare Workspace',
          },
        },
      });
    } catch (error) {
      console.error('Patient login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @route POST /api/patient-portal/auth/refresh-token
 * @desc Refresh patient access token using refresh token
 * @access Public (requires refresh token cookie)
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.patientRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided',
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Find patient user and verify refresh token exists
    const patientUser = await PatientUser.findById(decoded.patientUserId);

    if (!patientUser) {
      return res.status(401).json({
        success: false,
        message: 'Patient user not found',
      });
    }

    // Check if refresh token exists in user's tokens
    const tokenExists = patientUser.refreshTokens.some(
      (t: any) => t.token === refreshToken && new Date(t.expiresAt) > new Date()
    );

    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Check account status
    if (patientUser.status === 'suspended' || !patientUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        patientUserId: patientUser._id,
        workspaceId: patientUser.workplaceId,
        email: patientUser.email,
        type: 'patient',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Set new access token cookie
    res.cookie('patientAccessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Patient token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route POST /api/patient-portal/auth/refresh-token
 * @desc Refresh patient access token using refresh token
 * @access Public (requires refresh token cookie)
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.patientRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided',
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Find patient user and verify refresh token exists
    const patientUser = await PatientUser.findById(decoded.patientUserId);

    if (!patientUser) {
      return res.status(401).json({
        success: false,
        message: 'Patient user not found',
      });
    }

    // Check if refresh token exists in user's tokens
    const tokenExists = patientUser.refreshTokens.some(
      (t: any) => t.token === refreshToken && new Date(t.expiresAt) > new Date()
    );

    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Check account status
    if (patientUser.status === 'suspended' || !patientUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        patientUserId: patientUser._id,
        workspaceId: patientUser.workplaceId,
        email: patientUser.email,
        type: 'patient',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Set new access token cookie
    res.cookie('patientAccessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Patient token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route GET /api/patient-portal/auth/me
 * @desc Get current authenticated patient user
 * @access Private (requires patient access token)
 */
router.get('/me', async (req, res) => {
  try {
    const accessToken = req.cookies.patientAccessToken;

    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 /me endpoint - Cookie check:', {
        hasCookie: !!accessToken,
        cookieNames: Object.keys(req.cookies || {}),
        cookieCount: Object.keys(req.cookies || {}).length,
      });
    }

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        debug: process.env.NODE_ENV === 'development' ? {
          cookiesReceived: Object.keys(req.cookies || {}),
        } : undefined,
      });
    }

    // Verify access token
    let decoded: any;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token',
      });
    }

    // Find patient user
    const patientUser = await PatientUser.findById(decoded.patientUserId)
      .populate('workplaceId', 'name type')
      .select('-passwordHash -refreshTokens');

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient user not found',
      });
    }

    // Check account status
    if (patientUser.status === 'suspended' || !patientUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    res.json({
      success: true,
      data: {
        patientUser: {
          id: patientUser._id,
          firstName: patientUser.firstName,
          lastName: patientUser.lastName,
          email: patientUser.email,
          phone: patientUser.phone,
          dateOfBirth: patientUser.dateOfBirth,
          status: patientUser.status,
          emailVerified: patientUser.emailVerified,
          phoneVerified: patientUser.phoneVerified,
          workspaceId: (patientUser.workplaceId as any)?._id?.toString() || patientUser.workplaceId.toString(),
          workspaceName: (patientUser.workplaceId as any)?.name || 'Healthcare Workspace',
          lastLoginAt: patientUser.lastLoginAt,
        },
      },
      message: 'Patient user retrieved successfully',
    });
  } catch (error) {
    console.error('Get patient user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient user',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route PATCH /api/patient-portal/auth/approve/:patientUserId
 * @desc Approve a pending patient user (workspace owner only)
 * @access Private (Workspace Owner)
 */
router.patch(
  '/approve/:patientUserId',
  // Add authentication middleware here
  [
    body('approved')
      .isBoolean()
      .withMessage('Approved status must be boolean'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { patientUserId } = req.params;
      const { approved, reason } = req.body;

      // Find the patient user
      const patientUser = await PatientUser.findById(patientUserId)
        .populate('workplaceId', 'name ownerId');

      if (!patientUser) {
        return res.status(404).json({
          success: false,
          message: 'Patient user not found',
        });
      }

      // TODO: Add authorization check - only workspace owner can approve
      // if (req.user.id !== patientUser.workplaceId.ownerId.toString()) {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Not authorized to approve patients for this workspace',
      //   });
      // }

      // Update patient status
      if (approved) {
        patientUser.status = 'active';
        patientUser.isActive = true;

        // Automatically create or link Patient record when approved
        try {
          const { patient, isNewRecord } = await PatientSyncService.createOrLinkPatientRecord(patientUserId);
          console.log(`${isNewRecord ? 'Created new' : 'Linked existing'} Patient record ${patient._id} for approved PatientUser ${patientUserId}`);
        } catch (syncError) {
          console.error('Error creating/linking Patient record during approval:', syncError);
          // Don't fail the approval process if Patient record creation fails
          // The sync can be retried later
        }
      } else {
        patientUser.status = 'inactive';
        patientUser.isActive = false;
      }

      await patientUser.save();

      // Send notification email to patient
      try {
        const emailTemplate = approved ? 'patient-account-approved' : 'patient-account-rejected';
        // Get workspace info for email
        const workspace = await Workplace.findById(patientUser.workplaceId);
        const workspaceName = workspace?.name || 'Healthcare Workspace';

        await sendEmail({
          to: patientUser.email,
          subject: `Account ${approved ? 'Approved' : 'Update'} - ${workspaceName}`,
          html: approved ? `
            <h2>Account Approved!</h2>
            <p>Dear ${patientUser.firstName} ${patientUser.lastName},</p>
            <p>Your account for ${workspaceName} has been approved.</p>
            <p>You can now log in to access your patient portal.</p>
            <a href="${process.env.FRONTEND_URL}/patient-auth/${patientUser.workplaceId}">Login to Patient Portal</a>
          ` : `
            <h2>Account Update</h2>
            <p>Dear ${patientUser.firstName} ${patientUser.lastName},</p>
            <p>There has been an update to your account for ${workspaceName}.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Please contact the workspace administrator for more information.</p>
          `,
        });
      } catch (emailError) {
        console.error('Email notification error:', emailError);
      }

      res.json({
        success: true,
        message: `Patient account ${approved ? 'approved' : 'rejected'} successfully`,
        data: {
          patientUserId: patientUser._id,
          status: patientUser.status,
          approved,
        },
      });
    } catch (error) {
      console.error('Patient approval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update patient status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * @route GET /api/patient-portal/patients/pending
 * @desc Get all pending patient registrations for workspace (workspace owner only)
 * @access Private (Workspace Owner)
 */
router.get(
  '/pending',
  auth, // Require authentication
  async (req, res) => {
    try {
      // Get workspaceId from authenticated user or query parameter (for authenticated requests)
      let workspaceId = (req as any).user?.workplaceId || (req as any).user?.workplace || req.query.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required. Please ensure you are logged in.',
        });
      }

      // Find all pending patients for this workspace
      const pendingPatients = await PatientUser.find({
        workplaceId: workspaceId,
        status: 'pending',
        isDeleted: false,
      })
        .select('_id firstName lastName email phone dateOfBirth status createdAt workplaceId')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: {
          patients: pendingPatients,
          total: pendingPatients.length,
        },
        message: `Found ${pendingPatients.length} pending patient registration${pendingPatients.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Fetch pending patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending patients',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
);

/**
 * @route POST /api/patient-portal/auth/logout
 * @desc Logout patient user
 * @access Public
 */
router.post('/logout', async (req, res) => {
  try {
    // Clear patient cookies
    res.clearCookie('patientAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.clearCookie('patientRefreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Patient logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route POST /api/patient-portal/auth/sync-patient-record/:patientUserId
 * @desc Manually trigger Patient record creation/sync for testing
 * @access Private (Admin only - for testing)
 */
router.post('/sync-patient-record/:patientUserId', async (req, res) => {
  try {
    const { patientUserId } = req.params;

    const result = await PatientSyncService.createOrLinkPatientRecord(patientUserId);

    res.json({
      success: true,
      message: `${result.isNewRecord ? 'Created new' : 'Linked existing'} Patient record successfully`,
      data: {
        patientId: result.patient._id,
        mrn: result.patient.mrn,
        isNewRecord: result.isNewRecord,
      },
    });
  } catch (error) {
    console.error('Manual patient sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync patient record',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route GET /api/patient-portal/auth/debug-sync
 * @desc Debug endpoint to check sync status
 * @access Private (Admin only - for testing)
 */
router.get('/debug-sync', async (req, res) => {
  try {
    const { workspaceId } = req.query;

    // Build query filter
    const filter = workspaceId ? { workplaceId: workspaceId as string } : {};

    // Get PatientUsers for the workspace
    const patientUsers = await PatientUser.find(filter)
      .populate('workplaceId', 'name')
      .select('_id firstName lastName email status isActive patientId workplaceId');

    // Get Patients for the workspace
    const patients = await Patient.find(filter)
      .select('_id firstName lastName email mrn workplaceId createdBy');

    const syncStatus = patientUsers.map(user => {
      const linkedPatient = user.patientId ? patients.find(p => p._id.toString() === user.patientId.toString()) : null;

      return {
        patientUserId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        status: user.status,
        isActive: user.isActive,
        workspaceName: (user.workplaceId as any)?.name,
        hasLinkedPatient: !!user.patientId,
        linkedPatientId: user.patientId,
        linkedPatientExists: !!linkedPatient,
        linkedPatientMRN: linkedPatient?.mrn,
        needsSync: user.status === 'active' && user.isActive && !user.patientId,
      };
    });

    res.json({
      success: true,
      data: {
        totalPatientUsers: patientUsers.length,
        totalPatients: patients.length,
        activePatientUsers: patientUsers.filter(u => u.status === 'active' && u.isActive).length,
        unlinkedActiveUsers: patientUsers.filter(u => u.status === 'active' && u.isActive && !u.patientId).length,
        syncStatus,
      },
    });
  } catch (error) {
    console.error('Debug sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

export default router;
