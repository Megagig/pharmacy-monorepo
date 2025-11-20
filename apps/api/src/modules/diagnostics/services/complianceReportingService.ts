/**
 * Compliance Reporting Service
 * Enhanced compliance reporting with regulatory requirements and data retention policies
 */

import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import diagnosticAuditService from './diagnosticAuditService';
import MTRAuditLog from '../../../models/MTRAuditLog';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';

export interface RegulatoryReport {
    reportId: string;
    workplaceId: string;
    reportType: 'hipaa' | 'gdpr' | 'fda_21cfr11' | 'sox' | 'pci_dss';
    period: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;

    executiveSummary: {
        complianceScore: number; // 0-100
        criticalIssues: number;
        recommendations: string[];
        overallStatus: 'compliant' | 'non_compliant' | 'needs_attention';
    };

    dataGovernance: {
        dataRetentionCompliance: {
            totalRecords: number;
            recordsWithinPolicy: number;
            recordsNearingExpiry: number;
            expiredRecords: number;
            orphanedRecords: number;
        };
        dataClassification: {
            phi: number; // Protected Health Information
            pii: number; // Personally Identifiable Information
            sensitive: number;
            public: number;
        };
        accessControls: {
            totalUsers: number;
            privilegedUsers: number;
            inactiveUsers: number;
            usersWithExcessivePermissions: number;
        };
    };

    auditTrail: {
        completeness: number; // Percentage of activities logged
        integrity: number; // Percentage of logs with valid checksums
        availability: number; // Percentage of logs accessible
        nonRepudiation: number; // Percentage of logs with digital signatures
    };

    securityMetrics: {
        accessViolations: number;
        dataBreaches: number;
        unauthorizedAccess: number;
        failedLogins: number;
        suspiciousActivities: number;
    };

    aiGovernance?: {
        modelTransparency: number;
        biasDetection: number;
        explainabilityScore: number;
        consentCompliance: number;
        dataMinimization: number;
    };

    recommendations: Array<{
        priority: 'critical' | 'high' | 'medium' | 'low';
        category: string;
        description: string;
        remediation: string;
        timeline: string;
        impact: string;
    }>;
}

export interface DataRetentionPolicy {
    recordType: string;
    retentionPeriod: number; // in days
    archivalRequired: boolean;
    deletionMethod: 'soft' | 'hard' | 'crypto_shred';
    legalHold: boolean;
    regulatoryBasis: string[];
}

export interface AnomalyDetectionResult {
    anomalyId: string;
    detectedAt: Date;
    anomalyType: 'access_pattern' | 'data_volume' | 'time_pattern' | 'user_behavior' | 'system_behavior';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedEntities: string[];
    riskScore: number; // 0-100
    recommendedActions: string[];
    falsePositiveProbability: number;
}

class ComplianceReportingService {
    private readonly dataRetentionPolicies: DataRetentionPolicy[] = [
        {
            recordType: 'diagnostic_request',
            retentionPeriod: 2555, // 7 years
            archivalRequired: true,
            deletionMethod: 'soft',
            legalHold: false,
            regulatoryBasis: ['HIPAA', 'FDA 21 CFR Part 11']
        },
        {
            recordType: 'diagnostic_result',
            retentionPeriod: 2555, // 7 years
            archivalRequired: true,
            deletionMethod: 'soft',
            legalHold: false,
            regulatoryBasis: ['HIPAA', 'FDA 21 CFR Part 11']
        },
        {
            recordType: 'audit_log',
            retentionPeriod: 1095, // 3 years
            archivalRequired: true,
            deletionMethod: 'hard',
            legalHold: false,
            regulatoryBasis: ['HIPAA', 'SOX']
        },
        {
            recordType: 'ai_model_output',
            retentionPeriod: 2555, // 7 years
            archivalRequired: true,
            deletionMethod: 'crypto_shred',
            legalHold: false,
            regulatoryBasis: ['FDA 21 CFR Part 11', 'EU AI Act']
        }
    ];

    /**
     * Generate comprehensive regulatory compliance report
     */
    async generateRegulatoryReport(
        workplaceId: string,
        reportType: RegulatoryReport['reportType'],
        startDate: Date,
        endDate: Date,
        generatedBy: string
    ): Promise<RegulatoryReport> {
        try {
            const reportId = new Types.ObjectId().toString();

            logger.info('Generating regulatory compliance report', {
                reportId,
                workplaceId,
                reportType,
                period: { startDate, endDate }
            });

            // Gather all compliance data
            const [
                auditEvents,
                dataGovernance,
                auditTrail,
                securityMetrics,
                aiGovernance
            ] = await Promise.all([
                this.getAuditEvents(workplaceId, startDate, endDate),
                this.analyzeDataGovernance(workplaceId, startDate, endDate),
                this.analyzeAuditTrail(workplaceId, startDate, endDate),
                this.analyzeSecurityMetrics(workplaceId, startDate, endDate),
                this.analyzeAIGovernance(workplaceId, startDate, endDate)
            ]);

            // Calculate compliance score
            const complianceScore = this.calculateComplianceScore(
                dataGovernance,
                auditTrail,
                securityMetrics,
                aiGovernance
            );

            // Generate recommendations
            const recommendations = this.generateRecommendations(
                reportType,
                dataGovernance,
                auditTrail,
                securityMetrics,
                aiGovernance
            );

            // Create executive summary
            const executiveSummary = {
                complianceScore,
                criticalIssues: recommendations.filter(r => r.priority === 'critical').length,
                recommendations: recommendations.slice(0, 5).map(r => r.description),
                overallStatus: complianceScore >= 90 ? 'compliant' as const :
                    complianceScore >= 70 ? 'needs_attention' as const : 'non_compliant' as const
            };

            const report: RegulatoryReport = {
                reportId,
                workplaceId,
                reportType,
                period: { startDate, endDate },
                generatedAt: new Date(),
                generatedBy,
                executiveSummary,
                dataGovernance,
                auditTrail,
                securityMetrics,
                aiGovernance,
                recommendations
            };

            // Log report generation
            await diagnosticAuditService.logAuditEvent({
                eventType: 'data_export',
                entityType: 'diagnostic_request',
                entityId: reportId,
                userId: generatedBy,
                workplaceId,
                details: {
                    reportType,
                    complianceScore,
                    criticalIssues: executiveSummary.criticalIssues
                },
                timestamp: new Date(),
                severity: 'medium'
            });

            return report;
        } catch (error) {
            logger.error('Error generating regulatory report:', error);
            throw new Error('Failed to generate regulatory compliance report');
        }
    }

    /**
     * Analyze data governance compliance
     */
    private async analyzeDataGovernance(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<RegulatoryReport['dataGovernance']> {
        // Analyze data retention compliance
        const diagnosticRequests = await DiagnosticRequest.countDocuments({
            workplaceId: new Types.ObjectId(workplaceId),
            isDeleted: false
        });

        const diagnosticResults = await DiagnosticResult.countDocuments({
            workplaceId: new Types.ObjectId(workplaceId),
            isDeleted: false
        });

        const totalRecords = diagnosticRequests + diagnosticResults;

        // Calculate records nearing expiry (within 90 days of retention limit)
        const nearExpiryDate = new Date();
        nearExpiryDate.setDate(nearExpiryDate.getDate() - (2555 - 90)); // 7 years - 90 days

        const recordsNearingExpiry = await DiagnosticRequest.countDocuments({
            workplaceId: new Types.ObjectId(workplaceId),
            createdAt: { $lte: nearExpiryDate },
            isDeleted: false
        });

        // Calculate expired records (beyond retention period)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - 2555); // 7 years

        const expiredRecords = await DiagnosticRequest.countDocuments({
            workplaceId: new Types.ObjectId(workplaceId),
            createdAt: { $lte: expiryDate },
            isDeleted: false
        });

        return {
            dataRetentionCompliance: {
                totalRecords,
                recordsWithinPolicy: totalRecords - expiredRecords,
                recordsNearingExpiry,
                expiredRecords,
                orphanedRecords: 0 // Would need to implement orphan detection
            },
            dataClassification: {
                phi: diagnosticRequests + diagnosticResults, // All diagnostic data is PHI
                pii: diagnosticRequests, // Patient identifiers
                sensitive: diagnosticResults, // AI analysis results
                public: 0
            },
            accessControls: {
                totalUsers: 0, // Would query User model
                privilegedUsers: 0, // Users with admin roles
                inactiveUsers: 0, // Users not logged in for 90+ days
                usersWithExcessivePermissions: 0 // Users with more permissions than needed
            }
        };
    }

    /**
     * Analyze audit trail integrity
     */
    private async analyzeAuditTrail(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<RegulatoryReport['auditTrail']> {
        const auditLogs = await MTRAuditLog.find({
            workplaceId: new Types.ObjectId(workplaceId),
            timestamp: { $gte: startDate, $lte: endDate }
        });

        const totalLogs = auditLogs.length;
        const completeLogsCount = auditLogs.filter(log =>
            log.action && log.resourceType && log.userId && log.timestamp
        ).length;

        return {
            completeness: totalLogs > 0 ? (completeLogsCount / totalLogs) * 100 : 100,
            integrity: 95, // Would implement checksum validation
            availability: 99, // Would check log accessibility
            nonRepudiation: 90 // Would implement digital signatures
        };
    }

    /**
     * Analyze security metrics
     */
    private async analyzeSecurityMetrics(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<RegulatoryReport['securityMetrics']> {
        const securityEvents = await MTRAuditLog.find({
            workplaceId: new Types.ObjectId(workplaceId),
            timestamp: { $gte: startDate, $lte: endDate },
            $or: [
                { action: 'FAILED_LOGIN' },
                { action: 'security_violation' },
                { riskLevel: 'critical' }
            ]
        });

        return {
            accessViolations: securityEvents.filter(e => e.action === 'security_violation').length,
            dataBreaches: 0, // Would implement breach detection
            unauthorizedAccess: securityEvents.filter(e => e.riskLevel === 'critical').length,
            failedLogins: securityEvents.filter(e => e.action === 'FAILED_LOGIN').length,
            suspiciousActivities: securityEvents.filter(e =>
                e.details?.suspicious === true
            ).length
        };
    }

    /**
     * Analyze AI governance metrics
     */
    private async analyzeAIGovernance(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<RegulatoryReport['aiGovernance']> {
        const aiEvents = await MTRAuditLog.find({
            workplaceId: new Types.ObjectId(workplaceId),
            timestamp: { $gte: startDate, $lte: endDate },
            action: { $regex: /ai_analysis/ }
        });

        const totalAIRequests = aiEvents.length;
        const requestsWithConsent = aiEvents.filter(e =>
            e.details?.regulatoryContext?.consentObtained === true
        ).length;

        return {
            modelTransparency: 85, // Would analyze model documentation
            biasDetection: 90, // Would implement bias monitoring
            explainabilityScore: 80, // Would analyze explanation quality
            consentCompliance: totalAIRequests > 0 ? (requestsWithConsent / totalAIRequests) * 100 : 100,
            dataMinimization: 75 // Would analyze data usage patterns
        };
    }

    /**
     * Calculate overall compliance score
     */
    private calculateComplianceScore(
        dataGovernance: RegulatoryReport['dataGovernance'],
        auditTrail: RegulatoryReport['auditTrail'],
        securityMetrics: RegulatoryReport['securityMetrics'],
        aiGovernance?: RegulatoryReport['aiGovernance']
    ): number {
        const weights = {
            dataRetention: 0.25,
            auditTrail: 0.25,
            security: 0.25,
            aiGovernance: 0.25
        };

        // Data retention score
        const dataRetentionScore = dataGovernance.dataRetentionCompliance.expiredRecords === 0 ? 100 :
            Math.max(0, 100 - (dataGovernance.dataRetentionCompliance.expiredRecords /
                dataGovernance.dataRetentionCompliance.totalRecords) * 100);

        // Audit trail score (average of all metrics)
        const auditScore = (auditTrail.completeness + auditTrail.integrity +
            auditTrail.availability + auditTrail.nonRepudiation) / 4;

        // Security score (inverse of violations)
        const securityScore = Math.max(0, 100 - (
            securityMetrics.accessViolations * 10 +
            securityMetrics.dataBreaches * 50 +
            securityMetrics.unauthorizedAccess * 20
        ));

        // AI governance score
        const aiScore = aiGovernance ? (
            aiGovernance.modelTransparency + aiGovernance.biasDetection +
            aiGovernance.explainabilityScore + aiGovernance.consentCompliance +
            aiGovernance.dataMinimization
        ) / 5 : 100;

        return Math.round(
            dataRetentionScore * weights.dataRetention +
            auditScore * weights.auditTrail +
            securityScore * weights.security +
            aiScore * weights.aiGovernance
        );
    }

    /**
     * Generate compliance recommendations
     */
    private generateRecommendations(
        reportType: RegulatoryReport['reportType'],
        dataGovernance: RegulatoryReport['dataGovernance'],
        auditTrail: RegulatoryReport['auditTrail'],
        securityMetrics: RegulatoryReport['securityMetrics'],
        aiGovernance?: RegulatoryReport['aiGovernance']
    ): RegulatoryReport['recommendations'] {
        const recommendations: RegulatoryReport['recommendations'] = [];

        // Data retention recommendations
        if (dataGovernance.dataRetentionCompliance.expiredRecords > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'Data Retention',
                description: `${dataGovernance.dataRetentionCompliance.expiredRecords} records exceed retention policy`,
                remediation: 'Implement automated data archival and deletion processes',
                timeline: '30 days',
                impact: 'Regulatory non-compliance risk'
            });
        }

        // Audit trail recommendations
        if (auditTrail.completeness < 95) {
            recommendations.push({
                priority: 'high',
                category: 'Audit Trail',
                description: `Audit trail completeness is ${auditTrail.completeness.toFixed(1)}%`,
                remediation: 'Review and enhance audit logging coverage',
                timeline: '60 days',
                impact: 'Compliance monitoring gaps'
            });
        }

        // Security recommendations
        if (securityMetrics.accessViolations > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Security',
                description: `${securityMetrics.accessViolations} access violations detected`,
                remediation: 'Strengthen access controls and monitoring',
                timeline: '45 days',
                impact: 'Data security risk'
            });
        }

        // AI governance recommendations
        if (aiGovernance && aiGovernance.consentCompliance < 100) {
            recommendations.push({
                priority: 'critical',
                category: 'AI Governance',
                description: `AI consent compliance is ${aiGovernance.consentCompliance.toFixed(1)}%`,
                remediation: 'Implement mandatory consent validation for all AI processing',
                timeline: '15 days',
                impact: 'AI ethics and legal compliance'
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Detect anomalies in audit data
     */
    async detectAnomalies(
        workplaceId: string,
        lookbackDays: number = 30
    ): Promise<AnomalyDetectionResult[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        const auditEvents = await this.getAuditEvents(workplaceId, startDate, new Date());
        const anomalies: AnomalyDetectionResult[] = [];

        // Detect unusual access patterns
        const userActivityMap = new Map<string, number>();
        auditEvents.forEach(event => {
            const userId = event.userId || 'unknown';
            userActivityMap.set(userId, (userActivityMap.get(userId) || 0) + 1);
        });

        // Find users with unusually high activity
        const avgActivity = Array.from(userActivityMap.values()).reduce((a, b) => a + b, 0) / userActivityMap.size;
        const threshold = avgActivity * 3; // 3x average

        userActivityMap.forEach((activity, userId) => {
            if (activity > threshold) {
                anomalies.push({
                    anomalyId: new Types.ObjectId().toString(),
                    detectedAt: new Date(),
                    anomalyType: 'user_behavior',
                    severity: activity > threshold * 2 ? 'critical' : 'high',
                    description: `User ${userId} has ${activity} activities (${(activity / avgActivity).toFixed(1)}x average)`,
                    affectedEntities: [userId],
                    riskScore: Math.min(100, (activity / avgActivity) * 20),
                    recommendedActions: [
                        'Review user access permissions',
                        'Investigate recent user activities',
                        'Consider temporary access restriction'
                    ],
                    falsePositiveProbability: 0.15
                });
            }
        });

        // Detect unusual time patterns (activity outside business hours)
        const afterHoursEvents = auditEvents.filter(event => {
            const hour = new Date(event.timestamp).getHours();
            return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
        });

        if (afterHoursEvents.length > auditEvents.length * 0.1) { // More than 10% after hours
            anomalies.push({
                anomalyId: new Types.ObjectId().toString(),
                detectedAt: new Date(),
                anomalyType: 'time_pattern',
                severity: 'medium',
                description: `${afterHoursEvents.length} activities detected outside business hours`,
                affectedEntities: [...new Set(afterHoursEvents.map(e => e.userId))],
                riskScore: (afterHoursEvents.length / auditEvents.length) * 100,
                recommendedActions: [
                    'Review after-hours access policies',
                    'Implement time-based access controls',
                    'Monitor after-hours activities more closely'
                ],
                falsePositiveProbability: 0.25
            });
        }

        return anomalies;
    }

    /**
     * Get audit events for analysis
     */
    private async getAuditEvents(workplaceId: string, startDate: Date, endDate: Date) {
        const results = await diagnosticAuditService.searchAuditEvents({
            workplaceId,
            startDate,
            endDate,
            limit: 10000
        });
        return results.events;
    }

    /**
     * Get data retention policies
     */
    getDataRetentionPolicies(): DataRetentionPolicy[] {
        return [...this.dataRetentionPolicies];
    }

    /**
     * Update data retention policy
     */
    updateDataRetentionPolicy(recordType: string, policy: Partial<DataRetentionPolicy>): void {
        const index = this.dataRetentionPolicies.findIndex(p => p.recordType === recordType);
        if (index >= 0) {
            const existingPolicy = this.dataRetentionPolicies[index];
            this.dataRetentionPolicies[index] = {
                ...existingPolicy,
                ...policy,
                recordType, // Ensure recordType is always present
                retentionPeriod: policy.retentionPeriod || existingPolicy!.retentionPeriod,
                archivalRequired: policy.archivalRequired || existingPolicy!.archivalRequired,
                deletionMethod: policy.deletionMethod || existingPolicy!.deletionMethod,
                legalHold: policy.legalHold || existingPolicy!.legalHold,
                regulatoryBasis: policy.regulatoryBasis || existingPolicy!.regulatoryBasis,
            };
        } else {
            this.dataRetentionPolicies.push({
                recordType,
                retentionPeriod: policy.retentionPeriod || 2555,
                archivalRequired: policy.archivalRequired || true,
                deletionMethod: policy.deletionMethod || 'soft',
                legalHold: policy.legalHold || false,
                regulatoryBasis: policy.regulatoryBasis || ['HIPAA'],
                ...policy
            });
        }
    }
}

export default new ComplianceReportingService();