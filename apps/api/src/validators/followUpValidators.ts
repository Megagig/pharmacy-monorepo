import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

// Helper function to validate ObjectId
const isValidObjectId = (value: string) => {
    return mongoose.Types.ObjectId.isValid(value);
};

// Business rule validation interface
interface BusinessRuleValidation {
    field: string;
    rule: (value: any, req: Request) => Promise<boolean> | boolean;
    message: string;
    code?: string;
}

/**
 * Enhanced validation middleware with business rule support
 * Supports both new format and legacy format for backward compatibility
 */
export const validateRequest = (
    validations: ValidationChain[],
    businessRulesOrLocation?: BusinessRuleValidation[] | string,
    options: {
        logErrors?: boolean;
        includeStack?: boolean;
    } = {}
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
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

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                if (logErrors) {
                    console.error('Validation errors:', errors.array());
                }
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
                return;
            }

            // Run business rule validations
            if (businessRules.length > 0) {
                for (const rule of businessRules) {
                    const fieldValue = req.body[rule.field] || req.params[rule.field] || req.query[rule.field];
                    const isValid = await rule.rule(fieldValue, req);
                    
                    if (!isValid) {
                        if (logErrors) {
                            console.error(`Business rule validation failed for field: ${rule.field}`);
                        }
                        res.status(400).json({
                            success: false,
                            message: rule.message,
                            code: rule.code || 'BUSINESS_RULE_VIOLATION',
                        });
                        return;
                    }
                }
            }

            next();
        } catch (error) {
            if (logErrors) {
                console.error('Validation middleware error:', error);
            }
            res.status(500).json({
                success: false,
                message: 'Internal validation error',
                ...(includeStack && { stack: error instanceof Error ? error.stack : undefined }),
            });
        }
    };
};

// ===============================
// FOLLOW-UP TASK VALIDATION SCHEMAS
// ===============================

/**
 * Create Follow-up Task Validation
 * Requirements: 3.1, 3.2
 */
export const createFollowUpSchema: ValidationChain[] = [
    body('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),

    body('type')
        .isIn([
            'medication_start_followup',
            'lab_result_review',
            'hospital_discharge_followup',
            'medication_change_followup',
            'chronic_disease_monitoring',
            'adherence_check',
            'refill_reminder',
            'preventive_care',
            'general_followup'
        ])
        .withMessage('Invalid follow-up task type'),

    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 5, max: 200 })
        .withMessage('Title must be between 5 and 200 characters')
        .trim(),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters')
        .trim(),

    body('objectives')
        .optional()
        .isArray()
        .withMessage('Objectives must be an array'),

    body('objectives.*')
        .optional()
        .isString()
        .withMessage('Each objective must be a string')
        .isLength({ max: 200 })
        .withMessage('Each objective cannot exceed 200 characters')
        .trim(),

    body('priority')
        .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
        .withMessage('Invalid priority level'),

    body('dueDate')
        .notEmpty()
        .withMessage('Due date is required')
        .isISO8601()
        .withMessage('Due date must be a valid date')
        .custom((value) => {
            const dueDate = new Date(value);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            if (dueDate < now) {
                throw new Error('Due date cannot be in the past');
            }
            return true;
        }),

    body('estimatedDuration')
        .optional()
        .isInt({ min: 5, max: 480 })
        .withMessage('Estimated duration must be between 5 and 480 minutes'),

    body('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    body('trigger.type')
        .isIn([
            'manual',
            'medication_start',
            'lab_result',
            'hospital_discharge',
            'medication_change',
            'scheduled_monitoring',
            'missed_appointment',
            'system_rule'
        ])
        .withMessage('Invalid trigger type'),

    body('trigger.sourceId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid source ID format'),

    body('trigger.sourceType')
        .optional()
        .isString()
        .withMessage('Source type must be a string'),

    body('trigger.triggerDate')
        .optional()
        .isISO8601()
        .withMessage('Trigger date must be a valid date'),

    body('trigger.triggerDetails')
        .optional()
        .isObject()
        .withMessage('Trigger details must be an object'),

    body('relatedRecords.medicationId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid medication ID format'),

    body('relatedRecords.labResultId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid lab result ID format'),

    body('relatedRecords.clinicalInterventionId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid clinical intervention ID format'),

    body('relatedRecords.mtrSessionId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid MTR session ID format'),

    body('relatedRecords.appointmentId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid appointment ID format'),
];

/**
 * Update Follow-up Task Validation
 * Requirements: 3.2
 */
export const updateFollowUpSchema: ValidationChain[] = [
    body('title')
        .optional()
        .isLength({ min: 5, max: 200 })
        .withMessage('Title must be between 5 and 200 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters')
        .trim(),

    body('objectives')
        .optional()
        .isArray()
        .withMessage('Objectives must be an array'),

    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
        .withMessage('Invalid priority level'),

    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid date'),

    body('estimatedDuration')
        .optional()
        .isInt({ min: 5, max: 480 })
        .withMessage('Estimated duration must be between 5 and 480 minutes'),

    body('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'converted_to_appointment'])
        .withMessage('Invalid status'),
];

/**
 * Complete Follow-up Task Validation
 * Requirements: 3.3
 */
export const completeFollowUpSchema: ValidationChain[] = [
    body('outcome.status')
        .isIn(['successful', 'partially_successful', 'unsuccessful'])
        .withMessage('Invalid outcome status'),

    body('outcome.notes')
        .notEmpty()
        .withMessage('Outcome notes are required')
        .isLength({ max: 2000 })
        .withMessage('Outcome notes cannot exceed 2000 characters')
        .trim(),

    body('outcome.nextActions')
        .optional()
        .isArray()
        .withMessage('Next actions must be an array'),

    body('outcome.nextActions.*')
        .optional()
        .isString()
        .withMessage('Each next action must be a string')
        .isLength({ max: 200 })
        .withMessage('Each next action cannot exceed 200 characters')
        .trim(),

    body('outcome.appointmentCreated')
        .optional()
        .isBoolean()
        .withMessage('appointmentCreated must be a boolean'),

    body('outcome.appointmentId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid appointment ID format'),
];

/**
 * Convert Follow-up to Appointment Validation
 * Requirements: 3.4
 */
export const convertToAppointmentSchema: ValidationChain[] = [
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
];

/**
 * Escalate Follow-up Priority Validation
 * Requirements: 3.5, 3.6
 */
export const escalateFollowUpSchema: ValidationChain[] = [
    body('newPriority')
        .isIn(['high', 'urgent', 'critical'])
        .withMessage('New priority must be high, urgent, or critical'),

    body('reason')
        .notEmpty()
        .withMessage('Escalation reason is required')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters')
        .trim(),
];

// ===============================
// PARAMETER VALIDATION
// ===============================

export const followUpParamsSchema: ValidationChain[] = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid follow-up task ID format'),
];

export const patientParamsSchema: ValidationChain[] = [
    param('patientId')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),
];

// ===============================
// QUERY VALIDATION
// ===============================

export const followUpQuerySchema: ValidationChain[] = [
    query('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'converted_to_appointment'])
        .withMessage('Invalid status'),

    query('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
        .withMessage('Invalid priority'),

    query('type')
        .optional()
        .isIn([
            'medication_start_followup',
            'lab_result_review',
            'hospital_discharge_followup',
            'medication_change_followup',
            'chronic_disease_monitoring',
            'adherence_check',
            'refill_reminder',
            'preventive_care',
            'general_followup'
        ])
        .withMessage('Invalid follow-up task type'),

    query('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('patientId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),

    query('dueDateFrom')
        .optional()
        .isISO8601()
        .withMessage('Due date from must be a valid date'),

    query('dueDateTo')
        .optional()
        .isISO8601()
        .withMessage('Due date to must be a valid date'),

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('sortBy')
        .optional()
        .isIn(['dueDate', 'priority', 'createdAt', 'status'])
        .withMessage('Invalid sort field'),

    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc'),
];

export const overdueFollowUpsQuerySchema: ValidationChain[] = [
    query('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
        .withMessage('Invalid priority'),
];

// ===============================
// BUSINESS RULE VALIDATIONS
// ===============================

/**
 * Business rules for follow-up task creation
 */
export const followUpBusinessRules: BusinessRuleValidation[] = [
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
        field: 'dueDate',
        rule: (dueDate: string, req: Request) => {
            if (!dueDate) return true;

            const priority = req.body.priority;
            const dueDateObj = new Date(dueDate);
            const now = new Date();

            // Critical and urgent tasks should be due within 7 days
            if (priority === 'critical' || priority === 'urgent') {
                const maxDueDate = new Date(now);
                maxDueDate.setDate(maxDueDate.getDate() + 7);
                return dueDateObj <= maxDueDate;
            }

            return true;
        },
        message: 'Critical and urgent tasks must be due within 7 days',
        code: 'INVALID_DUE_DATE_FOR_PRIORITY'
    }
];

/**
 * Business rules for follow-up task completion
 */
export const completeFollowUpBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'outcome.appointmentId',
        rule: async (appointmentId: string, req: Request) => {
            if (!appointmentId) return true; // Optional field

            // Check if appointment exists
            const Appointment = require('../models/Appointment');
            const appointment = await Appointment.findOne({
                _id: appointmentId,
                workplaceId: (req as any).user?.workplaceId,
                isDeleted: false
            });

            return !!appointment;
        },
        message: 'Appointment not found',
        code: 'APPOINTMENT_NOT_FOUND'
    }
];
