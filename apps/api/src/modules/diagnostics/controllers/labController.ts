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
import labService from '../services/labService';

// Import models
import LabOrder from '../models/LabOrder';
import LabResult, { ILabResult } from '../models/LabResult';

/**
 * Lab Management Controller
 * Handles all lab-related API endpoints
 */

// ===============================
// LAB ORDER OPERATIONS
// ===============================

/**
 * POST /api/lab/orders
 * Create new lab order
 */
export const createLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            patientId,
            tests,
            priority = 'routine',
            expectedDate,
            externalOrderId,
        } = req.body;

        try {
            // Create lab order
            const labOrder = await labService.createLabOrder({
                patientId: patientId.toString(),
                orderedBy: context.userId.toString(),
                workplaceId: context.workplaceId.toString(),
                tests: tests.map((test: any) => ({
                    ...test,
                    indication: test.indication || '', // Ensure indication is present
                })),
                expectedDate: expectedDate ? new Date(expectedDate) : undefined,
                externalOrderId,
            });

            // Create audit log
            console.log(
                'Lab order created:',
                createAuditLog(
                    'CREATE_LAB_ORDER',
                    'LabOrder',
                    labOrder._id.toString(),
                    context,
                    {
                        patientId,
                        testsCount: tests.length,
                        priority,
                        indication: tests[0]?.indication?.substring(0, 100) || '', // Get indication from first test
                    }
                )
            );

            sendSuccess(
                res,
                {
                    order: labOrder,
                },
                'Lab order created successfully',
                201
            );
        } catch (error) {
            logger.error('Failed to create lab order:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to create lab order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/orders
 * Get lab orders with filtering and pagination
 */
export const getLabOrders = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const {
            page = 1,
            limit = 20,
            patientId,
            status,
            priority,
            orderedBy,
            fromDate,
            toDate,
        } = req.query as any;
        const context = getRequestContext(req);

        // Parse pagination parameters
        const parsedPage = Math.max(1, parseInt(page as string) || 1);
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

        try {
            // Build filters
            const filters: any = {
                workplaceId: context.workplaceId.toString(),
            };

            if (patientId) filters.patientId = patientId.toString();
            if (status) filters.status = status;
            if (priority) filters.priority = priority;
            if (orderedBy) filters.orderedBy = orderedBy.toString();

            if (fromDate || toDate) {
                filters.orderDate = {};
                if (fromDate) filters.orderDate.$gte = new Date(fromDate);
                if (toDate) filters.orderDate.$lte = new Date(toDate);
            }

            // Get lab orders
            const orders = await labService.getLabOrders(
                context.workplaceId.toString(),
                filters,
                parsedPage,
                parsedLimit
            );

            respondWithPaginatedResults(
                res,
                orders.orders,
                orders.total,
                orders.page,
                parsedLimit,
                `Found ${orders.total} lab orders`
            );
        } catch (error) {
            logger.error('Failed to get lab orders:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/orders/:id
 * Get lab order details
 */
export const getLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab order ID is required', 400);
        }

        try {
            // Get lab order
            const order = await LabOrder.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            })
                .populate('patientId', 'firstName lastName dateOfBirth')
                .populate('orderedBy', 'firstName lastName')
                .lean();

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Lab order not found', 404);
            }

            // Get associated lab results
            const results = await LabResult.find({
                orderId: order._id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            }).lean();

            sendSuccess(
                res,
                {
                    order,
                    results,
                    resultsCount: results.length,
                    completedTests: results.length,
                    totalTests: order.tests.length,
                    isComplete: results.length === order.tests.length,
                },
                'Lab order retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get lab order:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * PATCH /api/lab/orders/:id
 * Update lab order
 */
export const updateLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);
        const updates = req.body;

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab order ID is required', 400);
        }

        try {
            // Get lab order
            const order = await LabOrder.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Lab order not found', 404);
            }

            // Check if order can be updated
            if (order.status === 'completed') {
                return sendError(
                    res,
                    'BAD_REQUEST',
                    'Cannot update completed lab order',
                    400
                );
            }

            // Update lab order
            const updatedOrder = await labService.updateLabOrder(id, updates, context.userId.toString());

            // Create audit log
            console.log(
                'Lab order updated:',
                createAuditLog(
                    'UPDATE_LAB_ORDER',
                    'LabOrder',
                    id,
                    context,
                    {
                        updates: Object.keys(updates),
                        previousStatus: order.status,
                        newStatus: updatedOrder.status,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    order: updatedOrder,
                },
                'Lab order updated successfully'
            );
        } catch (error) {
            logger.error('Failed to update lab order:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to update lab order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * DELETE /api/lab/orders/:id
 * Cancel lab order
 */
export const cancelLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab order ID is required', 400);
        }

        try {
            // Get lab order
            const order = await LabOrder.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Lab order not found', 404);
            }

            // Check if order can be cancelled
            if (['completed', 'cancelled'].includes(order.status)) {
                return sendError(
                    res,
                    'BAD_REQUEST',
                    `Cannot cancel ${order.status} lab order`,
                    400
                );
            }

            // Cancel lab order
            await labService.cancelLabOrder(id, context.userId.toString());

            // Create audit log
            console.log(
                'Lab order cancelled:',
                createAuditLog(
                    'CANCEL_LAB_ORDER',
                    'LabOrder',
                    id,
                    context,
                    {
                        previousStatus: order.status,
                        testsCount: order.tests.length,
                    }
                )
            );

            sendSuccess(res, {}, 'Lab order cancelled successfully');
        } catch (error) {
            logger.error('Failed to cancel lab order:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to cancel lab order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

// ===============================
// LAB RESULT OPERATIONS
// ===============================

/**
 * POST /api/lab/results
 * Add lab result
 */
export const addLabResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            orderId,
            patientId,
            testCode,
            testName,
            value,
            unit,
            referenceRange,
            interpretation,
            flags,
            performedAt,
            externalResultId,
            loincCode,
        } = req.body;

        if (!patientId) {
            return sendError(res, 'VALIDATION_ERROR', 'Patient ID is required', 400);
        }
        if (!testCode) {
            return sendError(res, 'VALIDATION_ERROR', 'Test code is required', 400);
        }
        if (!testName) {
            return sendError(res, 'VALIDATION_ERROR', 'Test name is required', 400);
        }
        if (!value) {
            return sendError(res, 'VALIDATION_ERROR', 'Value is required', 400);
        }
        if (!referenceRange) {
            return sendError(res, 'VALIDATION_ERROR', 'Reference range is required', 400);
        }
        if (!interpretation) {
            return sendError(res, 'VALIDATION_ERROR', 'Interpretation is required', 400);
        }

        try {
            // Create lab result
            const labResult = await labService.addLabResult({
                orderId: orderId ? orderId.toString() : undefined,
                patientId: patientId.toString(),
                workplaceId: context.workplaceId.toString(),
                testCode,
                testName,
                value,
                unit,
                referenceRange,
                source: 'manual',
                performedAt: performedAt ? new Date(performedAt) : new Date(),
                recordedBy: context.userId.toString(),
                externalResultId,
                loincCode,
            });

            // Validate result
            const validation = await labService.validateResult(labResult);

            // Create audit log
            console.log(
                'Lab result added:',
                createAuditLog(
                    'ADD_LAB_RESULT',
                    'LabResult',
                    labResult._id.toString(),
                    context,
                    {
                        patientId,
                        testCode,
                        testName,
                        interpretation,
                        isAbnormal: interpretation !== 'normal',
                        orderId,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    result: labResult,
                    validation,
                },
                'Lab result added successfully',
                201
            );
        } catch (error) {
            logger.error('Failed to add lab result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to add lab result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/results
 * Get lab results with filtering and pagination
 */
export const getLabResults = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const {
            page = 1,
            limit = 20,
            patientId,
            orderId,
            testCode,
            interpretation,
            fromDate,
            toDate,
        } = req.query as any;
        const context = getRequestContext(req);

        // Parse pagination parameters
        const parsedPage = Math.max(1, parseInt(page as string) || 1);
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

        try {
            // Build filters
            const filters: any = {
                workplaceId: context.workplaceId.toString(),
            };

            if (patientId) filters.patientId = patientId.toString();
            if (orderId) filters.orderId = orderId.toString();
            if (testCode) filters.testCode = testCode;
            if (interpretation) filters.interpretation = interpretation;

            if (fromDate || toDate) {
                filters.performedAt = {};
                if (fromDate) filters.performedAt.$gte = new Date(fromDate);
                if (toDate) filters.performedAt.$lte = new Date(toDate);
            }

            // Get lab results
            const results = await labService.getLabResults(
                context.workplaceId.toString(),
                filters,
                parsedPage,
                parsedLimit
            );

            respondWithPaginatedResults(
                res,
                results.results,
                results.total,
                results.page,
                parsedLimit,
                `Found ${results.total} lab results`
            );
        } catch (error) {
            logger.error('Failed to get lab results:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab results: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/results/:id
 * Get lab result details
 */
export const getLabResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab result ID is required', 400);
        }

        try {
            // Get lab result
            const result = await LabResult.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            })
                .populate('patientId', 'firstName lastName dateOfBirth')
                .populate('recordedBy', 'firstName lastName')
                .populate('orderId')
                .lean() as any;

            if (!result) {
                return sendError(res, 'NOT_FOUND', 'Lab result not found', 404);
            }

            // Get validation details
            const validation = await labService.validateResult(result as ILabResult);

            // Get trend data if available
            let trends = null;
            if (result.patientId && result.testCode) {
                try {
                    trends = await labService.getResultTrends(
                        result.patientId.toString(),
                        result.testCode,
                        context.workplaceId.toString()
                    );
                } catch (error) {
                    logger.warn('Failed to get result trends:', error);
                }
            }

            sendSuccess(
                res,
                {
                    result,
                    validation,
                    trends,
                },
                'Lab result retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get lab result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * PATCH /api/lab/results/:id
 * Update lab result
 */
export const updateLabResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);
        const updates = req.body;

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab result ID is required', 400);
        }

        try {
            // Get lab result
            const result = await LabResult.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!result) {
                return sendError(res, 'NOT_FOUND', 'Lab result not found', 404);
            }

            // Update lab result
            const updatedResult = await labService.updateLabResult(id, updates, context.userId.toString());

            // Validate updated result
            const validation = await labService.validateResult(updatedResult);

            // Create audit log
            console.log(
                'Lab result updated:',
                createAuditLog(
                    'UPDATE_LAB_RESULT',
                    'LabResult',
                    id,
                    context,
                    {
                        updates: Object.keys(updates),
                        testCode: result.testCode,
                        testName: result.testName,
                        previousValue: result.value,
                        newValue: updatedResult.value,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    result: updatedResult,
                    validation,
                },
                'Lab result updated successfully'
            );
        } catch (error) {
            logger.error('Failed to update lab result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to update lab result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * DELETE /api/lab/results/:id
 * Delete lab result
 */
export const deleteLabResult = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        if (!id) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab result ID is required', 400);
        }

        try {
            // Get lab result
            const result = await LabResult.findOne({
                _id: id,
                workplaceId: new Types.ObjectId(context.workplaceId),
                isDeleted: false,
            });

            if (!result) {
                return sendError(res, 'NOT_FOUND', 'Lab result not found', 404);
            }

            // Soft delete lab result
            result.isDeleted = true;
            result.updatedBy = new Types.ObjectId(context.userId);
            await result.save();

            // Create audit log
            console.log(
                'Lab result deleted:',
                createAuditLog(
                    'DELETE_LAB_RESULT',
                    'LabResult',
                    id,
                    context,
                    {
                        testCode: result.testCode,
                        testName: result.testName,
                        value: result.value,
                        patientId: result.patientId.toString(),
                    }
                )
            );

            sendSuccess(res, {}, 'Lab result deleted successfully');
        } catch (error) {
            logger.error('Failed to delete lab result:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to delete lab result: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

// ===============================
// LAB ANALYTICS AND TRENDS
// ===============================

/**
 * GET /api/lab/trends/:patientId/:testCode
 * Get lab result trends for a patient and test
 */
export const getLabResultTrends = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { patientId, testCode } = req.params;
        const { months = 12 } = req.query as any;
        const context = getRequestContext(req);

        if (!patientId) {
            return sendError(res, 'VALIDATION_ERROR', 'Patient ID is required', 400);
        }
        if (!testCode) {
            return sendError(res, 'VALIDATION_ERROR', 'Test code is required', 400);
        }

        try {
            // Get result trends
            const trends = await labService.getResultTrends(
                patientId.toString(),
                testCode,
                context.workplaceId.toString(),
                parseInt(months)
            );

            sendSuccess(
                res,
                {
                    trends,
                    patientId,
                    testCode,
                    monthsAnalyzed: parseInt(months),
                },
                'Lab result trends retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get lab result trends:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab result trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/dashboard
 * Get lab dashboard data
 */
export const getLabDashboard = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Get dashboard statistics
            const [
                totalOrders,
                pendingOrders,
                completedOrders,
                totalResults,
                abnormalResults,
                recentOrders,
                recentResults,
            ] = await Promise.all([
                LabOrder.countDocuments({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    isDeleted: false,
                }),
                LabOrder.countDocuments({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    status: { $in: ['ordered', 'collected', 'processing'] },
                    isDeleted: false,
                }),
                LabOrder.countDocuments({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    status: 'completed',
                    isDeleted: false,
                }),
                LabResult.countDocuments({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    isDeleted: false,
                }),
                LabResult.countDocuments({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    interpretation: { $ne: 'normal' },
                    isDeleted: false,
                }),
                LabOrder.find({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    isDeleted: false,
                })
                    .populate('patientId', 'firstName lastName')
                    .populate('orderedBy', 'firstName lastName')
                    .sort({ orderDate: -1 })
                    .limit(10)
                    .lean(),
                LabResult.find({
                    workplaceId: new Types.ObjectId(context.workplaceId),
                    isDeleted: false,
                })
                    .populate('patientId', 'firstName lastName')
                    .populate('recordedBy', 'firstName lastName')
                    .sort({ performedAt: -1 })
                    .limit(10)
                    .lean(),
            ]);

            const dashboardData = {
                statistics: {
                    orders: {
                        total: totalOrders,
                        pending: pendingOrders,
                        completed: completedOrders,
                        completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
                    },
                    results: {
                        total: totalResults,
                        abnormal: abnormalResults,
                        abnormalRate: totalResults > 0 ? (abnormalResults / totalResults) * 100 : 0,
                    },
                },
                recentActivity: {
                    orders: recentOrders,
                    results: recentResults,
                },
                alerts: {
                    hasPendingOrders: pendingOrders > 0,
                    hasAbnormalResults: abnormalResults > 0,
                    highAbnormalRate: totalResults > 0 && (abnormalResults / totalResults) > 0.3,
                },
            };

            sendSuccess(
                res,
                dashboardData,
                'Lab dashboard data retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get lab dashboard:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get lab dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

// ===============================
// FHIR INTEGRATION
// ===============================

/**
 * POST /api/lab/import/fhir
 * Import lab results from FHIR bundle
 */
export const importFHIRResults = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { fhirBundle, patientMapping } = req.body;

        try {
            // Import FHIR results
            const importResult = await labService.importFHIRResults(
                fhirBundle,
                patientMapping,
                context.workplaceId,
                context.userId
            );

            // Create audit log
            console.log(
                'FHIR lab results imported:',
                createAuditLog(
                    'IMPORT_FHIR_LAB_RESULTS',
                    'LabResult',
                    'bulk_import',
                    context,
                    {
                        importedCount: importResult.imported.length,
                        failedCount: importResult.failed.length,
                        bundleId: fhirBundle.id,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    imported: importResult.imported,
                    failed: importResult.failed,
                    summary: {
                        totalProcessed: importResult.imported.length + importResult.failed.length,
                        successCount: importResult.imported.length,
                        failureCount: importResult.failed.length,
                        successRate: importResult.imported.length / (importResult.imported.length + importResult.failed.length) * 100,
                    },
                },
                'FHIR lab results imported successfully',
                201
            );
        } catch (error) {
            logger.error('Failed to import FHIR lab results:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to import FHIR lab results: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/lab/export/fhir/:orderId
 * Export lab order to FHIR format
 */
export const exportLabOrderToFHIR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Lab order ID is required', 400);
        }

        try {
            // Export lab order to FHIR
            const fhirServiceRequest = await labService.exportLabOrderToFHIR(
                orderId,
                context.workplaceId.toString()
            );

            // Create audit log
            console.log(
                'Lab order exported to FHIR:',
                createAuditLog(
                    'EXPORT_LAB_ORDER_FHIR',
                    'LabOrder',
                    orderId,
                    context,
                    {
                        fhirId: fhirServiceRequest.id,
                        resourceType: fhirServiceRequest.resourceType,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    fhirResource: fhirServiceRequest,
                    resourceType: 'ServiceRequest',
                    fhirVersion: 'R4',
                },
                'Lab order exported to FHIR format successfully'
            );
        } catch (error) {
            logger.error('Failed to export lab order to FHIR:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to export lab order to FHIR: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/lab/sync/fhir/:patientId
 * Sync lab results from external FHIR server
 */
export const syncLabResultsFromFHIR = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { patientId } = req.params;
        const { fromDate, toDate } = req.body;
        const context = getRequestContext(req);

        if (!patientId) {
            return sendError(res, 'VALIDATION_ERROR', 'Patient ID is required', 400);
        }

        try {
            // Sync lab results from FHIR
            const syncResult = await labService.syncLabResultsFromFHIR(
                patientId.toString(),
                context.workplaceId.toString(),
                fromDate ? new Date(fromDate) : undefined,
                toDate ? new Date(toDate) : undefined
            );

            // Create audit log
            console.log(
                'Lab results synced from FHIR:',
                createAuditLog(
                    'SYNC_LAB_RESULTS_FHIR',
                    'LabResult',
                    'bulk_sync',
                    context,
                    {
                        patientId,
                        syncedCount: syncResult.synced,
                        errorCount: syncResult.errors.length,
                        fromDate,
                        toDate,
                    }
                )
            );

            sendSuccess(
                res,
                {
                    synced: syncResult.synced,
                    errors: syncResult.errors,
                    patientId,
                    dateRange: {
                        from: fromDate,
                        to: toDate,
                    },
                },
                `Successfully synced ${syncResult.synced} lab results from FHIR server`
            );
        } catch (error) {
            logger.error('Failed to sync lab results from FHIR:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to sync lab results from FHIR: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/fhir/test-connection
 * Test FHIR server connection
 */
export const testFHIRConnection = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Test FHIR connection
            const connectionResult = await labService.testFHIRConnection();

            // Create audit log
            console.log(
                'FHIR connection tested:',
                createAuditLog(
                    'TEST_FHIR_CONNECTION',
                    'System',
                    'fhir_connection',
                    context,
                    {
                        connected: connectionResult.connected,
                        error: connectionResult.error,
                    }
                )
            );

            if (connectionResult.connected) {
                sendSuccess(
                    res,
                    {
                        connected: true,
                        message: 'FHIR server connection successful',
                        timestamp: new Date().toISOString(),
                    },
                    'FHIR server connection test successful'
                );
            } else {
                sendError(
                    res,
                    'SERVICE_UNAVAILABLE',
                    connectionResult.error || 'FHIR server connection failed',
                    503,
                    {
                        connected: false,
                        error: connectionResult.error,
                        timestamp: new Date().toISOString(),
                    }
                );
            }
        } catch (error) {
            logger.error('Failed to test FHIR connection:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to test FHIR connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);