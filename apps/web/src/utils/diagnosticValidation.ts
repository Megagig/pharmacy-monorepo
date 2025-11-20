import { z } from 'zod';

// Validation schemas
export const vitalSignsSchema = z.object({
    bloodPressure: z.string()
        .regex(/^\d{2,3}\/\d{2,3}$/, 'Blood pressure must be in format "120/80"')
        .optional(),
    heartRate: z.number()
        .min(30, 'Heart rate must be at least 30 bpm')
        .max(220, 'Heart rate cannot exceed 220 bpm')
        .optional(),
    temperature: z.number()
        .min(30, 'Temperature must be at least 30°C')
        .max(45, 'Temperature cannot exceed 45°C')
        .optional(),
    respiratoryRate: z.number()
        .min(8, 'Respiratory rate must be at least 8 breaths/min')
        .max(60, 'Respiratory rate cannot exceed 60 breaths/min')
        .optional(),
    oxygenSaturation: z.number()
        .min(70, 'Oxygen saturation must be at least 70%')
        .max(100, 'Oxygen saturation cannot exceed 100%')
        .optional(),
    bloodGlucose: z.number()
        .min(20, 'Blood glucose must be at least 20 mg/dL')
        .max(800, 'Blood glucose cannot exceed 800 mg/dL')
        .optional(),
});

export const symptomsSchema = z.object({
    subjective: z.array(z.string().min(1, 'Symptom cannot be empty'))
        .min(1, 'At least one subjective symptom is required'),
    objective: z.array(z.string().min(1, 'Sign cannot be empty'))
        .optional()
        .default([]),
    duration: z.string()
        .min(1, 'Duration is required')
        .max(100, 'Duration cannot exceed 100 characters'),
    severity: z.enum(['mild', 'moderate', 'severe'], {
        message: 'Severity must be mild, moderate, or severe',
    }),
    onset: z.enum(['acute', 'chronic', 'subacute'], {
        message: 'Onset must be acute, chronic, or subacute',
    }),
});

export const medicationSchema = z.object({
    name: z.string().min(1, 'Medication name is required'),
    dosage: z.string().min(1, 'Dosage is required'),
    frequency: z.string().min(1, 'Frequency is required'),
});

export const labResultSchema = z.object({
    testName: z.string().min(1, 'Test name is required'),
    value: z.string().min(1, 'Test value is required'),
    referenceRange: z.string().min(1, 'Reference range is required'),
    abnormal: z.boolean(),
});

export const patientConsentSchema = z.object({
    provided: z.boolean().refine(val => val === true, {
        message: 'Patient consent is required for AI diagnostic analysis',
    }),
    method: z.enum(['electronic', 'verbal', 'written'], {
        message: 'Consent method must be specified',
    }),
});

export const diagnosticRequestSchema = z.object({
    patientId: z.string().min(1, 'Patient selection is required'),
    symptoms: symptomsSchema,
    vitalSigns: vitalSignsSchema.optional(),
    currentMedications: z.array(medicationSchema).optional().default([]),
    labResults: z.array(labResultSchema).optional().default([]),
    patientConsent: patientConsentSchema,
});

// Validation error types
export interface ValidationError {
    field: string;
    message: string;
    path: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    data?: any;
}

// Validation functions
export const validateDiagnosticRequest = (data: any): ValidationResult => {
    try {
        const validatedData = diagnosticRequestSchema.parse(data);
        return {
            isValid: true,
            errors: [],
            data: validatedData,
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.issues.map((err: z.ZodIssue) => ({
                field: err.path.join('.'),
                message: err.message,
                path: err.path as string[],
            }));
            return {
                isValid: false,
                errors,
            };
        }
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation failed', path: [] }],
        };
    }
};

export const validateVitalSigns = (data: any): ValidationResult => {
    try {
        const validatedData = vitalSignsSchema.parse(data);
        return {
            isValid: true,
            errors: [],
            data: validatedData,
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.issues.map((err: z.ZodIssue) => ({
                field: err.path.join('.'),
                message: err.message,
                path: err.path as string[],
            }));
            return {
                isValid: false,
                errors,
            };
        }
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation failed', path: [] }],
        };
    }
};

export const validateSymptoms = (data: any): ValidationResult => {
    try {
        const validatedData = symptomsSchema.parse(data);
        return {
            isValid: true,
            errors: [],
            data: validatedData,
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.issues.map((err: z.ZodIssue) => ({
                field: err.path.join('.'),
                message: err.message,
                path: err.path as string[],
            }));
            return {
                isValid: false,
                errors,
            };
        }
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation failed', path: [] }],
        };
    }
};

// Helper functions
export const getFieldError = (errors: ValidationError[], fieldPath: string): string | undefined => {
    const error = errors.find(err => err.field === fieldPath);
    return error?.message;
};

export const hasFieldError = (errors: ValidationError[], fieldPath: string): boolean => {
    return errors.some(err => err.field === fieldPath);
};

export const getNestedFieldError = (errors: ValidationError[], fieldPath: string[]): string | undefined => {
    const pathString = fieldPath.join('.');
    const error = errors.find(err => err.field === pathString);
    return error?.message;
};

// Form validation state management
export interface FormValidationState {
    errors: ValidationError[];
    touched: Record<string, boolean>;
    isSubmitting: boolean;
    isValid: boolean;
}

export const createInitialValidationState = (): FormValidationState => ({
    errors: [],
    touched: {},
    isSubmitting: false,
    isValid: false,
});

export const updateValidationState = (
    state: FormValidationState,
    updates: Partial<FormValidationState>
): FormValidationState => ({
    ...state,
    ...updates,
});

// Real-time validation helpers
export const validateFieldRealTime = (
    fieldName: string,
    value: any,
    schema: z.ZodSchema
): ValidationError | null => {
    try {
        schema.parse({ [fieldName]: value });
        return null;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const firstError = error.issues[0];
            if (firstError) {
                return {
                    field: fieldName,
                    message: firstError.message,
                    path: firstError.path as string[],
                };
            }
        }
        return null;
    }
};

// Backend error mapping
export const mapBackendErrors = (backendErrors: any[]): ValidationError[] => {
    if (!Array.isArray(backendErrors)) return [];

    return backendErrors.map(error => ({
        field: error.path || error.field || 'general',
        message: error.msg || error.message || 'Validation error',
        path: error.path ? error.path.split('.') : [],
    }));
};

// Form submission helpers
export const canSubmitForm = (
    validationState: FormValidationState,
    requiredFields: string[]
): boolean => {
    // Check if all required fields are touched and valid
    const allRequiredTouched = requiredFields.every(field =>
        validationState.touched[field]
    );

    // Check if there are no errors for required fields
    const noRequiredFieldErrors = !requiredFields.some(field =>
        validationState.errors.some(error => error.field.startsWith(field))
    );

    return allRequiredTouched && noRequiredFieldErrors && !validationState.isSubmitting;
};

export const getFormProgress = (
    validationState: FormValidationState,
    requiredFields: string[]
): number => {
    const touchedRequiredFields = requiredFields.filter(field =>
        validationState.touched[field]
    );

    return Math.round((touchedRequiredFields.length / requiredFields.length) * 100);
};