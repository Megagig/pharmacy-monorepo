import { Request, Response, NextFunction } from 'express';
import {
  MTRError,
  isMTRError,
  getMTRErrorSeverity,
  getMTRErrorRecovery,
  MTRErrorSeverity
} from '../utils/mtrErrors';
import logger from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: any;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const errorHandler = (err: CustomError | MTRError, req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Check if response has already been sent
  if (res.headersSent) {
    console.warn('Error occurred after response was sent:', err.message);
    return;
  }

  // Handle MTR-specific errors
  if (isMTRError(err)) {
    const severity = getMTRErrorSeverity(err);
    const recovery = getMTRErrorRecovery(err);

    // Log MTR error with appropriate level based on severity
    const logLevel = severity === MTRErrorSeverity.CRITICAL ? 'error' :
      severity === MTRErrorSeverity.HIGH ? 'warn' : 'info';

    logger[logLevel]('MTR Error occurred', {
      errorType: err.errorType,
      message: err.message,
      statusCode: err.statusCode,
      severity,
      details: err.details,
      userId: req.user?.id,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: err.timestamp,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Send structured MTR error response
    res.status(err.statusCode).json({
      success: false,
      error: {
        type: err.errorType,
        message: err.message,
        details: err.details,
        severity,
        recovery,
        timestamp: err.timestamp,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
    return;
  }

  // Log non-MTR errors
  console.error(err.stack);

  // Enhanced logging for audit trail
  logger.error('Non-MTR Error occurred', {
    message: err.message,
    name: err.name,
    statusCode: err.statusCode,
    userId: req.user?.id,
    endpoint: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // JSON parsing error
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        type: 'SyntaxError',
        message: 'Invalid JSON format in request body',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    res.status(404).json({
      success: false,
      error: {
        type: 'CastError',
        message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    res.status(400).json({
      success: false,
      error: {
        type: 'DuplicateKeyError',
        message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = err.errors
      ? Object.values(err.errors).map((val: any) => val.message).join(', ')
      : err.message || 'Validation failed';
    res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Default error response
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      type: 'InternalServerError',
      message: err.message || 'Server Error',
      timestamp: new Date().toISOString()
    }
  });
};

export default errorHandler;