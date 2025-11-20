import { z } from 'zod';

/**
 * Manual Lab Order Validation Schemas
 * Comprehensive Zod schemas for all Manual Lab Order API endpoints
 */

// Common validation patterns
const mongoIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

const orderIdSchema = z
    .string()
    .regex(/^LAB-\d{4}-\d{4}$/, 'Invalid order ID format (expected LAB-YYYY-XXXX)');

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
        .transform((val) => Math.min(100, Math.max(1, parseInt(val) || 20))),
    sort: z.string().optional().default('-createdAt'),
});

// ===============================
// MANUAL LAB TEST SCHEMA
// ===============================

export const manualLabTestSchema = z.object({
    name: z
        .string()
        .min(1, 'Test name is required')
        .max(200, 'Test name cannot exceed 200 characters')
        .trim(),
    code: z
        .string()
        .min(1, 'Test code is required')
        .max(20, 'Test code cannot exceed 20 characters')
        .trim()
        .transform((val) => val.toUpperCase()),
    loincCode: z
        .string()
        .max(20, 'LOINC code cannot exceed 20 characters')
        .trim()
        .optional(),
    specimenType: z
        .string()
        .min(1, 'Specimen type is required')
        .max(100, 'Specimen type cannot exceed 100 characters')
        .trim(),
    unit: z
        .string()
        .max(20, 'Unit cannot exceed 20 characters')
        .trim()
        .optional(),
    refRange: z
        .string()
        .max(100, 'Reference range cannot exceed 100 characters')
        .trim()
        .optional(),
    category: z
        .string()
        .max(100, 'Category cannot exceed 100 characters')
        .trim()
        .optional(),
});

// ===============================
// CREATE ORDER SCHEMA
// ===============================

export const createManualLabOrderSchema = z.object({
    patientId: mongoIdSchema,
    locationId: z.string().max(100).trim().optional(),
    tests: z
        .array(manualLabTestSchema)
        .min(1, 'At least one test is required')
        .max(20, 'Maximum 20 tests allowed per order'),
    indication: z
        .string()
        .min(1, 'Clinical indication is required')
        .max(1000, 'Indication cannot exceed 1000 characters')
        .trim(),
    priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
    notes: z
        .string()
        .max(1000, 'Notes cannot exceed 1000 characters')
        .trim()
        .optional(),
    consentObtained: z
        .boolean()
        .refine((val) => val === true, {
            message: 'Patient consent is required for manual lab orders',
        }),
    consentObtainedBy: mongoIdSchema,
});

// ===============================
// UPDATE ORDER STATUS SCHEMA
// ===============================

export const updateOrderStatusSchema = z.object({
    status: z.enum(['requested', 'sample_collected', 'result_awaited', 'completed', 'referred']),
    notes: z
        .string()
        .max(1000, 'Notes cannot exceed 1000 characters')
        .trim()
        .optional(),
});

// ===============================
// PARAMETER SCHEMAS
// ===============================

export const orderParamsSchema = z.object({
    orderId: orderIdSchema,
});

export const patientParamsSchema = z.object({
    patientId: mongoIdSchema,
});

// ===============================
// QUERY SCHEMAS
// ===============================

export const orderQuerySchema = z
    .object({
        status: z.enum(['requested', 'sample_collected', 'result_awaited', 'completed', 'referred']).optional(),
        priority: z.enum(['routine', 'urgent', 'stat']).optional(),
        orderedBy: mongoIdSchema.optional(),
        locationId: z.string().optional(),
        dateFrom: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
        dateTo: z
            .string()
            .datetime()
            .optional()
            .transform((val) => (val ? new Date(val) : undefined)),
        search: z.string().max(100).trim().optional(),
    })
    .merge(paginationSchema);

export const patientOrderQuerySchema = z
    .object({
        status: z.enum(['requested', 'sample_collected', 'result_awaited', 'completed', 'referred']).optional(),
    })
    .merge(paginationSchema);

// ===============================
// RESULT VALUE SCHEMA
// ===============================

export const resultValueSchema = z.object({
    testCode: z
        .string()
        .min(1, 'Test code is required')
        .max(20, 'Test code cannot exceed 20 characters')
        .trim()
        .transform((val) => val.toUpperCase()),
    testName: z
        .string()
        .min(1, 'Test name is required')
        .max(200, 'Test name cannot exceed 200 characters')
        .trim(),
    numericValue: z.number().min(0, 'Numeric value cannot be negative').optional(),
    unit: z
        .string()
        .max(20, 'Unit cannot exceed 20 characters')
        .trim()
        .optional(),
    stringValue: z
        .string()
        .max(500, 'String value cannot exceed 500 characters')
        .trim()
        .optional(),
    comment: z
        .string()
        .max(1000, 'Comment cannot exceed 1000 characters')
        .trim()
        .optional(),
}).refine(
    (data) => data.numericValue !== undefined || data.stringValue !== undefined,
    {
        message: 'Either numeric value or string value must be provided',
    }
);

// ===============================
// ADD RESULTS SCHEMA
// ===============================

export const addResultsSchema = z.object({
    values: z
        .array(resultValueSchema)
        .min(1, 'At least one result value is required')
        .max(50, 'Maximum 50 result values allowed'),
    reviewNotes: z
        .string()
        .max(1000, 'Review notes cannot exceed 1000 characters')
        .trim()
        .optional(),
});

// ===============================
// TOKEN SCHEMA
// ===============================

export const tokenQuerySchema = z.object({
    token: z
        .string()
        .min(1, 'Token is required')
        .max(500, 'Token cannot exceed 500 characters')
        .trim(),
});

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
// BUSINESS RULE VALIDATORS
// ===============================

export const validateOrderStatusTransition = (
    currentStatus: string,
    newStatus: string
): boolean => {
    const validTransitions: Record<string, string[]> = {
        requested: ['sample_collected', 'referred'],
        sample_collected: ['result_awaited', 'referred'],
        result_awaited: ['completed', 'referred'],
        completed: ['referred'],
        referred: [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
};

export const validateTestCodes = (
    resultTestCodes: string[],
    orderedTestCodes: string[]
): { valid: boolean; invalidCodes: string[] } => {
    const orderedCodesUpper = orderedTestCodes.map(code => code.toUpperCase());
    const resultCodesUpper = resultTestCodes.map(code => code.toUpperCase());

    const invalidCodes = resultCodesUpper.filter(
        code => !orderedCodesUpper.includes(code)
    );

    return {
        valid: invalidCodes.length === 0,
        invalidCodes,
    };
};

export const validateConsentRequirement = (
    consentObtained: boolean,
    consentObtainedBy: string
): boolean => {
    return consentObtained === true && !!consentObtainedBy;
};