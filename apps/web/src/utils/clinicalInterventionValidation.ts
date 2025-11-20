import DOMPurify from 'dompurify';
import React from 'react';

// Validation result interface
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
    suggestion?: string;
}

// Field validation rules
export interface FieldValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any, formData?: any) => ValidationError | null;
    sanitize?: boolean;
}

// Form validation schema
export interface ValidationSchema {
    [fieldName: string]: FieldValidationRule;
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
        return /^[0-9a-fA-F]{24}$/.test(sanitized) ? sanitized : '';
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

// Real-time validation class
export class ClinicalInterventionValidator {
    private schema: ValidationSchema;
    private businessRules: BusinessRule[];

    constructor(schema: ValidationSchema, businessRules: BusinessRule[] = []) {
        this.schema = schema;
        this.businessRules = businessRules;
    }

    // Validate a single field
    validateField(fieldName: string, value: any, formData?: any): ValidationResult {
        const rule = this.schema[fieldName];
        if (!rule) {
            return { isValid: true, errors: [], warnings: [] };
        }

        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Sanitize input if required
        if (rule.sanitize && typeof value === 'string') {
            value = sanitizeInput.text(value);
        }

        // Required validation
        if (rule.required && this.isEmpty(value)) {
            errors.push({
                field: fieldName,
                message: `${this.getFieldLabel(fieldName)} is required`,
                code: 'REQUIRED',
                severity: 'error'
            });
        }

        // Skip other validations if value is empty and not required
        if (this.isEmpty(value) && !rule.required) {
            return { isValid: true, errors: [], warnings: [] };
        }

        // Length validations
        if (typeof value === 'string') {
            if (rule.minLength && value.length < rule.minLength) {
                errors.push({
                    field: fieldName,
                    message: `${this.getFieldLabel(fieldName)} must be at least ${rule.minLength} characters`,
                    code: 'MIN_LENGTH',
                    severity: 'error'
                });
            }

            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push({
                    field: fieldName,
                    message: `${this.getFieldLabel(fieldName)} must not exceed ${rule.maxLength} characters`,
                    code: 'MAX_LENGTH',
                    severity: 'error'
                });
            }

            // Warning for approaching max length
            if (rule.maxLength && value.length > rule.maxLength * 0.9) {
                warnings.push({
                    field: fieldName,
                    message: `Approaching character limit (${value.length}/${rule.maxLength})`,
                    code: 'APPROACHING_LIMIT',
                    suggestion: 'Consider shortening your text'
                });
            }
        }

        // Pattern validation
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
            errors.push({
                field: fieldName,
                message: `${this.getFieldLabel(fieldName)} format is invalid`,
                code: 'INVALID_FORMAT',
                severity: 'error'
            });
        }

        // Custom validation
        if (rule.custom) {
            const customError = rule.custom(value, formData);
            if (customError) {
                errors.push(customError);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Validate entire form
    validateForm(formData: any): ValidationResult {
        const allErrors: ValidationError[] = [];
        const allWarnings: ValidationWarning[] = [];

        // Validate each field
        Object.keys(this.schema).forEach(fieldName => {
            const fieldValue = this.getNestedValue(formData, fieldName);
            const result = this.validateField(fieldName, fieldValue, formData);

            allErrors.push(...result.errors);
            allWarnings.push(...result.warnings);
        });

        // Run business rules
        this.businessRules.forEach(rule => {
            const ruleResult = rule.validate(formData);
            if (!ruleResult.isValid) {
                allErrors.push(...ruleResult.errors);
            }
            allWarnings.push(...ruleResult.warnings);
        });

        return {
            isValid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings
        };
    }

    // Sanitize form data
    sanitizeFormData(formData: any): any {
        const sanitized = { ...formData };

        Object.keys(this.schema).forEach(fieldName => {
            const rule = this.schema[fieldName];
            if (rule.sanitize) {
                const value = this.getNestedValue(sanitized, fieldName);
                if (typeof value === 'string') {
                    this.setNestedValue(sanitized, fieldName, sanitizeInput.text(value));
                }
            }
        });

        return sanitized;
    }

    private isEmpty(value: any): boolean {
        return value === null ||
            value === undefined ||
            value === '' ||
            (Array.isArray(value) && value.length === 0);
    }

    private getFieldLabel(fieldName: string): string {
        // Convert camelCase to readable labels
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
}

// Business rule interface
export interface BusinessRule {
    name: string;
    validate: (formData: any) => ValidationResult;
}

// Predefined validation schemas
export const interventionValidationSchema: ValidationSchema = {
    patientId: {
        required: true,
        custom: (value) => {
            if (!value || !/^[0-9a-fA-F]{24}$/.test(value)) {
                return {
                    field: 'patientId',
                    message: 'Please select a valid patient',
                    code: 'INVALID_PATIENT',
                    severity: 'error' as const
                };
            }
            return null;
        }
    },

    category: {
        required: true,
        custom: (value) => {
            const validCategories = [
                'drug_therapy_problem',
                'adverse_drug_reaction',
                'medication_nonadherence',
                'drug_interaction',
                'dosing_issue',
                'contraindication',
                'other'
            ];

            if (!validCategories.includes(value)) {
                return {
                    field: 'category',
                    message: 'Please select a valid intervention category',
                    code: 'INVALID_CATEGORY',
                    severity: 'error' as const
                };
            }
            return null;
        }
    },

    issueDescription: {
        required: true,
        minLength: 10,
        maxLength: 1000,
        sanitize: true,
        custom: (value) => {
            // Check for potentially malicious content
            const suspiciousPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /data:text\/html/i
            ];

            if (typeof value === 'string' && suspiciousPatterns.some(pattern => pattern.test(value))) {
                return {
                    field: 'issueDescription',
                    message: 'Description contains potentially unsafe content',
                    code: 'UNSAFE_CONTENT',
                    severity: 'error' as const
                };
            }
            return null;
        }
    },

    priority: {
        required: true,
        custom: (value) => {
            const validPriorities = ['low', 'medium', 'high', 'critical'];
            if (!validPriorities.includes(value)) {
                return {
                    field: 'priority',
                    message: 'Please select a valid priority level',
                    code: 'INVALID_PRIORITY',
                    severity: 'error' as const
                };
            }
            return null;
        }
    },

    'strategies.*.type': {
        required: true,
        custom: (value) => {
            const validTypes = [
                'medication_review',
                'dose_adjustment',
                'alternative_therapy',
                'discontinuation',
                'additional_monitoring',
                'patient_counseling',
                'physician_consultation',
                'custom'
            ];

            if (!validTypes.includes(value)) {
                return {
                    field: 'strategies.*.type',
                    message: 'Please select a valid strategy type',
                    code: 'INVALID_STRATEGY_TYPE',
                    severity: 'error' as const
                };
            }
            return null;
        }
    },

    'strategies.*.description': {
        required: true,
        minLength: 1,
        maxLength: 500,
        sanitize: true
    },

    'strategies.*.rationale': {
        required: true,
        minLength: 1,
        maxLength: 500,
        sanitize: true
    },

    'strategies.*.expectedOutcome': {
        required: true,
        minLength: 20,
        maxLength: 500,
        sanitize: true
    }
};

// Business rules for interventions
export const interventionBusinessRules: BusinessRule[] = [
    {
        name: 'uniqueStrategyTypes',
        validate: (formData) => {
            const errors: ValidationError[] = [];
            const warnings: ValidationWarning[] = [];

            if (formData.strategies && Array.isArray(formData.strategies)) {
                const types = formData.strategies.map((s: any) => s.type);
                const duplicates = types.filter((type: string, index: number) =>
                    types.indexOf(type) !== index
                );

                if (duplicates.length > 0) {
                    errors.push({
                        field: 'strategies',
                        message: 'Duplicate strategy types are not allowed',
                        code: 'DUPLICATE_STRATEGIES',
                        severity: 'error'
                    });
                }
            }

            return { isValid: errors.length === 0, errors, warnings };
        }
    },

    {
        name: 'customStrategyValidation',
        validate: (formData) => {
            const errors: ValidationError[] = [];
            const warnings: ValidationWarning[] = [];

            if (formData.strategies && Array.isArray(formData.strategies)) {
                formData.strategies.forEach((strategy: any, index: number) => {
                    if (strategy.type === 'custom') {
                        if (!strategy.description || strategy.description.length < 20) {
                            errors.push({
                                field: `strategies.${index}.description`,
                                message: 'Custom strategies require detailed description (minimum 20 characters)',
                                code: 'CUSTOM_STRATEGY_INSUFFICIENT_DETAIL',
                                severity: 'error'
                            });
                        }

                        if (!strategy.rationale || strategy.rationale.length < 20) {
                            errors.push({
                                field: `strategies.${index}.rationale`,
                                message: 'Custom strategies require detailed rationale (minimum 20 characters)',
                                code: 'CUSTOM_STRATEGY_INSUFFICIENT_RATIONALE',
                                severity: 'error'
                            });
                        }
                    }
                });
            }

            return { isValid: errors.length === 0, errors, warnings };
        }
    },

    {
        name: 'strategyCount',
        validate: (formData) => {
            const errors: ValidationError[] = [];
            const warnings: ValidationWarning[] = [];

            if (formData.strategies && Array.isArray(formData.strategies)) {
                if (formData.strategies.length === 0) {
                    warnings.push({
                        field: 'strategies',
                        message: 'Consider adding at least one intervention strategy',
                        code: 'NO_STRATEGIES',
                        suggestion: 'Add strategies to improve intervention effectiveness'
                    });
                }

                if (formData.strategies.length > 5) {
                    warnings.push({
                        field: 'strategies',
                        message: 'Many strategies may complicate implementation',
                        code: 'TOO_MANY_STRATEGIES',
                        suggestion: 'Consider focusing on the most important strategies'
                    });
                }
            }

            return { isValid: errors.length === 0, errors, warnings };
        }
    }
];

// Create validator instance
export const interventionValidator = new ClinicalInterventionValidator(
    interventionValidationSchema,
    interventionBusinessRules
);

// Validation hooks for React components
export const useFieldValidation = (fieldName: string, value: any, formData?: any) => {
    const [validationResult, setValidationResult] = React.useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: []
    });

    React.useEffect(() => {
        const result = interventionValidator.validateField(fieldName, value, formData);
        setValidationResult(result);
    }, [fieldName, value, formData]);

    return validationResult;
};

export const useFormValidation = (formData: any) => {
    const [validationResult, setValidationResult] = React.useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: []
    });

    React.useEffect(() => {
        const result = interventionValidator.validateForm(formData);
        setValidationResult(result);
    }, [formData]);

    return validationResult;
};

// Debounced validation hook
export const useDebouncedValidation = (
    fieldName: string,
    value: any,
    formData?: any,
    delay: number = 300
) => {
    const [validationResult, setValidationResult] = React.useState<ValidationResult>({
        isValid: true,
        errors: [],
        warnings: []
    });

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            const result = interventionValidator.validateField(fieldName, value, formData);
            setValidationResult(result);
        }, delay);

        return () => clearTimeout(timeoutId);
    }, [fieldName, value, formData, delay]);

    return validationResult;
};

// Utility functions
export const getErrorMessage = (errors: ValidationError[], fieldName: string): string | null => {
    const error = errors.find(e => e.field === fieldName);
    return error ? error.message : null;
};

export const hasError = (errors: ValidationError[], fieldName: string): boolean => {
    return errors.some(e => e.field === fieldName);
};

export const getWarnings = (warnings: ValidationWarning[], fieldName: string): ValidationWarning[] => {
    return warnings.filter(w => w.field === fieldName);
};

export const sanitizeFormData = (formData: any): any => {
    return interventionValidator.sanitizeFormData(formData);
};

export default {
    ClinicalInterventionValidator,
    interventionValidator,
    interventionValidationSchema,
    interventionBusinessRules,
    sanitizeInput,
    useFieldValidation,
    useFormValidation,
    useDebouncedValidation,
    getErrorMessage,
    hasError,
    getWarnings,
    sanitizeFormData
};