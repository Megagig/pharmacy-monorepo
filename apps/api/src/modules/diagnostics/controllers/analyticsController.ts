/**
 * Analytics Controller
 * Handles requests for diagnostic analytics, reporting, and performance metrics
 */

import { Request, Response } from 'express';
import diagnosticAnalyticsService from '../services/diagnosticAnalyticsService';
import logger from '../../../utils/logger';
import { AuthRequest } from '../../../types/auth';

/**
 * Get diagnostic metrics for the workplace
 */
export const getDiagnosticMetrics = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const metrics = await diagnosticAnalyticsService.getDiagnosticMetrics(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Error getting diagnostic metrics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'ANALYTICS_ERROR',
                message: 'Failed to retrieve diagnostic metrics',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get AI performance metrics
 */
export const getAIPerformanceMetrics = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const metrics = await diagnosticAnalyticsService.getAIPerformanceMetrics(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Error getting AI performance metrics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AI_ANALYTICS_ERROR',
                message: 'Failed to retrieve AI performance metrics',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get patient outcome metrics
 */
export const getPatientOutcomeMetrics = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const metrics = await diagnosticAnalyticsService.getPatientOutcomeMetrics(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Error getting patient outcome metrics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'OUTCOME_ANALYTICS_ERROR',
                message: 'Failed to retrieve patient outcome metrics',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get usage analytics
 */
export const getUsageAnalytics = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const analytics = await diagnosticAnalyticsService.getUsageAnalytics(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        logger.error('Error getting usage analytics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'USAGE_ANALYTICS_ERROR',
                message: 'Failed to retrieve usage analytics',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get trend analysis
 */
export const getTrendAnalysis = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const trends = await diagnosticAnalyticsService.getTrendAnalysis(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        logger.error('Error getting trend analysis:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'TREND_ANALYTICS_ERROR',
                message: 'Failed to retrieve trend analysis',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get comparison analysis between manual and AI-assisted diagnoses
 */
export const getComparisonAnalysis = async (req: AuthRequest, res: Response) => {
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

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const comparison = await diagnosticAnalyticsService.getComparisonAnalysis(
            workplaceId.toString(),
            start,
            end
        );

        return res.json({
            success: true,
            data: comparison
        });
    } catch (error) {
        logger.error('Error getting comparison analysis:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'COMPARISON_ANALYTICS_ERROR',
                message: 'Failed to retrieve comparison analysis',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Generate comprehensive analytics report
 */
export const generateAnalyticsReport = async (req: AuthRequest, res: Response) => {
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
        const { startDate, endDate, format } = req.query;

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const report = await diagnosticAnalyticsService.generateAnalyticsReport(
            workplaceId.toString(),
            start,
            end
        );

        // If PDF format is requested, we could generate a PDF here
        if (format === 'pdf') {
            // TODO: Implement PDF generation
            res.status(501).json({
                success: false,
                error: {
                    code: 'PDF_NOT_IMPLEMENTED',
                    message: 'PDF report generation not yet implemented'
                }
            });
            return;
        }

        return res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('Error generating analytics report:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'REPORT_GENERATION_ERROR',
                message: 'Failed to generate analytics report',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

/**
 * Get dashboard summary with key metrics
 */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
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

        const [diagnosticMetrics, aiPerformance, patientOutcomes, usageAnalytics] = await Promise.all([
            diagnosticAnalyticsService.getDiagnosticMetrics(workplaceId.toString(), startDate, now),
            diagnosticAnalyticsService.getAIPerformanceMetrics(workplaceId.toString(), startDate, now),
            diagnosticAnalyticsService.getPatientOutcomeMetrics(workplaceId.toString(), startDate, now),
            diagnosticAnalyticsService.getUsageAnalytics(workplaceId.toString(), startDate, now)
        ]);

        const summary = {
            period: period as string,
            dateRange: {
                start: startDate,
                end: now
            },
            keyMetrics: {
                totalCases: diagnosticMetrics.totalCases,
                successRate: diagnosticMetrics.successRate,
                averageProcessingTime: diagnosticMetrics.averageProcessingTime,
                aiConfidence: aiPerformance.averageConfidenceScore,
                overrideRate: aiPerformance.pharmacistOverrideRate,
                activeUsers: usageAnalytics.monthlyActiveUsers,
                patientOutcomes: {
                    followUpCompliance: patientOutcomes.followUpCompliance,
                    adherenceRate: patientOutcomes.adherenceRate,
                    referralRate: patientOutcomes.referralRate
                }
            },
            alerts: [] as Array<{
                type: 'warning' | 'error' | 'info';
                message: string;
                metric: string;
                value: number;
            }>
        };

        // Add alerts for concerning metrics
        if (diagnosticMetrics.successRate < 90) {
            summary.alerts.push({
                type: 'warning',
                message: 'Diagnostic success rate is below 90%',
                metric: 'successRate',
                value: diagnosticMetrics.successRate
            });
        }

        if (aiPerformance.pharmacistOverrideRate > 20) {
            summary.alerts.push({
                type: 'warning',
                message: 'AI override rate is above 20%',
                metric: 'overrideRate',
                value: aiPerformance.pharmacistOverrideRate
            });
        }

        if (patientOutcomes.followUpCompliance < 80) {
            summary.alerts.push({
                type: 'error',
                message: 'Follow-up compliance is below 80%',
                metric: 'followUpCompliance',
                value: patientOutcomes.followUpCompliance
            });
        }

        return res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        logger.error('Error getting dashboard summary:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'DASHBOARD_ERROR',
                message: 'Failed to retrieve dashboard summary',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
};

export default {
    getDiagnosticMetrics,
    getAIPerformanceMetrics,
    getPatientOutcomeMetrics,
    getUsageAnalytics,
    getTrendAnalysis,
    getComparisonAnalysis,
    generateAnalyticsReport,
    getDashboardSummary
};