import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../../middlewares/auth';

// Import services
import ManualLabService, {
    CreateOrderRequest,
    AddResultsRequest,
    OrderFilters,
    OrderStatusUpdate,
} from '../services/manualLabService';
import { pdfGenerationService } from '../services/pdfGenerationService';
import ManualLabCacheService from '../services/manualLabCacheService';

// Import models
import ManualLabOrder from '../models/ManualLabOrder';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import User from '../../../models/User';

// Import utilities
import {
    sendSuccess,
    sendError,
    asyncHandler,
    ensureResourceExists,
    checkTenantAccess,
    getRequestContext,
    createAuditLog,
    createPaginationMeta,
} from '../../../utils/responseHelpers';

// Import audit services
import { AuditService } from '../../../services/auditService';
import ManualLabAuditService from '../services/manualLabAuditService';

// Import security utilities
import { generateSecurePDFToken } from '../middlewares/manualLabSecurityMiddleware';

// Import logger
import logger from '../../../utils/logger';

/**
 * Manual Lab Order Controller
 * Handles HTTP requests for Manual Lab Order workflow
 */

// ===============================
// ORDER MANAGEMENT ENDPOINTS
// ===============================

/**
 * POST /api/manual-lab-orders
 * Create new manual lab order with PDF generation
 */
export const createManualLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const orderData = req.body;

        try {
            // Prepare order creation request
            const createRequest: CreateOrderRequest = {
                patientId: new mongoose.Types.ObjectId(orderData.patientId),
                workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
                locationId: orderData.locationId,
                orderedBy: context.userId,
                tests: orderData.tests,
                indication: orderData.indication,
                priority: orderData.priority || 'routine',
                notes: orderData.notes,
                consentObtained: orderData.consentObtained,
                consentObtainedBy: new mongoose.Types.ObjectId(orderData.consentObtainedBy),
            };

            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Create the order
            const order = await ManualLabService.createOrder(createRequest, auditContext);

            // Generate secure PDF access token
            const pdfToken = generateSecurePDFToken(
                order.orderId,
                context.userId.toString(),
                24 * 60 * 60 // 24 hours
            );

            // Return success response
            sendSuccess(
                res,
                {
                    order: {
                        ...order.toObject(),
                        testCount: order.tests.length,
                        pdfAccessToken: pdfToken,
                        pdfUrl: `/api/manual-lab-orders/${order.orderId}/pdf?token=${pdfToken}`
                    },
                },
                'Manual lab order created successfully',
                201
            );

            logger.info('Manual lab order created via API', {
                orderId: order.orderId,
                patientId: orderData.patientId,
                workplaceId: context.workplaceId,
                testCount: order.tests.length,
                userId: context.userId,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to create manual lab order via API', {
                error: error instanceof Error ? error.message : 'Unknown error',
                patientId: orderData.patientId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return sendError(res, 'NOT_FOUND', error.message, 404);
                }
                if (error.message.includes('consent') || error.message.includes('validation')) {
                    return sendError(res, 'VALIDATION_ERROR', error.message, 400);
                }
                if (error.message.includes('permission')) {
                    return sendError(res, 'FORBIDDEN', error.message, 403);
                }
            }

            sendError(res, 'SERVER_ERROR', 'Failed to create manual lab order', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/:orderId
 * Retrieve order details
 */
export const getManualLabOrder = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Order ID is required', 400);
        }

        try {
            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Get the order
            const order = await ManualLabService.getOrderById(
                orderId,
                new mongoose.Types.ObjectId(context.workplaceId),
                auditContext
            );

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Lab order not found', 404);
            }

            // Return success response
            sendSuccess(
                res,
                {
                    order: {
                        ...order.toObject(),
                        testCount: order.tests.length,
                        isActive: order.isActive(),
                        canBeModified: order.canBeModified(),
                    },
                },
                'Lab order retrieved successfully'
            );

            logger.info('Manual lab order retrieved via API', {
                orderId: order.orderId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to retrieve manual lab order via API', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve lab order', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/patient/:patientId
 * Get patient order history
 */
export const getPatientLabOrders = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { patientId } = req.params;
        const { page, limit, status, sort } = req.query as any;
        const context = getRequestContext(req);

        // For super_admin, we need to find the patient's actual workplace
        let workplaceId = context.workplaceId;

        try {

            if (context.isSuperAdmin) {
                // Import Patient model to find patient's workplace
                const Patient = require('../../../models/Patient').default;
                const patient = await Patient.findById(patientId);
                if (!patient) {
                    return sendError(res, 'NOT_FOUND', 'Patient not found', 404);
                }
                workplaceId = patient.workplaceId.toString();
            }

            // Get patient orders with pagination
            const result = await ManualLabService.getOrdersByPatient(
                new mongoose.Types.ObjectId(patientId),
                new mongoose.Types.ObjectId(workplaceId),
                {
                    page: parseInt(page) || 1,
                    limit: parseInt(limit) || 20,
                    status,
                    sortBy: sort?.replace('-', '') || 'createdAt',
                    sortOrder: sort?.startsWith('-') ? 'desc' : 'asc',
                }
            );

            // Enhance orders with computed properties
            const enhancedOrders = result.data.map(order => ({
                ...order.toObject(),
                testCount: order.tests.length,
                isActive: order.isActive(),
                canBeModified: order.canBeModified(),
            }));

            // Return paginated response
            res.json({
                success: true,
                message: `Found ${result.pagination.total} lab orders for patient`,
                data: {
                    orders: enhancedOrders,
                    pagination: result.pagination,
                },
            });

            logger.info('Patient lab orders retrieved via API', {
                patientId,
                workplaceId: workplaceId,
                userId: context.userId,
                resultCount: result.data.length,
                totalCount: result.pagination.total,
                isSuperAdmin: context.isSuperAdmin,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to retrieve patient lab orders via API', {
                patientId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: workplaceId,
                userId: context.userId,
                isSuperAdmin: context.isSuperAdmin,
                service: 'manual-lab-api',
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve patient lab orders', 500);
        }
    }
);

/**
 * PUT /api/manual-lab-orders/:orderId/status
 * Update order status
 */
export const updateOrderStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Order ID is required', 400);
        }

        try {
            // Prepare status update
            const statusUpdate: OrderStatusUpdate = {
                status,
                updatedBy: context.userId,
                notes,
            };

            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Update the order status
            const updatedOrder = await ManualLabService.updateOrderStatus(
                orderId,
                statusUpdate,
                auditContext
            );

            // Return success response
            sendSuccess(
                res,
                {
                    order: {
                        ...updatedOrder.toObject(),
                        testCount: updatedOrder.tests.length,
                        isActive: updatedOrder.isActive(),
                        canBeModified: updatedOrder.canBeModified(),
                    },
                },
                'Order status updated successfully'
            );

            logger.info('Manual lab order status updated via API', {
                orderId: updatedOrder.orderId,
                newStatus: status,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to update manual lab order status via API', {
                orderId,
                status,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return sendError(res, 'NOT_FOUND', error.message, 404);
                }
                if (error.message.includes('Invalid status transition')) {
                    return sendError(res, 'BUSINESS_RULE_VIOLATION', error.message, 409);
                }
            }

            sendError(res, 'SERVER_ERROR', 'Failed to update order status', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders
 * List orders with filtering and pagination (admin/management endpoint)
 */
export const getManualLabOrders = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const {
            page,
            limit,
            status,
            priority,
            orderedBy,
            locationId,
            dateFrom,
            dateTo,
            search,
            sort,
        } = req.query as any;

        try {
            // Build filters
            const filters: OrderFilters = {
                workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                sortBy: sort?.replace('-', '') || 'createdAt',
                sortOrder: sort?.startsWith('-') ? 'desc' : 'asc',
            };

            // Apply optional filters
            if (status) filters.status = status;
            if (priority) filters.priority = priority;
            if (orderedBy) filters.orderedBy = new mongoose.Types.ObjectId(orderedBy);
            if (locationId) filters.locationId = locationId;
            if (dateFrom) filters.dateFrom = new Date(dateFrom);
            if (dateTo) filters.dateTo = new Date(dateTo);
            if (search) filters.search = search;

            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Get orders
            const result = await ManualLabService.getOrders(filters, auditContext);

            // Enhance orders with computed properties
            const enhancedOrders = result.data.map(order => ({
                ...order.toObject(),
                testCount: order.tests.length,
                isActive: order.isActive(),
                canBeModified: order.canBeModified(),
            }));

            // Return paginated response
            res.json({
                success: true,
                message: `Found ${result.pagination.total} lab orders`,
                data: {
                    orders: enhancedOrders,
                    pagination: result.pagination,
                    filters: filters,
                },
            });

            logger.info('Manual lab orders list retrieved via API', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                resultCount: result.data.length,
                totalCount: result.pagination.total,
                filters,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to retrieve manual lab orders list via API', {
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve lab orders', 500);
        }
    }
);

// ===============================
// RESULT MANAGEMENT ENDPOINTS
// ===============================

/**
 * POST /api/manual-lab-orders/:orderId/results
 * Submit lab results
 */
export const addLabResults = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const { values, reviewNotes } = req.body;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Order ID is required', 400);
        }

        try {
            // Prepare results request
            const resultsRequest: AddResultsRequest = {
                enteredBy: context.userId,
                values,
                reviewNotes,
            };

            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Add results
            const result = await ManualLabService.addResults(
                orderId,
                resultsRequest,
                auditContext
            );

            // Return success response
            sendSuccess(
                res,
                {
                    result: {
                        ...result.toObject(),
                        valueCount: result.values.length,
                        hasAbnormalResults: result.hasAbnormalResults(),
                        criticalResults: result.getCriticalResults(),
                    },
                },
                'Lab results added successfully',
                201
            );

            logger.info('Manual lab results added via API', {
                orderId: result.orderId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                valueCount: result.values.length,
                hasAbnormalResults: result.hasAbnormalResults(),
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to add manual lab results via API', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return sendError(res, 'NOT_FOUND', error.message, 404);
                }
                if (error.message.includes('already exist')) {
                    return sendError(res, 'DUPLICATE_RESOURCE', error.message, 409);
                }
                if (error.message.includes('Invalid test codes')) {
                    return sendError(res, 'VALIDATION_ERROR', error.message, 400);
                }
                if (error.message.includes('status')) {
                    return sendError(res, 'BUSINESS_RULE_VIOLATION', error.message, 409);
                }
            }

            sendError(res, 'SERVER_ERROR', 'Failed to add lab results', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/:orderId/results
 * Retrieve entered results
 */
export const getLabResults = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Order ID is required', 400);
        }

        try {
            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Get results
            const result = await ManualLabService.getResultsByOrder(
                orderId,
                new mongoose.Types.ObjectId(context.workplaceId),
                auditContext
            );

            if (!result) {
                return sendError(res, 'NOT_FOUND', 'Lab results not found', 404);
            }

            // Return success response
            sendSuccess(
                res,
                {
                    result: {
                        ...result.toObject(),
                        valueCount: result.values.length,
                        hasAbnormalResults: result.hasAbnormalResults(),
                        criticalResults: result.getCriticalResults(),
                        processingStatus: result.get('processingStatus'),
                        isReviewed: result.get('isReviewed'),
                    },
                },
                'Lab results retrieved successfully'
            );

            logger.info('Manual lab results retrieved via API', {
                orderId: result.orderId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                valueCount: result.values.length,
                hasAbnormalResults: result.hasAbnormalResults(),
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to retrieve manual lab results via API', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error && error.message.includes('not found')) {
                return sendError(res, 'NOT_FOUND', error.message, 404);
            }

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve lab results', 500);
        }
    }
);

// ===============================
// TOKEN RESOLUTION ENDPOINT
// ===============================

/**
 * GET /api/manual-lab-orders/scan
 * Resolve QR/barcode tokens to order details
 */
export const resolveOrderToken = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { token } = req.query as any;
        const context = getRequestContext(req);

        if (!token) {
            return sendError(res, 'VALIDATION_ERROR', 'Token is required', 400);
        }

        try {
            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Resolve token
            const order = await ManualLabService.resolveToken(token, auditContext);

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Invalid or expired token', 404);
            }

            // Return success response
            sendSuccess(
                res,
                {
                    order: {
                        ...order.toObject(),
                        testCount: order.tests.length,
                        isActive: order.isActive(),
                        canBeModified: order.canBeModified(),
                    },
                },
                'Token resolved successfully'
            );

            logger.info('Manual lab order token resolved via API', {
                orderId: order.orderId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to resolve manual lab order token via API', {
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error) {
                if (error.message.includes('Invalid token')) {
                    return sendError(res, 'VALIDATION_ERROR', error.message, 400);
                }
                if (error.message.includes('not found') || error.message.includes('expired')) {
                    return sendError(res, 'NOT_FOUND', error.message, 404);
                }
            }

            sendError(res, 'SERVER_ERROR', 'Failed to resolve token', 500);
        }
    }
);

// ===============================
// PDF GENERATION AND SERVING
// ===============================

/**
 * GET /api/manual-lab-orders/:orderId/pdf
 * Serve generated PDF requisition
 */
export const servePDFRequisition = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { orderId } = req.params;
        const context = getRequestContext(req);

        if (!orderId) {
            return sendError(res, 'VALIDATION_ERROR', 'Order ID is required', 400);
        }

        try {
            // Get the order with populated data
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId: new mongoose.Types.ObjectId(context.workplaceId),
                isDeleted: { $ne: true }
            })
                .populate('patientId')
                .populate('orderedBy')
                .populate('workplaceId');

            if (!order) {
                return sendError(res, 'NOT_FOUND', 'Lab order not found', 404);
            }

            // Get additional required data
            const [patient, workplace, pharmacist] = await Promise.all([
                Patient.findById(order.patientId),
                Workplace.findById(order.workplaceId),
                User.findById(order.orderedBy)
            ]);

            if (!patient || !workplace || !pharmacist) {
                return sendError(res, 'NOT_FOUND', 'Required data not found for PDF generation', 404);
            }

            // Try to get cached PDF first
            let pdfResult = await ManualLabCacheService.getCachedPDFRequisition(orderId.toUpperCase());

            if (!pdfResult) {
                // Validate PDF generation requirements
                pdfGenerationService.validateGenerationRequirements(order, patient, workplace, pharmacist);

                // Generate PDF if not cached
                pdfResult = await pdfGenerationService.generateRequisitionPDF(
                    order,
                    patient,
                    workplace,
                    pharmacist
                );
            }

            // Create audit context
            const auditContext = {
                userId: context.userId,
                workspaceId: context.workplaceId,
                userRole: context.userRole || 'unknown',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            };

            // Enhanced PDF access audit logging
            await ManualLabAuditService.logPDFAccess(auditContext, {
                orderId: order.orderId,
                patientId: order.patientId,
                fileName: pdfResult!.fileName,
                fileSize: pdfResult!.metadata.fileSize,
                downloadMethod: 'direct_link',
                userAgent: req.get('User-Agent'),
                referrer: req.get('Referer')
            });

            // Set response headers for PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${pdfResult!.fileName}"`);
            res.setHeader('Content-Length', pdfResult!.pdfBuffer.length);
            res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            // Add security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-Download-Options', 'noopen');

            // Send PDF buffer
            res.send(pdfResult!.pdfBuffer);

            logger.info('Manual lab PDF served via API', {
                orderId: order.orderId,
                workplaceId: context.workplaceId,
                userId: context.userId,
                fileName: pdfResult!.fileName,
                fileSize: pdfResult!.metadata.fileSize,
                service: 'manual-lab-api',
            });
        } catch (error) {
            logger.error('Failed to serve manual lab PDF via API', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                workplaceId: context.workplaceId,
                userId: context.userId,
                service: 'manual-lab-api',
            });

            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return sendError(res, 'NOT_FOUND', error.message, 404);
                }
                if (error.message.includes('validation failed')) {
                    return sendError(res, 'VALIDATION_ERROR', error.message, 400);
                }
                if (error.message.includes('PDF generation failed')) {
                    return sendError(res, 'SERVER_ERROR', error.message, 500);
                }
            }

            sendError(res, 'SERVER_ERROR', 'Failed to generate or serve PDF', 500);
        }
    }
);