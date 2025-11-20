import { Request, Response, NextFunction } from 'express';
import {
    AppointmentError,
    ValidationError,
    ConflictError,
    AppointmentAuthorizationError,
    AppointmentAuthenticationError,
    AppointmentBusinessLogicError,
    AppointmentNotFoundError,
    AppointmentDatabaseError,
    AppointmentExternalServiceError,
    AppointmentRateLimitError,
    isAppointmentError,
    getAppointmentErrorSeverity,
    getAppointmentErrorRecovery,
    AppointmentErrorSeverity
} from '../utils/appointmentErrors';
import logger from '../utils/logger';

/**
 * Appointment Error Handler Middleware
 * Centralized error handling for appointment and follow-up operations
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2
 */
export const appointmentErrorHandler = (
    error: Error | AppointmentError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // If headers already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(error);
    }

    // Extract user context for logging
    const userId = (req as any).user?.id;
    const workplaceId = (req as any).user?.workplaceId;
    const requestId = req.headers['x-request-id'] || 'unknown';

    // Handle AppointmentError instances
    if (isAppointmentError(error)) {
        const appointmentError = error as AppointmentError;
        const severity = getAppointmentErrorSeverity(appointmentError);
        const recovery = getAppointmentErrorRecovery(appointmentError);

        // Log error based on severity
        logError(appointmentError, severity, {
            userId,
            workplaceId,
            requestId,
            endpoint: req.originalUrl,
            method: req.method,
            body: sanitizeBody(req.body)
        });

        // Send error response
        res.status(appointmentError.statusCode).json({
            success: false,
            message: appointmentError.message,
            code: appointmentError.errorType,
            details: appointmentError.details,
            recovery: recovery,
            timestamp: appointmentError.timestamp,
            requestId,
            ...(process.env.NODE_ENV === 'development' && {
                stack: appointmentError.stack
            })
        });
        return;
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
        const validationError = new ValidationError(
            'Database validation failed',
            extractMongooseValidationErrors(error)
        );

        logger.warn('Mongoose validation error', {
            error: error.message,
            userId,
            workplaceId,
            requestId,
            endpoint: req.originalUrl
        });

        res.status(validationError.statusCode).json({
            success: false,
            message: validationError.message,
            code: validationError.errorType,
            details: validationError.details,
            timestamp: validationError.timestamp,
            requestId
        });
        return;
    }

    // Handle Mongoose CastError (invalid ObjectId)
    if (error.name === 'CastError') {
        const castError = new ValidationError(
            'Invalid ID format',
            [{
                field: (error as any).path,
                message: `Invalid ${(error as any).path} format`,
                value: (error as any).value,
                code: 'INVALID_ID_FORMAT'
            }]
        );

        logger.warn('Mongoose cast error', {
            error: error.message,
            userId,
            workplaceId,
            requestId,
            endpoint: req.originalUrl
        });

        res.status(castError.statusCode).json({
            success: false,
            message: castError.message,
            code: castError.errorType,
            details: castError.details,
            timestamp: castError.timestamp,
            requestId
        });
        return;
    }

    // Handle MongoDB duplicate key errors
    if ((error as any).code === 11000) {
        const duplicateField = Object.keys((error as any).keyPattern || {})[0] || 'field';
        const conflictError = new ConflictError(
            'Duplicate record',
            [{
                field: duplicateField,
                message: `A record with this ${duplicateField} already exists`,
                code: 'DUPLICATE_KEY'
            }]
        );

        logger.warn('MongoDB duplicate key error', {
            error: error.message,
            field: duplicateField,
            userId,
            workplaceId,
            requestId,
            endpoint: req.originalUrl
        });

        res.status(conflictError.statusCode).json({
            success: false,
            message: conflictError.message,
            code: conflictError.errorType,
            details: conflictError.details,
            timestamp: conflictError.timestamp,
            requestId
        });
        return;
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        const authError = new AppointmentAuthenticationError(
            'Authentication failed',
            [{
                field: 'token',
                message: error.message,
                code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
            }]
        );

        logger.warn('JWT authentication error', {
            error: error.message,
            userId,
            requestId,
            endpoint: req.originalUrl
        });

        res.status(authError.statusCode).json({
            success: false,
            message: authError.message,
            code: authError.errorType,
            details: authError.details,
            timestamp: authError.timestamp,
            requestId
        });
        return;
    }

    // Handle generic errors
    logger.error('Unhandled error in appointment module', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        userId,
        workplaceId,
        requestId,
        endpoint: req.originalUrl,
        method: req.method,
        body: sanitizeBody(req.body)
    });

    // Send generic error response
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
        requestId,
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack
        })
    });
};

/**
 * Log error based on severity
 */
const logError = (
    error: AppointmentError,
    severity: AppointmentErrorSeverity,
    context: Record<string, any>
): void => {
    const logData = {
        message: error.message,
        errorType: error.errorType,
        statusCode: error.statusCode,
        severity,
        details: error.details,
        ...context
    };

    switch (severity) {
        case AppointmentErrorSeverity.CRITICAL:
            logger.error('Critical appointment error', logData);
            break;
        case AppointmentErrorSeverity.HIGH:
            logger.error('High severity appointment error', logData);
            break;
        case AppointmentErrorSeverity.MEDIUM:
            logger.warn('Medium severity appointment error', logData);
            break;
        case AppointmentErrorSeverity.LOW:
            logger.info('Low severity appointment error', logData);
            break;
        default:
            logger.warn('Appointment error', logData);
    }
};

/**
 * Extract validation errors from Mongoose ValidationError
 */
const extractMongooseValidationErrors = (error: any): any[] => {
    const errors: any[] = [];

    if (error.errors) {
        Object.keys(error.errors).forEach(field => {
            const fieldError = error.errors[field];
            errors.push({
                field,
                message: fieldError.message,
                value: fieldError.value,
                code: fieldError.kind || 'VALIDATION_ERROR'
            });
        });
    }

    return errors;
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
const sanitizeBody = (body: any): any => {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'confirmationToken'];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
};

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Not Found Handler for appointment routes
 */
export const appointmentNotFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const notFoundError = new AppointmentNotFoundError(
        `Route not found: ${req.method} ${req.originalUrl}`,
        'route',
        req.originalUrl
    );

    next(notFoundError);
};
