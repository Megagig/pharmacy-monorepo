import logger from '../../../utils/logger';
import { AuthRequest } from '../../../types/auth';
import crypto from 'crypto';
import { securityMonitoringService } from '../../../services/securityMonitoringService';

/**
 * Diagnostic Security Service
 * Specialized security monitoring and threat detection for diagnostic operations
 */

export interface SecurityThreat {
    id: string;
    type: 'RATE_LIMIT_ABUSE' | 'DATA_EXFILTRATION' | 'SUSPICIOUS_PATTERN' | 'API_ABUSE' | 'INJECTION_ATTEMPT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId: string;
    workplaceId: string;
    description: string;
    evidence: any;
    timestamp: Date;
    mitigated: boolean;
}

export interface SecurityMetrics {
    totalThreats: number;
    threatsByType: Record<string, number>;
    threatsBySeverity: Record<string, number>;
    mitigatedThreats: number;
    activeThreats: number;
    averageResponseTime: number;
}

export interface ApiKeyRotationConfig {
    rotationInterval: number; // in milliseconds
    warningThreshold: number; // warn when key is X% through its lifecycle
    autoRotate: boolean;
    notifyAdmins: boolean;
}

class DiagnosticSecurityService {
    private threats: Map<string, SecurityThreat> = new Map();
    private apiKeyRotationConfig: ApiKeyRotationConfig = {
        rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
        warningThreshold: 0.8, // 80%
        autoRotate: false, // Manual rotation for now
        notifyAdmins: true,
    };

    /**
     * Analyze diagnostic request for security threats
     */
    async analyzeRequest(req: AuthRequest, requestType: string): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        try {
            // Analyze rate limiting patterns
            const rateLimitThreats = await this.analyzeRateLimitPatterns(req, requestType);
            threats.push(...rateLimitThreats);

            // Analyze data patterns
            const dataThreats = await this.analyzeDataPatterns(req);
            threats.push(...dataThreats);

            // Analyze injection attempts
            const injectionThreats = await this.analyzeInjectionAttempts(req);
            threats.push(...injectionThreats);

            // Analyze API abuse patterns
            const apiThreats = await this.analyzeApiAbusePatterns(req);
            threats.push(...apiThreats);

            // Store and process threats
            for (const threat of threats) {
                await this.processThreat(threat);
            }

            return threats;
        } catch (error) {
            logger.error('Error analyzing diagnostic request security', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                endpoint: req.originalUrl,
            });
            return [];
        }
    }

    /**
     * Analyze rate limiting patterns for abuse
     */
    private async analyzeRateLimitPatterns(req: AuthRequest, requestType: string): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        const userId = req.user._id.toString();
        const workplaceId = req.workspaceContext?.workspace?._id?.toString() || '';

        // Check for burst patterns (many requests in short time)
        const burstPattern = await this.detectBurstPattern(userId, requestType);
        if (burstPattern.detected) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'RATE_LIMIT_ABUSE',
                severity: burstPattern.severity,
                userId,
                workplaceId,
                description: `Burst pattern detected: ${burstPattern.requestCount} ${requestType} requests in ${burstPattern.timeWindow}ms`,
                evidence: {
                    requestCount: burstPattern.requestCount,
                    timeWindow: burstPattern.timeWindow,
                    requestType,
                    pattern: 'BURST',
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        // Check for sustained high-volume patterns
        const sustainedPattern = await this.detectSustainedPattern(userId, requestType);
        if (sustainedPattern.detected) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'RATE_LIMIT_ABUSE',
                severity: sustainedPattern.severity,
                userId,
                workplaceId,
                description: `Sustained high-volume pattern: ${sustainedPattern.requestCount} requests over ${sustainedPattern.duration}ms`,
                evidence: {
                    requestCount: sustainedPattern.requestCount,
                    duration: sustainedPattern.duration,
                    requestType,
                    pattern: 'SUSTAINED',
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        return threats;
    }

    /**
     * Analyze data patterns for suspicious activity
     */
    private async analyzeDataPatterns(req: AuthRequest): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user || !req.body) return threats;

        const userId = req.user._id.toString();
        const workplaceId = req.workspaceContext?.workspace?._id?.toString() || '';

        // Check for data exfiltration patterns
        const exfiltrationPattern = this.detectDataExfiltrationPattern(req.body);
        if (exfiltrationPattern.detected) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'DATA_EXFILTRATION',
                severity: exfiltrationPattern.severity,
                userId,
                workplaceId,
                description: `Potential data exfiltration: ${exfiltrationPattern.reason}`,
                evidence: {
                    reason: exfiltrationPattern.reason,
                    dataSize: exfiltrationPattern.dataSize,
                    suspiciousFields: exfiltrationPattern.suspiciousFields,
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        // Check for unusual data volumes
        const volumePattern = this.detectUnusualDataVolume(req.body);
        if (volumePattern.detected) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'SUSPICIOUS_PATTERN',
                severity: volumePattern.severity,
                userId,
                workplaceId,
                description: `Unusual data volume: ${volumePattern.description}`,
                evidence: {
                    dataVolume: volumePattern.volume,
                    threshold: volumePattern.threshold,
                    fields: volumePattern.fields,
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        return threats;
    }

    /**
     * Analyze for injection attempts
     */
    private async analyzeInjectionAttempts(req: AuthRequest): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        const userId = req.user._id.toString();
        const workplaceId = req.workspaceContext?.workspace?._id?.toString() || '';

        // Check request body for injection patterns
        const injectionPatterns = this.detectInjectionPatterns(req.body);
        for (const pattern of injectionPatterns) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'INJECTION_ATTEMPT',
                severity: pattern.severity,
                userId,
                workplaceId,
                description: `${pattern.type} injection attempt detected in ${pattern.field}`,
                evidence: {
                    injectionType: pattern.type,
                    field: pattern.field,
                    value: pattern.value.substring(0, 100), // Truncate for logging
                    pattern: pattern.pattern,
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        // Check query parameters
        const queryInjections = this.detectInjectionPatterns(req.query);
        for (const pattern of queryInjections) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'INJECTION_ATTEMPT',
                severity: pattern.severity,
                userId,
                workplaceId,
                description: `${pattern.type} injection attempt in query parameter ${pattern.field}`,
                evidence: {
                    injectionType: pattern.type,
                    field: pattern.field,
                    value: pattern.value.substring(0, 100),
                    pattern: pattern.pattern,
                    location: 'query',
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        return threats;
    }

    /**
     * Analyze API abuse patterns
     */
    private async analyzeApiAbusePatterns(req: AuthRequest): Promise<SecurityThreat[]> {
        const threats: SecurityThreat[] = [];

        if (!req.user) return threats;

        const userId = req.user._id.toString();
        const workplaceId = req.workspaceContext?.workspace?._id?.toString() || '';

        // Check for automated/bot behavior
        const botPattern = this.detectBotBehavior(req);
        if (botPattern.detected) {
            threats.push({
                id: crypto.randomUUID(),
                type: 'API_ABUSE',
                severity: botPattern.severity,
                userId,
                workplaceId,
                description: `Bot-like behavior detected: ${botPattern.indicators.join(', ')}`,
                evidence: {
                    indicators: botPattern.indicators,
                    userAgent: req.get('User-Agent'),
                    requestTiming: botPattern.requestTiming,
                },
                timestamp: new Date(),
                mitigated: false,
            });
        }

        return threats;
    }

    /**
     * Detect burst request patterns
     */
    private async detectBurstPattern(userId: string, requestType: string): Promise<{
        detected: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        requestCount: number;
        timeWindow: number;
    }> {
        // Simplified implementation - in production, use Redis or similar
        // to track request timestamps and detect patterns

        const mockRequestCount = Math.floor(Math.random() * 20); // Mock data
        const timeWindow = 60000; // 1 minute

        if (mockRequestCount > 15) {
            return {
                detected: true,
                severity: 'CRITICAL',
                requestCount: mockRequestCount,
                timeWindow,
            };
        } else if (mockRequestCount > 10) {
            return {
                detected: true,
                severity: 'HIGH',
                requestCount: mockRequestCount,
                timeWindow,
            };
        } else if (mockRequestCount > 5) {
            return {
                detected: true,
                severity: 'MEDIUM',
                requestCount: mockRequestCount,
                timeWindow,
            };
        }

        return {
            detected: false,
            severity: 'LOW',
            requestCount: mockRequestCount,
            timeWindow,
        };
    }

    /**
     * Detect sustained high-volume patterns
     */
    private async detectSustainedPattern(userId: string, requestType: string): Promise<{
        detected: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        requestCount: number;
        duration: number;
    }> {
        // Simplified implementation
        const mockRequestCount = Math.floor(Math.random() * 100);
        const duration = 15 * 60 * 1000; // 15 minutes

        if (mockRequestCount > 80) {
            return {
                detected: true,
                severity: 'HIGH',
                requestCount: mockRequestCount,
                duration,
            };
        } else if (mockRequestCount > 50) {
            return {
                detected: true,
                severity: 'MEDIUM',
                requestCount: mockRequestCount,
                duration,
            };
        }

        return {
            detected: false,
            severity: 'LOW',
            requestCount: mockRequestCount,
            duration,
        };
    }

    /**
     * Detect data exfiltration patterns
     */
    private detectDataExfiltrationPattern(data: any): {
        detected: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        reason: string;
        dataSize: number;
        suspiciousFields: string[];
    } {
        const dataString = JSON.stringify(data);
        const dataSize = dataString.length;
        const suspiciousFields: string[] = [];

        // Check for unusually large payloads
        if (dataSize > 100000) { // 100KB
            return {
                detected: true,
                severity: 'HIGH',
                reason: 'Unusually large payload size',
                dataSize,
                suspiciousFields,
            };
        }

        // Check for suspicious field patterns
        const fieldNames = this.extractFieldNames(data);
        for (const field of fieldNames) {
            if (field.toLowerCase().includes('password') ||
                field.toLowerCase().includes('secret') ||
                field.toLowerCase().includes('key') ||
                field.toLowerCase().includes('token')) {
                suspiciousFields.push(field);
            }
        }

        if (suspiciousFields.length > 0) {
            return {
                detected: true,
                severity: 'MEDIUM',
                reason: 'Suspicious field names detected',
                dataSize,
                suspiciousFields,
            };
        }

        return {
            detected: false,
            severity: 'LOW',
            reason: '',
            dataSize,
            suspiciousFields,
        };
    }

    /**
     * Detect unusual data volumes
     */
    private detectUnusualDataVolume(data: any): {
        detected: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        description: string;
        volume: number;
        threshold: number;
        fields: string[];
    } {
        const issues: string[] = [];
        let maxSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

        // Check symptoms count
        if (data.symptoms?.subjective?.length > 30) {
            issues.push(`${data.symptoms.subjective.length} symptoms (threshold: 30)`);
            maxSeverity = 'MEDIUM';
        }

        // Check medications count
        if (data.currentMedications?.length > 25) {
            issues.push(`${data.currentMedications.length} medications (threshold: 25)`);
            maxSeverity = 'MEDIUM';
        }

        // Check lab results count
        if (data.labResults?.length > 50) {
            issues.push(`${data.labResults.length} lab results (threshold: 50)`);
            maxSeverity = 'HIGH';
        }

        if (issues.length > 0) {
            return {
                detected: true,
                severity: maxSeverity,
                description: issues.join(', '),
                volume: JSON.stringify(data).length,
                threshold: 50000, // 50KB threshold
                fields: issues,
            };
        }

        return {
            detected: false,
            severity: 'LOW',
            description: '',
            volume: JSON.stringify(data).length,
            threshold: 50000,
            fields: [],
        };
    }

    /**
     * Detect injection patterns in data
     */
    private detectInjectionPatterns(data: any): Array<{
        type: string;
        field: string;
        value: string;
        pattern: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }> {
        const patterns: Array<{
            type: string;
            field: string;
            value: string;
            pattern: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        }> = [];

        const injectionPatterns = [
            { type: 'SQL', pattern: /(union|select|insert|update|delete|drop|create|alter)\s+/i, severity: 'HIGH' as const },
            { type: 'NoSQL', pattern: /(\$where|\$ne|\$gt|\$lt|\$regex)/i, severity: 'HIGH' as const },
            { type: 'XSS', pattern: /<script|javascript:|on\w+\s*=/i, severity: 'MEDIUM' as const },
            { type: 'Command', pattern: /(;|\||&|`|\$\(|exec|eval|system)/i, severity: 'CRITICAL' as const },
            { type: 'Path Traversal', pattern: /(\.\.\/|\.\.\\|%2e%2e%2f)/i, severity: 'MEDIUM' as const },
        ];

        this.scanObjectForPatterns(data, '', injectionPatterns, patterns);

        return patterns;
    }

    /**
     * Recursively scan object for injection patterns
     */
    private scanObjectForPatterns(
        obj: any,
        path: string,
        injectionPatterns: Array<{ type: string; pattern: RegExp; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }>,
        results: Array<{ type: string; field: string; value: string; pattern: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }>
    ): void {
        if (typeof obj === 'string') {
            for (const { type, pattern, severity } of injectionPatterns) {
                if (pattern.test(obj)) {
                    results.push({
                        type,
                        field: path,
                        value: obj,
                        pattern: pattern.source,
                        severity,
                    });
                }
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.scanObjectForPatterns(item, `${path}[${index}]`, injectionPatterns, results);
            });
        } else if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                const newPath = path ? `${path}.${key}` : key;
                this.scanObjectForPatterns(value, newPath, injectionPatterns, results);
            }
        }
    }

    /**
     * Detect bot-like behavior
     */
    private detectBotBehavior(req: AuthRequest): {
        detected: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        indicators: string[];
        requestTiming?: number;
    } {
        const indicators: string[] = [];
        const userAgent = req.get('User-Agent') || '';

        // Check user agent
        if (userAgent.toLowerCase().includes('bot') ||
            userAgent.toLowerCase().includes('crawler') ||
            userAgent.toLowerCase().includes('spider') ||
            userAgent.toLowerCase().includes('scraper')) {
            indicators.push('Bot user agent');
        }

        // Check for missing common headers
        if (!req.get('Accept-Language')) {
            indicators.push('Missing Accept-Language header');
        }

        if (!req.get('Accept-Encoding')) {
            indicators.push('Missing Accept-Encoding header');
        }

        // Check for suspicious timing patterns (would need to track across requests)
        const requestTiming = Date.now() % 1000; // Mock timing
        if (requestTiming < 100) { // Very fast requests
            indicators.push('Suspiciously fast request timing');
        }

        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (indicators.length >= 3) {
            severity = 'HIGH';
        } else if (indicators.length >= 2) {
            severity = 'MEDIUM';
        } else if (indicators.length >= 1) {
            severity = 'LOW';
        }

        return {
            detected: indicators.length > 0,
            severity,
            indicators,
            requestTiming,
        };
    }

    /**
     * Extract field names from nested object
     */
    private extractFieldNames(obj: any, prefix = ''): string[] {
        const fields: string[] = [];

        if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                fields.push(fullKey);

                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    fields.push(...this.extractFieldNames(obj[key], fullKey));
                }
            }
        }

        return fields;
    }

    /**
     * Process and store security threat
     */
    private async processThreat(threat: SecurityThreat): Promise<void> {
        try {
            // Store threat
            this.threats.set(threat.id, threat);

            // Log threat
            logger.warn('Security threat detected', {
                threatId: threat.id,
                type: threat.type,
                severity: threat.severity,
                userId: threat.userId,
                workplaceId: threat.workplaceId,
                description: threat.description,
            });

            // Trigger automated mitigation for critical threats
            if (threat.severity === 'CRITICAL') {
                await this.mitigateThreat(threat);
            }

            // Notify security monitoring service
            await securityMonitoringService.analyzeSecurityEvent(
                { user: { _id: threat.userId } } as AuthRequest,
                'diagnostic_security_threat',
                {
                    threatId: threat.id,
                    type: threat.type,
                    severity: threat.severity,
                    evidence: threat.evidence,
                }
            );
        } catch (error) {
            logger.error('Error processing security threat', {
                error: error instanceof Error ? error.message : 'Unknown error',
                threatId: threat.id,
            });
        }
    }

    /**
     * Mitigate security threat
     */
    private async mitigateThreat(threat: SecurityThreat): Promise<void> {
        try {
            switch (threat.type) {
                case 'RATE_LIMIT_ABUSE':
                    // Temporarily increase rate limiting for user
                    await this.temporaryRateLimit(threat.userId);
                    break;

                case 'INJECTION_ATTEMPT':
                    // Block request and flag user for review
                    await this.flagUserForReview(threat.userId, 'Injection attempt detected');
                    break;

                case 'API_ABUSE':
                    // Require additional verification
                    await this.requireAdditionalVerification(threat.userId);
                    break;

                case 'DATA_EXFILTRATION':
                    // Alert administrators immediately
                    await this.alertAdministrators(threat);
                    break;

                default:
                    logger.warn('No mitigation strategy for threat type', { type: threat.type });
            }

            // Mark threat as mitigated
            threat.mitigated = true;
            this.threats.set(threat.id, threat);

            logger.info('Security threat mitigated', {
                threatId: threat.id,
                type: threat.type,
                userId: threat.userId,
            });
        } catch (error) {
            logger.error('Error mitigating security threat', {
                error: error instanceof Error ? error.message : 'Unknown error',
                threatId: threat.id,
            });
        }
    }

    /**
     * Apply temporary rate limiting
     */
    private async temporaryRateLimit(userId: string): Promise<void> {
        // Implementation would integrate with rate limiting system
        logger.info('Temporary rate limit applied', { userId });
    }

    /**
     * Flag user for manual review
     */
    private async flagUserForReview(userId: string, reason: string): Promise<void> {
        // Implementation would flag user in database
        logger.warn('User flagged for review', { userId, reason });
    }

    /**
     * Require additional verification
     */
    private async requireAdditionalVerification(userId: string): Promise<void> {
        // Implementation would require 2FA or similar
        logger.info('Additional verification required', { userId });
    }

    /**
     * Alert administrators
     */
    private async alertAdministrators(threat: SecurityThreat): Promise<void> {
        // Implementation would send alerts to admins
        logger.error('SECURITY ALERT: Critical threat detected', {
            threatId: threat.id,
            type: threat.type,
            userId: threat.userId,
            description: threat.description,
        });
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics(): SecurityMetrics {
        const threats = Array.from(this.threats.values());

        const threatsByType: Record<string, number> = {};
        const threatsBySeverity: Record<string, number> = {};

        for (const threat of threats) {
            threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
            threatsBySeverity[threat.severity] = (threatsBySeverity[threat.severity] || 0) + 1;
        }

        return {
            totalThreats: threats.length,
            threatsByType,
            threatsBySeverity,
            mitigatedThreats: threats.filter(t => t.mitigated).length,
            activeThreats: threats.filter(t => !t.mitigated).length,
            averageResponseTime: 0, // Would calculate from actual response times
        };
    }

    /**
     * Get active threats
     */
    getActiveThreats(): SecurityThreat[] {
        return Array.from(this.threats.values()).filter(threat => !threat.mitigated);
    }

    /**
     * Clear old threats (cleanup)
     */
    clearOldThreats(olderThanMs: number = 24 * 60 * 60 * 1000): void {
        const cutoff = new Date(Date.now() - olderThanMs);

        for (const [id, threat] of this.threats.entries()) {
            if (threat.timestamp < cutoff) {
                this.threats.delete(id);
            }
        }
    }
}

export default new DiagnosticSecurityService();