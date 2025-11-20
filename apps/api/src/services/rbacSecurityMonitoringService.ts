import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import User, { IUser } from '../models/User';
import Role, { IRole } from '../models/Role';
import { RBACSecurityAuditService } from './rbacAuditService';

export interface SecurityAlert {
    id: string;
    type: 'privilege_escalation' | 'rapid_changes' | 'bulk_suspicious' | 'unauthorized_admin' | 'permission_bypass';
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId: mongoose.Types.ObjectId;
    timestamp: Date;
    description: string;
    details: Record<string, any>;
    resolved: boolean;
    resolvedBy?: mongoose.Types.ObjectId;
    resolvedAt?: Date;
    actions: string[];
}

export interface SuspiciousPattern {
    userId: mongoose.Types.ObjectId;
    patternType: string;
    occurrences: number;
    firstSeen: Date;
    lastSeen: Date;
    riskScore: number;
    details: Record<string, any>;
}

export interface PrivilegeEscalationAttempt {
    userId: mongoose.Types.ObjectId;
    targetUserId?: mongoose.Types.ObjectId;
    attemptType: 'self_escalation' | 'unauthorized_admin_assignment' | 'role_manipulation' | 'permission_bypass';
    timestamp: Date;
    details: Record<string, any>;
    blocked: boolean;
    riskScore: number;
}

class RBACSecurityMonitoringService {
    private static instance: RBACSecurityMonitoringService;
    private activeAlerts: Map<string, SecurityAlert> = new Map();
    private suspiciousPatterns: Map<string, SuspiciousPattern> = new Map();
    private privilegeEscalationAttempts: PrivilegeEscalationAttempt[] = [];

    // Thresholds for suspicious activity detection
    private readonly RAPID_ROLE_ASSIGNMENT_THRESHOLD = 10; // roles assigned within 5 minutes
    private readonly BULK_OPERATION_THRESHOLD = 50; // bulk operations affecting more than 50 users
    private readonly PRIVILEGE_ESCALATION_RISK_THRESHOLD = 80;
    private readonly ADMIN_ROLE_ASSIGNMENT_COOLDOWN = 300000; // 5 minutes

    static getInstance(): RBACSecurityMonitoringService {
        if (!RBACSecurityMonitoringService.instance) {
            RBACSecurityMonitoringService.instance = new RBACSecurityMonitoringService();
        }
        return RBACSecurityMonitoringService.instance;
    }

    /**
     * Monitor role assignment for suspicious patterns
     */
    async monitorRoleAssignment(
        assignerId: mongoose.Types.ObjectId,
        targetUserId: mongoose.Types.ObjectId,
        roleId: mongoose.Types.ObjectId,
        roleName: string,
        context: any
    ): Promise<{ allowed: boolean; alerts: SecurityAlert[] }> {
        const alerts: SecurityAlert[] = [];
        let allowed = true;

        // Check for self-privilege escalation
        if (assignerId.toString() === targetUserId.toString()) {
            const escalationAttempt = await this.detectSelfPrivilegeEscalation(
                assignerId,
                roleId,
                roleName,
                context
            );

            if (escalationAttempt.blocked) {
                allowed = false;
                alerts.push(await this.createSecurityAlert(
                    'privilege_escalation',
                    'critical',
                    assignerId,
                    'Self-privilege escalation attempt detected',
                    escalationAttempt.details,
                    ['block_operation', 'notify_admins', 'require_approval']
                ));
            }
        }

        // Check for rapid role assignments
        const rapidAssignmentAlert = await this.detectRapidRoleAssignments(assignerId);
        if (rapidAssignmentAlert) {
            alerts.push(rapidAssignmentAlert);
        }

        // Check for unauthorized admin role assignment
        if (this.isAdminRole(roleName)) {
            const adminAssignmentAlert = await this.detectUnauthorizedAdminAssignment(
                assignerId,
                targetUserId,
                roleName,
                context
            );

            if (adminAssignmentAlert) {
                alerts.push(adminAssignmentAlert);
                if (adminAssignmentAlert.severity === 'critical') {
                    allowed = false;
                }
            }
        }

        // Log all alerts
        for (const alert of alerts) {
            await this.logSecurityAlert(alert);
        }

        return { allowed, alerts };
    }

    /**
     * Monitor bulk operations for suspicious activity
     */
    async monitorBulkOperation(
        userId: mongoose.Types.ObjectId,
        operationType: string,
        itemCount: number,
        affectedUsers: mongoose.Types.ObjectId[],
        context: any
    ): Promise<{ allowed: boolean; alerts: SecurityAlert[] }> {
        const alerts: SecurityAlert[] = [];
        let allowed = true;

        // Check if bulk operation exceeds threshold
        if (itemCount > this.BULK_OPERATION_THRESHOLD) {
            const hasAdminPermission = await this.verifyAdminPermission(userId, 'bulk_operations');

            if (!hasAdminPermission) {
                allowed = false;
                alerts.push(await this.createSecurityAlert(
                    'bulk_suspicious',
                    'high',
                    userId,
                    `Large bulk operation (${itemCount} items) without proper authorization`,
                    {
                        operationType,
                        itemCount,
                        affectedUserCount: affectedUsers.length,
                        hasAdminPermission
                    },
                    ['block_operation', 'require_admin_approval', 'notify_security_team']
                ));
            }
        }

        // Check for suspicious bulk patterns
        const bulkPatternAlert = await this.detectSuspiciousBulkPatterns(
            userId,
            operationType,
            itemCount,
            affectedUsers
        );

        if (bulkPatternAlert) {
            alerts.push(bulkPatternAlert);
        }

        // Log all alerts
        for (const alert of alerts) {
            await this.logSecurityAlert(alert);
        }

        return { allowed, alerts };
    }

    /**
     * Monitor permission bypass attempts
     */
    async monitorPermissionBypass(
        userId: mongoose.Types.ObjectId,
        attemptedAction: string,
        deniedReason: string,
        context: any
    ): Promise<SecurityAlert | null> {
        // Track repeated permission bypass attempts
        const userKey = userId.toString();
        const pattern = this.suspiciousPatterns.get(userKey) || {
            userId,
            patternType: 'permission_bypass',
            occurrences: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            riskScore: 0,
            details: { attemptedActions: [] }
        };

        pattern.occurrences++;
        pattern.lastSeen = new Date();
        pattern.details.attemptedActions.push({
            action: attemptedAction,
            reason: deniedReason,
            timestamp: new Date()
        });

        // Calculate risk score based on frequency and action types
        pattern.riskScore = this.calculateBypassRiskScore(pattern);

        this.suspiciousPatterns.set(userKey, pattern);

        // Create alert if threshold exceeded
        if (pattern.occurrences >= 5 && pattern.riskScore >= 60) {
            const alert = await this.createSecurityAlert(
                'permission_bypass',
                pattern.riskScore >= 80 ? 'high' : 'medium',
                userId,
                `Multiple permission bypass attempts detected (${pattern.occurrences} attempts)`,
                {
                    attemptedActions: pattern.details.attemptedActions,
                    riskScore: pattern.riskScore,
                    timespan: pattern.lastSeen.getTime() - pattern.firstSeen.getTime()
                },
                ['monitor_user', 'review_permissions', 'notify_admins']
            );

            await this.logSecurityAlert(alert);
            return alert;
        }

        return null;
    }

    /**
     * Detect self-privilege escalation attempts
     */
    private async detectSelfPrivilegeEscalation(
        userId: mongoose.Types.ObjectId,
        roleId: mongoose.Types.ObjectId,
        roleName: string,
        context: any
    ): Promise<PrivilegeEscalationAttempt> {
        const user = await User.findById(userId);
        const role = await Role.findById(roleId);

        let riskScore = 50; // Base risk for self-assignment
        let blocked = false;
        const details: Record<string, any> = {
            targetRole: roleName,
            currentRoles: user?.assignedRoles || [],
            timestamp: new Date()
        };

        // Increase risk for admin roles
        if (this.isAdminRole(roleName)) {
            riskScore += 40;
            blocked = true; // Always block self-admin assignment
            details.escalationType = 'admin_self_assignment';
        }

        // Increase risk for super admin roles
        if (this.isSuperAdminRole(roleName)) {
            riskScore = 100;
            blocked = true;
            details.escalationType = 'super_admin_self_assignment';
        }

        // Check if user already has higher privileges
        if (user && await this.hasHigherPrivileges(user, role)) {
            riskScore -= 20; // Lower risk if already has higher privileges
            details.hasHigherPrivileges = true;
        }

        const attempt: PrivilegeEscalationAttempt = {
            userId,
            attemptType: 'self_escalation',
            timestamp: new Date(),
            details,
            blocked,
            riskScore
        };

        this.privilegeEscalationAttempts.push(attempt);

        // Log the attempt
        await RBACSecurityAuditService.logPermissionChange({
            userId,
            action: 'PRIVILEGE_ESCALATION_ATTEMPT',
            roleId,
            roleName,
            securityContext: {
                riskScore,
                anomalyDetected: true,
                escalationReason: `Self-privilege escalation to ${roleName}`
            }
        });

        return attempt;
    }

    /**
     * Detect rapid role assignments
     */
    private async detectRapidRoleAssignments(
        userId: mongoose.Types.ObjectId
    ): Promise<SecurityAlert | null> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const recentAssignments = await AuditLog.countDocuments({
            userId,
            action: 'ROLE_ASSIGNED',
            timestamp: { $gte: fiveMinutesAgo }
        });

        if (recentAssignments >= this.RAPID_ROLE_ASSIGNMENT_THRESHOLD) {
            return await this.createSecurityAlert(
                'rapid_changes',
                'medium',
                userId,
                `Rapid role assignments detected (${recentAssignments} in 5 minutes)`,
                {
                    assignmentCount: recentAssignments,
                    timeWindow: '5 minutes',
                    threshold: this.RAPID_ROLE_ASSIGNMENT_THRESHOLD
                },
                ['monitor_user', 'rate_limit', 'notify_admins']
            );
        }

        return null;
    }

    /**
     * Detect unauthorized admin role assignments
     */
    private async detectUnauthorizedAdminAssignment(
        assignerId: mongoose.Types.ObjectId,
        targetUserId: mongoose.Types.ObjectId,
        roleName: string,
        context: any
    ): Promise<SecurityAlert | null> {
        const assigner = await User.findById(assignerId);

        // Check if assigner has permission to assign admin roles
        const hasAdminAssignmentPermission = await this.verifyAdminPermission(
            assignerId,
            'admin_role_assignment'
        );

        if (!hasAdminAssignmentPermission) {
            const severity = this.isSuperAdminRole(roleName) ? 'critical' : 'high';

            return await this.createSecurityAlert(
                'unauthorized_admin',
                severity,
                assignerId,
                `Unauthorized attempt to assign admin role: ${roleName}`,
                {
                    targetUserId,
                    roleName,
                    assignerRoles: assigner?.assignedRoles || [],
                    hasPermission: hasAdminAssignmentPermission
                },
                severity === 'critical'
                    ? ['block_operation', 'notify_security_team', 'require_super_admin_approval']
                    : ['require_admin_approval', 'notify_admins']
            );
        }

        return null;
    }

    /**
     * Detect suspicious bulk operation patterns
     */
    private async detectSuspiciousBulkPatterns(
        userId: mongoose.Types.ObjectId,
        operationType: string,
        itemCount: number,
        affectedUsers: mongoose.Types.ObjectId[]
    ): Promise<SecurityAlert | null> {
        // Check for bulk operations affecting admin users
        const adminUsers = await User.find({
            _id: { $in: affectedUsers },
            $or: [
                { role: { $in: ['super_admin', 'owner'] } },
                { assignedRoles: { $exists: true, $ne: [] } }
            ]
        });

        if (adminUsers.length > 0) {
            return await this.createSecurityAlert(
                'bulk_suspicious',
                'high',
                userId,
                `Bulk operation affecting ${adminUsers.length} admin users`,
                {
                    operationType,
                    totalItems: itemCount,
                    adminUsersAffected: adminUsers.length,
                    adminUserIds: adminUsers.map((u: any) => u._id)
                },
                ['require_admin_approval', 'notify_security_team', 'audit_operation']
            );
        }

        // Check for bulk operations during off-hours
        const hour = new Date().getHours();
        if ((hour < 6 || hour > 22) && itemCount > 20) {
            return await this.createSecurityAlert(
                'bulk_suspicious',
                'medium',
                userId,
                `Large bulk operation during off-hours (${hour}:00)`,
                {
                    operationType,
                    itemCount,
                    hour,
                    isOffHours: true
                },
                ['monitor_operation', 'notify_admins', 'require_justification']
            );
        }

        return null;
    }

    /**
     * Calculate risk score for permission bypass attempts
     */
    private calculateBypassRiskScore(pattern: SuspiciousPattern): number {
        let score = pattern.occurrences * 10;

        // Increase score for high-privilege actions
        const highPrivilegeActions = pattern.details.attemptedActions.filter((attempt: any) =>
            attempt.action.includes('admin') ||
            attempt.action.includes('delete') ||
            attempt.action.includes('modify')
        );

        score += highPrivilegeActions.length * 15;

        // Increase score for rapid attempts
        const timespan = pattern.lastSeen.getTime() - pattern.firstSeen.getTime();
        if (timespan < 300000) { // Less than 5 minutes
            score += 20;
        }

        return Math.min(score, 100);
    }

    /**
     * Create security alert
     */
    private async createSecurityAlert(
        type: SecurityAlert['type'],
        severity: SecurityAlert['severity'],
        userId: mongoose.Types.ObjectId,
        description: string,
        details: Record<string, any>,
        actions: string[]
    ): Promise<SecurityAlert> {
        const alert: SecurityAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity,
            userId,
            timestamp: new Date(),
            description,
            details,
            resolved: false,
            actions
        };

        this.activeAlerts.set(alert.id, alert);
        return alert;
    }

    /**
     * Log security alert to audit system
     */
    private async logSecurityAlert(alert: SecurityAlert): Promise<void> {
        await RBACSecurityAuditService.logPermissionChange({
            userId: alert.userId,
            action: 'SECURITY_POLICY_VIOLATION',
            securityContext: {
                riskScore: this.severityToRiskScore(alert.severity),
                anomalyDetected: true,
                escalationReason: alert.description
            }
        });
    }

    /**
     * Verify admin permission
     */
    private async verifyAdminPermission(
        userId: mongoose.Types.ObjectId,
        permission: string
    ): Promise<boolean> {
        const user = await User.findById(userId);
        if (!user) return false;

        // Super admin always has permission
        if (user.role === 'super_admin') return true;

        // Check if user has admin role
        if (user.role === 'owner' || user.workplaceRole === 'Owner') return true;

        // TODO: Integrate with dynamic permission service
        // return await DynamicPermissionService.checkPermission(user, permission);

        return false;
    }

    /**
     * Check if role is admin role
     */
    private isAdminRole(roleName: string): boolean {
        const adminRoles = ['admin', 'administrator', 'owner', 'manager', 'super_admin'];
        return adminRoles.some(role => roleName.toLowerCase().includes(role));
    }

    /**
     * Check if role is super admin role
     */
    private isSuperAdminRole(roleName: string): boolean {
        const superAdminRoles = ['super_admin', 'system_admin', 'root'];
        return superAdminRoles.some(role => roleName.toLowerCase().includes(role));
    }

    /**
     * Check if user has higher privileges than the role being assigned
     */
    private async hasHigherPrivileges(user: IUser, role: IRole | null): Promise<boolean> {
        if (!role) return false;

        // Super admin always has higher privileges
        if (user.role === 'super_admin') return true;

        // TODO: Implement proper privilege comparison logic
        // This would compare the user's current permissions with the role's permissions

        return false;
    }

    /**
     * Convert severity to risk score
     */
    private severityToRiskScore(severity: SecurityAlert['severity']): number {
        const scoreMap = {
            'low': 25,
            'medium': 50,
            'high': 75,
            'critical': 95
        };
        return scoreMap[severity];
    }

    /**
     * Get active security alerts
     */
    getActiveAlerts(userId?: mongoose.Types.ObjectId): SecurityAlert[] {
        const alerts = Array.from(this.activeAlerts.values());

        if (userId) {
            return alerts.filter(alert => alert.userId.toString() === userId.toString());
        }

        return alerts.filter(alert => !alert.resolved);
    }

    /**
     * Resolve security alert
     */
    async resolveAlert(
        alertId: string,
        resolvedBy: mongoose.Types.ObjectId,
        resolution: string
    ): Promise<boolean> {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) return false;

        alert.resolved = true;
        alert.resolvedBy = resolvedBy;
        alert.resolvedAt = new Date();
        alert.details.resolution = resolution;

        // Log resolution
        await RBACSecurityAuditService.logPermissionChange({
            userId: resolvedBy,
            action: 'SECURITY_ALERT_RESOLVED',
            securityContext: {
                riskScore: 10,
                anomalyDetected: false
            }
        });

        return true;
    }

    /**
     * Get security monitoring statistics
     */
    async getSecurityStatistics(
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalAlerts: number;
        alertsBySeverity: Record<string, number>;
        alertsByType: Record<string, number>;
        privilegeEscalationAttempts: number;
        resolvedAlerts: number;
        averageResolutionTime: number;
    }> {
        const alerts = Array.from(this.activeAlerts.values()).filter(
            alert => alert.timestamp >= startDate && alert.timestamp <= endDate
        );

        const alertsBySeverity = alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const alertsByType = alerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const resolvedAlerts = alerts.filter(alert => alert.resolved);
        const averageResolutionTime = resolvedAlerts.length > 0
            ? resolvedAlerts.reduce((sum, alert) => {
                if (alert.resolvedAt) {
                    return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime());
                }
                return sum;
            }, 0) / resolvedAlerts.length
            : 0;

        return {
            totalAlerts: alerts.length,
            alertsBySeverity,
            alertsByType,
            privilegeEscalationAttempts: this.privilegeEscalationAttempts.filter(
                attempt => attempt.timestamp >= startDate && attempt.timestamp <= endDate
            ).length,
            resolvedAlerts: resolvedAlerts.length,
            averageResolutionTime: Math.round(averageResolutionTime / 1000 / 60) // Convert to minutes
        };
    }

    /**
     * Clean up old alerts and patterns
     */
    cleanupOldData(daysToKeep: number = 30): void {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        // Clean up resolved alerts
        for (const [alertId, alert] of this.activeAlerts.entries()) {
            if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
                this.activeAlerts.delete(alertId);
            }
        }

        // Clean up old suspicious patterns
        for (const [userId, pattern] of this.suspiciousPatterns.entries()) {
            if (pattern.lastSeen < cutoffDate) {
                this.suspiciousPatterns.delete(userId);
            }
        }

        // Clean up old privilege escalation attempts
        this.privilegeEscalationAttempts = this.privilegeEscalationAttempts.filter(
            attempt => attempt.timestamp >= cutoffDate
        );
    }
}

export { RBACSecurityMonitoringService };
export default RBACSecurityMonitoringService;