import { z } from 'zod';

/**
 * Drug Interaction Validation Schemas
 * Comprehensive Zod schemas for all Drug Interaction API endpoints
 */

// ===============================
// DRUG INTERACTION SCHEMAS
// ===============================

export const checkInteractionsSchema = z.object({
    medications: z
        .array(z.string().min(1, 'Medication name cannot be empty').max(200, 'Medication name too long'))
        .min(1, 'At least one medication is required')
        .max(50, 'Maximum 50 medications allowed per request'),
    patientAllergies: z
        .array(z.string().min(1, 'Allergy cannot be empty').max(100, 'Allergy name too long'))
        .max(20, 'Maximum 20 allergies allowed')
        .default([]),
    includeContraindications: z.boolean().default(true),
});

export const drugInfoSchema = z.object({
    drugName: z
        .string()
        .min(1, 'Drug name is required')
        .max(200, 'Drug name cannot exceed 200 characters')
        .trim(),
    includeInteractions: z.boolean().default(false),
    includeIndications: z.boolean().default(true),
});

export const allergyCheckSchema = z.object({
    medications: z
        .array(z.string().min(1, 'Medication name cannot be empty').max(200, 'Medication name too long'))
        .min(1, 'At least one medication is required')
        .max(50, 'Maximum 50 medications allowed'),
    allergies: z
        .array(z.string().min(1, 'Allergy cannot be empty').max(100, 'Allergy name too long'))
        .min(1, 'At least one allergy is required')
        .max(20, 'Maximum 20 allergies allowed'),
});

export const contraindicationCheckSchema = z.object({
    medications: z
        .array(z.string().min(1, 'Medication name cannot be empty').max(200, 'Medication name too long'))
        .min(1, 'At least one medication is required')
        .max(50, 'Maximum 50 medications allowed'),
    conditions: z
        .array(z.string().min(1, 'Condition cannot be empty').max(200, 'Condition name too long'))
        .max(30, 'Maximum 30 conditions allowed')
        .default([]),
    patientAge: z
        .number()
        .int()
        .min(0, 'Age cannot be negative')
        .max(150, 'Age cannot exceed 150')
        .optional(),
    patientGender: z
        .enum(['male', 'female', 'other'])
        .optional(),
});

export const drugSearchQuerySchema = z.object({
    q: z
        .string()
        .min(2, 'Search query must be at least 2 characters long')
        .max(100, 'Search query cannot exceed 100 characters')
        .trim(),
    limit: z
        .string()
        .optional()
        .default('20')
        .transform((val) => Math.min(50, Math.max(1, parseInt(val) || 20))),
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
 * Validate medication name format
 */
export const validateMedicationName = (medicationName: string): { valid: boolean; error?: string } => {
    // Remove extra whitespace
    const cleanName = medicationName.trim();

    // Check for empty string
    if (cleanName.length === 0) {
        return { valid: false, error: 'Medication name cannot be empty' };
    }

    // Check minimum length
    if (cleanName.length < 2) {
        return { valid: false, error: 'Medication name must be at least 2 characters long' };
    }

    // Check maximum length
    if (cleanName.length > 200) {
        return { valid: false, error: 'Medication name cannot exceed 200 characters' };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens, parentheses, forward slashes)
    const validNamePattern = /^[a-zA-Z0-9\s\-\(\)\/\.]+$/;
    if (!validNamePattern.test(cleanName)) {
        return { valid: false, error: 'Medication name contains invalid characters' };
    }

    // Check for suspicious patterns that might indicate injection attempts
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /\bselect\b.*\bfrom\b/i,
        /\bunion\b.*\bselect\b/i,
        /\bdrop\b.*\btable\b/i,
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(cleanName)) {
            return { valid: false, error: 'Medication name contains invalid content' };
        }
    }

    return { valid: true };
};

/**
 * Validate allergy name format
 */
export const validateAllergyName = (allergyName: string): { valid: boolean; error?: string } => {
    // Remove extra whitespace
    const cleanName = allergyName.trim();

    // Check for empty string
    if (cleanName.length === 0) {
        return { valid: false, error: 'Allergy name cannot be empty' };
    }

    // Check minimum length
    if (cleanName.length < 2) {
        return { valid: false, error: 'Allergy name must be at least 2 characters long' };
    }

    // Check maximum length
    if (cleanName.length > 100) {
        return { valid: false, error: 'Allergy name cannot exceed 100 characters' };
    }

    // Check for valid characters
    const validAllergyPattern = /^[a-zA-Z0-9\s\-\(\)\/\.]+$/;
    if (!validAllergyPattern.test(cleanName)) {
        return { valid: false, error: 'Allergy name contains invalid characters' };
    }

    return { valid: true };
};

/**
 * Validate condition name format
 */
export const validateConditionName = (conditionName: string): { valid: boolean; error?: string } => {
    // Remove extra whitespace
    const cleanName = conditionName.trim();

    // Check for empty string
    if (cleanName.length === 0) {
        return { valid: false, error: 'Condition name cannot be empty' };
    }

    // Check minimum length
    if (cleanName.length < 2) {
        return { valid: false, error: 'Condition name must be at least 2 characters long' };
    }

    // Check maximum length
    if (cleanName.length > 200) {
        return { valid: false, error: 'Condition name cannot exceed 200 characters' };
    }

    // Check for valid characters
    const validConditionPattern = /^[a-zA-Z0-9\s\-\(\)\/\.\,]+$/;
    if (!validConditionPattern.test(cleanName)) {
        return { valid: false, error: 'Condition name contains invalid characters' };
    }

    return { valid: true };
};

/**
 * Validate medication list for duplicates and format
 */
export const validateMedicationList = (medications: string[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const seenMedications = new Set<string>();

    for (let i = 0; i < medications.length; i++) {
        const medication = medications[i]!;

        // Validate individual medication
        const validation = validateMedicationName(medication);
        if (!validation.valid) {
            errors.push(`Medication ${i + 1}: ${validation.error}`);
            continue;
        }

        // Check for duplicates (case-insensitive)
        const normalizedMedication = medication.trim().toLowerCase();
        if (seenMedications.has(normalizedMedication)) {
            errors.push(`Medication ${i + 1}: Duplicate medication "${medication}"`);
        } else {
            seenMedications.add(normalizedMedication);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Validate allergy list for duplicates and format
 */
export const validateAllergyList = (allergies: string[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const seenAllergies = new Set<string>();

    for (let i = 0; i < allergies.length; i++) {
        const allergy = allergies[i]!;

        // Validate individual allergy
        const validation = validateAllergyName(allergy);
        if (!validation.valid) {
            errors.push(`Allergy ${i + 1}: ${validation.error}`);
            continue;
        }

        // Check for duplicates (case-insensitive)
        const normalizedAllergy = allergy.trim().toLowerCase();
        if (seenAllergies.has(normalizedAllergy)) {
            errors.push(`Allergy ${i + 1}: Duplicate allergy "${allergy}"`);
        } else {
            seenAllergies.add(normalizedAllergy);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Validate condition list for duplicates and format
 */
export const validateConditionList = (conditions: string[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const seenConditions = new Set<string>();

    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i]!;

        // Validate individual condition
        const validation = validateConditionName(condition);
        if (!validation.valid) {
            errors.push(`Condition ${i + 1}: ${validation.error}`);
            continue;
        }

        // Check for duplicates (case-insensitive)
        const normalizedCondition = condition.trim().toLowerCase();
        if (seenConditions.has(normalizedCondition)) {
            errors.push(`Condition ${i + 1}: Duplicate condition "${condition}"`);
        } else {
            seenConditions.add(normalizedCondition);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Validate patient age for drug interaction checking
 */
export const validatePatientAge = (age: number): { valid: boolean; error?: string; ageGroup?: string } => {
    if (age < 0) {
        return { valid: false, error: 'Age cannot be negative' };
    }

    if (age > 150) {
        return { valid: false, error: 'Age cannot exceed 150 years' };
    }

    // Determine age group for interaction checking
    let ageGroup = 'adult';
    if (age < 2) {
        ageGroup = 'infant';
    } else if (age < 12) {
        ageGroup = 'child';
    } else if (age < 18) {
        ageGroup = 'adolescent';
    } else if (age >= 65) {
        ageGroup = 'elderly';
    }

    return { valid: true, ageGroup };
};

/**
 * Validate drug search query
 */
export const validateDrugSearchQuery = (query: string): { valid: boolean; error?: string } => {
    // Remove extra whitespace
    const cleanQuery = query.trim();

    // Check minimum length
    if (cleanQuery.length < 2) {
        return { valid: false, error: 'Search query must be at least 2 characters long' };
    }

    // Check maximum length
    if (cleanQuery.length > 100) {
        return { valid: false, error: 'Search query cannot exceed 100 characters' };
    }

    // Check for valid characters (allow more flexibility for search)
    const validSearchPattern = /^[a-zA-Z0-9\s\-\(\)\/\.\*\%]+$/;
    if (!validSearchPattern.test(cleanQuery)) {
        return { valid: false, error: 'Search query contains invalid characters' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /\bselect\b.*\bfrom\b/i,
        /\bunion\b.*\bselect\b/i,
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(cleanQuery)) {
            return { valid: false, error: 'Search query contains invalid content' };
        }
    }

    return { valid: true };
};

/**
 * Sanitize medication name for API calls
 */
export const sanitizeMedicationName = (medicationName: string): string => {
    return medicationName
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s\-\(\)\/\.]/g, '') // Remove special characters except allowed ones
        .substring(0, 200); // Truncate to max length
};

/**
 * Normalize medication name for comparison
 */
export const normalizeMedicationName = (medicationName: string): string => {
    return medicationName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, ''); // Remove all special characters for comparison
};

export default {
    validateRequest,
    validateMedicationName,
    validateAllergyName,
    validateConditionName,
    validateMedicationList,
    validateAllergyList,
    validateConditionList,
    validatePatientAge,
    validateDrugSearchQuery,
    sanitizeMedicationName,
    normalizeMedicationName,
};