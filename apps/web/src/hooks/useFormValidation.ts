import { useState, useCallback, useEffect } from 'react';
import {
  ValidationError,
  FormValidationState,
  createInitialValidationState,
  updateValidationState,
  mapBackendErrors,
  canSubmitForm,
  getFormProgress,
} from '../utils/diagnosticValidation';

interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  requiredFields?: string[];
  validationSchema?: any;
}

interface UseFormValidationReturn {
  validationState: FormValidationState;
  errors: ValidationError[];
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  progress: number;
  setFieldTouched: (field: string, touched?: boolean) => void;
  setFieldError: (field: string, error: string | null) => void;
  setErrors: (errors: ValidationError[]) => void;
  setBackendErrors: (backendErrors: any[]) => void;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  validateField: (field: string, value: any) => Promise<boolean>;
  validateForm: (data: any) => Promise<boolean>;
  setSubmitting: (submitting: boolean) => void;
  reset: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
  isFieldTouched: (field: string) => boolean;
}

export const useFormValidation = (
  options: UseFormValidationOptions = {}
): UseFormValidationReturn => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    requiredFields = [],
    validationSchema,
  } = options;

  const [validationState, setValidationState] = useState<FormValidationState>(
    createInitialValidationState()
  );

  // Computed values
  const canSubmit = canSubmitForm(validationState, requiredFields);
  const progress = getFormProgress(validationState, requiredFields);

  // Set field as touched
  const setFieldTouched = useCallback((field: string, touched: boolean = true) => {
    setValidationState(prev => updateValidationState(prev, {
      touched: {
        ...prev.touched,
        [field]: touched,
      },
    }));
  }, []);

  // Set field error
  const setFieldError = useCallback((field: string, error: string | null) => {
    setValidationState(prev => {
      const newErrors = prev.errors.filter(err => err.field !== field);
      if (error) {
        newErrors.push({
          field,
          message: error,
          path: field.split('.'),
        });
      }
      
      return updateValidationState(prev, {
        errors: newErrors,
        isValid: newErrors.length === 0,
      });
    });
  }, []);

  // Set multiple errors
  const setErrors = useCallback((errors: ValidationError[]) => {
    setValidationState(prev => updateValidationState(prev, {
      errors,
      isValid: errors.length === 0,
    }));
  }, []);

  // Set backend errors
  const setBackendErrors = useCallback((backendErrors: any[]) => {
    const mappedErrors = mapBackendErrors(backendErrors);
    setErrors(mappedErrors);
  }, [setErrors]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setValidationState(prev => updateValidationState(prev, {
      errors: [],
      isValid: true,
    }));
  }, []);

  // Clear field error
  const clearFieldError = useCallback((field: string) => {
    setFieldError(field, null);
  }, [setFieldError]);

  // Validate single field
  const validateField = useCallback(async (field: string, value: any): Promise<boolean> => {
    if (!validationSchema) return true;

    try {
      // Create a partial object for validation
      const fieldData = { [field]: value };
      await validationSchema.parseAsync(fieldData);
      clearFieldError(field);
      return true;
    } catch (error: any) {
      if (error.errors && error.errors.length > 0) {
        const fieldError = error.errors.find((err: any) => 
          err.path.includes(field) || err.path[0] === field
        );
        if (fieldError) {
          setFieldError(field, fieldError.message);
          return false;
        }
      }
      return true; // If no specific field error, consider it valid
    }
  }, [validationSchema, clearFieldError, setFieldError]);

  // Validate entire form
  const validateForm = useCallback(async (data: any): Promise<boolean> => {
    if (!validationSchema) return true;

    try {
      await validationSchema.parseAsync(data);
      clearErrors();
      return true;
    } catch (error: any) {
      if (error.errors) {
        const validationErrors: ValidationError[] = error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          path: err.path,
        }));
        setErrors(validationErrors);
        return false;
      }
      return false;
    }
  }, [validationSchema, clearErrors, setErrors]);

  // Set submitting state
  const setSubmitting = useCallback((submitting: boolean) => {
    setValidationState(prev => updateValidationState(prev, {
      isSubmitting: submitting,
    }));
  }, []);

  // Reset validation state
  const reset = useCallback(() => {
    setValidationState(createInitialValidationState());
  }, []);

  // Get field error
  const getFieldError = useCallback((field: string): string | undefined => {
    const error = validationState.errors.find(err => err.field === field);
    return error?.message;
  }, [validationState.errors]);

  // Check if field has error
  const hasFieldError = useCallback((field: string): boolean => {
    return validationState.errors.some(err => err.field === field);
  }, [validationState.errors]);

  // Check if field is touched
  const isFieldTouched = useCallback((field: string): boolean => {
    return validationState.touched[field] || false;
  }, [validationState.touched]);

  return {
    validationState,
    errors: validationState.errors,
    touched: validationState.touched,
    isValid: validationState.isValid,
    isSubmitting: validationState.isSubmitting,
    canSubmit,
    progress,
    setFieldTouched,
    setFieldError,
    setErrors,
    setBackendErrors,
    clearErrors,
    clearFieldError,
    validateField,
    validateForm,
    setSubmitting,
    reset,
    getFieldError,
    hasFieldError,
    isFieldTouched,
  };
};

export default useFormValidation;