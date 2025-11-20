import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import CommunicationAuditService from '../services/communicationAuditService';
import mongoose from 'mongoose';
import logger from '../utils/logger';

// Extend Request interface for communication audit data
declare global {
    namespace Express {
        interface Request {
            communicationAuditData?: {
                action: string;
                targetType: 'conversation' | 'message' | 'user' | 'file' | 'notification';
                startTime: number;
                details: any;
            };
        }
    }
}

/**
 * Middleware to capture communication audit data
 */
export const captureCommunicationAuditData = (
    action: string,
    targetType: 'conversation' | 'message' | 'user' | 'file' | 'notification'
) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        req.communicationAuditData = {
            action,
            targetType,
            startTime: Date.now(),
            details: {
                method: req.method,
                url: req.originalUrl,
                params: req.params,
                query: req.query,
                body: req.method !== 'GET' ? req.body : undefined,
            },
        };

        next();
    };
};

/**
 * Middleware to log communication audit trail after request completion
 */
export const logCommunicationAuditTrail = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (body: any) {
        // Log audit trail asynchronously
        if (req.communicationAuditData && req.user) {
            const duration = Date.now() - req.communicationAuditData.startTime;
            const success = res.statusCode >= 200 && res.statusCode < 400;

            // Extract target ID from response or params
            let targetId: mongoose.Types.ObjectId;

            if (body?.data?._id) {
                targetId = new mongoose.Types.ObjectId(body.data._id);
            } else if (req.params.id) {
                targetId = new mongoose.Types.ObjectId(req.params.id);
            } else if (body?._id) {
                targetId = new mongoose.Types.ObjectId(body._id);
            } else {
                // Generate a placeholder ID for operations without specific targets
                targetId = new mongoose.Types.ObjectId();
            }

            // Create audit context
            const context = CommunicationAuditService.createAuditContext(req);

            // Prepare audit details
            const auditDetails: any = {
                ...req.communicationAuditData.details,
                responseStatus: res.statusCode,
                success,
                duration,
            };

            // Extract conversation and patient IDs from various sources
            const conversationId = req.params.id || req.body.conversationId || body?.data?.conversationId;
            const patientId = req.params.patientId || req.body.patientId || body?.data?.patientId;

            if (conversationId) {
                auditDetails.conversationId = new mongoose.Types.ObjectId(conversationId);
            }
            if (patientId) {
                auditDetails.patientId = new mongoose.Types.ObjectId(patientId);
            }

            // Add action-specific metadata
            auditDetails.metadata = extractActionMetadata(req, body);

            // Log the audit trail
            CommunicationAuditService.createAuditLog(context, {
                action: req.communicationAuditData.action as any,
                targetId,
                targetType: req.communicationAuditData.targetType,
                details: auditDetails,
                success,
                errorMessage: success ? undefined : body?.message || 'Operation failed',
                duration,
            }).catch(error => {
                logger.error('Failed to create communication audit log', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    action: req.communicationAuditData?.action,
                    userId: req.user?._id,
                    service: 'communication-audit-middleware',
                });
            });
        }

        // Call original json method
        return originalJson.call(this, body);
    };

    next();
};

/**
 * Extract action-specific metadata from request and response
 */
function extractActionMetadata(req: AuthRequest, responseBody: any): any {
    const metadata: any = {};

    switch (req.communicationAuditData?.action) {
        case 'message_sent':
            metadata.messageType = req.body?.content?.type || 'text';
            metadata.hasAttachments = Boolean(req.body?.content?.attachments?.length);
            metadata.mentionCount = req.body?.mentions?.length || 0;
            metadata.priority = req.body?.priority || 'normal';
            metadata.threadId = req.body?.threadId;
            metadata.parentMessageId = req.body?.parentMessageId;
            break;

        case 'conversation_created':
            metadata.conversationType = req.body?.type;
            metadata.participantCount = req.body?.participants?.length || 0;
            metadata.priority = req.body?.priority || 'normal';
            metadata.tags = req.body?.tags || [];
            break;

        case 'participant_added':
            metadata.addedUserId = req.body?.userId;
            metadata.role = req.body?.role;
            break;

        case 'participant_removed':
            metadata.removedUserId = req.params?.userId;
            break;

        case 'file_uploaded':
            if (req.files && Array.isArray(req.files)) {
                metadata.fileCount = req.files.length;
                metadata.totalSize = req.files.reduce((sum: number, file: any) => sum + (file.size || 0), 0);
                metadata.fileTypes = req.files.map((file: any) => file.mimetype);
            }
            break;

        case 'conversation_search':
        case 'message_search':
            metadata.searchQuery = req.query?.q;
            metadata.filters = {
                type: req.query?.type,
                priority: req.query?.priority,
                dateFrom: req.query?.dateFrom,
                dateTo: req.query?.dateTo,
            };
            metadata.resultCount = responseBody?.data?.length || 0;
            break;

        case 'conversation_exported':
            metadata.exportFormat = req.query?.format || 'json';
            metadata.messageCount = responseBody?.messageCount || 0;
            break;

        default:
            // Generic metadata for other actions
            if (responseBody?.data) {
                metadata.responseDataType = Array.isArray(responseBody.data) ? 'array' : 'object';
                metadata.responseCount = Array.isArray(responseBody.data) ? responseBody.data.length : 1;
            }
            break;
    }

    return metadata;
}

/**
 * Middleware for message-related operations
 */
export const auditMessage = (action: 'message_sent' | 'message_read' | 'message_edited' | 'message_deleted') => {
    return [
        captureCommunicationAuditData(action, 'message'),
        logCommunicationAuditTrail,
    ];
};

/**
 * Middleware for conversation-related operations
 */
export const auditConversation = (action: 'conversation_created' | 'conversation_updated' | 'conversation_archived' | 'participant_added' | 'participant_removed') => {
    return [
        captureCommunicationAuditData(action, 'conversation'),
        logCommunicationAuditTrail,
    ];
};

/**
 * Middleware for file-related operations
 */
export const auditFile = (action: 'file_uploaded' | 'file_downloaded' | 'file_deleted') => {
    return [
        captureCommunicationAuditData(action, 'file'),
        logCommunicationAuditTrail,
    ];
};

/**
 * Middleware for search operations
 */
export const auditSearch = (action: 'conversation_search' | 'message_search') => {
    return [
        captureCommunicationAuditData(action, 'conversation'),
        logCommunicationAuditTrail,
    ];
};

/**
 * Middleware for notification operations
 */
export const auditNotification = (action: 'notification_sent' | 'notification_read') => {
    return [
        captureCommunicationAuditData(action, 'notification'),
        logCommunicationAuditTrail,
    ];
};

/**
 * Manual audit logging for specific communication events
 */
export const logCommunicationEvent = async (
    req: AuthRequest,
    action: string,
    targetId: string,
    targetType: 'conversation' | 'message' | 'user' | 'file' | 'notification',
    details: any = {}
): Promise<void> => {
    if (!req.user) {
        logger.warn('Cannot create communication audit log: No user in request');
        return;
    }

    try {
        const context = CommunicationAuditService.createAuditContext(req);

        await CommunicationAuditService.createAuditLog(context, {
            action: action as any,
            targetId: new mongoose.Types.ObjectId(targetId),
            targetType,
            details,
            success: true,
        });
    } catch (error) {
        logger.error('Failed to create manual communication audit log', {
            error: error instanceof Error ? error.message : 'Unknown error',
            action,
            targetId,
            targetType,
            userId: req.user._id,
            service: 'communication-audit-middleware',
        });
    }
};

/**
 * Middleware to audit patient-related communication access
 */
export const auditPatientCommunicationAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const patientId = req.params.patientId || req.body.patientId || req.query.patientId;

        if (req.user && patientId) {
            await logCommunicationEvent(
                req,
                'patient_communication_accessed',
                patientId,
                'user',
                {
                    patientId: new mongoose.Types.ObjectId(patientId),
                    accessType: 'communication_review',
                    method: req.method,
                    url: req.originalUrl,
                    metadata: {
                        timestamp: new Date(),
                        accessReason: 'patient_communication_management',
                    },
                }
            );
        }
    } catch (error) {
        logger.error('Failed to audit patient communication access', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?._id,
            patientId: req.params.patientId,
            service: 'communication-audit-middleware',
        });
    }

    next();
};

/**
 * Middleware to audit bulk operations
 */
export const auditBulkOperation = (action: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        // Store original res.json to intercept response
        const originalJson = res.json;

        res.json = function (body: any) {
            // Log bulk operation audit trail
            if (req.user && req.body?.ids && Array.isArray(req.body.ids)) {
                const context = CommunicationAuditService.createAuditContext(req);
                const targetIds = req.body.ids.map((id: string) => new mongoose.Types.ObjectId(id));

                CommunicationAuditService.logBulkOperation(
                    context,
                    `bulk_${action}`,
                    targetIds,
                    'message', // Default to message for bulk operations
                    {
                        metadata: {
                            bulkAction: action,
                            targetCount: targetIds.length,
                            success: res.statusCode >= 200 && res.statusCode < 400,
                            responseStatus: res.statusCode,
                        },
                    }
                ).catch(error => {
                    logger.error('Failed to create bulk operation audit log', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        action,
                        targetCount: targetIds.length,
                        userId: req.user?._id,
                        service: 'communication-audit-middleware',
                    });
                });
            }

            return originalJson.call(this, body);
        };

        next();
    };
};

/**
 * Middleware to audit high-risk operations
 */
export const auditHighRiskOperation = (action: string, riskLevel: 'high' | 'critical' = 'high') => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (req.user) {
                const context = CommunicationAuditService.createAuditContext(req);
                const targetId = req.params.id || req.body.id || new mongoose.Types.ObjectId();

                // Log the high-risk operation attempt
                await CommunicationAuditService.createAuditLog(context, {
                    action: action as any,
                    targetId: new mongoose.Types.ObjectId(targetId),
                    targetType: 'conversation',
                    details: {
                        metadata: {
                            riskLevel,
                            operationType: 'high_risk',
                            requestDetails: {
                                method: req.method,
                                url: req.originalUrl,
                                params: req.params,
                                query: req.query,
                            },
                        },
                    },
                    success: true, // Will be updated after operation
                });

                logger.warn('High-risk communication operation attempted', {
                    action,
                    riskLevel,
                    userId: req.user._id,
                    targetId,
                    ipAddress: req.ip,
                    service: 'communication-audit-middleware',
                });
            }
        } catch (error) {
            logger.error('Failed to audit high-risk operation', {
                error: error instanceof Error ? error.message : 'Unknown error',
                action,
                riskLevel,
                userId: req.user?._id,
                service: 'communication-audit-middleware',
            });
        }

        next();
    };
};

export default {
    captureCommunicationAuditData,
    logCommunicationAuditTrail,
    auditMessage,
    auditConversation,
    auditFile,
    auditSearch,
    auditNotification,
    logCommunicationEvent,
    auditPatientCommunicationAccess,
    auditBulkOperation,
    auditHighRiskOperation,
};