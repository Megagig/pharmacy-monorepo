import { z } from 'zod';

/**
 * Diagnostic Module Validation Schemas
 * Comprehensive Zod schemas for all Diagnostic API endpoints
 */

export type IVitalSigns = z.infer<typeof vitalSignsSchema>;

// Common validation patterns
const mongoIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

// Allow legacy diagnostic case IDs like DX-MH3XX3EM-Z4IJZBFEXLR as well as ObjectIds
const legacyCaseIdSchema = z
    .string()
    .regex(/^DX-[A-Z0-9]+-[A-Z0-9]+$/i, 'Invalid legacy Diagnostic Case ID');

// Some params accept either ObjectId or legacy DX-* caseId
const caseIdOrMongoIdSchema = z.union([mongoIdSchema, legacyCaseIdSchema]);

const phoneRegex = /^\+234[7-9]\d{9}$/; // Nigerian E.164 format

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
// SYMPTOM AND CLINICAL DATA SCHEMAS
// ===============================

export const symptomDataSchema = z.object({
    subjective: z
        .array(z.string().min(1, 'Symptom cannot be empty').max(200))
        .min(1, 'At least one subjective symptom is required')
        .max(20, 'Maximum 20 symptoms allowed'),
    objective: z
        .array(z.string().min(1).max(200))
        .max(20, 'Maximum 20 objective findings allowed')
        .default([]),
    duration: z
        .string()
        .min(1, 'Duration is required')
        .max(100, 'Duration description too long'),
    severity: z.enum(['mild', 'moderate', 'severe']),
    onset: z.enum(['acute', 'chronic', 'subacute']),
});

export const vitalSignsSchema = z.object({
    bloodPressure: z
        .string()
        .regex(/^\d{2,3}\/\d{2,3}$/, 'Blood pressure must be in format "systolic/diastolic"')
        .optional(),
    heartRate: z
        .number()
        .int()
        .min(30, 'Heart rate too low')
        .max(250, 'Heart rate too high')
        .optional(),
    temperature: z
        .number()
        .min(30, 'Temperature too low')
        .max(45, 'Temperature too high')
        .optional(),
    bloodGlucose: z
        .number()
        .min(20, 'Blood glucose too low')
        .max(600, 'Blood glucose too high')
        .optional(),
    respiratoryRate: z
        .number()
        .int()
        .min(8, 'Respiratory rate too low')
        .max(60, 'Respiratory rate too high')
        .optional(),
    oxygenSaturation: z
        .number()
        .min(70, 'Oxygen saturation too low')
        .max(100, 'Oxygen saturation cannot exceed 100%')
        .optional(),
    weight: z
        .number()
        .min(0.5, 'Weight too low')
        .max(1000, 'Weight too high')
        .optional(),
    height: z
        .number()
        .min(30, 'Height too low')
        .max(300, 'Height too high')
        .optional(),
});

export const medicationEntrySchema = z.object({
    name: z
        .string()
        .min(1, 'Medication name is required')
        .max(200, 'Medication name too long'),
    dosage: z
        .string()
        .min(1, 'Dosage is required')
        .max(100, 'Dosage description too long'),
    frequency: z
        .string()
        .min(1, 'Frequency is required')
        .max(100, 'Frequency description too long'),
    route: z
        .string()
        .max(50, 'Route description too long')
        .optional(),
    startDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    indication: z
        .string()
        .max(200, 'Indication description too long')
        .optional(),
});

export const socialHistorySchema = z.object({
    smoking: z.enum(['never', 'former', 'current']).optional(),
    alcohol: z.enum(['never', 'occasional', 'regular', 'heavy']).optional(),
    exercise: z.enum(['sedentary', 'light', 'moderate', 'active']).optional(),
});

export const inputSnapshotSchema = z.object({
    symptoms: symptomDataSchema,
    vitals: vitalSignsSchema.optional(),
    currentMedications: z
        .array(medicationEntrySchema)
        .max(50, 'Maximum 50 medications allowed')
        .default([]),
    allergies: z
        .array(z.string().min(1, 'Allergy cannot be empty').max(100))
        .max(20, 'Maximum 20 allergies allowed')
        .default([]),
    medicalHistory: z
        .array(z.string().min(1, 'Medical history item cannot be empty').max(200))
        .max(30, 'Maximum 30 medical history items allowed')
        .default([]),
    labResultIds: z
        .array(mongoIdSchema)
        .max(20, 'Maximum 20 lab results allowed')
        .default([]),
    socialHistory: socialHistorySchema.optional(),
    familyHistory: z
        .array(z.string().min(1, 'Family history item cannot be empty').max(200))
        .max(20, 'Maximum 20 family history items allowed')
        .default([]),
});

// ===============================
// DIAGNOSTIC REQUEST SCHEMAS
// ===============================

export const createDiagnosticRequestSchema = z.object({
    patientId: mongoIdSchema,
    inputSnapshot: inputSnapshotSchema,
    priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
    consentObtained: z
        .boolean()
        .refine((val) => val === true, {
            message: 'Patient consent is required for AI diagnostic processing',
        }),
});

export const diagnosticParamsSchema = z.object({
    id: caseIdOrMongoIdSchema,
});

export const patientHistoryParamsSchema = z.object({
    patientId: mongoIdSchema,
});

export const diagnosticQuerySchema = z
    .object({
        status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
        priority: z.enum(['routine', 'urgent', 'stat']).optional(),
        pharmacistId: mongoIdSchema.optional(),
    })
    .merge(paginationSchema);

// ===============================
// PHARMACIST REVIEW SCHEMAS
// ===============================

export const approveResultSchema = z.object({
    modifications: z
        .string()
        .max(2000, 'Modifications cannot exceed 2000 characters')
        .optional(),
    reviewNotes: z
        .string()
        .max(1000, 'Review notes cannot exceed 1000 characters')
        .optional(),
    clinicalJustification: z
        .string()
        .max(1000, 'Clinical justification cannot exceed 1000 characters')
        .optional(),
});

export const rejectResultSchema = z.object({
    rejectionReason: z
        .string()
        .min(1, 'Rejection reason is required')
        .max(1000, 'Rejection reason cannot exceed 1000 characters'),
    reviewNotes: z
        .string()
        .max(1000, 'Review notes cannot exceed 1000 characters')
        .optional(),
    clinicalJustification: z
        .string()
        .max(1000, 'Clinical justification cannot exceed 1000 characters')
        .optional(),
});

export const pendingReviewsQuerySchema = z
    .object({
        priority: z.enum(['routine', 'urgent', 'stat']).optional(),
        confidenceMin: z
            .string()
            .optional()
            .transform((val) => (val ? parseFloat(val) : undefined))
            .refine((val) => val === undefined || (val >= 0 && val <= 1), {
                message: 'Confidence must be between 0 and 1',
            }),
        confidenceMax: z
            .string()
            .optional()
            .transform((val) => (val ? parseFloat(val) : undefined))
            .refine((val) => val === undefined || (val >= 0 && val <= 1), {
                message: 'Confidence must be between 0 and 1',
            }),
        hasRedFlags: z
            .string()
            .optional()
            .transform((val) => {
                if (val === undefined) return undefined;
                return val === 'true';
            }),
        orderBy: z.enum(['oldest', 'newest', 'priority', 'confidence']).default('oldest'),
    })
    .merge(paginationSchema)
    .refine(
        (data) => {
            if (data.confidenceMin !== undefined && data.confidenceMax !== undefined) {
                return data.confidenceMin <= data.confidenceMax;
            }
            return true;
        },
        {
            message: 'Minimum confidence cannot be greater than maximum confidence',
            path: ['confidenceMin'],
        }
    );

// ===============================
// INTERVENTION CREATION SCHEMAS
// ===============================

export const createInterventionSchema = z.object({
    type: z.enum(['medication_review', 'counseling', 'referral', 'monitoring', 'lifestyle']),
    title: z
        .string()
        .min(1, 'Title is required')
        .max(200, 'Title cannot exceed 200 characters'),
    description: z
        .string()
        .min(1, 'Description is required')
        .max(2000, 'Description cannot exceed 2000 characters'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z
        .string()
        .min(1, 'Category is required')
        .max(100, 'Category cannot exceed 100 characters'),
    recommendations: z
        .array(z.string().min(1, 'Recommendation cannot be empty').max(500))
        .min(1, 'At least one recommendation is required')
        .max(10, 'Maximum 10 recommendations allowed'),
    followUpRequired: z.boolean().default(false),
    followUpDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    targetOutcome: z
        .string()
        .max(500, 'Target outcome cannot exceed 500 characters')
        .optional(),
    monitoringParameters: z
        .array(z.string().min(1).max(200))
        .max(10, 'Maximum 10 monitoring parameters allowed')
        .default([]),
});

// ===============================
// ANALYTICS SCHEMAS
// ===============================

export const analyticsQuerySchema = z.object({
    from: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
    to: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
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
// CUSTOM VALIDATION FUNCTIONS
// ===============================

/**
 * Validate that consent timestamp is recent (within last 24 hours)
 */
export const validateConsentTimestamp = (timestamp: Date): boolean => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return timestamp >= twentyFourHoursAgo && timestamp <= now;
};

/**
 * Validate that vital signs are within reasonable ranges for the patient's age
 */
export const validateVitalSignsForAge = (
    vitals: IVitalSigns,
    patientAge: number
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Age-specific heart rate validation
    if (vitals.heartRate) {
        let minHR = 60;
        let maxHR = 100;

        if (patientAge < 1) {
            minHR = 100;
            maxHR = 160;
        } else if (patientAge < 3) {
            minHR = 90;
            maxHR = 150;
        } else if (patientAge < 6) {
            minHR = 80;
            maxHR = 140;
        } else if (patientAge < 12) {
            minHR = 70;
            maxHR = 120;
        } else if (patientAge < 18) {
            minHR = 60;
            maxHR = 110;
        }

        if (vitals.heartRate < minHR || vitals.heartRate > maxHR) {
            errors.push(`Heart rate ${vitals.heartRate.toString()} is outside normal range for age ${patientAge} (${minHR}-${maxHR})`);
        }
    }

    // Age-specific respiratory rate validation
    if (vitals.respiratoryRate) {
        let minRR = 12;
        let maxRR = 20;

        if (patientAge < 1) {
            minRR = 30;
            maxRR = 60;
        } else if (patientAge < 3) {
            minRR = 24;
            maxRR = 40;
        } else if (patientAge < 6) {
            minRR = 22;
            maxRR = 34;
        } else if (patientAge < 12) {
            minRR = 18;
            maxRR = 30;
        } else if (patientAge < 18) {
            minRR = 12;
            maxRR = 16;
        }

        if (vitals.respiratoryRate < minRR || vitals.respiratoryRate > maxRR) {
            errors.push(`Respiratory rate ${vitals.respiratoryRate.toString()} is outside normal range for age ${patientAge} (${minRR}-${maxRR})`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Validate medication dosage format
 */
export const validateMedicationDosage = (dosage: string): boolean => {
    // Common dosage patterns: "5mg", "10 mg", "2.5mg", "1-2 tablets", "5ml", etc.
    const dosagePattern = /^(\d+(\.\d+)?)\s*(mg|g|ml|l|tablets?|capsules?|drops?|units?|iu|mcg|μg)(\s*\/\s*(day|dose|kg|m2))?$/i;
    return dosagePattern.test(dosage.trim());
};

/**
 * Validate medication frequency format
 */
export const validateMedicationFrequency = (frequency: string): boolean => {
    // Common frequency patterns: "once daily", "twice daily", "3 times daily", "every 8 hours", "PRN", etc.
    const frequencyPatterns = [
        /^(once|twice|three times?|four times?|\d+\s*times?)\s*(daily|per day|a day)$/i,
        /^every\s+\d+\s*(hours?|hrs?|minutes?|mins?)$/i,
        /^(prn|as needed|when required)$/i,
        /^(bid|tid|qid|qd|od|bd|tds|qds)$/i,
        /^\d+x\s*(daily|per day)$/i,
    ];

    return frequencyPatterns.some(pattern => pattern.test(frequency.trim()));
};

/**
 * Validate blood pressure format and values
 */
export const validateBloodPressure = (bp: string): { valid: boolean; systolic?: number; diastolic?: number; error?: string } => {
    const bpMatch = bp.match(/^(\d{2,3})\/(\d{2,3})$/);

    if (!bpMatch) {
        return { valid: false, error: 'Blood pressure must be in format "systolic/diastolic"' };
    }

    const systolic = parseInt(bpMatch[1]!);
    const diastolic = parseInt(bpMatch[2]!);

    if (systolic < 70 || systolic > 250) {
        return { valid: false, error: 'Systolic pressure must be between 70-250 mmHg' };
    }

    if (diastolic < 40 || diastolic > 150) {
        return { valid: false, error: 'Diastolic pressure must be between 40-150 mmHg' };
    }

    if (systolic <= diastolic) {
        return { valid: false, error: 'Systolic pressure must be higher than diastolic pressure' };
    }

    return { valid: true, systolic, diastolic };
};

export default {
    validateRequest,
    validateConsentTimestamp,
    validateVitalSignsForAge,
    validateMedicationDosage,
    validateMedicationFrequency,
    validateBloodPressure,
};