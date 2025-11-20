import { Request } from 'express';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import { securityPolicyEnforcer } from '../config/communicationSecurity';

/**
 * Communication Security Monitoring Service
 * Tracks security events, analyzes threats, and manages security responses
 */

interface SecurityEvent {
    id: string;
    userId?: string;
    sessionId?: string;
    eventType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
    ipAddress: string;
    userAgent: string;
    details: Record<string, any>;
    riskScore: number;
    actionTaken?: string;
}

interface ThreatIndicator {
    type: 'ip' | 'user' | 'pattern' | 'anomaly';
    value: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    firstSeen: number;
    lastSeen: number;
    occurrences: number;
    description: string;
}

interface SecurityMetrics {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topThreats: ThreatIndicator[];
    riskScore: number;
    lastUpdated: number;
}

class CommunicationSecurityMonitoringService {
    private securityEvents: Map<string, SecurityEvent> = new Map();
    private threatIndicators: Map<string, ThreatIndicator> = new Map();
    private userRiskScores: Map<string, number> = new Map();
    private ipRiskScores: Map<string, number> = new Map();
    private blockedIPs: Set<string> = new Set();
    private suspiciousUsers: Set<string> = new Set();

    // Configuration
    private readonly MAX_EVENTS = 10000;
    private readonly RISK_THRESHOLD_HIGH = 8;
    private readonly RISK_THRESHOLD_MEDIUM = 5;
    private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    private readonly EVENT_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        // Periodic cleanup of old events
        setInterval(() => {
            this.cleanupOldEvents();
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Record a security event
     */
    recordSecurityEvent(
        eventType: string,
        req: AuthRequest,
        details: Record<string, any> = {},
        severity: SecurityEvent['severity'] = 'medium'
    ): void {
        const eventId = this.generateEventId();
        const timestamp = Date.now();
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        const event: SecurityEvent = {
            id: eventId,
            userId: req.user?._id?.toString(),
            sessionId: (req as any).sessionID,
            eventType,
            severity,
            timestamp,
            ipAddress,
            userAgent,
            details,
            riskScore: this.calculateEventRiskScore(eventType, severity, details),
        };

        // Store event
        this.securityEvents.set(eventId, event);

        // Update threat indicators
        this.updateThreatIndicators(event);

        // Update risk scores
        this.updateRiskScores(event);

        // Check for immediate threats
        this.analyzeImmediateThreats(event);

        // Log the event
        logger.warn('Security event recorded', {
            eventId,
            eventType,
            severity,
            userId: event.userId,
            ipAddress,
            riskScore: event.riskScore,
            service: 'communication-security-monitoring',
        });

        // Cleanup if we have too many events
        if (this.securityEvents.size > this.MAX_EVENTS) {
            this.cleanupOldEvents();
        }
    }

    /**
     * Analyze security event for immediate threats
     */
    private analyzeImmediateThreats(event: SecurityEvent): void {
        const actions: string[] = [];

        // Check for high-risk events
        if (event.riskScore >= this.RISK_THRESHOLD_HIGH) {
            actions.push('high_risk_alert');

            if (event.userId) {
                this.suspiciousUsers.add(event.userId);
                actions.push('user_flagged');
            }

            if (event.ipAddress !== 'unknown') {
                this.ipRiskScores.set(event.ipAddress,
                    (this.ipRiskScores.get(event.ipAddress) || 0) + event.riskScore
                );

                // Block IP if risk score is too high
                if ((this.ipRiskScores.get(event.ipAddress) || 0) > 20) {
                    this.blockedIPs.add(event.ipAddress);
                    actions.push('ip_blocked');
                }
            }
        }

        // Check for specific threat patterns
        this.checkThreatPatterns(event, actions);

        // Update event with actions taken
        if (actions.length > 0) {
            event.actionTaken = actions.join(', ');
            this.securityEvents.set(event.id, event);

            logger.error('Immediate security threat detected', {
                eventId: event.id,
                eventType: event.eventType,
                riskScore: event.riskScore,
                actionsTaken: actions,
                service: 'communication-security-monitoring',
            });
        }
    }

    /**
     * Check for specific threat patterns
     */
    private checkThreatPatterns(event: SecurityEvent, actions: string[]): void {
        // SQL Injection patterns
        if (event.eventType === 'input_validation_failed' &&
            event.details.pattern?.includes('sql_injection')) {
            actions.push('sql_injection_detected');
        }

        // XSS patterns
        if (event.eventType === 'xss_attempt' ||
            (event.details.content && this.containsXSSPattern(event.details.content))) {
            actions.push('xss_attempt_detected');
        }

        // Brute force patterns
        if (event.eventType === 'authentication_failed' ||
            event.eventType === 'session_validation_failed') {
            const recentFailures = this.getRecentEventsByType(
                event.eventType,
                event.ipAddress,
                5 * 60 * 1000 // 5 minutes
            );

            if (recentFailures.length >= 5) {
                actions.push('brute_force_detected');
                if (event.ipAddress !== 'unknown') {
                    this.blockedIPs.add(event.ipAddress);
                    actions.push('ip_blocked');
                }
            }
        }

        // Rate limit abuse
        if (event.eventType === 'rate_limit_exceeded') {
            const recentRateLimits = this.getRecentEventsByType(
                event.eventType,
                event.ipAddress,
                15 * 60 * 1000 // 15 minutes
            );

            if (recentRateLimits.length >= 3) {
                actions.push('rate_limit_abuse_detected');
            }
        }

        // Suspicious file uploads
        if (event.eventType === 'file_upload_rejected' &&
            event.details.reason?.includes('executable')) {
            actions.push('malicious_file_upload_attempt');
        }

        // Session anomalies
        if (event.eventType === 'session_anomaly') {
            if (event.details.anomalyType === 'device_mismatch' ||
                event.details.anomalyType === 'location_change') {
                actions.push('session_hijack_suspected');
            }
        }
    }

    /**
     * Check if content contains XSS patterns
     */
    private containsXSSPattern(content: string): boolean {
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
        ];

        return xssPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Get recent events by type and IP
     */
    private getRecentEventsByType(
        eventType: string,
        ipAddress: string,
        timeWindow: number
    ): SecurityEvent[] {
        const cutoff = Date.now() - timeWindow;
        return Array.from(this.securityEvents.values()).filter(event =>
            event.eventType === eventType &&
            event.ipAddress === ipAddress &&
            event.timestamp > cutoff
        );
    }

    /**
     * Calculate risk score for an event
     */
    private calculateEventRiskScore(
        eventType: string,
        severity: SecurityEvent['severity'],
        details: Record<string, any>
    ): number {
        let baseScore = 0;

        // Base score by event type
        const eventTypeScores: Record<string, number> = {
            'authentication_failed': 2,
            'session_validation_failed': 3,
            'permission_denied': 1,
            'rate_limit_exceeded': 2,
            'input_validation_failed': 4,
            'xss_attempt': 6,
            'sql_injection_attempt': 8,
            'file_upload_rejected': 3,
            'session_anomaly': 5,
            'csrf_token_invalid': 4,
            'suspicious_activity': 3,
            'data_access_violation': 5,
            'privilege_escalation_attempt': 9,
            'malicious_file_upload': 7,
        };

        baseScore = eventTypeScores[eventType] || 1;

        // Severity multiplier
        const severityMultipliers = {
            low: 1,
            medium: 1.5,
            high: 2,
            critical: 3,
        };

        baseScore *= severityMultipliers[severity];

        // Additional factors
        if (details.repeated) baseScore *= 1.5;
        if (details.automated) baseScore *= 1.3;
        if (details.privilegedAction) baseScore *= 1.4;
        if (details.sensitiveData) baseScore *= 1.6;

        return Math.min(baseScore, 10); // Cap at 10
    }

    /**
     * Update threat indicators
     */
    private updateThreatIndicators(event: SecurityEvent): void {
        const indicators: Array<{ type: ThreatIndicator['type']; value: string }> = [
            { type: 'ip', value: event.ipAddress },
        ];

        if (event.userId) {
            indicators.push({ type: 'user', value: event.userId });
        }

        // Pattern-based indicators
        if (event.details.pattern) {
            indicators.push({ type: 'pattern', value: event.details.pattern });
        }

        for (const indicator of indicators) {
            const key = `${indicator.type}:${indicator.value}`;
            const existing = this.threatIndicators.get(key);

            if (existing) {
                existing.lastSeen = event.timestamp;
                existing.occurrences++;
                // Update severity if current event is more severe
                if (this.getSeverityLevel(event.severity) > this.getSeverityLevel(existing.severity)) {
                    existing.severity = event.severity;
                }
            } else {
                this.threatIndicators.set(key, {
                    type: indicator.type,
                    value: indicator.value,
                    severity: event.severity,
                    firstSeen: event.timestamp,
                    lastSeen: event.timestamp,
                    occurrences: 1,
                    description: `${event.eventType} from ${indicator.type}`,
                });
            }
        }
    }

    /**
     * Update risk scores for users and IPs
     */
    private updateRiskScores(event: SecurityEvent): void {
        if (event.userId) {
            const currentScore = this.userRiskScores.get(event.userId) || 0;
            this.userRiskScores.set(event.userId,
                Math.min(currentScore + event.riskScore * 0.1, 10)
            );
        }

        if (event.ipAddress !== 'unknown') {
            const currentScore = this.ipRiskScores.get(event.ipAddress) || 0;
            this.ipRiskScores.set(event.ipAddress,
                Math.min(currentScore + event.riskScore * 0.2, 10)
            );
        }
    }

    /**
     * Get severity level as number for comparison
     */
    private getSeverityLevel(severity: SecurityEvent['severity']): number {
        const levels = { low: 1, medium: 2, high: 3, critical: 4 };
        return levels[severity];
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old events
     */
    private cleanupOldEvents(): void {
        const cutoff = Date.now() - this.EVENT_RETENTION;
        let cleanedCount = 0;

        for (const [eventId, event] of this.securityEvents.entries()) {
            if (event.timestamp < cutoff) {
                this.securityEvents.delete(eventId);
                cleanedCount++;
            }
        }

        // Clean up old threat indicators
        for (const [key, indicator] of this.threatIndicators.entries()) {
            if (indicator.lastSeen < cutoff) {
                this.threatIndicators.delete(key);
            }
        }

        if (cleanedCount > 0) {
            logger.info('Cleaned up old security events', {
                cleanedCount,
                remainingEvents: this.securityEvents.size,
                service: 'communication-security-monitoring',
            });
        }
    }

    /**
     * Public API methods
     */

    /**
     * Check if IP is blocked
     */
    isIPBlocked(ipAddress: string): boolean {
        return this.blockedIPs.has(ipAddress);
    }

    /**
     * Check if user is suspicious
     */
    isUserSuspicious(userId: string): boolean {
        return this.suspiciousUsers.has(userId);
    }

    /**
     * Get user risk score
     */
    getUserRiskScore(userId: string): number {
        return this.userRiskScores.get(userId) || 0;
    }

    /**
     * Get IP risk score
     */
    getIPRiskScore(ipAddress: string): number {
        return this.ipRiskScores.get(ipAddress) || 0;
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics(): SecurityMetrics {
        const events = Array.from(this.securityEvents.values());
        const eventsByType: Record<string, number> = {};
        const eventsBySeverity: Record<string, number> = {};

        for (const event of events) {
            eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
            eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        }

        const topThreats = Array.from(this.threatIndicators.values())
            .sort((a, b) => b.occurrences - a.occurrences)
            .slice(0, 10);

        const totalRiskScore = events.reduce((sum, event) => sum + event.riskScore, 0);
        const avgRiskScore = events.length > 0 ? totalRiskScore / events.length : 0;

        return {
            totalEvents: events.length,
            eventsByType,
            eventsBySeverity,
            topThreats,
            riskScore: avgRiskScore,
            lastUpdated: Date.now(),
        };
    }

    /**
     * Get recent security events
     */
    getRecentEvents(limit = 100): SecurityEvent[] {
        return Array.from(this.securityEvents.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get events by user
     */
    getEventsByUser(userId: string, limit = 50): SecurityEvent[] {
        return Array.from(this.securityEvents.values())
            .filter(event => event.userId === userId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Unblock IP address
     */
    unblockIP(ipAddress: string): boolean {
        if (this.blockedIPs.has(ipAddress)) {
            this.blockedIPs.delete(ipAddress);
            this.ipRiskScores.delete(ipAddress);

            logger.info('IP address unblocked', {
                ipAddress,
                service: 'communication-security-monitoring',
            });

            return true;
        }
        return false;
    }

    /**
     * Clear user suspicion
     */
    clearUserSuspicion(userId: string): boolean {
        if (this.suspiciousUsers.has(userId)) {
            this.suspiciousUsers.delete(userId);
            this.userRiskScores.delete(userId);

            logger.info('User suspicion cleared', {
                userId,
                service: 'communication-security-monitoring',
            });

            return true;
        }
        return false;
    }

    /**
     * Reset all security data (for testing or emergency)
     */
    reset(): void {
        this.securityEvents.clear();
        this.threatIndicators.clear();
        this.userRiskScores.clear();
        this.ipRiskScores.clear();
        this.blockedIPs.clear();
        this.suspiciousUsers.clear();

        logger.warn('Security monitoring data reset', {
            service: 'communication-security-monitoring',
        });
    }
}

export const communicationSecurityMonitoringService = new CommunicationSecurityMonitoringService();

export default communicationSecurityMonitoringService;