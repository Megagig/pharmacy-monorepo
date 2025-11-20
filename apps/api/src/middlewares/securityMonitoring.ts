import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { securityMonitoringService } from '../services/securityMonitoringService';
import logger from '../utils/logger';

/**
 * Security monitoring middleware
 */

/**
 * IP blocking middleware
 */
export const blockSuspiciousIPs = (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    if (securityMonitoringService.isIPBlocked(ipAddress)) {
        logger.warn('Blocked request from suspicious IP', {
            ipAddress,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            service: 'security-monitoring',
        });

        res.status(403).json({
            success: false,
            code: 'IP_BLOCKED',
            message: 'Access denied. Your IP address has been blocked due to suspicious activity.',
        });
        return;
    }

    next();
};

/**
 * User suspicion monitoring middleware
 */
export const monitorSuspiciousUsers = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next();
    }

    const suspiciousScore = securityMonitoringService.getUserSuspiciousScore(req.user._id.toString());

    if (suspiciousScore > 8) {
        // High suspicion - require additional verification or block
        logger.warn('High suspicion user detected', {
            userId: req.user._id,
            suspiciousScore,
            url: req.originalUrl,
            service: 'security-monitoring',
        });

        res.status(403).json({
            success: false,
            code: 'ACCOUNT_FLAGGED',
            message: 'Your account has been flagged for suspicious activity. Please contact support.',
            suspiciousScore,
        });
        return;
    } else if (suspiciousScore > 5) {
        // Medium suspicion - add warning header
        res.set('X-Security-Warning', 'Account under monitoring');
        logger.info('Suspicious user activity monitored', {
            userId: req.user._id,
            suspiciousScore,
            url: req.originalUrl,
            service: 'security-monitoring',
        });
    }

    next();
};

/**
 * Session validation middleware
 */
export const validateSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !(req as any).sessionID) {
        return next();
    }

    try {
        const isValid = await securityMonitoringService.validateUserSession(
            req.user._id,
            (req as any).sessionID
        );

        if (!isValid) {
            logger.warn('Invalid session detected', {
                userId: req.user._id,
                sessionId: (req as any).sessionID,
                url: req.originalUrl,
                service: 'security-monitoring',
            });

            res.status(401).json({
                success: false,
                code: 'SESSION_INVALID',
                message: 'Your session is no longer valid. Please log in again.',
                requiresReauth: true,
            });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('Error validating session', {
            error: error?.message || 'Unknown error',
            userId: req.user._id,
            sessionId: (req as any).sessionID,
            service: 'security-monitoring',
        });
        next(); // Continue on error to avoid blocking legitimate users
    }
};

/**
 * Security event monitoring middleware
 */
export const monitorSecurityEvents = (eventType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        // Continue with the request first
        next();

        // Analyze security event asynchronously (don't block the response)
        setImmediate(async () => {
            try {
                await securityMonitoringService.analyzeSecurityEvent(req, eventType, {
                    statusCode: res.statusCode,
                    requestBody: req.body,
                    query: req.query,
                    params: req.params,
                });
            } catch (error: any) {
                logger.error('Error monitoring security event', {
                    error: error?.message || 'Unknown error',
                    eventType,
                    userId: req.user?._id,
                    service: 'security-monitoring',
                });
            }
        });
    };
};

/**
 * Rate limiting based on user suspicion score
 */
export const adaptiveRateLimit = (baseLimit: number) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next();
        }

        const suspiciousScore = securityMonitoringService.getUserSuspiciousScore(req.user._id.toString());

        // Reduce rate limit for suspicious users
        const adjustedLimit = Math.max(1, Math.floor(baseLimit * (1 - suspiciousScore / 10)));

        // Store adjusted limit in request for use by rate limiting middleware
        (req as any).adaptiveRateLimit = adjustedLimit;

        if (suspiciousScore > 3) {
            logger.info('Adaptive rate limit applied', {
                userId: req.user._id,
                suspiciousScore,
                baseLimit,
                adjustedLimit,
                service: 'security-monitoring',
            });
        }

        next();
    };
};

/**
 * Anomaly detection middleware
 */
export const detectAnomalies = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next();
    }

    const anomalies: string[] = [];

    // Check for unusual request patterns
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || 'unknown';

    // Detect bot-like behavior
    if (userAgent.toLowerCase().includes('bot') ||
        userAgent.toLowerCase().includes('crawler') ||
        userAgent.toLowerCase().includes('spider')) {
        anomalies.push('bot_user_agent');
    }

    // Detect unusual request timing (very fast requests)
    const lastRequestTime = (req as any).lastRequestTime;
    const currentTime = Date.now();
    if (lastRequestTime && (currentTime - lastRequestTime) < 100) { // Less than 100ms
        anomalies.push('rapid_requests');
    }
    (req as any).lastRequestTime = currentTime;

    // Detect requests from unusual locations (simplified)
    if (req.originalUrl.includes('admin') && req.user.role !== 'super_admin') {
        anomalies.push('unauthorized_admin_access');
    }

    // Log anomalies
    if (anomalies.length > 0) {
        logger.warn('Request anomalies detected', {
            userId: req.user._id,
            anomalies,
            userAgent,
            ipAddress,
            url: req.originalUrl,
            service: 'security-monitoring',
        });

        // Trigger security event analysis
        setImmediate(async () => {
            try {
                await securityMonitoringService.analyzeSecurityEvent(req, 'anomaly_detected', {
                    anomalies,
                    userAgent,
                    ipAddress,
                });
            } catch (error: any) {
                logger.error('Error analyzing anomaly', {
                    error: error?.message || 'Unknown error',
                    userId: req.user?._id,
                    service: 'security-monitoring',
                });
            }
        });
    }

    next();
};

/**
 * Permission change monitoring
 */
export const monitorPermissionChanges = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next();
    }

    // Store original user permissions for comparison
    const originalPermissions = req.user.permissions || [];
    const originalRole = req.user.role;

    // Override res.json to capture response and check for permission changes
    const originalJson = res.json;
    res.json = function (body: any) {
        // Check if this was a permission-changing operation
        if (req.originalUrl.includes('role') ||
            req.originalUrl.includes('permission') ||
            req.method === 'PUT' || req.method === 'PATCH') {

            // Trigger permission change monitoring
            setImmediate(async () => {
                try {
                    await securityMonitoringService.analyzeSecurityEvent(req, 'permission_change', {
                        originalPermissions,
                        originalRole,
                        statusCode: res.statusCode,
                        responseBody: body,
                    });
                } catch (error: any) {
                    logger.error('Error monitoring permission change', {
                        error: error?.message || 'Unknown error',
                        userId: req.user?._id,
                        service: 'security-monitoring',
                    });
                }
            });
        }

        return originalJson.call(this, body);
    };

    next();
};

/**
 * Data access monitoring
 */
export const monitorDataAccess = (resourceType: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next();
        }

        // Determine access type from HTTP method
        let accessType = 'read';
        switch (req.method) {
            case 'POST':
                accessType = 'create';
                break;
            case 'PUT':
            case 'PATCH':
                accessType = 'update';
                break;
            case 'DELETE':
                accessType = 'delete';
                break;
            default:
                accessType = 'read';
        }

        // Monitor after response
        res.on('finish', () => {
            setImmediate(async () => {
                try {
                    await securityMonitoringService.analyzeSecurityEvent(req, 'data_access', {
                        resourceType,
                        accessType,
                        resourceId: req.params.id,
                        statusCode: res.statusCode,
                        successful: res.statusCode < 400,
                    });
                } catch (error: any) {
                    logger.error('Error monitoring data access', {
                        error: error?.message || 'Unknown error',
                        userId: req.user?._id,
                        resourceType,
                        accessType,
                        service: 'security-monitoring',
                    });
                }
            });
        });

        next();
    };
};

export default {
    blockSuspiciousIPs,
    monitorSuspiciousUsers,
    validateSession,
    monitorSecurityEvents,
    adaptiveRateLimit,
    detectAnomalies,
    monitorPermissionChanges,
    monitorDataAccess,
};