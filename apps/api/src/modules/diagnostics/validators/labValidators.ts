import { z } from 'zod';

/**
 * Lab Management Validation Schemas
 * Comprehensive Zod schemas for all Lab API endpoints
 */

// Common validation patterns
const mongoIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

const loincCodeSchema = z
    .string()
    .regex(/^\d{1,5}-\d{1,2}$/, 'Invalid LOINC code format (should be like 12345-6)');

// Query parameter schemas
export const paginationSchema = z.object({
    page: z
        .string()
        .optional()
        .default('1')
        .transform((val) => Math.max(1, parseInt(val) || 1)),
    limit: z
        .string()
        .optional()
        .default('20')
        .transform((val) => Math.min(50, Math.max(1, parseInt(val) || 20))),
});

// ===============================
// LAB ORDER SCHEMAS
// ===============================

export const labTestSchema = z.object({
    code: z
        .string()
        .min(1, 'Test code is required')
        .max(50, 'Test code cannot exceed 50 characters')
        .trim(),
    name: z
        .string()
        .min(1, 'Test name is required')
        .max(200, 'Test name cannot exceed 200 characters')
        .trim(),
    loincCode: loincCodeSchema.optional(),
    indication: z
        .string()
        .min(1, 'Test indication is required')
        .max(500, 'Test indication cannot exceed 500 characters')
        .trim(),
    priority: z.enum(['stat', 'urgent', 'routine']).default('routine'),
});

export const createLabOrderSchema = z.object({
    patientId: mongoIdSchema,
    tests: z
        .array(labTestSchema)
        .min(1, 'At least one test is required')
        .max(20, 'Maximum 20 tests allowed per order'),
    indication: z
        .string()
        .min(1, 'Order indication is required')
        .max(1000, 'Order indication cannot exceed 1000 characters')
        .trim(),
    priority: z.enum(['stat', 'urgent', 'routine']).default('routine'),
    expectedDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    externalOrderId: z
        .string()
        .max(100, 'External order ID cannot exceed 100 characters')
        .trim()
        .optional(),
});

export const updateLabOrderSchema = z.object({
    tests: z
        .array(labTestSchema)
        .min(1, 'At least one test is required')
        .max(20, 'Maximum 20 tests allowed per order')
        .optional(),
    indication: z
        .string()
        .min(1, 'Order indication is required')
        .max(1000, 'Order indication cannot exceed 1000 characters')
        .trim()
        .optional(),
    priority: z.enum(['stat', 'urgent', 'routine']).optional(),
    status: z.enum(['ordered', 'collected', 'processing', 'completed', 'cancelled']).optional(),
    expectedDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    externalOrderId: z
        .string()
        .max(100, 'External order ID cannot exceed 100 characters')
        .trim()
        .optional(),
});

export const labOrderParamsSchema = z.object({
    id: mongoIdSchema,
});

export const labOrderQuerySchema = z
    .object({
        patientId: mongoIdSchema.optional(),
        status: z.enum(['ordered', 'collected', 'processing', 'completed', 'cancelled']).optional(),
        priority: z.enum(['stat', 'urgent', 'routine']).optional(),
        orderedBy: mongoIdSchema.optional(),
        fromDate: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
        toDate: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
    })
    .merge(paginationSchema)
    .refine(
        (data) => {
            if (data.fromDate && data.toDate) {
                return data.fromDate <= data.toDate;
            }
            return true;
        },
        {
            message: 'From date cannot be after to date',
            path: ['fromDate'],
        }
    );

// ===============================
// LAB RESULT SCHEMAS
// ===============================

export const referenceRangeSchema = z.object({
    low: z.number().optional(),
    high: z.number().optional(),
    text: z
        .string()
        .max(200, 'Reference range text cannot exceed 200 characters')
        .trim()
        .optional(),
});

export const createLabResultSchema = z.object({
    orderId: mongoIdSchema.optional(),
    patientId: mongoIdSchema,
    testCode: z
        .string()
        .min(1, 'Test code is required')
        .max(50, 'Test code cannot exceed 50 characters')
        .trim(),
    testName: z
        .string()
        .min(1, 'Test name is required')
        .max(200, 'Test name cannot exceed 200 characters')
        .trim(),
    value: z
        .string()
        .min(1, 'Test value is required')
        .max(100, 'Test value cannot exceed 100 characters')
        .trim(),
    unit: z
        .string()
        .max(20, 'Unit cannot exceed 20 characters')
        .trim()
        .optional(),
    referenceRange: referenceRangeSchema,
    interpretation: z.enum(['low', 'normal', 'high', 'critical', 'abnormal']).default('normal'),
    flags: z
        .array(z.string().max(50))
        .max(10, 'Maximum 10 flags allowed')
        .default([]),
    performedAt: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : new Date())),
    externalResultId: z
        .string()
        .max(100, 'External result ID cannot exceed 100 characters')
        .trim()
        .optional(),
    loincCode: loincCodeSchema.optional(),
});

export const updateLabResultSchema = z.object({
    testCode: z
        .string()
        .min(1, 'Test code is required')
        .max(50, 'Test code cannot exceed 50 characters')
        .trim()
        .optional(),
    testName: z
        .string()
        .min(1, 'Test name is required')
        .max(200, 'Test name cannot exceed 200 characters')
        .trim()
        .optional(),
    value: z
        .string()
        .min(1, 'Test value is required')
        .max(100, 'Test value cannot exceed 100 characters')
        .trim()
        .optional(),
    unit: z
        .string()
        .max(20, 'Unit cannot exceed 20 characters')
        .trim()
        .optional(),
    referenceRange: referenceRangeSchema.optional(),
    interpretation: z.enum(['low', 'normal', 'high', 'critical', 'abnormal']).optional(),
    flags: z
        .array(z.string().max(50))
        .max(10, 'Maximum 10 flags allowed')
        .optional(),
    performedAt: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    externalResultId: z
        .string()
        .max(100, 'External result ID cannot exceed 100 characters')
        .trim()
        .optional(),
    loincCode: loincCodeSchema.optional(),
});

export const labResultParamsSchema = z.object({
    id: mongoIdSchema,
});

export const labResultQuerySchema = z
    .object({
        patientId: mongoIdSchema.optional(),
        orderId: mongoIdSchema.optional(),
        testCode: z.string().max(50).trim().optional(),
        interpretation: z.enum(['low', 'normal', 'high', 'critical', 'abnormal']).optional(),
        fromDate: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
        toDate: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
    })
    .merge(paginationSchema)
    .refine(
        (data) => {
            if (data.fromDate && data.toDate) {
                return data.fromDate <= data.toDate;
            }
            return true;
        },
        {
            message: 'From date cannot be after to date',
            path: ['fromDate'],
        }
    );

// ===============================
// LAB TRENDS SCHEMAS
// ===============================

export const labTrendsParamsSchema = z.object({
    patientId: mongoIdSchema,
    testCode: z
        .string()
        .min(1, 'Test code is required')
        .max(50, 'Test code cannot exceed 50 characters')
        .trim(),
});

export const labTrendsQuerySchema = z.object({
    months: z
        .string()
        .optional()
        .default('12')
        .transform((val) => Math.min(60, Math.max(1, parseInt(val) || 12))), // Max 5 years, min 1 month
});

// ===============================
// FHIR IMPORT SCHEMAS
// ===============================

export const patientMappingSchema = z.record(
    z.string(), // FHIR patient ID
    mongoIdSchema // Internal patient ID
);

export const fhirBundleSchema = z.object({
    resourceType: z.literal('Bundle'),
    id: z.string().optional(),
    type: z.enum(['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection']),
    entry: z.array(z.object({
        resource: z.object({
            resourceType: z.string(),
            id: z.string().optional(),
        }).passthrough(), // Allow additional properties
    })).optional(),
});

export const importFHIRSchema = z.object({
    fhirBundle: fhirBundleSchema,
    patientMapping: z.array(z.object({
        fhirPatientId: z.string().min(1, 'FHIR patient ID is required'),
        internalPatientId: mongoIdSchema,
        workplaceId: mongoIdSchema,
    })).min(1, 'At least one patient mapping is required'),
});

// ===============================
// FHIR EXPORT SCHEMAS
// ===============================

export const exportFHIRParamsSchema = z.object({
    orderId: mongoIdSchema,
});

export const syncFHIRParamsSchema = z.object({
    patientId: mongoIdSchema,
});

export const syncFHIRBodySchema = z.object({
    fromDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    toDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
}).refine(
    (data) => {
        if (data.fromDate && data.toDate) {
            return data.fromDate <= data.toDate;
        }
        return true;
    },
    {
        message: 'From date cannot be after to date',
        path: ['fromDate'],
    }
);

// ===============================
// FHIR CONFIGURATION SCHEMAS
// ===============================

export const fhirConfigSchema = z.object({
    id: z.string().min(1, 'Server ID is required'),
    name: z.string().min(1, 'Server name is required'),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    config: z.object({
        baseUrl: z.string().url('Base URL must be a valid URL'),
        version: z.enum(['R4', 'STU3', 'DSTU2']).default('R4'),
        timeout: z.number().min(1000).max(300000).default(30000),
        retryAttempts: z.number().min(0).max(10).default(3),
    }),
    auth: z.object({
        type: z.enum(['oauth2', 'basic', 'bearer', 'none']),
        tokenUrl: z.string().url().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        scope: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        bearerToken: z.string().optional(),
    }).optional(),
    workplaceId: mongoIdSchema.optional(),
}).refine(
    (data) => {
        if (data.auth?.type === 'oauth2') {
            return data.auth.tokenUrl && data.auth.clientId && data.auth.clientSecret;
        }
        if (data.auth?.type === 'basic') {
            return data.auth.username && data.auth.password;
        }
        if (data.auth?.type === 'bearer') {
            return data.auth.bearerToken;
        }
        return true;
    },
    {
        message: 'Authentication configuration is incomplete for the selected type',
        path: ['auth'],
    }
);

// ===============================
// VALIDATION MIDDLEWARE
// ===============================

import { Request, Response, NextFunction } from 'express';

type ValidationTarget = 'body' | 'params' | 'query';

export const validateRequest = (
    schema: z.ZodSchema,
    target: ValidationTarget = 'body'
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const data = req[target];
            const validated = schema.parse(data);
            req[target] = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                res.status(422).json({
                    success: false,
                    message: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    errors,
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Invalid request data',
                    code: 'BAD_REQUEST',
                });
            }
        }
    };
};

// ===============================
// CUSTOM VALIDATION FUNCTIONS
// ===============================

/**
 * Validate lab value format based on test type
 */
export const validateLabValue = (value: string, testCode: string): { valid: boolean; error?: string } => {
    // Common lab value patterns
    const numericPattern = /^-?\d+(\.\d+)?$/;
    const rangePattern = /^-?\d+(\.\d+)?\s*-\s*-?\d+(\.\d+)?$/;
    const qualitativePattern = /^(positive|negative|detected|not detected|present|absent|normal|abnormal)$/i;
    const textPattern = /^[a-zA-Z0-9\s\-\+\.\,\(\)\/]+$/;

    // Test-specific validation
    const testCodeLower = testCode.toLowerCase();

    // Numeric tests (most common)
    if (testCodeLower.includes('glucose') ||
        testCodeLower.includes('cholesterol') ||
        testCodeLower.includes('creatinine') ||
        testCodeLower.includes('hemoglobin') ||
        testCodeLower.includes('hematocrit')) {
        if (!numericPattern.test(value) && !rangePattern.test(value)) {
            return { valid: false, error: 'Numeric value expected for this test' };
        }
    }

    // Qualitative tests
    if (testCodeLower.includes('hiv') ||
        testCodeLower.includes('hepatitis') ||
        testCodeLower.includes('pregnancy') ||
        testCodeLower.includes('culture')) {
        if (!qualitativePattern.test(value) && !textPattern.test(value)) {
            return { valid: false, error: 'Qualitative result expected for this test' };
        }
    }

    // General validation - must not be empty and reasonable length
    if (value.trim().length === 0) {
        return { valid: false, error: 'Lab value cannot be empty' };
    }

    if (value.length > 100) {
        return { valid: false, error: 'Lab value too long' };
    }

    return { valid: true };
};

/**
 * Validate reference range format
 */
export const validateReferenceRange = (range: any): { valid: boolean; error?: string } => {
    if (!range) {
        return { valid: true }; // Reference range is optional
    }

    // Must have at least one of: low, high, or text
    if (!range.low && !range.high && !range.text) {
        return { valid: false, error: 'Reference range must specify low, high, or text value' };
    }

    // If both low and high are specified, low must be less than high
    if (range.low !== undefined && range.high !== undefined) {
        if (range.low >= range.high) {
            return { valid: false, error: 'Reference range low value must be less than high value' };
        }
    }

    // Validate numeric ranges
    if (range.low !== undefined && (typeof range.low !== 'number' || isNaN(range.low))) {
        return { valid: false, error: 'Reference range low value must be a valid number' };
    }

    if (range.high !== undefined && (typeof range.high !== 'number' || isNaN(range.high))) {
        return { valid: false, error: 'Reference range high value must be a valid number' };
    }

    return { valid: true };
};

/**
 * Validate lab result interpretation based on value and reference range
 */
export const validateLabInterpretation = (
    value: string,
    referenceRange: any,
    interpretation: string
): { valid: boolean; suggestedInterpretation?: string; error?: string } => {
    // If no reference range, can't validate interpretation
    if (!referenceRange || (!referenceRange.low && !referenceRange.high)) {
        return { valid: true };
    }

    // Try to parse numeric value
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
        // Non-numeric values can't be automatically interpreted
        return { valid: true };
    }

    let suggestedInterpretation = 'normal';

    // Determine suggested interpretation based on reference range
    if (referenceRange.low !== undefined && numericValue < referenceRange.low) {
        suggestedInterpretation = 'low';
    } else if (referenceRange.high !== undefined && numericValue > referenceRange.high) {
        suggestedInterpretation = 'high';
    }

    // Check for critical values (very high or very low)
    if (referenceRange.low !== undefined && numericValue < (referenceRange.low * 0.5)) {
        suggestedInterpretation = 'critical';
    } else if (referenceRange.high !== undefined && numericValue > (referenceRange.high * 2)) {
        suggestedInterpretation = 'critical';
    }

    // Compare with provided interpretation
    const isConsistent = interpretation === suggestedInterpretation ||
        (interpretation === 'abnormal' && suggestedInterpretation !== 'normal');

    return {
        valid: isConsistent,
        suggestedInterpretation,
        error: isConsistent ? undefined : `Interpretation '${interpretation}' may not match value '${value}' for given reference range. Suggested: '${suggestedInterpretation}'`,
    };
};

/**
 * Validate LOINC code format and checksum
 */
export const validateLOINCCode = (loincCode: string): { valid: boolean; error?: string } => {
    // Basic format validation
    const loincPattern = /^(\d{1,5})-(\d{1,2})$/;
    const match = loincCode.match(loincPattern);

    if (!match) {
        return { valid: false, error: 'LOINC code must be in format NNNNN-N (e.g., 12345-6)' };
    }

    const [, code, checkDigit] = match;

    // Validate check digit using LOINC algorithm
    if (!code) return { valid: false, error: 'LOINC code is required' };

    let sum = 0;
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (char) {
            const digit = parseInt(char);
            const weight = (i % 2 === 0) ? 1 : 2;
            sum += digit * weight;
        }
    }

    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    const providedCheckDigit = parseInt(checkDigit!);

    if (calculatedCheckDigit !== providedCheckDigit) {
        return {
            valid: false,
            error: `Invalid LOINC check digit. Expected ${calculatedCheckDigit}, got ${providedCheckDigit}`
        };
    }

    return { valid: true };
};

/**
 * Validate test code format
 */
export const validateTestCode = (testCode: string): { valid: boolean; error?: string } => {
    // Test code should be alphanumeric with optional hyphens and underscores
    const testCodePattern = /^[A-Za-z0-9_-]+$/;

    if (!testCodePattern.test(testCode)) {
        return {
            valid: false,
            error: 'Test code can only contain letters, numbers, hyphens, and underscores'
        };
    }

    if (testCode.length < 2) {
        return { valid: false, error: 'Test code must be at least 2 characters long' };
    }

    if (testCode.length > 50) {
        return { valid: false, error: 'Test code cannot exceed 50 characters' };
    }

    return { valid: true };
};

export default {
    validateRequest,
    validateLabValue,
    validateReferenceRange,
    validateLabInterpretation,
    validateLOINCCode,
    validateTestCode,
};