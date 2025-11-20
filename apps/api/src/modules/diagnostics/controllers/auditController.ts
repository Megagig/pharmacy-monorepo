/**
 * Enhanced Audit Controller
 * Handles requests for audit logging, compliance reporting, security monitoring, and audit visualization
 */

import { Request, Response } from 'express';
import diagnosticAuditService, { AuditSearchCriteria, ComplianceReport } from '../services/diagnosticAuditService';
import complianceReportingService from '../services/complianceReportingService';
import auditVisualizationService from '../services/auditVisualizationService';
import logger from '../../../utils/logger';
import { AuthRequest } from '../../../types/auth';

/**
 * Search audit events
 */
export const searchAuditEvents = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user!;
        const workplaceIdString = workplaceId?.toString() || '';
        const {
            startDate,
            endDate,
            eventTypes,
            entityTypes,
            userIds,
            patientIds,
            severity,
            entityId,
            searchText,
            limit,
            offset
        } = req.query;

        const criteria: AuditSearchCriteria = {
            workplaceId: workplaceIdString,
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0
        };

        if (startDate) criteria.startDate = new Date(startDate as string);
        if (endDate) criteria.endDate = new Date(endDate as string);
        if (eventTypes) criteria.eventTypes = (eventTypes as string).split(',');
        if (entityTypes) criteria.entityTypes = (entityTypes as string).split(',');
        if (userIds) criteria.userIds = (userIds as string).split(',');
        if (patientIds) criteria.patientIds = (patientIds as string).split(',');
        if (severity) criteria.severity = (severity as string).split(',');
        if (entityId) criteria.entityId = entityId as string;
        if (searchText) criteria.searchText = searchText as string;

        const results = await diagnosticAuditService.searchAuditEvents(criteria);

        return res.json({
            success: true,
            data: {
                events: results.events,
                pagination: {
                    total: results.total,
                    limit: criteria.limit,
                    offset: criteria.offset,
                    hasMore: results.hasMore
                }
            }
        });
    } catch (error) {
        logger.error('Error searching audit events:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUDIT_SEARCH_ERROR',
                message: 'Failed to search audit events',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get audit trail for specific entity
 */
export const getEntityAuditTrail = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user!;
        const workplaceIdString = workplaceId?.toString() || '';
        const { entityType, entityId } = req.params;

        if (!entityType || !entityId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Entity type and ID are required'
                }
            });
        }

        const auditTrail = await diagnosticAuditService.getEntityAuditTrail(
            entityType,
            entityId,
            workplaceIdString
        );

        return res.json({
            success: true,
            data: {
                entityType,
                entityId,
                auditTrail
            }
        });
    } catch (error) {
        logger.error('Error getting entity audit trail:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUDIT_TRAIL_ERROR',
                message: 'Failed to retrieve audit trail',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Generate compliance report
 */
export const generateComplianceReport = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId, _id: userId } = req.user!;
        const { reportType, startDate, endDate } = req.query;

        if (!reportType || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Report type, start date, and end date are required'
                }
            });
        }

        const validReportTypes = ['hipaa', 'gdpr', 'audit_trail', 'data_access', 'ai_usage'];
        if (!validReportTypes.includes(reportType as string)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REPORT_TYPE',
                    message: `Report type must be one of: ${validReportTypes.join(', ')}`
                }
            });
        }

        const report = await diagnosticAuditService.generateComplianceReport(
            workplaceId?.toString() || '',
            reportType as ComplianceReport['reportType'],
            new Date(startDate as string),
            new Date(endDate as string),
            userId?.toString() || ''
        );

        return res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('Error generating compliance report:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'COMPLIANCE_REPORT_ERROR',
                message: 'Failed to generate compliance report',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Log security violation
 */
export const logSecurityViolation = async (req: AuthRequest, res: Response) => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { violationType, details } = req.body;

        if (!violationType) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_VIOLATION_TYPE',
                    message: 'Violation type is required'
                }
            });
        }

        await diagnosticAuditService.logSecurityViolation(
            userId.toString(),
            workplaceId?.toString() || '',
            violationType,
            details || {},
            {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                requestId: req.headers['x-request-id'] as string
            }
        );

        return res.json({
            success: true,
            message: 'Security violation logged successfully'
        });
    } catch (error) {
        logger.error('Error logging security violation:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SECURITY_LOG_ERROR',
                message: 'Failed to log security violation',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get audit statistics
 */
export const getAuditStatistics = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user;
        const { period = '30d' } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const results = await diagnosticAuditService.searchAuditEvents({
            workplaceId: workplaceId!.toString(),
            startDate,
            endDate: now,
            limit: 10000 // Get all events for statistics
        });

        // Calculate statistics
        const eventsByType: { [key: string]: number } = {};
        const eventsBySeverity: { [key: string]: number } = {};
        const eventsByUser: { [key: string]: number } = {};
        const dailyActivity: { [key: string]: number } = {};

        results.events.forEach(event => {
            // Count by event type
            const eventType = event.action || 'unknown';
            eventsByType[eventType] = (eventsByType[eventType] || 0) + 1;

            // Count by severity
            const severity = event.details?.severity || 'unknown';
            eventsBySeverity[severity] = (eventsBySeverity[severity] || 0) + 1;

            // Count by user
            const userId = event.userId?.toString() || 'unknown';
            eventsByUser[userId] = (eventsByUser[userId] || 0) + 1;

            // Count by day
            const day = new Date(event.timestamp).toISOString().split('T')[0];
            if (day) {
                dailyActivity[day] = (dailyActivity[day] || 0) + 1;
            }
        });

        const statistics = {
            period: period as string,
            dateRange: {
                start: startDate,
                end: now
            },
            summary: {
                totalEvents: results.events.length,
                uniqueUsers: Object.keys(eventsByUser).length,
                criticalEvents: eventsBySeverity.critical || 0,
                securityViolations: eventsByType.security_violation || 0
            },
            breakdown: {
                eventsByType: Object.entries(eventsByType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([type, count]) => ({ type, count })),
                eventsBySeverity: Object.entries(eventsBySeverity)
                    .map(([severity, count]) => ({ severity, count })),
                topUsers: Object.entries(eventsByUser)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([userId, count]) => ({ userId, count })),
                dailyActivity: Object.entries(dailyActivity)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, count]) => ({ date, count }))
            }
        };

        return res.json({
            success: true,
            data: statistics
        });
    } catch (error) {
        logger.error('Error getting audit statistics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUDIT_STATS_ERROR',
                message: 'Failed to retrieve audit statistics',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Archive old audit records
 */
export const archiveAuditRecords = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user;
        const { retentionDays } = req.body;

        if (!retentionDays || retentionDays < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_RETENTION_PERIOD',
                    message: 'Retention days must be a positive number'
                }
            });
        }

        const result = await diagnosticAuditService.archiveOldRecords(
            workplaceId?.toString() || '',
            parseInt(retentionDays)
        );

        return res.json({
            success: true,
            data: {
                archivedCount: result.archivedCount,
                deletedCount: result.deletedCount,
                message: 'Audit records archived successfully'
            }
        });
    } catch (error) {
        logger.error('Error archiving audit records:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'ARCHIVE_ERROR',
                message: 'Failed to archive audit records',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Export audit data
 */
export const exportAuditData = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { startDate, endDate, format = 'json' } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_DATE_RANGE',
                    message: 'Start date and end date are required'
                }
            });
            return;
        }

        const results = await diagnosticAuditService.searchAuditEvents({
            workplaceId: workplaceId?.toString() || '',
            startDate: new Date(startDate as string),
            endDate: new Date(endDate as string),
            limit: 10000 // Export all events in range
        });

        // Log the export activity
        await diagnosticAuditService.logAuditEvent({
            eventType: 'data_export',
            entityType: 'diagnostic_request',
            entityId: 'audit_export',
            userId,
            workplaceId: workplaceId?.toString() || '',
            details: {
                exportFormat: format,
                recordCount: results.events.length,
                dateRange: { startDate, endDate }
            },
            timestamp: new Date(),
            severity: 'medium'
        });

        if (format === 'csv') {
            // Convert to CSV format
            const csvHeaders = [
                'Timestamp',
                'Event Type',
                'Entity Type',
                'Entity ID',
                'User ID',
                'Severity',
                'Details'
            ];

            const csvRows = results.events.map(event => [
                new Date(event.timestamp).toISOString(),
                event.action || '',
                event.details?.entityType || '',
                event.details?.entityId || '',
                event.userId || '',
                event.details?.severity || '',
                JSON.stringify(event.details || {})
            ]);

            const csvContent = [
                csvHeaders.join(','),
                ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_export_${Date.now()}.csv"`);
            res.send(csvContent);
        } else {
            // JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="audit_export_${Date.now()}.json"`);
            res.json({
                exportInfo: {
                    workplaceId: workplaceId?.toString() || '',
                    dateRange: { startDate, endDate },
                    exportedAt: new Date(),
                    exportedBy: userId,
                    recordCount: results.events.length
                },
                auditEvents: results.events
            });
        }
    } catch (error) {
        logger.error('Error exporting audit data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'EXPORT_ERROR',
                message: 'Failed to export audit data',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Generate regulatory compliance report
 */
export const generateRegulatoryReport = async (req: AuthRequest, res: Response) => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { reportType, startDate, endDate } = req.query;

        if (!reportType || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Report type, start date, and end date are required'
                }
            });
        }

        const validReportTypes = ['hipaa', 'gdpr', 'fda_21cfr11', 'sox', 'pci_dss'];
        if (!validReportTypes.includes(reportType as string)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_REPORT_TYPE',
                    message: `Report type must be one of: ${validReportTypes.join(', ')}`
                }
            });
        }

        const report = await complianceReportingService.generateRegulatoryReport(
            workplaceId?.toString() || '',
            reportType as any,
            new Date(startDate as string),
            new Date(endDate as string),
            userId
        );

        return res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('Error generating regulatory report:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'REGULATORY_REPORT_ERROR',
                message: 'Failed to generate regulatory compliance report',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Detect audit anomalies
 */
export const detectAuditAnomalies = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user;
        const { lookbackDays = 30 } = req.query;

        const anomalies = await complianceReportingService.detectAnomalies(
            workplaceId?.toString() || '',
            parseInt(lookbackDays as string)
        );

        return res.json({
            success: true,
            data: {
                anomalies,
                detectionPeriod: `${lookbackDays} days`,
                detectedAt: new Date(),
                summary: {
                    totalAnomalies: anomalies.length,
                    criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
                    highRiskAnomalies: anomalies.filter(a => a.severity === 'high').length
                }
            }
        });
    } catch (error) {
        logger.error('Error detecting audit anomalies:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'ANOMALY_DETECTION_ERROR',
                message: 'Failed to detect audit anomalies',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get audit visualization data
 */
export const getAuditVisualization = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_DATE_RANGE',
                    message: 'Start date and end date are required'
                }
            });
        }

        const visualizationData = await auditVisualizationService.generateVisualizationData(
            workplaceId?.toString() || '',
            new Date(startDate as string),
            new Date(endDate as string)
        );

        return res.json({
            success: true,
            data: visualizationData
        });
    } catch (error) {
        logger.error('Error generating audit visualization:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'VISUALIZATION_ERROR',
                message: 'Failed to generate audit visualization',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Advanced audit search with filters
 */
export const advancedAuditSearch = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.workplaceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Workplace ID is required'
                }
            });
        }
        const { workplaceId } = req.user;
        const {
            startDate,
            endDate,
            userIds,
            eventTypes,
            entityTypes,
            entityIds,
            riskLevels,
            searchText,
            ipAddresses,
            sessionIds,
            hasErrors,
            complianceCategories,
            page = 1,
            limit = 50
        } = req.query;

        const filters = {
            workplaceId: workplaceId?.toString() || '',
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            userIds: userIds ? (userIds as string).split(',') : undefined,
            eventTypes: eventTypes ? (eventTypes as string).split(',') : undefined,
            entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
            entityIds: entityIds ? (entityIds as string).split(',') : undefined,
            riskLevels: riskLevels ? (riskLevels as string).split(',') : undefined,
            searchText: searchText as string,
            ipAddresses: ipAddresses ? (ipAddresses as string).split(',') : undefined,
            sessionIds: sessionIds ? (sessionIds as string).split(',') : undefined,
            hasErrors: hasErrors ? hasErrors === 'true' : undefined,
            complianceCategories: complianceCategories ? (complianceCategories as string).split(',') : undefined
        };

        const results = await auditVisualizationService.searchAuditEvents(
            filters,
            parseInt(page as string),
            parseInt(limit as string)
        );

        return res.json({
            success: true,
            data: results
        });
    } catch (error) {
        logger.error('Error performing advanced audit search:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'ADVANCED_SEARCH_ERROR',
                message: 'Failed to perform advanced audit search',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Export audit visualization data
 */
export const exportAuditVisualization = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { workplaceId, _id: userId } = req.user!;
        const { startDate, endDate, format = 'json' } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_DATE_RANGE',
                    message: 'Start date and end date are required'
                }
            });
            return;
        }

        const exportData = await auditVisualizationService.exportVisualizationData(
            workplaceId?.toString() || '',
            new Date(startDate as string),
            new Date(endDate as string),
            format as 'json' | 'csv' | 'pdf'
        );

        // Log the export activity
        await diagnosticAuditService.logAuditEvent({
            eventType: 'data_export',
            entityType: 'diagnostic_request',
            entityId: 'audit_visualization_export',
            userId,
            workplaceId: workplaceId?.toString() || '',
            details: {
                exportFormat: format,
                dateRange: { startDate, endDate },
                exportType: 'audit_visualization'
            },
            timestamp: new Date(),
            severity: 'medium'
        });

        res.setHeader('Content-Type', exportData.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);

        if (format === 'json') {
            res.json(JSON.parse(exportData.data));
        } else {
            res.send(exportData.data);
        }
    } catch (error) {
        logger.error('Error exporting audit visualization:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'EXPORT_VISUALIZATION_ERROR',
                message: 'Failed to export audit visualization',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get data retention policies
 */
export const getDataRetentionPolicies = async (req: AuthRequest, res: Response) => {
    try {
        const policies = complianceReportingService.getDataRetentionPolicies();

        return res.json({
            success: true,
            data: {
                policies,
                lastUpdated: new Date(),
                totalPolicies: policies.length
            }
        });
    } catch (error) {
        logger.error('Error getting data retention policies:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'RETENTION_POLICIES_ERROR',
                message: 'Failed to retrieve data retention policies',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Update data retention policy
 */
export const updateDataRetentionPolicy = async (req: AuthRequest, res: Response) => {
    try {
        const { recordType } = req.params;
        const policyUpdate = req.body;

        if (!recordType) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_RECORD_TYPE',
                    message: 'Record type is required'
                }
            });
        }

        complianceReportingService.updateDataRetentionPolicy(recordType, policyUpdate);

        // Log the policy update
        await diagnosticAuditService.logAuditEvent({
            eventType: 'data_retention_policy_updated',
            entityType: 'diagnostic_request',
            entityId: recordType,
            userId: req.user!._id,
            workplaceId: req.user!.workplaceId!.toString(),
            details: {
                recordType,
                policyUpdate,
                updatedBy: req.user!._id
            },
            timestamp: new Date(),
            severity: 'high'
        });

        return res.json({
            success: true,
            message: 'Data retention policy updated successfully',
            data: {
                recordType,
                updatedPolicy: policyUpdate
            }
        });
    } catch (error) {
        logger.error('Error updating data retention policy:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'UPDATE_POLICY_ERROR',
                message: 'Failed to update data retention policy',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

export default {
    searchAuditEvents,
    getEntityAuditTrail,
    generateComplianceReport,
    generateRegulatoryReport,
    detectAuditAnomalies,
    getAuditVisualization,
    advancedAuditSearch,
    exportAuditVisualization,
    getDataRetentionPolicies,
    updateDataRetentionPolicy,
    logSecurityViolation,
    getAuditStatistics,
    archiveAuditRecords,
    exportAuditData
};