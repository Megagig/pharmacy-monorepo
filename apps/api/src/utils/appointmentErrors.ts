/**
 * Custom Error Classes for Appointment & Follow-up Module
 * Provides specific error types for different appointment validation and business logic scenarios
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2
 */

export interface AppointmentErrorDetails {
    field?: string;
    message: string;
    value?: any;
    location?: string;
    code?: string;
}

/**
 * Base Appointment Error Class
 */
export class AppointmentError extends Error {
    public statusCode: number;
    public errorType: string;
    public details?: AppointmentErrorDetails[];
    public timestamp: Date;
    public isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        errorType: string = 'AppointmentError',
        details?: AppointmentErrorDetails[]
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.details = details;
        this.timestamp = new Date();
        this.isOperational = true;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            errorType: this.errorType,
            details: this.details,
            timestamp: this.timestamp,
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

/**
 * Appointment Validation Error
 * Used for input validation failures (Requirement 1.1, 1.2)
 */
export class ValidationError extends AppointmentError {
    constructor(message: string, details?: AppointmentErrorDetails[]) {
        super(message, 400, 'ValidationError', details);
    }
}

/**
 * Appointment Conflict Error
 * Used for scheduling conflicts (Requirement 1.4)
 */
export class ConflictError extends AppointmentError {
    constructor(message: string, details?: AppointmentErrorDetails[]) {
        super(message, 409, 'ConflictError', details);
    }
}

/**
 * Appointment Authorization Error
 * Used for access control and permission failures
 */
export class AppointmentAuthorizationError extends AppointmentError {
    constructor(message: string, details?: AppointmentErrorDetails[]) {
        super(message, 403, 'AppointmentAuthorizationError', details);
    }
}

/**
 * Appointment Authentication Error
 * Used for authentication failures
 */
export class AppointmentAuthenticationError extends AppointmentError {
    constructor(message: string, details?: AppointmentErrorDetails[]) {
        super(message, 401, 'AppointmentAuthenticationError', details);
    }
}

/**
 * Appointment Business Logic Error
 * Used for business rule violations (Requirement 1.3, 1.4)
 */
export class AppointmentBusinessLogicError extends AppointmentError {
    constructor(message: string, details?: AppointmentErrorDetails[]) {
        super(message, 422, 'AppointmentBusinessLogicError', details);
    }
}

/**
 * Appointment Not Found Error
 * Used when appointment resources are not found
 */
export class AppointmentNotFoundError extends AppointmentError {
    constructor(message: string, resourceType?: string, resourceId?: string) {
        const details: AppointmentErrorDetails[] = [];

        if (resourceType) {
            details.push({
                field: 'resourceType',
                message: `${resourceType} not found`,
                value: resourceType
            });
        }

        if (resourceId) {
            details.push({
                field: 'resourceId',
                message: 'Resource ID not found',
                value: resourceId
            });
        }

        super(message, 404, 'AppointmentNotFoundError', details);
    }
}

/**
 * Appointment Database Error
 * Used for database operation failures
 */
export class AppointmentDatabaseError extends AppointmentError {
    constructor(message: string, operation?: string, details?: AppointmentErrorDetails[]) {
        const errorDetails = details || [];

        if (operation) {
            errorDetails.push({
                field: 'operation',
                message: `Database operation failed: ${operation}`,
                value: operation
            });
        }

        super(message, 500, 'AppointmentDatabaseError', errorDetails);
    }
}

/**
 * Appointment External Service Error
 * Used for external API/service failures (e.g., notification service)
 */
export class AppointmentExternalServiceError extends AppointmentError {
    constructor(message: string, service?: string, details?: AppointmentErrorDetails[]) {
        const errorDetails = details || [];

        if (service) {
            errorDetails.push({
                field: 'service',
                message: `External service error: ${service}`,
                value: service
            });
        }

        super(message, 502, 'AppointmentExternalServiceError', errorDetails);
    }
}

/**
 * Appointment Rate Limit Error
 * Used for rate limiting violations
 */
export class AppointmentRateLimitError extends AppointmentError {
    constructor(message: string, limit?: number, windowMs?: number) {
        const details: AppointmentErrorDetails[] = [];

        if (limit) {
            details.push({
                field: 'limit',
                message: `Rate limit exceeded: ${limit} requests`,
                value: limit
            });
        }

        if (windowMs) {
            details.push({
                field: 'windowMs',
                message: `Rate limit window: ${windowMs}ms`,
                value: windowMs
            });
        }

        super(message, 429, 'AppointmentRateLimitError', details);
    }
}

/**
 * Error Factory Functions
 */
export const createValidationError = (
    field: string,
    message: string,
    value?: any
): ValidationError => {
    return new ValidationError('Validation failed', [{
        field,
        message,
        value
    }]);
};

export const createConflictError = (
    conflictType: string,
    details?: AppointmentErrorDetails[]
): ConflictError => {
    return new ConflictError(`Scheduling conflict: ${conflictType}`, details);
};

export const createAppointmentAuthorizationError = (
    action: string,
    resource?: string
): AppointmentAuthorizationError => {
    const message = resource
        ? `Insufficient permissions to ${action} ${resource}`
        : `Insufficient permissions to ${action}`;

    return new AppointmentAuthorizationError(message, [{
        field: 'action',
        message: `Action not authorized: ${action}`,
        value: action
    }]);
};

export const createAppointmentBusinessLogicError = (
    rule: string,
    context?: string
): AppointmentBusinessLogicError => {
    const message = context
        ? `Business rule violation: ${rule} in ${context}`
        : `Business rule violation: ${rule}`;

    return new AppointmentBusinessLogicError(message, [{
        field: 'businessRule',
        message: `Rule violated: ${rule}`,
        value: rule
    }]);
};

/**
 * Error Type Guards
 */
export const isAppointmentError = (error: any): error is AppointmentError => {
    return error instanceof AppointmentError;
};

export const isValidationError = (error: any): error is ValidationError => {
    return error instanceof ValidationError;
};

export const isConflictError = (error: any): error is ConflictError => {
    return error instanceof ConflictError;
};

export const isAppointmentAuthorizationError = (error: any): error is AppointmentAuthorizationError => {
    return error instanceof AppointmentAuthorizationError;
};

export const isAppointmentBusinessLogicError = (error: any): error is AppointmentBusinessLogicError => {
    return error instanceof AppointmentBusinessLogicError;
};

/**
 * Error Severity Levels
 */
export enum AppointmentErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Get error severity based on error type and status code
 */
export const getAppointmentErrorSeverity = (error: AppointmentError): AppointmentErrorSeverity => {
    if (error.statusCode >= 500) {
        return AppointmentErrorSeverity.CRITICAL;
    }

    if (error instanceof AppointmentAuthorizationError || error instanceof AppointmentAuthenticationError) {
        return AppointmentErrorSeverity.HIGH;
    }

    if (error instanceof AppointmentBusinessLogicError || error instanceof ConflictError) {
        return AppointmentErrorSeverity.MEDIUM;
    }

    return AppointmentErrorSeverity.LOW;
};

/**
 * Error Recovery Suggestions
 */
export const getAppointmentErrorRecovery = (error: AppointmentError): string[] => {
    const suggestions: string[] = [];

    if (error instanceof ValidationError) {
        suggestions.push('Check input data format and required fields');
        suggestions.push('Verify appointment date and time are valid');
        suggestions.push('Ensure patient ID is correct');
    }

    if (error instanceof ConflictError) {
        suggestions.push('Choose a different time slot');
        suggestions.push('Check pharmacist availability');
        suggestions.push('Verify patient does not have overlapping appointments');
    }

    if (error instanceof AppointmentAuthorizationError) {
        suggestions.push('Verify your permissions');
        suggestions.push('Contact your administrator for access');
    }

    if (error instanceof AppointmentBusinessLogicError) {
        suggestions.push('Review appointment scheduling rules');
        suggestions.push('Verify appointment type and duration');
        suggestions.push('Check pharmacist schedule and capacity');
    }

    if (error instanceof AppointmentDatabaseError) {
        suggestions.push('Try the operation again');
        suggestions.push('Check your network connection');
        suggestions.push('Contact support if the issue persists');
    }

    return suggestions;
};
