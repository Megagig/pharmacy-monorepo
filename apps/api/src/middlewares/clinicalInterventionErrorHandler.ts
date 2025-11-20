import { Request, Response, NextFunction } from 'express';
import {
    ClinicalInterventionError,
    isClinicalInterventionError,
    trackError,
    ErrorSeverity,
    RecoveryAction
} from '../utils/clinicalInterventionErrors';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
        workplaceId: string;
    };
}

interface ErrorContext {
    userId?: string;
    workplaceId?: string;
    endpoint: string;
    method: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
    requestId?: string;
}

// Enhanced error handler middleware for clinical interventions
export const clinicalInterventionErrorHandler = (
    error: Error | ClinicalInterventionError,
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    const context: ErrorContext = {
        userId: req.user?.id,
        workplaceId: req.user?.workplaceId,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string || generateRequestId()
    };

    // Handle clinical intervention specific errors
    if (isClinicalInterventionError(error)) {
        handleClinicalInterventionError(error, req, res, context);
        return;
    }

    // Handle other error types and convert them to clinical intervention errors
    const convertedError = convertToClinicalInterventionError(error);
    handleClinicalInterventionError(convertedError, req, res, context);
};

// Handle clinical intervention errors
const handleClinicalInterventionError = (
    error: ClinicalInterventionError,
    req: AuthenticatedRequest,
    res: Response,
    context: ErrorContext
): void => {
    // Track error for monitoring
    trackError(error, context);

    // Log error with context
    error.log(context.userId, context.endpoint, {
        workplaceId: context.workplaceId,
        method: context.method,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId
    });

    // Send structured error response
    const errorResponse: any = {
        ...error.toJSON(),
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString()
    };

    // Add recovery instructions for client
    if (error.recoveryAction !== RecoveryAction.NONE) {
        errorResponse.error.recoveryInstructions = getRecoveryInstructions(error.recoveryAction);
    }

    // Add rate limiting info if applicable
    if (error.statusCode === 429) {
        const retryAfter = getRetryAfterSeconds(error);
        res.set('Retry-After', retryAfter.toString());
        errorResponse.error.retryAfter = retryAfter;
    }

    res.status(error.statusCode).json(errorResponse);
};

// Convert generic errors to clinical intervention errors
const convertToClinicalInterventionError = (error: Error): ClinicalInterventionError => {
    // Mongoose validation errors
    if (error.name === 'ValidationError') {
        const mongooseError = error as any;
        const validationErrors = Object.values(mongooseError.errors).map((err: any) => ({
            field: err.path,
            message: err.message,
            value: err.value
        }));

        return new ClinicalInterventionError(
            'VALIDATION_ERROR' as any,
            'Validation failed. Please check your input.',
            `Mongoose validation error: ${error.message}`,
            400,
            ErrorSeverity.LOW,
            RecoveryAction.VALIDATE_INPUT,
            { validationErrors }
        );
    }

    // Mongoose cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
        const castError = error as any;
        return new ClinicalInterventionError(
            'VALIDATION_ERROR' as any,
            'Invalid ID format provided.',
            `Invalid ObjectId: ${castError.value}`,
            400,
            ErrorSeverity.LOW,
            RecoveryAction.VALIDATE_INPUT,
            { field: castError.path, value: castError.value }
        );
    }

    // Mongoose duplicate key errors
    if ((error as any).code === 11000) {
        const duplicateError = error as any;
        const field = Object.keys(duplicateError.keyValue || {})[0] || 'unknown';

        return new ClinicalInterventionError(
            'DUPLICATE_INTERVENTION' as any,
            'A record with this information already exists.',
            `Duplicate key error: ${error.message}`,
            409,
            ErrorSeverity.MEDIUM,
            RecoveryAction.VALIDATE_INPUT,
            { field, value: duplicateError.keyValue?.[field] }
        );
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return new ClinicalInterventionError(
            'PERMISSION_DENIED' as any,
            'Authentication failed. Please log in again.',
            `JWT error: ${error.message}`,
            401,
            ErrorSeverity.HIGH,
            RecoveryAction.CHECK_PERMISSIONS
        );
    }

    // Network/timeout errors
    if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
        return new ClinicalInterventionError(
            'NETWORK_ERROR' as any,
            'Network timeout occurred. Please try again.',
            `Network error: ${error.message}`,
            503,
            ErrorSeverity.HIGH,
            RecoveryAction.RETRY
        );
    }

    // Database connection errors
    if (error.message.includes('MongoError') || error.message.includes('connection')) {
        return new ClinicalInterventionError(
            'DATABASE_ERROR' as any,
            'Database connection issue. Please try again later.',
            `Database error: ${error.message}`,
            503,
            ErrorSeverity.CRITICAL,
            RecoveryAction.RETRY
        );
    }

    // Default unknown error
    return new ClinicalInterventionError(
        'UNKNOWN_ERROR' as any,
        'An unexpected error occurred. Please try again.',
        error.message,
        500,
        ErrorSeverity.HIGH,
        RecoveryAction.CONTACT_SUPPORT,
        { originalError: error.name }
    );
};

// Get recovery instructions based on recovery action
const getRecoveryInstructions = (action: RecoveryAction): string[] => {
    switch (action) {
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
                'Provide the error details and request ID',
                'Include steps to reproduce the issue'
            ];

        default:
            return [
                'Try the action again',
                'If the problem persists, contact support'
            ];
    }
};

// Get retry after seconds for rate limiting
const getRetryAfterSeconds = (error: ClinicalInterventionError): number => {
    // Default retry after 60 seconds
    let retryAfter = 60;

    // Adjust based on error severity
    switch (error.severity) {
        case ErrorSeverity.LOW:
            retryAfter = 30;
            break;
        case ErrorSeverity.MEDIUM:
            retryAfter = 60;
            break;
        case ErrorSeverity.HIGH:
            retryAfter = 120;
            break;
        case ErrorSeverity.CRITICAL:
            retryAfter = 300;
            break;
    }

    return retryAfter;
};

// Generate unique request ID
const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Error logging middleware
export const errorLoggingMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    // Add request ID for tracking
    if (!req.headers['x-request-id']) {
        req.headers['x-request-id'] = generateRequestId();
    }

    // Log request start
    logger.info('Request started', {
        requestId: req.headers['x-request-id'],
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id,
        workplaceId: req.user?.workplaceId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
    });

    // Capture response time
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logger.info('Request completed', {
            requestId: req.headers['x-request-id'],
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            userId: req.user?.id,
            workplaceId: req.user?.workplaceId
        });
    });

    next();
};

// Async error wrapper
export const asyncErrorHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Rate limiting error handler
export const rateLimitErrorHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
    options: { windowMs: number; max: number }
): void => {
    const error = new ClinicalInterventionError(
        'NETWORK_ERROR' as any,
        'Too many requests. Please slow down and try again later.',
        'Rate limit exceeded',
        429,
        ErrorSeverity.MEDIUM,
        RecoveryAction.RETRY,
        {
            windowMs: options.windowMs,
            maxRequests: options.max,
            retryAfter: Math.ceil(options.windowMs / 1000)
        }
    );

    clinicalInterventionErrorHandler(error, req as AuthenticatedRequest, res, next);
};

// Validation error formatter
export const formatValidationErrors = (errors: any[]): any[] => {
    return errors.map(error => ({
        field: error.path || error.param || error.field,
        message: error.msg || error.message,
        value: error.value,
        code: error.code || 'VALIDATION_ERROR'
    }));
};

export default {
    clinicalInterventionErrorHandler,
    errorLoggingMiddleware,
    asyncErrorHandler,
    rateLimitErrorHandler,
    formatValidationErrors
};