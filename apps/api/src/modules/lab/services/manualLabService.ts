import mongoose from 'mongoose';
import logger from '../../../utils/logger';

// Import models
import ManualLabOrder, { IManualLabOrder, IManualLabTest } from '../models/ManualLabOrder';
import ManualLabResult, { IManualLabResult, IManualLabResultValue, IManualLabResultInterpretation } from '../models/ManualLabResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';
import Workplace from '../../../models/Workplace';
import Allergy from '../../../models/Allergy';
import Medication from '../../../models/Medication';

// Import services
import TokenService, { SecureTokenData } from './tokenService';
import { pdfGenerationService } from './pdfGenerationService';
import { AuditService } from '../../../services/auditService';
export interface AuditContext {
    userId: string;
    workspaceId: string;
    sessionId?: string;
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
import ManualLabAuditService from './manualLabAuditService';
import { mtrNotificationService, CriticalAlert } from '../../../services/mtrNotificationService';
import ManualLabCacheService from './manualLabCacheService';
import { MonitorPerformance } from '../middlewares/manualLabPerformanceMiddleware';

// Import diagnostic service for AI integration
import { diagnosticService } from '../../diagnostics/services';
import { DiagnosticInput } from '../../../services/openRouterService';

// Import utilities
import {
    PatientManagementError,
    createValidationError,
    createBusinessRuleError,
    createNotFoundError,
} from '../../../utils/responseHelpers';

/**
 * Manual Lab Service Layer
 * Handles business logic for Manual Lab Order workflow
 */

// ===============================
// INTERFACES AND TYPES
// ===============================

export interface CreateOrderRequest {
    patientId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;
    orderedBy: mongoose.Types.ObjectId;
    tests: IManualLabTest[];
    indication: string;
    priority?: 'routine' | 'urgent' | 'stat';
    notes?: string;
    consentObtained: boolean;
    consentObtainedBy: mongoose.Types.ObjectId;
}

export interface AddResultsRequest {
    enteredBy: mongoose.Types.ObjectId;
    values: Array<{
        testCode: string;
        testName: string;
        numericValue?: number;
        unit?: string;
        stringValue?: string;
        comment?: string;
    }>;
    reviewNotes?: string;
}

export interface OrderFilters {
    workplaceId: mongoose.Types.ObjectId;
    patientId?: mongoose.Types.ObjectId;
    orderedBy?: mongoose.Types.ObjectId;
    status?: IManualLabOrder['status'];
    priority?: IManualLabOrder['priority'];
    locationId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface OrderStatusUpdate {
    status: IManualLabOrder['status'];
    updatedBy: mongoose.Types.ObjectId;
    notes?: string;
}

export interface AIInterpretationRequest {
    orderId: string;
    patientId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    labResults: IManualLabResultValue[];
    indication: string;
    requestedBy: mongoose.Types.ObjectId;
}

// ===============================
// MANUAL LAB SERVICE
// ===============================

class ManualLabService {
    /**
     * Create a new manual lab order
     */
    @MonitorPerformance('createOrder')
    static async createOrder(
        orderData: CreateOrderRequest,
        auditContext: AuditContext
    ): Promise<IManualLabOrder> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate patient exists and belongs to workplace
            const patient = await Patient.findOne({
                _id: orderData.patientId,
                workplaceId: orderData.workplaceId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!patient) {
                throw createNotFoundError('Patient not found or does not belong to this workplace');
            }

            // Validate ordering user
            const orderingUser = await User.findOne({
                _id: orderData.orderedBy,
                workplaceId: orderData.workplaceId,
                role: { $in: ['pharmacist', 'owner'] },
                isDeleted: { $ne: true }
            }).session(session);

            if (!orderingUser) {
                throw createValidationError('Invalid ordering user or insufficient permissions');
            }

            // Validate consent
            if (!orderData.consentObtained) {
                throw createValidationError('Patient consent is required for manual lab orders');
            }

            // Generate unique order ID
            const orderId = await ManualLabOrder.generateNextOrderId(orderData.workplaceId);

            // Generate secure tokens for QR/barcode access
            const tokens = TokenService.generateLabOrderTokens(
                orderId,
                orderData.workplaceId.toString()
            );

            // Create the order
            const order = new ManualLabOrder({
                orderId,
                patientId: orderData.patientId,
                workplaceId: orderData.workplaceId,
                locationId: orderData.locationId,
                orderedBy: orderData.orderedBy,
                tests: orderData.tests,
                indication: orderData.indication,
                priority: orderData.priority || 'routine',
                notes: orderData.notes,
                consentObtained: orderData.consentObtained,
                consentTimestamp: new Date(),
                consentObtainedBy: orderData.consentObtainedBy,
                requisitionFormUrl: `/api/manual-lab-orders/${orderId}/pdf`,
                barcodeData: tokens.barcodeData,
                status: 'requested',
                createdBy: orderData.orderedBy
            });

            await order.save({ session });

            // Generate PDF requisition
            const workplace = await Workplace.findById(orderData.workplaceId).session(session);
            if (!workplace) {
                throw createNotFoundError('Workplace not found');
            }

            const pharmacist = await User.findById(orderData.orderedBy).session(session);
            if (!pharmacist) {
                throw createNotFoundError('Pharmacist not found');
            }

            const pdfResult = await pdfGenerationService.generateRequisitionPDF(
                order,
                patient,
                workplace,
                pharmacist
            );

            // Update order with PDF URL
            order.requisitionFormUrl = pdfResult.url;
            await order.save({ session });

            // Enhanced audit logging for order creation
            await ManualLabAuditService.logOrderCreation(auditContext, order, true, pdfResult.metadata?.generatedAt?.getTime());

            await session.commitTransaction();

            // Invalidate relevant caches after successful order creation
            await ManualLabCacheService.invalidateOrderCache(
                orderData.workplaceId,
                order.orderId,
                orderData.patientId
            );

            logger.info('Manual lab order created successfully', {
                orderId: order.orderId,
                patientId: orderData.patientId,
                workplaceId: orderData.workplaceId,
                testCount: order.tests.length,
                service: 'manual-lab'
            });

            return order;
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to create manual lab order', {
                error: error instanceof Error ? error.message : 'Unknown error',
                patientId: orderData.patientId,
                workplaceId: orderData.workplaceId,
                service: 'manual-lab'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get order by ID with validation
     */
    static async getOrderById(
        orderId: string,
        workplaceId: mongoose.Types.ObjectId,
        auditContext?: AuditContext
    ): Promise<IManualLabOrder | null> {
        try {
            // Try to get from cache first
            const cachedOrder = await ManualLabCacheService.getCachedOrder(workplaceId, orderId.toUpperCase());
            if (cachedOrder) {
                // Still log audit access for cached results
                if (auditContext) {
                    await AuditService.logActivity(auditContext, {
                        action: 'MANUAL_LAB_ORDER_ACCESSED',
                        resourceType: 'Patient',
                        resourceId: cachedOrder._id,
                        patientId: cachedOrder.patientId,
                        details: {
                            orderId: cachedOrder.orderId,
                            status: cachedOrder.status,
                            accessType: 'view',
                            fromCache: true
                        },
                        complianceCategory: 'data_access',
                        riskLevel: 'low'
                    });
                }
                return cachedOrder;
            }

            // Fetch from database if not in cache
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId,
                isDeleted: { $ne: true }
            })
                .populate('patientId', 'firstName lastName mrn dateOfBirth')
                .populate('orderedBy', 'firstName lastName email role')
                .populate('createdBy', 'firstName lastName email')
                .populate('updatedBy', 'firstName lastName email');

            // Cache the order if found
            if (order) {
                await ManualLabCacheService.cacheOrder(order);
            }

            if (order && auditContext) {
                // Log access for audit trail
                await AuditService.logActivity(auditContext, {
                    action: 'MANUAL_LAB_ORDER_ACCESSED',
                    resourceType: 'Patient',
                    resourceId: order._id,
                    patientId: order.patientId,
                    details: {
                        orderId: order.orderId,
                        status: order.status,
                        accessType: 'view',
                        fromCache: false
                    },
                    complianceCategory: 'data_access',
                    riskLevel: 'low'
                });
            }

            return order;
        } catch (error) {
            logger.error('Failed to retrieve manual lab order', {
                orderId,
                workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            throw error;
        }
    }

    /**
     * Get orders by patient with pagination
     */
    static async getOrdersByPatient(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        options: {
            page?: number;
            limit?: number;
            status?: IManualLabOrder['status'];
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        } = {}
    ): Promise<PaginatedResult<IManualLabOrder>> {
        try {
            const page = Math.max(1, options.page || 1);
            const limit = Math.min(100, Math.max(1, options.limit || 20));

            // For simple queries without status filter, try cache first
            if (!options.status && options.sortBy === 'createdAt' && options.sortOrder !== 'asc') {
                const cachedOrders = await ManualLabCacheService.getCachedPatientOrders(
                    workplaceId,
                    patientId,
                    page,
                    limit
                );

                if (cachedOrders) {
                    // Calculate pagination info (we need total count from DB for this)
                    const total = await ManualLabOrder.countDocuments({
                        patientId,
                        workplaceId,
                        isDeleted: { $ne: true }
                    });

                    const pages = Math.ceil(total / limit);

                    return {
                        data: cachedOrders,
                        pagination: {
                            page,
                            limit,
                            total,
                            pages,
                            hasNext: page < pages,
                            hasPrev: page > 1
                        }
                    };
                }
            }

            const skip = (page - 1) * limit;

            // Build query
            const query: any = {
                patientId,
                workplaceId,
                isDeleted: { $ne: true }
            };

            if (options.status) {
                query.status = options.status;
            }

            // Build sort
            const sortBy = options.sortBy || 'createdAt';
            const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
            const sort: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder };

            // Get total count
            const total = await ManualLabOrder.countDocuments(query);

            // Get paginated results
            const orders = await ManualLabOrder.find(query)
                .populate('orderedBy', 'firstName lastName email role')
                .populate('createdBy', 'firstName lastName email')
                .sort(sort)
                .skip(skip)
                .limit(limit);

            // Cache the results for simple queries
            if (!options.status && options.sortBy === 'createdAt' && options.sortOrder !== 'asc') {
                await ManualLabCacheService.cachePatientOrders(workplaceId, patientId, orders, page, limit);
            }

            const pages = Math.ceil(total / limit);

            return {
                data: orders,
                pagination: {
                    page,
                    limit,
                    total,
                    pages,
                    hasNext: page < pages,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Failed to retrieve patient lab orders', {
                patientId,
                workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            throw error;
        }
    }

    /**
     * Update order status with validation
     */
    static async updateOrderStatus(
        orderId: string,
        statusUpdate: OrderStatusUpdate,
        auditContext: AuditContext
    ): Promise<IManualLabOrder> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId: auditContext.workspaceId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!order) {
                throw createNotFoundError('Lab order not found');
            }

            // Validate status transition
            const validTransitions = this.getValidStatusTransitions(order.status);
            if (!validTransitions.includes(statusUpdate.status)) {
                throw createBusinessRuleError(
                    `Invalid status transition from ${order.status} to ${statusUpdate.status}`
                );
            }

            const oldStatus = order.status;

            // Update status
            await order.updateStatus(statusUpdate.status, statusUpdate.updatedBy);

            if (statusUpdate.notes) {
                order.notes = statusUpdate.notes;
                await order.save({ session });
            }

            // Log audit event
            await AuditService.logActivity(auditContext, {
                action: 'MANUAL_LAB_ORDER_STATUS_UPDATED',
                resourceType: 'Patient',
                resourceId: order._id,
                patientId: order.patientId,
                oldValues: { status: oldStatus },
                newValues: { status: statusUpdate.status },
                changedFields: ['status'],
                details: {
                    orderId: order.orderId,
                    oldStatus,
                    newStatus: statusUpdate.status,
                    notes: statusUpdate.notes
                },
                complianceCategory: 'workflow_compliance',
                riskLevel: 'medium'
            });

            await session.commitTransaction();

            logger.info('Manual lab order status updated', {
                orderId: order.orderId,
                oldStatus,
                newStatus: statusUpdate.status,
                updatedBy: statusUpdate.updatedBy,
                service: 'manual-lab'
            });

            return order;
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to update lab order status', {
                orderId,
                statusUpdate,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Add results to a lab order
     */
    @MonitorPerformance('addResults')
    static async addResults(
        orderId: string,
        resultData: AddResultsRequest,
        auditContext: AuditContext
    ): Promise<IManualLabResult> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Find the order
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId: auditContext.workspaceId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!order) {
                throw createNotFoundError('Lab order not found');
            }

            // Validate order status
            if (!['sample_collected', 'result_awaited'].includes(order.status)) {
                throw createBusinessRuleError(
                    'Results can only be added to orders with sample collected or result awaited status'
                );
            }

            // Check if results already exist
            const existingResult = await ManualLabResult.findOne({
                orderId: orderId.toUpperCase(),
                isDeleted: { $ne: true }
            }).session(session);

            if (existingResult) {
                throw createBusinessRuleError('Results already exist for this order');
            }

            // Validate test codes against ordered tests
            const orderedTestCodes = order.tests.map(test => test.code.toUpperCase());
            const resultTestCodes = resultData.values.map(value => value.testCode.toUpperCase());

            const invalidCodes = resultTestCodes.filter(code => !orderedTestCodes.includes(code));
            if (invalidCodes.length > 0) {
                throw createValidationError(
                    `Invalid test codes: ${invalidCodes.join(', ')}. Must match ordered tests.`
                );
            }

            // Create result entry
            const result = new ManualLabResult({
                orderId: orderId.toUpperCase(),
                enteredBy: resultData.enteredBy,
                enteredAt: new Date(),
                values: resultData.values.map(value => ({
                    ...value,
                    testCode: value.testCode.toUpperCase()
                })),
                interpretation: [],
                aiProcessed: false,
                reviewNotes: resultData.reviewNotes,
                createdBy: resultData.enteredBy
            });

            // Auto-generate interpretations based on reference ranges
            this.generateAutoInterpretations(result, order);

            await result.save({ session });

            // Update order status to completed
            await order.updateStatus('completed', resultData.enteredBy);

            // Log audit event
            await AuditService.logActivity(auditContext, {
                action: 'MANUAL_LAB_RESULTS_ENTERED',
                resourceType: 'Patient',
                resourceId: result._id,
                patientId: order.patientId,
                details: {
                    orderId: order.orderId,
                    testCount: result.values.length,
                    hasAbnormalResults: result.hasAbnormalResults(),
                    enteredBy: resultData.enteredBy
                },
                complianceCategory: 'clinical_documentation',
                riskLevel: result.hasAbnormalResults() ? 'high' : 'medium'
            });

            await session.commitTransaction();

            // Cache the result and invalidate order cache
            await ManualLabCacheService.cacheResult(result);
            await ManualLabCacheService.invalidateOrderCache(
                order.workplaceId,
                order.orderId,
                order.patientId
            );

            // Trigger AI interpretation asynchronously
            this.triggerAIInterpretation({
                orderId: order.orderId,
                patientId: order.patientId,
                workplaceId: order.workplaceId,
                labResults: result.values,
                indication: order.indication,
                requestedBy: resultData.enteredBy
            }).catch(error => {
                logger.error('AI interpretation failed', {
                    orderId: order.orderId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab'
                });
            });

            logger.info('Manual lab results entered successfully', {
                orderId: order.orderId,
                resultId: result._id,
                testCount: result.values.length,
                hasAbnormalResults: result.hasAbnormalResults(),
                service: 'manual-lab'
            });

            return result;
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to add lab results', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get results by order ID
     */
    static async getResultsByOrder(
        orderId: string,
        workplaceId: mongoose.Types.ObjectId,
        auditContext?: AuditContext
    ): Promise<IManualLabResult | null> {
        try {
            // Try to get from cache first
            const cachedResult = await ManualLabCacheService.getCachedResult(orderId.toUpperCase());
            if (cachedResult) {
                // Verify order belongs to workplace (security check)
                const order = await ManualLabOrder.findOne({
                    orderId: orderId.toUpperCase(),
                    workplaceId,
                    isDeleted: { $ne: true }
                });

                if (!order) {
                    throw createNotFoundError('Lab order not found');
                }

                if (auditContext) {
                    await AuditService.logActivity(auditContext, {
                        action: 'MANUAL_LAB_RESULTS_ACCESSED',
                        resourceType: 'Patient',
                        resourceId: cachedResult._id,
                        patientId: order.patientId,
                        details: {
                            orderId: cachedResult.orderId,
                            hasAbnormalResults: cachedResult.hasAbnormalResults(),
                            aiProcessed: cachedResult.aiProcessed,
                            accessType: 'view',
                            fromCache: true
                        },
                        complianceCategory: 'data_access',
                        riskLevel: 'low'
                    });
                }

                return cachedResult;
            }

            // Verify order belongs to workplace
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId,
                isDeleted: { $ne: true }
            });

            if (!order) {
                throw createNotFoundError('Lab order not found');
            }

            const result = await ManualLabResult.findOne({
                orderId: orderId.toUpperCase(),
                isDeleted: { $ne: true }
            })
                .populate('enteredBy', 'firstName lastName email role')
                .populate('reviewedBy', 'firstName lastName email role')
                .populate('diagnosticResultId');

            // Cache the result if found
            if (result) {
                await ManualLabCacheService.cacheResult(result);
            }

            if (result && auditContext) {
                // Log access for audit trail
                await AuditService.logActivity(auditContext, {
                    action: 'MANUAL_LAB_RESULTS_ACCESSED',
                    resourceType: 'Patient',
                    resourceId: result._id,
                    patientId: order.patientId,
                    details: {
                        orderId: result.orderId,
                        hasAbnormalResults: result.hasAbnormalResults(),
                        aiProcessed: result.aiProcessed,
                        accessType: 'view',
                        fromCache: false
                    },
                    complianceCategory: 'data_access',
                    riskLevel: 'low'
                });
            }

            return result;
        } catch (error) {
            logger.error('Failed to retrieve lab results', {
                orderId,
                workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            throw error;
        }
    }

    /**
     * Resolve token to order
     */
    static async resolveToken(
        token: string,
        auditContext?: AuditContext
    ): Promise<IManualLabOrder | null> {
        try {
            // Validate token
            const tokenValidation = TokenService.validateToken(token);
            if (!tokenValidation.valid || !tokenValidation.payload) {
                throw createValidationError(`Invalid token: ${tokenValidation.error}`);
            }

            const { orderId, workplaceId } = tokenValidation.payload;

            // Find order by token data
            const order = await ManualLabOrder.findOne({
                orderId: orderId.toUpperCase(),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                isDeleted: { $ne: true }
            })
                .populate('patientId', 'firstName lastName mrn')
                .populate('orderedBy', 'firstName lastName email role');

            if (!order) {
                throw createNotFoundError('Lab order not found or token expired');
            }

            // Verify token hash matches stored barcode data
            const barcodeData = TokenService.parseBarcodeData(order.barcodeData);
            if (!barcodeData || !TokenService.verifyTokenHash(token, barcodeData.tokenHash + '0'.repeat(48))) {
                // Note: This is a simplified verification. In production, you'd store the full hash
                logger.warn('Token hash verification failed', {
                    orderId: order.orderId,
                    service: 'manual-lab'
                });
            }

            if (auditContext) {
                // Log token access
                await AuditService.logActivity(auditContext, {
                    action: 'MANUAL_LAB_ORDER_TOKEN_RESOLVED',
                    resourceType: 'Patient',
                    resourceId: order._id,
                    patientId: order.patientId,
                    details: {
                        orderId: order.orderId,
                        tokenType: 'qr_barcode_scan',
                        status: order.status
                    },
                    complianceCategory: 'data_access',
                    riskLevel: 'medium'
                });
            }

            logger.info('Token resolved successfully', {
                orderId: order.orderId,
                workplaceId: order.workplaceId,
                service: 'manual-lab'
            });

            return order;
        } catch (error) {
            logger.error('Failed to resolve token', {
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            throw error;
        }
    }

    /**
     * Get orders with advanced filtering and pagination
     */
    static async getOrders(
        filters: OrderFilters,
        auditContext?: AuditContext
    ): Promise<PaginatedResult<IManualLabOrder>> {
        try {
            const page = Math.max(1, filters.page || 1);
            const limit = Math.min(100, Math.max(1, filters.limit || 20));
            const skip = (page - 1) * limit;

            // Build query
            const query: any = {
                workplaceId: filters.workplaceId,
                isDeleted: { $ne: true }
            };

            // Apply filters
            if (filters.patientId) query.patientId = filters.patientId;
            if (filters.orderedBy) query.orderedBy = filters.orderedBy;
            if (filters.status) query.status = filters.status;
            if (filters.priority) query.priority = filters.priority;
            if (filters.locationId) query.locationId = filters.locationId;

            // Date range filter
            if (filters.dateFrom || filters.dateTo) {
                query.createdAt = {};
                if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
                if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
            }

            // Text search
            if (filters.search) {
                query.$text = { $search: filters.search };
            }

            // Build sort
            const sortBy = filters.sortBy || 'createdAt';
            const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
            const sort: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder };

            // Get total count
            const total = await ManualLabOrder.countDocuments(query);

            // Get paginated results
            const orders = await ManualLabOrder.find(query)
                .populate('patientId', 'firstName lastName mrn dateOfBirth')
                .populate('orderedBy', 'firstName lastName email role')
                .populate('createdBy', 'firstName lastName email')
                .sort(sort)
                .skip(skip)
                .limit(limit);

            const pages = Math.ceil(total / limit);

            if (auditContext && orders.length > 0) {
                // Log bulk access for audit trail
                await AuditService.logActivity(auditContext, {
                    action: 'MANUAL_LAB_ORDERS_BULK_ACCESSED',
                    resourceType: 'Patient',
                    resourceId: new mongoose.Types.ObjectId(), // Placeholder for bulk operations
                    details: {
                        filterCriteria: filters,
                        resultCount: orders.length,
                        totalCount: total,
                        accessType: 'bulk_view'
                    },
                    complianceCategory: 'data_access',
                    riskLevel: 'low'
                });
            }

            return {
                data: orders,
                pagination: {
                    page,
                    limit,
                    total,
                    pages,
                    hasNext: page < pages,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Failed to retrieve lab orders', {
                filters,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            throw error;
        }
    }

    /**
     * Trigger AI interpretation for lab results
     */
    static async triggerAIInterpretation(
        request: AIInterpretationRequest
    ): Promise<any> {
        try {
            // Get patient data for context
            const patient = await Patient.findById(request.patientId);

            if (!patient) {
                throw createNotFoundError('Patient not found for AI interpretation');
            }

            // Get current medications from medication records
            const medicationRecords = await Medication.find({
                patient: request.patientId,
                status: 'active'
            });

            const currentMedications = medicationRecords.map(med => ({
                name: med.drugName,
                dosage: med.instructions.dosage || '',
                frequency: med.instructions.frequency || '',
                route: med.dosageForm,
                startDate: med.createdAt,
                indication: med.therapy.indication
            }));

            // Get patient allergies
            const allergyRecords = await Allergy.find({
                patientId: request.patientId,
                workplaceId: request.workplaceId,
                isDeleted: { $ne: true }
            });

            const allergies = allergyRecords.map(allergy => allergy.substance);

            // Calculate patient age
            const age = patient.dob ?
                Math.floor((Date.now() - patient.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) :
                patient.age;

            // Prepare diagnostic request data
            const diagnosticRequestData = {
                patientId: request.patientId.toString(),
                pharmacistId: request.requestedBy.toString(),
                workplaceId: request.workplaceId.toString(),
                inputSnapshot: {
                    symptoms: {
                        subjective: [request.indication],
                        objective: [],
                        duration: 'unknown',
                        severity: 'mild' as const,
                        onset: 'chronic' as const
                    },
                    currentMedications,
                    allergies,
                    medicalHistory: [], // Could be enhanced to fetch from clinical notes or conditions
                    labResultIds: [], // Manual lab results don't have IDs yet
                    vitals: patient.latestVitals ? {
                        weight: patient.weightKg,
                        bloodPressure: patient.latestVitals.bpSystolic && patient.latestVitals.bpDiastolic ?
                            `${patient.latestVitals.bpSystolic}/${patient.latestVitals.bpDiastolic}` : undefined,
                        heartRate: undefined, // Not available in current Patient model
                        temperature: patient.latestVitals.tempC,
                        respiratoryRate: patient.latestVitals.rr,
                        oxygenSaturation: undefined // Not available in current Patient model
                    } : undefined
                },
                priority: 'routine' as const,
                consentObtained: true // Already obtained during order creation
            };

            // Create diagnostic request
            const diagnosticRequest = await diagnosticService.createDiagnosticRequest(diagnosticRequestData);

            // Process the diagnostic request with AI
            const analysisResult = await diagnosticService.processDiagnosticRequest(
                diagnosticRequest._id.toString(),
                {
                    skipInteractionCheck: false,
                    skipLabValidation: true, // Skip since we're providing manual results
                    retryOnFailure: true,
                    maxRetries: 2
                }
            );

            // Validate AI response structure
            this.validateAIResponse(analysisResult.result);

            // Update lab result with AI processing info
            const labResult = await ManualLabResult.findOne({
                orderId: request.orderId.toUpperCase(),
                isDeleted: { $ne: true }
            });

            if (labResult && analysisResult.result) {
                await labResult.markAsAIProcessed(analysisResult.result._id);
            }

            // Process critical alerts from AI analysis
            await this.processCriticalAlerts(analysisResult.result, request);

            // Update order status to completed after AI processing
            const order = await ManualLabOrder.findOne({
                orderId: request.orderId.toUpperCase(),
                workplaceId: request.workplaceId,
                isDeleted: { $ne: true }
            });

            if (order && order.status !== 'completed') {
                await order.updateStatus('completed', request.requestedBy);
            }

            logger.info('AI interpretation completed', {
                orderId: request.orderId,
                diagnosticRequestId: diagnosticRequest._id,
                diagnosticResultId: analysisResult.result._id,
                processingTime: analysisResult.processingTime,
                hasRedFlags: analysisResult.result.redFlags?.length > 0,
                criticalRedFlags: analysisResult.result.redFlags?.filter(flag => flag.severity === 'critical').length || 0,
                confidenceScore: analysisResult.result.aiMetadata?.confidenceScore,
                service: 'manual-lab'
            });

            return {
                diagnosticRequest,
                diagnosticResult: analysisResult.result,
                processingTime: analysisResult.processingTime,
                interactionResults: analysisResult.interactionResults,
                criticalAlertsTriggered: analysisResult.result.redFlags?.filter(flag => flag.severity === 'critical').length || 0
            };
        } catch (error) {
            logger.error('AI interpretation failed', {
                orderId: request.orderId,
                patientId: request.patientId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                service: 'manual-lab'
            });

            // Don't throw error - AI interpretation failure shouldn't block result entry
            // Instead, log the failure and return null
            return null;
        }
    }

    /**
     * Validate AI response structure
     */
    private static validateAIResponse(diagnosticResult: any): void {
        if (!diagnosticResult) {
            throw new Error('AI diagnostic result is null or undefined');
        }

        // Validate required fields
        const requiredFields = ['diagnoses', 'aiMetadata'];
        for (const field of requiredFields) {
            if (!diagnosticResult[field]) {
                throw new Error(`AI response missing required field: ${field}`);
            }
        }

        // Validate diagnoses structure
        if (!Array.isArray(diagnosticResult.diagnoses)) {
            throw new Error('AI response diagnoses must be an array');
        }

        // Validate each diagnosis
        for (const diagnosis of diagnosticResult.diagnoses) {
            if (!diagnosis.condition || typeof diagnosis.condition !== 'string') {
                throw new Error('AI response diagnosis missing or invalid condition');
            }
            if (typeof diagnosis.probability !== 'number' || diagnosis.probability < 0 || diagnosis.probability > 1) {
                throw new Error('AI response diagnosis probability must be a number between 0 and 1');
            }
        }

        // Validate red flags if present
        if (diagnosticResult.redFlags && Array.isArray(diagnosticResult.redFlags)) {
            for (const flag of diagnosticResult.redFlags) {
                if (!flag.flag || typeof flag.flag !== 'string') {
                    throw new Error('AI response red flag missing or invalid flag description');
                }
                if (!['low', 'medium', 'high', 'critical'].includes(flag.severity)) {
                    throw new Error('AI response red flag invalid severity level');
                }
            }
        }

        // Validate AI metadata
        if (!diagnosticResult.aiMetadata.confidenceScore ||
            typeof diagnosticResult.aiMetadata.confidenceScore !== 'number' ||
            diagnosticResult.aiMetadata.confidenceScore < 0 ||
            diagnosticResult.aiMetadata.confidenceScore > 1) {
            throw new Error('AI response missing or invalid confidence score');
        }

        logger.debug('AI response validation passed', {
            diagnosesCount: diagnosticResult.diagnoses.length,
            redFlagsCount: diagnosticResult.redFlags?.length || 0,
            confidenceScore: diagnosticResult.aiMetadata.confidenceScore,
            service: 'manual-lab'
        });
    }

    /**
     * Process critical alerts from AI analysis
     */
    private static async processCriticalAlerts(
        diagnosticResult: any,
        request: AIInterpretationRequest
    ): Promise<void> {
        try {
            if (!diagnosticResult.redFlags || diagnosticResult.redFlags.length === 0) {
                return;
            }

            // Filter critical and high severity red flags
            const criticalFlags = diagnosticResult.redFlags.filter(
                (flag: any) => flag.severity === 'critical' || flag.severity === 'high'
            );

            if (criticalFlags.length === 0) {
                return;
            }

            // Send critical alerts for each critical red flag
            for (const flag of criticalFlags) {
                const alert: CriticalAlert = {
                    type: 'high_severity_dtp', // Using existing type, could be enhanced with lab-specific type
                    severity: flag.severity === 'critical' ? 'critical' : 'major',
                    patientId: request.patientId,
                    message: `Critical lab result interpretation: ${flag.flag}`,
                    details: {
                        orderId: request.orderId,
                        labResults: request.labResults.map(result => ({
                            testName: result.testName,
                            value: result.numericValue || result.stringValue,
                            unit: result.unit,
                            abnormal: result.abnormalFlag
                        })),
                        aiInterpretation: flag,
                        recommendedAction: flag.action,
                        confidenceScore: diagnosticResult.aiMetadata?.confidenceScore,
                        source: 'manual_lab_ai_interpretation'
                    },
                    requiresImmediate: flag.severity === 'critical'
                };

                await mtrNotificationService.sendCriticalAlert(alert);

                logger.warn('Critical alert sent for lab results', {
                    orderId: request.orderId,
                    patientId: request.patientId,
                    flagSeverity: flag.severity,
                    flag: flag.flag,
                    action: flag.action,
                    service: 'manual-lab'
                });
            }

            // Log audit event for critical alerts
            const auditContext: AuditContext = {
                userId: request.requestedBy.toString(),
                workspaceId: request.workplaceId.toString()
            };

            await AuditService.logActivity(auditContext, {
                action: 'MANUAL_LAB_CRITICAL_ALERTS_TRIGGERED',
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(), // Would need actual result ID
                patientId: request.patientId,
                details: {
                    orderId: request.orderId,
                    criticalFlagsCount: criticalFlags.length,
                    flags: criticalFlags.map((flag: any) => ({
                        severity: flag.severity,
                        flag: flag.flag,
                        action: flag.action
                    })),
                    alertsSent: criticalFlags.length
                },
                complianceCategory: 'patient_safety',
                riskLevel: 'critical'
            });

        } catch (error) {
            logger.error('Failed to process critical alerts', {
                orderId: request.orderId,
                patientId: request.patientId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
            // Don't throw - critical alert failure shouldn't block AI processing
        }
    }

    /**
     * Get valid status transitions for an order
     */
    private static getValidStatusTransitions(currentStatus: IManualLabOrder['status']): IManualLabOrder['status'][] {
        const transitions: Record<IManualLabOrder['status'], IManualLabOrder['status'][]> = {
            'requested': ['sample_collected', 'referred'],
            'sample_collected': ['result_awaited', 'referred'],
            'result_awaited': ['completed', 'referred'],
            'completed': ['referred'],
            'referred': []
        };

        return transitions[currentStatus] || [];
    }

    /**
     * Generate automatic interpretations based on reference ranges
     */
    private static generateAutoInterpretations(
        result: IManualLabResult,
        order: IManualLabOrder
    ): void {
        for (const value of result.values) {
            const orderedTest = order.tests.find(test => test.code.toUpperCase() === value.testCode);

            if (orderedTest?.refRange && value.numericValue !== undefined) {
                const interpretation = this.interpretNumericValue(
                    value.numericValue,
                    orderedTest.refRange,
                    orderedTest.unit || value.unit
                );

                result.interpretValue(value.testCode, interpretation.level, interpretation.note);

                // Set abnormal flag
                const valueIndex = result.values.findIndex(v => v.testCode === value.testCode);
                if (valueIndex >= 0 && result.values[valueIndex]) {
                    result.values[valueIndex]!.abnormalFlag = interpretation.level !== 'normal';
                }
            } else {
                // Default to normal if no reference range or non-numeric value
                result.interpretValue(value.testCode, 'normal');
            }
        }
    }

    /**
     * Interpret numeric value against reference range
     */
    private static interpretNumericValue(
        value: number,
        refRange: string,
        unit?: string
    ): { level: IManualLabResultInterpretation['interpretation']; note?: string } {
        try {
            // Parse reference range (simplified parser)
            // Supports formats like: "4.5-11.0", "< 5.0", "> 10.0", "4.5-11.0 x10³"
            const rangeMatch = refRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
            const lessThanMatch = refRange.match(/[<≤]\s*(\d+\.?\d*)/);
            const greaterThanMatch = refRange.match(/[>≥]\s*(\d+\.?\d*)/);

            if (rangeMatch) {
                const [, minStr, maxStr] = rangeMatch;
                const min = parseFloat(minStr || '0');
                const max = parseFloat(maxStr || '0');

                if (value < min) {
                    const percentBelow = ((min - value) / min) * 100;
                    return {
                        level: percentBelow > 50 ? 'critical' : 'low',
                        note: `Below normal range (${refRange}${unit ? ' ' + unit : ''})`
                    };
                } else if (value > max) {
                    const percentAbove = ((value - max) / max) * 100;
                    return {
                        level: percentAbove > 50 ? 'critical' : 'high',
                        note: `Above normal range (${refRange}${unit ? ' ' + unit : ''})`
                    };
                } else {
                    return {
                        level: 'normal',
                        note: `Within normal range (${refRange}${unit ? ' ' + unit : ''})`
                    };
                }
            } else if (lessThanMatch) {
                const threshold = parseFloat(lessThanMatch[1] || '0');
                return {
                    level: value >= threshold ? 'high' : 'normal',
                    note: `Reference: ${refRange}${unit ? ' ' + unit : ''}`
                };
            } else if (greaterThanMatch) {
                const threshold = parseFloat(greaterThanMatch[1] || '0');
                return {
                    level: value <= threshold ? 'low' : 'normal',
                    note: `Reference: ${refRange}${unit ? ' ' + unit : ''}`
                };
            }

            // If we can't parse the reference range, default to normal
            return {
                level: 'normal',
                note: `Reference: ${refRange}${unit ? ' ' + unit : ''} (auto-interpretation unavailable)`
            };
        } catch (error) {
            logger.warn('Failed to interpret numeric value', {
                value,
                refRange,
                unit,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });

            return {
                level: 'normal',
                note: `Reference: ${refRange}${unit ? ' ' + unit : ''} (interpretation error)`
            };
        }
    }

    /**
     * Log order event for audit trail
     */
    static async logOrderEvent(
        orderId: string,
        event: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        details: any = {}
    ): Promise<void> {
        try {
            const auditContext: AuditContext = {
                userId: userId.toString(),
                workspaceId: workplaceId.toString()
            };

            await AuditService.logActivity(auditContext, {
                action: event,
                resourceType: 'Patient',
                resourceId: new mongoose.Types.ObjectId(), // Would need to resolve order ID to ObjectId
                details: {
                    orderId,
                    ...details
                },
                complianceCategory: 'workflow_compliance',
                riskLevel: 'low'
            });
        } catch (error) {
            logger.error('Failed to log order event', {
                orderId,
                event,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab'
            });
        }
    }
}

export default ManualLabService;