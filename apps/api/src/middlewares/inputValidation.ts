import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

/**
 * Comprehensive Input Validation and Sanitization Middleware
 * Provides protection against XSS, SQL injection, and other input-based attacks
 */

export interface ValidationOptions {
  sanitize?: boolean;
  allowHTML?: boolean;
  maxLength?: number;
  customValidator?: (value: any) => boolean | Promise<boolean>;
  customSanitizer?: (value: any) => any;
}

/**
 * Enhanced validation result handler with detailed error reporting
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => {
      const fieldError = error as any;
      return {
        field: fieldError.path || fieldError.param,
        message: fieldError.msg,
        value: fieldError.value,
        location: fieldError.location
      };
    });

    // Log validation failures for security monitoring
    logger.warn('Input validation failed', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as AuthRequest).user?._id,
      errors: formattedErrors,
      service: 'input-validation'
    });

    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
};

/**
 * Sanitize string input to prevent XSS attacks
 */
export const sanitizeString = (value: string, options: ValidationOptions = {}): string => {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;

  // Basic sanitization
  sanitized = sanitized.trim();

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // HTML sanitization
  if (!options.allowHTML) {
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  } else {
    // Allow limited HTML with strict sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: []
    });
  }

  // Length validation
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // Custom sanitizer
  if (options.customSanitizer) {
    sanitized = options.customSanitizer(sanitized);
  }

  return sanitized;
};

/**
 * Validate and sanitize email addresses
 */
export const validateEmail = (): ValidationChain => {
  return body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false
    })
    .isLength({ max: 254 })
    .withMessage('Email must not exceed 254 characters')
    .custom((value) => {
      // Additional email security checks
      if (value.includes('..')) {
        throw new Error('Email contains consecutive dots');
      }
      if (value.startsWith('.') || value.endsWith('.')) {
        throw new Error('Email cannot start or end with a dot');
      }
      return true;
    });
};

/**
 * Validate password with security requirements
 */
export const validatePassword = (field: string = 'password'): ValidationChain => {
  return body(field)
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value) => {
      // Check for common weak passwords
      const weakPasswords = [
        'password', 'password123', '123456', 'qwerty', 'admin', 'letmein',
        'welcome', 'monkey', '1234567890', 'password1'
      ];
      
      if (weakPasswords.includes(value.toLowerCase())) {
        throw new Error('Password is too common and easily guessable');
      }

      // Check for repeated characters
      if (/(.)\1{2,}/.test(value)) {
        throw new Error('Password should not contain more than 2 consecutive identical characters');
      }

      // Check for keyboard patterns
      const keyboardPatterns = ['qwerty', 'asdf', 'zxcv', '1234', 'abcd'];
      for (const pattern of keyboardPatterns) {
        if (value.toLowerCase().includes(pattern)) {
          throw new Error('Password should not contain keyboard patterns');
        }
      }

      return true;
    });
};

/**
 * Validate MongoDB ObjectId
 */
export const validateObjectId = (field: string): ValidationChain => {
  return param(field)
    .isMongoId()
    .withMessage(`Invalid ${field} format`)
    .customSanitizer((value) => {
      return validator.escape(value);
    });
};

/**
 * Validate and sanitize text input
 */
export const validateText = (field: string, options: ValidationOptions = {}): ValidationChain => {
  const maxLength = options.maxLength || 1000;
  
  return body(field)
    .optional()
    .isLength({ max: maxLength })
    .withMessage(`${field} must not exceed ${maxLength} characters`)
    .customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      return sanitizeString(value, options);
    })
    .custom((value) => {
      if (options.customValidator) {
        return options.customValidator(value);
      }
      return true;
    });
};

/**
 * Validate numeric input with range checking
 */
export const validateNumber = (
  field: string, 
  min?: number, 
  max?: number, 
  isInteger: boolean = false
): ValidationChain => {
  let chain = body(field);

  if (isInteger) {
    chain = chain.isInt({ min, max });
  } else {
    chain = chain.isFloat({ min, max });
  }

  return chain
    .withMessage(`${field} must be a valid ${isInteger ? 'integer' : 'number'}${min !== undefined ? ` >= ${min}` : ''}${max !== undefined ? ` <= ${max}` : ''}`)
    .toFloat(); // Convert to number
};

/**
 * Validate URL input
 */
export const validateURL = (field: string, protocols: string[] = ['http', 'https']): ValidationChain => {
  return body(field)
    .optional()
    .isURL({ protocols, require_protocol: true })
    .withMessage(`${field} must be a valid URL`)
    .isLength({ max: 2048 })
    .withMessage(`${field} must not exceed 2048 characters`)
    .customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      return validator.escape(value);
    });
};

/**
 * Validate phone number
 */
export const validatePhone = (field: string): ValidationChain => {
  return body(field)
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage(`${field} must be a valid phone number`)
    .customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      // Remove all non-digit characters except +
      return value.replace(/[^\d+]/g, '');
    });
};

/**
 * Validate date input
 */
export const validateDate = (field: string, options: { 
  minDate?: Date, 
  maxDate?: Date,
  format?: string 
} = {}): ValidationChain => {
  return body(field)
    .optional()
    .isISO8601({ strict: true })
    .withMessage(`${field} must be a valid ISO 8601 date`)
    .custom((value) => {
      const date = new Date(value);
      
      if (options.minDate && date < options.minDate) {
        throw new Error(`${field} must be after ${options.minDate.toISOString()}`);
      }
      
      if (options.maxDate && date > options.maxDate) {
        throw new Error(`${field} must be before ${options.maxDate.toISOString()}`);
      }
      
      return true;
    })
    .toDate();
};

/**
 * Validate array input with element validation
 */
export const validateArray = (
  field: string, 
  elementValidator?: ValidationChain,
  options: { minLength?: number, maxLength?: number } = {}
): ValidationChain => {
  return body(field)
    .optional()
    .isArray({ min: options.minLength, max: options.maxLength })
    .withMessage(`${field} must be an array${options.minLength ? ` with at least ${options.minLength} elements` : ''}${options.maxLength ? ` with at most ${options.maxLength} elements` : ''}`)
    .customSanitizer((value) => {
      if (!Array.isArray(value)) return value;
      
      // Sanitize each element if it's a string
      return value.map(item => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        return item;
      });
    });
};

/**
 * Validate JSON input
 */
export const validateJSON = (field: string, maxSize: number = 10000): ValidationChain => {
  return body(field)
    .optional()
    .custom((value) => {
      try {
        if (typeof value === 'string') {
          const parsed = JSON.parse(value);
          
          // Check size
          if (JSON.stringify(parsed).length > maxSize) {
            throw new Error(`${field} JSON is too large (max ${maxSize} characters)`);
          }
          
          return true;
        } else if (typeof value === 'object') {
          // Already parsed JSON
          if (JSON.stringify(value).length > maxSize) {
            throw new Error(`${field} JSON is too large (max ${maxSize} characters)`);
          }
          return true;
        }
        
        throw new Error(`${field} must be valid JSON`);
      } catch (error) {
        throw new Error(`${field} must be valid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
};

/**
 * Validate file upload parameters
 */
export const validateFileUpload = (field: string): ValidationChain[] => {
  return [
    body(`${field}.filename`)
      .optional()
      .isLength({ max: 255 })
      .withMessage('Filename must not exceed 255 characters')
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('Filename contains invalid characters')
      .customSanitizer((value) => {
        if (typeof value !== 'string') return value;
        return sanitizeString(value);
      }),
    
    body(`${field}.mimetype`)
      .optional()
      .isIn([
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ])
      .withMessage('Invalid file type'),
    
    body(`${field}.size`)
      .optional()
      .isInt({ min: 1, max: 10 * 1024 * 1024 }) // 10MB max
      .withMessage('File size must be between 1 byte and 10MB')
  ];
};

/**
 * SQL injection prevention for search queries
 */
export const validateSearchQuery = (field: string): ValidationChain => {
  return query(field)
    .optional()
    .isLength({ max: 100 })
    .withMessage(`${field} must not exceed 100 characters`)
    .matches(/^[a-zA-Z0-9\s._-]*$/)
    .withMessage(`${field} contains invalid characters`)
    .customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      
      // Remove SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(--|\/\*|\*\/|;|'|"|`)/g,
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
      ];
      
      let sanitized = value;
      sqlPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
      
      return sanitizeString(sanitized);
    });
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (): ValidationChain[] => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Page must be between 1 and 10000')
      .toInt(),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    
    query('sortBy')
      .optional()
      .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .withMessage('Sort field contains invalid characters')
      .isLength({ max: 50 })
      .withMessage('Sort field name too long'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ];
};

/**
 * Comprehensive request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeString(value);
        }
      }
    }

    // Sanitize body parameters (excluding files and already validated fields)
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }

    // Sanitize params
    if (req.params) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
          req.params[key] = sanitizeString(value);
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Error sanitizing request:', error);
    res.status(500).json({
      success: false,
      code: 'SANITIZATION_ERROR',
      message: 'Request sanitization failed'
    });
  }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any, depth: number = 0): void {
  // Prevent deep recursion attacks
  if (depth > 10) return;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      obj[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitizeObject(value, depth + 1);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string') {
          value[index] = sanitizeString(item);
        } else if (typeof item === 'object' && item !== null) {
          sanitizeObject(item, depth + 1);
        }
      });
    }
  }
}

/**
 * Validate IP address
 */
export const validateIP = (field: string): ValidationChain => {
  return body(field)
    .optional()
    .isIP()
    .withMessage(`${field} must be a valid IP address`);
};

/**
 * Validate user role
 */
export const validateUserRole = (field: string): ValidationChain => {
  return body(field)
    .optional()
    .isIn(['super_admin', 'admin', 'pharmacist', 'cashier', 'manager', 'user'])
    .withMessage(`${field} must be a valid user role`);
};

/**
 * Common validation chains for SaaS endpoints
 */
export const saasValidationChains = {
  // User management validations
  updateUserRole: [
    validateObjectId('userId'),
    body('roleId').isMongoId().withMessage('Invalid role ID'),
    body('workspaceId').optional().isMongoId().withMessage('Invalid workspace ID'),
    validateText('reason', { maxLength: 500 })
  ],

  // Security settings validations
  updatePasswordPolicy: [
    validateNumber('minLength', 4, 128, true),
    body('requireUppercase').isBoolean().withMessage('requireUppercase must be boolean'),
    body('requireLowercase').isBoolean().withMessage('requireLowercase must be boolean'),
    body('requireNumbers').isBoolean().withMessage('requireNumbers must be boolean'),
    body('requireSpecialChars').isBoolean().withMessage('requireSpecialChars must be boolean'),
    validateNumber('maxAge', 1, 365, true),
    validateNumber('preventReuse', 0, 24, true),
    validateNumber('lockoutThreshold', 1, 20, true),
    validateNumber('lockoutDuration', 1, 1440, true)
  ],

  // Feature flags validations
  updateFeatureFlag: [
    validateObjectId('flagId'),
    body('enabled').isBoolean().withMessage('enabled must be boolean'),
    validateArray('targetingRules.pharmacies'),
    validateArray('targetingRules.userGroups'),
    validateArray('targetingRules.subscriptionPlans'),
    validateNumber('targetingRules.percentage', 0, 100)
  ],

  // Notification validations
  createNotification: [
    validateText('title', { maxLength: 200 }),
    validateText('message', { maxLength: 2000 }),
    body('channels').isArray().withMessage('channels must be an array'),
    body('channels.*').isIn(['email', 'sms', 'push', 'whatsapp']).withMessage('Invalid notification channel'),
    validateArray('targetUsers'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
  ],

  // Pagination and filtering
  listWithPagination: [
    ...validatePagination(),
    validateSearchQuery('search'),
    validateSearchQuery('filter')
  ]
};

export default {
  handleValidationErrors,
  sanitizeString,
  sanitizeRequest,
  validateEmail,
  validatePassword,
  validateObjectId,
  validateText,
  validateNumber,
  validateURL,
  validatePhone,
  validateDate,
  validateArray,
  validateJSON,
  validateFileUpload,
  validateSearchQuery,
  validatePagination,
  validateIP,
  validateUserRole,
  saasValidationChains
};