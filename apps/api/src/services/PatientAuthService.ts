import mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import Patient, { IPatient } from '../models/Patient';
import Workplace from '../models/Workplace';
import { sendEmail } from '../utils/email';
import logger from '../utils/logger';
import { ValidationError, AppointmentError } from '../utils/appointmentErrors';

/**
 * Patient Authentication Service
 * Handles patient-specific authentication, registration, and session management
 */

interface RegisterPatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  dateOfBirth?: Date;
  workplaceId: mongoose.Types.ObjectId;
  language?: string;
  timezone?: string;
}

interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
  workplaceId: mongoose.Types.ObjectId;
  deviceInfo?: string;
  ipAddress?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface PatientAuthResult {
  patientUser: IPatientUser;
  tokens: AuthTokens;
  patient?: IPatient;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
}

interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  language?: string;
  timezone?: string;
  avatar?: string;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    whatsapp?: boolean;
    appointmentReminders?: boolean;
    medicationReminders?: boolean;
    healthTips?: boolean;
  };
}

class PatientAuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '1h';
  private static readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Register a new patient user
   */
  static async registerPatient(data: RegisterPatientData): Promise<PatientAuthResult> {
    try {
      // Validate workplace exists
      const workplace = await Workplace.findById(data.workplaceId);
      if (!workplace) {
        throw new ValidationError('Invalid workplace');
      }

      // Check if patient user already exists
      const existingPatientUser = await PatientUser.findOne({
        workplaceId: data.workplaceId,
        $or: [
          { email: data.email.toLowerCase() },
          ...(data.phone ? [{ phone: data.phone }] : [])
        ],
        isDeleted: false,
      });

      if (existingPatientUser) {
        throw new ValidationError('Patient user already exists with this email or phone');
      }

      // Create patient user
      const patientUser = new PatientUser({
        workplaceId: data.workplaceId,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: data.password, // Will be hashed by pre-save middleware
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        language: data.language || 'en',
        timezone: data.timezone || 'Africa/Lagos',
        status: 'pending', // Requires admin approval
        isActive: true, // Account is active, just pending approval
        createdBy: new mongoose.Types.ObjectId(), // System created
      });

      // Generate verification token
      const verificationToken = patientUser.generateVerificationToken();
      await patientUser.save();

      // Send verification email
      await this.sendVerificationEmail(patientUser, verificationToken);

      // Generate auth tokens
      const tokens = await this.generateTokens(patientUser, data.workplaceId);

      logger.info('Patient user registered successfully', {
        patientUserId: patientUser._id,
        email: patientUser.email,
        workplaceId: data.workplaceId,
      });

      return {
        patientUser,
        tokens,
      };
    } catch (error) {
      logger.error('Error registering patient user:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to register patient user');
    }
  }

  /**
   * Login patient user
   */
  static async loginPatient(credentials: LoginCredentials): Promise<PatientAuthResult> {
    try {
      // Find patient user by email or phone
      const query: any = {
        workplaceId: credentials.workplaceId,
        isDeleted: false,
      };

      if (credentials.email) {
        query.email = credentials.email.toLowerCase();
      } else if (credentials.phone) {
        query.phone = credentials.phone;
      } else {
        throw new ValidationError('Email or phone is required');
      }

      const patientUser = await PatientUser.findOne(query);
      if (!patientUser) {
        throw new ValidationError('Invalid credentials');
      }

      // Check if account is locked
      if (patientUser.isLocked()) {
        throw new ValidationError('Account is temporarily locked due to too many failed login attempts');
      }

      // Check if account is suspended
      if (patientUser.status === 'suspended') {
        throw new ValidationError('Account is suspended. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await patientUser.comparePassword(credentials.password);
      if (!isPasswordValid) {
        await patientUser.incLoginAttempts();
        throw new ValidationError('Invalid credentials');
      }

      // Reset login attempts on successful login
      if (patientUser.loginAttempts > 0) {
        await patientUser.resetLoginAttempts();
      }

      // Update last login
      patientUser.lastLoginAt = new Date();
      await patientUser.save();

      // Generate auth tokens
      const tokens = await this.generateTokens(
        patientUser,
        credentials.workplaceId,
        credentials.deviceInfo,
        credentials.ipAddress
      );

      // Get associated patient record if exists
      let patient: IPatient | undefined;
      if (patientUser.patientId) {
        patient = await Patient.findById(patientUser.patientId);
      }

      logger.info('Patient user logged in successfully', {
        patientUserId: patientUser._id,
        email: patientUser.email,
        workplaceId: credentials.workplaceId,
      });

      return {
        patientUser,
        tokens,
        patient,
      };
    } catch (error) {
      logger.error('Error logging in patient user:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to login patient user');
    }
  }

  /**
   * Verify email address
   */
  static async verifyEmail(token: string): Promise<IPatientUser> {
    try {
      const patientUser = await PatientUser.findOne({
        verificationToken: token,
        isDeleted: false,
      });

      if (!patientUser) {
        throw new ValidationError('Invalid or expired verification token');
      }

      patientUser.emailVerified = true;
      patientUser.status = 'active';
      patientUser.verificationToken = undefined;
      await patientUser.save();

      logger.info('Patient user email verified', {
        patientUserId: patientUser._id,
        email: patientUser.email,
      });

      return patientUser;
    } catch (error) {
      logger.error('Error verifying email:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to verify email');
    }
  }

  /**
   * Send password reset email
   */
  static async forgotPassword(email: string, workplaceId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const patientUser = await PatientUser.findOne({
        email: email.toLowerCase(),
        workplaceId,
        isDeleted: false,
      });

      if (!patientUser) {
        // Don't reveal if email exists or not
        logger.warn('Password reset requested for non-existent email', { email, workplaceId });
        return;
      }

      // Generate reset token
      const resetToken = patientUser.generateResetToken();
      await patientUser.save();

      // Send reset email
      await this.sendPasswordResetEmail(patientUser, resetToken);

      logger.info('Password reset email sent', {
        patientUserId: patientUser._id,
        email: patientUser.email,
      });
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      throw new AppointmentError('Failed to send password reset email');
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(data: ResetPasswordData): Promise<IPatientUser> {
    try {
      const patientUser = await PatientUser.findOne({
        resetToken: data.token,
        resetTokenExpires: { $gt: new Date() },
        isDeleted: false,
      });

      if (!patientUser) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Update password
      patientUser.passwordHash = data.newPassword; // Will be hashed by pre-save middleware
      patientUser.resetToken = undefined;
      patientUser.resetTokenExpires = undefined;

      // Reset login attempts if any
      patientUser.loginAttempts = 0;
      patientUser.lockUntil = undefined;

      await patientUser.save();

      logger.info('Patient user password reset successfully', {
        patientUserId: patientUser._id,
        email: patientUser.email,
      });

      return patientUser;
    } catch (error) {
      logger.error('Error resetting password:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to reset password');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const patientUser = await PatientUser.findOne({
        'refreshTokens.token': refreshToken,
        'refreshTokens.expiresAt': { $gt: new Date() },
        isDeleted: false,
      });

      if (!patientUser) {
        throw new ValidationError('Invalid or expired refresh token');
      }

      // Remove the used refresh token
      patientUser.refreshTokens = patientUser.refreshTokens.filter(
        rt => rt.token !== refreshToken
      );

      // Generate new tokens
      const tokens = await this.generateTokens(patientUser, patientUser.workplaceId);

      return tokens;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to refresh access token');
    }
  }

  /**
   * Logout patient user (invalidate refresh token)
   */
  static async logout(patientUserId: mongoose.Types.ObjectId, refreshToken: string): Promise<void> {
    try {
      await PatientUser.updateOne(
        { _id: patientUserId },
        { $pull: { refreshTokens: { token: refreshToken } } }
      );

      logger.info('Patient user logged out', { patientUserId });
    } catch (error) {
      logger.error('Error logging out patient user:', error);
      throw new AppointmentError('Failed to logout');
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(patientUserId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await PatientUser.updateOne(
        { _id: patientUserId },
        { $set: { refreshTokens: [] } }
      );

      logger.info('Patient user logged out from all devices', { patientUserId });
    } catch (error) {
      logger.error('Error logging out patient user from all devices:', error);
      throw new AppointmentError('Failed to logout from all devices');
    }
  }

  /**
   * Update patient user profile
   */
  static async updateProfile(
    patientUserId: mongoose.Types.ObjectId,
    data: UpdateProfileData
  ): Promise<IPatientUser> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new ValidationError('Patient user not found');
      }

      // Update fields
      if (data.firstName) patientUser.firstName = data.firstName;
      if (data.lastName) patientUser.lastName = data.lastName;
      if (data.phone) patientUser.phone = data.phone;
      if (data.dateOfBirth) patientUser.dateOfBirth = data.dateOfBirth;
      if (data.language) patientUser.language = data.language;
      if (data.timezone) patientUser.timezone = data.timezone;
      if (data.avatar) patientUser.avatar = data.avatar;

      // Update notification preferences
      if (data.notificationPreferences) {
        Object.assign(patientUser.notificationPreferences, data.notificationPreferences);
      }

      await patientUser.save();

      logger.info('Patient user profile updated', {
        patientUserId,
        email: patientUser.email,
      });

      return patientUser;
    } catch (error) {
      logger.error('Error updating patient user profile:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to update profile');
    }
  }

  /**
   * Link patient user to patient record
   */
  static async linkToPatient(
    patientUserId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
  ): Promise<IPatientUser> {
    try {
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new ValidationError('Patient user not found');
      }

      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: patientUser.workplaceId,
        isDeleted: false,
      });
      if (!patient) {
        throw new ValidationError('Patient not found');
      }

      patientUser.patientId = patientId;
      await patientUser.save();

      logger.info('Patient user linked to patient record', {
        patientUserId,
        patientId,
        workplaceId: patientUser.workplaceId,
      });

      return patientUser;
    } catch (error) {
      logger.error('Error linking patient user to patient:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppointmentError('Failed to link patient user to patient');
    }
  }

  /**
   * Verify JWT token and get patient user
   */
  static async verifyToken(token: string): Promise<IPatientUser> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        patientUserId: string;
        workplaceId: string;
      };

      const patientUser = await PatientUser.findOne({
        _id: decoded.patientUserId,
        workplaceId: decoded.workplaceId,
        status: { $in: ['active', 'pending'] },
        isDeleted: false,
      });

      if (!patientUser) {
        throw new ValidationError('Invalid token');
      }

      return patientUser;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid token');
      }
      throw error;
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Generate access and refresh tokens
   */
  private static async generateTokens(
    patientUser: IPatientUser,
    workplaceId: mongoose.Types.ObjectId,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    // Generate access token
    const accessToken = jwt.sign(
      {
        patientUserId: patientUser._id.toString(),
        workplaceId: workplaceId.toString(),
        email: patientUser.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiry = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY);

    // Store refresh token
    patientUser.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: refreshTokenExpiry,
      deviceInfo,
      ipAddress,
    });

    // Clean up expired refresh tokens
    patientUser.refreshTokens = patientUser.refreshTokens.filter(
      rt => rt.expiresAt > new Date()
    );

    await patientUser.save();

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  /**
   * Send verification email
   */
  private static async sendVerificationEmail(
    patientUser: IPatientUser,
    token: string
  ): Promise<void> {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/patient-portal/verify-email?token=${token}`;

      await sendEmail({
        to: patientUser.email,
        subject: 'Verify Your Patient Portal Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to the Patient Portal!</h2>
            <p>Hello ${patientUser.firstName},</p>
            <p>Thank you for registering for our patient portal. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This email was sent from the Patient Portal. Please do not reply to this email.
            </p>
          </div>
        `,
      });
    } catch (error) {
      logger.error('Error sending verification email:', error);
      // Don't throw error - registration should still succeed
    }
  }

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(
    patientUser: IPatientUser,
    token: string
  ): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/patient-portal/reset-password?token=${token}`;

      await sendEmail({
        to: patientUser.email,
        subject: 'Reset Your Patient Portal Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hello ${patientUser.firstName},</p>
            <p>We received a request to reset your password for the patient portal. Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This reset link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This email was sent from the Patient Portal. Please do not reply to this email.
            </p>
          </div>
        `,
      });
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      // Don't throw error - the reset token is still valid
    }
  }
}

export default PatientAuthService;