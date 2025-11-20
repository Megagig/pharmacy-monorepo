import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import ManualLabPerformanceService, {
    OrderProcessingMetrics,
    PDFGenerationMetrics,
    DatabaseQueryMetrics,
    CacheMetrics
} from '../services/manualLabPerformanceService';
import logger from '../../../utils/logger';

/**
 * Performance Monitoring Middleware for Manual Lab Workflow
 * Automatically tracks performance metrics for requests and operations
 */

// ===============================
// INTERFACES
// ===============================

interface PerformanceContext {
    startTime: number;
    operation: string;
    orderId?: string;
    workplaceId?: string;
    userId?: string;
    metadata?: any;
}

// Extend Request to include performance context
declare global {
    namespace Express {
        interface Request {
            performanceContext?: PerformanceContext;
        }
    }
}

// ===============================
// MIDDLEWARE FUNCTIONS
// ===============================

/**
 * Initialize performance tracking for a request
 */
export const initializePerformanceTracking = (operation: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        req.performanceContext = {
            startTime: Date.now(),
            operation,
            workplaceId: req.user?.workplaceId?.toString(),
            userId: req.user?._id?.toString(),
            orderId: req.params?.orderId,
            metadata: {}
        };

        // Override res.json to capture response data
        const originalJson = res.json;
        res.json = function (body: any) {
            if (req.performanceContext) {
                req.performanceContext.metadata.responseBody = body;
                req.performanceContext.metadata.statusCode = res.statusCode;
            }
            return originalJson.call(this, body);
        };

        next();
    };
};

/**
 * Finalize performance tracking and record metrics
 */
export const finalizePerformanceTracking = () => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.performanceContext) {
            return next();
        }

        const context = req.performanceContext;
        const endTime = Date.now();
        const totalTime = endTime - context.startTime;

        try {
            // Record different types of metrics based on operation
            switch (context.operation) {
                case 'createOrder':
                    await recordOrderCreationMetrics(req, context, totalTime);
                    break;
                case 'servePDF':
                    await recordPDFServingMetrics(req, context, totalTime);
                    break;
                case 'addResults':
                    await recordResultEntryMetrics(req, context, totalTime);
                    break;
                case 'getOrder':
                case 'getOrders':
                case 'getResults':
                    await recordDataRetrievalMetrics(req, context, totalTime);
                    break;
                default:
                    await recordGenericOperationMetrics(req, context, totalTime);
            }
        } catch (error) {
            logger.error('Failed to record performance metrics', {
                operation: context.operation,
                orderId: context.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-middleware'
            });
        }

        next();
    };
};

/**
 * Track database query performance
 */
export const trackDatabaseQuery = (
    operation: 'create' | 'read' | 'update' | 'delete',
    collection: string
) => {
    return async (
        target: any,
        propertyName: string,
        descriptor: PropertyDescriptor
    ) => {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const startTime = Date.now();
            let success = true;
            let errorType: string | undefined;
            let documentsAffected = 0;

            try {
                const result = await method.apply(this, args);

                // Try to extract documents affected from result
                if (result && typeof result === 'object') {
                    if (Array.isArray(result)) {
                        documentsAffected = result.length;
                    } else if (result.length !== undefined) {
                        documentsAffected = result.length;
                    } else if (result.modifiedCount !== undefined) {
                        documentsAffected = result.modifiedCount;
                    } else if (result.deletedCount !== undefined) {
                        documentsAffected = result.deletedCount;
                    } else {
                        documentsAffected = 1;
                    }
                }

                return result;
            } catch (error) {
                success = false;
                errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
                throw error;
            } finally {
                const queryTime = Date.now() - startTime;

                const metrics: DatabaseQueryMetrics = {
                    operation,
                    collection,
                    queryTime,
                    documentsAffected,
                    indexesUsed: [], // Would need to be populated from query explain
                    success,
                    errorType,
                    timestamp: new Date(),
                    workplaceId: args[0]?.workplaceId?.toString(),
                    userId: args[0]?.userId?.toString()
                };

                ManualLabPerformanceService.recordDatabaseQueryMetrics(metrics).catch(err => {
                    logger.error('Failed to record database query metrics', {
                        operation,
                        collection,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    });
                });
            }
        };

        return descriptor;
    };
};

/**
 * Track cache operation performance
 */
export const trackCacheOperation = (operation: 'get' | 'set' | 'delete' | 'invalidate') => {
    return (cacheKey: string, workplaceId?: string) => {
        return async (
            target: any,
            propertyName: string,
            descriptor: PropertyDescriptor
        ) => {
            const method = descriptor.value;

            descriptor.value = async function (...args: any[]) {
                const startTime = Date.now();
                let success = true;
                let errorType: string | undefined;
                let hit = false;
                let dataSize: number | undefined;

                try {
                    const result = await method.apply(this, args);

                    // Determine if it was a cache hit
                    if (operation === 'get') {
                        hit = result !== null && result !== undefined;
                        if (hit && typeof result === 'string') {
                            dataSize = Buffer.byteLength(result, 'utf8');
                        } else if (hit && result) {
                            dataSize = Buffer.byteLength(JSON.stringify(result), 'utf8');
                        }
                    }

                    return result;
                } catch (error) {
                    success = false;
                    errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
                    throw error;
                } finally {
                    const operationTime = Date.now() - startTime;

                    const metrics: CacheMetrics = {
                        operation,
                        cacheKey,
                        operationTime,
                        hit,
                        dataSize,
                        success,
                        errorType,
                        timestamp: new Date(),
                        workplaceId
                    };

                    ManualLabPerformanceService.recordCacheMetrics(metrics).catch(err => {
                        logger.error('Failed to record cache metrics', {
                            operation,
                            cacheKey,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        });
                    });
                }
            };

            return descriptor;
        };
    };
};

// ===============================
// METRIC RECORDING FUNCTIONS
// ===============================

/**
 * Record order creation metrics
 */
async function recordOrderCreationMetrics(
    req: AuthRequest,
    context: PerformanceContext,
    totalTime: number
): Promise<void> {
    const responseBody = context.metadata?.responseBody;
    const success = context.metadata?.statusCode < 400;

    if (!context.workplaceId || !context.userId) {
        return;
    }

    const metrics: OrderProcessingMetrics = {
        orderId: context.orderId || responseBody?.data?.orderId || 'unknown',
        workplaceId: context.workplaceId,
        patientId: req.body?.patientId || responseBody?.data?.patientId || 'unknown',
        orderCreationTime: totalTime, // This would be more accurate if we tracked sub-operations
        pdfGenerationTime: 0, // Would need to be tracked separately
        totalProcessingTime: totalTime,
        testCount: req.body?.tests?.length || responseBody?.data?.testCount || 0,
        pdfSize: responseBody?.data?.pdfSize || 0,
        success,
        errorType: success ? undefined : getErrorType(responseBody),
        timestamp: new Date(),
        userId: context.userId,
        priority: req.body?.priority || 'routine'
    };

    await ManualLabPerformanceService.recordOrderProcessingMetrics(metrics);
}

/**
 * Record PDF serving metrics
 */
async function recordPDFServingMetrics(
    req: AuthRequest,
    context: PerformanceContext,
    totalTime: number
): Promise<void> {
    const success = context.metadata?.statusCode < 400;

    if (!context.workplaceId || !context.orderId) {
        return;
    }

    const metrics: PDFGenerationMetrics = {
        orderId: context.orderId,
        templateRenderTime: 0, // Would need to be tracked in PDF service
        qrCodeGenerationTime: 0, // Would need to be tracked in PDF service
        barcodeGenerationTime: 0, // Would need to be tracked in PDF service
        puppeteerProcessingTime: 0, // Would need to be tracked in PDF service
        totalGenerationTime: totalTime,
        pdfSize: parseInt(req.get('Content-Length') || '0'),
        pageCount: 1, // Assuming single page for lab requisitions
        testCount: 0, // Would need to be extracted from order
        success,
        errorType: success ? undefined : getErrorType(context.metadata?.responseBody),
        fromCache: req.get('X-From-Cache') === 'true',
        timestamp: new Date(),
        workplaceId: context.workplaceId
    };

    await ManualLabPerformanceService.recordPDFGenerationMetrics(metrics);
}

/**
 * Record result entry metrics
 */
async function recordResultEntryMetrics(
    req: AuthRequest,
    context: PerformanceContext,
    totalTime: number
): Promise<void> {
    const responseBody = context.metadata?.responseBody;
    const success = context.metadata?.statusCode < 400;

    if (!context.workplaceId || !context.userId || !context.orderId) {
        return;
    }

    const metrics: OrderProcessingMetrics = {
        orderId: context.orderId,
        workplaceId: context.workplaceId,
        patientId: responseBody?.data?.patientId || 'unknown',
        orderCreationTime: 0,
        pdfGenerationTime: 0,
        totalProcessingTime: totalTime,
        testCount: req.body?.values?.length || responseBody?.data?.testCount || 0,
        pdfSize: 0,
        success,
        errorType: success ? undefined : getErrorType(responseBody),
        timestamp: new Date(),
        userId: context.userId,
        priority: 'routine'
    };

    await ManualLabPerformanceService.recordOrderProcessingMetrics(metrics);
}

/**
 * Record data retrieval metrics
 */
async function recordDataRetrievalMetrics(
    req: AuthRequest,
    context: PerformanceContext,
    totalTime: number
): Promise<void> {
    const responseBody = context.metadata?.responseBody;
    const success = context.metadata?.statusCode < 400;

    if (!context.workplaceId || !context.userId) {
        return;
    }

    const metrics: OrderProcessingMetrics = {
        orderId: context.orderId || 'bulk_operation',
        workplaceId: context.workplaceId,
        patientId: req.params?.patientId || req.query?.patientId as string || 'unknown',
        orderCreationTime: 0,
        pdfGenerationTime: 0,
        totalProcessingTime: totalTime,
        testCount: 0,
        pdfSize: 0,
        success,
        errorType: success ? undefined : getErrorType(responseBody),
        timestamp: new Date(),
        userId: context.userId,
        priority: 'routine'
    };

    await ManualLabPerformanceService.recordOrderProcessingMetrics(metrics);
}

/**
 * Record generic operation metrics
 */
async function recordGenericOperationMetrics(
    req: AuthRequest,
    context: PerformanceContext,
    totalTime: number
): Promise<void> {
    const responseBody = context.metadata?.responseBody;
    const success = context.metadata?.statusCode < 400;

    if (!context.workplaceId || !context.userId) {
        return;
    }

    const metrics: OrderProcessingMetrics = {
        orderId: context.orderId || 'generic_operation',
        workplaceId: context.workplaceId,
        patientId: 'unknown',
        orderCreationTime: 0,
        pdfGenerationTime: 0,
        totalProcessingTime: totalTime,
        testCount: 0,
        pdfSize: 0,
        success,
        errorType: success ? undefined : getErrorType(responseBody),
        timestamp: new Date(),
        userId: context.userId,
        priority: 'routine'
    };

    await ManualLabPerformanceService.recordOrderProcessingMetrics(metrics);
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Extract error type from response body
 */
function getErrorType(responseBody: any): string | undefined {
    if (!responseBody || !responseBody.error) {
        return 'UnknownError';
    }

    return responseBody.error.code || responseBody.error.type || 'UnknownError';
}

/**
 * Performance monitoring decorator for service methods
 */
export function MonitorPerformance(operation: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const startTime = Date.now();
            let success = true;
            let errorType: string | undefined;

            try {
                const result = await method.apply(this, args);
                return result;
            } catch (error) {
                success = false;
                errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
                throw error;
            } finally {
                const totalTime = Date.now() - startTime;

                // Log performance info
                logger.info(`${operation} completed`, {
                    operation,
                    duration: totalTime,
                    success,
                    errorType,
                    service: 'manual-lab-performance'
                });

                // Record metrics if we have enough context
                if (args[0] && typeof args[0] === 'object' && args[0].workplaceId) {
                    const metrics: OrderProcessingMetrics = {
                        orderId: args[0].orderId || 'service_operation',
                        workplaceId: args[0].workplaceId.toString(),
                        patientId: args[0].patientId?.toString() || 'unknown',
                        orderCreationTime: 0,
                        pdfGenerationTime: 0,
                        totalProcessingTime: totalTime,
                        testCount: 0,
                        pdfSize: 0,
                        success,
                        errorType,
                        timestamp: new Date(),
                        userId: args[0].userId?.toString() || 'system',
                        priority: 'routine'
                    };

                    ManualLabPerformanceService.recordOrderProcessingMetrics(metrics).catch(err => {
                        logger.error('Failed to record service performance metrics', {
                            operation,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        });
                    });
                }
            }
        };

        return descriptor;
    };
}

export default {
    initializePerformanceTracking,
    finalizePerformanceTracking,
    trackDatabaseQuery,
    trackCacheOperation,
    MonitorPerformance
};