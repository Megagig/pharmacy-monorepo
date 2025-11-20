import express from 'express';
import { auth } from '../middlewares/auth';
import { loadWorkspaceContext } from '../middlewares/workspaceContext';
import {
    clinicalInterventionErrorHandler,
    errorLoggingMiddleware,
    asyncErrorHandler
} from '../middlewares/clinicalInterventionErrorHandler';
import logger from '../utils/logger';

const router = express.Router();

// Apply middleware
router.use(auth);
router.use(loadWorkspaceContext);
router.use(errorLoggingMiddleware);

// Error report interface
interface ErrorReport {
    id: string;
    timestamp: string;
    error: {
        type: string;
        message: string;
        severity: string;
        recoveryAction: string;
        details?: Record<string, any>;
        technicalMessage?: string;
        stack?: string;
    };
    userDescription?: string;
    context: {
        component?: string;
        action?: string;
        formData?: any;
        apiEndpoint?: string;
        userRole?: string;
        workplaceId?: string;
    };
    userAgent: string;
    url: string;
    userId?: string;
    sessionId?: string;
    breadcrumbs: Array<{
        timestamp: string;
        category: string;
        message: string;
        level: string;
        data?: Record<string, any>;
    }>;
    systemInfo: {
        browser: string;
        browserVersion: string;
        os: string;
        screenResolution: string;
        viewport: string;
        timezone: string;
        language: string;
        cookiesEnabled: boolean;
        localStorageEnabled: boolean;
        connectionType?: string;
    };
}

// POST /api/error-reports - Submit error report
router.post('/', asyncErrorHandler(async (req: any, res: any) => {
    try {
        const errorReport: ErrorReport = req.body;

        // Validate required fields
        if (!errorReport.id || !errorReport.error || !errorReport.timestamp) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: id, error, timestamp'
            });
        }

        // Add server-side metadata
        const enhancedReport = {
            ...errorReport,
            serverTimestamp: new Date().toISOString(),
            serverUserId: req.user?.id,
            serverWorkplaceId: req.user?.workplaceId,
            serverUserRole: req.user?.role,
            serverRequestId: req.headers['x-request-id'],
            serverIpAddress: req.ip,
            serverUserAgent: req.get('User-Agent')
        };

        // Log the error report
        logger.error('Client Error Report Received', {
            reportId: errorReport.id,
            errorType: errorReport.error.type,
            errorMessage: errorReport.error.message,
            severity: errorReport.error.severity,
            userId: req.user?.id,
            workplaceId: req.user?.workplaceId,
            userDescription: errorReport.userDescription,
            context: errorReport.context,
            systemInfo: errorReport.systemInfo,
            breadcrumbs: errorReport.breadcrumbs?.length || 0,
            timestamp: errorReport.timestamp,
            serverTimestamp: enhancedReport.serverTimestamp
        });

        // In a production environment, you would:
        // 1. Store the error report in a database
        // 2. Send to external error tracking service (Sentry, Bugsnag, etc.)
        // 3. Create tickets in issue tracking system
        // 4. Send notifications to development team for critical errors

        // Example: Store in database (pseudo-code)
        // await ErrorReport.create(enhancedReport);

        // Example: Send to external service (pseudo-code)
        // if (process.env.NODE_ENV === 'production') {
        //     await externalErrorService.report(enhancedReport);
        // }

        // Example: Create ticket for critical errors (pseudo-code)
        // if (errorReport.error.severity === 'critical') {
        //     await ticketingService.createTicket({
        //         title: `Critical Error: ${errorReport.error.type}`,
        //         description: errorReport.error.message,
        //         priority: 'high',
        //         metadata: enhancedReport
        //     });
        // }

        res.status(201).json({
            success: true,
            message: 'Error report received successfully',
            reportId: errorReport.id,
            timestamp: enhancedReport.serverTimestamp
        });

    } catch (error: any) {
        logger.error('Failed to process error report', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            requestBody: req.body
        });

        res.status(500).json({
            success: false,
            message: 'Failed to process error report',
            timestamp: new Date().toISOString()
        });
    }
}));

// GET /api/error-reports/stats - Get error reporting statistics (admin only)
router.get('/stats', asyncErrorHandler(async (req: any, res: any) => {
    try {
        // Check if user has admin permissions
        if (req.user?.role !== 'Admin' && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to view error statistics'
            });
        }

        // In a real implementation, you would query your database for statistics
        const stats = {
            totalReports: 0,
            reportsLast24Hours: 0,
            reportsLast7Days: 0,
            reportsLast30Days: 0,
            errorsByType: {},
            errorsBySeverity: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            },
            topErrors: [],
            affectedUsers: 0,
            resolvedReports: 0,
            pendingReports: 0
        };

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        logger.error('Failed to get error statistics', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve error statistics',
            timestamp: new Date().toISOString()
        });
    }
}));

// POST /api/error-reports/batch - Submit multiple error reports
router.post('/batch', asyncErrorHandler(async (req: any, res: any) => {
    try {
        const errorReports: ErrorReport[] = req.body.reports;

        if (!Array.isArray(errorReports) || errorReports.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: reports array is required'
            });
        }

        if (errorReports.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Too many reports in batch (maximum 50 allowed)'
            });
        }

        const processedReports = [];
        const failedReports = [];

        for (const report of errorReports) {
            try {
                // Validate each report
                if (!report.id || !report.error || !report.timestamp) {
                    failedReports.push({
                        reportId: report.id || 'unknown',
                        error: 'Missing required fields'
                    });
                    continue;
                }

                // Add server-side metadata
                const enhancedReport = {
                    ...report,
                    serverTimestamp: new Date().toISOString(),
                    serverUserId: req.user?.id,
                    serverWorkplaceId: req.user?.workplaceId,
                    serverUserRole: req.user?.role,
                    serverRequestId: req.headers['x-request-id'],
                    serverIpAddress: req.ip,
                    serverUserAgent: req.get('User-Agent')
                };

                // Log the error report
                logger.error('Batch Client Error Report', {
                    reportId: report.id,
                    errorType: report.error.type,
                    errorMessage: report.error.message,
                    severity: report.error.severity,
                    userId: req.user?.id,
                    workplaceId: req.user?.workplaceId,
                    timestamp: report.timestamp,
                    serverTimestamp: enhancedReport.serverTimestamp
                });

                processedReports.push({
                    reportId: report.id,
                    status: 'processed',
                    timestamp: enhancedReport.serverTimestamp
                });

            } catch (reportError: any) {
                failedReports.push({
                    reportId: report.id || 'unknown',
                    error: reportError.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: `Processed ${processedReports.length} error reports`,
            processedReports,
            failedReports,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        logger.error('Failed to process batch error reports', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            reportsCount: req.body.reports?.length || 0
        });

        res.status(500).json({
            success: false,
            message: 'Failed to process batch error reports',
            timestamp: new Date().toISOString()
        });
    }
}));

// Error handling middleware
router.use(clinicalInterventionErrorHandler);

export default router;