/**
 * Patient Engagement Monitoring Middleware
 * Automatically tracks performance and errors for patient engagement operations
 * Requirements: 9.1, 9.2, 9.3
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { patientEngagementMonitoring } from '../services/PatientEngagementMonitoringService';
import logger from '../utils/logger';

export interface MonitoringContext {
  operation: string;
  module: 'appointment' | 'followup' | 'reminder' | 'schedule' | 'integration';
  startTime: number;
  workplaceId?: string;
  userId?: string;
  patientId?: string;
}

/**
 * Middleware to monitor patient engagement API endpoints
 */
export const monitorPatientEngagementEndpoint = (
  operation: string,
  module: MonitoringContext['module']
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Extract context from request
    const workplaceId = req.user?.workplaceId?.toString();
    const userId = req.user?._id?.toString();
    const patientId = req.params.patientId || req.body.patientId;

    // Store monitoring context in request
    req.monitoringContext = {
      operation,
      module,
      startTime,
      workplaceId,
      userId,
      patientId,
    };

    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // Extract additional metadata from response
      const metadata: Record<string, any> = {
        statusCode: res.statusCode,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      // Add request body size if available
      if (req.get('content-length')) {
        metadata.requestSize = parseInt(req.get('content-length') || '0');
      }

      // Add response body size
      if (body && typeof body === 'object') {
        metadata.responseSize = JSON.stringify(body).length;
      }

      // Extract error information if operation failed
      let errorType: string | undefined;
      let errorMessage: string | undefined;
      
      if (!success && body && typeof body === 'object') {
        errorType = body.error?.type || body.errorType || 'unknown_error';
        errorMessage = body.error?.message || body.message || 'Unknown error';
      }

      // Record the operation
      patientEngagementMonitoring.recordOperation(
        operation,
        module,
        workplaceId || 'unknown',
        duration,
        success,
        {
          userId,
          patientId,
          errorType,
          errorMessage,
          metadata,
        }
      );

      // Log structured request
      const logData = {
        operation,
        module,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        workplaceId,
        userId,
        patientId,
        success,
        errorType,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };

      if (success) {
        logger.info(`Patient Engagement API: ${module}.${operation}`, logData);
      } else {
        logger.error(`Patient Engagement API Error: ${module}.${operation}`, {
          ...logData,
          errorMessage,
          requestBody: req.body,
        });
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware to handle uncaught errors in patient engagement endpoints
 */
export const patientEngagementErrorHandler = (
  err: Error,
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const context = req.monitoringContext;
  
  if (context) {
    const duration = Date.now() - context.startTime;
    
    // Determine error type
    let errorType = 'internal_error';
    if (err.name === 'ValidationError') {
      errorType = 'validation_error';
    } else if (err.name === 'CastError') {
      errorType = 'cast_error';
    } else if (err.message.includes('duplicate key')) {
      errorType = 'duplicate_key_error';
    } else if (err.message.includes('timeout')) {
      errorType = 'timeout_error';
    }

    // Record the failed operation
    patientEngagementMonitoring.recordOperation(
      context.operation,
      context.module,
      context.workplaceId || 'unknown',
      duration,
      false,
      {
        userId: context.userId,
        patientId: context.patientId,
        errorType,
        errorMessage: err.message,
        metadata: {
          errorStack: err.stack,
          method: req.method,
          path: req.path,
          statusCode: 500,
        },
      }
    );

    // Create alert for critical errors
    if (errorType === 'timeout_error' || duration > 10000) {
      patientEngagementMonitoring.createAlert(
        'error',
        'high',
        context.module,
        context.operation,
        `Critical error in ${context.operation}: ${err.message}`,
        {
          errorType,
          duration,
          workplaceId: context.workplaceId,
          userId: context.userId,
          patientId: context.patientId,
          stack: err.stack,
        }
      );
    }
  }

  next(err);
};

/**
 * Function to manually track service operations (for use in services)
 */
export const trackServiceOperation = async <T>(
  operation: string,
  module: MonitoringContext['module'],
  workplaceId: string,
  fn: () => Promise<T>,
  options: {
    userId?: string;
    patientId?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<T> => {
  const startTime = Date.now();
  let success = false;
  let errorType: string | undefined;
  let errorMessage: string | undefined;
  let result: T;

  try {
    result = await fn();
    success = true;
    return result;
  } catch (error) {
    // Determine error type
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.name === 'ValidationError') {
        errorType = 'validation_error';
      } else if (error.name === 'CastError') {
        errorType = 'cast_error';
      } else if (error.message.includes('duplicate key')) {
        errorType = 'duplicate_key_error';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout_error';
      } else if (error.message.includes('not found')) {
        errorType = 'not_found_error';
      } else {
        errorType = 'internal_error';
      }
    } else {
      errorType = 'unknown_error';
      errorMessage = 'Unknown error occurred';
    }

    throw error;
  } finally {
    const duration = Date.now() - startTime;

    // Record the operation
    patientEngagementMonitoring.recordOperation(
      operation,
      module,
      workplaceId,
      duration,
      success,
      {
        userId: options.userId,
        patientId: options.patientId,
        errorType,
        errorMessage,
        metadata: options.metadata,
      }
    );

    // Create alert for slow operations
    if (duration > 5000) {
      patientEngagementMonitoring.createAlert(
        'performance',
        duration > 10000 ? 'high' : 'medium',
        module,
        operation,
        `Slow service operation: ${operation} took ${duration}ms`,
        {
          duration,
          workplaceId,
          userId: options.userId,
          patientId: options.patientId,
          metadata: options.metadata,
        }
      );
    }
  }
};

/**
 * Decorator for service methods to automatically track operations
 */
export function MonitorOperation(
  operation: string,
  module: MonitoringContext['module']
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract workplaceId from arguments (usually second parameter)
      const workplaceId = args[1]?.toString() || 'unknown';
      
      // Extract userId from arguments (usually third parameter)
      const userId = args[2]?.toString();
      
      // Extract patientId from first argument if it's an object with patientId
      let patientId: string | undefined;
      if (args[0] && typeof args[0] === 'object' && args[0].patientId) {
        patientId = args[0].patientId.toString();
      }

      return trackServiceOperation(
        operation,
        module,
        workplaceId,
        () => method.apply(this, args),
        {
          userId,
          patientId,
          metadata: {
            methodName: propertyName,
            className: target.constructor.name,
          },
        }
      );
    };

    return descriptor;
  };
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      monitoringContext?: MonitoringContext;
    }
  }
}

export default {
  monitorPatientEngagementEndpoint,
  patientEngagementErrorHandler,
  trackServiceOperation,
  MonitorOperation,
};