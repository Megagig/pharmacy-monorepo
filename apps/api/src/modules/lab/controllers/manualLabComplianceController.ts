import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../../middlewares/auth';
import ManualLabAuditService from '../services/manualLabAuditService';
import { AuditService } from '../../../services/auditService';
import {
    sendSuccess,
    sendError,
    asyncHandler,
    getRequestContext,
} from '../../../utils/responseHelpers';
import logger from '../../../utils/logger';

/**
 * Manual Lab Compliance Controller
 * Handles compliance reporting and audit trail management
 */

/**
 * GET /api/manual-lab-orders/compliance/report
 * Generate compliance report for manual lab operations
 */
export const generateComplianceReport = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            reportType = 'monthly',
            startDate,
            endDate,
            format = 'json'
        } = req.query as any;

        try {
            // Validate date range
            let dateRange: { start: Date; end: Date };

            if (startDate && endDate) {
                dateRange = {
                    start: new Date(startDate),
                    end: new Date(endDate)
                };
            } else {
                // Default to last 30 days
                const now = new Date();
                dateRange = {
                    start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                    end: now
                };
            }

            // Get audit statistics for the period
            const auditStats = await AuditService.getAuditLogs({
                startDate: dateRange.start.toISOString(),
                endDate: dateRange.end.toISOString(),
                action: 'MANUAL_LAB_',
                limit: 10000
            });

            // Count different types of operations
            const operationCounts = {
                totalOrders: 0,
                totalResults: 0,
                pdfAccesses: 0,
                statusChanges: 0,
                tokenResolutions: 0
            };

            auditStats.logs.forEach(log => {
                if (log.action.includes('ORDER_CREATED')) operationCounts.totalOrders++;
                if (log.action.includes('RESULTS_ENTERED')) operationCounts.totalResults++;
                if (log.action.includes('PDF_ACCESSED')) operationCounts.pdfAccesses++;
                if (log.action.includes('STATUS_CHANGED')) operationCounts.statusChanges++;
                if (log.action.includes('TOKEN_RESOLVED')) operationCounts.tokenResolutions++;
            });

            // Generate compliance report
            const report = await ManualLabAuditService.generateComplianceReport({
                workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
                reportType: reportType as any,
                dateRange,
                totalOrders: operationCounts.totalOrders,
                totalResults: operationCounts.totalResults,
                pdfAccesses: operationCounts.pdfAccesses,
                complianceViolations: auditStats.logs.filter(log =>
                    log.riskLevel === 'high' || log.riskLevel === 'critical'
                ).length,
                securityIncidents: auditStats.logs.filter(log =>
                    log.action.includes('SUSPICIOUS') || log.action.includes('VIOLATION')
                ).length
            });

            // Format response based on requested format
            if (format === 'csv') {
                const csvData = formatReportAsCSV(report);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="manual_lab_compliance_report_${Date.now()}.csv"`);
                res.send(csvData);
                return;
            }

            sendSuccess(
                res,
                {
                    report,
                    auditSummary: {
                        totalAuditLogs: auditStats.total,
                        dateRange,
                        operationCounts
                    }
                },
                'Compliance report generated successfully'
            );

            logger.info('Manual lab compliance report generated', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                reportType,
                dateRange,
                totalLogs: auditStats.total,
                service: 'manual-lab-compliance'
            });
        } catch (error) {
            logger.error('Failed to generate compliance report', {
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-compliance'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to generate compliance report', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/compliance/audit-trail/:orderId
 * Get detailed audit trail for a specific order
 */
export const getOrderAuditTrail = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const context = getRequestContext(req);

        try {
            // Get all audit logs for this order
            const { logs } = await AuditService.getAuditLogs({
                action: 'MANUAL_LAB_',
                limit: 1000
            });

            // Filter logs related to this specific order
            const orderLogs = logs.filter(log =>
                log.details?.orderId === orderId!.toUpperCase()
            );

            // Group logs by activity type
            const auditTrail = {
                orderId: orderId!.toUpperCase(),
                totalEvents: orderLogs.length,
                timeline: orderLogs.map(log => ({
                    timestamp: log.timestamp,
                    action: log.action,
                    userId: log.userId,

                    riskLevel: log.riskLevel,
                    complianceCategory: log.complianceCategory,
                    details: log.details,
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent
                })),
                summary: {
                    orderCreated: orderLogs.some(log => log.action.includes('ORDER_CREATED')),
                    resultsEntered: orderLogs.some(log => log.action.includes('RESULTS_ENTERED')),
                    pdfAccessed: orderLogs.filter(log => log.action.includes('PDF_ACCESSED')).length,
                    statusChanges: orderLogs.filter(log => log.action.includes('STATUS_CHANGED')).length,
                    complianceViolations: orderLogs.filter(log =>
                        log.riskLevel === 'high' || log.riskLevel === 'critical'
                    ).length
                }
            };

            sendSuccess(
                res,
                { auditTrail },
                'Order audit trail retrieved successfully'
            );

            logger.info('Order audit trail retrieved', {
                orderId,
                eventCount: orderLogs.length,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-compliance'
            });
        } catch (error) {
            logger.error('Failed to retrieve order audit trail', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-compliance'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve audit trail', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/compliance/violations
 * Get compliance violations and security incidents
 */
export const getComplianceViolations = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            page = 1,
            limit = 50,
            severity,
            startDate,
            endDate
        } = req.query as any;

        try {
            // Build filters for violations
            const filters: any = {
                action: 'MANUAL_LAB_',
                riskLevel: severity || { $in: ['high', 'critical'] }
            };

            if (startDate && endDate) {
                filters.startDate = new Date(startDate);
                filters.endDate = new Date(endDate);
            }

            // Get violation logs
            const { logs, total } = await AuditService.getAuditLogs({
                ...filters,
                page: parseInt(page),
                limit: parseInt(limit)
            });

            // Categorize violations
            const violations = logs.map(log => ({
                id: log._id,
                timestamp: log.timestamp,
                action: log.action,
                riskLevel: log.riskLevel,
                complianceCategory: log.complianceCategory,
                userId: log.userId,

                details: log.details,

                ipAddress: log.ipAddress,
                severity: log.riskLevel === 'critical' ? 'critical' :
                    log.riskLevel === 'high' ? 'high' : 'medium'
            }));

            // Get violation statistics
            const violationStats = {
                total,
                critical: violations.filter(v => v.severity === 'critical').length,
                high: violations.filter(v => v.severity === 'high').length,
                medium: violations.filter(v => v.severity === 'medium').length,
                categories: violations.reduce((acc: any, v) => {
                    acc[v.complianceCategory] = (acc[v.complianceCategory] || 0) + 1;
                    return acc;
                }, {})
            };

            sendSuccess(
                res,
                {
                    violations,
                    statistics: violationStats,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    }
                },
                'Compliance violations retrieved successfully'
            );

            logger.info('Compliance violations retrieved', {
                total,
                page,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-compliance'
            });
        } catch (error) {
            logger.error('Failed to retrieve compliance violations', {
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-compliance'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve compliance violations', 500);
        }
    }
);

/**
 * Helper method to format report as CSV
 */
function formatReportAsCSV(report: any): string {
    const headers = [
        'Timestamp',
        'Report Type',
        'Total Orders',
        'Total Results',
        'PDF Accesses',
        'Compliance Score',
        'Risk Score',
        'Violations Count'
    ];

    const rows = [
        headers.join(','),
        [
            report.generatedAt,
            report.reportType,
            report.summary.totalOrders,
            report.summary.totalResults,
            report.summary.pdfAccesses,
            report.summary.complianceScore,
            report.summary.riskScore,
            report.violations.length
        ].join(',')
    ];

    // Add violation details
    if (report.violations.length > 0) {
        rows.push(''); // Empty line
        rows.push('Violations:');
        rows.push('Timestamp,Action,Risk Level,Details');

        report.violations.forEach((violation: any) => {
            rows.push([
                violation.timestamp,
                violation.action,
                violation.riskLevel,
                JSON.stringify(violation.details).replace(/,/g, ';')
            ].join(','));
        });
    }

    return rows.join('\n');
}

export default {
    generateComplianceReport,
    getOrderAuditTrail,
    getComplianceViolations
};