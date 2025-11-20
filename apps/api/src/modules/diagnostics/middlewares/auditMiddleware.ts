/**
 * Enhanced Diagnostic Audit Middleware
 * Comprehensive audit logging middleware for diagnostic activities
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../types/auth';
import diagnosticAuditService from '../services/diagnosticAuditService';
import logger from '../../../utils/logger';
import crypto from 'crypto';

export interface AuditableRequest extends AuthRequest {
    auditData?: {
        action: string;
        details: Record<string, any>;
        complianceCategory: string;
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
        interventionId?: string;
        oldValues?: Record<string, any>;
        newValues?: Record<string, any>;
        changedFields?: string[];
        // Legacy diagnostic fields for backward compatibility
        eventType?: string;
        entityType?: string;
        entityId?: string;
        patientId?: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        aiMetadata?: any;
        regulatoryContext?: any;
    };
    startTime?: number;
    requestHash?: string;
}

/**
 * Middleware to capture request start time and generate request hash
 */
export const auditTimer = (req: AuditableRequest, res: Response, next: NextFunction) => {
    req.startTime = Date.now();

    // Generate request hash for integrity verification
    const requestData = {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        timestamp: req.startTime
    };

    req.requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(requestData))
        .digest('hex');

    next();
};

/**
 * Enhanced audit logging middleware for diagnostic activities
 */
export const diagnosticAuditLogger = (options: {
    eventType?: string;
    entityType?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    skipSuccessLog?: boolean;
    requireConsent?: boolean;
    aiProcessing?: boolean;
} = {}) => {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
        // Store original res.json to intercept response
        const originalJson = res.json;
        const originalSend = res.send;

        // Override res.json to capture response data
        res.json = function (body: any) {
            res.locals.responseBody = body;
            return originalJson.call(this, body);
        };

        // Override res.send to capture response data
        res.send = function (body: any) {
            res.locals.responseBody = body;
            return originalSend.call(this, body);
        };

        // Continue with request processing
        next();

        // Log audit event after response is sent
        res.on('finish', async () => {
            try {
                if (!req.user) return;

                const duration = req.startTime ? Date.now() - req.startTime : undefined;
                const responseBody = res.locals.responseBody;
                const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
                const isError = res.statusCode >= 400;

                // Skip success logs if configured
                if (options.skipSuccessLog && isSuccess) return;

                // Extract audit data first
                const data = req.auditData;

                // Determine event type
                const eventType = data?.eventType ||
                    options.eventType ||
                    generateEventTypeFromRequest(req);

                // Determine entity type
                const entityType = data?.entityType ||
                    options.entityType ||
                    determineEntityType(req.path);

                // Determine entity ID
                const entityId = data?.entityId ||
                    req.params.id ||
                    req.params.requestId ||
                    req.params.resultId ||
                    extractEntityIdFromResponse(responseBody);

                // Determine patient ID
                const patientId = data?.patientId ||
                    req.params.patientId ||
                    req.body?.patientId ||
                    extractPatientIdFromResponse(responseBody);

                // Determine severity
                const severity = data?.severity ||
                    options.severity ||
                    determineSeverity(req, res, isError);

                // Check consent requirements
                if (options.requireConsent) {
                    const consentObtained = req.body?.consentObtained ||
                        data?.details?.consentObtained;

                    if (!consentObtained) {
                        await diagnosticAuditService.logSecurityViolation(
                            req.user.id.toString(),
                            req.user!.workplaceId!.toString(),
                            'missing_consent',
                            {
                                eventType,
                                entityType,
                                entityId,
                                requestPath: req.path,
                                requestMethod: req.method
                            },
                            {
                                ipAddress: req.ip,
                                userAgent: req.get('User-Agent'),
                                requestId: req.headers['x-request-id'] as string,
                                requestHash: req.requestHash
                            }
                        );
                        return;
                    }
                }

                // Prepare audit event details
                const auditDetails: any = {
                    ...data?.details,
                    requestMethod: req.method,
                    requestPath: req.path,
                    requestQuery: sanitizeQuery(req.query),
                    requestBody: sanitizeRequestBody(req.body),
                    responseStatus: res.statusCode,
                    responseTime: duration,
                    requestHash: req.requestHash,
                    userAgent: req.get('User-Agent'),
                    contentType: req.get('Content-Type'),
                    contentLength: req.get('Content-Length'),
                    referer: req.get('Referer')
                };

                // Add error details if applicable
                if (isError && responseBody?.error) {
                    auditDetails.errorCode = responseBody.error.code;
                    auditDetails.errorMessage = responseBody.error.message;
                }

                // Add AI-specific metadata
                if (options.aiProcessing && data?.aiMetadata) {
                    auditDetails.aiMetadata = data.aiMetadata;
                }

                // Prepare regulatory context
                const regulatoryContext = {
                    hipaaCompliant: true,
                    gdprCompliant: true,
                    dataRetentionPeriod: getRetentionPeriod(entityType),
                    consentRequired: options.requireConsent || false,
                    consentObtained: req.body?.consentObtained || false,
                    ...data?.regulatoryContext
                };

                // Log the audit event
                await diagnosticAuditService.logAuditEvent({
                    eventType: eventType as any,
                    entityType: entityType as any,
                    entityId: entityId || 'unknown',
                    userId: req.user.id.toString(),
                    workplaceId: req.user!.workplaceId!.toString(),
                    patientId,
                    details: auditDetails,
                    metadata: {
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        // sessionId: req.sessionID, // Removed as it's not directly available on req
                        apiVersion: req.get('API-Version') || '1.0',
                        requestId: req.headers['x-request-id'] as string
                    },
                    timestamp: new Date(),
                    severity,
                    regulatoryContext,
                    aiMetadata: data?.aiMetadata
                });

                // Log high-risk activities with additional monitoring
                if (severity === 'critical' || severity === 'high') {
                    logger.warn('High-risk diagnostic activity detected', {
                        eventType,
                        entityType,
                        entityId,
                        userId: req.user.id.toString(),
                        workplaceId: req.user!.workplaceId!.toString(),
                        severity,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                }

            } catch (error) {
                logger.error('Failed to log diagnostic audit event:', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userId: req.user?.id,
                    workplaceId: req.user?.workplaceId,
                    path: req.path,
                    method: req.method
                });
                // Don't throw error to avoid breaking the main request flow
            }
        });
    };
};

/**
 * Middleware specifically for diagnostic request creation
 */
export const auditDiagnosticRequest = diagnosticAuditLogger({
    eventType: 'diagnostic_request_created',
    entityType: 'diagnostic_request',
    severity: 'medium',
    requireConsent: true
});

/**
 * Middleware for AI processing activities
 */
export const auditAIProcessing = diagnosticAuditLogger({
    eventType: 'ai_analysis_requested',
    entityType: 'diagnostic_request',
    severity: 'high',
    requireConsent: true,
    aiProcessing: true
});

/**
 * Middleware for pharmacist review activities
 */
export const auditPharmacistReview = diagnosticAuditLogger({
    eventType: 'pharmacist_review_completed',
    entityType: 'diagnostic_result',
    severity: 'high'
});

/**
 * Middleware for high-risk activities
 */
export const auditHighRiskActivity = (eventType: string, entityType: string) => {
    return diagnosticAuditLogger({
        eventType,
        entityType,
        severity: 'critical'
    });
};

/**
 * Middleware for data access activities
 */
export const auditDataAccess = diagnosticAuditLogger({
    eventType: 'data_access',
    severity: 'medium'
});

/**
 * Middleware for data export activities
 */
export const auditDataExport = diagnosticAuditLogger({
    eventType: 'data_export',
    severity: 'high'
});

/**
 * Helper function to set audit data on request
 */
export const setAuditData = (
    req: AuditableRequest,
    data: Partial<AuditableRequest['auditData']>
) => {
    if (!req.auditData) {
        req.auditData = {
            action: data?.action || 'UNKNOWN_ACTION',
            details: data?.details || {},
            complianceCategory: data?.complianceCategory || 'general'
        };
    } else {
        req.auditData = { ...req.auditData, ...data };
    }
};

/**
 * Helper function to set AI metadata for audit
 */
export const setAIMetadata = (
    req: AuditableRequest,
    aiMetadata: any
) => {
    if (!req.auditData) {
        req.auditData = {
            action: 'AI_PROCESSING',
            details: {},
            complianceCategory: 'ai_processing'
        };
    }
    req.auditData.aiMetadata = aiMetadata;
};

/**
 * Helper function to set regulatory context
 */
export const setRegulatoryContext = (
    req: AuditableRequest,
    regulatoryContext: any
) => {
    if (!req.auditData) {
        req.auditData = {
            action: 'REGULATORY_CONTEXT',
            details: {},
            complianceCategory: 'regulatory'
        };
    }
    req.auditData.regulatoryContext = regulatoryContext;
};

// Helper functions

function generateEventTypeFromRequest(req: AuditableRequest): string {
    const method = req.method;
    const path = req.path;

    if (method === 'POST' && path.includes('/diagnostics')) {
        if (path.includes('/retry')) return 'diagnostic_request_retried';
        if (path.includes('/approve')) return 'diagnostic_approved';
        if (path.includes('/reject')) return 'diagnostic_rejected';
        return 'diagnostic_request_created';
    }

    if (method === 'GET' && path.includes('/diagnostics')) {
        if (path.includes('/dashboard')) return 'dashboard_accessed';
        if (path.includes('/history')) return 'patient_history_accessed';
        if (path.includes('/pending-reviews')) return 'pending_reviews_accessed';
        return 'diagnostic_data_accessed';
    }

    if (method === 'PUT' && path.includes('/diagnostics')) {
        return 'diagnostic_updated';
    }

    if (method === 'DELETE' && path.includes('/diagnostics')) {
        return 'diagnostic_cancelled';
    }

    return `${method.toLowerCase()}_${path.split('/').pop() || 'unknown'}`;
}

function determineEntityType(path: string): string {
    if (path.includes('/diagnostics')) {
        if (path.includes('/results')) return 'diagnostic_result';
        if (path.includes('/lab')) return 'lab_order';
        return 'diagnostic_request';
    }

    if (path.includes('/audit')) return 'audit_log';
    if (path.includes('/compliance')) return 'compliance_report';

    return 'unknown';
}

function determineSeverity(
    req: AuditableRequest,
    res: Response,
    isError: boolean
): 'low' | 'medium' | 'high' | 'critical' {
    if (isError) {
        if (res.statusCode >= 500) return 'critical';
        if (res.statusCode >= 400) return 'high';
    }

    if (req.method === 'DELETE') return 'critical';
    if (req.method === 'POST' && req.path.includes('/ai')) return 'high';
    if (req.method === 'POST') return 'medium';

    return 'low';
}

function getRetentionPeriod(entityType: string): number {
    const retentionPolicies: { [key: string]: number } = {
        'diagnostic_request': 2555, // 7 years
        'diagnostic_result': 2555,  // 7 years
        'lab_order': 2555,          // 7 years
        'lab_result': 2555,         // 7 years
        'audit_log': 1095,          // 3 years
        'compliance_report': 2555   // 7 years
    };

    return retentionPolicies[entityType] || 2555;
}

function sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = [
        'password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'
    ];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    // Truncate large fields
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
            sanitized[key] = sanitized[key].substring(0, 1000) + '... [TRUNCATED]';
        }
    });

    return sanitized;
}

function sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') return query;

    const sanitized = { ...query };

    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'apiKey', 'secret', 'password'];

    sensitiveParams.forEach(param => {
        if (sanitized[param]) {
            sanitized[param] = '[REDACTED]';
        }
    });

    return sanitized;
}

function extractEntityIdFromResponse(responseBody: any): string | undefined {
    if (!responseBody || typeof responseBody !== 'object') return undefined;

    // Try to extract ID from various response structures
    if (responseBody.data?.id) return responseBody.data.id;
    if (responseBody.data?._id) return responseBody.data._id;
    if (responseBody.data?.request?.id) return responseBody.data.request.id;
    if (responseBody.data?.request?._id) return responseBody.data.request._id;
    if (responseBody.id) return responseBody.id;
    if (responseBody._id) return responseBody._id;

    return undefined;
}

function extractPatientIdFromResponse(responseBody: any): string | undefined {
    if (!responseBody || typeof responseBody !== 'object') return undefined;

    // Try to extract patient ID from various response structures
    if (responseBody.data?.patientId) return responseBody.data.patientId;
    if (responseBody.data?.request?.patientId) return responseBody.data.request.patientId;
    if (responseBody.patientId) return responseBody.patientId;

    return undefined;
}

export default {
    auditTimer,
    diagnosticAuditLogger,
    auditDiagnosticRequest,
    auditAIProcessing,
    auditPharmacistReview,
    auditHighRiskActivity,
    auditDataAccess,
    auditDataExport,
    setAuditData,
    setAIMetadata,
    setRegulatoryContext
};