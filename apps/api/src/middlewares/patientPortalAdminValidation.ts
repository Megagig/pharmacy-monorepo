import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Validation schemas for patient portal admin operations
 */
const validationSchemas = {
  // Patient user management
  approvePatientUser: Joi.object({
    params: Joi.object({
      patientUserId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid patient user ID format',
          'any.required': 'Patient user ID is required',
        }),
    }),
  }),

  suspendPatientUser: Joi.object({
    params: Joi.object({
      patientUserId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid patient user ID format',
          'any.required': 'Patient user ID is required',
        }),
    }),
    body: Joi.object({
      reason: Joi.string()
        .trim()
        .min(1)
        .max(500)
        .required()
        .messages({
          'string.empty': 'Suspension reason cannot be empty',
          'string.min': 'Suspension reason is required',
          'string.max': 'Suspension reason cannot exceed 500 characters',
          'any.required': 'Suspension reason is required',
        }),
    }),
  }),

  reactivatePatientUser: Joi.object({
    params: Joi.object({
      patientUserId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid patient user ID format',
          'any.required': 'Patient user ID is required',
        }),
    }),
  }),

  // Refill request management
  approveRefillRequest: Joi.object({
    params: Joi.object({
      requestId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid request ID format',
          'any.required': 'Request ID is required',
        }),
    }),
    body: Joi.object({
      pharmacistId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid pharmacist ID format',
          'any.required': 'Pharmacist ID is required',
        }),
      approvedQuantity: Joi.number()
        .integer()
        .min(1)
        .max(365)
        .required()
        .messages({
          'number.base': 'Approved quantity must be a number',
          'number.integer': 'Approved quantity must be an integer',
          'number.min': 'Approved quantity must be at least 1',
          'number.max': 'Approved quantity cannot exceed 365 days supply',
          'any.required': 'Approved quantity is required',
        }),
      pharmacistNotes: Joi.string()
        .trim()
        .max(1000)
        .optional()
        .messages({
          'string.max': 'Pharmacist notes cannot exceed 1000 characters',
        }),
    }),
  }),

  denyRefillRequest: Joi.object({
    params: Joi.object({
      requestId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid request ID format',
          'any.required': 'Request ID is required',
        }),
    }),
    body: Joi.object({
      pharmacistId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid pharmacist ID format',
          'any.required': 'Pharmacist ID is required',
        }),
      denialReason: Joi.string()
        .trim()
        .min(1)
        .max(500)
        .required()
        .messages({
          'string.empty': 'Denial reason cannot be empty',
          'string.min': 'Denial reason is required',
          'string.max': 'Denial reason cannot exceed 500 characters',
          'any.required': 'Denial reason is required',
        }),
    }),
  }),

  assignRefillRequest: Joi.object({
    params: Joi.object({
      requestId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid request ID format',
          'any.required': 'Request ID is required',
        }),
    }),
    body: Joi.object({
      pharmacistId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid pharmacist ID format',
          'any.required': 'Pharmacist ID is required',
        }),
    }),
  }),

  // Query parameter validation
  getUsersQuery: Joi.object({
    status: Joi.string()
      .valid('active', 'pending', 'suspended', 'inactive')
      .optional()
      .messages({
        'any.only': 'Status must be one of: active, pending, suspended, inactive',
      }),
    search: Joi.string()
      .trim()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Search term cannot exceed 100 characters',
      }),
    dateFrom: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Date from must be in ISO format',
      }),
    dateTo: Joi.date()
      .iso()
      .min(Joi.ref('dateFrom'))
      .optional()
      .messages({
        'date.format': 'Date to must be in ISO format',
        'date.min': 'Date to must be after date from',
      }),
    page: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .default(1)
      .optional()
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
        'number.max': 'Page cannot exceed 1000',
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100',
      }),
  }),

  getRefillRequestsQuery: Joi.object({
    status: Joi.string()
      .valid('pending', 'in_progress', 'completed', 'cancelled')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, in_progress, completed, cancelled',
      }),
    urgency: Joi.string()
      .valid('routine', 'urgent')
      .optional()
      .messages({
        'any.only': 'Urgency must be either routine or urgent',
      }),
    patientId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid patient ID format',
      }),
    assignedTo: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid pharmacist ID format',
      }),
    dateFrom: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Date from must be in ISO format',
      }),
    dateTo: Joi.date()
      .iso()
      .min(Joi.ref('dateFrom'))
      .optional()
      .messages({
        'date.format': 'Date to must be in ISO format',
        'date.min': 'Date to must be after date from',
      }),
    page: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .default(1)
      .optional()
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
        'number.max': 'Page cannot exceed 1000',
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100',
      }),
  }),

  // Analytics query validation
  analyticsQuery: Joi.object({
    startDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Start date must be in ISO format',
      }),
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .optional()
      .messages({
        'date.format': 'End date must be in ISO format',
        'date.min': 'End date must be after start date',
      }),
  }),

  // Patient activity query validation
  patientActivityQuery: Joi.object({
    params: Joi.object({
      patientUserId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid patient user ID format',
          'any.required': 'Patient user ID is required',
        }),
    }),
    query: Joi.object({
      startDate: Joi.date()
        .iso()
        .optional()
        .messages({
          'date.format': 'Start date must be in ISO format',
        }),
      endDate: Joi.date()
        .iso()
        .min(Joi.ref('startDate'))
        .optional()
        .messages({
          'date.format': 'End date must be in ISO format',
          'date.min': 'End date must be after start date',
        }),
    }),
  }),

  // Portal settings validation
  updatePortalSettings: Joi.object({
    isEnabled: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'isEnabled must be a boolean value',
      }),
    requireApproval: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'requireApproval must be a boolean value',
      }),
    allowedFeatures: Joi.object({
      messaging: Joi.boolean().optional(),
      appointments: Joi.boolean().optional(),
      medications: Joi.boolean().optional(),
      vitals: Joi.boolean().optional(),
      labResults: Joi.boolean().optional(),
      billing: Joi.boolean().optional(),
      educationalResources: Joi.boolean().optional(),
      healthRecords: Joi.boolean().optional(),
    })
      .optional()
      .messages({
        'object.base': 'allowedFeatures must be an object',
      }),
    customization: Joi.object({
      primaryColor: Joi.string()
        .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .optional()
        .messages({
          'string.pattern.base': 'Primary color must be a valid hex color',
        }),
      secondaryColor: Joi.string()
        .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .optional()
        .messages({
          'string.pattern.base': 'Secondary color must be a valid hex color',
        }),
      logo: Joi.string()
        .uri()
        .optional()
        .messages({
          'string.uri': 'Logo must be a valid URL',
        }),
      welcomeMessage: Joi.string()
        .max(500)
        .optional()
        .messages({
          'string.max': 'Welcome message cannot exceed 500 characters',
        }),
    })
      .optional(),
    appointmentSettings: Joi.object({
      allowBooking: Joi.boolean().optional(),
      advanceBookingDays: Joi.number().integer().min(1).max(365).optional(),
      cancellationHours: Joi.number().integer().min(1).max(168).optional(),
    })
      .optional(),
    messagingSettings: Joi.object({
      allowPatientInitiated: Joi.boolean().optional(),
      allowAttachments: Joi.boolean().optional(),
      maxAttachmentSize: Joi.number().integer().min(1).max(50).optional(),
    })
      .optional(),
  }),
};

/**
 * Generic validation middleware factory
 */
export const validateRequest = (schemaName: keyof typeof validationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = validationSchemas[schemaName];
      if (!schema) {
        logger.error('Validation schema not found', { schemaName });
        res.status(500).json({
          success: false,
          error: 'Internal validation error',
        });
        return;
      }

      // Validate the request
      const validationData: any = {};
      
      // Include params if schema has params validation
      if (schema.describe().keys.params) {
        validationData.params = req.params;
      }
      
      // Include body if schema has body validation
      if (schema.describe().keys.body) {
        validationData.body = req.body;
      }
      
      // Include query if schema has query validation
      if (schema.describe().keys.query) {
        validationData.query = req.query;
      }
      
      // If no specific parts, validate the whole request structure
      if (!schema.describe().keys.params && !schema.describe().keys.body && !schema.describe().keys.query) {
        validationData.query = req.query;
      }

      const { error, value } = schema.validate(validationData, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));

        logger.warn('Request validation failed', {
          schemaName,
          errors: errorDetails,
          path: req.path,
          method: req.method,
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        });
        return;
      }

      // Update request with validated and converted values
      if (value.params) {
        req.params = { ...req.params, ...value.params };
      }
      if (value.body) {
        req.body = value.body;
      }
      if (value.query) {
        req.query = { ...req.query, ...value.query };
      }

      next();
    } catch (error: any) {
      logger.error('Validation middleware error', {
        error: error.message,
        schemaName,
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }
  };
};

/**
 * Validate ObjectId parameters
 */
export const validateObjectIdParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName];
    
    if (!paramValue) {
      res.status(400).json({
        success: false,
        error: `${paramName} parameter is required`,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(paramValue)) {
      res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
      });
      return;
    }

    next();
  };
};

/**
 * Validate date range in query parameters
 */
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { startDate, endDate } = req.query;

  if (startDate && endDate) {
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO date format (YYYY-MM-DD)',
      });
      return;
    }

    if (start >= end) {
      res.status(400).json({
        success: false,
        error: 'Start date must be before end date',
      });
      return;
    }

    // Check if date range is not too large (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (end.getTime() - start.getTime() > maxRange) {
      res.status(400).json({
        success: false,
        error: 'Date range cannot exceed 1 year',
      });
      return;
    }
  }

  next();
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { page, limit } = req.query;

  if (page) {
    const pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 1000) {
      res.status(400).json({
        success: false,
        error: 'Page must be a number between 1 and 1000',
      });
      return;
    }
  }

  if (limit) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 100',
      });
      return;
    }
  }

  next();
};

export default {
  validateRequest,
  validateObjectIdParam,
  validateDateRange,
  validatePagination,
};