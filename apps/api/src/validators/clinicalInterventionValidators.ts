import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError, FieldValidationError } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import mongoose from 'mongoose';
import logger from '../utils/logger';

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

// Data sanitization utilities
export const sanitizeInput = {
    text: (input: string): string => {
        if (typeof input !== 'string') return '';
        return DOMPurify.sanitize(input.trim(), {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });
    },

    html: (input: string): string => {
        if (typeof input !== 'string') return '';
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
            ALLOWED_ATTR: []
        });
    },

    mongoId: (input: string): string => {
        if (typeof input !== 'string') return '';
        const sanitized = input.trim();
        return mongoose.Types.ObjectId.isValid(sanitized) ? sanitized : '';
    },

    number: (input: any): number | null => {
        const num = Number(input);
        return isNaN(num) ? null : num;
    },

    boolean: (input: any): boolean => {
        if (typeof input === 'boolean') return input;
        if (typeof input === 'string') {
            return input.toLowerCase() === 'true';
        }
        return Boolean(input);
    }
};

// Enhanced validation error handler with detailed error reporting
export const validateRequest = (
    validations: ValidationChain[],
    businessRules: BusinessRuleValidation[] = [],
    options: {
        sanitize?: boolean;
        logErrors?: boolean;
        includeStack?: boolean;
    } = {}
) => {
    const { sanitize = true, logErrors = true, includeStack = false } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Sanitize input data if enabled
            if (sanitize) {
                sanitizeRequestData(req);
            }

            // Run express-validator validations
            await Promise.all(validations.map(validation => validation.run(req)));

            const validationErrors = validationResult(req);
            const errors: ValidationErrorDetail[] = [];

            // Process express-validator errors
            if (!validationErrors.isEmpty()) {
                errors.push(...validationErrors.array().map((error: ValidationError) => {
                    // Handle both FieldValidationError and AlternativeValidationError
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
                        method: req.method,
                        body: sanitize ? '[SANITIZED]' : req.body
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

// Sanitize request data
const sanitizeRequestData = (req: Request): void => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }

    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
};

// Recursively sanitize object properties
const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeInput.text(value);
            } else {
                sanitized[key] = sanitizeObject(value);
            }
        }
        return sanitized;
    }

    if (typeof obj === 'string') {
        return sanitizeInput.text(obj);
    }

    return obj;
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
// BUSINESS RULE VALIDATIONS
// ===============================

// Business rules for intervention creation
export const interventionBusinessRules: BusinessRuleValidation[] = [
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
        field: 'category',
        rule: (category: string) => {
            const validCategories = [
                'drug_therapy_problem',
                'adverse_drug_reaction',
                'medication_nonadherence',
                'drug_interaction',
                'dosing_issue',
                'contraindication',
                'other'
            ];
            return validCategories.includes(category);
        },
        message: 'Invalid intervention category',
        code: 'INVALID_CATEGORY'
    },
    {
        field: 'strategies',
        rule: (strategies: any[]) => {
            if (!Array.isArray(strategies)) return true; // Optional field

            // Check for duplicate strategy types
            const types = strategies.map(s => s.type);
            const uniqueTypes = new Set(types);

            return types.length === uniqueTypes.size;
        },
        message: 'Duplicate strategy types are not allowed',
        code: 'DUPLICATE_STRATEGIES'
    }
];

// Business rules for strategy validation
export const strategyBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'type',
        rule: (type: string, req: Request) => {
            // Custom strategies require additional validation
            if (type === 'custom') {
                const description = req.body.description;
                const rationale = req.body.rationale;

                return description && description.length >= 20 &&
                    rationale && rationale.length >= 20;
            }
            return true;
        },
        message: 'Custom strategies require detailed description and rationale (minimum 20 characters each)',
        code: 'CUSTOM_STRATEGY_INSUFFICIENT_DETAIL'
    }
];

// Business rules for team assignment
export const assignmentBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'userId',
        rule: async (userId: string, req: Request) => {
            if (!userId) return false;

            // Check if user exists and belongs to the same workplace
            const User = require('../models/User');
            const user = await User.findOne({
                _id: userId,
                workplaceId: (req as any).user?.workplaceId,
                isDeleted: false
            });

            return !!user;
        },
        message: 'User not found or does not belong to your workplace',
        code: 'USER_NOT_FOUND'
    },
    {
        field: 'role',
        rule: async (role: string, req: Request) => {
            const userId = req.body.userId;
            if (!userId || !role) return false;

            // Validate role assignment based on user permissions
            const User = require('../models/User');
            const user = await User.findById(userId);

            if (!user) return false;

            // Pharmacists can assign any role
            if ((req as any).user?.role === 'Pharmacist') return true;

            // Other roles have restrictions
            const allowedRoles = ['patient', 'caregiver'];
            return allowedRoles.includes(role);
        },
        message: 'Insufficient permissions to assign this role',
        code: 'ROLE_ASSIGNMENT_DENIED'
    }
];

// Business rules for outcome recording
export const outcomeBusinessRules: BusinessRuleValidation[] = [
    {
        field: 'clinicalParameters',
        rule: (parameters: any[]) => {
            if (!Array.isArray(parameters)) return true; // Optional field

            // Validate parameter improvements
            return parameters.every(param => {
                if (param.beforeValue && param.afterValue) {
                    // Both values should be numeric for improvement calculation
                    const before = parseFloat(param.beforeValue);
                    const after = parseFloat(param.afterValue);

                    if (!isNaN(before) && !isNaN(after)) {
                        // Calculate improvement percentage if not provided
                        if (!param.improvementPercentage) {
                            param.improvementPercentage = ((after - before) / before) * 100;
                        }
                    }
                }
                return true;
            });
        },
        message: 'Invalid clinical parameter values',
        code: 'INVALID_CLINICAL_PARAMETERS'
    },
    {
        field: 'successMetrics.costSavings',
        rule: (costSavings: number) => {
            if (costSavings === undefined || costSavings === null) return true;
            return costSavings >= 0 && costSavings <= 1000000; // Reasonable range
        },
        message: 'Cost savings must be between 0 and 1,000,000',
        code: 'INVALID_COST_SAVINGS'
    }
];

// ===============================
// INTERVENTION VALIDATION SCHEMAS
// ===============================

// Create intervention validation with enhanced security and business rules
export const createInterventionSchema: ValidationChain[] = [
    body('patientId')
        .isMongoId()
        .withMessage('Valid patient ID is required')
        .customSanitizer(sanitizeInput.mongoId),

    body('category')
        .isIn([
            'drug_therapy_problem',
            'adverse_drug_reaction',
            'medication_nonadherence',
            'drug_interaction',
            'dosing_issue',
            'contraindication',
            'other'
        ])
        .withMessage('Valid intervention category is required')
        .customSanitizer(sanitizeInput.text),

    body('issueDescription')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Issue description must be between 10 and 1000 characters')
        .customSanitizer(sanitizeInput.text)
        .custom((value) => {
            // Check for potentially malicious content
            const suspiciousPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /data:text\/html/i
            ];

            if (suspiciousPatterns.some(pattern => pattern.test(value))) {
                throw new Error('Issue description contains potentially unsafe content');
            }

            return true;
        }),

    body('priority')
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Valid priority level is required')
        .customSanitizer(sanitizeInput.text),

    body('strategies')
        .optional()
        .isArray({ min: 0, max: 10 })
        .withMessage('Strategies must be an array with maximum 10 items'),

    body('strategies.*.type')
        .optional()
        .isIn([
            'medication_review',
            'dose_adjustment',
            'alternative_therapy',
            'discontinuation',
            'additional_monitoring',
            'patient_counseling',
            'physician_consultation',
            'custom'
        ])
        .withMessage('Valid strategy type is required')
        .customSanitizer(sanitizeInput.text),

    body('strategies.*.description')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy description must be between 1 and 500 characters')
        .customSanitizer(sanitizeInput.text),

    body('strategies.*.rationale')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy rationale must be between 1 and 500 characters')
        .customSanitizer(sanitizeInput.text),

    body('strategies.*.expectedOutcome')
        .optional()
        .isLength({ min: 20, max: 500 })
        .withMessage('Expected outcome must be between 20 and 500 characters')
        .customSanitizer(sanitizeInput.text),

    body('strategies.*.priority')
        .optional()
        .isIn(['primary', 'secondary'])
        .withMessage('Valid strategy priority is required')
        .customSanitizer(sanitizeInput.text),

    body('estimatedDuration')
        .optional()
        .isInt({ min: 1, max: 10080 }) // Max 1 week in minutes
        .withMessage('Estimated duration must be between 1 and 10080 minutes')
        .customSanitizer(sanitizeInput.number),

    body('relatedMTRId')
        .optional()
        .isMongoId()
        .withMessage('Valid MTR ID is required')
        .customSanitizer(sanitizeInput.mongoId),
];

// Enhanced validation middleware for intervention creation
export const validateCreateIntervention = validateRequest(
    createInterventionSchema,
    interventionBusinessRules,
    {
        sanitize: true,
        logErrors: true,
        includeStack: process.env.NODE_ENV === 'development'
    }
);

// Update intervention validation
export const updateInterventionSchema: ValidationChain[] = [
    body('category')
        .optional()
        .isIn([
            'drug_therapy_problem',
            'adverse_drug_reaction',
            'medication_nonadherence',
            'drug_interaction',
            'dosing_issue',
            'contraindication',
            'other'
        ])
        .withMessage('Valid intervention category is required'),

    body('issueDescription')
        .optional()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Issue description must be between 10 and 1000 characters')
        .trim(),

    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Valid priority level is required'),

    body('status')
        .optional()
        .isIn(['identified', 'planning', 'in_progress', 'implemented', 'completed', 'cancelled'])
        .withMessage('Valid status is required'),

    body('implementationNotes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Implementation notes must not exceed 1000 characters')
        .trim(),
];

// Intervention parameters validation
export const interventionParamsSchema: ValidationChain[] = [
    param('id')
        .isMongoId()
        .withMessage('Valid intervention ID is required'),
];

// ===============================
// STRATEGY VALIDATION SCHEMAS
// ===============================

// Add strategy validation
export const addStrategySchema: ValidationChain[] = [
    body('type')
        .isIn([
            'medication_review',
            'dose_adjustment',
            'alternative_therapy',
            'discontinuation',
            'additional_monitoring',
            'patient_counseling',
            'physician_consultation',
            'custom'
        ])
        .withMessage('Valid strategy type is required'),

    body('description')
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy description must be between 1 and 500 characters')
        .trim(),

    body('rationale')
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy rationale must be between 1 and 500 characters')
        .trim(),

    body('expectedOutcome')
        .isLength({ min: 20, max: 500 })
        .withMessage('Expected outcome must be between 20 and 500 characters')
        .trim(),

    body('priority')
        .optional()
        .isIn(['primary', 'secondary'])
        .withMessage('Valid strategy priority is required'),
];

// Update strategy validation
export const updateStrategySchema: ValidationChain[] = [
    body('description')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy description must be between 1 and 500 characters')
        .trim(),

    body('rationale')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Strategy rationale must be between 1 and 500 characters')
        .trim(),

    body('expectedOutcome')
        .optional()
        .isLength({ min: 20, max: 500 })
        .withMessage('Expected outcome must be between 20 and 500 characters')
        .trim(),

    body('priority')
        .optional()
        .isIn(['primary', 'secondary'])
        .withMessage('Valid strategy priority is required'),
];

// ===============================
// ASSIGNMENT VALIDATION SCHEMAS
// ===============================

// Assign team member validation
export const assignTeamMemberSchema: ValidationChain[] = [
    body('userId')
        .isMongoId()
        .withMessage('Valid user ID is required'),

    body('role')
        .isIn(['pharmacist', 'physician', 'nurse', 'patient', 'caregiver'])
        .withMessage('Valid role is required'),

    body('task')
        .isLength({ min: 1, max: 500 })
        .withMessage('Task description must be between 1 and 500 characters')
        .trim(),

    body('notes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Notes must not exceed 1000 characters')
        .trim(),
];

// Update assignment validation
export const updateAssignmentSchema: ValidationChain[] = [
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
        .withMessage('Valid assignment status is required'),

    body('notes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Notes must not exceed 1000 characters')
        .trim(),
];

// ===============================
// OUTCOME VALIDATION SCHEMAS
// ===============================

// Record outcome validation
export const recordOutcomeSchema: ValidationChain[] = [
    body('patientResponse')
        .isIn(['improved', 'no_change', 'worsened', 'unknown'])
        .withMessage('Valid patient response is required'),

    body('clinicalParameters')
        .optional()
        .isArray()
        .withMessage('Clinical parameters must be an array'),

    body('clinicalParameters.*.parameter')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Parameter name must be between 1 and 100 characters')
        .trim(),

    body('clinicalParameters.*.beforeValue')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Before value must not exceed 50 characters')
        .trim(),

    body('clinicalParameters.*.afterValue')
        .optional()
        .isLength({ max: 50 })
        .withMessage('After value must not exceed 50 characters')
        .trim(),

    body('clinicalParameters.*.unit')
        .optional()
        .isLength({ max: 20 })
        .withMessage('Unit must not exceed 20 characters')
        .trim(),

    body('adverseEffects')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Adverse effects must not exceed 1000 characters')
        .trim(),

    body('additionalIssues')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Additional issues must not exceed 1000 characters')
        .trim(),

    body('successMetrics.problemResolved')
        .optional()
        .isBoolean()
        .withMessage('Problem resolved must be a boolean'),

    body('successMetrics.medicationOptimized')
        .optional()
        .isBoolean()
        .withMessage('Medication optimized must be a boolean'),

    body('successMetrics.adherenceImproved')
        .optional()
        .isBoolean()
        .withMessage('Adherence improved must be a boolean'),

    body('successMetrics.costSavings')
        .optional()
        .isNumeric()
        .withMessage('Cost savings must be a number'),

    body('successMetrics.qualityOfLifeImproved')
        .optional()
        .isBoolean()
        .withMessage('Quality of life improved must be a boolean'),
];

// ===============================
// FOLLOW-UP VALIDATION SCHEMAS
// ===============================

// Schedule follow-up validation
export const scheduleFollowUpSchema: ValidationChain[] = [
    body('required')
        .isBoolean()
        .withMessage('Follow-up required must be a boolean'),

    body('scheduledDate')
        .optional()
        .isISO8601()
        .withMessage('Valid scheduled date is required'),

    body('notes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Follow-up notes must not exceed 1000 characters')
        .trim(),

    body('nextReviewDate')
        .optional()
        .isISO8601()
        .withMessage('Valid next review date is required'),
];

// ===============================
// SEARCH AND QUERY VALIDATION SCHEMAS
// ===============================

// Search interventions validation
export const searchInterventionsSchema: ValidationChain[] = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('category')
        .optional()
        .isIn([
            'drug_therapy_problem',
            'adverse_drug_reaction',
            'medication_nonadherence',
            'drug_interaction',
            'dosing_issue',
            'contraindication',
            'other'
        ])
        .withMessage('Valid category is required'),

    query('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Valid priority is required'),

    query('status')
        .optional()
        .isIn(['identified', 'planning', 'in_progress', 'implemented', 'completed', 'cancelled'])
        .withMessage('Valid status is required'),

    query('patientId')
        .optional()
        .isMongoId()
        .withMessage('Valid patient ID is required'),

    query('assignedTo')
        .optional()
        .isMongoId()
        .withMessage('Valid user ID is required'),

    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Valid date from is required'),

    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Valid date to is required'),

    query('search')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be between 1 and 100 characters')
        .trim(),

    query('sortBy')
        .optional()
        .isIn(['identifiedDate', 'priority', 'status', 'completedAt', 'interventionNumber'])
        .withMessage('Valid sort field is required'),

    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Valid sort order is required'),
];

// Patient parameters validation
export const patientParamsSchema: ValidationChain[] = [
    param('patientId')
        .isMongoId()
        .withMessage('Valid patient ID is required'),
];

// ===============================
// ANALYTICS AND REPORTING VALIDATION SCHEMAS
// ===============================

// Analytics query validation
export const analyticsQuerySchema: ValidationChain[] = [
    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Valid date from is required'),

    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Valid date to is required'),

    query('category')
        .optional()
        .isIn([
            'drug_therapy_problem',
            'adverse_drug_reaction',
            'medication_nonadherence',
            'drug_interaction',
            'dosing_issue',
            'contraindication',
            'other'
        ])
        .withMessage('Valid category is required'),

    query('pharmacistId')
        .optional()
        .isMongoId()
        .withMessage('Valid pharmacist ID is required'),
];

// Export query validation
export const exportQuerySchema: ValidationChain[] = [
    query('format')
        .optional()
        .isIn(['pdf', 'excel', 'csv'])
        .withMessage('Valid export format is required'),

    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Valid date from is required'),

    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Valid date to is required'),

    query('includeOutcomes')
        .optional()
        .isBoolean()
        .withMessage('Include outcomes must be a boolean'),
];

// ===============================
// INTEGRATION VALIDATION SCHEMAS
// ===============================

// Link MTR validation
export const linkMTRSchema: ValidationChain[] = [
    body('mtrId')
        .isMongoId()
        .withMessage('Valid MTR ID is required'),
];

// Notification validation
export const notificationSchema: ValidationChain[] = [
    body('event')
        .isIn(['assignment', 'status_change', 'outcome_recorded', 'follow_up_due'])
        .withMessage('Valid notification event is required'),

    body('recipients')
        .optional()
        .isArray()
        .withMessage('Recipients must be an array'),

    body('recipients.*')
        .optional()
        .isMongoId()
        .withMessage('Valid recipient ID is required'),

    body('message')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Message must be between 1 and 500 characters')
        .trim(),
];