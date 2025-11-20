import mongoose from 'mongoose';
import { AuditService } from '../../../services/auditService';
export interface AuditContext {
    userId: string;
    workspaceId: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
}
export interface AuditLogData {
    action: string;
    userId: string;
    interventionId?: string;
    details: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory: string;
    changedFields?: string[];
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    workspaceId?: string;
}
import logger from '../../../utils/logger';
import { IManualLabOrder } from '../models/ManualLabOrder';
import { IManualLabResult } from '../models/ManualLabResult';

/**
 * Enhanced Audit Service for Manual Lab Order Workflow
 * Provides specialized audit logging for compliance and security tracking
 */

export interface ManualLabAuditContext extends AuditContext {
    orderId?: string;
    patientId?: mongoose.Types.ObjectId;
    testCount?: number;
    priority?: string;
    hasAbnormalResults?: boolean;
}

export interface PDFAccessAuditData {
    orderId: string;
    patientId: mongoose.Types.ObjectId;
    fileName: string;
    fileSize: number;
    downloadMethod: 'direct_link' | 'qr_scan' | 'barcode_scan';
    accessDuration?: number;
    userAgent?: string;
    referrer?: string;
}

export interface ResultEntryAuditData {
    orderId: string;
    patientId: mongoose.Types.ObjectId;
    testCount: number;
    abnormalResultCount: number;
    criticalResultCount: number;
    entryDuration?: number;
    validationErrors?: string[];
    aiProcessingTriggered: boolean;
}

export interface ComplianceReportData {
    workplaceId: mongoose.Types.ObjectId;
    reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
    dateRange: { start: Date; end: Date };
    totalOrders: number;
    totalResults: number;
    pdfAccesses: number;
    complianceViolations: number;
    securityIncidents: number;
}

class ManualLabAuditService {
    /**
     * Log manual lab order creation with enhanced details
     */
    static async logOrderCreation(
        context: ManualLabAuditContext,
        order: IManualLabOrder,
        pdfGenerated: boolean = false,
        generationTime?: number
    ): Promise<void> {
        try {
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_ORDER_CREATED',
                resourceType: 'Patient',
                resourceId: order._id,
                patientId: order.patientId,
                details: {
                    orderId: order.orderId,
                    testCount: order.tests.length,
                    testCodes: order.tests.map(t => t.code),
                    priority: order.priority,
                    indication: order.indication,
                    consentObtained: order.consentObtained,
                    consentTimestamp: order.consentTimestamp,
                    pdfGenerated,
                    pdfGenerationTime: generationTime,
                    locationId: order.locationId,
                    requisitionUrl: order.requisitionFormUrl,
                    barcodeGenerated: !!order.barcodeData
                },
                complianceCategory: 'clinical_documentation',
                riskLevel: order.priority === 'stat' ? 'high' : 'medium'
            });

            logger.info('Manual lab order creation audited', {
                orderId: order.orderId,
                patientId: order.patientId,
                workplaceId: context.workspaceId,
                userId: context.userId,
                testCount: order.tests.length,
                service: 'manual-lab-audit'
            });
        } catch (error) {
            logger.error('Failed to audit order creation', {
                orderId: order.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log PDF access and download events with detailed tracking
     */
    static async logPDFAccess(
        context: ManualLabAuditContext,
        auditData: PDFAccessAuditData
    ): Promise<void> {
        try {
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_PDF_ACCESSED',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(), // PDF access doesn't have a specific resource ID
                patientId: auditData.patientId,
                details: {
                    orderId: auditData.orderId,
                    fileName: auditData.fileName,
                    fileSize: auditData.fileSize,
                    downloadMethod: auditData.downloadMethod,
                    accessDuration: auditData.accessDuration,
                    userAgent: auditData.userAgent,
                    referrer: auditData.referrer,
                    timestamp: new Date(),
                    sessionId: context.sessionId
                },
                complianceCategory: 'data_access',
                riskLevel: auditData.downloadMethod === 'direct_link' ? 'medium' : 'low'
            });

            // Track PDF access patterns for security monitoring
            await this.trackPDFAccessPattern(context, auditData);

            logger.info('Manual lab PDF access audited', {
                orderId: auditData.orderId,
                fileName: auditData.fileName,
                downloadMethod: auditData.downloadMethod,
                userId: context.userId,
                service: 'manual-lab-audit'
            });
        } catch (error) {
            logger.error('Failed to audit PDF access', {
                orderId: auditData.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log result entry and modification activities
     */
    static async logResultEntry(
        context: ManualLabAuditContext,
        result: IManualLabResult,
        auditData: ResultEntryAuditData
    ): Promise<void> {
        try {
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_RESULTS_ENTERED',
                resourceType: 'Patient',
                resourceId: result._id,
                patientId: auditData.patientId,
                details: {
                    orderId: auditData.orderId,
                    resultId: result._id,
                    testCount: auditData.testCount,
                    abnormalResultCount: auditData.abnormalResultCount,
                    criticalResultCount: auditData.criticalResultCount,
                    entryDuration: auditData.entryDuration,
                    validationErrors: auditData.validationErrors,
                    aiProcessingTriggered: auditData.aiProcessingTriggered,
                    enteredBy: result.enteredBy,
                    enteredAt: result.enteredAt,
                    hasReviewNotes: !!result.reviewNotes,
                    interpretationCount: result.interpretation.length
                },
                complianceCategory: 'clinical_documentation',
                riskLevel: auditData.criticalResultCount > 0 ? 'critical' :
                    auditData.abnormalResultCount > 0 ? 'high' : 'medium'
            });

            // Log individual test results for detailed tracking
            for (const value of result.values) {
                await this.logIndividualTestResult(context, auditData.orderId, value);
            }

            logger.info('Manual lab result entry audited', {
                orderId: auditData.orderId,
                resultId: result._id,
                testCount: auditData.testCount,
                abnormalCount: auditData.abnormalResultCount,
                criticalCount: auditData.criticalResultCount,
                service: 'manual-lab-audit'
            });
        } catch (error) {
            logger.error('Failed to audit result entry', {
                orderId: auditData.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log result modifications and updates
     */
    static async logResultModification(
        context: ManualLabAuditContext,
        orderId: string,
        oldValues: any,
        newValues: any,
        modificationReason?: string
    ): Promise<void> {
        try {
            const changedFields = this.getChangedFields(oldValues, newValues);

            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_RESULTS_MODIFIED',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(),
                patientId: context.patientId,
                oldValues,
                newValues,
                changedFields,
                details: {
                    orderId,
                    modificationReason,
                    changedFieldCount: changedFields.length,
                    modifiedBy: context.userId,
                    modifiedAt: new Date(),
                    requiresReview: changedFields.some(field =>
                        ['numericValue', 'stringValue', 'interpretation'].includes(field)
                    )
                },
                complianceCategory: 'clinical_documentation',
                riskLevel: 'high' // Result modifications are always high risk
            });

            logger.warn('Manual lab result modification audited', {
                orderId,
                changedFields,
                modificationReason,
                userId: context.userId,
                service: 'manual-lab-audit'
            });
        } catch (error) {
            logger.error('Failed to audit result modification', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log order status changes with workflow compliance tracking
     */
    static async logStatusChange(
        context: ManualLabAuditContext,
        orderId: string,
        oldStatus: string,
        newStatus: string,
        statusChangeReason?: string
    ): Promise<void> {
        try {
            const isValidTransition = this.validateStatusTransition(oldStatus, newStatus);

            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_ORDER_STATUS_CHANGED',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(),
                patientId: context.patientId,
                oldValues: { status: oldStatus },
                newValues: { status: newStatus },
                changedFields: ['status'],
                details: {
                    orderId,
                    oldStatus,
                    newStatus,
                    statusChangeReason,
                    isValidTransition,
                    changedBy: context.userId,
                    changedAt: new Date(),
                    workflowCompliant: isValidTransition
                },
                complianceCategory: 'workflow_compliance',
                riskLevel: isValidTransition ? 'low' : 'high'
            });

            if (!isValidTransition) {
                logger.warn('Invalid status transition detected', {
                    orderId,
                    oldStatus,
                    newStatus,
                    userId: context.userId,
                    service: 'manual-lab-audit'
                });
            }
        } catch (error) {
            logger.error('Failed to audit status change', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log token resolution and scanning activities
     */
    static async logTokenResolution(
        context: ManualLabAuditContext,
        orderId: string,
        tokenType: 'qr_code' | 'barcode' | 'manual_entry',
        success: boolean,
        errorReason?: string
    ): Promise<void> {
        try {
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_TOKEN_RESOLVED',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(),
                patientId: context.patientId,
                details: {
                    orderId,
                    tokenType,
                    success,
                    errorReason,
                    resolvedBy: context.userId,
                    resolvedAt: new Date(),
                    sessionId: context.sessionId
                },
                complianceCategory: 'data_access',
                riskLevel: success ? 'low' : 'medium'
            });

            logger.info('Token resolution audited', {
                orderId,
                tokenType,
                success,
                userId: context.userId,
                service: 'manual-lab-audit'
            });
        } catch (error) {
            logger.error('Failed to audit token resolution', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Generate compliance reports for audit trails
     */
    static async generateComplianceReport(
        reportData: ComplianceReportData
    ): Promise<any> {
        try {
            // Get audit logs for the specified period
            const { logs, total } = await AuditService.getAuditLogs({
                startDate: reportData.dateRange.start.toISOString(),
                endDate: reportData.dateRange.end.toISOString(),
                action: 'MANUAL_LAB_'
            });

            // Analyze compliance metrics
            const complianceMetrics = this.analyzeComplianceMetrics(logs);

            // Generate report
            const report = {
                reportId: new mongoose.Types.ObjectId(),
                workplaceId: reportData.workplaceId,
                reportType: reportData.reportType,
                dateRange: reportData.dateRange,
                generatedAt: new Date(),
                summary: {
                    totalAuditLogs: total,
                    totalOrders: reportData.totalOrders,
                    totalResults: reportData.totalResults,
                    pdfAccesses: reportData.pdfAccesses,
                    complianceScore: complianceMetrics.complianceScore,
                    riskScore: complianceMetrics.riskScore
                },
                metrics: complianceMetrics,
                violations: complianceMetrics.violations,
                recommendations: this.generateComplianceRecommendations(complianceMetrics)
            };

            // Log report generation
            await AuditService.logActivity({
                userId: new mongoose.Types.ObjectId(),
                workplaceId: reportData.workplaceId,
                userRole: 'system'
            }, {
                action: 'MANUAL_LAB_COMPLIANCE_REPORT_GENERATED',
                resourceType: 'System',
                resourceId: report.reportId,
                details: {
                    reportType: reportData.reportType,
                    dateRange: reportData.dateRange,
                    totalLogs: total,
                    complianceScore: complianceMetrics.complianceScore
                },
                complianceCategory: 'system_security',
                riskLevel: 'low'
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate compliance report', {
                workplaceId: reportData.workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
            throw error;
        }
    }

    /**
     * Track PDF access patterns for security monitoring
     */
    private static async trackPDFAccessPattern(
        context: ManualLabAuditContext,
        auditData: PDFAccessAuditData
    ): Promise<void> {
        try {
            // Check for suspicious PDF access patterns
            const recentAccesses = await AuditService.getAuditLogs({
                userId: context.userId,
                action: 'MANUAL_LAB_PDF_ACCESSED',
                startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour
            });

            const accessCount = recentAccesses.total;
            const uniqueOrders = new Set(
                recentAccesses.logs.map(log => log.details?.orderId)
            ).size;

            // Flag suspicious patterns
            if (accessCount > 50 || (accessCount > 10 && uniqueOrders < 3)) {
                await AuditService.logActivity(context, {
                    action: 'MANUAL_LAB_SUSPICIOUS_PDF_ACCESS_PATTERN',
                    resourceType: 'System',
                    resourceId: context.userId,
                    details: {
                        accessCount,
                        uniqueOrders,
                        timeWindow: '1 hour',
                        currentAccess: auditData,
                        flaggedReason: accessCount > 50 ? 'high_volume' : 'low_diversity'
                    },
                    complianceCategory: 'system_security',
                    riskLevel: 'high'
                });

                logger.warn('Suspicious PDF access pattern detected', {
                    userId: context.userId,
                    accessCount,
                    uniqueOrders,
                    service: 'manual-lab-audit'
                });
            }
        } catch (error) {
            logger.error('Failed to track PDF access pattern', {
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Log individual test results for detailed tracking
     */
    private static async logIndividualTestResult(
        context: ManualLabAuditContext,
        orderId: string,
        testValue: any
    ): Promise<void> {
        try {
            await AuditService.logActivity(context, {
                action: 'MANUAL_LAB_INDIVIDUAL_TEST_RESULT',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(),
                patientId: context.patientId,
                details: {
                    orderId,
                    testCode: testValue.testCode,
                    testName: testValue.testName,
                    hasNumericValue: testValue.numericValue !== undefined,
                    hasStringValue: testValue.stringValue !== undefined,
                    unit: testValue.unit,
                    abnormalFlag: testValue.abnormalFlag,
                    hasComment: !!testValue.comment,
                    enteredAt: new Date()
                },
                complianceCategory: 'clinical_documentation',
                riskLevel: testValue.abnormalFlag ? 'medium' : 'low'
            });
        } catch (error) {
            logger.error('Failed to log individual test result', {
                orderId,
                testCode: testValue.testCode,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-audit'
            });
        }
    }

    /**
     * Validate status transitions for workflow compliance
     */
    private static validateStatusTransition(oldStatus: string, newStatus: string): boolean {
        const validTransitions: { [key: string]: string[] } = {
            'requested': ['sample_collected', 'cancelled'],
            'sample_collected': ['result_awaited', 'cancelled'],
            'result_awaited': ['completed', 'cancelled'],
            'completed': ['referred'],
            'cancelled': [], // No transitions from cancelled
            'referred': [] // No transitions from referred
        };

        return validTransitions[oldStatus]?.includes(newStatus) || false;
    }

    /**
     * Get changed fields between old and new values
     */
    private static getChangedFields(oldValues: any, newValues: any): string[] {
        const changedFields: string[] = [];

        if (!oldValues || !newValues) return changedFields;

        const allKeys = new Set([
            ...Object.keys(oldValues),
            ...Object.keys(newValues)
        ]);

        for (const key of allKeys) {
            if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
                changedFields.push(key);
            }
        }

        return changedFields;
    }

    /**
     * Analyze compliance metrics from audit logs
     */
    private static analyzeComplianceMetrics(logs: any[]): any {
        const metrics = {
            totalLogs: logs.length,
            orderCreations: 0,
            resultEntries: 0,
            pdfAccesses: 0,
            statusChanges: 0,
            violations: [] as any[],
            riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
            complianceScore: 100,
            riskScore: 0
        };

        for (const log of logs) {
            // Count activity types
            if (log.action.includes('ORDER_CREATED')) metrics.orderCreations++;
            if (log.action.includes('RESULTS_ENTERED')) metrics.resultEntries++;
            if (log.action.includes('PDF_ACCESSED')) metrics.pdfAccesses++;
            if (log.action.includes('STATUS_CHANGED')) metrics.statusChanges++;

            // Track risk distribution
            if (log.riskLevel) {
                metrics.riskDistribution[log.riskLevel as keyof typeof metrics.riskDistribution]++;
            }

            // Identify violations
            if (log.riskLevel === 'high' || log.riskLevel === 'critical') {
                metrics.violations.push({
                    logId: log._id,
                    action: log.action,
                    timestamp: log.timestamp,
                    riskLevel: log.riskLevel,
                    details: log.details
                });
            }
        }

        // Calculate compliance score
        const violationPenalty = metrics.violations.length * 5;
        const riskPenalty = (metrics.riskDistribution.high * 2) + (metrics.riskDistribution.critical * 5);
        metrics.complianceScore = Math.max(0, 100 - violationPenalty - riskPenalty);

        // Calculate risk score
        metrics.riskScore = (
            (metrics.riskDistribution.low * 1) +
            (metrics.riskDistribution.medium * 2) +
            (metrics.riskDistribution.high * 4) +
            (metrics.riskDistribution.critical * 8)
        ) / metrics.totalLogs;

        return metrics;
    }

    /**
     * Generate compliance recommendations based on metrics
     */
    private static generateComplianceRecommendations(metrics: any): string[] {
        const recommendations: string[] = [];

        if (metrics.complianceScore < 80) {
            recommendations.push('Compliance score is below acceptable threshold. Review workflow processes.');
        }

        if (metrics.violations.length > 10) {
            recommendations.push('High number of compliance violations detected. Implement additional training.');
        }

        if (metrics.riskScore > 3) {
            recommendations.push('High risk activities detected. Consider implementing additional security measures.');
        }

        if (metrics.pdfAccesses > metrics.orderCreations * 5) {
            recommendations.push('Unusually high PDF access ratio. Monitor for potential data exfiltration.');
        }

        if (recommendations.length === 0) {
            recommendations.push('Compliance metrics are within acceptable ranges. Continue monitoring.');
        }

        return recommendations;
    }
}

export default ManualLabAuditService;