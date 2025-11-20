import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import { AuditService } from '../services/auditService';
import { createManualAuditLog } from '../middlewares/auditMiddleware';

/**
 * Get audit trail for all interventions
 */
export const getAllAuditTrail = async (req: AuthRequest, res: Response) => {
    try {
        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            riskLevel,
            userId,
            action,
            complianceCategory
        } = req.query;

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            startDate: startDate as string,
            endDate: endDate as string,
            riskLevel: riskLevel as string,
            userId: userId as string,
            action: action as string,
            complianceCategory: complianceCategory as string
        };

        const result = await AuditService.getAuditLogs(options);

        // Log the audit access
        await createManualAuditLog(req, 'AUDIT_TRAIL_ACCESSED', {
            filters: options,
            resultCount: result.logs.length
        }, {
            complianceCategory: 'regulatory_compliance',
            riskLevel: 'low'
        });

        res.json({
            success: true,
            message: 'Audit trail retrieved successfully',
            data: result
        });
    } catch (error) {
        console.error('Error getting audit trail:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit trail',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Get audit trail for a specific intervention
 */
export const getInterventionAuditTrail = async (req: AuthRequest, res: Response) => {
    try {
        const { interventionId } = req.params;

        if (!interventionId) {
            return res.status(400).json({
                success: false,
                message: 'Intervention ID is required'
            });
        }

        const {
            page = 1,
            limit = 20,
            startDate,
            endDate,
            riskLevel,
            action
        } = req.query;

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            startDate: startDate as string,
            endDate: endDate as string,
            riskLevel: riskLevel as string,
            action: action as string
        };

        const result = await AuditService.getInterventionAuditLogs(interventionId, options);

        // Log the audit access
        await createManualAuditLog(req, 'INTERVENTION_AUDIT_ACCESSED', {
            interventionId,
            filters: options,
            resultCount: result.logs.length
        }, {
            interventionId,
            complianceCategory: 'regulatory_compliance',
            riskLevel: 'low'
        });

        return res.json({
            success: true,
            message: 'Intervention audit trail retrieved successfully',
            data: result
        });
    } catch (error) {
        console.error('Error getting intervention audit trail:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve intervention audit trail',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Export audit data
 */
export const exportAuditData = async (req: AuthRequest, res: Response) => {
    try {
        const {
            format = 'csv',
            startDate,
            endDate,
            riskLevel,
            userId,
            action,
            interventionIds,
            includeDetails = 'true'
        } = req.query;

        const interventionIdsArray = interventionIds
            ? (interventionIds as string).split(',')
            : undefined;

        const options = {
            format: format as 'csv' | 'json',
            startDate: startDate as string,
            endDate: endDate as string,
            riskLevel: riskLevel as string,
            userId: userId as string,
            action: action as string,
            interventionId: interventionIdsArray?.[0] // For single intervention export
        };

        const exportData = await AuditService.exportAuditLogs(options);

        // Log the export action
        await createManualAuditLog(req, 'EXPORT_PERFORMED', {
            exportType: 'audit_data',
            format,
            filters: options,
            dataSize: exportData.length
        }, {
            complianceCategory: 'data_integrity',
            riskLevel: 'medium'
        });

        // Set appropriate headers
        const filename = `audit_export_${new Date().toISOString().split('T')[0]}.${format}`;
        const contentType = format === 'csv' ? 'text/csv' : 'application/json';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
    } catch (error) {
        console.error('Error exporting audit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export audit data',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Get compliance report
 */
export const getComplianceReport = async (req: AuthRequest, res: Response) => {
    try {
        const {
            startDate,
            endDate,
            includeDetails = 'false',
            interventionIds
        } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const interventionIdsArray = interventionIds
            ? (interventionIds as string).split(',')
            : undefined;

        const options = {
            startDate: startDate as string,
            endDate: endDate as string,
            includeDetails: includeDetails === 'true',
            interventionIds: interventionIdsArray
        };

        const report = await AuditService.getComplianceReport(options);

        // Log the report generation
        await createManualAuditLog(req, 'REPORT_GENERATED', {
            reportType: 'compliance',
            dateRange: { startDate, endDate },
            interventionCount: interventionIdsArray?.length || 'all'
        }, {
            complianceCategory: 'regulatory_compliance',
            riskLevel: 'low'
        });

        return res.json({
            success: true,
            message: 'Compliance report generated successfully',
            data: report
        });
    } catch (error) {
        console.error('Error generating compliance report:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate compliance report',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Get audit statistics
 */
export const getAuditStatistics = async (req: Request, res: Response) => {
    try {
        const {
            startDate,
            endDate,
            groupBy = 'day'
        } = req.query;

        // Build date filter
        const dateFilter: any = {};
        if (startDate) dateFilter.$gte = new Date(startDate as string);
        if (endDate) dateFilter.$lte = new Date(endDate as string);

        const matchStage: any = {};
        if (Object.keys(dateFilter).length > 0) {
            matchStage.timestamp = dateFilter;
        }

        // Aggregation pipeline for statistics
        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupBy === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d',
                            date: '$timestamp'
                        }
                    },
                    totalActions: { $sum: 1 },
                    riskActivities: {
                        $sum: {
                            $cond: [
                                { $in: ['$riskLevel', ['high', 'critical']] },
                                1,
                                0
                            ]
                        }
                    },
                    uniqueUsers: { $addToSet: '$userId' },
                    actionTypes: { $addToSet: '$action' }
                }
            },
            {
                $project: {
                    date: '$_id',
                    totalActions: 1,
                    riskActivities: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    actionTypes: { $size: '$actionTypes' }
                }
            },
            { $sort: { date: 1 } }
        ];

        const statistics = await AuditService.getAuditLogs({ limit: 1 }); // Get basic stats

        res.json({
            success: true,
            message: 'Audit statistics retrieved successfully',
            data: {
                summary: statistics.summary,
                timeline: [] // Would be populated by aggregation in real implementation
            }
        });
    } catch (error) {
        console.error('Error getting audit statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Clean up old audit logs (admin only)
 */
export const cleanupAuditLogs = async (req: AuthRequest, res: Response) => {
    try {
        const { daysToKeep = 365 } = req.body;

        // Check if user has admin privileges
        if (req.user?.role !== 'super_admin' && req.user?.role !== 'owner') {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to perform cleanup'
            });
        }

        const deletedCount = await AuditService.cleanupOldLogs(parseInt(daysToKeep));

        // Log the cleanup action
        await createManualAuditLog(req, 'AUDIT_CLEANUP_PERFORMED', {
            daysToKeep,
            deletedCount
        }, {
            complianceCategory: 'system_security',
            riskLevel: 'high'
        });

        return res.json({
            success: true,
            message: `Successfully cleaned up ${deletedCount} old audit logs`,
            data: { deletedCount }
        });
    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cleanup audit logs',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};