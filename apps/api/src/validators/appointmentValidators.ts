import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError, FieldValidationError } from 'express-validator';
import mongoose from 'mongoose';
import logger from '../utils/logger';

// Helper function to validate ObjectId
const isValidObjectId = (value: string) => {
    return mongoose.Types.ObjectId.isValid(value);
};

// Enhanced validation error interface
interface ValidationErrorDetail {
    field: string;
    message: string;
    value?: any;
    code?: string;
    location?: 'body' | 'params' | 'query' | 'headers';
}

// Business rule validation interface
interface BusinessRuleValidation {
    field: string;
    rule: (value: any, req: Request) => Promise<boolean> | boolean;
    message: string;
    code?: string;
}

// ===============================
// VALIDATION MIDDLEWARE
// ===============================

/**
 * Enhanced validation middleware with business rule support
 */
export const validateRequest = (
    validations: ValidationChain[],
    businessRulesOrLocation?: BusinessRuleValidation[] | string,
    options: {
        logErrors?: boolean;
        includeStack?: boolean;
    } = {}
) => {
    // Handle legacy format where second parameter is location string
    let businessRules: BusinessRuleValidation[] = [];
    if (typeof businessRulesOrLocation === 'string') {
        // Legacy format - ignore location parameter for now
        businessRules = [];
    } else if (Array.isArray(businessRulesOrLocation)) {
        businessRules = businessRulesOrLocation;
    }
    
    const { logErrors = true, includeStack = false } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Run express-validator validations
            await Promise.all(validations.map(validation => validation.run(req)));

            const validationErrors = validationResult(req);
            const errors: ValidationErrorDetail[] = [];

            // Process express-validator errors
            if (!validationErrors.isEmpty()) {
                errors.push(...validationErrors.array().map((error: ExpressValidationError) => {
                    const fieldError = error as FieldValidationError;
                    const location = fieldError.location;
                    return {
                        field: fieldError.path || (error as any).param || 'unknown',
                        message: fieldError.msg || 'Validation failed',
                        value: fieldError.value,
                        code: 'VALIDATION_ERROR',
                        location: (location === 'cookies') ? 'body' : location
                    };
                }));
            }

            // Run business rule validations
            for (const rule of businessRules) {
                try {
                    const fieldValue = getFieldValue(req, rule.field);
                    const isValid = await rule.rule(fieldValue, req);

                    if (!isValid) {
                        errors.push({
                            field: rule.field,
                            message: rule.message,
                            value: fieldValue,
                            code: rule.code || 'BUSINESS_RULE_ERROR',
                            location: 'body'
                        });
                    }
                } catch (ruleError) {
                    if (logErrors) {
                        logger.error('Business rule validation error', {
                            field: rule.field,
                            error: ruleError,
                            userId: (req as any).user?.id,
                            endpoint: req.originalUrl
                        });
                    }

                    errors.push({
                        field: rule.field,
                        message: 'Business rule validation failed',
                        code: 'BUSINESS_RULE_EXECUTION_ERROR',
                        location: 'body'
                    });
                }
            }

            // If there are validation errors, return detailed response
            if (errors.length > 0) {
                if (logErrors) {
                    logger.warn('Validation failed', {
                        errors,
                        userId: (req as any).user?.id,
                        endpoint: req.originalUrl,
                        method: req.method
                    });
                }

                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    errors,
                    timestamp: new Date().toISOString(),
                    ...(includeStack && process.env.NODE_ENV === 'development' && {
                        requestId: req.headers['x-request-id'] || 'unknown'
                    })
                });
                return;
            }

            next();
        } catch (error) {
            if (logErrors) {
                logger.error('Validation middleware error', {
                    error,
                    userId: (req as any).user?.id,
                    endpoint: req.originalUrl,
                    method: req.method
                });
            }

            res.status(500).json({
                success: false,
                message: 'Internal validation error',
                code: 'VALIDATION_MIDDLEWARE_ERROR',
                timestamp: new Date().toISOString()
            });
            return;
        }
    };
};

// Get field value from request
const getFieldValue = (req: Request, fieldPath: string): any => {
    const parts = fieldPath.split('.');
    let value: any = req.body;

    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return undefined;
        }
    }

    return value;
};

// ===============================
// APPOINTMENT VALIDATION SCHEMAS
// ===============================

/**
 * Create Appointment Validation
 * Requirements: 1.1, 1.2
 */
export const createAppointmentSchema: ValidationChain[] = [
    body('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),

    body('type')
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

    body('scheduledDate')
        .notEmpty()
        .withMessage('Scheduled date is required')
        .isISO8601()
        .withMessage('Scheduled date must be a valid date')
        .custom((value) => {
            const scheduledDate = new Date(value);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            if (scheduledDate < now) {
                throw new Error('Scheduled date cannot be in the past');
            }
            return true;
        }),

    body('scheduledTime')
        .notEmpty()
        .withMessage('Scheduled time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Scheduled time must be in HH:mm format'),

    body('duration')
        .isInt({ min: 5, max: 120 })
        .withMessage('Duration must be between 5 and 120 minutes'),

    body('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    body('title')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Title cannot exceed 200 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters')
        .trim(),

    body('timezone')
        .optional()
        .isString()
        .withMessage('Timezone must be a string'),

    body('isRecurring')
        .optional()
        .isBoolean()
        .withMessage('isRecurring must be a boolean'),

    body('recurrencePattern.frequency')
        .if(body('isRecurring').equals('true'))
        .isIn(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'])
        .withMessage('Invalid recurrence frequency'),

    body('recurrencePattern.interval')
        .if(body('isRecurring').equals('true'))
        .isInt({ min: 1, max: 12 })
        .withMessage('Recurrence interval must be between 1 and 12'),

    body('recurrencePattern.endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),

    body('recurrencePattern.endAfterOccurrences')
        .optional()
        .isInt({ min: 1, max: 52 })
        .withMessage('End after occurrences must be between 1 and 52'),

    body('patientPreferences.preferredChannel')
        .optional()
        .isIn(['email', 'sms', 'whatsapp', 'phone'])
        .withMessage('Invalid preferred channel'),

    body('patientPreferences.language')
        .optional()
        .isString()
        .withMessage('Language must be a string'),

    body('patientPreferences.specialRequirements')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Special requirements cannot exceed 500 characters')
        .trim(),
];

/**
 * Update Appointment Validation
 * Requirements: 1.4
 */
export const updateAppointmentSchema: ValidationChain[] = [
    body('scheduledDate')
        .optional()
        .isISO8601()
        .withMessage('Scheduled date must be a valid date'),

    body('scheduledTime')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Scheduled time must be in HH:mm format'),

    body('duration')
        .optional()
        .isInt({ min: 5, max: 120 })
        .withMessage('Duration must be between 5 and 120 minutes'),

    body('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    body('title')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Title cannot exceed 200 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters')
        .trim(),

    body('updateType')
        .optional()
        .isIn(['this_only', 'this_and_future'])
        .withMessage('Update type must be this_only or this_and_future'),
];

/**
 * Update Appointment Status Validation
 * Requirements: 1.4
 */
export const updateAppointmentStatusSchema: ValidationChain[] = [
    body('status')
        .isIn(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
        .withMessage('Invalid appointment status'),

    body('reason')
        .if(body('status').equals('cancelled'))
        .notEmpty()
        .withMessage('Cancellation reason is required')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
        .trim(),

    body('outcome.status')
        .if(body('status').equals('completed'))
        .isIn(['successful', 'partially_successful', 'unsuccessful'])
        .withMessage('Invalid outcome status'),

    body('outcome.notes')
        .if(body('status').equals('completed'))
        .notEmpty()
        .withMessage('Outcome notes are required for completed appointments')
        .isLength({ max: 2000 })
        .withMessage('Outcome notes cannot exceed 2000 characters')
        .trim(),

    body('outcome.nextActions')
        .optional()
        .isArray()
        .withMessage('Next actions must be an array'),

    body('outcome.visitCreated')
        .optional()
        .isBoolean()
        .withMessage('visitCreated must be a boolean'),

    body('outcome.visitId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid visit ID format'),
];

/**
 * Reschedule Appointment Validation
 * Requirements: 1.4, 1.7
 */
export const rescheduleAppointmentSchema: ValidationChain[] = [
    body('newDate')
        .notEmpty()
        .withMessage('New date is required')
        .isISO8601()
        .withMessage('New date must be a valid date')
        .custom((value) => {
            const newDate = new Date(value);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            if (newDate < now) {
                throw new Error('New date cannot be in the past');
            }
            return true;
        }),

    body('newTime')
        .notEmpty()
        .withMessage('New time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('New time must be in HH:mm format'),

    body('reason')
        .notEmpty()
        .withMessage('Rescheduling reason is required')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
        .trim(),

    body('notifyPatient')
        .optional()
        .isBoolean()
        .withMessage('notifyPatient must be a boolean'),
];

/**
 * Cancel Appointment Validation
 * Requirements: 1.4
 */
export const cancelAppointmentSchema: ValidationChain[] = [
    body('reason')
        .notEmpty()
        .withMessage('Cancellation reason is required')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
        .trim(),

    body('notifyPatient')
        .optional()
        .isBoolean()
        .withMessage('notifyPatient must be a boolean'),

    body('cancelType')
        .optional()
        .isIn(['this_only', 'all_future'])
        .withMessage('Cancel type must be this_only or all_future'),
];

/**
 * Confirm Appointment Validation
 */
export const confirmAppointmentSchema: ValidationChain[] = [
    body('confirmationToken')
        .optional()
        .isString()
        .withMessage('Confirmation token must be a string'),
];

// ===============================
// PARAMETER VALIDATION
// ===============================

export const appointmentParamsSchema: ValidationChain[] = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid appointment ID format'),
];

export const patientParamsSchema: ValidationChain[] = [
    param('patientId')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),
];

// ===============================
// QUERY VALIDATION
// ===============================

export const appointmentQuerySchema: ValidationChain[] = [
    query('view')
        .optional()
        .isIn(['day', 'week', 'month'])
        .withMessage('View must be day, week, or month'),

    query('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid date'),

    query('pharmacistId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('locationId')
        .optional()
        .isString()
        .withMessage('Location ID must be a string'),

    query('status')
        .optional()
        .isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'])
        .withMessage('Invalid status'),

    query('type')
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

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
];

export const availableSlotsQuerySchema: ValidationChain[] = [
    query('date')
        .notEmpty()
        .withMessage('Date is required')
        .isISO8601()
        .withMessage('Date must be a valid date'),

    query('pharmacistId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('duration')
        .optional()
        .isInt({ min: 5, max: 120 })
        .withMessage('Duration must be between 5 and 120 minutes'),

    query('type')
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
];

export const upcomingAppointmentsQuerySchema: ValidationChain[] = [
    query('days')
        .optional()
        .isInt({ min: 1, max: 90 })
        .withMessage('Days must be between 1 and 90'),

    query('pharmacistId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),
];

// ===============================
// BUSINESS RULE VALIDATIONS
// ===============================

/**
 * Business rules for appointment creation
 */
export const appointmentBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'patientId',
        rule: async (patientId: string, req: Request) => {
            if (!patientId) return false;

            // Check if patient exists and belongs to the same workplace
            const Patient = require('../models/Patient');
            const patient = await Patient.findOne({
                _id: patientId,
                workplaceId: (req as any).user?.workplaceId,
                isDeleted: false
            });

            return !!patient;
        },
        message: 'Patient not found or does not belong to your workplace',
        code: 'PATIENT_NOT_FOUND'
    },
    {
        field: 'assignedTo',
        rule: async (assignedTo: string, req: Request) => {
            if (!assignedTo) return true; // Optional field

            // Check if pharmacist exists and belongs to the same workplace
            const User = require('../models/User');
            const pharmacist = await User.findOne({
                _id: assignedTo,
                workplaceId: (req as any).user?.workplaceId,
                isDeleted: false
            });

            return !!pharmacist;
        },
        message: 'Pharmacist not found or does not belong to your workplace',
        code: 'PHARMACIST_NOT_FOUND'
    },
    {
        field: 'scheduledDate',
        rule: (scheduledDate: string, req: Request) => {
            const scheduledTime = req.body.scheduledTime;
            if (!scheduledDate || !scheduledTime) return true;

            // Check if appointment is during working hours (8 AM - 6 PM)
            const [hours] = scheduledTime.split(':').map(Number);
            return hours >= 8 && hours < 18;
        },
        message: 'Appointments must be scheduled during working hours (8 AM - 6 PM)',
        code: 'OUTSIDE_WORKING_HOURS'
    }
];

/**
 * Business rules for appointment rescheduling
 */
export const rescheduleBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'newDate',
        rule: (newDate: string, req: Request) => {
            const newTime = req.body.newTime;
            if (!newDate || !newTime) return true;

            // Check if new time is during working hours
            const [hours] = newTime.split(':').map(Number);
            return hours >= 8 && hours < 18;
        },
        message: 'Appointments must be scheduled during working hours (8 AM - 6 PM)',
        code: 'OUTSIDE_WORKING_HOURS'
    }
];
