import logger from './logger';

// Clinical Intervention Error Types
export enum ClinicalInterventionErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
    INTERVENTION_NOT_FOUND = 'INTERVENTION_NOT_FOUND',
    DUPLICATE_INTERVENTION = 'DUPLICATE_INTERVENTION',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    STRATEGY_VALIDATION_ERROR = 'STRATEGY_VALIDATION_ERROR',
    ASSIGNMENT_ERROR = 'ASSIGNMENT_ERROR',
    OUTCOME_VALIDATION_ERROR = 'OUTCOME_VALIDATION_ERROR',
    BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
    INTEGRATION_ERROR = 'INTEGRATION_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Error Severity Levels
export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

// Recovery Actions
export enum RecoveryAction {
    RETRY = 'RETRY',
    REFRESH = 'REFRESH',
    CONTACT_SUPPORT = 'CONTACT_SUPPORT',
    CHECK_PERMISSIONS = 'CHECK_PERMISSIONS',
    VALIDATE_INPUT = 'VALIDATE_INPUT',
    CHECK_NETWORK = 'CHECK_NETWORK',
    NONE = 'NONE'
}

// Base Clinical Intervention Error Class
export class ClinicalInterventionError extends Error {
    public readonly errorType: ClinicalInterventionErrorType;
    public readonly statusCode: number;
    public readonly severity: ErrorSeverity;
    public readonly recoveryAction: RecoveryAction;
    public readonly details: Record<string, any>;
    public readonly timestamp: Date;
    public readonly userMessage: string;
    public readonly technicalMessage: string;

    constructor(
        errorType: ClinicalInterventionErrorType,
        userMessage: string,
        technicalMessage?: string,
        statusCode: number = 400,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        recoveryAction: RecoveryAction = RecoveryAction.NONE,
        details: Record<string, any> = {}
    ) {
        super(technicalMessage || userMessage);

        this.name = 'ClinicalInterventionError';
        this.errorType = errorType;
        this.statusCode = statusCode;
        this.severity = severity;
        this.recoveryAction = recoveryAction;
        this.details = details;
        this.timestamp = new Date();
        this.userMessage = userMessage;
        this.technicalMessage = technicalMessage || userMessage;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    // Convert error to JSON response format
    toJSON() {
        return {
            success: false,
            error: {
                type: this.errorType,
                message: this.userMessage,
                severity: this.severity,
                recoveryAction: this.recoveryAction,
                details: this.details,
                timestamp: this.timestamp.toISOString(),
                ...(process.env.NODE_ENV === 'development' && {
                    technicalMessage: this.technicalMessage,
                    stack: this.stack
                })
            }
        };
    }

    // Log error with appropriate level
    log(userId?: string, endpoint?: string, additionalContext?: Record<string, any>) {
        const logLevel = this.severity === ErrorSeverity.CRITICAL ? 'error' :
            this.severity === ErrorSeverity.HIGH ? 'warn' : 'info';

        logger[logLevel]('Clinical Intervention Error', {
            errorType: this.errorType,
            userMessage: this.userMessage,
            technicalMessage: this.technicalMessage,
            statusCode: this.statusCode,
            severity: this.severity,
            recoveryAction: this.recoveryAction,
            details: this.details,
            userId,
            endpoint,
            timestamp: this.timestamp,
            ...additionalContext,
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        });
    }
}

// Specific Error Classes
export class ValidationError extends ClinicalInterventionError {
    constructor(
        message: string,
        field?: string,
        value?: any,
        details: Record<string, any> = {}
    ) {
        super(
            ClinicalInterventionErrorType.VALIDATION_ERROR,
            message,
            `Validation failed for field: ${field}`,
            400,
            ErrorSeverity.LOW,
            RecoveryAction.VALIDATE_INPUT,
            { field, value, ...details }
        );
    }
}

export class PatientNotFoundError extends ClinicalInterventionError {
    constructor(patientId: string) {
        super(
            ClinicalInterventionErrorType.PATIENT_NOT_FOUND,
            'The selected patient was not found or you do not have access to their records',
            `Patient with ID ${patientId} not found`,
            404,
            ErrorSeverity.MEDIUM,
            RecoveryAction.REFRESH,
            { patientId }
        );
    }
}

export class InterventionNotFoundError extends ClinicalInterventionError {
    constructor(interventionId: string) {
        super(
            ClinicalInterventionErrorType.INTERVENTION_NOT_FOUND,
            'The requested intervention was not found',
            `Intervention with ID ${interventionId} not found`,
            404,
            ErrorSeverity.MEDIUM,
            RecoveryAction.REFRESH,
            { interventionId }
        );
    }
}

export class DuplicateInterventionError extends ClinicalInterventionError {
    constructor(patientId: string, category: string, existingInterventions: string[]) {
        super(
            ClinicalInterventionErrorType.DUPLICATE_INTERVENTION,
            'A similar intervention already exists for this patient and category',
            `Duplicate intervention detected for patient ${patientId} in category ${category}`,
            409,
            ErrorSeverity.MEDIUM,
            RecoveryAction.VALIDATE_INPUT,
            { patientId, category, existingInterventions }
        );
    }
}

export class PermissionDeniedError extends ClinicalInterventionError {
    constructor(action: string, requiredRole?: string) {
        super(
            ClinicalInterventionErrorType.PERMISSION_DENIED,
            'You do not have permission to perform this action',
            `Permission denied for action: ${action}`,
            403,
            ErrorSeverity.HIGH,
            RecoveryAction.CHECK_PERMISSIONS,
            { action, requiredRole }
        );
    }
}

export class StrategyValidationError extends ClinicalInterventionError {
    constructor(message: string, strategyIndex?: number, details: Record<string, any> = {}) {
        super(
            ClinicalInterventionErrorType.STRATEGY_VALIDATION_ERROR,
            message,
            `Strategy validation failed: ${message}`,
            400,
            ErrorSeverity.LOW,
            RecoveryAction.VALIDATE_INPUT,
            { strategyIndex, ...details }
        );
    }
}

export class AssignmentError extends ClinicalInterventionError {
    constructor(message: string, userId?: string, role?: string) {
        super(
            ClinicalInterventionErrorType.ASSIGNMENT_ERROR,
            message,
            `Team assignment failed: ${message}`,
            400,
            ErrorSeverity.MEDIUM,
            RecoveryAction.CHECK_PERMISSIONS,
            { userId, role }
        );
    }
}

export class OutcomeValidationError extends ClinicalInterventionError {
    constructor(message: string, details: Record<string, any> = {}) {
        super(
            ClinicalInterventionErrorType.OUTCOME_VALIDATION_ERROR,
            message,
            `Outcome validation failed: ${message}`,
            400,
            ErrorSeverity.LOW,
            RecoveryAction.VALIDATE_INPUT,
            details
        );
    }
}

export class BusinessRuleViolationError extends ClinicalInterventionError {
    constructor(rule: string, message: string, details: Record<string, any> = {}) {
        super(
            ClinicalInterventionErrorType.BUSINESS_RULE_VIOLATION,
            message,
            `Business rule violation: ${rule}`,
            400,
            ErrorSeverity.MEDIUM,
            RecoveryAction.VALIDATE_INPUT,
            { rule, ...details }
        );
    }
}

export class IntegrationError extends ClinicalInterventionError {
    constructor(service: string, message: string, details: Record<string, any> = {}) {
        super(
            ClinicalInterventionErrorType.INTEGRATION_ERROR,
            `Integration with ${service} failed. Please try again later.`,
            `Integration error with ${service}: ${message}`,
            502,
            ErrorSeverity.HIGH,
            RecoveryAction.RETRY,
            { service, ...details }
        );
    }
}

export class NetworkError extends ClinicalInterventionError {
    constructor(message: string = 'Network connection failed') {
        super(
            ClinicalInterventionErrorType.NETWORK_ERROR,
            'Network connection failed. Please check your internet connection and try again.',
            message,
            503,
            ErrorSeverity.HIGH,
            RecoveryAction.CHECK_NETWORK
        );
    }
}

export class DatabaseError extends ClinicalInterventionError {
    constructor(operation: string, message: string, details: Record<string, any> = {}) {
        super(
            ClinicalInterventionErrorType.DATABASE_ERROR,
            'A database error occurred. Please try again later.',
            `Database error during ${operation}: ${message}`,
            500,
            ErrorSeverity.CRITICAL,
            RecoveryAction.RETRY,
            { operation, ...details }
        );
    }
}

// Error Type Guards
export const isClinicalInterventionError = (error: any): error is ClinicalInterventionError => {
    return error instanceof ClinicalInterventionError;
};

export const isValidationError = (error: any): error is ValidationError => {
    return error instanceof ValidationError;
};

export const isPermissionError = (error: any): error is PermissionDeniedError => {
    return error instanceof PermissionDeniedError;
};

export const isNetworkError = (error: any): error is NetworkError => {
    return error instanceof NetworkError;
};

// Error Factory Functions
export const createValidationError = (field: string, message: string, value?: any) => {
    return new ValidationError(message, field, value);
};

export const createPermissionError = (action: string, requiredRole?: string) => {
    return new PermissionDeniedError(action, requiredRole);
};

export const createNotFoundError = (type: 'patient' | 'intervention', id: string) => {
    return type === 'patient'
        ? new PatientNotFoundError(id)
        : new InterventionNotFoundError(id);
};

// Error Recovery Suggestions
export const getRecoveryInstructions = (error: ClinicalInterventionError): string[] => {
    switch (error.recoveryAction) {
        case RecoveryAction.RETRY:
            return [
                'Wait a moment and try again',
                'Check your internet connection',
                'If the problem persists, contact support'
            ];

        case RecoveryAction.REFRESH:
            return [
                'Refresh the page and try again',
                'Make sure you have the latest data',
                'Check if the item still exists'
            ];

        case RecoveryAction.VALIDATE_INPUT:
            return [
                'Check your input for errors',
                'Make sure all required fields are filled',
                'Verify the data format is correct'
            ];

        case RecoveryAction.CHECK_PERMISSIONS:
            return [
                'Contact your administrator for access',
                'Make sure you have the required permissions',
                'Try logging out and back in'
            ];

        case RecoveryAction.CHECK_NETWORK:
            return [
                'Check your internet connection',
                'Try refreshing the page',
                'Contact IT support if connection issues persist'
            ];

        case RecoveryAction.CONTACT_SUPPORT:
            return [
                'Contact technical support',
                'Provide the error details and timestamp',
                'Include steps to reproduce the issue'
            ];

        default:
            return [
                'Try the action again',
                'If the problem persists, contact support'
            ];
    }
};

// Error Metrics and Monitoring
export const trackError = (error: ClinicalInterventionError, context: Record<string, any> = {}) => {
    // Log error for monitoring
    error.log(context.userId, context.endpoint, context);

    // Track error metrics (could integrate with monitoring service)
    if (process.env.NODE_ENV === 'production') {
        // Example: Send to monitoring service
        // monitoringService.trackError(error, context);
    }
};

export default {
    ClinicalInterventionError,
    ValidationError,
    PatientNotFoundError,
    InterventionNotFoundError,
    DuplicateInterventionError,
    PermissionDeniedError,
    StrategyValidationError,
    AssignmentError,
    OutcomeValidationError,
    BusinessRuleViolationError,
    IntegrationError,
    NetworkError,
    DatabaseError,
    isClinicalInterventionError,
    isValidationError,
    isPermissionError,
    isNetworkError,
    createValidationError,
    createPermissionError,
    createNotFoundError,
    getRecoveryInstructions,
    trackError
};