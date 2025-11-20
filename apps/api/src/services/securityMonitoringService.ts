import { Request } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/auth';
import { getAuditLogs, createAuditLog } from '../middlewares/auditLogging';
import logger from '../utils/logger';
import User from '../models/User';
import Session from '../models/Session';
import Workplace from '../models/Workplace';

/**
 * Security monitoring and threat detection service
 */

interface SecurityThreat {
    id: string;
    type: 'brute_force' | 'suspicious_activity' | 'permission_escalation' | 'data_exfiltration' | 'session_hijacking' | 'invitation_spam';
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: mongoose.Types.ObjectId;
    workspaceId?: mongoose.Types.ObjectId;
    ipAddress: string;
    userAgent: string;
    description: string;
    evidence: any;
    timestamp: Date;
    resolved: boolean;
    actions: string[];
}

interface SecurityAlert {
    id: string;
    threatId: string;
    type: 'email' | 'webhook' | 'log' | 'block';
    recipient?: string;
    message: string;
    sent: boolean;
    sentAt?: Date;
    error?: string;
}

// In-memory stores (in production, use Redis or MongoDB)
const securityThreats: SecurityThreat[] = [];
const securityAlerts: SecurityAlert[] = [];
const blockedIPs = new Set<string>();
const suspiciousUsers = new Map<string, { score: number; lastActivity: Date }>();

// Configuration
const SECURITY_CONFIG = {
    // Brute force detection
    MAX_FAILED_LOGINS: 5,
    FAILED_LOGIN_WINDOW: 15 * 60 * 1000, // 15 minutes

    // Rate limiting thresholds
    MAX_REQUESTS_PER_MINUTE: 100,
    MAX_INVITATIONS_PER_HOUR: 10,

    // Suspicious activity thresholds
    HIGH_RISK_SCORE_THRESHOLD: 8,
    CRITICAL_RISK_SCORE_THRESHOLD: 9,

    // Session monitoring
    MAX_CONCURRENT_SESSIONS: 5,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours

    // IP monitoring
    MAX_USERS_PER_IP: 10,

    // Alert settings
    ALERT_COOLDOWN: 60 * 60 * 1000, // 1 hour between similar alerts
};

class SecurityMonitoringService {
    private static instance: SecurityMonitoringService;
    private alertCooldowns = new Map<string, Date>();

    static getInstance(): SecurityMonitoringService {
        if (!SecurityMonitoringService.instance) {
            SecurityMonitoringService.instance = new SecurityMonitoringService();
        }
        return SecurityMonitoringService.instance;
    }

    /**
     * Monitor and analyze security events
     */
    async analyzeSecurityEvent(req: AuthRequest, eventType: string, eventData: any): Promise<void> {
        try {
            const threats: SecurityThreat[] = [];

            // Analyze different types of security events
            switch (eventType) {
                case 'login_failed':
                    threats.push(...await this.detectBruteForceAttack(req, eventData));
                    break;
                case 'permission_denied':
                    threats.push(...await this.detectPermissionEscalation(req, eventData));
                    break;
                case 'invitation_created':
                    threats.push(...await this.detectInvitationSpam(req, eventData));
                    break;
                case 'data_access':
                    threats.push(...await this.detectDataExfiltration(req, eventData));
                    break;
                case 'session_created':
                    threats.push(...await this.detectSessionAnomalies(req, eventData));
                    break;
                default:
                    // General suspicious activity detection
                    threats.push(...await this.detectSuspiciousActivity(req, eventData));
            }

            // Process detected threats
            for (const threat of threats) {
                await this.processThreat(threat);
            }

        } catch (error: any) {
            logger.error('Error analyzing security event', {
                error: error?.message || 'Unknown error',
                eventType,
                userId: req.user?._id,
                service: 'security-monitoring',
            });
        }
    }

    /**
     * Detect brute force attacks
     */
    private async detectBruteForceAttack(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

        // Get recent failed login attempts from this IP
        const recentFailures = getAuditLogs({
            startDate: new Date(Date.now() - SECURITY_CONFIG.FAILED_LOGIN_WINDOW),
            category: 'authentication',
        }).filter(log =>
            log.ipAddress === ipAddress &&
            log.action === 'USER_LOGIN_FAILED'
        );

        if (recentFailures.length >= SECURITY_CONFIG.MAX_FAILED_LOGINS) {
            threats.push({
                id: `brute_force_${ipAddress}_${Date.now()}`,
                type: 'brute_force',
                severity: 'high',
                ipAddress,
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Brute force attack detected: ${recentFailures.length} failed login attempts in ${SECURITY_CONFIG.FAILED_LOGIN_WINDOW / 60000} minutes`,
                evidence: {
                    failedAttempts: recentFailures.length,
                    timeWindow: SECURITY_CONFIG.FAILED_LOGIN_WINDOW,
                    targetEmails: [...new Set(recentFailures.map(f => f.details?.email).filter(Boolean))],
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['block_ip', 'alert_admins'],
            });
        }

        return threats;
    }

    /**
     * Detect permission escalation attempts
     */
    private async detectPermissionEscalation(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        // Get recent permission denied events for this user
        const recentDenials = getAuditLogs({
            userId: req.user._id.toString(),
            startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
            category: 'authorization',
        }).filter(log => log.action === 'PERMISSION_DENIED');

        // Check for rapid permission escalation attempts
        if (recentDenials.length > 10) {
            threats.push({
                id: `permission_escalation_${req.user._id}_${Date.now()}`,
                type: 'permission_escalation',
                severity: 'medium',
                userId: req.user._id,
                workspaceId: req.workspace?._id,
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Potential permission escalation: ${recentDenials.length} permission denied events in the last hour`,
                evidence: {
                    denialCount: recentDenials.length,
                    attemptedPermissions: [...new Set(recentDenials.map(d => d.details?.requiredPermission).filter(Boolean))],
                    userRole: req.user.role,
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['monitor_user', 'alert_workspace_owner'],
            });
        }

        return threats;
    }

    /**
     * Detect invitation spam
     */
    private async detectInvitationSpam(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        // Get recent invitation creation events
        const recentInvitations = getAuditLogs({
            userId: req.user._id.toString(),
            startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
            category: 'invitation',
        }).filter(log => log.action === 'INVITATION_CREATED');

        if (recentInvitations.length > SECURITY_CONFIG.MAX_INVITATIONS_PER_HOUR) {
            threats.push({
                id: `invitation_spam_${req.user._id}_${Date.now()}`,
                type: 'invitation_spam',
                severity: 'medium',
                userId: req.user._id,
                workspaceId: req.workspace?._id,
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Invitation spam detected: ${recentInvitations.length} invitations created in the last hour`,
                evidence: {
                    invitationCount: recentInvitations.length,
                    invitedEmails: recentInvitations.map(i => i.details?.inviteeEmail).filter(Boolean),
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['rate_limit_user', 'alert_admins'],
            });
        }

        return threats;
    }

    /**
     * Detect data exfiltration attempts
     */
    private async detectDataExfiltration(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        // Get recent data access events
        const recentAccess = getAuditLogs({
            userId: req.user._id.toString(),
            startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
            category: 'data_access',
        });

        // Check for unusual data access patterns
        const exportEvents = recentAccess.filter(log => log.action.includes('EXPORT'));
        const bulkAccess = recentAccess.filter(log => log.action.includes('BULK'));

        if (exportEvents.length > 5 || bulkAccess.length > 10) {
            threats.push({
                id: `data_exfiltration_${req.user._id}_${Date.now()}`,
                type: 'data_exfiltration',
                severity: 'high',
                userId: req.user._id,
                workspaceId: req.workspace?._id,
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Potential data exfiltration: Unusual data access patterns detected`,
                evidence: {
                    exportEvents: exportEvents.length,
                    bulkAccess: bulkAccess.length,
                    totalAccess: recentAccess.length,
                    accessedResources: [...new Set(recentAccess.map(a => a.resourceType).filter(Boolean))],
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['monitor_user', 'alert_admins', 'require_mfa'],
            });
        }

        return threats;
    }

    /**
     * Detect session anomalies
     */
    private async detectSessionAnomalies(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        // Check for too many concurrent sessions
        const activeSessions = await Session.countDocuments({
            userId: req.user._id,
            isActive: true,
        });

        if (activeSessions > SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS) {
            threats.push({
                id: `session_anomaly_${req.user._id}_${Date.now()}`,
                type: 'session_hijacking',
                severity: 'medium',
                userId: req.user._id,
                workspaceId: req.workspace?._id,
                ipAddress: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Suspicious session activity: ${activeSessions} concurrent sessions detected`,
                evidence: {
                    activeSessionCount: activeSessions,
                    maxAllowed: SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS,
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['terminate_old_sessions', 'alert_user'],
            });
        }

        return threats;
    }

    /**
     * General suspicious activity detection
     */
    private async detectSuspiciousActivity(req: AuthRequest, eventData: any): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];
        const ipAddress = req.ip || 'unknown';

        // Check for too many users from same IP
        const usersFromIP = getAuditLogs({
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        }).filter(log => log.ipAddress === ipAddress);

        const uniqueUsers = new Set(usersFromIP.map(log => log.userId?.toString()).filter(Boolean));

        if (uniqueUsers.size > SECURITY_CONFIG.MAX_USERS_PER_IP) {
            threats.push({
                id: `suspicious_ip_${ipAddress}_${Date.now()}`,
                type: 'suspicious_activity',
                severity: 'medium',
                ipAddress,
                userAgent: req.get('User-Agent') || 'unknown',
                description: `Suspicious IP activity: ${uniqueUsers.size} different users from same IP in 24 hours`,
                evidence: {
                    uniqueUserCount: uniqueUsers.size,
                    maxAllowed: SECURITY_CONFIG.MAX_USERS_PER_IP,
                    userIds: Array.from(uniqueUsers),
                },
                timestamp: new Date(),
                resolved: false,
                actions: ['monitor_ip', 'alert_admins'],
            });
        }

        return threats;
    }

    /**
     * Process detected threats
     */
    private async processThreat(threat: SecurityThreat): Promise<void> {
        try {
            // Store threat
            securityThreats.push(threat);

            // Log threat
            logger.warn('Security threat detected', {
                threatId: threat.id,
                type: threat.type,
                severity: threat.severity,
                userId: threat.userId,
                workspaceId: threat.workspaceId,
                ipAddress: threat.ipAddress,
                description: threat.description,
                service: 'security-monitoring',
            });

            // Create audit log
            await createAuditLog({
                action: `SECURITY_THREAT_${threat.type.toUpperCase()}`,
                category: 'security',
                severity: threat.severity === 'critical' ? 'critical' : 'high',
                userId: threat.userId,
                workspaceId: threat.workspaceId,
                ipAddress: threat.ipAddress,
                userAgent: threat.userAgent,
                requestMethod: 'SYSTEM',
                requestUrl: '/security/threat-detection',
                details: {
                    threatId: threat.id,
                    threatType: threat.type,
                    evidence: threat.evidence,
                    actions: threat.actions,
                },
                suspicious: true,
                riskScore: threat.severity === 'critical' ? 10 : threat.severity === 'high' ? 8 : 6,
            });

            // Execute threat response actions
            await this.executeThreatResponse(threat);

            // Send alerts
            await this.sendSecurityAlerts(threat);

        } catch (error: any) {
            logger.error('Error processing security threat', {
                error: error?.message || 'Unknown error',
                threatId: threat.id,
                service: 'security-monitoring',
            });
        }
    }

    /**
     * Execute automated threat response actions
     */
    private async executeThreatResponse(threat: SecurityThreat): Promise<void> {
        for (const action of threat.actions) {
            try {
                switch (action) {
                    case 'block_ip':
                        blockedIPs.add(threat.ipAddress);
                        logger.info(`IP blocked: ${threat.ipAddress}`, { threatId: threat.id });
                        break;

                    case 'rate_limit_user':
                        if (threat.userId) {
                            // Implement user-specific rate limiting
                            suspiciousUsers.set(threat.userId.toString(), {
                                score: 10,
                                lastActivity: new Date(),
                            });
                        }
                        break;

                    case 'terminate_old_sessions':
                        if (threat.userId) {
                            await Session.updateMany(
                                {
                                    userId: threat.userId,
                                    isActive: true,
                                    createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                                },
                                { isActive: false }
                            );
                        }
                        break;

                    case 'monitor_user':
                        if (threat.userId) {
                            suspiciousUsers.set(threat.userId.toString(), {
                                score: 7,
                                lastActivity: new Date(),
                            });
                        }
                        break;

                    case 'monitor_ip':
                        // Add IP to monitoring list (implement as needed)
                        logger.info(`IP added to monitoring: ${threat.ipAddress}`, { threatId: threat.id });
                        break;

                    default:
                        logger.warn(`Unknown threat response action: ${action}`, { threatId: threat.id });
                }
            } catch (error: any) {
                logger.error(`Error executing threat response action: ${action}`, {
                    error: error?.message || 'Unknown error',
                    threatId: threat.id,
                });
            }
        }
    }

    /**
     * Send security alerts
     */
    private async sendSecurityAlerts(threat: SecurityThreat): Promise<void> {
        const alertKey = `${threat.type}_${threat.ipAddress}`;
        const lastAlert = this.alertCooldowns.get(alertKey);

        // Check cooldown period
        if (lastAlert && Date.now() - lastAlert.getTime() < SECURITY_CONFIG.ALERT_COOLDOWN) {
            return;
        }

        this.alertCooldowns.set(alertKey, new Date());

        const alerts: SecurityAlert[] = [];

        // Create different types of alerts based on severity
        if (threat.severity === 'critical' || threat.severity === 'high') {
            // Email alert to admins
            alerts.push({
                id: `alert_${threat.id}_email`,
                threatId: threat.id,
                type: 'email',
                recipient: 'security@PharmacyCopilot.com', // Configure as needed
                message: `SECURITY ALERT: ${threat.description}`,
                sent: false,
            });

            // Webhook alert (for integration with external systems)
            alerts.push({
                id: `alert_${threat.id}_webhook`,
                threatId: threat.id,
                type: 'webhook',
                message: JSON.stringify({
                    threat,
                    timestamp: new Date().toISOString(),
                    source: 'PharmacyCopilot-security-monitoring',
                }),
                sent: false,
            });
        }

        // Workspace owner alert for workspace-specific threats
        if (threat.workspaceId) {
            try {
                const workspace = await Workplace.findById(threat.workspaceId).populate('ownerId');
                if (workspace && workspace.ownerId) {
                    alerts.push({
                        id: `alert_${threat.id}_workspace_owner`,
                        threatId: threat.id,
                        type: 'email',
                        recipient: (workspace.ownerId as any).email,
                        message: `Security alert for your workspace: ${threat.description}`,
                        sent: false,
                    });
                }
            } catch (error: any) {
                logger.error('Error getting workspace owner for alert', {
                    error: error?.message || 'Unknown error',
                    workspaceId: threat.workspaceId,
                });
            }
        }

        // Store alerts and attempt to send them
        securityAlerts.push(...alerts);

        for (const alert of alerts) {
            await this.sendAlert(alert);
        }
    }

    /**
     * Send individual alert
     */
    private async sendAlert(alert: SecurityAlert): Promise<void> {
        try {
            switch (alert.type) {
                case 'email':
                    // Implement email sending (integrate with your email service)
                    logger.info(`Security alert email would be sent to: ${alert.recipient}`, {
                        alertId: alert.id,
                        message: alert.message,
                    });
                    alert.sent = true;
                    alert.sentAt = new Date();
                    break;

                case 'webhook':
                    // Implement webhook sending
                    logger.info('Security alert webhook would be sent', {
                        alertId: alert.id,
                        message: alert.message,
                    });
                    alert.sent = true;
                    alert.sentAt = new Date();
                    break;

                case 'log':
                    logger.warn('Security Alert', {
                        alertId: alert.id,
                        message: alert.message,
                    });
                    alert.sent = true;
                    alert.sentAt = new Date();
                    break;

                default:
                    logger.warn(`Unknown alert type: ${alert.type}`, { alertId: alert.id });
            }
        } catch (error: any) {
            alert.error = error?.message || 'Unknown error';
            logger.error('Error sending security alert', {
                error: error?.message || 'Unknown error',
                alertId: alert.id,
                alertType: alert.type,
            });
        }
    }

    /**
     * Check if IP is blocked
     */
    isIPBlocked(ipAddress: string): boolean {
        return blockedIPs.has(ipAddress);
    }

    /**
     * Check if user is suspicious
     */
    getUserSuspiciousScore(userId: string): number {
        const suspiciousData = suspiciousUsers.get(userId);
        if (!suspiciousData) return 0;

        // Decay score over time
        const hoursSinceLastActivity = (Date.now() - suspiciousData.lastActivity.getTime()) / (60 * 60 * 1000);
        const decayedScore = Math.max(0, suspiciousData.score - hoursSinceLastActivity * 0.5);

        if (decayedScore <= 0) {
            suspiciousUsers.delete(userId);
            return 0;
        }

        return decayedScore;
    }

    /**
     * Get security threats
     */
    getSecurityThreats(filters: {
        type?: SecurityThreat['type'];
        severity?: SecurityThreat['severity'];
        resolved?: boolean;
        userId?: string;
        workspaceId?: string;
        limit?: number;
    } = {}): SecurityThreat[] {
        let threats = [...securityThreats];

        if (filters.type) {
            threats = threats.filter(t => t.type === filters.type);
        }

        if (filters.severity) {
            threats = threats.filter(t => t.severity === filters.severity);
        }

        if (filters.resolved !== undefined) {
            threats = threats.filter(t => t.resolved === filters.resolved);
        }

        if (filters.userId) {
            threats = threats.filter(t => t.userId?.toString() === filters.userId);
        }

        if (filters.workspaceId) {
            threats = threats.filter(t => t.workspaceId?.toString() === filters.workspaceId);
        }

        // Sort by timestamp (newest first)
        threats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (filters.limit) {
            threats = threats.slice(0, filters.limit);
        }

        return threats;
    }

    /**
     * Resolve a security threat
     */
    async resolveThreat(threatId: string, resolvedBy: string, notes?: string): Promise<boolean> {
        const threat = securityThreats.find(t => t.id === threatId);
        if (!threat) return false;

        threat.resolved = true;

        // Log resolution
        await createAuditLog({
            action: 'SECURITY_THREAT_RESOLVED',
            category: 'security',
            severity: 'low',
            requestMethod: 'SYSTEM',
            requestUrl: '/security/resolve-threat',
            ipAddress: 'system',
            userAgent: 'security-monitoring-service',
            details: {
                threatId,
                threatType: threat.type,
                resolvedBy,
                notes,
            },
        });

        logger.info('Security threat resolved', {
            threatId,
            resolvedBy,
            notes,
            service: 'security-monitoring',
        });

        return true;
    }

    /**
     * Validate user session against permission changes
     */
    async validateUserSession(userId: mongoose.Types.ObjectId, sessionId: string): Promise<boolean> {
        try {
            // Get user's current permissions
            const user = await User.findById(userId).populate('workplaceId');
            if (!user) return false;

            // Get session
            const session = await Session.findOne({
                userId,
                _id: sessionId,
                isActive: true,
            });
            if (!session) return false;

            // Check if user's permissions have changed since session creation
            // This is a simplified check - in production, you might store permission hashes in sessions
            const recentPermissionChanges = getAuditLogs({
                userId: userId.toString(),
                startDate: session.createdAt,
                category: 'authorization',
            }).filter(log =>
                log.action.includes('PERMISSION') ||
                log.action.includes('ROLE_CHANGE')
            );

            if (recentPermissionChanges.length > 0) {
                // Permissions have changed, invalidate session
                await Session.findByIdAndUpdate(sessionId, { isActive: false });

                await createAuditLog({
                    action: 'SESSION_INVALIDATED_PERMISSION_CHANGE',
                    category: 'security',
                    severity: 'medium',
                    userId,
                    requestMethod: 'SYSTEM',
                    requestUrl: '/security/validate-session',
                    ipAddress: 'system',
                    userAgent: 'security-monitoring-service',
                    details: {
                        sessionId,
                        permissionChanges: recentPermissionChanges.length,
                        reason: 'User permissions changed since session creation',
                    },
                });

                return false;
            }

            return true;
        } catch (error: any) {
            logger.error('Error validating user session', {
                error: error?.message || 'Unknown error',
                userId,
                sessionId,
                service: 'security-monitoring',
            });
            return false;
        }
    }

    /**
     * Clean up old data
     */
    cleanup(): void {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

        // Clean up old threats
        const initialThreatsLength = securityThreats.length;
        for (let i = securityThreats.length - 1; i >= 0; i--) {
            const threat = securityThreats[i];
            if (threat && threat.timestamp < cutoff) {
                securityThreats.splice(i, 1);
            }
        }

        // Clean up old alerts
        const initialAlertsLength = securityAlerts.length;
        for (let i = securityAlerts.length - 1; i >= 0; i--) {
            const alert = securityAlerts[i];
            if (alert && alert.sentAt && alert.sentAt < cutoff) {
                securityAlerts.splice(i, 1);
            }
        }

        // Clean up old suspicious users
        for (const [userId, data] of suspiciousUsers.entries()) {
            if (data.lastActivity < cutoff) {
                suspiciousUsers.delete(userId);
            }
        }

        logger.info('Security monitoring cleanup completed', {
            threatsRemoved: initialThreatsLength - securityThreats.length,
            alertsRemoved: initialAlertsLength - securityAlerts.length,
            service: 'security-monitoring',
        });
    }
}

// Export singleton instance
export const securityMonitoringService = SecurityMonitoringService.getInstance();

// Schedule cleanup every hour (only in production)
let securityCleanupInterval: NodeJS.Timeout | null = null;

if (process.env.NODE_ENV === 'production') {
    securityCleanupInterval = setInterval(() => {
        securityMonitoringService.cleanup();
    }, 60 * 60 * 1000);
}

// Cleanup function for graceful shutdown
export const cleanupSecurityMonitoring = () => {
    if (securityCleanupInterval) {
        clearInterval(securityCleanupInterval);
        securityCleanupInterval = null;
    }
};

export default securityMonitoringService;