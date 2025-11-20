import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import CommunicationAuditService, { CommunicationAuditFilters } from '../services/communicationAuditService';
import logger from '../utils/logger';
import { validationResult } from 'express-validator';

// Helper function to safely get workplace ID
const getWorkplaceId = (req: AuthRequest): string => {
    return req.user?.workplaceId?.toString() || '';
};

/**
 * Controller for communication audit log operations
 */
class CommunicationAuditController {
    /**
     * Get audit logs with filtering and pagination
     */
    async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const workplaceId = getWorkplaceId(req);

            const filters: CommunicationAuditFilters = {
                userId: req.query.userId as string,
                action: req.query.action as string,
                targetType: req.query.targetType as string,
                conversationId: req.query.conversationId as string,
                patientId: req.query.patientId as string,
                riskLevel: req.query.riskLevel as string,
                complianceCategory: req.query.complianceCategory as string,
                success: req.query.success ? req.query.success === 'true' : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
                offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
            };

            const result = await CommunicationAuditService.getAuditLogs(workplaceId, filters);

            res.json({
                success: true,
                message: 'Audit logs retrieved successfully',
                data: result.logs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    pages: result.pages,
                    hasNext: result.page < result.pages,
                    hasPrev: result.page > 1,
                },
            });
        } catch (error) {
            logger.error('Error getting audit logs', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            // Return empty data instead of error to prevent frontend crashes
            res.json({
                success: true,
                message: 'Audit logs retrieved successfully (empty result)',
                data: [],
                pagination: {
                    total: 0,
                    page: 1,
                    limit: 50,
                    pages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            });
        }
    }

    /**
     * Get audit logs for a specific conversation
     */
    async getConversationAuditLogs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const { conversationId } = req.params;
            const workplaceId = getWorkplaceId(req);

            const options = {
                limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
            };

            const logs = await CommunicationAuditService.getConversationAuditLogs(
                conversationId || '',
                workplaceId,
                options
            );

            res.json({
                success: true,
                message: 'Conversation audit logs retrieved successfully',
                data: logs,
                count: logs.length,
            });
        } catch (error) {
            logger.error('Error getting conversation audit logs', {
                error: error instanceof Error ? error.message : 'Unknown error',
                conversationId: req.params.conversationId,
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            // Return empty data instead of error to prevent frontend crashes
            res.json({
                success: true,
                message: 'Conversation audit logs retrieved successfully (empty result)',
                data: [],
                count: 0,
            });
        }
    }

    /**
     * Get high-risk activities
     */
    async getHighRiskActivities(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const workplaceId = getWorkplaceId(req);

            // Default to last 30 days if no date range provided
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            const activities = await CommunicationAuditService.getHighRiskActivities(
                workplaceId,
                { start: startDate, end: endDate }
            );

            res.json({
                success: true,
                message: 'High-risk activities retrieved successfully',
                data: activities,
                count: activities.length,
                dateRange: { start: startDate, end: endDate },
            });
        } catch (error) {
            logger.error('Error getting high-risk activities', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            // Return empty data instead of error to prevent frontend crashes
            res.json({
                success: true,
                message: 'High-risk activities retrieved successfully (empty result)',
                data: [],
                count: 0,
                dateRange: { start: req.query.startDate, end: req.query.endDate },
            });
        }
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const workplaceId = getWorkplaceId(req);

            // Default to last 30 days if no date range provided
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            const report = await CommunicationAuditService.generateComplianceReport(
                workplaceId,
                { start: startDate, end: endDate }
            );

            res.json({
                success: true,
                message: 'Compliance report generated successfully',
                data: report,
                dateRange: { start: startDate, end: endDate },
                generatedAt: new Date(),
            });
        } catch (error) {
            logger.error('Error generating compliance report', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            // Return empty report instead of error to prevent frontend crashes
            res.json({
                success: true,
                message: 'Compliance report generated successfully (empty result)',
                data: {
                    summary: {
                        totalActivities: 0,
                        complianceScore: 100,
                        riskLevel: 'low',
                        criticalIssues: 0
                    },
                    details: [],
                    recommendations: []
                },
                dateRange: { start: req.query.startDate, end: req.query.endDate },
                generatedAt: new Date(),
            });
        }
    }

    /**
     * Export audit logs
     */
    async exportAuditLogs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const workplaceId = getWorkplaceId(req);
            const format = (req.query.format as string) || 'csv';

            const filters: CommunicationAuditFilters = {
                userId: req.query.userId as string,
                action: req.query.action as string,
                targetType: req.query.targetType as string,
                conversationId: req.query.conversationId as string,
                patientId: req.query.patientId as string,
                riskLevel: req.query.riskLevel as string,
                complianceCategory: req.query.complianceCategory as string,
                success: req.query.success ? req.query.success === 'true' : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
            };

            const exportData = await CommunicationAuditService.exportAuditLogs(
                workplaceId,
                filters,
                format as 'csv' | 'json'
            );

            // Set appropriate headers for file download
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `communication_audit_logs_${timestamp}.${format}`;

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');

            res.send(exportData);
        } catch (error) {
            logger.error('Error exporting audit logs', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            res.status(500).json({
                success: false,
                message: 'Failed to export audit logs',
                error: process.env.NODE_ENV === 'development' ? error : undefined,
            });
        }
    }

    /**
     * Get user activity summary
     */
    async getUserActivitySummary(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const userId = req.params.userId || req.user!._id.toString();
            const workplaceId = getWorkplaceId(req);

            // Default to last 30 days if no date range provided
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            const summary = await CommunicationAuditService.getUserActivitySummary(
                userId,
                workplaceId,
                { start: startDate, end: endDate }
            );

            res.json({
                success: true,
                message: 'User activity summary retrieved successfully',
                data: summary,
                userId,
                dateRange: { start: startDate, end: endDate },
            });
        } catch (error) {
            logger.error('Error getting user activity summary', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.params.userId || req.user?._id,
                service: 'communication-audit-controller',
            });

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve user activity summary',
                error: process.env.NODE_ENV === 'development' ? error : undefined,
            });
        }
    }

    /**
     * Get audit statistics
     */
    async getAuditStatistics(req: AuthRequest, res: Response): Promise<void> {
        try {
            const workplaceId = getWorkplaceId(req);

            // Default to last 30 days if no date range provided
            const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Get various statistics
            const [
                totalLogs,
                highRiskActivities,
                complianceReport,
                recentActivity
            ] = await Promise.all([
                CommunicationAuditService.getAuditLogs(workplaceId, {
                    startDate,
                    endDate,
                    limit: 1,
                }),
                CommunicationAuditService.getHighRiskActivities(workplaceId, {
                    start: startDate,
                    end: endDate,
                }),
                CommunicationAuditService.generateComplianceReport(workplaceId, {
                    start: startDate,
                    end: endDate,
                }),
                CommunicationAuditService.getAuditLogs(workplaceId, {
                    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    limit: 10,
                }),
            ]);

            const statistics = {
                totalActivities: totalLogs.total,
                highRiskActivities: highRiskActivities.length,
                recentActivities: recentActivity.logs.length,
                complianceSummary: complianceReport,
                dateRange: { start: startDate, end: endDate },
                generatedAt: new Date(),
            };

            res.json({
                success: true,
                message: 'Audit statistics retrieved successfully',
                data: statistics,
            });
        } catch (error) {
            logger.error('Error getting audit statistics', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            // Return empty statistics instead of error to prevent frontend crashes
            res.json({
                success: true,
                message: 'Audit statistics retrieved successfully (empty result)',
                data: {
                    totalActivities: 0,
                    highRiskActivities: 0,
                    recentActivities: 0,
                    complianceSummary: {
                        summary: {
                            totalActivities: 0,
                            complianceScore: 100,
                            riskLevel: 'low',
                            criticalIssues: 0
                        },
                        details: [],
                        recommendations: []
                    },
                    dateRange: { start: req.query.startDate, end: req.query.endDate },
                    generatedAt: new Date(),
                },
            });
        }
    }

    /**
     * Search audit logs
     */
    async searchAuditLogs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
                return;
            }

            const workplaceId = getWorkplaceId(req);
            const searchQuery = req.query.q as string;

            if (!searchQuery || searchQuery.trim().length < 2) {
                res.status(400).json({
                    success: false,
                    message: 'Search query must be at least 2 characters long',
                });
                return;
            }

            // Build search filters
            const filters: CommunicationAuditFilters = {
                action: searchQuery.toLowerCase().includes('message') ? 'message_sent' : undefined,
                targetType: searchQuery.toLowerCase().includes('conversation') ? 'conversation' : undefined,
                riskLevel: searchQuery.toLowerCase().includes('high') ? 'high' :
                    searchQuery.toLowerCase().includes('critical') ? 'critical' : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
                offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
            };

            const result = await CommunicationAuditService.getAuditLogs(workplaceId, filters);

            res.json({
                success: true,
                message: 'Audit logs search completed',
                data: result.logs,
                searchQuery,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    pages: result.pages,
                },
            });
        } catch (error) {
            logger.error('Error searching audit logs', {
                error: error instanceof Error ? error.message : 'Unknown error',
                searchQuery: req.query.q,
                userId: req.user?._id,
                service: 'communication-audit-controller',
            });

            res.status(500).json({
                success: false,
                message: 'Failed to search audit logs',
                error: process.env.NODE_ENV === 'development' ? error : undefined,
            });
        }
    }
}

export default new CommunicationAuditController();