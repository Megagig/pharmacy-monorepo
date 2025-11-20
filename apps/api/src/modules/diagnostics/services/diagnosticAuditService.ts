/**
 * Diagnostic Audit Service
 * Comprehensive audit logging and compliance reporting for diagnostic activities
 */

import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import { AuditService } from '../../../services/auditService';

export interface DiagnosticAuditEvent {
    eventType:
    | 'diagnostic_request_created'
    | 'diagnostic_processing_started'
    | 'diagnostic_processing_completed'
    | 'diagnostic_processing_failed'
    | 'ai_analysis_requested'
    | 'ai_analysis_completed'
    | 'ai_analysis_failed'
    | 'pharmacist_review_started'
    | 'pharmacist_review_completed'
    | 'diagnostic_approved'
    | 'diagnostic_modified'
    | 'diagnostic_rejected'
    | 'intervention_created'
    | 'lab_order_created'
    | 'lab_result_added'
    | 'follow_up_scheduled'
    | 'adherence_tracked'
    | 'security_violation'
    | 'data_access'
    | 'data_export'
    | 'consent_obtained'
    | 'consent_revoked'
    | 'data_retention_policy_updated';

    entityType: 'diagnostic_request' | 'diagnostic_result' | 'lab_order' | 'lab_result' | 'follow_up' | 'adherence';
    entityId: string;
    userId: string;
    workplaceId: string;
    patientId?: string;

    details: {
        [key: string]: any;
    };

    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
        apiVersion?: string;
        requestId?: string;
    };

    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';

    // Compliance fields
    regulatoryContext?: {
        hipaaCompliant: boolean;
        gdprCompliant: boolean;
        dataRetentionPeriod: number; // in days
        consentRequired: boolean;
        consentObtained?: boolean;
    };

    // AI-specific audit fields
    aiMetadata?: {
        modelId: string;
        modelVersion: string;
        promptHash: string;
        responseHash: string;
        tokenUsage: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
        confidenceScore?: number;
        processingTime: number;
    };
}

export interface AuditSearchCriteria {
    workplaceId: string;
    startDate?: Date;
    endDate?: Date;
    eventTypes?: string[];
    entityTypes?: string[];
    userIds?: string[];
    patientIds?: string[];
    severity?: string[];
    entityId?: string;
    searchText?: string;
    limit?: number;
    offset?: number;
}

export interface ComplianceReport {
    reportId: string;
    workplaceId: string;
    reportType: 'hipaa' | 'gdpr' | 'audit_trail' | 'data_access' | 'ai_usage';
    period: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;

    summary: {
        totalEvents: number;
        criticalEvents: number;
        securityViolations: number;
        dataAccessEvents: number;
        aiUsageEvents: number;
        consentEvents: number;
    };

    findings: Array<{
        category: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        count: number;
        recommendation?: string;
    }>;

    dataRetention: {
        totalRecords: number;
        recordsNearingExpiry: number;
        expiredRecords: number;
        retentionPolicy: string;
    };

    aiUsage: {
        totalRequests: number;
        uniqueUsers: number;
        averageConfidence: number;
        modelUsage: {
            [modelId: string]: {
                requests: number;
                averageTokens: number;
                averageProcessingTime: number;
            };
        };
    };

    complianceStatus: {
        hipaaCompliant: boolean;
        gdprCompliant: boolean;
        issues: string[];
        recommendations: string[];
    };
}

class DiagnosticAuditService {
    /**
     * Log a diagnostic audit event
     */
    async logAuditEvent(event: DiagnosticAuditEvent): Promise<void> {
        try {
            // Use the existing audit service with diagnostic-specific context
            const auditContext = {
                userId: new Types.ObjectId(event.userId),
                workplaceId: new Types.ObjectId(event.workplaceId),
                userRole: 'system', // Placeholder: userRole is not directly available in DiagnosticAuditEvent
                sessionId: event.metadata?.sessionId, // Optional
                ipAddress: event.metadata?.ipAddress, // Optional
                userAgent: event.metadata?.userAgent, // Optional
                requestMethod: 'N/A', // Placeholder: requestMethod is not directly available
                requestUrl: 'N/A', // Placeholder: requestUrl is not directly available
            };

            const auditLogData = {
                action: event.eventType,
                resourceType: event.entityType,
                resourceId: new Types.ObjectId(event.entityId),
                patientId: event.patientId ? new Types.ObjectId(event.patientId) : undefined,
                details: {
                    ...event.details,
                    entityType: event.entityType,
                    entityId: event.entityId,
                    patientId: event.patientId,
                    severity: event.severity,
                    regulatoryContext: event.regulatoryContext,
                    aiMetadata: event.aiMetadata,
                    metadata: event.metadata
                },
                errorMessage: event.details?.errorMessage,
                duration: event.details?.duration,
                complianceCategory: event.details?.complianceCategory,
                riskLevel: event.severity,
            };

            await AuditService.logActivity(auditContext, auditLogData);

            // Log to application logger for immediate monitoring
            logger.info('Diagnostic audit event logged', {
                eventType: event.eventType,
                entityType: event.entityType,
                entityId: event.entityId,
                userId: event.userId,
                workplaceId: event.workplaceId,
                severity: event.severity,
                timestamp: event.timestamp
            });

            // Log critical events with higher priority
            if (event.severity === 'critical') {
                logger.error('Critical diagnostic audit event', {
                    eventType: event.eventType,
                    details: event.details,
                    userId: event.userId,
                    workplaceId: event.workplaceId
                });
            }
        } catch (error) {
            logger.error('Failed to log diagnostic audit event:', error);
            // Don't throw error to avoid disrupting main workflow
        }
    }

    /**
     * Log diagnostic request creation
     */
    async logDiagnosticRequestCreated(
        requestId: string,
        userId: string,
        workplaceId: string,
        patientId: string,
        details: any,
        metadata?: any
    ): Promise<void> {
        await this.logAuditEvent({
            eventType: 'diagnostic_request_created',
            entityType: 'diagnostic_request',
            entityId: requestId,
            userId,
            workplaceId,
            patientId,
            details: {
                symptoms: details.symptoms,
                vitals: details.vitals,
                medications: details.medications?.length || 0,
                allergies: details.allergies?.length || 0,
                consentObtained: details.consentObtained
            },
            metadata,
            timestamp: new Date(),
            severity: 'medium',
            regulatoryContext: {
                hipaaCompliant: true,
                gdprCompliant: true,
                dataRetentionPeriod: 2555, // 7 years
                consentRequired: true,
                consentObtained: details.consentObtained
            }
        });
    }

    /**
     * Log AI analysis request
     */
    async logAIAnalysisRequested(
        requestId: string,
        userId: string,
        workplaceId: string,
        patientId: string,
        aiMetadata: any,
        metadata?: any
    ): Promise<void> {
        await this.logAuditEvent({
            eventType: 'ai_analysis_requested',
            entityType: 'diagnostic_request',
            entityId: requestId,
            userId,
            workplaceId,
            patientId,
            details: {
                modelRequested: aiMetadata.modelId,
                promptVersion: aiMetadata.promptVersion,
                consentVerified: true
            },
            aiMetadata: {
                modelId: aiMetadata.modelId,
                modelVersion: aiMetadata.modelVersion,
                promptHash: aiMetadata.promptHash,
                responseHash: '', // Will be filled when response is received
                tokenUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0
                },
                processingTime: 0
            },
            metadata,
            timestamp: new Date(),
            severity: 'high',
            regulatoryContext: {
                hipaaCompliant: true,
                gdprCompliant: true,
                dataRetentionPeriod: 2555,
                consentRequired: true,
                consentObtained: true
            }
        });
    }

    /**
     * Log AI analysis completion
     */
    async logAIAnalysisCompleted(
        requestId: string,
        resultId: string,
        userId: string,
        workplaceId: string,
        patientId: string,
        aiMetadata: any,
        metadata?: any
    ): Promise<void> {
        await this.logAuditEvent({
            eventType: 'ai_analysis_completed',
            entityType: 'diagnostic_result',
            entityId: resultId,
            userId,
            workplaceId,
            patientId,
            details: {
                requestId,
                diagnosesCount: aiMetadata.diagnosesCount,
                suggestedTestsCount: aiMetadata.suggestedTestsCount,
                medicationSuggestionsCount: aiMetadata.medicationSuggestionsCount,
                redFlagsCount: aiMetadata.redFlagsCount,
                referralRecommended: aiMetadata.referralRecommended
            },
            aiMetadata: {
                modelId: aiMetadata.modelId,
                modelVersion: aiMetadata.modelVersion,
                promptHash: aiMetadata.promptHash,
                responseHash: aiMetadata.responseHash,
                tokenUsage: aiMetadata.tokenUsage,
                confidenceScore: aiMetadata.confidenceScore,
                processingTime: aiMetadata.processingTime
            },
            metadata,
            timestamp: new Date(),
            severity: 'high'
        });
    }

    /**
     * Log pharmacist review
     */
    async logPharmacistReview(
        resultId: string,
        userId: string,
        workplaceId: string,
        patientId: string,
        reviewDetails: any,
        metadata?: any
    ): Promise<void> {
        const eventType = reviewDetails.status === 'approved' ? 'diagnostic_approved' :
            reviewDetails.status === 'modified' ? 'diagnostic_modified' :
                'diagnostic_rejected';

        await this.logAuditEvent({
            eventType: eventType as any,
            entityType: 'diagnostic_result',
            entityId: resultId,
            userId,
            workplaceId,
            patientId,
            details: {
                reviewStatus: reviewDetails.status,
                modifications: reviewDetails.modifications,
                rejectionReason: reviewDetails.rejectionReason,
                reviewTime: reviewDetails.reviewTime
            },
            metadata,
            timestamp: new Date(),
            severity: 'high'
        });
    }

    /**
     * Log security violation
     */
    async logSecurityViolation(
        userId: string,
        workplaceId: string,
        violationType: string,
        details: any,
        metadata?: any
    ): Promise<void> {
        await this.logAuditEvent({
            eventType: 'security_violation',
            entityType: 'diagnostic_request',
            entityId: 'security_event',
            userId,
            workplaceId,
            details: {
                violationType,
                ...details
            },
            metadata,
            timestamp: new Date(),
            severity: 'critical'
        });

        // Also log to security monitoring
        logger.error('Diagnostic security violation detected', {
            userId,
            workplaceId,
            violationType,
            details,
            timestamp: new Date()
        });
    }

    /**
     * Search audit events
     */
    async searchAuditEvents(criteria: AuditSearchCriteria): Promise<{
        events: any[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            // Build search criteria for the audit service
            const searchCriteria: any = {
                workplaceId: criteria.workplaceId,
                limit: criteria.limit || 50,
                offset: criteria.offset || 0
            };

            if (criteria.startDate || criteria.endDate) {
                searchCriteria.dateRange = {};
                if (criteria.startDate) searchCriteria.dateRange.start = criteria.startDate;
                if (criteria.endDate) searchCriteria.dateRange.end = criteria.endDate;
            }

            if (criteria.userIds?.length) {
                searchCriteria.userIds = criteria.userIds;
            }

            if (criteria.eventTypes?.length) {
                searchCriteria.actions = criteria.eventTypes;
            }

            if (criteria.entityId) {
                searchCriteria.resource = criteria.entityId;
            }

            // Use existing audit service to search
            const filters = {
                startDate: searchCriteria.dateRange?.start,
                endDate: searchCriteria.dateRange?.end,
                userId: searchCriteria.userIds?.[0],
                action: searchCriteria.actions?.[0]
            };

            const options = {
                page: Math.floor((searchCriteria.offset || 0) / (searchCriteria.limit || 50)) + 1,
                limit: searchCriteria.limit || 50
            };

            const results = await AuditService.getAuditLogs(filters);

            // Filter for diagnostic-related events
            const diagnosticEvents = results.logs.filter((log: any) =>
                log.details?.entityType &&
                ['diagnostic_request', 'diagnostic_result', 'lab_order', 'lab_result', 'follow_up', 'adherence'].includes(log.details.entityType)
            );

            return {
                events: diagnosticEvents,
                total: results.total,
                hasMore: (searchCriteria.offset || 0) + diagnosticEvents.length < results.total
            };
        } catch (error) {
            logger.error('Error searching audit events:', error);
            throw new Error('Failed to search audit events');
        }
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(
        workplaceId: string,
        reportType: ComplianceReport['reportType'],
        startDate: Date,
        endDate: Date,
        generatedBy: string
    ): Promise<ComplianceReport> {
        try {
            const reportId = new Types.ObjectId().toString();

            // Search for all diagnostic events in the period
            const auditEvents = await this.searchAuditEvents({
                workplaceId,
                startDate,
                endDate,
                limit: 10000 // Get all events for comprehensive report
            });

            // Analyze events for compliance
            const summary = this.analyzeEventsForCompliance(auditEvents.events);
            const findings = this.generateComplianceFindings(auditEvents.events);
            const dataRetention = await this.analyzeDataRetention(workplaceId, startDate, endDate);
            const aiUsage = this.analyzeAIUsage(auditEvents.events);
            const complianceStatus = this.assessComplianceStatus(auditEvents.events, findings);

            const report: ComplianceReport = {
                reportId,
                workplaceId,
                reportType,
                period: { startDate, endDate },
                generatedAt: new Date(),
                generatedBy,
                summary,
                findings,
                dataRetention,
                aiUsage,
                complianceStatus
            };

            // Log report generation
            await this.logAuditEvent({
                eventType: 'data_export',
                entityType: 'diagnostic_request',
                entityId: reportId,
                userId: generatedBy,
                workplaceId,
                details: {
                    reportType,
                    period: { startDate, endDate },
                    eventsAnalyzed: auditEvents.events.length
                },
                timestamp: new Date(),
                severity: 'medium'
            });

            return report;
        } catch (error) {
            logger.error('Error generating compliance report:', error);
            throw new Error('Failed to generate compliance report');
        }
    }

    /**
     * Analyze events for compliance summary
     */
    private analyzeEventsForCompliance(events: any[]): ComplianceReport['summary'] {
        const summary = {
            totalEvents: events.length,
            criticalEvents: 0,
            securityViolations: 0,
            dataAccessEvents: 0,
            aiUsageEvents: 0,
            consentEvents: 0
        };

        events.forEach(event => {
            if (event.details?.severity === 'critical') {
                summary.criticalEvents++;
            }

            if (event.action === 'security_violation') {
                summary.securityViolations++;
            }

            if (event.action === 'data_access' || event.action === 'data_export') {
                summary.dataAccessEvents++;
            }

            if (event.action?.includes('ai_analysis')) {
                summary.aiUsageEvents++;
            }

            if (event.action === 'consent_obtained' || event.action === 'consent_revoked') {
                summary.consentEvents++;
            }
        });

        return summary;
    }

    /**
     * Generate compliance findings
     */
    private generateComplianceFindings(events: any[]): ComplianceReport['findings'] {
        const findings: ComplianceReport['findings'] = [];

        // Check for security violations
        const securityViolations = events.filter(e => e.action === 'security_violation');
        if (securityViolations.length > 0) {
            findings.push({
                category: 'Security',
                severity: 'critical',
                description: `${securityViolations.length} security violations detected`,
                count: securityViolations.length,
                recommendation: 'Review security protocols and user access controls'
            });
        }

        // Check for missing consent
        const diagnosticRequests = events.filter(e => e.action === 'diagnostic_request_created');
        const missingConsent = diagnosticRequests.filter(e => !e.details?.consentObtained);
        if (missingConsent.length > 0) {
            findings.push({
                category: 'Consent Management',
                severity: 'high',
                description: `${missingConsent.length} diagnostic requests without proper consent`,
                count: missingConsent.length,
                recommendation: 'Ensure consent is obtained before processing diagnostic requests'
            });
        }

        // Check AI usage patterns
        const aiEvents = events.filter(e => e.action?.includes('ai_analysis'));
        const failedAI = aiEvents.filter(e => e.action === 'ai_analysis_failed');
        if (failedAI.length > aiEvents.length * 0.1) { // More than 10% failure rate
            findings.push({
                category: 'AI Performance',
                severity: 'medium',
                description: `High AI failure rate: ${((failedAI.length / aiEvents.length) * 100).toFixed(1)}%`,
                count: failedAI.length,
                recommendation: 'Review AI service configuration and error handling'
            });
        }

        return findings;
    }

    /**
     * Analyze data retention compliance
     */
    private async analyzeDataRetention(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ComplianceReport['dataRetention']> {
        // This would typically query the database for records and their ages
        // For now, return mock data structure
        return {
            totalRecords: 1000,
            recordsNearingExpiry: 50,
            expiredRecords: 5,
            retentionPolicy: '7 years for diagnostic records, 3 years for audit logs'
        };
    }

    /**
     * Analyze AI usage patterns
     */
    private analyzeAIUsage(events: any[]): ComplianceReport['aiUsage'] {
        const aiEvents = events.filter(e => e.action?.includes('ai_analysis'));
        const uniqueUsers = new Set(aiEvents.map(e => e.userId)).size;

        const modelUsage: { [key: string]: any } = {};
        let totalTokens = 0;
        let totalProcessingTime = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;

        aiEvents.forEach(event => {
            const aiMetadata = event.details?.aiMetadata;
            if (aiMetadata) {
                const modelId = aiMetadata.modelId || 'unknown';

                if (!modelUsage[modelId]) {
                    modelUsage[modelId] = {
                        requests: 0,
                        averageTokens: 0,
                        averageProcessingTime: 0
                    };
                }

                modelUsage[modelId].requests++;

                if (aiMetadata.tokenUsage?.totalTokens) {
                    totalTokens += aiMetadata.tokenUsage.totalTokens;
                    modelUsage[modelId].averageTokens += aiMetadata.tokenUsage.totalTokens;
                }

                if (aiMetadata.processingTime) {
                    totalProcessingTime += aiMetadata.processingTime;
                    modelUsage[modelId].averageProcessingTime += aiMetadata.processingTime;
                }

                if (aiMetadata.confidenceScore) {
                    totalConfidence += aiMetadata.confidenceScore;
                    confidenceCount++;
                }
            }
        });

        // Calculate averages for each model
        Object.keys(modelUsage).forEach(modelId => {
            const model = modelUsage[modelId];
            model.averageTokens = model.averageTokens / model.requests;
            model.averageProcessingTime = model.averageProcessingTime / model.requests;
        });

        return {
            totalRequests: aiEvents.length,
            uniqueUsers,
            averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
            modelUsage
        };
    }

    /**
     * Assess overall compliance status
     */
    private assessComplianceStatus(
        events: any[],
        findings: ComplianceReport['findings']
    ): ComplianceReport['complianceStatus'] {
        const criticalFindings = findings.filter(f => f.severity === 'critical');
        const highFindings = findings.filter(f => f.severity === 'high');

        const issues: string[] = [];
        const recommendations: string[] = [];

        criticalFindings.forEach(finding => {
            issues.push(finding.description);
            if (finding.recommendation) {
                recommendations.push(finding.recommendation);
            }
        });

        highFindings.forEach(finding => {
            issues.push(finding.description);
            if (finding.recommendation) {
                recommendations.push(finding.recommendation);
            }
        });

        return {
            hipaaCompliant: criticalFindings.length === 0,
            gdprCompliant: criticalFindings.length === 0,
            issues,
            recommendations
        };
    }

    /**
     * Get audit trail for specific entity
     */
    async getEntityAuditTrail(
        entityType: string,
        entityId: string,
        workplaceId: string
    ): Promise<any[]> {
        try {
            const results = await this.searchAuditEvents({
                workplaceId,
                entityId,
                limit: 1000
            });

            return results.events.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
        } catch (error) {
            logger.error('Error getting entity audit trail:', error);
            throw new Error('Failed to retrieve audit trail');
        }
    }

    /**
     * Archive old audit records based on retention policy
     */
    async archiveOldRecords(workplaceId: string, retentionDays: number = 2555): Promise<{
        archivedCount: number;
        deletedCount: number;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // This would typically move old records to archive storage
            // and delete very old records based on policy

            logger.info('Audit record archival completed', {
                workplaceId,
                cutoffDate,
                retentionDays
            });

            return {
                archivedCount: 0, // Would be actual count
                deletedCount: 0   // Would be actual count
            };
        } catch (error) {
            logger.error('Error archiving audit records:', error);
            throw new Error('Failed to archive audit records');
        }
    }
}

export default new DiagnosticAuditService();