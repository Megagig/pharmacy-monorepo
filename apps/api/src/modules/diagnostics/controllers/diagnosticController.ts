import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import {
    sendSuccess,
    sendError,
    respondWithPaginatedResults,
    asyncHandler,
    ensureResourceExists,
    checkTenantAccess,
    getRequestContext,
    createAuditLog,
} from '../../../utils/responseHelpers';

// Import services
import { DiagnosticService } from '../services/diagnosticService';
import { PharmacistReviewService } from '../services/pharmacistReviewService';

// Import models
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';
// Import legacy models for backward compatibility
import DiagnosticCase from '../../../models/DiagnosticCase';
import DiagnosticHistory from '../../../models/DiagnosticHistory';

const diagnosticService = new DiagnosticService();
const pharmacistReviewService = new PharmacistReviewService();

/**
 * Diagnostic Controller
 * Handles all diagnostic-related API endpoints
 */

// ===============================
// DIAGNOSTIC REQUEST OPERATIONS
// ===============================

/**
 * POST /api/diagnostics
 * Create new diagnostic request
 */
export const createDiagnosticRequest = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            patientId,
            locationId,
            inputSnapshot,
            priority = 'routine',
            consentObtained,
        } = req.body;

        // Validate consent
        if (!consentObtained) {
            return sendError(
                res,
                'BAD_REQUEST',
                'Patient consent is required for AI diagnostic processing',
                400
            );
        }

        try {
            // Create diagnostic request
            const diagnosticRequest = await diagnosticService.createDiagnosticRequest({
                patientId,
                pharmacistId: context.userId,
                workplaceId: context.workplaceId,
                locationId,
                inputSnapshot,
                priority,
                consentObtained,
            });

            // Start processing asynchronously (don't await)
            diagnosticService
                .processDiagnosticRequest(diagnosticRequest._id.toString())
                .catch((error) => {
                    logger.error('Async diagnostic processing failed:', {
                        requestId: diagnosticRequest._id,
                        error: error.message,
                    });
                });

            // Create audit log
            createAuditLog(
                'CREATE_DIAGNOSTIC_REQUEST',
                'DiagnosticRequest',
                diagnosticRequest._id.toString(),
                context,
                {
                    patientId,
                    priority,
                    symptomsCount: inputSnapshot.symptoms.subjective.length,
                }
            );

            logger.info('🚨🚨🚨 DIAGNOSTIC REQUEST CREATED SUCCESSFULLY 🚨🚨🚨');
            logger.info(`🚨 Request ID: ${diagnosticRequest._id}`);
            logger.info(`🚨 Request ID toString: ${diagnosticRequest._id.toString()}`);
            logger.info(`🚨 Request status: ${diagnosticRequest.status}`);

            sendSuccess(
                res,
                {
                    request: diagnosticRequest,
                    message: 'Diagnostic request created successfully. Processing will begin shortly.',
                },
                'Diagnostic request created successfully',
                201
            );
        } catch (error) {
            logger.error('Failed to create diagnostic request:', error);

            // Handle specific error types
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (errorMessage === 'ACTIVE_REQUEST_EXISTS') {
                return sendError(
                    res,
                    'CONFLICT',
                    'An active diagnostic request already exists for this patient. Please wait for the current request to complete before submitting a new one.',
                    409
                );
            }

            sendError(
                res,
                'SERVER_ERROR',
                `Failed to create diagnostic request: ${errorMessage}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/:id
 * Get diagnostic request and result with polling support
 */
export const getDiagnosticRequest = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic request ID is required', 400);
        }

        try {
            // Get diagnostic request
            const request = await diagnosticService.getDiagnosticRequest(
                id,
                context.workplaceId
            );

            if (!request) {
                return sendError(res, 'NOT_FOUND', 'Diagnostic request not found', 404);
            }

            // Check tenant access
            checkTenantAccess(
                request.workplaceId.toString(),
                context.workplaceId,
                context.isAdmin
            );

            // Get diagnostic result if available
            let result = null;
            if (request.status === 'completed') {
                result = await diagnosticService.getDiagnosticResult(
                    id,
                    context.workplaceId
                );
            }

            // Prepare response data
            const responseData = {
                request,
                result,
                status: request.status,
                processingTime: request.processingDuration,
                isActive: ['pending', 'processing'].includes(request.status),
                canRetry: request.status === 'failed' && request.retryCount < 3,
            };

            sendSuccess(
                res,
                responseData,
                'Diagnostic request retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get diagnostic request:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get diagnostic request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/diagnostics/:id/retry
 * Retry failed diagnostic request
 */
export const retryDiagnosticRequest = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic request ID is required', 400);
        }

        try {
            // Get diagnostic request to verify ownership
            const request = await DiagnosticRequest.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!request) {
                return sendError(res, 'NOT_FOUND', 'Diagnostic request not found', 404);
            }

            // Check if retry is allowed
            if (!request.canRetry()) {
                return sendError(
                    res,
                    'BAD_REQUEST',
                    'Request cannot be retried (maximum attempts exceeded or invalid status)',
                    400
                );
            }

            // Retry processing
            const result = await diagnosticService.retryDiagnosticRequest(id);

            // Create audit log
            createAuditLog(
                'RETRY_DIAGNOSTIC_REQUEST',
                'DiagnosticRequest',
                id,
                context,
                {
                    retryCount: request.retryCount + 1,
                    previousStatus: request.status,
                }
            );

            sendSuccess(
                res,
                {
                    request: result.request,
                    result: result.result,
                    processingTime: result.processingTime,
                },
                'Diagnostic request retried successfully'
            );
        } catch (error) {
            logger.error('Failed to retry diagnostic request:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to retry diagnostic request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * DELETE /api/diagnostics/:id
 * Cancel diagnostic request
 */
export const cancelDiagnosticRequest = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic request ID is required', 400);
        }

        try {
            // Get diagnostic request to verify ownership
            const request = await DiagnosticRequest.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!request) {
                return sendError(res, 'NOT_FOUND', 'Diagnostic request not found', 404);
            }

            // Check if cancellation is allowed
            if (!['pending', 'processing'].includes(request.status)) {
                return sendError(
                    res,
                    'BAD_REQUEST',
                    'Can only cancel pending or processing requests',
                    400
                );
            }

            // Cancel the request
            await diagnosticService.cancelDiagnosticRequest(id, context.workplaceId, context.userId);

            // Create audit log
            createAuditLog(
                'CANCEL_DIAGNOSTIC_REQUEST',
                'DiagnosticRequest',
                id,
                context,
                {
                    previousStatus: request.status,
                }
            );

            sendSuccess(res, {}, 'Diagnostic request cancelled successfully');
        } catch (error) {
            logger.error('Failed to cancel diagnostic request:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to cancel diagnostic request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

// ===============================
// DIAGNOSTIC HISTORY OPERATIONS
// ===============================

/**
 * GET /api/diagnostics/history/:patientId
 * Get patient diagnostic history with pagination
 */
export const getPatientDiagnosticHistory = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { patientId } = req.params;
        const { page = 1, limit = 20 } = req.query as any;
        const context = getRequestContext(req);

        // Parse pagination parameters
        const parsedPage = Math.max(1, parseInt(page as string) || 1);
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

        try {
            // Get patient diagnostic history
            if (!patientId) {
                return sendError(res, 'VALIDATION_ERROR', 'Patient ID is required', 400);
            }
            const history = await diagnosticService.getPatientDiagnosticHistory(
                patientId,
                context.workplaceId,
                parsedPage,
                parsedLimit
            );

            respondWithPaginatedResults(
                res,
                history.requests,
                history.total,
                history.page,
                parsedLimit,
                `Found ${history.total} diagnostic requests for patient`
            );
        } catch (error) {
            logger.error('Failed to get patient diagnostic history:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get patient diagnostic history: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/dashboard
 * Get diagnostic dashboard data
 */
export const getDiagnosticDashboard = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Build query filter - super admins can see all workplaces
            const workplaceFilter = context.userRole === 'super_admin' 
                ? {} 
                : { workplaceId: new Types.ObjectId(context.workplaceId) };

            // Get dashboard statistics
            const [
                totalRequests,
                pendingRequests,
                processingRequests,
                completedRequests,
                failedRequests,
                pendingReviews,
                recentRequests,
            ] = await Promise.all([
                DiagnosticRequest.countDocuments({
                    ...workplaceFilter,
                    isDeleted: false,
                }),
                DiagnosticRequest.countDocuments({
                    ...workplaceFilter,
                    status: 'pending',
                    isDeleted: false,
                }),
                DiagnosticRequest.countDocuments({
                    ...workplaceFilter,
                    status: 'processing',
                    isDeleted: false,
                }),
                DiagnosticRequest.countDocuments({
                    ...workplaceFilter,
                    status: 'completed',
                    isDeleted: false,
                }),
                DiagnosticRequest.countDocuments({
                    ...workplaceFilter,
                    status: 'failed',
                    isDeleted: false,
                }),
                DiagnosticResult.countDocuments({
                    ...workplaceFilter,
                    pharmacistReview: { $exists: false },
                    isDeleted: false,
                }),
                DiagnosticRequest.find({
                    ...workplaceFilter,
                    isDeleted: false,
                })
                    .populate('patientId', 'firstName lastName')
                    .populate('pharmacistId', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean(),
            ]);

            // Calculate average confidence score
            const confidenceMatchFilter = context.userRole === 'super_admin' 
                ? { 'request.isDeleted': false, confidenceScore: { $exists: true, $ne: null } }
                : { 'request.workplaceId': new Types.ObjectId(context.workplaceId), 'request.isDeleted': false, confidenceScore: { $exists: true, $ne: null } };

            const avgConfidenceResult = await DiagnosticResult.aggregate([
                {
                    $lookup: {
                        from: 'diagnosticrequests',
                        localField: 'requestId',
                        foreignField: '_id',
                        as: 'request'
                    }
                },
                {
                    $match: confidenceMatchFilter
                },
                {
                    $group: {
                        _id: null,
                        avgConfidence: { $avg: '$confidenceScore' }
                    }
                }
            ]);

            const averageConfidence = avgConfidenceResult.length > 0 
                ? Math.round(avgConfidenceResult[0].avgConfidence * 100) 
                : 0;

            // Count referrals generated
            const referralsGenerated = await DiagnosticResult.countDocuments({
                ...workplaceFilter,
                'referralRecommendation.recommended': true,
                isDeleted: false,
            });

            // Format recent requests to include caseId
            const formattedRecentRequests = recentRequests.map((request: any) => ({
                ...request,
                caseId: request._id.toString(), // Add caseId field using _id
            }));

            const dashboardData = {
                summary: {
                    totalCases: totalRequests,
                    completedCases: completedRequests,
                    pendingFollowUps: pendingRequests + processingRequests,
                    averageConfidence,
                    referralsGenerated,
                },
                statistics: {
                    total: totalRequests,
                    pending: pendingRequests,
                    processing: processingRequests,
                    completed: completedRequests,
                    failed: failedRequests,
                    pendingReviews,
                },
                recentRequests: formattedRecentRequests,
                alerts: {
                    hasFailedRequests: failedRequests > 0,
                    hasPendingReviews: pendingReviews > 0,
                    hasStuckProcessing: processingRequests > 0,
                },
            };

            sendSuccess(
                res,
                dashboardData,
                'Diagnostic dashboard data retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get diagnostic dashboard:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get diagnostic dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

// ===============================
// PHARMACIST REVIEW OPERATIONS
// ===============================

/**
 * POST /api/diagnostics/:id/approve
 * Approve diagnostic result
 */
export const approveDiagnosticResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { modifications, reviewNotes, clinicalJustification } = req.body;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic request ID is required', 400);
        }

        try {
            // Submit review decision
            const result = await pharmacistReviewService.submitReviewDecision(id, {
                status: modifications ? 'modified' : 'approved',
                modifications,
                reviewNotes,
                clinicalJustification,
                reviewedBy: context.userId,
                workplaceId: context.workplaceId,
            });

            // Create audit log
            createAuditLog(
                'APPROVE_DIAGNOSTIC_RESULT',
                'DiagnosticResult',
                id,
                context,
                {
                    hasModifications: !!modifications,
                    confidenceScore: result.aiMetadata.confidenceScore,
                }
            );

            sendSuccess(
                res,
                {
                    result,
                    approved: true,
                    modified: !!modifications,
                },
                'Diagnostic result approved successfully'
            );
        } catch (error) {
            logger.error('Failed to approve diagnostic result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to approve diagnostic result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/diagnostics/:id/reject
 * Reject diagnostic result
 */
export const rejectDiagnosticResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { rejectionReason, reviewNotes, clinicalJustification } = req.body;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic request ID is required', 400);
        }

        // Validate rejection reason
        if (!rejectionReason || rejectionReason.trim().length === 0) {
            return sendError(
                res,
                'BAD_REQUEST',
                'Rejection reason is required',
                400
            );
        }

        try {
            // Submit review decision
            const result = await pharmacistReviewService.submitReviewDecision(id, {
                status: 'rejected',
                rejectionReason,
                reviewNotes,
                clinicalJustification,
                reviewedBy: context.userId,
                workplaceId: context.workplaceId,
            });

            // Create audit log
            createAuditLog(
                'REJECT_DIAGNOSTIC_RESULT',
                'DiagnosticResult',
                id,
                context,
                {
                    rejectionReason: rejectionReason.substring(0, 100), // Truncate for logging
                    confidenceScore: result.aiMetadata.confidenceScore,
                }
            );

            sendSuccess(
                res,
                {
                    result,
                    rejected: true,
                },
                'Diagnostic result rejected successfully'
            );
        } catch (error) {
            logger.error('Failed to reject diagnostic result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to reject diagnostic result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/pending-reviews
 * Get pending diagnostic results for review
 */
export const getPendingReviews = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const {
            page = 1,
            limit = 20,
            priority,
            confidenceMin,
            confidenceMax,
            hasRedFlags,
            orderBy = 'oldest',
        } = req.query as any;
        const context = getRequestContext(req);

        // Parse pagination parameters
        const parsedPage = Math.max(1, parseInt(page as string) || 1);
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

        // Build filters
        const filters: any = {};
        if (priority) filters.priority = priority;
        if (confidenceMin !== undefined || confidenceMax !== undefined) {
            filters.confidenceRange = {
                min: parseFloat(confidenceMin) || 0,
                max: parseFloat(confidenceMax) || 1,
            };
        }
        if (hasRedFlags !== undefined) {
            filters.hasRedFlags = hasRedFlags === 'true';
        }
        if (orderBy) filters.orderBy = orderBy;

        try {
            // Get pending reviews
            const reviews = await pharmacistReviewService.getPendingReviews(
                context.workplaceId,
                parsedPage,
                parsedLimit,
                filters
            );

            respondWithPaginatedResults(
                res,
                reviews.results,
                reviews.total,
                reviews.page,
                parsedLimit,
                `Found ${reviews.total} pending reviews`
            );
        } catch (error) {
            logger.error('Failed to get pending reviews:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get pending reviews: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/diagnostics/:id/create-intervention
 * Create clinical intervention from approved diagnostic result
 */
export const createInterventionFromResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const interventionData = req.body;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Diagnostic result ID is required', 400);
        }

        try {
            // Create intervention
            const intervention = await pharmacistReviewService.createInterventionFromResult(
                id,
                interventionData,
                context.userId,
                context.workplaceId
            );

            // Create audit log
            createAuditLog(
                'CREATE_INTERVENTION_FROM_DIAGNOSTIC',
                'ClinicalIntervention',
                intervention._id.toString(),
                context,
                {
                    diagnosticResultId: id,
                    interventionType: interventionData.type,
                    priority: interventionData.priority,
                }
            );

            sendSuccess(
                res,
                {
                    intervention,
                },
                'Clinical intervention created successfully',
                201
            );
        } catch (error) {
            logger.error('Failed to create intervention from diagnostic result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to create intervention: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/review-workflow-status
 * Get review workflow status for workplace
 */
export const getReviewWorkflowStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Get workflow status
            const status = await pharmacistReviewService.getReviewWorkflowStatus(
                context.workplaceId
            );

            sendSuccess(
                res,
                status,
                'Review workflow status retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get review workflow status:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get review workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/analytics
 * Get diagnostic analytics for workplace
 */
export const getDiagnosticAnalytics = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { from, to, dateFrom, dateTo } = req.query as any;
        const context = getRequestContext(req);

        // Support both 'from/to' and 'dateFrom/dateTo' query params for backwards compatibility
        const fromDate = from || dateFrom
            ? new Date(from || dateFrom)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to || dateTo
            ? new Date(to || dateTo)
            : new Date();

        try {
            // Query DiagnosticRequest collection for analytics (updated to use new model)
            // Super admins can see data across all workplaces
            const matchStage = context.userRole === 'super_admin' 
                ? {
                    createdAt: {
                        $gte: fromDate,
                        $lte: toDate,
                    },
                    isDeleted: { $ne: true },
                }
                : {
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    createdAt: {
                        $gte: fromDate,
                        $lte: toDate,
                    },
                    isDeleted: { $ne: true },
                };

            console.log('🔍 Analytics query:', { matchStage, fromDate, toDate, userRole: context.userRole });

            // Get basic counts and averages
            const [
                totalCases,
                completedCases,
                pendingFollowUps,
                avgMetrics,
                topDiagnoses,
                completionTrends,
                referralsCount
            ] = await Promise.all([
                DiagnosticRequest.countDocuments(matchStage),
                DiagnosticRequest.countDocuments({ ...matchStage, status: 'completed' }),
                DiagnosticRequest.countDocuments({ ...matchStage, status: { $in: ['pending', 'processing'] } }),
                // Get average confidence from DiagnosticResult collection
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    {
                        $match: context.userRole === 'super_admin' 
                            ? {
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                confidenceScore: { $exists: true, $ne: null }
                            }
                            : {
                                'request.workplaceId': new Types.ObjectId(context.workplaceId),
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                confidenceScore: { $exists: true, $ne: null }
                            }
                    },
                    {
                        $group: {
                            _id: null,
                            avgConfidence: { $avg: '$confidenceScore' },
                            avgProcessingTime: { $avg: '$processingDuration' },
                        },
                    },
                ]),
                // Get top diagnoses from DiagnosticResult collection
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    {
                        $match: context.userRole === 'super_admin' 
                            ? {
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                'differentialDiagnoses': { $exists: true, $ne: [] }
                            }
                            : {
                                'request.workplaceId': new Types.ObjectId(context.workplaceId),
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                'differentialDiagnoses': { $exists: true, $ne: [] }
                            }
                    },
                    { $unwind: '$differentialDiagnoses' },
                    {
                        $group: {
                            _id: '$differentialDiagnoses.condition',
                            count: { $sum: 1 },
                            averageConfidence: { $avg: '$differentialDiagnoses.probability' },
                        },
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                    {
                        $project: {
                            _id: 0,
                            condition: '$_id',
                            count: 1,
                            averageConfidence: { $multiply: ['$averageConfidence', 100] },
                        },
                    },
                ]),
                // Get completion trends (group by day) from DiagnosticRequest
                DiagnosticRequest.aggregate([
                    { $match: matchStage },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$createdAt',
                                },
                            },
                            casesCreated: { $sum: 1 },
                            casesCompleted: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
                                },
                            },
                        },
                    },
                    { $sort: { _id: 1 } },
                ]),
                // Count referrals from DiagnosticResult collection
                DiagnosticResult.aggregate([
                    {
                        $lookup: {
                            from: 'diagnosticrequests',
                            localField: 'requestId',
                            foreignField: '_id',
                            as: 'request'
                        }
                    },
                    {
                        $match: context.userRole === 'super_admin' 
                            ? {
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                'referralRecommendation.recommended': true
                            }
                            : {
                                'request.workplaceId': new Types.ObjectId(context.workplaceId),
                                'request.createdAt': { $gte: fromDate, $lte: toDate },
                                'request.isDeleted': { $ne: true },
                                'referralRecommendation.recommended': true
                            }
                    },
                    {
                        $count: 'referralsCount'
                    }
                ]).then(result => result.length > 0 ? result[0].referralsCount : 0),
            ]);

            const analytics = {
                summary: {
                    totalCases,
                    averageConfidence: avgMetrics.length > 0 ? avgMetrics[0].avgConfidence || 0 : 0,
                    averageProcessingTime: avgMetrics.length > 0 ? avgMetrics[0].avgProcessingTime || 0 : 0,
                    completedCases,
                    pendingFollowUps,
                    referralsGenerated: referralsCount,
                },
                topDiagnoses,
                completionTrends,
                dateRange: { from: fromDate, to: toDate },
            };

            sendSuccess(
                res,
                analytics,
                'Diagnostic analytics retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get diagnostic analytics:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get diagnostic analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/cases/all
 * Get all diagnostic cases with pagination and filters
 */
export const getAllDiagnosticCases = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            page = 1,
            limit = 20,
            status,
            patientId,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query as any;

        try {
            // Build query - super admins can see all workplaces
            const query: any = context.userRole === 'super_admin' 
                ? {}
                : { workplaceId: new Types.ObjectId(context.workplaceId) };

            if (status) {
                query.status = status;
            }

            if (patientId) {
                query.patientId = new Types.ObjectId(patientId);
            }

            if (search) {
                query.$or = [
                    { caseId: { $regex: search, $options: 'i' } },
                    { 'inputSnapshot.symptoms.subjective': { $regex: search, $options: 'i' } },
                    { 'inputSnapshot.symptoms.objective': { $regex: search, $options: 'i' } },
                ];
            }

            // Get paginated results
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortOptions: any = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const [cases, totalCases] = await Promise.all([
                DiagnosticRequest.find(query)
                    .populate('patientId', 'firstName lastName dateOfBirth gender')
                    .populate('pharmacistId', 'firstName lastName')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                DiagnosticRequest.countDocuments(query),
            ]);

            // Format cases
            const formattedCases = cases.map((caseItem: any) => ({
                _id: caseItem._id,
                caseId: caseItem._id.toString(), // Use _id as caseId since there's no separate caseId field
                patientId: caseItem.patientId,
                pharmacistId: caseItem.pharmacistId,
                symptoms: caseItem.inputSnapshot?.symptoms || {},
                status: caseItem.status,
                createdAt: caseItem.createdAt,
                updatedAt: caseItem.updatedAt,
            }));

            sendSuccess(
                res,
                {
                    cases: formattedCases,
                    pagination: {
                        current: parseInt(page),
                        total: Math.ceil(totalCases / parseInt(limit)),
                        count: formattedCases.length,
                        totalCases,
                    },
                    filters: {
                        status,
                        patientId,
                        search,
                        sortBy,
                        sortOrder,
                    },
                },
                'Diagnostic cases retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get diagnostic cases:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get diagnostic cases: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/diagnostics/referrals
 * Get all diagnostic referrals with pagination and filters
 */
export const getDiagnosticReferrals = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            page = 1,
            limit = 20,
            status,
            specialty,
        } = req.query as any;

        try {
            // Build query for diagnostic history with referral recommendations
            const query: any = {
                workplaceId: new Types.ObjectId(context.workplaceId),
                'referral.generated': true,  // Changed to match DiagnosticHistory schema
            };

            if (status) {
                query['referral.status'] = status;
            }

            if (specialty) {
                query['referral.specialty'] = specialty;  // Changed to match DiagnosticHistory schema
            }

            // Get paginated results
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [results, totalReferrals] = await Promise.all([
                DiagnosticHistory.find(query)
                    .populate('patientId', 'firstName lastName age gender')
                    .populate('pharmacistId', 'firstName lastName')
                    .populate('diagnosticCaseId', 'caseId status')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                DiagnosticHistory.countDocuments(query),
            ]);

            // Count statistics
            const statistics = {
                pending: await DiagnosticHistory.countDocuments({
                    ...query,
                    'referral.status': 'pending',
                }),
                sent: await DiagnosticHistory.countDocuments({
                    ...query,
                    'referral.status': 'sent',
                }),
                acknowledged: await DiagnosticHistory.countDocuments({
                    ...query,
                    'referral.status': 'acknowledged',
                }),
                completed: await DiagnosticHistory.countDocuments({
                    ...query,
                    'referral.status': 'completed',
                }),
            };

            // Format referrals
            const formattedReferrals = results.map((result: any) => ({
                _id: result._id,
                patientId: result.patientId,
                pharmacistId: result.pharmacistId,
                caseId: result.caseId || (result.diagnosticCaseId?.caseId),
                referral: {
                    generated: result.referral?.generated || false,
                    generatedAt: result.referral?.generatedAt,
                    specialty: result.referral?.specialty || result.analysisSnapshot?.referralRecommendation?.specialty,
                    urgency: result.referral?.urgency || result.analysisSnapshot?.referralRecommendation?.urgency,
                    status: result.referral?.status || 'pending',
                    sentAt: result.referral?.sentAt,
                    acknowledgedAt: result.referral?.acknowledgedAt,
                    completedAt: result.referral?.completedAt,
                    feedback: result.referral?.feedback,
                },
                analysisSnapshot: {
                    referralRecommendation: result.analysisSnapshot?.referralRecommendation,
                },
                createdAt: result.createdAt,
            }));

            sendSuccess(
                res,
                {
                    referrals: formattedReferrals,
                    pagination: {
                        current: parseInt(page),
                        total: Math.ceil(totalReferrals / parseInt(limit)),
                        count: formattedReferrals.length,
                        totalReferrals,
                    },
                    statistics,
                    filters: {
                        status,
                        specialty,
                    },
                },
                'Diagnostic referrals retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get diagnostic referrals:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get diagnostic referrals: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/diagnostics/patient/validate
 * Validate patient access before submitting diagnostic case
 */
export const validatePatientAccess = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { patientId } = req.body;

        if (!patientId) {
            return sendError(res, 'BAD_REQUEST', 'Patient ID is required', 400);
        }

        try {
            // Import Patient model
            const Patient = require('../../../models/Patient').default;

            // Super admin can access patients from ANY workplace (cross-workplace access)
            let patientQuery: any = { _id: patientId };

            // Regular users must be in the same workplace
            if (req.user?.role !== 'super_admin') {
                patientQuery.workplaceId = context.workplaceId;
            }

            // Check if patient exists and (for non-super-admins) belongs to the same workplace
            const patient = await Patient.findOne(patientQuery)
                .select('firstName lastName mrn workplaceId')
                .populate('workplaceId', 'name');

            if (!patient) {
                return sendError(
                    res,
                    'NOT_FOUND',
                    'Patient not found or you do not have access to this patient',
                    404
                );
            }

            // Log super admin cross-workplace access for audit
            if (req.user?.role === 'super_admin' && patient.workplaceId?.toString() !== context.workplaceId) {
                logger.info('Super admin cross-workplace patient access', {
                    superAdminId: context.userId,
                    superAdminWorkplace: context.workplaceId,
                    patientId: patient._id,
                    patientWorkplace: patient.workplaceId,
                });
            }

            sendSuccess(
                res,
                {
                    hasAccess: true,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    mrn: patient.mrn,
                    workplaceName: (patient.workplaceId as any)?.name || 'Unknown',
                },
                'Patient access validated successfully'
            );
        } catch (error) {
            logger.error('Failed to validate patient access:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to validate patient access: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);