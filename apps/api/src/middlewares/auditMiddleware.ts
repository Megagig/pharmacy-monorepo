import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { AuthRequest } from '../types/auth';

// Extend Request interface to include audit data
declare global {
    namespace Express {
        interface Request {
            auditData?: {
                action: string;
                details: Record<string, any>;
                complianceCategory: string;
                riskLevel?: 'low' | 'medium' | 'high' | 'critical';
                interventionId?: string;
                oldValues?: Record<string, any>;
                newValues?: Record<string, any>;
                changedFields?: string[];
            };
            originalBody?: any;
        }
    }
}

/**
 * Middleware to capture request data for auditing
 */
export const captureAuditData = (
    action: string,
    complianceCategory: string,
    riskLevel?: 'low' | 'medium' | 'high' | 'critical'
) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        // Store original body for comparison
        req.originalBody = { ...req.body };

        // Initialize audit data
        req.auditData = {
            action,
            complianceCategory,
            riskLevel,
            details: {
                method: req.method,
                url: req.originalUrl,
                params: req.params,
                query: req.query,
                body: req.body
            }
        };

        next();
    };
};

/**
 * Middleware to log audit trail after request completion
 */
export const logAuditTrail = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (body: any) {
        // Store response data for audit
        if (req.auditData) {
            req.auditData.details.responseStatus = res.statusCode;
            req.auditData.details.responseData = body;

            // Extract intervention ID from response or params
            if (body?.data?._id) {
                req.auditData.interventionId = body.data._id;
            } else if (req.params.id) {
                req.auditData.interventionId = req.params.id;
            }

            // Determine changed fields for updates
            if (req.method === 'PUT' || req.method === 'PATCH') {
                req.auditData.changedFields = Object.keys(req.body || {});
                req.auditData.oldValues = req.originalBody;
                req.auditData.newValues = req.body;
            }

            // Log the audit trail asynchronously
            if (req.user?.id) {
                AuditService.createAuditLog({
                    action: req.auditData.action,
                    userId: req.user.id,
                    interventionId: req.auditData.interventionId,
                    details: req.auditData.details,
                    riskLevel: req.auditData.riskLevel,
                    complianceCategory: req.auditData.complianceCategory,
                    changedFields: req.auditData.changedFields,
                    oldValues: req.auditData.oldValues,
                    newValues: req.auditData.newValues,
                    workspaceId: req.user?.workplaceId?.toString()
                }, req).catch(error => {
                    console.error('Failed to create audit log:', error);
                });
            }
        }

        // Call original json method
        return originalJson.call(this, body);
    };

    next();
};

/**
 * Middleware specifically for intervention operations
 */
export const auditIntervention = (action: string) => {
    const complianceCategory = getComplianceCategoryForAction(action);
    const riskLevel = getRiskLevelForAction(action);

    return [
        captureAuditData(action, complianceCategory, riskLevel),
        logAuditTrail
    ];
};

/**
 * Get compliance category based on action
 */
function getComplianceCategoryForAction(action: string): string {
    const categoryMap: Record<string, string> = {
        'INTERVENTION_CREATED': 'clinical_documentation',
        'INTERVENTION_UPDATED': 'clinical_documentation',
        'INTERVENTION_DELETED': 'data_integrity',
        'INTERVENTION_REVIEWED': 'quality_assurance',
        'INTERVENTION_APPROVED': 'quality_assurance',
        'INTERVENTION_REJECTED': 'quality_assurance',
        'INTERVENTION_COMPLETED': 'patient_care',
        'INTERVENTION_CANCELLED': 'workflow_management',
        'INTERVENTION_ASSIGNED': 'workflow_management',
        'INTERVENTION_ESCALATED': 'risk_management',
        'MEDICATION_CHANGED': 'medication_safety',
        'DOSAGE_MODIFIED': 'medication_safety',
        'ALLERGY_UPDATED': 'patient_privacy',
        'CONTRAINDICATION_FLAGGED': 'medication_safety',
        'RISK_ASSESSMENT_UPDATED': 'risk_management',
        'PATIENT_DATA_ACCESSED': 'patient_privacy',
        'EXPORT_PERFORMED': 'data_integrity',
        'REPORT_GENERATED': 'regulatory_compliance'
    };

    return categoryMap[action] || 'workflow_management';
}

/**
 * Get risk level based on action
 */
function getRiskLevelForAction(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const riskMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
        'INTERVENTION_DELETED': 'critical',
        'PATIENT_DATA_ACCESSED': 'critical',
        'MEDICATION_CHANGED': 'high',
        'DOSAGE_MODIFIED': 'high',
        'CONTRAINDICATION_FLAGGED': 'high',
        'INTERVENTION_ESCALATED': 'high',
        'INTERVENTION_UPDATED': 'medium',
        'INTERVENTION_REJECTED': 'medium',
        'ALLERGY_UPDATED': 'medium',
        'RISK_ASSESSMENT_UPDATED': 'medium',
        'INTERVENTION_CREATED': 'low',
        'INTERVENTION_REVIEWED': 'low',
        'INTERVENTION_APPROVED': 'low',
        'INTERVENTION_COMPLETED': 'low'
    };

    return riskMap[action] || 'low';
}

/**
 * Manual audit logging function for custom scenarios
 */
export const createManualAuditLog = async (
    req: AuthRequest,
    action: string,
    details: Record<string, any>,
    options?: {
        interventionId?: string;
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
        complianceCategory?: string;
    }
) => {
    if (!req.user?.id) {
        console.warn('Cannot create audit log: No user in request');
        return;
    }

    try {
        await AuditService.createAuditLog({
            action,
            userId: req.user.id,
            interventionId: options?.interventionId,
            details,
            riskLevel: options?.riskLevel,
            complianceCategory: options?.complianceCategory || getComplianceCategoryForAction(action),
            workspaceId: req.user?.workplaceId?.toString()
        }, req);
    } catch (error) {
        console.error('Failed to create manual audit log:', error);
    }
};

/**
 * Audit timer middleware for MTR operations
 */
export const auditTimer = (action: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        // Store start time in request
        req.auditStartTime = startTime;

        // Override res.end to capture completion time
        const originalEnd = res.end;
        res.end = function (...args: any[]) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Log timing audit
            if (req.user?.id) {
                AuditService.createAuditLog({
                    action: `${action}_TIMING`,
                    userId: req.user.id,
                    details: {
                        duration,
                        startTime: new Date(startTime),
                        endTime: new Date(endTime),
                        method: req.method,
                        url: req.originalUrl,
                        statusCode: res.statusCode
                    },
                    complianceCategory: 'system_performance',
                    riskLevel: duration > 5000 ? 'medium' : 'low'
                }, req).catch(error => {
                    console.error('Failed to create timing audit log:', error);
                });
            }

            return (originalEnd as any).apply(this, args);
        };

        next();
    };
};

/**
 * Audit MTR activity middleware
 */
export const auditMTRActivity = (activityType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (req.user?.id) {
                await AuditService.createAuditLog({
                    action: `MTR_${activityType.toUpperCase()}`,
                    userId: req.user.id,
                    details: {
                        activityType,
                        sessionId: req.params.sessionId || req.body.sessionId,
                        stepId: req.params.stepId || req.body.stepId,
                        method: req.method,
                        url: req.originalUrl,
                        params: req.params,
                        query: req.query
                    },
                    complianceCategory: 'clinical_documentation',
                    riskLevel: 'medium'
                }, req);
            }
        } catch (error) {
            // Silently fail - don't block request on audit log failure
        }

        next();
    };
};

/**
 * Audit patient access middleware
 */
export const auditPatientAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const patientId = req.params.patientId || req.body.patientId || req.query.patientId;

        if (req.user?.id && patientId) {
            await AuditService.createAuditLog({
                action: 'PATIENT_DATA_ACCESSED',
                userId: req.user.id,
                details: {
                    patientId,
                    accessType: 'mtr_review',
                    method: req.method,
                    url: req.originalUrl,
                    timestamp: new Date()
                },
                complianceCategory: 'patient_privacy',
                riskLevel: 'high'
            }, req);
        }
    } catch (error) {
        console.error('Failed to create patient access audit log:', error);
    }

    next();
};

/**
 * General audit logger middleware
 */
export const auditLogger = (action: string, complianceCategory?: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (req.user?.id) {
                await AuditService.createAuditLog({
                    action,
                    userId: req.user.id,
                    details: {
                        method: req.method,
                        url: req.originalUrl,
                        params: req.params,
                        query: req.query,
                        body: req.method !== 'GET' ? req.body : undefined,
                        timestamp: new Date()
                    },
                    complianceCategory: complianceCategory || getComplianceCategoryForAction(action),
                    riskLevel: getRiskLevelForAction(action)
                }, req);
            }
        } catch (error) {
            console.error('Failed to create audit log:', error);
        }

        next();
    };
};

// Extend Request interface for audit timing
declare global {
    namespace Express {
        interface Request {
            auditStartTime?: number;
        }
    }
}