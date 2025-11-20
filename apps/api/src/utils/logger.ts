import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        // Add correlation ID if available
        const correlationId = info.correlationId || 'unknown';
        
        // Structure the log entry
        const logEntry = {
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            service: info.service || 'pharma-care-api',
            correlationId,
            ...info,
        };

        // Remove duplicate fields
        delete logEntry.timestamp;
        delete logEntry.level;
        delete logEntry.message;
        delete logEntry.service;

        return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            service: info.service || 'pharma-care-api',
            correlationId,
            ...logEntry,
        });
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: structuredFormat,
    defaultMeta: { service: 'pharma-care-api' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
        // Patient engagement specific logs
        new winston.transports.File({
            filename: path.join(logsDir, 'patient-engagement.log'),
            level: 'info',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    // Only log patient engagement related entries
                    if (info.module && typeof info.module === 'string' && 
                        ['appointment', 'followup', 'reminder', 'schedule', 'integration'].includes(info.module)) {
                        return info;
                    }
                    return false;
                })()
            ),
        }),
        // Performance logs
        new winston.transports.File({
            filename: path.join(logsDir, 'performance.log'),
            level: 'info',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 3,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format((info) => {
                    // Only log performance related entries
                    if (info.duration || info.responseTime || info.operation) {
                        return info;
                    }
                    return false;
                })()
            ),
        }),
    ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => {
                const { timestamp, level, message, ...meta } = info;
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
        )
    }));
}

// Enhanced logging methods for patient engagement
export const patientEngagementLogger = {
    /**
     * Log appointment operations
     */
    appointment: (operation: string, data: Record<string, any>) => {
        logger.info(`Appointment ${operation}`, {
            module: 'appointment',
            operation,
            ...data,
        });
    },

    /**
     * Log follow-up operations
     */
    followUp: (operation: string, data: Record<string, any>) => {
        logger.info(`FollowUp ${operation}`, {
            module: 'followup',
            operation,
            ...data,
        });
    },

    /**
     * Log reminder operations
     */
    reminder: (operation: string, data: Record<string, any>) => {
        logger.info(`Reminder ${operation}`, {
            module: 'reminder',
            operation,
            ...data,
        });
    },

    /**
     * Log schedule operations
     */
    schedule: (operation: string, data: Record<string, any>) => {
        logger.info(`Schedule ${operation}`, {
            module: 'schedule',
            operation,
            ...data,
        });
    },

    /**
     * Log integration operations
     */
    integration: (operation: string, data: Record<string, any>) => {
        logger.info(`Integration ${operation}`, {
            module: 'integration',
            operation,
            ...data,
        });
    },

    /**
     * Log performance metrics
     */
    performance: (operation: string, duration: number, data: Record<string, any> = {}) => {
        logger.info(`Performance ${operation}`, {
            operation,
            duration,
            responseTime: duration,
            ...data,
        });
    },

    /**
     * Log errors with context
     */
    error: (operation: string, error: Error, data: Record<string, any> = {}) => {
        logger.error(`Error in ${operation}`, {
            operation,
            error: error.message,
            stack: error.stack,
            ...data,
        });
    },

    /**
     * Log business events
     */
    business: (event: string, data: Record<string, any>) => {
        logger.info(`Business Event: ${event}`, {
            event,
            eventType: 'business',
            ...data,
        });
    },

    /**
     * Log security events
     */
    security: (event: string, data: Record<string, any>) => {
        logger.warn(`Security Event: ${event}`, {
            event,
            eventType: 'security',
            ...data,
        });
    },
};

// Add correlation ID middleware helper
export const addCorrelationId = (req: any, res: any, next: any) => {
    req.correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       Math.random().toString(36).substr(2, 9);
    
    // Add to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);
    
    next();
};

// Helper to create child logger with correlation ID
export const createChildLogger = (correlationId: string, context: Record<string, any> = {}) => {
    return logger.child({
        correlationId,
        ...context,
    });
};

export default logger;