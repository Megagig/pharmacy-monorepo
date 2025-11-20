import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { securityMonitoringService } from '../services/securityMonitoringService';
import logger from '../utils/logger';

/**
 * Security monitoring controller
 */
export class SecurityController {
    /**
     * Get security threats
     */
    async getSecurityThreats(req: AuthRequest, res: Response): Promise<void> {
        try {
            const {
                type,
                severity,
                resolved,
                userId,
                workspaceId,
                page = 1,
                limit = 50,
            } = req.query;

            // Validate permissions - only super admins or workspace owners can view threats
            if (req.user?.role !== 'super_admin' && workspaceId !== req.workspace?._id?.toString()) {
                res.status(403).json({
                    success: false,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to view security threats',
                });
                return;
            }

            const filters: any = {};

            if (type) filters.type = type as string;
            if (severity) filters.severity = severity as string;
            if (resolved !== undefined) filters.resolved = resolved === 'true';
            if (userId) filters.userId = userId as string;
            if (workspaceId) filters.workspaceId = workspaceId as string;

            // Calculate pagination
            const pageNum = parseInt(page as string, 10);
            const limitNum = Math.min(parseInt(limit as string, 10), 1000);

            // Get threats
            const allThreats = securityMonitoringService.getSecurityThreats(filters);
            const total = allThreats.length;
            const skip = (pageNum - 1) * limitNum;
            const threats = allThreats.slice(skip, skip + limitNum);

            res.json({
                success: true,
                data: {
                    threats,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum),
                    },
                },
            });

        } catch (error: any) {
            logger.error('Error fetching security threats', {
                error: error?.message || 'Unknown error',
                userId: req.user?._id,
                service: 'security-controller',
            });

            res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch security threats',
            });
        }
    }

    /**
     * Get security dashboard data
     */
    async getSecurityDashboard(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { workspaceId, days = 7 } = req.query;

            // Validate permissions
            if (req.user?.role !== 'super_admin' && workspaceId !== req.workspace?._id?.toString()) {
                res.status(403).json({
                    success: false,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to view security dashboard',
                });
                return;
            }

            const daysNum = parseInt(days as string, 10);
            const filters: any = {};

            if (workspaceId) {
                filters.workspaceId = workspaceId as string;
            }

            // Get all threats for analysis
            const allThreats = securityMonitoringService.getSecurityThreats(filters);

            // Filter by date range
            const cutoff = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
            const recentThreats = allThreats.filter(threat => threat.timestamp >= cutoff);

            // Calculate statistics
            const dashboard = {
                summary: {
                    totalThreats: recentThreats.length,
                    resolvedThreats: recentThreats.filter(t => t.resolved).length,
                    activeThreats: recentThreats.filter(t => !t.resolved).length,
                    criticalThreats: recentThreats.filter(t => t.severity === 'critical').length,
                    highThreats: recentThreats.filter(t => t.severity === 'high').length,
                    timeRange: {
                        days: daysNum,
                        startDate: cutoff,
                        endDate: new Date(),
                    },
                },
                threatsByType: {} as Record<string, number>,
                threatsBySeverity: {} as Record<string, number>,
                threatsOverTime: [] as any[],
                topThreatenedUsers: [] as any[],
                topThreatenedIPs: [] as any[],
                recentThreats: recentThreats.slice(0, 10), // Most recent 10
            };

            // Calculate threat distribution
            recentThreats.forEach(threat => {
                dashboard.threatsByType[threat.type] = (dashboard.threatsByType[threat.type] || 0) + 1;
                dashboard.threatsBySeverity[threat.severity] = (dashboard.threatsBySeverity[threat.severity] || 0) + 1;
            });

            // Calculate threats over time (daily buckets)
            const dailyThreats = new Map<string, number>();
            for (let i = 0; i < daysNum; i++) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const dateKey = date.toISOString().split('T')[0];
                if (dateKey) {
                    dailyThreats.set(dateKey, 0);
                }
            }

            recentThreats.forEach(threat => {
                const dateKey = threat.timestamp.toISOString().split('T')[0];
                if (dateKey && dailyThreats.has(dateKey)) {
                    dailyThreats.set(dateKey, dailyThreats.get(dateKey)! + 1);
                }
            });

            dashboard.threatsOverTime = Array.from(dailyThreats.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Top threatened users
            const userThreatCounts = new Map<string, number>();
            recentThreats.forEach(threat => {
                if (threat.userId) {
                    const userId = threat.userId.toString();
                    userThreatCounts.set(userId, (userThreatCounts.get(userId) || 0) + 1);
                }
            });

            dashboard.topThreatenedUsers = Array.from(userThreatCounts.entries())
                .map(([userId, count]) => ({ userId, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // Top threatened IPs
            const ipThreatCounts = new Map<string, number>();
            recentThreats.forEach(threat => {
                ipThreatCounts.set(threat.ipAddress, (ipThreatCounts.get(threat.ipAddress) || 0) + 1);
            });

            dashboard.topThreatenedIPs = Array.from(ipThreatCounts.entries())
                .map(([ip, count]) => ({ ip, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            res.json({
                success: true,
                data: dashboard,
            });

        } catch (error: any) {
            logger.error('Error generating security dashboard', {
                error: error?.message || 'Unknown error',
                userId: req.user?._id,
                service: 'security-controller',
            });

            res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Failed to generate security dashboard',
            });
        }
    }

    /**
     * Resolve a security threat
     */
    async resolveThreat(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { threatId } = req.params;
            const { notes } = req.body;

            // Validate permissions - only super admins can resolve threats
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Only super administrators can resolve security threats',
                });
                return;
            }

            const resolved = await securityMonitoringService.resolveThreat(
                threatId || '',
                req.user.email,
                notes
            );

            if (!resolved) {
                res.status(404).json({
                    success: false,
                    code: 'THREAT_NOT_FOUND',
                    message: 'Security threat not found',
                });
                return;
            }

            res.json({
                success: true,
                message: 'Security threat resolved successfully',
                data: {
                    threatId,
                    resolvedBy: req.user.email,
                    resolvedAt: new Date(),
                    notes,
                },
            });

        } catch (error: any) {
            logger.error('Error resolving security threat', {
                error: error?.message || 'Unknown error',
                userId: req.user?._id,
                threatId: req.params.threatId,
                service: 'security-controller',
            });

            res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Failed to resolve security threat',
            });
        }
    }

    /**
     * Get user security status
     */
    async getUserSecurityStatus(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            // Validate permissions - users can only view their own status, admins can view any
            if (req.user?.role !== 'super_admin' && req.user?._id.toString() !== userId) {
                res.status(403).json({
                    success: false,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You can only view your own security status',
                });
                return;
            }

            const suspiciousScore = securityMonitoringService.getUserSuspiciousScore(userId || '');
            const userThreats = securityMonitoringService.getSecurityThreats({
                userId: userId || '',
                limit: 10,
            });

            const status = {
                userId,
                suspiciousScore,
                riskLevel: suspiciousScore > 8 ? 'high' : suspiciousScore > 5 ? 'medium' : 'low',
                recentThreats: userThreats.length,
                activeThreats: userThreats.filter(t => !t.resolved).length,
                lastThreatAt: userThreats.length > 0 ? userThreats[0]?.timestamp : null,
                recommendations: this.generateSecurityRecommendations(suspiciousScore, userThreats),
            };

            res.json({
                success: true,
                data: status,
            });

        } catch (error: any) {
            logger.error('Error getting user security status', {
                error: error?.message || 'Unknown error',
                userId: req.user?._id,
                targetUserId: req.params.userId,
                service: 'security-controller',
            });

            res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Failed to get user security status',
            });
        }
    }

    /**
     * Get blocked IPs
     */
    async getBlockedIPs(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Validate permissions - only super admins can view blocked IPs
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({
                    success: false,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Only super administrators can view blocked IPs',
                });
                return;
            }

            // Get threats that resulted in IP blocks
            const blockingThreats = securityMonitoringService.getSecurityThreats({
                type: 'brute_force',
            }).filter(threat => threat.actions.includes('block_ip'));

            const blockedIPs = blockingThreats.map(threat => ({
                ip: threat.ipAddress,
                blockedAt: threat.timestamp,
                reason: threat.description,
                threatId: threat.id,
                resolved: threat.resolved,
            }));

            res.json({
                success: true,
                data: {
                    blockedIPs,
                    total: blockedIPs.length,
                },
            });

        } catch (error: any) {
            logger.error('Error getting blocked IPs', {
                error: error?.message || 'Unknown error',
                userId: req.user?._id,
                service: 'security-controller',
            });

            res.status(500).json({
                success: false,
                code: 'INTERNAL_ERROR',
                message: 'Failed to get blocked IPs',
            });
        }
    }

    /**
     * Generate security recommendations
     */
    private generateSecurityRecommendations(suspiciousScore: number, threats: any[]): string[] {
        const recommendations: string[] = [];

        if (suspiciousScore > 8) {
            recommendations.push('Your account has been flagged for high-risk activity. Please contact support immediately.');
        } else if (suspiciousScore > 5) {
            recommendations.push('Your account is under monitoring due to suspicious activity. Please review your recent actions.');
        }

        if (threats.some(t => t.type === 'brute_force')) {
            recommendations.push('Multiple failed login attempts detected. Consider enabling two-factor authentication.');
        }

        if (threats.some(t => t.type === 'permission_escalation')) {
            recommendations.push('Unauthorized access attempts detected. Review your account permissions.');
        }

        if (threats.some(t => t.type === 'data_exfiltration')) {
            recommendations.push('Unusual data access patterns detected. Review your data export activities.');
        }

        if (threats.some(t => t.type === 'session_hijacking')) {
            recommendations.push('Multiple concurrent sessions detected. Log out from unused devices.');
        }

        if (recommendations.length === 0) {
            recommendations.push('Your account security status is good. Continue following security best practices.');
        }

        return recommendations;
    }
}

export const securityController = new SecurityController();