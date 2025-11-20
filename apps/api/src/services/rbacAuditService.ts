import { AuditLog, IAuditLog } from '../models/AuditLog';
import { AuditService, AuditLogData } from './auditService';
import { Request } from 'express';
import mongoose from 'mongoose';
import { IUser } from '../models/User';
import { IRole } from '../models/Role';

export interface RBACSecurityContext {
    riskScore: number;
    anomalyDetected: boolean;
    escalationReason?: string;
    previousPermissions?: string[];
    newPermissions?: string[];
}

export interface RBACBulkOperation {
    operationId: string;
    operationType: 'role_assignment' | 'permission_update' | 'role_creation' | 'role_deletion';
    totalItems: number;
    successCount: number;
    failureCount: number;
    startTime: Date;
    endTime?: Date;
    errors?: Array<{
        itemId: string;
        error: string;
        timestamp: Date;
    }>;
}

export interface RBACPermissionChange {
    userId: mongoose.Types.ObjectId;
    action: string;
    roleId?: mongoose.Types.ObjectId;
    roleName?: string;
    permissionAction?: string;
    permissionSource?: 'direct' | 'role' | 'inherited' | 'legacy';
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    securityContext?: RBACSecurityContext;
    hierarchyLevel?: number;
    targetUserId?: mongoose.Types.ObjectId;
}

class RBACSecurityMonitor {
    private static instance: RBACSecurityMonitor;
    private suspiciousPatterns: Map<string, number> = new Map();
    private bulkOperations: Map<string, RBACBulkOperation> = new Map();

    static getInstance(): RBACSecurityMonitor {
        if (!RBACSecurityMonitor.instance) {
            RBACSecurityMonitor.instance = new RBACSecurityMonitor();
        }
        return RBACSecurityMonitor.instance;
    }

    /**
     * Calculate risk score for RBAC operation
     */
    calculateRiskScore(
        action: string,
        userId: mongoose.Types.ObjectId,
        context: any
    ): number {
        let riskScore = 0;

        // Base risk scores by action type
        const actionRiskScores: Record<string, number> = {
            'ROLE_CREATED': 30,
            'ROLE_UPDATED': 25,
            'ROLE_DELETED': 40,
            'ROLE_ASSIGNED': 20,
            'ROLE_REVOKED': 25,
            'ADMIN_ROLE_ASSIGNMENT': 80,
            'SUPER_ADMIN_ACCESS': 90,
            'PRIVILEGE_ESCALATION_ATTEMPT': 95,
            'BULK_ROLE_ASSIGNMENT': 50,
            'ROLE_HIERARCHY_MODIFIED': 60,
            'PERMISSION_GRANTED': 15,
            'PERMISSION_REVOKED': 20,
            'UNAUTHORIZED_ACCESS_ATTEMPT': 85
        };

        riskScore = actionRiskScores[action] || 10;

        // Increase risk for admin role operations
        if (context.targetRole?.includes('admin') || context.targetRole?.includes('super')) {
            riskScore += 30;
        }

        // Increase risk for bulk operations
        if (context.bulkCount && context.bulkCount > 10) {
            riskScore += Math.min(context.bulkCount * 2, 40);
        }

        // Increase risk for rapid successive operations
        const userKey = userId.toString();
        const recentCount = this.suspiciousPatterns.get(userKey) || 0;
        if (recentCount > 5) {
            riskScore += 25;
        }

        // Increase risk for operations outside business hours
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            riskScore += 15;
        }

        // Increase risk for hierarchy modifications
        if (context.hierarchyLevel && context.hierarchyLevel > 3) {
            riskScore += 20;
        }

        return Math.min(riskScore, 100);
    }

    /**
     * Detect anomalous patterns
     */
    detectAnomalies(
        action: string,
        userId: mongoose.Types.ObjectId,
        context: any
    ): { detected: boolean; reason?: string } {
        const userKey = userId.toString();
        const currentCount = this.suspiciousPatterns.get(userKey) || 0;

        // Update pattern tracking
        this.suspiciousPatterns.set(userKey, currentCount + 1);

        // Clear old patterns (reset every hour)
        setTimeout(() => {
            this.suspiciousPatterns.delete(userKey);
        }, 3600000);

        // Detect rapid role assignments
        if (currentCount > 10 && action.includes('ROLE_ASSIGNED')) {
            return {
                detected: true,
                reason: 'Rapid role assignment pattern detected'
            };
        }

        // Detect privilege escalation attempts
        if (action === 'ADMIN_ROLE_ASSIGNMENT' && context.targetUserId?.toString() === userId.toString()) {
            return {
                detected: true,
                reason: 'Self-privilege escalation attempt'
            };
        }

        // Detect bulk operations without proper authorization
        if (context.bulkCount > 50 && !context.hasAdminPermission) {
            return {
                detected: true,
                reason: 'Large bulk operation without admin permission'
            };
        }

        // Detect unusual hierarchy modifications
        if (action === 'ROLE_HIERARCHY_MODIFIED' && context.hierarchyLevel > 5) {
            return {
                detected: true,
                reason: 'Deep hierarchy modification detected'
            };
        }

        return { detected: false };
    }

    /**
     * Track bulk operation
     */
    startBulkOperation(
        operationType: RBACBulkOperation['operationType'],
        totalItems: number
    ): string {
        const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.bulkOperations.set(operationId, {
            operationId,
            operationType,
            totalItems,
            successCount: 0,
            failureCount: 0,
            startTime: new Date(),
            errors: []
        });

        return operationId;
    }

    /**
     * Update bulk operation progress
     */
    updateBulkOperation(
        operationId: string,
        success: boolean,
        error?: { itemId: string; error: string }
    ): void {
        const operation = this.bulkOperations.get(operationId);
        if (!operation) return;

        if (success) {
            operation.successCount++;
        } else {
            operation.failureCount++;
            if (error) {
                operation.errors?.push({
                    ...error,
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * Complete bulk operation
     */
    completeBulkOperation(operationId: string): RBACBulkOperation | null {
        const operation = this.bulkOperations.get(operationId);
        if (!operation) return null;

        operation.endTime = new Date();
        this.bulkOperations.delete(operationId);

        return operation;
    }
}

class RBACSecurityAuditService extends AuditService {
    private static securityMonitor = RBACSecurityMonitor.getInstance();

    /**
     * Log RBAC permission change with enhanced security context
     */
    static async logPermissionChange(
        change: RBACPermissionChange,
        req?: Request
    ): Promise<IAuditLog> {
        const securityMonitor = RBACSecurityAuditService.securityMonitor;

        // Calculate risk score and detect anomalies
        const riskScore = securityMonitor.calculateRiskScore(
            change.action,
            change.userId,
            {
                targetRole: change.roleName,
                bulkCount: 1,
                hierarchyLevel: change.hierarchyLevel,
                targetUserId: change.targetUserId
            }
        );

        const anomalyResult = securityMonitor.detectAnomalies(
            change.action,
            change.userId,
            {
                targetUserId: change.targetUserId,
                hierarchyLevel: change.hierarchyLevel
            }
        );

        const securityContext: RBACSecurityContext = {
            riskScore,
            anomalyDetected: anomalyResult.detected,
            escalationReason: anomalyResult.reason,
            previousPermissions: change.securityContext?.previousPermissions,
            newPermissions: change.securityContext?.newPermissions,
            ...change.securityContext
        };

        const auditData: AuditLogData = {
            action: change.action,
            userId: change.userId.toString(),
            details: {
                roleId: change.roleId,
                roleName: change.roleName,
                permissionAction: change.permissionAction,
                permissionSource: change.permissionSource,
                targetUserId: change.targetUserId,
                hierarchyLevel: change.hierarchyLevel,
                securityContext
            },
            complianceCategory: 'rbac_management',
            riskLevel: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
            oldValues: change.oldValues,
            newValues: change.newValues
        };

        const auditLog = await RBACSecurityAuditService.createAuditLog(auditData, req);

        // Store RBAC-specific fields
        await AuditLog.findByIdAndUpdate(auditLog._id, {
            $set: {
                roleId: change.roleId,
                roleName: change.roleName,
                targetUserId: change.targetUserId,
                permissionAction: change.permissionAction,
                permissionSource: change.permissionSource,
                hierarchyLevel: change.hierarchyLevel,
                securityContext
            }
        });

        // Trigger alerts for high-risk operations
        if (riskScore >= 80 || anomalyResult.detected) {
            await RBACSecurityAuditService.triggerSecurityAlert(auditLog, securityContext);
        }

        return auditLog;
    }

    /**
     * Log bulk RBAC operation
     */
    static async logBulkOperation(
        operationType: RBACBulkOperation['operationType'],
        userId: mongoose.Types.ObjectId,
        items: Array<{ id: string; success: boolean; error?: string }>,
        req?: Request
    ): Promise<{ operationId: string; auditLog: IAuditLog }> {
        const securityMonitor = RBACSecurityAuditService.securityMonitor;
        const operationId = securityMonitor.startBulkOperation(operationType, items.length);

        // Process each item
        items.forEach(item => {
            securityMonitor.updateBulkOperation(
                operationId,
                item.success,
                item.error ? { itemId: item.id, error: item.error } : undefined
            );
        });

        const operation = securityMonitor.completeBulkOperation(operationId);
        if (!operation) {
            throw new Error('Failed to complete bulk operation tracking');
        }

        const riskScore = securityMonitor.calculateRiskScore(
            'BULK_ROLE_ASSIGNMENT',
            userId,
            {
                bulkCount: items.length,
                hasAdminPermission: true // This should be checked by caller
            }
        );

        const auditData: AuditLogData = {
            action: 'BULK_ROLE_ASSIGNMENT',
            userId: userId.toString(),
            details: {
                operationType,
                totalItems: operation.totalItems,
                successCount: operation.successCount,
                failureCount: operation.failureCount,
                duration: operation.endTime ?
                    operation.endTime.getTime() - operation.startTime.getTime() : 0,
                errors: operation.errors
            },
            complianceCategory: 'rbac_management',
            riskLevel: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : 'medium'
        };

        const auditLog = await RBACSecurityAuditService.createAuditLog(auditData, req);

        // Store bulk operation ID
        await AuditLog.findByIdAndUpdate(auditLog._id, {
            $set: {
                bulkOperationId: operationId,
                securityContext: {
                    riskScore,
                    anomalyDetected: riskScore >= 80
                }
            }
        });

        return { operationId, auditLog };
    }

    /**
     * Log role hierarchy modification
     */
    static async logRoleHierarchyChange(
        userId: mongoose.Types.ObjectId,
        roleId: mongoose.Types.ObjectId,
        roleName: string,
        action: 'ROLE_HIERARCHY_MODIFIED' | 'ROLE_INHERITANCE_MODIFIED',
        oldHierarchy: any,
        newHierarchy: any,
        req?: Request
    ): Promise<IAuditLog> {
        return RBACSecurityAuditService.logPermissionChange({
            userId,
            action,
            roleId,
            roleName,
            hierarchyLevel: newHierarchy.level,
            oldValues: { hierarchy: oldHierarchy },
            newValues: { hierarchy: newHierarchy },
            securityContext: {
                riskScore: 0, // Will be calculated
                anomalyDetected: false,
                previousPermissions: oldHierarchy.permissions,
                newPermissions: newHierarchy.permissions
            }
        }, req);
    }

    /**
     * Log permission check with denial reason
     */
    static async logPermissionCheck(
        userId: mongoose.Types.ObjectId,
        permissionAction: string,
        allowed: boolean,
        source: 'direct' | 'role' | 'inherited' | 'legacy',
        context: any,
        req?: Request
    ): Promise<IAuditLog> {
        const action = allowed ? 'PERMISSION_CHECKED' : 'PERMISSION_DENIED';

        const auditData: AuditLogData = {
            action,
            userId: userId.toString(),
            details: {
                permissionAction,
                allowed,
                source,
                reason: context.reason,
                roleId: context.roleId,
                roleName: context.roleName,
                requiredPermissions: context.requiredPermissions
            },
            complianceCategory: 'access_control',
            riskLevel: allowed ? 'low' : 'medium'
        };

        const auditLog = await RBACSecurityAuditService.createAuditLog(auditData, req);

        // Store permission-specific fields
        await AuditLog.findByIdAndUpdate(auditLog._id, {
            $set: {
                permissionAction,
                permissionSource: source,
                roleId: context.roleId
            }
        });

        return auditLog;
    }

    /**
     * Get RBAC audit summary
     */
    static async getRBACSecuritySummary(
        startDate: Date,
        endDate: Date,
        workspaceId?: mongoose.Types.ObjectId
    ) {
        const query: any = {
            timestamp: { $gte: startDate, $lte: endDate },
            complianceCategory: { $in: ['rbac_management', 'security_monitoring', 'access_control'] }
        };

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        const [
            totalRBACOperations,
            highRiskOperations,
            anomalousOperations,
            privilegeEscalations,
            bulkOperations,
            permissionDenials,
            roleOperations,
            recentAlerts
        ] = await Promise.all([
            AuditLog.countDocuments(query),
            AuditLog.countDocuments({ ...query, riskLevel: { $in: ['high', 'critical'] } }),
            AuditLog.countDocuments({ ...query, 'securityContext.anomalyDetected': true }),
            AuditLog.countDocuments({ ...query, action: 'PRIVILEGE_ESCALATION_ATTEMPT' }),
            AuditLog.countDocuments({ ...query, bulkOperationId: { $exists: true } }),
            AuditLog.countDocuments({ ...query, action: 'PERMISSION_DENIED' }),
            AuditLog.aggregate([
                { $match: { ...query, action: { $regex: '^ROLE_' } } },
                { $group: { _id: '$action', count: { $sum: 1 } } }
            ]),
            AuditLog.find({
                ...query,
                'securityContext.anomalyDetected': true,
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
                .sort({ timestamp: -1 })
                .limit(10)
                .populate('userId', 'firstName lastName email')
        ]);

        return {
            summary: {
                totalRBACOperations,
                highRiskOperations,
                anomalousOperations,
                privilegeEscalations,
                bulkOperations,
                permissionDenials,
                securityScore: Math.max(0, 100 - (highRiskOperations / Math.max(totalRBACOperations, 1)) * 100)
            },
            roleOperations: roleOperations.reduce((acc: any, item: any) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            recentAlerts: recentAlerts.map(alert => ({
                id: alert._id,
                action: alert.action,
                timestamp: alert.timestamp,
                user: alert.userId,
                riskScore: alert.securityContext?.riskScore,
                reason: alert.securityContext?.escalationReason
            }))
        };
    }

    /**
     * Trigger security alert for high-risk operations
     */
    private static async triggerSecurityAlert(
        auditLog: IAuditLog,
        securityContext: RBACSecurityContext
    ): Promise<void> {
        // This would integrate with your alerting system
        console.warn('RBAC Security Alert:', {
            auditLogId: auditLog._id,
            action: auditLog.action,
            userId: auditLog.userId,
            riskScore: securityContext.riskScore,
            anomalyDetected: securityContext.anomalyDetected,
            escalationReason: securityContext.escalationReason,
            timestamp: auditLog.timestamp
        });

        // TODO: Integrate with notification service, email alerts, etc.
        // await NotificationService.sendSecurityAlert({
        //   type: 'rbac_security_alert',
        //   severity: securityContext.riskScore >= 90 ? 'critical' : 'high',
        //   details: { auditLogId: auditLog._id, securityContext }
        // });
    }

    /**
     * Export RBAC audit logs with enhanced filtering
     */
    static async exportRBACLogs(options: {
        startDate: Date;
        endDate: Date;
        includeSecurityContext?: boolean;
        riskLevelFilter?: string[];
        actionFilter?: string[];
        format: 'csv' | 'json';
    }) {
        const query: any = {
            timestamp: { $gte: options.startDate, $lte: options.endDate },
            complianceCategory: { $in: ['rbac_management', 'security_monitoring', 'access_control'] }
        };

        if (options.riskLevelFilter?.length) {
            query.riskLevel = { $in: options.riskLevelFilter };
        }

        if (options.actionFilter?.length) {
            query.action = { $in: options.actionFilter };
        }

        const logs = await AuditLog.find(query)
            .populate('userId', 'firstName lastName email')
            .populate('targetUserId', 'firstName lastName email')
            .populate('roleId', 'name displayName')
            .sort({ timestamp: -1 })
            .lean();

        if (options.format === 'csv') {
            return RBACSecurityAuditService.convertRBACLogsToCSV(logs, options.includeSecurityContext);
        } else {
            return JSON.stringify(logs, null, 2);
        }
    }

    /**
     * Convert RBAC logs to CSV format
     */
    private static convertRBACLogsToCSV(logs: any[], includeSecurityContext = false): string {
        if (logs.length === 0) {
            return 'No RBAC audit data available';
        }

        const baseHeaders = [
            'Timestamp',
            'Action',
            'User',
            'User Email',
            'Target User',
            'Role Name',
            'Permission Action',
            'Permission Source',
            'Risk Level',
            'IP Address',
            'Bulk Operation ID'
        ];

        const securityHeaders = [
            'Risk Score',
            'Anomaly Detected',
            'Escalation Reason',
            'Previous Permissions',
            'New Permissions'
        ];

        const headers = includeSecurityContext ? [...baseHeaders, ...securityHeaders] : baseHeaders;

        const rows = logs.map(log => {
            const baseRow = [
                log.timestamp,
                log.action,
                log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'Unknown',
                log.userId?.email || 'Unknown',
                log.targetUserId ? `${log.targetUserId.firstName} ${log.targetUserId.lastName}` : '',
                log.roleName || '',
                log.permissionAction || '',
                log.permissionSource || '',
                log.riskLevel,
                log.ipAddress || '',
                log.bulkOperationId || ''
            ];

            if (includeSecurityContext) {
                const securityRow = [
                    log.securityContext?.riskScore || 0,
                    log.securityContext?.anomalyDetected || false,
                    log.securityContext?.escalationReason || '',
                    log.securityContext?.previousPermissions?.join('; ') || '',
                    log.securityContext?.newPermissions?.join('; ') || ''
                ];
                return [...baseRow, ...securityRow];
            }

            return baseRow;
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        return csvContent;
    }
}

export { RBACSecurityAuditService, RBACSecurityMonitor };
export default RBACSecurityAuditService;