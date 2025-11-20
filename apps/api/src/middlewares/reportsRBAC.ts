import { Response, NextFunction } from 'express';
import { AuthRequest, isExtendedUser } from '../types/auth';
import { requireDynamicPermission, requirePermission } from './rbac';
import ReportTemplate from '../models/ReportTemplate';
import ReportSchedule from '../models/ReportSchedule';
import ReportAuditLog from '../models/ReportAuditLog';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Reports-specific RBAC middleware
 * Provides fine-grained access control for reports and analytics
 */

interface ReportPermissionContext {
    reportType?: string;
    templateId?: string;
    scheduleId?: string;
    dataTypes?: string[];
    sensitiveData?: boolean;
    exportFormat?: string;
    recipients?: string[];
}

/**
 * Check if user has permission to access specific report type
 */
export const requireReportAccess = (reportType?: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const targetReportType = reportType || req.params.reportType || req.body.reportType;

            if (!targetReportType) {
                return next(); // Let the main permission check handle it
            }

            // Map report types to required permissions
            const reportPermissions: Record<string, string[]> = {
                'patient-outcomes': ['view_patient_outcomes', 'view_clinical_data'],
                'pharmacist-interventions': ['view_pharmacist_performance', 'view_intervention_data'],
                'therapy-effectiveness': ['view_therapy_metrics', 'view_clinical_data'],
                'quality-improvement': ['view_quality_metrics', 'view_operational_data'],
                'regulatory-compliance': ['view_compliance_reports', 'view_audit_data'],
                'cost-effectiveness': ['view_financial_reports', 'view_cost_data'],
                'trend-forecasting': ['view_trend_analysis', 'view_analytics_data'],
                'operational-efficiency': ['view_operational_metrics', 'view_performance_data'],
                'medication-inventory': ['view_inventory_reports', 'view_medication_data'],
                'patient-demographics': ['view_patient_demographics', 'view_demographic_data'],
                'adverse-events': ['view_safety_reports', 'view_clinical_data']
            };

            const requiredPermissions = reportPermissions[targetReportType] || ['view_reports'];

            // Check if user has any of the required permissions
            let hasPermission = false;
            let grantedPermission = '';

            for (const permission of requiredPermissions) {
                try {
                    // Use dynamic permission checking
                    const dynamicCheck = requireDynamicPermission(permission, {
                        enableLegacyFallback: true,
                        enableSuggestions: false
                    });

                    // Create a mock response to capture the result
                    let permissionGranted = false;
                    const mockRes = {
                        status: () => ({ json: () => { } }),
                        json: () => { }
                    } as any;

                    const mockNext = () => {
                        permissionGranted = true;
                    };

                    await dynamicCheck(req, mockRes, mockNext);

                    if (permissionGranted) {
                        hasPermission = true;
                        grantedPermission = permission;
                        break;
                    }
                } catch (error) {
                    logger.debug(`Permission check failed for ${permission}:`, error);
                    continue;
                }
            }

            if (!hasPermission) {
                // Log access denial
                await ReportAuditLog.logEvent({
                    eventType: 'UNAUTHORIZED_ACCESS',
                    reportType: targetReportType,
                    userId: new mongoose.Types.ObjectId(req.user!._id),
                    workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                    sessionId: req.sessionId,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    eventDetails: {
                        action: 'ACCESS',
                        resource: 'REPORT',
                        resourceId: targetReportType,
                        success: false,
                        errorMessage: 'Insufficient permissions for report type'
                    },
                    compliance: {
                        dataAccessed: ['REPORT_METADATA'],
                        sensitiveData: false,
                        anonymized: true,
                        encryptionUsed: true
                    },
                    riskScore: 60,
                    flagged: true,
                    flagReason: 'UNAUTHORIZED_ACCESS'
                });

                res.status(403).json({
                    success: false,
                    message: `Access denied for report type: ${targetReportType}`,
                    code: 'REPORT_ACCESS_DENIED',
                    reportType: targetReportType,
                    requiredPermissions,
                    userPermissions: isExtendedUser(req.user!) ? req.user!.permissions || [] : []
                });
                return;
            }

            // Log successful access
            await ReportAuditLog.logEvent({
                eventType: 'REPORT_VIEWED',
                reportType: targetReportType,
                userId: new mongoose.Types.ObjectId(req.user!._id),
                workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                sessionId: req.sessionId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                eventDetails: {
                    action: 'ACCESS',
                    resource: 'REPORT',
                    resourceId: targetReportType,
                    success: true
                },
                compliance: {
                    dataAccessed: ['REPORT_METADATA'],
                    sensitiveData: false,
                    anonymized: true,
                    encryptionUsed: true,
                    accessJustification: `User has ${grantedPermission} permission`
                },
                riskScore: 10
            });

            next();

        } catch (error) {
            logger.error('Report access check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify report access permissions',
                code: 'REPORT_ACCESS_CHECK_ERROR'
            });
        }
    };
};

/**
 * Check if user can access specific template
 */
export const requireTemplateAccess = (action: 'view' | 'edit' | 'delete' | 'clone' = 'view') => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const templateId = req.params.templateId || req.body.templateId;

            if (!templateId) {
                return next();
            }

            if (!mongoose.Types.ObjectId.isValid(templateId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid template ID format',
                    code: 'INVALID_TEMPLATE_ID'
                });
                return;
            }

            const template = await ReportTemplate.findById(templateId);

            if (!template) {
                res.status(404).json({
                    success: false,
                    message: 'Template not found',
                    code: 'TEMPLATE_NOT_FOUND'
                });
                return;
            }

            // Check workspace access
            if (template.workplaceId.toString() !== (req.user!.workplaceId?.toString() || '') && !template.isPublic) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied: Template belongs to different workspace',
                    code: 'TEMPLATE_WORKSPACE_MISMATCH'
                });
                return;
            }

            // Check specific permissions
            const userPermissions = template.permissions[action] || [];
            const userRole = isExtendedUser(req.user!) ? req.user!.role : undefined;
            const userWorkplaceRole = isExtendedUser(req.user!) ? req.user!.workplaceRole : undefined;

            let hasAccess = false;

            // Super admin always has access
            if (userRole === 'super_admin') {
                hasAccess = true;
            }
            // Template creator always has access
            else if (template.createdBy.toString() === req.user!._id.toString()) {
                hasAccess = true;
            }
            // Public templates allow view access
            else if (template.isPublic && action === 'view') {
                hasAccess = true;
            }
            // Check explicit permissions
            else if (userPermissions.length === 0 ||
                userPermissions.includes(userRole) ||
                userPermissions.includes(userWorkplaceRole) ||
                userPermissions.includes('all')) {
                hasAccess = true;
            }

            if (!hasAccess) {
                // Log access denial
                await ReportAuditLog.logEvent({
                    eventType: 'UNAUTHORIZED_ACCESS',
                    reportType: template.reportType,
                    templateId: new mongoose.Types.ObjectId(template._id),
                    userId: new mongoose.Types.ObjectId(req.user!._id),
                    workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                    sessionId: req.sessionId,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    eventDetails: {
                        action: action.toUpperCase(),
                        resource: 'TEMPLATE',
                        resourceId: templateId,
                        success: false,
                        errorMessage: `Insufficient permissions for template ${action}`
                    },
                    compliance: {
                        dataAccessed: ['TEMPLATE_METADATA'],
                        sensitiveData: false,
                        anonymized: true,
                        encryptionUsed: true
                    },
                    riskScore: 40,
                    flagged: true,
                    flagReason: 'UNAUTHORIZED_ACCESS'
                });

                res.status(403).json({
                    success: false,
                    message: `Access denied: Insufficient permissions to ${action} template`,
                    code: 'TEMPLATE_ACCESS_DENIED',
                    templateId,
                    action,
                    requiredPermissions: userPermissions
                });
                return;
            }

            // Log successful access
            await ReportAuditLog.logEvent({
                eventType: action === 'view' ? 'TEMPLATE_VIEWED' : 'TEMPLATE_MODIFIED',
                reportType: template.reportType,
                templateId: new mongoose.Types.ObjectId(template._id),
                userId: new mongoose.Types.ObjectId(req.user!._id),
                workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                sessionId: req.sessionId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                eventDetails: {
                    action: action.toUpperCase(),
                    resource: 'TEMPLATE',
                    resourceId: templateId,
                    success: true
                },
                compliance: {
                    dataAccessed: ['TEMPLATE_DATA'],
                    sensitiveData: false,
                    anonymized: true,
                    encryptionUsed: true,
                    accessJustification: `User has ${action} permission for template`
                },
                riskScore: action === 'view' ? 5 : 15
            });

            // Increment view count for view actions
            if (action === 'view') {
                await (template as any).incrementViewCount();
            }

            // Attach template to request for downstream use
            req.template = template;

            next();

        } catch (error) {
            logger.error('Template access check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify template access permissions',
                code: 'TEMPLATE_ACCESS_CHECK_ERROR'
            });
        }
    };
};

/**
 * Check if user can access specific schedule
 */
export const requireScheduleAccess = (action: 'view' | 'edit' | 'delete' | 'execute' = 'view') => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const scheduleId = req.params.scheduleId || req.body.scheduleId;

            if (!scheduleId) {
                return next();
            }

            if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid schedule ID format',
                    code: 'INVALID_SCHEDULE_ID'
                });
                return;
            }

            const schedule = await ReportSchedule.findById(scheduleId);

            if (!schedule) {
                res.status(404).json({
                    success: false,
                    message: 'Schedule not found',
                    code: 'SCHEDULE_NOT_FOUND'
                });
                return;
            }

            // Check workspace access
            if (schedule.workplaceId.toString() !== (req.user!.workplaceId?.toString() || '')) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied: Schedule belongs to different workspace',
                    code: 'SCHEDULE_WORKSPACE_MISMATCH'
                });
                return;
            }

            // Check specific permissions
            const userPermissions = schedule.permissions[action] || [];
            const userRole = isExtendedUser(req.user!) ? req.user!.role : undefined;
            const userWorkplaceRole = isExtendedUser(req.user!) ? req.user!.workplaceRole : undefined;

            let hasAccess = false;

            // Super admin always has access
            if (userRole === 'super_admin') {
                hasAccess = true;
            }
            // Schedule creator always has access
            else if (schedule.createdBy.toString() === req.user!._id.toString()) {
                hasAccess = true;
            }
            // Check explicit permissions
            else if (userPermissions.length === 0 ||
                userPermissions.includes(userRole) ||
                userPermissions.includes(userWorkplaceRole) ||
                userPermissions.includes('all')) {
                hasAccess = true;
            }

            if (!hasAccess) {
                // Log access denial
                await ReportAuditLog.logEvent({
                    eventType: 'UNAUTHORIZED_ACCESS',
                    reportType: schedule.reportType,
                    scheduleId: new mongoose.Types.ObjectId(schedule._id),
                    userId: new mongoose.Types.ObjectId(req.user!._id),
                    workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                    sessionId: req.sessionId,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    eventDetails: {
                        action: action.toUpperCase(),
                        resource: 'SCHEDULE',
                        resourceId: scheduleId,
                        success: false,
                        errorMessage: `Insufficient permissions for schedule ${action}`
                    },
                    compliance: {
                        dataAccessed: ['SCHEDULE_METADATA'],
                        sensitiveData: false,
                        anonymized: true,
                        encryptionUsed: true
                    },
                    riskScore: 45,
                    flagged: true,
                    flagReason: 'UNAUTHORIZED_ACCESS'
                });

                res.status(403).json({
                    success: false,
                    message: `Access denied: Insufficient permissions to ${action} schedule`,
                    code: 'SCHEDULE_ACCESS_DENIED',
                    scheduleId,
                    action,
                    requiredPermissions: userPermissions
                });
                return;
            }

            // Log successful access
            await ReportAuditLog.logEvent({
                eventType: action === 'view' ? 'SCHEDULE_VIEWED' : 'SCHEDULE_MODIFIED',
                reportType: schedule.reportType,
                scheduleId: new mongoose.Types.ObjectId(schedule._id),
                userId: new mongoose.Types.ObjectId(req.user!._id),
                workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
                sessionId: req.sessionId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                eventDetails: {
                    action: action.toUpperCase(),
                    resource: 'SCHEDULE',
                    resourceId: scheduleId,
                    success: true
                },
                compliance: {
                    dataAccessed: ['SCHEDULE_DATA'],
                    sensitiveData: false,
                    anonymized: true,
                    encryptionUsed: true,
                    accessJustification: `User has ${action} permission for schedule`
                },
                riskScore: action === 'view' ? 5 : 20
            });

            // Attach schedule to request for downstream use
            req.schedule = schedule;

            next();

        } catch (error) {
            logger.error('Schedule access check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify schedule access permissions',
                code: 'SCHEDULE_ACCESS_CHECK_ERROR'
            });
        }
    };
};

/**
 * Check if user can export data in specified format
 */
export const requireExportPermission = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const exportFormat = req.query.format || req.body.format || 'pdf';
    const reportType = req.params.reportType || req.body.reportType;

    // Map export formats to required permissions
    const exportPermissions: Record<string, string[]> = {
        'pdf': ['export_reports'],
        'csv': ['export_data', 'export_reports'],
        'excel': ['export_data', 'export_reports'],
        'json': ['export_raw_data', 'export_data']
    };

    const requiredPermissions = exportPermissions[exportFormat as string] || ['export_reports'];

    // Use the first required permission for the check
    const permissionCheck = requirePermission(requiredPermissions[0], {
        useDynamicRBAC: true,
        enableLegacyFallback: true
    });

    permissionCheck(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        // Log export attempt
        ReportAuditLog.logEvent({
            eventType: 'REPORT_EXPORTED',
            reportType,
            userId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
            sessionId: req.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            eventDetails: {
                action: 'EXPORT',
                resource: 'REPORT',
                resourceId: reportType,
                exportFormat: exportFormat as string,
                success: true
            },
            compliance: {
                dataAccessed: ['REPORT_DATA'],
                sensitiveData: true, // Assume exports contain sensitive data
                anonymized: false,
                encryptionUsed: true,
                accessJustification: `User has ${requiredPermissions[0]} permission`
            },
            riskScore: 25
        }).catch(error => {
            logger.error('Failed to log export event:', error);
        });

        next();
    });
};

/**
 * Validate data access based on filters and ensure field-level security
 */
export const validateDataAccess = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const filters = req.query;
        const reportType = req.params.reportType || req.body.reportType;

        // Determine what types of data will be accessed
        const dataTypes: string[] = [];
        let sensitiveData = false;

        // Map report types to data types
        const reportDataMapping: Record<string, { types: string[], sensitive: boolean }> = {
            'patient-outcomes': { types: ['PATIENT_DATA', 'CLINICAL_DATA'], sensitive: true },
            'pharmacist-interventions': { types: ['PHARMACIST_DATA', 'PERFORMANCE_DATA'], sensitive: false },
            'therapy-effectiveness': { types: ['CLINICAL_DATA', 'MEDICATION_DATA'], sensitive: true },
            'quality-improvement': { types: ['OPERATIONAL_DATA', 'PERFORMANCE_DATA'], sensitive: false },
            'regulatory-compliance': { types: ['AUDIT_DATA', 'COMPLIANCE_DATA'], sensitive: true },
            'cost-effectiveness': { types: ['FINANCIAL_DATA'], sensitive: true },
            'trend-forecasting': { types: ['ANALYTICS_DATA'], sensitive: false },
            'operational-efficiency': { types: ['OPERATIONAL_DATA', 'PERFORMANCE_DATA'], sensitive: false },
            'medication-inventory': { types: ['MEDICATION_DATA', 'INVENTORY_DATA'], sensitive: false },
            'patient-demographics': { types: ['DEMOGRAPHIC_DATA'], sensitive: true },
            'adverse-events': { types: ['CLINICAL_DATA', 'SAFETY_DATA'], sensitive: true }
        };

        const reportData = reportDataMapping[reportType];
        if (reportData) {
            dataTypes.push(...reportData.types);
            sensitiveData = reportData.sensitive;
        }

        // Check for specific patient access
        if (filters.patientId && filters.patientId !== 'system') {
            dataTypes.push('PATIENT_DATA');
            sensitiveData = true;

            // Verify patient access permission
            const patientAccessCheck = requirePermission('view_patient_data', {
                useDynamicRBAC: true
            });

            let hasPatientAccess = false;
            const mockRes = {
                status: () => ({ json: () => { } }),
                json: () => { }
            } as any;

            const mockNext = () => {
                hasPatientAccess = true;
            };

            await patientAccessCheck(req, mockRes, mockNext);

            if (!hasPatientAccess) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied: Insufficient permissions to view patient-specific data',
                    code: 'PATIENT_DATA_ACCESS_DENIED'
                });
                return;
            }
        }

        // Log data access
        await ReportAuditLog.logEvent({
            eventType: 'DATA_ACCESS',
            reportType,
            userId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
            sessionId: req.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            eventDetails: {
                action: 'ACCESS',
                resource: 'DATA',
                filters,
                success: true
            },
            compliance: {
                dataAccessed: dataTypes,
                sensitiveData,
                anonymized: !filters.patientId || filters.patientId === 'system',
                encryptionUsed: true,
                accessJustification: 'User has appropriate permissions for data access'
            },
            riskScore: sensitiveData ? 30 : 10
        });

        // Attach data context to request
        req.dataContext = {
            dataTypes,
            sensitiveData,
            anonymized: !filters.patientId || filters.patientId === 'system'
        };

        next();

    } catch (error) {
        logger.error('Data access validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate data access permissions',
            code: 'DATA_ACCESS_VALIDATION_ERROR'
        });
    }
};

/**
 * Workspace-based data filtering to ensure data isolation
 */
export const enforceWorkspaceIsolation = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = isExtendedUser(req.user!) ? req.user!.role : undefined;
    
    // Super admin users can access data from all workplaces
    if (userRole === 'super_admin') {
        console.log(`🔓 Super admin ${req.user!.email} accessing reports across all workplaces`);
        
        // Log super admin access for audit purposes
        ReportAuditLog.logEvent({
            eventType: 'DATA_ACCESS',
            userId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
            sessionId: req.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            eventDetails: {
                action: 'ACCESS',
                resource: 'DATA',
                resourceId: 'ALL_WORKSPACES',
                success: true,
                metadata: {
                    message: 'Super admin accessing cross-workspace data',
                    accessType: 'cross-workspace',
                    userRole: 'super_admin'
                }
            },
            compliance: {
                dataAccessed: ['PATIENT_DATA', 'CLINICAL_DATA', 'FINANCIAL_DATA', 'SYSTEM_DATA'],
                sensitiveData: true,
                anonymized: false,
                encryptionUsed: true,
                accessJustification: 'Super admin role allows cross-workspace access'
            },
            riskScore: 5 // Low risk for authorized super admin access
        }).catch(error => {
            logger.error('Failed to log super admin access:', error);
        });
        
        // Don't add workspace filter for super admin
        return next();
    }

    // Add workspace filter to all database queries for non-super admin users
    const originalQuery = req.query;

    // Ensure workspace isolation by adding workplaceId to filters
    req.query = {
        ...originalQuery,
        workplaceId: req.user!.workplaceId?.toString() || ''
    };

    // Override any attempt to access different workspace data
    if (originalQuery.workplaceId && originalQuery.workplaceId.toString() !== (req.user!.workplaceId?.toString() || '')) {
        logger.warn('Attempted cross-workspace data access', {
            userId: req.user!._id,
            userWorkspace: req.user!.workplaceId,
            requestedWorkspace: originalQuery.workplaceId,
            ip: req.ip
        });

        // Log security violation
        ReportAuditLog.logEvent({
            eventType: 'UNAUTHORIZED_ACCESS',
            userId: new mongoose.Types.ObjectId(req.user!._id),
            workplaceId: req.user!.workplaceId ? new mongoose.Types.ObjectId(req.user!.workplaceId) : undefined,
            sessionId: req.sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            eventDetails: {
                action: 'ACCESS',
                resource: 'DATA',
                success: false,
                errorMessage: 'Attempted cross-workspace data access'
            },
            compliance: {
                dataAccessed: ['WORKSPACE_DATA'],
                sensitiveData: true,
                anonymized: false,
                encryptionUsed: true
            },
            riskScore: 80,
            flagged: true,
            flagReason: 'SUSPICIOUS_ACTIVITY'
        }).catch(error => {
            logger.error('Failed to log security violation:', error);
        });

        res.status(403).json({
            success: false,
            message: 'Access denied: Cannot access data from different workspace',
            code: 'WORKSPACE_ISOLATION_VIOLATION'
        });
        return;
    }

    next();
};

// Extend AuthRequest interface to include report-specific context
declare module '../types/auth' {
    interface AuthRequest {
        template?: any;
        schedule?: any;
        dataContext?: {
            dataTypes: string[];
            sensitiveData: boolean;
            anonymized: boolean;
        };
    }
}

export default {
    requireReportAccess,
    requireTemplateAccess,
    requireScheduleAccess,
    requireExportPermission,
    validateDataAccess,
    enforceWorkspaceIsolation
};
