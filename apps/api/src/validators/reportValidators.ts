import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/responseHelpers';
import mongoose from 'mongoose';

/**
 * Validation middleware to handle validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return sendError(res, 'VALIDATION_ERROR', `Validation error: ${errorMessages.join(', ')}`, 400);
  }
  next();
};

/**
 * Custom validator for MongoDB ObjectId
 */
const isValidObjectId = (value: string) => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * Custom validator for date format
 */
const isValidDate = (value: string) => {
  const date = new Date(value);
  return !isNaN(date.getTime());
};

/**
 * Custom validator for email array
 */
const isValidEmailArray = (emails: string[]) => {
  if (!Array.isArray(emails) || emails.length === 0) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emails.every(email => emailRegex.test(email));
};

/**
 * Validate report generation request
 */
export const validateReportGeneration = [
  body('startDate')
    .optional()
    .custom(isValidDate)
    .withMessage('Start date must be a valid date'),
    
  body('endDate')
    .optional()
    .custom(isValidDate)
    .withMessage('End date must be a valid date'),
    
  body('pharmacistId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Pharmacist ID must be a valid MongoDB ObjectId'),
    
  body('locationId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location ID must be a string between 1 and 100 characters'),
    
  body('appointmentType')
    .optional()
    .isIn([
      'mtm_session',
      'chronic_disease_review',
      'new_medication_consultation',
      'vaccination',
      'health_check',
      'smoking_cessation',
      'general_followup'
    ])
    .withMessage('Invalid appointment type'),
    
  body('format')
    .optional()
    .isIn(['pdf', 'excel', 'csv'])
    .withMessage('Format must be one of: pdf, excel, csv'),
    
  body('includeCharts')
    .optional()
    .isBoolean()
    .withMessage('Include charts must be a boolean'),
    
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
    
  // Custom validation for date range
  body('startDate').custom((startDate, { req }) => {
    if (startDate && req.body.endDate) {
      const start = new Date(startDate);
      const end = new Date(req.body.endDate);
      
      if (start > end) {
        throw new Error('Start date cannot be after end date');
      }
      
      // Limit date range to 1 year
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > oneYearMs) {
        throw new Error('Date range cannot exceed 1 year');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate email report request
 */
export const validateEmailReport = [
  body('reportType')
    .notEmpty()
    .isIn(['appointment', 'followup', 'reminder', 'capacity'])
    .withMessage('Report type must be one of: appointment, followup, reminder, capacity'),
    
  body('recipientEmails')
    .notEmpty()
    .custom(isValidEmailArray)
    .withMessage('Recipient emails must be a non-empty array of valid email addresses'),
    
  body('recipientEmails')
    .custom((emails) => {
      if (emails.length > 10) {
        throw new Error('Maximum 10 recipient emails allowed');
      }
      return true;
    }),
    
  body('startDate')
    .optional()
    .custom(isValidDate)
    .withMessage('Start date must be a valid date'),
    
  body('endDate')
    .optional()
    .custom(isValidDate)
    .withMessage('End date must be a valid date'),
    
  body('pharmacistId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Pharmacist ID must be a valid MongoDB ObjectId'),
    
  body('locationId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location ID must be a string between 1 and 100 characters'),
    
  body('appointmentType')
    .optional()
    .isIn([
      'mtm_session',
      'chronic_disease_review',
      'new_medication_consultation',
      'vaccination',
      'health_check',
      'smoking_cessation',
      'general_followup'
    ])
    .withMessage('Invalid appointment type'),
    
  body('format')
    .optional()
    .isIn(['pdf', 'excel', 'csv'])
    .withMessage('Format must be one of: pdf, excel, csv'),
    
  body('includeCharts')
    .optional()
    .isBoolean()
    .withMessage('Include charts must be a boolean'),
    
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
    
  body('subject')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be a string between 1 and 200 characters'),
    
  body('message')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be a string between 1 and 1000 characters'),
    
  // Custom validation for date range
  body('startDate').custom((startDate, { req }) => {
    if (startDate && req.body.endDate) {
      const start = new Date(startDate);
      const end = new Date(req.body.endDate);
      
      if (start > end) {
        throw new Error('Start date cannot be after end date');
      }
      
      // Limit date range to 1 year
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > oneYearMs) {
        throw new Error('Date range cannot exceed 1 year');
      }
    }
    return true;
  }),
  
  handleValidationErrors
];

/**
 * Validate schedule recurring report request
 */
export const validateScheduleReport = [
  body('reportType')
    .notEmpty()
    .isIn(['appointment', 'followup', 'reminder', 'capacity'])
    .withMessage('Report type must be one of: appointment, followup, reminder, capacity'),
    
  body('recipientEmails')
    .notEmpty()
    .custom(isValidEmailArray)
    .withMessage('Recipient emails must be a non-empty array of valid email addresses'),
    
  body('recipientEmails')
    .custom((emails) => {
      if (emails.length > 10) {
        throw new Error('Maximum 10 recipient emails allowed');
      }
      return true;
    }),
    
  body('schedule')
    .notEmpty()
    .isObject()
    .withMessage('Schedule configuration is required'),
    
  body('schedule.frequency')
    .notEmpty()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Schedule frequency must be one of: daily, weekly, monthly'),
    
  body('schedule.time')
    .notEmpty()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Schedule time must be in HH:mm format (24-hour)'),
    
  body('schedule.dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be an integer between 0 (Sunday) and 6 (Saturday)'),
    
  body('schedule.dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Day of month must be an integer between 1 and 31'),
    
  // Custom validation for schedule configuration
  body('schedule').custom((schedule) => {
    if (schedule.frequency === 'weekly' && !schedule.dayOfWeek) {
      throw new Error('Day of week is required for weekly frequency');
    }
    
    if (schedule.frequency === 'monthly' && !schedule.dayOfMonth) {
      throw new Error('Day of month is required for monthly frequency');
    }
    
    return true;
  }),
    
  body('pharmacistId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Pharmacist ID must be a valid MongoDB ObjectId'),
    
  body('locationId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location ID must be a string between 1 and 100 characters'),
    
  body('appointmentType')
    .optional()
    .isIn([
      'mtm_session',
      'chronic_disease_review',
      'new_medication_consultation',
      'vaccination',
      'health_check',
      'smoking_cessation',
      'general_followup'
    ])
    .withMessage('Invalid appointment type'),
    
  body('format')
    .optional()
    .isIn(['pdf', 'excel', 'csv'])
    .withMessage('Format must be one of: pdf, excel, csv'),
    
  body('includeCharts')
    .optional()
    .isBoolean()
    .withMessage('Include charts must be a boolean'),
    
  body('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean'),
    
  handleValidationErrors
];

/**
 * Validate test email request
 */
export const validateTestEmail = [
  body('testEmail')
    .notEmpty()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid test email address is required'),
    
  handleValidationErrors
];