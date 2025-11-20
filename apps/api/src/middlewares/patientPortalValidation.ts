import { Request, Response, NextFunction } from 'express';
import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import mongoose from 'mongoose';

/**
 * Enhanced validation middleware for patient portal
 * Includes validation schemas for profile updates, allergies, conditions,
 * blog posts, ratings, and messaging
 */

// Helper functions
const isValidObjectId = (value: string): boolean => {
  return mongoose.Types.ObjectId.isValid(value);
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (phone: string): boolean => {
  // Nigerian phone number format: +234XXXXXXXXXX or 0XXXXXXXXXX
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
  return phoneRegex.test(phone);
};

const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date <= new Date();
};

/**
 * Enhanced validation result handler with detailed error formatting
 */
export const validatePatientPortalRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => {
      const fieldError = error as any;
      return {
        field: fieldError.path || fieldError.param,
        message: fieldError.msg,
        value: fieldError.value,
        location: fieldError.location,
      };
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed. Please check your input and try again.',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors,
      errorCount: formattedErrors.length,
    });
    return;
  }
  
  next();
};

// ===============================
// PATIENT PROFILE VALIDATION
// ===============================

export const updatePatientProfileSchema: ValidationChain[] = [
  body('firstName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('otherNames')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Other names cannot exceed 100 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Other names can only contain letters, spaces, hyphens, and apostrophes'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const minAge = new Date();
      minAge.setFullYear(today.getFullYear() - 120); // Max age 120 years
      
      if (birthDate > today) {
        throw new Error('Date of birth cannot be in the future');
      }
      
      if (birthDate < minAge) {
        throw new Error('Date of birth cannot be more than 120 years ago');
      }
      
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('maritalStatus')
    .optional()
    .isIn(['single', 'married', 'divorced', 'widowed'])
    .withMessage('Marital status must be single, married, divorced, or widowed'),

  body('phone')
    .optional()
    .custom((value) => {
      if (value && !isValidPhoneNumber(value)) {
        throw new Error('Please enter a valid Nigerian phone number');
      }
      return true;
    }),

  body('address')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),

  body('state')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),

  body('lga')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Local Government Area must be between 2 and 50 characters'),

  body('bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Blood group must be A+, A-, B+, B-, AB+, AB-, O+, or O-'),

  body('genotype')
    .optional()
    .isIn(['AA', 'AS', 'SS', 'AC', 'SC', 'CC'])
    .withMessage('Genotype must be AA, AS, SS, AC, SC, or CC'),

  body('weight')
    .optional()
    .isFloat({ min: 1, max: 500 })
    .withMessage('Weight must be between 1 and 500 kg'),

  body('language')
    .optional()
    .isIn(['en', 'yo', 'ig', 'ha'])
    .withMessage('Language must be en, yo, ig, or ha'),

  body('timezone')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Timezone must be between 3 and 50 characters'),
];

// ===============================
// ALLERGY MANAGEMENT VALIDATION
// ===============================

export const addAllergySchema: ValidationChain[] = [
  body('allergen')
    .notEmpty()
    .withMessage('Allergen is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Allergen must be between 2 and 100 characters'),

  body('reaction')
    .notEmpty()
    .withMessage('Reaction description is required')
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reaction description must be between 5 and 500 characters'),

  body('severity')
    .notEmpty()
    .withMessage('Severity is required')
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Severity must be mild, moderate, or severe'),

  body('recordedDate')
    .optional()
    .isISO8601()
    .withMessage('Recorded date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Recorded date cannot be in the future');
      }
      return true;
    }),
];

export const updateAllergySchema: ValidationChain[] = [
  param('allergyId')
    .notEmpty()
    .withMessage('Allergy ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid allergy ID');
      }
      return true;
    }),

  ...addAllergySchema.map(validator => validator.optional()),
];

// ===============================
// CHRONIC CONDITION VALIDATION
// ===============================

export const addChronicConditionSchema: ValidationChain[] = [
  body('condition')
    .notEmpty()
    .withMessage('Condition name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Condition name must be between 2 and 100 characters'),

  body('diagnosedDate')
    .notEmpty()
    .withMessage('Diagnosed date is required')
    .isISO8601()
    .withMessage('Diagnosed date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('Diagnosed date cannot be in the future');
      }
      return true;
    }),

  body('managementPlan')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Management plan cannot exceed 1000 characters'),

  body('status')
    .optional()
    .isIn(['active', 'managed', 'resolved'])
    .withMessage('Status must be active, managed, or resolved')
    .default('active'),
];

export const updateChronicConditionSchema: ValidationChain[] = [
  param('conditionId')
    .notEmpty()
    .withMessage('Condition ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid condition ID');
      }
      return true;
    }),

  ...addChronicConditionSchema.map(validator => validator.optional()),
];

// ===============================
// EMERGENCY CONTACT VALIDATION
// ===============================

export const addEmergencyContactSchema: ValidationChain[] = [
  body('name')
    .notEmpty()
    .withMessage('Contact name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Contact name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Contact name can only contain letters, spaces, hyphens, and apostrophes'),

  body('relationship')
    .notEmpty()
    .withMessage('Relationship is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Relationship must be between 2 and 50 characters'),

  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidPhoneNumber(value)) {
        throw new Error('Please enter a valid Nigerian phone number');
      }
      return true;
    }),

  body('email')
    .optional()
    .custom((value) => {
      if (value && !isValidEmail(value)) {
        throw new Error('Please enter a valid email address');
      }
      return true;
    }),

  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary must be a boolean')
    .default(false),
];

export const updateEmergencyContactSchema: ValidationChain[] = [
  param('contactId')
    .notEmpty()
    .withMessage('Contact ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid contact ID');
      }
      return true;
    }),

  ...addEmergencyContactSchema.map(validator => validator.optional()),
];

// ===============================
// INSURANCE INFORMATION VALIDATION
// ===============================

export const updateInsuranceInfoSchema: ValidationChain[] = [
  body('provider')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Insurance provider must be between 2 and 100 characters'),

  body('policyNumber')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('Policy number must be between 5 and 50 characters'),

  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      if (value && new Date(value) < new Date()) {
        throw new Error('Insurance expiry date cannot be in the past');
      }
      return true;
    }),

  body('coverageDetails')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Coverage details cannot exceed 500 characters'),

  body('copayAmount')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Copay amount must be between 0 and 1,000,000'),
];

// ===============================
// VITALS LOGGING VALIDATION
// ===============================

export const logVitalsSchema: ValidationChain[] = [
  body('recordedDate')
    .optional()
    .isISO8601()
    .withMessage('Recorded date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Recorded date cannot be in the future');
      }
      return true;
    })
    .default(() => new Date().toISOString()),

  body('bloodPressure')
    .optional()
    .isObject()
    .withMessage('Blood pressure must be an object'),

  body('bloodPressure.systolic')
    .optional()
    .isInt({ min: 50, max: 300 })
    .withMessage('Systolic pressure must be between 50 and 300 mmHg'),

  body('bloodPressure.diastolic')
    .optional()
    .isInt({ min: 30, max: 200 })
    .withMessage('Diastolic pressure must be between 30 and 200 mmHg'),

  body('heartRate')
    .optional()
    .isInt({ min: 30, max: 250 })
    .withMessage('Heart rate must be between 30 and 250 bpm'),

  body('temperature')
    .optional()
    .isFloat({ min: 30, max: 50 })
    .withMessage('Temperature must be between 30 and 50 degrees Celsius'),

  body('weight')
    .optional()
    .isFloat({ min: 1, max: 500 })
    .withMessage('Weight must be between 1 and 500 kg'),

  body('glucose')
    .optional()
    .isFloat({ min: 1, max: 50 })
    .withMessage('Glucose level must be between 1 and 50 mmol/L'),

  body('oxygenSaturation')
    .optional()
    .isInt({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50 and 100%'),

  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

// ===============================
// MESSAGING VALIDATION
// ===============================

export const sendMessageSchema: ValidationChain[] = [
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),

  body('recipientId')
    .notEmpty()
    .withMessage('Recipient ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid recipient ID');
      }
      return true;
    }),

  body('messageType')
    .optional()
    .isIn(['text', 'image', 'document'])
    .withMessage('Message type must be text, image, or document')
    .default('text'),

  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent')
    .default('normal'),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),

  body('attachments.*.fileName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters'),

  body('attachments.*.fileSize')
    .optional()
    .isInt({ min: 1, max: 10485760 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB'),

  body('attachments.*.mimeType')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/)
    .withMessage('Invalid MIME type format'),
];

// ===============================
// RATING & FEEDBACK VALIDATION
// ===============================

export const submitRatingSchema: ValidationChain[] = [
  body('appointmentId')
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error('Invalid appointment ID');
      }
      return true;
    }),

  body('pharmacistId')
    .notEmpty()
    .withMessage('Pharmacist ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid pharmacist ID');
      }
      return true;
    }),

  body('rating')
    .notEmpty()
    .withMessage('Overall rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('categories')
    .optional()
    .isObject()
    .withMessage('Categories must be an object'),

  body('categories.professionalism')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Professionalism rating must be between 1 and 5'),

  body('categories.communication')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),

  body('categories.expertise')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Expertise rating must be between 1 and 5'),

  body('categories.timeliness')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Timeliness rating must be between 1 and 5'),

  body('feedback')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback cannot exceed 1000 characters'),

  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean')
    .default(false),
];

// ===============================
// BLOG POST VALIDATION (Super Admin)
// ===============================

export const createBlogPostSchema: ValidationChain[] = [
  body('title')
    .notEmpty()
    .withMessage('Blog post title is required')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),

  body('excerpt')
    .notEmpty()
    .withMessage('Blog post excerpt is required')
    .isString()
    .trim()
    .isLength({ min: 20, max: 500 })
    .withMessage('Excerpt must be between 20 and 500 characters'),

  body('content')
    .notEmpty()
    .withMessage('Blog post content is required')
    .isString()
    .isLength({ min: 100 })
    .withMessage('Content must be at least 100 characters'),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['nutrition', 'wellness', 'medication', 'chronic_diseases', 'preventive_care', 'mental_health'])
    .withMessage('Invalid category'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags && tags.length > 10) {
        throw new Error('Cannot have more than 10 tags');
      }
      return true;
    }),

  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Each tag must be between 2 and 30 characters'),

  body('featuredImage')
    .notEmpty()
    .withMessage('Featured image is required')
    .isObject()
    .withMessage('Featured image must be an object'),

  body('featuredImage.url')
    .notEmpty()
    .withMessage('Featured image URL is required')
    .isURL()
    .withMessage('Featured image URL must be valid'),

  body('featuredImage.alt')
    .notEmpty()
    .withMessage('Featured image alt text is required')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Alt text must be between 5 and 200 characters'),

  body('featuredImage.caption')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Caption cannot exceed 300 characters'),

  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be draft or published')
    .default('draft'),

  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean')
    .default(false),

  body('seo')
    .optional()
    .isObject()
    .withMessage('SEO must be an object'),

  body('seo.metaTitle')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),

  body('seo.metaDescription')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters'),

  body('seo.keywords')
    .optional()
    .isArray()
    .withMessage('SEO keywords must be an array')
    .custom((keywords) => {
      if (keywords && keywords.length > 15) {
        throw new Error('Cannot have more than 15 SEO keywords');
      }
      return true;
    }),
];

export const updateBlogPostSchema: ValidationChain[] = [
  param('postId')
    .notEmpty()
    .withMessage('Post ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid post ID');
      }
      return true;
    }),

  ...createBlogPostSchema.map(validator => validator.optional()),
];

// ===============================
// QUERY PARAMETER VALIDATION
// ===============================

export const paginationQuerySchema: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000')
    .default(1),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .default(20),

  query('sort')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Sort field must be between 1 and 50 characters'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
    .default('desc'),
];

export const dateRangeQuerySchema: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(value);
        
        if (endDate < startDate) {
          throw new Error('End date cannot be before start date');
        }
        
        // Limit date range to 2 years
        const maxRange = new Date(startDate);
        maxRange.setFullYear(maxRange.getFullYear() + 2);
        if (endDate > maxRange) {
          throw new Error('Date range cannot exceed 2 years');
        }
      }
      return true;
    }),
];

// ===============================
// PARAMETER VALIDATION
// ===============================

export const objectIdParamSchema = (paramName: string): ValidationChain[] => [
  param(paramName)
    .notEmpty()
    .withMessage(`${paramName} is required`)
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error(`Invalid ${paramName}`);
      }
      return true;
    }),
];

// ===============================
// NOTIFICATION PREFERENCES VALIDATION
// ===============================

export const updateNotificationPreferencesSchema: ValidationChain[] = [
  body('email')
    .optional()
    .isBoolean()
    .withMessage('Email preference must be a boolean'),

  body('sms')
    .optional()
    .isBoolean()
    .withMessage('SMS preference must be a boolean'),

  body('push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),

  body('whatsapp')
    .optional()
    .isBoolean()
    .withMessage('WhatsApp preference must be a boolean'),

  body('appointmentReminders')
    .optional()
    .isBoolean()
    .withMessage('Appointment reminders preference must be a boolean'),

  body('medicationReminders')
    .optional()
    .isBoolean()
    .withMessage('Medication reminders preference must be a boolean'),

  body('healthTips')
    .optional()
    .isBoolean()
    .withMessage('Health tips preference must be a boolean'),
];

export default {
  validatePatientPortalRequest,
  updatePatientProfileSchema,
  addAllergySchema,
  updateAllergySchema,
  addChronicConditionSchema,
  updateChronicConditionSchema,
  addEmergencyContactSchema,
  updateEmergencyContactSchema,
  updateInsuranceInfoSchema,
  logVitalsSchema,
  sendMessageSchema,
  submitRatingSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  paginationQuerySchema,
  dateRangeQuerySchema,
  objectIdParamSchema,
  updateNotificationPreferencesSchema,
};