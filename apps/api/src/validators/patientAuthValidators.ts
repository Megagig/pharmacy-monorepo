import { body, query, param } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

/**
 * Patient Authentication Validators
 * Validation schemas for patient authentication endpoints
 */

// Helper function to handle validation results
export const validateRequest = (validations: any[], location: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((error: any) => ({
          field: error.param || error.path || 'unknown',
          message: error.msg,
          value: error.value,
        })),
      });
    }

    next();
  };
};

// Custom validator for MongoDB ObjectId
const isValidObjectId = (value: string) => {
  return mongoose.Types.ObjectId.isValid(value);
};

// Custom validator for strong password
const isStrongPassword = (value: string) => {
  // At least 8 characters, contains at least one letter and one number
  const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  return strongPasswordRegex.test(value);
};

// Custom validator for phone number (international format)
const isValidPhoneNumber = (value: string) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(value);
};

// Custom validator for date of birth (not in future, reasonable age range)
const isValidDateOfBirth = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate()); // Max 120 years old
  
  return date <= now && date >= minDate;
};

// ===============================
// REGISTRATION VALIDATION
// ===============================

export const registerPatientSchema = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),

  body('phone')
    .optional()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid phone number in international format'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(isStrongPassword)
    .withMessage('Password must contain at least one letter and one number'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom(isValidDateOfBirth)
    .withMessage('Date of birth must be a valid date not in the future and within reasonable age range'),

  body('workplaceId')
    .custom(isValidObjectId)
    .withMessage('Please provide a valid workplace ID'),

  body('language')
    .optional()
    .isIn(['en', 'yo', 'ig', 'ha'])
    .withMessage('Language must be one of: en, yo, ig, ha'),

  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Timezone must be between 1 and 50 characters'),
];

// ===============================
// LOGIN VALIDATION
// ===============================

export const loginPatientSchema = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('phone')
    .optional()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid phone number'),

  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),

  body('workplaceId')
    .custom(isValidObjectId)
    .withMessage('Please provide a valid workplace ID'),

  // Custom validation to ensure either email or phone is provided
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error('Either email or phone is required');
    }
    return true;
  }),
];

// ===============================
// EMAIL VERIFICATION VALIDATION
// ===============================

export const verifyEmailSchema = [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Verification token is required')
    .isLength({ max: 255 })
    .withMessage('Invalid verification token format'),
];

// ===============================
// FORGOT PASSWORD VALIDATION
// ===============================

export const forgotPasswordSchema = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('workplaceId')
    .custom(isValidObjectId)
    .withMessage('Please provide a valid workplace ID'),
];

// ===============================
// RESET PASSWORD VALIDATION
// ===============================

export const resetPasswordSchema = [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Reset token is required')
    .isLength({ max: 255 })
    .withMessage('Invalid reset token format'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(isStrongPassword)
    .withMessage('Password must contain at least one letter and one number'),
];

// ===============================
// PROFILE UPDATE VALIDATION
// ===============================

export const updateProfileSchema = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phone')
    .optional()
    .custom(isValidPhoneNumber)
    .withMessage('Please provide a valid phone number in international format'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom(isValidDateOfBirth)
    .withMessage('Date of birth must be a valid date not in the future and within reasonable age range'),

  body('language')
    .optional()
    .isIn(['en', 'yo', 'ig', 'ha'])
    .withMessage('Language must be one of: en, yo, ig, ha'),

  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Timezone must be between 1 and 50 characters'),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),

  // Notification preferences validation
  body('notificationPreferences.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),

  body('notificationPreferences.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean'),

  body('notificationPreferences.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),

  body('notificationPreferences.whatsapp')
    .optional()
    .isBoolean()
    .withMessage('WhatsApp notification preference must be a boolean'),

  body('notificationPreferences.appointmentReminders')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminders preference must be a boolean'),

  body('notificationPreferences.medicationReminders')
    .optional()
    .isBoolean()
    .withMessage('Medication reminders preference must be a boolean'),

  body('notificationPreferences.healthTips')
    .optional()
    .isBoolean()
    .withMessage('Health tips preference must be a boolean'),
];

// ===============================
// LINK PATIENT VALIDATION
// ===============================

export const linkPatientSchema = [
  body('patientId')
    .custom(isValidObjectId)
    .withMessage('Please provide a valid patient ID'),
];

// ===============================
// CHECK EMAIL VALIDATION
// ===============================

export const checkEmailSchema = [
  query('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  query('workplaceId')
    .custom(isValidObjectId)
    .withMessage('Please provide a valid workplace ID'),
];

// ===============================
// SESSION MANAGEMENT VALIDATION
// ===============================

export const revokeSessionSchema = [
  param('sessionId')
    .isLength({ min: 8, max: 8 })
    .withMessage('Session ID must be 8 characters')
    .matches(/^[a-f0-9]+$/)
    .withMessage('Session ID must be a valid hexadecimal string'),
];

// ===============================
// REFRESH TOKEN VALIDATION
// ===============================

export const refreshTokenSchema = [
  body('refreshToken')
    .optional() // Can come from cookie
    .isLength({ min: 1 })
    .withMessage('Refresh token is required'),
];

// ===============================
// COMMON VALIDATION HELPERS
// ===============================

/**
 * Sanitize and validate common fields
 */
export const sanitizeCommonFields = [
  body('*').trim(), // Trim all string fields
  body('email').normalizeEmail(), // Normalize email if present
];

/**
 * Validate pagination parameters
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'firstName', '-firstName', 'lastName', '-lastName', 'email', '-email'])
    .withMessage('Sort must be one of: createdAt, -createdAt, firstName, -firstName, lastName, -lastName, email, -email'),
];

/**
 * Validate search parameters
 */
export const validateSearch = [
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s@.-]+$/)
    .withMessage('Search term contains invalid characters'),
];

/**
 * Validate date range parameters
 */
export const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  // Custom validation to ensure end date is after start date
  query().custom((value, { req }) => {
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }
    }
    return true;
  }),
];