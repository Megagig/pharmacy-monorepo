import { body, param, query, validationResult } from 'express-validator';
import { isValidObjectId } from 'mongoose';
import { Request, Response, NextFunction } from 'express';

// Helper function for validation middleware
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

// Common validation middleware
export const validateObjectId = (paramName: string) =>
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid MongoDB ID`);

// MedicationManagement validation schemas
export const createMedicationSchema = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Patient ID must be a valid MongoDB ID'),
  body('name')
    .notEmpty()
    .withMessage('Medication name is required')
    .isString()
    .withMessage('Medication name must be a string')
    .trim(),
  body('dosage')
    .notEmpty()
    .withMessage('Dosage is required')
    .isString()
    .withMessage('Dosage must be a string')
    .trim(),
  body('frequency')
    .notEmpty()
    .withMessage('Frequency is required')
    .isString()
    .withMessage('Frequency must be a string')
    .trim(),
  body('route')
    .notEmpty()
    .withMessage('Route is required')
    .isString()
    .withMessage('Route must be a string')
    .trim(),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      if (
        req.body.startDate &&
        endDate &&
        new Date(endDate) < new Date(req.body.startDate)
      ) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('indication')
    .optional()
    .isString()
    .withMessage('Indication must be a string')
    .trim(),
  body('prescriber')
    .optional()
    .isString()
    .withMessage('Prescriber must be a string')
    .trim(),
  body('allergyCheck.status')
    .optional()
    .isBoolean()
    .withMessage('Allergy check status must be a boolean'),
  body('allergyCheck.details')
    .optional()
    .isString()
    .withMessage('Allergy check details must be a string')
    .trim(),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'cancelled'])
    .withMessage('Status must be either active, archived, or cancelled'),
  validateRequest,
];

export const updateMedicationSchema = [
  validateObjectId('id'),
  body('name')
    .optional()
    .isString()
    .withMessage('Medication name must be a string')
    .trim(),
  body('dosage')
    .optional()
    .isString()
    .withMessage('Dosage must be a string')
    .trim(),
  body('frequency')
    .optional()
    .isString()
    .withMessage('Frequency must be a string')
    .trim(),
  body('route')
    .optional()
    .isString()
    .withMessage('Route must be a string')
    .trim(),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      if (
        req.body.startDate &&
        endDate &&
        new Date(endDate) < new Date(req.body.startDate)
      ) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('indication')
    .optional()
    .isString()
    .withMessage('Indication must be a string')
    .trim(),
  body('prescriber')
    .optional()
    .isString()
    .withMessage('Prescriber must be a string')
    .trim(),
  body('allergyCheck.status')
    .optional()
    .isBoolean()
    .withMessage('Allergy check status must be a boolean'),
  body('allergyCheck.details')
    .optional()
    .isString()
    .withMessage('Allergy check details must be a string')
    .trim(),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'cancelled'])
    .withMessage('Status must be either active, archived, or cancelled'),
  validateRequest,
];

// AdherenceLog validation schemas
export const createAdherenceLogSchema = [
  body('medicationId')
    .notEmpty()
    .withMessage('Medication ID is required')
    .isMongoId()
    .withMessage('Medication ID must be a valid MongoDB ID'),
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Patient ID must be a valid MongoDB ID'),
  body('refillDate')
    .optional()
    .isISO8601()
    .withMessage('Refill date must be a valid date'),
  body('adherenceScore')
    .notEmpty()
    .withMessage('Adherence score is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Adherence score must be a number between 0 and 100'),
  body('pillCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Pill count must be a non-negative integer'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .trim(),
  validateRequest,
];

// Drug interaction check validation schema
export const checkInteractionsSchema = [
  body('medications')
    .isArray({ min: 1 })
    .withMessage('At least one medication is required'),
  body('medications.*.name')
    .notEmpty()
    .withMessage('Medication name is required')
    .isString()
    .withMessage('Medication name must be a string'),
  body('medications.*.rxcui')
    .optional()
    .isString()
    .withMessage('RxCUI must be a string'),
  validateRequest,
];

// Query validation schemas for fetching medications
export const getMedicationsByPatientSchema = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Patient ID must be a valid MongoDB ID'),
  query('status')
    .optional()
    .isIn(['active', 'archived', 'cancelled', 'all'])
    .withMessage('Status must be either active, archived, cancelled, or all'),
  validateRequest,
];

// Query validation schemas for fetching adherence logs
export const getAdherenceByPatientSchema = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Patient ID must be a valid MongoDB ID'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  validateRequest,
];

// Helper to check if the medication exists
export const medicationExistsValidator = param('id')
  .custom(async (value) => {
    if (!isValidObjectId(value)) {
      throw new Error('Invalid medication ID format');
    }
    return true;
  })
  .withMessage('Medication not found');
// Medication Settings validation schemas
export const updateMedicationSettingsSchema = [
  param('patientId')
    .custom((value) => {
      // Allow "system" as a special case for system-wide settings
      if (value === 'system') {
        return true;
      }
      // Otherwise, validate as MongoDB ObjectId
      if (!isValidObjectId(value)) {
        throw new Error('Patient ID must be a valid MongoDB ID or "system"');
      }
      return true;
    })
    .withMessage('Patient ID must be a valid MongoDB ID or "system"'),
  body('reminderSettings')
    .optional()
    .isObject()
    .withMessage('Reminder settings must be an object'),
  body('reminderSettings.enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
  body('reminderSettings.defaultReminderTimes')
    .optional()
    .isArray()
    .withMessage('Default reminder times must be an array'),
  body('reminderSettings.reminderMethod')
    .optional()
    .isIn(['email', 'sms', 'both'])
    .withMessage('Reminder method must be email, sms, or both'),
  body('reminderSettings.defaultNotificationLeadTime')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Lead time must be between 0 and 120 minutes'),
  body('monitoringSettings')
    .optional()
    .isObject()
    .withMessage('Monitoring settings must be an object'),
  body('monitoringSettings.adherenceMonitoring')
    .optional()
    .isBoolean()
    .withMessage('Adherence monitoring must be a boolean'),
  body('monitoringSettings.refillReminders')
    .optional()
    .isBoolean()
    .withMessage('Refill reminders must be a boolean'),
  body('monitoringSettings.interactionChecking')
    .optional()
    .isBoolean()
    .withMessage('Interaction checking must be a boolean'),
  body('monitoringSettings.refillThreshold')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Refill threshold must be between 0 and 50 percent'),
  body('monitoringSettings.reportFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Report frequency must be daily, weekly, or monthly'),
];

export const getMedicationSettingsSchema = [
  param('patientId')
    .custom((value) => {
      // Allow "system" as a special case for system-wide settings
      if (value === 'system') {
        return true;
      }
      // Otherwise, validate as MongoDB ObjectId
      if (!isValidObjectId(value)) {
        throw new Error('Patient ID must be a valid MongoDB ID or "system"');
      }
      return true;
    })
    .withMessage('Patient ID must be a valid MongoDB ID or "system"'),
];