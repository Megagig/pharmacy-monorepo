import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../../middlewares/auth';
import ManualLabSecurityService from '../services/manualLabSecurityService';
import {
    sendSuccess,
    sendError,
    asyncHandler,
    getRequestContext,
} from '../../../utils/responseHelpers';
import logger from '../../../utils/logger';

/**
 * Manual Lab Security Controller
 * Handles security monitoring and threat management endpoints
 */

/**
 * GET /api/manual-lab-orders/security/dashboard
 * Get security dashboard with metrics and threats
 */
export const getSecurityDashboard = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Get security statistics
            const securityStats = ManualLabSecurityService.getSecurityStatistics();

            // Get recent threats
            const recentThreats = ManualLabSecurityService.getRecentThreats(20);

            // Get user's security summary
            const userSecurity = ManualLabSecurityService.getSecuritySummary(
                context.userId.toString()
            );

            // Calculate threat trends (last 24 hours vs previous 24 hours)
            const now = new Date();
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const previous24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

            const recentThreatsCount = recentThreats.filter(
                t => t.timestamp >= last24h
            ).length;
            const previousThreatsCount = recentThreats.filter(
                t => t.timestamp >= previous24h && t.timestamp < last24h
            ).length;

            const threatTrend = recentThreatsCount - previousThreatsCount;

            const dashboard = {
                overview: {
                    totalUsers: securityStats.totalUsers,
                    highRiskUsers: securityStats.highRiskUsers,
                    totalThreats: securityStats.totalThreats,
                    recentThreats: recentThreatsCount,
                    threatTrend,
                    riskLevel: securityStats.highRiskUsers > 5 ? 'high' :
                        securityStats.highRiskUsers > 2 ? 'medium' : 'low'
                },
                threatAnalysis: {
                    byType: securityStats.threatsByType,
                    bySeverity: securityStats.threatsBySeverity,
                    recentThreats: recentThreats.slice(0, 10).map(threat => ({
                        id: `${threat.type}_${threat.timestamp.getTime()}`,
                        type: threat.type,
                        severity: threat.severity,
                        timestamp: threat.timestamp,
                        userId: threat.userId,
                        ipAddress: threat.ipAddress,
                        summary: getThreatSummary(threat)
                    }))
                },
                userSecurity: userSecurity ? {
                    riskScore: userSecurity.riskScore,
                    totalRequests: userSecurity.totalRequests,
                    suspiciousActivities: userSecurity.suspiciousActivities,
                    lastActivity: userSecurity.lastActivity,
                    status: userSecurity.riskScore > 7 ? 'high_risk' :
                        userSecurity.riskScore > 4 ? 'medium_risk' : 'low_risk'
                } : null,
                recommendations: generateSecurityRecommendations(securityStats, recentThreats)
            };

            sendSuccess(
                res,
                { dashboard },
                'Security dashboard retrieved successfully'
            );

            logger.info('Security dashboard accessed', {
                userId: context.userId,
                workplaceId: context.workplaceId,
                service: 'manual-lab-security'
            });
        } catch (error) {
            logger.error('Failed to retrieve security dashboard', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: context.userId,
                service: 'manual-lab-security'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve security dashboard', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/security/threats
 * Get detailed threat information with filtering
 */
export const getSecurityThreats = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            limit = 50,
            severity,
            type,
            userId: filterUserId
        } = req.query as any;

        try {
            // Get recent threats
            let threats = ManualLabSecurityService.getRecentThreats(parseInt(limit));

            // Apply filters
            if (severity) {
                threats = threats.filter(t => t.severity === severity);
            }
            if (type) {
                threats = threats.filter(t => t.type === type);
            }
            if (filterUserId) {
                threats = threats.filter(t => t.userId?.toString() === filterUserId);
            }

            // Format threats for response
            const formattedThreats = threats.map(threat => ({
                id: `${threat.type}_${threat.timestamp.getTime()}`,
                type: threat.type,
                severity: threat.severity,
                timestamp: threat.timestamp,
                userId: threat.userId,
                ipAddress: threat.ipAddress,
                userAgent: threat.userAgent,
                details: threat.details,
                summary: getThreatSummary(threat),
                riskScore: calculateThreatRiskScore(threat)
            }));

            // Group threats by type for analysis
            const threatAnalysis = {
                total: formattedThreats.length,
                byType: formattedThreats.reduce((acc: any, threat) => {
                    acc[threat.type] = (acc[threat.type] || 0) + 1;
                    return acc;
                }, {}),
                bySeverity: formattedThreats.reduce((acc: any, threat) => {
                    acc[threat.severity] = (acc[threat.severity] || 0) + 1;
                    return acc;
                }, {}),
                topUsers: getTopThreatUsers(formattedThreats)
            };

            sendSuccess(
                res,
                {
                    threats: formattedThreats,
                    analysis: threatAnalysis
                },
                'Security threats retrieved successfully'
            );

            logger.info('Security threats retrieved', {
                count: formattedThreats.length,
                filters: { severity, type, filterUserId },
                userId: context.userId,
                service: 'manual-lab-security'
            });
        } catch (error) {
            logger.error('Failed to retrieve security threats', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: context.userId,
                service: 'manual-lab-security'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve security threats', 500);
        }
    }
);

/**
 * POST /api/manual-lab-orders/security/clear-user-metrics/:userId
 * Clear security metrics for a specific user (admin only)
 */
export const clearUserSecurityMetrics = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const context = getRequestContext(req);

        // Only allow owners to clear metrics
        if (req.user?.workplaceRole !== 'Owner') {
            return sendError(res, 'FORBIDDEN', 'Only owners can clear user security metrics', 403);
        }

        try {
            const cleared = ManualLabSecurityService.clearUserMetrics(userId!);

            if (cleared) {
                sendSuccess(
                    res,
                    { userId, cleared: true },
                    'User security metrics cleared successfully'
                );

                logger.info('User security metrics cleared', {
                    targetUserId: userId,
                    clearedBy: context.userId,
                    service: 'manual-lab-security'
                });
            } else {
                sendSuccess(
                    res,
                    { userId, cleared: false },
                    'No security metrics found for user'
                );
            }
        } catch (error) {
            logger.error('Failed to clear user security metrics', {
                targetUserId: userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: context.userId,
                service: 'manual-lab-security'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to clear user security metrics', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/security/user-summary/:userId
 * Get security summary for a specific user
 */
export const getUserSecuritySummary = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const context = getRequestContext(req);

        try {
            const securitySummary = ManualLabSecurityService.getSecuritySummary(userId!);

            if (!securitySummary) {
                return sendSuccess(
                    res,
                    { userId, summary: null },
                    'No security data found for user'
                );
            }

            // Enhanced summary with risk assessment
            const enhancedSummary = {
                ...securitySummary,
                riskAssessment: {
                    level: securitySummary.riskScore > 7 ? 'high' :
                        securitySummary.riskScore > 4 ? 'medium' : 'low',
                    factors: getRiskFactors(securitySummary),
                    recommendations: getUserRecommendations(securitySummary)
                },
                activityPattern: {
                    requestsPerHour: calculateRequestsPerHour(securitySummary),
                    mostActiveHours: getMostActiveHours(securitySummary),
                    suspiciousPatterns: securitySummary.suspiciousActivities > 0
                }
            };

            sendSuccess(
                res,
                { userId, summary: enhancedSummary },
                'User security summary retrieved successfully'
            );

            logger.info('User security summary retrieved', {
                targetUserId: userId,
                riskScore: securitySummary.riskScore,
                requestedBy: context.userId,
                service: 'manual-lab-security'
            });
        } catch (error) {
            logger.error('Failed to retrieve user security summary', {
                targetUserId: userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: context.userId,
                service: 'manual-lab-security'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve user security summary', 500);
        }
    }
);

/**
 * Helper methods
 */
const getThreatSummary = (threat: any): string => {
    switch (threat.type) {
        case 'rate_limit_exceeded':
            return `Rate limit exceeded: ${threat.details?.pattern || 'unknown pattern'}`;
        case 'suspicious_pattern':
            return `Suspicious pattern detected: ${threat.details?.pattern || 'unknown'}`;
        case 'unauthorized_access':
            return `Unauthorized access attempt: ${threat.details?.pattern || 'unknown'}`;
        case 'data_exfiltration':
            return `Potential data exfiltration: ${threat.details?.pattern || 'unknown'}`;
        case 'injection_attempt':
            return `Injection attempt detected: ${threat.details?.detectedPatterns?.length || 0} patterns`;
        default:
            return `Security threat: ${threat.type}`;
    }
}

const calculateThreatRiskScore = (threat: any): number => {
    let score = 0;

    // Base score by severity
    switch (threat.severity) {
        case 'critical': score += 8; break;
        case 'high': score += 6; break;
        case 'medium': score += 4; break;
        case 'low': score += 2; break;
    }

    // Additional factors
    if (threat.type === 'injection_attempt') score += 2;
    if (threat.type === 'data_exfiltration') score += 3;
    if (threat.details?.pattern === 'automated_access') score += 2;

    return Math.min(score, 10);
}

const getTopThreatUsers = (threats: any[]): any[] => {
    const userCounts = threats.reduce((acc: any, threat) => {
        if (threat.userId) {
            const userId = threat.userId.toString();
            acc[userId] = (acc[userId] || 0) + 1;
        }
        return acc;
    }, {});

    return Object.entries(userCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([userId, count]) => ({ userId, threatCount: count }));
}

const generateSecurityRecommendations = (stats: any, threats: any[]): string[] => {
    const recommendations: string[] = [];

    if (stats.highRiskUsers > 5) {
        recommendations.push('High number of risky users detected. Consider implementing additional security training.');
    }

    if (stats.totalThreats > 100) {
        recommendations.push('High threat volume detected. Review security policies and monitoring thresholds.');
    }

    const injectionThreats = threats.filter(t => t.type === 'injection_attempt').length;
    if (injectionThreats > 10) {
        recommendations.push('Multiple injection attempts detected. Strengthen input validation and consider WAF implementation.');
    }

    const exfiltrationThreats = threats.filter(t => t.type === 'data_exfiltration').length;
    if (exfiltrationThreats > 5) {
        recommendations.push('Potential data exfiltration attempts detected. Review data access patterns and implement DLP controls.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Security metrics are within acceptable ranges. Continue monitoring.');
    }

    return recommendations;
}

const getRiskFactors = (summary: any): string[] => {
    const factors: string[] = [];

    if (summary.suspiciousActivities > 5) {
        factors.push('High number of suspicious activities');
    }
    if (summary.failedRequests > 10) {
        factors.push('Multiple failed requests');
    }
    if (summary.pdfAccesses > 50) {
        factors.push('Excessive PDF access');
    }
    if (summary.riskScore > 7) {
        factors.push('High calculated risk score');
    }

    return factors;
}

const getUserRecommendations = (summary: any): string[] => {
    const recommendations: string[] = [];

    if (summary.riskScore > 7) {
        recommendations.push('Consider temporary access restrictions');
        recommendations.push('Require additional authentication for sensitive operations');
    }
    if (summary.suspiciousActivities > 3) {
        recommendations.push('Monitor user activity closely');
        recommendations.push('Review recent access patterns');
    }
    if (summary.pdfAccesses > 30) {
        recommendations.push('Review PDF access patterns for legitimacy');
    }

    return recommendations;
}

const calculateRequestsPerHour = (summary: any): number => {
    // Simplified calculation - in production you'd track actual time windows
    const hoursActive = Math.max(1, (Date.now() - summary.lastActivity.getTime()) / (1000 * 60 * 60));
    return Math.round(summary.totalRequests / hoursActive);
}

const getMostActiveHours = (summary: any): number[] => {
    // Simplified - in production you'd track actual hourly patterns
    return [9, 10, 11, 14, 15, 16]; // Typical business hours
}

export default {
    getSecurityDashboard,
    getSecurityThreats,
    clearUserSecurityMetrics,
    getUserSecuritySummary
};