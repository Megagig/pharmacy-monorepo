import UnifiedAuditLog, {
    IUnifiedAuditLog,
    IUserDetails,
    IWorkplaceDetails,
    ITargetEntityDetails,
    IChangeDetails,
} from '../models/UnifiedAuditLog';
import { Request } from 'express';
import mongoose from 'mongoose';
import { Parser } from 'json2csv';

/**
 * Unified Audit Service
 * Centralized service for logging and retrieving ALL application activities
 * Provides comprehensive audit trail for super admin visibility
 */

export interface UnifiedAuditLogData {
    userId: mongoose.Types.ObjectId | string;
    workplaceId?: mongoose.Types.ObjectId | string;
    activityType: string;
    action: string;
    description: string;
    targetEntity?: {
        entityType: string;
        entityId: mongoose.Types.ObjectId | string;
        entityName: string;
        additionalInfo?: Record<string, any>;
    };
    changes?: IChangeDetails[];
    metadata?: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory?: 'HIPAA' | 'SOX' | 'GDPR' | 'PCI_DSS' | 'GENERAL';
    success?: boolean;
    errorMessage?: string;
    errorStack?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestMethod?: string;
    requestPath?: string;
    responseStatus?: number;
    location?: {
        country?: string;
        region?: string;
        city?: string;
    };
}

export interface AuditQueryFilters {
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    workplaceId?: string;
    activityType?: string;
    action?: string;
    riskLevel?: string;
    success?: boolean;
    flagged?: boolean;
    complianceCategory?: string;
    searchQuery?: string;
    entityType?: string;
    entityId?: string;
}

export class UnifiedAuditService {
    /**
     * Log an activity to the unified audit trail
     */
    static async logActivity(
        data: UnifiedAuditLogData,
        req?: Request
    ): Promise<IUnifiedAuditLog | null> {
        try {
            const auditData: any = {
                activityType: data.activityType,
                action: data.action,
                description: data.description,
                timestamp: new Date(),
                success: data.success !== undefined ? data.success : true,
                riskLevel: data.riskLevel || this.calculateRiskLevel(data.action, data.activityType),
                metadata: data.metadata || {},
            };

            // Handle userId - may be undefined for login/register actions
            if (data.userId) {
                auditData.userId = new mongoose.Types.ObjectId(data.userId as string);
            } else if (data.metadata?.userEmail && (data.action === 'USER_LOGIN' || data.action === 'USER_REGISTERED')) {
                // For login/register, try to find user by email from metadata
                const User = mongoose.model('User');
                const user = await User.findOne({ email: data.metadata.userEmail }).select('_id workplaceId');
                if (user) {
                    auditData.userId = user._id;
                    if (user.workplaceId) {
                        auditData.workplaceId = user.workplaceId;
                    }
                }
            }

            // Add workplace information
            if (data.workplaceId && !auditData.workplaceId) {
                auditData.workplaceId = new mongoose.Types.ObjectId(data.workplaceId as string);
            }

            // Add target entity information
            if (data.targetEntity) {
                auditData.targetEntity = {
                    entityType: data.targetEntity.entityType,
                    entityId: new mongoose.Types.ObjectId(data.targetEntity.entityId as string),
                    entityName: data.targetEntity.entityName,
                    additionalInfo: data.targetEntity.additionalInfo,
                };
            }

            // Add changes
            if (data.changes && data.changes.length > 0) {
                auditData.changes = data.changes;
            }

            // Add compliance category
            if (data.complianceCategory) {
                auditData.complianceCategory = data.complianceCategory;
            }

            // Add error information
            if (data.errorMessage) {
                auditData.errorMessage = data.errorMessage;
                auditData.errorStack = data.errorStack;
            }

            // Add session information
            if (data.sessionId) {
                auditData.sessionId = data.sessionId;
            }

            // Extract request information
            if (req) {
                auditData.ipAddress = data.ipAddress || this.getClientIP(req);
                auditData.userAgent = data.userAgent || req.get('User-Agent');
                auditData.requestMethod = data.requestMethod || req.method;
                auditData.requestPath = data.requestPath || req.originalUrl;
                auditData.sessionId = auditData.sessionId || (req as any).sessionID;
            } else {
                auditData.ipAddress = data.ipAddress;
                auditData.userAgent = data.userAgent;
                auditData.requestMethod = data.requestMethod;
                auditData.requestPath = data.requestPath;
            }

            if (data.responseStatus) {
                auditData.responseStatus = data.responseStatus;
            }

            // Add location
            if (data.location) {
                auditData.location = data.location;
            }

            const auditLog = new UnifiedAuditLog(auditData);
            await auditLog.save();

            return auditLog;
        } catch (error) {
            console.warn('Error logging unified audit activity:', error);
            // Don't throw - audit logging should not break application flow
            return null;
        }
    }

    /**
     * Get audit trail with filters and pagination
     */
    static async getAuditTrail(filters: AuditQueryFilters = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                startDate,
                endDate,
                userId,
                workplaceId,
                activityType,
                action,
                riskLevel,
                success,
                flagged,
                complianceCategory,
                searchQuery,
                entityType,
                entityId,
            } = filters;

            const query: any = {};

            // Date range filter
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            // User filter
            if (userId) {
                query.userId = new mongoose.Types.ObjectId(userId);
            }

            // Workplace filter
            if (workplaceId) {
                query.workplaceId = new mongoose.Types.ObjectId(workplaceId);
            }

            // Activity type filter
            if (activityType) {
                query.activityType = activityType;
            }

            // Action filter
            if (action) {
                query.action = action;
            }

            // Risk level filter
            if (riskLevel) {
                query.riskLevel = riskLevel;
            }

            // Success filter
            if (success !== undefined) {
                query.success = success;
            }

            // Flagged filter
            if (flagged !== undefined) {
                query.flagged = flagged;
            }

            // Compliance category filter
            if (complianceCategory) {
                query.complianceCategory = complianceCategory;
            }

            // Entity filter
            if (entityType) {
                query['targetEntity.entityType'] = entityType;
            }

            if (entityId) {
                query['targetEntity.entityId'] = new mongoose.Types.ObjectId(entityId);
            }

            // Text search
            if (searchQuery) {
                query.$text = { $search: searchQuery };
            }

            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                UnifiedAuditLog.find(query)
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                UnifiedAuditLog.countDocuments(query),
            ]);

            return {
                logs,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            console.error('Error retrieving audit trail:', error);
            throw new Error('Failed to retrieve audit trail');
        }
    }

    /**
     * Get activity statistics
     */
    static async getActivityStats(
        workplaceId?: string,
        startDate?: Date,
        endDate?: Date
    ) {
        try {
            const matchStage: any = {};

            if (workplaceId) {
                matchStage.workplaceId = new mongoose.Types.ObjectId(workplaceId);
            }

            if (startDate && endDate) {
                matchStage.timestamp = { $gte: startDate, $lte: endDate };
            }

            const stats = await UnifiedAuditLog.aggregate([
                { $match: matchStage },
                {
                    $facet: {
                        totalActivities: [{ $count: 'count' }],
                        activityByType: [
                            {
                                $group: {
                                    _id: '$activityType',
                                    count: { $sum: 1 },
                                },
                            },
                            { $sort: { count: -1 } },
                        ],
                        activityByRisk: [
                            {
                                $group: {
                                    _id: '$riskLevel',
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        failedActivities: [
                            { $match: { success: false } },
                            { $count: 'count' },
                        ],
                        flaggedActivities: [
                            { $match: { flagged: true } },
                            { $count: 'count' },
                        ],
                        topUsers: [
                            {
                                $group: {
                                    _id: '$userId',
                                    count: { $sum: 1 },
                                    userDetails: { $first: '$userDetails' },
                                },
                            },
                            { $sort: { count: -1 } },
                            { $limit: 10 },
                        ],
                        recentCriticalEvents: [
                            { $match: { riskLevel: 'critical' } },
                            { $sort: { timestamp: -1 } },
                            { $limit: 10 },
                        ],
                        activityTrend: [
                            {
                                $group: {
                                    _id: {
                                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                                    },
                                    count: { $sum: 1 },
                                },
                            },
                            { $sort: { '_id.date': -1 } },
                            { $limit: 30 },
                        ],
                    },
                },
            ]);

            // Format response
            const result = stats[0];

            return {
                totalActivities: result.totalActivities[0]?.count || 0,
                activityByType: result.activityByType,
                activityByRisk: result.activityByRisk,
                failedActivities: result.failedActivities[0]?.count || 0,
                flaggedActivities: result.flaggedActivities[0]?.count || 0,
                topUsers: result.topUsers,
                recentCriticalEvents: result.recentCriticalEvents,
                activityTrend: result.activityTrend,
            };
        } catch (error) {
            console.error('Error calculating activity stats:', error);
            throw new Error('Failed to calculate activity statistics');
        }
    }

    /**
     * Get user activity timeline
     */
    static async getUserActivityTimeline(
        userId: string,
        limit: number = 100
    ): Promise<IUnifiedAuditLog[]> {
        try {
            return await UnifiedAuditLog.find({ userId: new mongoose.Types.ObjectId(userId) })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error fetching user activity timeline:', error);
            throw new Error('Failed to fetch user activity timeline');
        }
    }

    /**
     * Get entity activity history
     */
    static async getEntityActivityHistory(
        entityType: string,
        entityId: string,
        limit: number = 100
    ): Promise<IUnifiedAuditLog[]> {
        try {
            return await UnifiedAuditLog.find({
                'targetEntity.entityType': entityType,
                'targetEntity.entityId': new mongoose.Types.ObjectId(entityId),
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error fetching entity activity history:', error);
            throw new Error('Failed to fetch entity activity history');
        }
    }

    /**
     * Export audit data
     */
    static async exportAuditData(
        filters: AuditQueryFilters,
        format: 'json' | 'csv' = 'json'
    ): Promise<string | any[]> {
        try {
            const { logs } = await this.getAuditTrail({ ...filters, limit: 10000 });

            if (format === 'csv') {
                const fields = [
                    'timestamp',
                    'userDetails.firstName',
                    'userDetails.lastName',
                    'userDetails.email',
                    'userDetails.role',
                    'activityType',
                    'action',
                    'description',
                    'targetEntity.entityType',
                    'targetEntity.entityName',
                    'riskLevel',
                    'success',
                    'ipAddress',
                    'complianceCategory',
                ];

                const parser = new Parser({ fields });
                return parser.parse(logs);
            }

            return logs;
        } catch (error) {
            console.error('Error exporting audit data:', error);
            throw new Error('Failed to export audit data');
        }
    }

    /**
     * Flag an audit entry for review
     */
    static async flagAuditEntry(
        auditId: string,
        flagged: boolean = true
    ): Promise<IUnifiedAuditLog | null> {
        try {
            return await UnifiedAuditLog.findByIdAndUpdate(
                auditId,
                { flagged },
                { new: true }
            );
        } catch (error) {
            console.error('Error flagging audit entry:', error);
            throw new Error('Failed to flag audit entry');
        }
    }

    /**
     * Review an audit entry
     */
    static async reviewAuditEntry(
        auditId: string,
        reviewedBy: string,
        reviewNotes: string
    ): Promise<IUnifiedAuditLog | null> {
        try {
            return await UnifiedAuditLog.findByIdAndUpdate(
                auditId,
                {
                    reviewedBy: new mongoose.Types.ObjectId(reviewedBy),
                    reviewedAt: new Date(),
                    reviewNotes,
                    flagged: false,
                },
                { new: true }
            );
        } catch (error) {
            console.error('Error reviewing audit entry:', error);
            throw new Error('Failed to review audit entry');
        }
    }

    /**
     * Calculate risk level based on action and activity type
     */
    private static calculateRiskLevel(
        action: string,
        activityType: string
    ): 'low' | 'medium' | 'high' | 'critical' {
        const criticalActions = [
            'USER_DELETED',
            'PATIENT_DELETED',
            'DATA_EXPORTED',
            'SYSTEM_CONFIGURATION_CHANGED',
            'SECURITY_BREACH',
            'UNAUTHORIZED_ACCESS',
            'PERMISSION_ESCALATION',
        ];

        const highActions = [
            'USER_SUSPENDED',
            'WORKSPACE_DELETED',
            'MEDICATION_DELETED',
            'FAILED_LOGIN_MULTIPLE',
            'PASSWORD_RESET',
        ];

        const mediumActions = [
            'USER_CREATED',
            'PATIENT_UPDATED',
            'MEDICATION_PRESCRIBED',
            'MTR_SESSION_COMPLETED',
        ];

        if (criticalActions.some((a) => action.includes(a))) {
            return 'critical';
        }

        if (highActions.some((a) => action.includes(a))) {
            return 'high';
        }

        if (mediumActions.some((a) => action.includes(a))) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Get client IP address from request
     */
    private static getClientIP(req: Request): string {
        return (
            (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
            req.headers['x-real-ip'] as string ||
            req.socket.remoteAddress ||
            'unknown'
        );
    }

    /**
     * Search audit logs
     */
    static async searchAuditLogs(
        searchTerm: string,
        limit: number = 50
    ): Promise<IUnifiedAuditLog[]> {
        try {
            return await UnifiedAuditLog.find({
                $text: { $search: searchTerm },
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error searching audit logs:', error);
            throw new Error('Failed to search audit logs');
        }
    }
}

export default UnifiedAuditService;
