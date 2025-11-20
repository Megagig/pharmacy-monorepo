import Joi from 'joi';
import type { CreateDiagnosticRequestData, CreateLabOrderData, CreateLabResultData } from '../types';

// Diagnostic Request Validation Schema
export const diagnosticRequestSchema = Joi.object<CreateDiagnosticRequestData>({
    patientId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid patient ID format'),

    symptoms: Joi.object({
        subjective: Joi.array().items(Joi.string().trim().min(1)).min(1).required()
            .messages({
                'array.min': 'At least one subjective symptom is required',
                'any.required': 'Symptoms are required'
            }),
        objective: Joi.array().items(Joi.string().trim().min(1)).default([]),
        duration: Joi.string().trim().min(1).required()
            .messages({
                'string.empty': 'Duration is required',
                'any.required': 'Duration is required'
            }),
        severity: Joi.string().valid('mild', 'moderate', 'severe').required()
            .messages({
                'any.only': 'Severity must be mild, moderate, or severe',
                'any.required': 'Severity is required'
            }),
        onset: Joi.string().valid('acute', 'chronic', 'subacute').required()
            .messages({
                'any.only': 'Onset must be acute, chronic, or subacute',
                'any.required': 'Onset is required'
            })
    }).required(),

    vitals: Joi.object({
        bloodPressure: Joi.string().pattern(/^\d{2,3}\/\d{2,3}$/)
            .message('Blood pressure must be in format "120/80"'),
        heartRate: Joi.number().integer().min(30).max(250)
            .messages({
                'number.min': 'Heart rate must be at least 30 bpm',
                'number.max': 'Heart rate cannot exceed 250 bpm'
            }),
        temperature: Joi.number().min(30).max(45)
            .messages({
                'number.min': 'Temperature must be at least 30°C',
                'number.max': 'Temperature cannot exceed 45°C'
            }),
        bloodGlucose: Joi.number().min(0).max(1000)
            .messages({
                'number.min': 'Blood glucose cannot be negative',
                'number.max': 'Blood glucose value seems unrealistic'
            }),
        respiratoryRate: Joi.number().integer().min(8).max(60)
            .messages({
                'number.min': 'Respiratory rate must be at least 8',
                'number.max': 'Respiratory rate cannot exceed 60'
            })
    }).optional(),

    currentMedications: Joi.array().items(
        Joi.object({
            name: Joi.string().trim().min(1).required()
                .messages({
                    'string.empty': 'Medication name is required',
                    'any.required': 'Medication name is required'
                }),
            dosage: Joi.string().trim().min(1).required()
                .messages({
                    'string.empty': 'Medication dosage is required',
                    'any.required': 'Medication dosage is required'
                }),
            frequency: Joi.string().trim().min(1).required()
                .messages({
                    'string.empty': 'Medication frequency is required',
                    'any.required': 'Medication frequency is required'
                })
        })
    ).optional(),

    allergies: Joi.array().items(Joi.string().trim().min(1)).optional(),
    medicalHistory: Joi.array().items(Joi.string().trim().min(1)).optional(),
    labResults: Joi.array().items(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid lab result ID format')
    ).optional(),

    consent: Joi.boolean().valid(true).required()
        .messages({
            'any.only': 'Patient consent is required for AI processing',
            'any.required': 'Patient consent is required for AI processing'
        })
});

// Lab Order Validation Schema
export const labOrderSchema = Joi.object<CreateLabOrderData>({
    patientId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid patient ID format'),

    tests: Joi.array().items(
        Joi.object({
            code: Joi.string().trim().uppercase().min(1).required()
                .messages({
                    'string.empty': 'Test code is required',
                    'any.required': 'Test code is required'
                }),
            name: Joi.string().trim().min(1).required()
                .messages({
                    'string.empty': 'Test name is required',
                    'any.required': 'Test name is required'
                }),
            loincCode: Joi.string().pattern(/^\d{4,5}-\d$/)
                .message('LOINC code must be in format "12345-6"'),
            indication: Joi.string().trim().min(1).required()
                .messages({
                    'string.empty': 'Test indication is required',
                    'any.required': 'Test indication is required'
                }),
            priority: Joi.string().valid('stat', 'urgent', 'routine').default('routine')
                .messages({
                    'any.only': 'Priority must be stat, urgent, or routine'
                })
        })
    ).min(1).required()
        .messages({
            'array.min': 'At least one test must be ordered',
            'any.required': 'Tests are required'
        }),

    expectedDate: Joi.date().iso().greater('now').optional()
        .messages({
            'date.greater': 'Expected date must be in the future'
        })
});

// Lab Result Validation Schema
export const labResultSchema = Joi.object<CreateLabResultData>({
    patientId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid patient ID format'),
    orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid order ID format').optional(),

    testCode: Joi.string().trim().uppercase().min(1).required()
        .messages({
            'string.empty': 'Test code is required',
            'any.required': 'Test code is required'
        }),
    testName: Joi.string().trim().min(1).required()
        .messages({
            'string.empty': 'Test name is required',
            'any.required': 'Test name is required'
        }),
    value: Joi.string().trim().min(1).required()
        .messages({
            'string.empty': 'Test value is required',
            'any.required': 'Test value is required'
        }),
    unit: Joi.string().trim().max(20).optional(),

    referenceRange: Joi.object({
        low: Joi.number().optional(),
        high: Joi.number().optional(),
        text: Joi.string().trim().max(200).optional()
    }).required()
        .custom((value, helpers) => {
            if (value.low !== undefined && value.high !== undefined && value.low > value.high) {
                return helpers.error('referenceRange.invalid');
            }
            return value;
        })
        .messages({
            'referenceRange.invalid': 'Low reference value cannot be greater than high value',
            'any.required': 'Reference range is required'
        }),

    interpretation: Joi.string().valid('low', 'normal', 'high', 'critical', 'abnormal').optional(),
    flags: Joi.array().items(Joi.string().trim()).max(10).optional()
        .messages({
            'array.max': 'Cannot have more than 10 flags'
        }),

    performedAt: Joi.date().iso().max('now').required()
        .messages({
            'date.max': 'Performed date cannot be in the future',
            'any.required': 'Performed date is required'
        }),

    loincCode: Joi.string().pattern(/^\d{4,5}-\d$/)
        .message('LOINC code must be in format "12345-6"').optional()
});

// Interaction Check Validation Schema
export const interactionCheckSchema = Joi.object({
    medications: Joi.array().items(Joi.string().trim().min(1)).min(1).required()
        .messages({
            'array.min': 'At least one medication is required',
            'any.required': 'Medications are required'
        }),
    patientAllergies: Joi.array().items(Joi.string().trim().min(1)).optional()
});

// Pharmacist Review Validation Schema
export const pharmacistReviewSchema = Joi.object({
    status: Joi.string().valid('approved', 'modified', 'rejected').required()
        .messages({
            'any.only': 'Status must be approved, modified, or rejected',
            'any.required': 'Review status is required'
        }),
    modifications: Joi.string().trim().min(1)
        .when('status', {
            is: 'modified',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
        .messages({
            'string.empty': 'Modifications are required when status is modified',
            'any.required': 'Modifications are required when status is modified'
        }),
    rejectionReason: Joi.string().trim().min(1)
        .when('status', {
            is: 'rejected',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
        .messages({
            'string.empty': 'Rejection reason is required when status is rejected',
            'any.required': 'Rejection reason is required when status is rejected'
        })
});

// FHIR Import Validation Schema
export const fhirImportSchema = Joi.object({
    fhirBundle: Joi.object().required()
        .messages({
            'any.required': 'FHIR bundle is required'
        }),
    patientMapping: Joi.object({
        fhirPatientId: Joi.string().trim().min(1).required()
            .messages({
                'string.empty': 'FHIR patient ID is required',
                'any.required': 'FHIR patient ID is required'
            }),
        internalPatientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            .messages({
                'string.pattern.base': 'Invalid internal patient ID format',
                'any.required': 'Internal patient ID is required'
            })
    }).required()
        .messages({
            'any.required': 'Patient mapping is required'
        })
});

// Validation helper functions
export const validateDiagnosticRequest = (data: unknown) => {
    return diagnosticRequestSchema.validate(data, { abortEarly: false });
};

export const validateLabOrder = (data: unknown) => {
    return labOrderSchema.validate(data, { abortEarly: false });
};

export const validateLabResult = (data: unknown) => {
    return labResultSchema.validate(data, { abortEarly: false });
};

export const validateInteractionCheck = (data: unknown) => {
    return interactionCheckSchema.validate(data, { abortEarly: false });
};

export const validatePharmacistReview = (data: unknown) => {
    return pharmacistReviewSchema.validate(data, { abortEarly: false });
};

export const validateFHIRImport = (data: unknown) => {
    return fhirImportSchema.validate(data, { abortEarly: false });
};

// Custom validation error formatter
export const formatValidationErrors = (error: Joi.ValidationError) => {
    return error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        code: detail.type
    }));
};