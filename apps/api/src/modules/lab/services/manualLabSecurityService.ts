import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import { AuditService } from '../../../services/auditService';
export interface AuditContext {
    userId: string;
    workspaceId: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Manual Lab Security Service
 * Handles security monitoring and threat detection for manual lab operations
 */

interface SecurityThreat {
    type: 'rate_limit_exceeded' | 'suspicious_pattern' | 'unauthorized_access' | 'data_exfiltration' | 'injection_attempt';
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: mongoose.Types.ObjectId;
    ipAddress?: string;
    userAgent?: string;
    details: any;
    timestamp: Date;
}

interface SecurityMetrics {
    userId: string;
    totalRequests: number;
    failedRequests: number;
    pdfAccesses: number;
    orderCreations: number;
    suspiciousActivities: number;
    lastActivity: Date;
    riskScore: number;
}

class ManualLabSecurityService {
    private static securityMetrics = new Map<string, SecurityMetrics>();
    private static threatLog: SecurityThreat[] = [];
    private static readonly MAX_THREAT_LOG_SIZE = 1000;

    /**
     * Analyze request for security threats
     */
    static async analyzeRequest(
        context: AuditContext,
        requestData: {
            method: string;
            url: string;
            body?: any;
            query?: any;
            headers?: any;
        }
    ): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        try {
            // Check for SQL injection attempts
            const injectionThreat = this.detectInjectionAttempts(requestData);
            if (injectionThreat) {
                threats.push(injectionThreat);
            }

            // Check for suspicious patterns
            const patternThreat = this.detectSuspiciousPatterns(context, requestData);
            if (patternThreat) {
                threats.push(patternThreat);
            }

            // Check for data exfiltration attempts
            const exfiltrationThreat = this.detectDataExfiltration(context, requestData);
            if (exfiltrationThreat) {
                threats.push(exfiltrationThreat);
            }

            // Update security metrics
            await this.updateSecurityMetrics(context, requestData, threats);

            // Log threats
            for (const threat of threats) {
                await this.logSecurityThreat(context, threat);
            }

            return threats;
        } catch (error) {
            logger.error('Security analysis failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: context.userId,
                service: 'manual-lab-security'
            });
            return [];
        }
    }

    /**
     * Detect SQL injection and NoSQL injection attempts
     */
    private static detectInjectionAttempts(requestData: any): SecurityThreat | null {
        const suspiciousPatterns = [
            /(\$where|\$ne|\$gt|\$lt|\$in|\$nin)/i, // NoSQL injection
            /(union|select|insert|update|delete|drop|create|alter)/i, // SQL injection
            /(<script|javascript:|vbscript:|onload|onerror)/i, // XSS
            /(eval\(|setTimeout\(|setInterval\()/i, // Code injection
            /(\.\.\/)|(\.\.\\)/g, // Path traversal
        ];

        const checkValue = (value: any): boolean => {
            if (typeof value === 'string') {
                return suspiciousPatterns.some(pattern => pattern.test(value));
            }
            if (typeof value === 'object' && value !== null) {
                return Object.values(value).some(v => checkValue(v));
            }
            return false;
        };

        const allData = {
            ...requestData.body,
            ...requestData.query,
            ...requestData.params
        };

        if (checkValue(allData)) {
            return {
                type: 'injection_attempt',
                severity: 'high',
                details: {
                    method: requestData.method,
                    url: requestData.url,
                    suspiciousData: allData,
                    detectedPatterns: suspiciousPatterns.filter(pattern =>
                        JSON.stringify(allData).match(pattern)
                    ).map(p => p.toString())
                },
                timestamp: new Date()
            };
        }

        return null;
    }

    /**
     * Detect suspicious access patterns
     */
    private static detectSuspiciousPatterns(
        context: AuditContext,
        requestData: any
    ): SecurityThreat | null {
        const userId = context.userId.toString();
        const metrics = this.getSecurityMetrics(userId);

        // Check for rapid requests
        const now = new Date();
        const timeDiff = now.getTime() - metrics.lastActivity.getTime();

        if (timeDiff < 100) { // Less than 100ms between requests
            return {
                type: 'suspicious_pattern',
                severity: 'medium',
                userId: new mongoose.Types.ObjectId(context.userId),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                details: {
                    pattern: 'rapid_requests',
                    timeDiff,
                    method: requestData.method,
                    url: requestData.url
                },
                timestamp: now
            };
        }

        // Check for unusual PDF access patterns
        if (requestData.url.includes('/pdf') && metrics.pdfAccesses > 20) {
            const recentPdfAccesses = this.threatLog.filter(threat =>
                threat.userId?.toString() === userId &&
                threat.details?.url?.includes('/pdf') &&
                now.getTime() - threat.timestamp.getTime() < 60 * 60 * 1000 // Last hour
            ).length;

            if (recentPdfAccesses > 10) {
                return {
                    type: 'data_exfiltration',
                    severity: 'high',
                    userId: new mongoose.Types.ObjectId(context.userId),
                    ipAddress: context.ipAddress,
                    details: {
                        pattern: 'excessive_pdf_access',
                        recentAccesses: recentPdfAccesses,
                        totalPdfAccesses: metrics.pdfAccesses
                    },
                    timestamp: now
                };
            }
        }

        return null;
    }

    /**
     * Detect potential data exfiltration
     */
    private static detectDataExfiltration(
        context: AuditContext,
        requestData: any
    ): SecurityThreat | null {
        const userId = context.userId.toString();
        const metrics = this.getSecurityMetrics(userId);

        // Check for bulk data access
        if (requestData.query?.limit && parseInt(requestData.query.limit) > 100) {
            return {
                type: 'data_exfiltration',
                severity: 'medium',
                userId: new mongoose.Types.ObjectId(context.userId),
                ipAddress: context.ipAddress,
                details: {
                    pattern: 'bulk_data_request',
                    requestedLimit: requestData.query.limit,
                    url: requestData.url
                },
                timestamp: new Date()
            };
        }

        // Check for automated access patterns
        const userAgent = context.userAgent || '';
        if (userAgent.toLowerCase().includes('bot') ||
            userAgent.toLowerCase().includes('crawler') ||
            userAgent.toLowerCase().includes('script') ||
            !userAgent) {
            return {
                type: 'unauthorized_access',
                severity: 'high',
                userId: new mongoose.Types.ObjectId(context.userId),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                details: {
                    pattern: 'automated_access',
                    userAgent,
                    url: requestData.url
                },
                timestamp: new Date()
            };
        }

        return null;
    }

    /**
     * Update security metrics for user
     */
    private static async updateSecurityMetrics(
        context: AuditContext,
        requestData: any,
        threats: SecurityThreat[]
    ): Promise<void> {
        const userId = context.userId.toString();
        const metrics = this.getSecurityMetrics(userId);

        // Update request counts
        metrics.totalRequests++;
        metrics.lastActivity = new Date();

        // Update specific counters
        if (requestData.url.includes('/pdf')) {
            metrics.pdfAccesses++;
        }
        if (requestData.method === 'POST' && requestData.url.endsWith('/manual-lab-orders')) {
            metrics.orderCreations++;
        }

        // Update threat metrics
        metrics.suspiciousActivities += threats.length;

        // Calculate risk score
        metrics.riskScore = this.calculateRiskScore(metrics, threats);

        // Store updated metrics
        this.securityMetrics.set(userId, metrics);

        // Log high-risk users
        if (metrics.riskScore > 7) {
            logger.warn('High-risk user detected', {
                userId,
                riskScore: metrics.riskScore,
                metrics,
                service: 'manual-lab-security'
            });
        }
    }

    /**
     * Log security threat
     */
    private static async logSecurityThreat(
        context: AuditContext,
        threat: SecurityThreat
    ): Promise<void> {
        try {
            // Add to threat log
            this.threatLog.push(threat);

            // Maintain log size
            if (this.threatLog.length > this.MAX_THREAT_LOG_SIZE) {
                this.threatLog.shift();
            }

            // Log to audit service
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_SECURITY_THREAT_DETECTED',
                resourceType: 'System',
                resourceId: context.userId,
                details: {
                    threatType: threat.type,
                    severity: threat.severity,
                    threatDetails: threat.details,
                    timestamp: threat.timestamp
                },
                complianceCategory: 'system_security',
                riskLevel: threat.severity === 'critical' ? 'critical' :
                    threat.severity === 'high' ? 'high' : 'medium'
            });

            // Log to application logger
            logger.warn('Security threat detected', {
                threatType: threat.type,
                severity: threat.severity,
                userId: threat.userId,
                ipAddress: threat.ipAddress,
                details: threat.details,
                service: 'manual-lab-security'
            });

            // Trigger alerts for high-severity threats
            if (threat.severity === 'critical' || threat.severity === 'high') {
                await this.triggerSecurityAlert(context, threat);
            }
        } catch (error) {
            logger.error('Failed to log security threat', {
                error: error instanceof Error ? error.message : 'Unknown error',
                threatType: threat.type,
                service: 'manual-lab-security'
            });
        }
    }

    /**
     * Get or create security metrics for user
     */
    private static getSecurityMetrics(userId: string): SecurityMetrics {
        let metrics = this.securityMetrics.get(userId);
        if (!metrics) {
            metrics = {
                userId,
                totalRequests: 0,
                failedRequests: 0,
                pdfAccesses: 0,
                orderCreations: 0,
                suspiciousActivities: 0,
                lastActivity: new Date(),
                riskScore: 0
            };
            this.securityMetrics.set(userId, metrics);
        }
        return metrics;
    }

    /**
     * Calculate risk score for user
     */
    private static calculateRiskScore(
        metrics: SecurityMetrics,
        currentThreats: SecurityThreat[]
    ): number {
        let score = 0;

        // Base score from metrics
        score += Math.min(metrics.suspiciousActivities * 0.5, 3);
        score += Math.min(metrics.failedRequests * 0.2, 2);

        // PDF access patterns
        if (metrics.pdfAccesses > 50) score += 2;
        else if (metrics.pdfAccesses > 20) score += 1;

        // Current threats
        for (const threat of currentThreats) {
            switch (threat.severity) {
                case 'critical': score += 4; break;
                case 'high': score += 3; break;
                case 'medium': score += 2; break;
                case 'low': score += 1; break;
            }
        }

        // Request frequency
        const now = new Date();
        const hoursSinceLastActivity = (now.getTime() - metrics.lastActivity.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastActivity < 0.1 && metrics.totalRequests > 100) {
            score += 2; // Very high frequency
        }

        return Math.min(score, 10); // Cap at 10
    }

    /**
     * Trigger security alert for high-severity threats
     */
    private static async triggerSecurityAlert(
        context: AuditContext,
        threat: SecurityThreat
    ): Promise<void> {
        try {
            // Log critical alert
            logger.error('SECURITY ALERT: High-severity threat detected', {
                threatType: threat.type,
                severity: threat.severity,
                userId: threat.userId,
                ipAddress: threat.ipAddress,
                details: threat.details,
                service: 'manual-lab-security'
            });

            // In production, you would:
            // 1. Send email/SMS alerts to security team
            // 2. Create incident tickets
            // 3. Temporarily block user/IP if necessary
            // 4. Trigger automated security responses

            // For now, just log the alert
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_SECURITY_ALERT_TRIGGERED',
                resourceType: 'System',
                resourceId: context.userId,
                details: {
                    alertType: 'high_severity_threat',
                    threatType: threat.type,
                    severity: threat.severity,
                    threatDetails: threat.details,
                    timestamp: new Date()
                },
                complianceCategory: 'system_security',
                riskLevel: 'critical'
            });
        } catch (error) {
            logger.error('Failed to trigger security alert', {
                error: error instanceof Error ? error.message : 'Unknown error',
                threatType: threat.type,
                service: 'manual-lab-security'
            });
        }
    }

    /**
     * Get security summary for user
     */
    static getSecuritySummary(userId: string): SecurityMetrics | null {
        return this.securityMetrics.get(userId) || null;
    }

    /**
     * Get recent threats
     */
    static getRecentThreats(limit: number = 50): SecurityThreat[] {
        return this.threatLog
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Clear security metrics for user (admin function)
     */
    static clearUserMetrics(userId: string): boolean {
        return this.securityMetrics.delete(userId);
    }

    /**
     * Get security statistics
     */
    static getSecurityStatistics(): {
        totalUsers: number;
        highRiskUsers: number;
        totalThreats: number;
        threatsByType: { [key: string]: number };
        threatsBySeverity: { [key: string]: number };
    } {
        const stats = {
            totalUsers: this.securityMetrics.size,
            highRiskUsers: 0,
            totalThreats: this.threatLog.length,
            threatsByType: {} as { [key: string]: number },
            threatsBySeverity: {} as { [key: string]: number }
        };

        // Count high-risk users
        for (const metrics of this.securityMetrics.values()) {
            if (metrics.riskScore > 6) {
                stats.highRiskUsers++;
            }
        }

        // Count threats by type and severity
        for (const threat of this.threatLog) {
            stats.threatsByType[threat.type] = (stats.threatsByType[threat.type] || 0) + 1;
            stats.threatsBySeverity[threat.severity] = (stats.threatsBySeverity[threat.severity] || 0) + 1;
        }

        return stats;
    }
}

export default ManualLabSecurityService;