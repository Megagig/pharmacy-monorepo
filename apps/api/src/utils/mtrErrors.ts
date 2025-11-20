/**
 * Custom Error Classes for MTR Module
 * Provides specific error types for different MTR validation and business logic scenarios
 * Requirements: 2.4, 4.4, 7.1, 8.4
 */

export interface MTRErrorDetails {
    field?: string;
    message: string;
    value?: any;
    location?: string;
    code?: string;
}

/**
 * Base MTR Error Class
 */
export class MTRError extends Error {
    public statusCode: number;
    public errorType: string;
    public details?: MTRErrorDetails[];
    public timestamp: Date;
    public isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        errorType: string = 'MTRError',
        details?: MTRErrorDetails[]
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
 * MTR Validation Error
 * Used for input validation failures (Requirement 2.4)
 */
export class MTRValidationError extends MTRError {
    constructor(message: string, details?: MTRErrorDetails[]) {
        super(message, 400, 'MTRValidationError', details);
    }
}

/**
 * MTR Authorization Error
 * Used for access control and permission failures (Requirement 8.4)
 */
export class MTRAuthorizationError extends MTRError {
    constructor(message: string, details?: MTRErrorDetails[]) {
        super(message, 403, 'MTRAuthorizationError', details);
    }
}

/**
 * MTR Authentication Error
 * Used for authentication failures (Requirement 8.4)
 */
export class MTRAuthenticationError extends MTRError {
    constructor(message: string, details?: MTRErrorDetails[]) {
        super(message, 401, 'MTRAuthenticationError', details);
    }
}

/**
 * MTR Business Logic Error
 * Used for business rule violations (Requirement 4.4)
 */
export class MTRBusinessLogicError extends MTRError {
    constructor(message: string, details?: MTRErrorDetails[]) {
        super(message, 422, 'MTRBusinessLogicError', details);
    }
}

/**
 * MTR Not Found Error
 * Used when MTR resources are not found
 */
export class MTRNotFoundError extends MTRError {
    constructor(message: string, resourceType?: string, resourceId?: string) {
        const details: MTRErrorDetails[] = [];

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

        super(message, 404, 'MTRNotFoundError', details);
    }
}

/**
 * MTR Conflict Error
 * Used for resource conflicts (e.g., duplicate MTR sessions)
 */
export class MTRConflictError extends MTRError {
    constructor(message: string, details?: MTRErrorDetails[]) {
        super(message, 409, 'MTRConflictError', details);
    }
}

/**
 * MTR Database Error
 * Used for database operation failures
 */
export class MTRDatabaseError extends MTRError {
    constructor(message: string, operation?: string, details?: MTRErrorDetails[]) {
        const errorDetails = details || [];

        if (operation) {
            errorDetails.push({
                field: 'operation',
                message: `Database operation failed: ${operation}`,
                value: operation
            });
        }

        super(message, 500, 'MTRDatabaseError', errorDetails);
    }
}

/**
 * MTR External Service Error
 * Used for external API/service failures (e.g., drug database)
 */
export class MTRExternalServiceError extends MTRError {
    constructor(message: string, service?: string, details?: MTRErrorDetails[]) {
        const errorDetails = details || [];

        if (service) {
            errorDetails.push({
                field: 'service',
                message: `External service error: ${service}`,
                value: service
            });
        }

        super(message, 502, 'MTRExternalServiceError', errorDetails);
    }
}

/**
 * MTR Rate Limit Error
 * Used for rate limiting violations
 */
export class MTRRateLimitError extends MTRError {
    constructor(message: string, limit?: number, windowMs?: number) {
        const details: MTRErrorDetails[] = [];

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

        super(message, 429, 'MTRRateLimitError', details);
    }
}

/**
 * MTR Audit Error
 * Used for audit logging failures (Requirement 7.1)
 */
export class MTRAuditError extends MTRError {
    constructor(message: string, auditAction?: string, details?: MTRErrorDetails[]) {
        const errorDetails = details || [];

        if (auditAction) {
            errorDetails.push({
                field: 'auditAction',
                message: `Audit logging failed for action: ${auditAction}`,
                value: auditAction
            });
        }

        super(message, 500, 'MTRAuditError', errorDetails);
    }
}

/**
 * Error Factory Functions
 */
export const createMTRValidationError = (
    field: string,
    message: string,
    value?: any
): MTRValidationError => {
    return new MTRValidationError('Validation failed', [{
        field,
        message,
        value
    }]);
};

export const createMTRAuthorizationError = (
    action: string,
    resource?: string
): MTRAuthorizationError => {
    const message = resource
        ? `Insufficient permissions to ${action} ${resource}`
        : `Insufficient permissions to ${action}`;

    return new MTRAuthorizationError(message, [{
        field: 'action',
        message: `Action not authorized: ${action}`,
        value: action
    }]);
};

export const createMTRBusinessLogicError = (
    rule: string,
    context?: string
): MTRBusinessLogicError => {
    const message = context
        ? `Business rule violation: ${rule} in ${context}`
        : `Business rule violation: ${rule}`;

    return new MTRBusinessLogicError(message, [{
        field: 'businessRule',
        message: `Rule violated: ${rule}`,
        value: rule
    }]);
};

/**
 * Error Type Guards
 */
export const isMTRError = (error: any): error is MTRError => {
    return error instanceof MTRError;
};

export const isMTRValidationError = (error: any): error is MTRValidationError => {
    return error instanceof MTRValidationError;
};

export const isMTRAuthorizationError = (error: any): error is MTRAuthorizationError => {
    return error instanceof MTRAuthorizationError;
};

export const isMTRBusinessLogicError = (error: any): error is MTRBusinessLogicError => {
    return error instanceof MTRBusinessLogicError;
};

/**
 * Error Severity Levels
 */
export enum MTRErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Get error severity based on error type and status code
 */
export const getMTRErrorSeverity = (error: MTRError): MTRErrorSeverity => {
    if (error.statusCode >= 500) {
        return MTRErrorSeverity.CRITICAL;
    }

    if (error instanceof MTRAuthorizationError || error instanceof MTRAuthenticationError) {
        return MTRErrorSeverity.HIGH;
    }

    if (error instanceof MTRBusinessLogicError) {
        return MTRErrorSeverity.MEDIUM;
    }

    return MTRErrorSeverity.LOW;
};

/**
 * Error Recovery Suggestions
 */
export const getMTRErrorRecovery = (error: MTRError): string[] => {
    const suggestions: string[] = [];

    if (error instanceof MTRValidationError) {
        suggestions.push('Check input data format and required fields');
        suggestions.push('Verify all medication details are complete');
        suggestions.push('Ensure dates are in valid format');
    }

    if (error instanceof MTRAuthorizationError) {
        suggestions.push('Verify your pharmacist credentials');
        suggestions.push('Check your license status');
        suggestions.push('Contact your administrator for access');
    }

    if (error instanceof MTRBusinessLogicError) {
        suggestions.push('Review MTR workflow requirements');
        suggestions.push('Complete previous steps before proceeding');
        suggestions.push('Verify therapy plan links to identified problems');
    }

    if (error instanceof MTRDatabaseError) {
        suggestions.push('Try the operation again');
        suggestions.push('Check your network connection');
        suggestions.push('Contact support if the issue persists');
    }

    return suggestions;
};