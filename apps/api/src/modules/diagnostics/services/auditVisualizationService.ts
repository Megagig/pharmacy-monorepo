/**
 * Audit Visualization Service
 * Provides audit trail visualization and search capabilities
 */

import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import diagnosticAuditService from './diagnosticAuditService';
import MTRAuditLog from '../../../models/MTRAuditLog';

export interface AuditVisualizationData {
    timeline: Array<{
        date: string;
        events: number;
        criticalEvents: number;
        eventTypes: { [key: string]: number };
    }>;

    userActivity: Array<{
        userId: string;
        userName?: string;
        totalEvents: number;
        riskScore: number;
        lastActivity: Date;
        eventBreakdown: { [key: string]: number };
    }>;

    entityFlow: Array<{
        entityId: string;
        entityType: string;
        events: Array<{
            timestamp: Date;
            action: string;
            userId: string;
            details: any;
        }>;
    }>;

    riskHeatmap: Array<{
        category: string;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        count: number;
        percentage: number;
        trend: 'increasing' | 'decreasing' | 'stable';
    }>;

    complianceMetrics: {
        auditCoverage: number;
        dataIntegrity: number;
        accessCompliance: number;
        retentionCompliance: number;
    };
}

export interface AuditSearchFilters {
    workplaceId: string;
    startDate?: Date;
    endDate?: Date;
    userIds?: string[];
    eventTypes?: string[];
    entityTypes?: string[];
    entityIds?: string[];
    riskLevels?: string[];
    searchText?: string;
    ipAddresses?: string[];
    sessionIds?: string[];
    hasErrors?: boolean;
    complianceCategories?: string[];
}

export interface AuditSearchResult {
    events: Array<{
        id: string;
        timestamp: Date;
        action: string;
        entityType: string;
        entityId: string;
        userId: string;
        userName?: string;
        riskLevel: string;
        complianceCategory: string;
        details: any;
        ipAddress?: string;
        userAgent?: string;
        duration?: number;
        errorMessage?: string;
        changedFields?: string[];
        relatedEvents?: string[];
    }>;

    aggregations: {
        totalEvents: number;
        uniqueUsers: number;
        uniqueEntities: number;
        eventsByType: { [key: string]: number };
        eventsByRisk: { [key: string]: number };
        eventsByCompliance: { [key: string]: number };
        timeDistribution: { [key: string]: number };
    };

    pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

class AuditVisualizationService {
    /**
     * Generate comprehensive audit visualization data
     */
    async generateVisualizationData(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData> {
        try {
            logger.info('Generating audit visualization data', {
                workplaceId,
                period: { startDate, endDate }
            });

            const [
                timeline,
                userActivity,
                entityFlow,
                riskHeatmap,
                complianceMetrics
            ] = await Promise.all([
                this.generateTimeline(workplaceId, startDate, endDate),
                this.generateUserActivity(workplaceId, startDate, endDate),
                this.generateEntityFlow(workplaceId, startDate, endDate),
                this.generateRiskHeatmap(workplaceId, startDate, endDate),
                this.calculateComplianceMetrics(workplaceId, startDate, endDate)
            ]);

            return {
                timeline,
                userActivity,
                entityFlow,
                riskHeatmap,
                complianceMetrics
            };
        } catch (error) {
            logger.error('Error generating audit visualization data:', error);
            throw new Error('Failed to generate audit visualization data');
        }
    }

    /**
     * Advanced audit search with filters and aggregations
     */
    async searchAuditEvents(
        filters: AuditSearchFilters,
        page: number = 1,
        limit: number = 50
    ): Promise<AuditSearchResult> {
        try {
            // Build MongoDB query
            const query: any = {
                workplaceId: new Types.ObjectId(filters.workplaceId)
            };

            // Date range filter
            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate) query.timestamp.$gte = filters.startDate;
                if (filters.endDate) query.timestamp.$lte = filters.endDate;
            }

            // User filter
            if (filters.userIds?.length) {
                query.userId = { $in: filters.userIds.map(id => new Types.ObjectId(id)) };
            }

            // Event type filter
            if (filters.eventTypes?.length) {
                query.action = { $in: filters.eventTypes };
            }

            // Entity type filter
            if (filters.entityTypes?.length) {
                query.resourceType = { $in: filters.entityTypes };
            }

            // Entity ID filter
            if (filters.entityIds?.length) {
                query.resourceId = { $in: filters.entityIds.map(id => new Types.ObjectId(id)) };
            }

            // Risk level filter
            if (filters.riskLevels?.length) {
                query.riskLevel = { $in: filters.riskLevels };
            }

            // IP address filter
            if (filters.ipAddresses?.length) {
                query.ipAddress = { $in: filters.ipAddresses };
            }

            // Session ID filter
            if (filters.sessionIds?.length) {
                query.sessionId = { $in: filters.sessionIds };
            }

            // Error filter
            if (filters.hasErrors !== undefined) {
                if (filters.hasErrors) {
                    query.errorMessage = { $ne: null };
                } else {
                    query.errorMessage = null;
                }
            }

            // Compliance category filter
            if (filters.complianceCategories?.length) {
                query.complianceCategory = { $in: filters.complianceCategories };
            }

            // Text search
            if (filters.searchText) {
                query.$or = [
                    { action: { $regex: filters.searchText, $options: 'i' } },
                    { 'details.description': { $regex: filters.searchText, $options: 'i' } },
                    { errorMessage: { $regex: filters.searchText, $options: 'i' } }
                ];
            }

            // Get total count
            const total = await MTRAuditLog.countDocuments(query);

            // Get paginated results with population
            const events = await MTRAuditLog.find(query)
                .populate('userId', 'firstName lastName email')
                .populate('patientId', 'firstName lastName mrn')
                .sort({ timestamp: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            // Generate aggregations
            const aggregations = await this.generateAggregations(query);

            // Transform events for response
            const transformedEvents = events.map(event => ({
                id: event._id.toString(),
                timestamp: event.timestamp,
                action: event.action,
                entityType: event.resourceType,
                entityId: event.resourceId.toString(),
                userId: event.userId.toString(),
                userName: event.userId ? `${(event.userId as any).firstName} ${(event.userId as any).lastName}` : undefined,
                riskLevel: event.riskLevel,
                complianceCategory: event.complianceCategory,
                details: event.details,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                duration: event.duration,
                errorMessage: event.errorMessage,
                changedFields: event.changedFields,
                relatedEvents: [] // Would implement event correlation
            }));

            return {
                events: transformedEvents,
                aggregations,
                pagination: {
                    page,
                    limit,
                    total,
                    hasMore: (page * limit) < total
                }
            };
        } catch (error) {
            logger.error('Error searching audit events:', error);
            throw new Error('Failed to search audit events');
        }
    }

    /**
     * Generate timeline visualization data
     */
    private async generateTimeline(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData['timeline']> {
        const pipeline = [
            {
                $match: {
                    workplaceId: new Types.ObjectId(workplaceId),
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    events: { $sum: 1 },
                    criticalEvents: {
                        $sum: { $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0] }
                    },
                    eventTypes: { $push: '$action' }
                }
            },
            {
                $sort: { '_id.date': 1 as 1 }
            }
        ];

        const results = await MTRAuditLog.aggregate(pipeline);

        return results.map(result => {
            const eventTypeCounts: { [key: string]: number } = {};
            result.eventTypes.forEach((type: string) => {
                eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
            });

            return {
                date: result._id.date,
                events: result.events,
                criticalEvents: result.criticalEvents,
                eventTypes: eventTypeCounts
            };
        });
    }

    /**
     * Generate user activity analysis
     */
    private async generateUserActivity(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData['userActivity']> {
        const pipeline = [
            {
                $match: {
                    workplaceId: new Types.ObjectId(workplaceId),
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalEvents: { $sum: 1 },
                    lastActivity: { $max: '$timestamp' },
                    riskEvents: {
                        $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] }
                    },
                    eventTypes: { $push: '$action' },
                    errorCount: {
                        $sum: { $cond: [{ $ne: ['$errorMessage', null] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $sort: { totalEvents: -1 as -1 }
            }
        ];

        const results = await MTRAuditLog.aggregate(pipeline);

        return results.map(result => {
            const eventBreakdown: { [key: string]: number } = {};
            result.eventTypes.forEach((type: string) => {
                eventBreakdown[type] = (eventBreakdown[type] || 0) + 1;
            });

            // Calculate risk score based on various factors
            const riskScore = Math.min(100,
                (result.riskEvents / result.totalEvents) * 50 +
                (result.errorCount / result.totalEvents) * 30 +
                (result.totalEvents > 100 ? 20 : 0) // High activity volume
            );

            const user = result.user[0];

            return {
                userId: result._id.toString(),
                userName: user ? `${user.firstName} ${user.lastName}` : undefined,
                totalEvents: result.totalEvents,
                riskScore: Math.round(riskScore),
                lastActivity: result.lastActivity,
                eventBreakdown
            };
        });
    }

    /**
     * Generate entity flow analysis
     */
    private async generateEntityFlow(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData['entityFlow']> {
        // Get top entities by activity
        const topEntities = await MTRAuditLog.aggregate([
            {
                $match: {
                    workplaceId: new Types.ObjectId(workplaceId),
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        entityId: '$resourceId',
                        entityType: '$resourceType'
                    },
                    eventCount: { $sum: 1 }
                }
            },
            {
                $sort: { eventCount: -1 }
            },
            {
                $limit: 20
            }
        ]);

        const entityFlows = await Promise.all(
            topEntities.map(async (entity) => {
                const events = await MTRAuditLog.find({
                    workplaceId: new Types.ObjectId(workplaceId),
                    resourceId: entity._id.entityId,
                    resourceType: entity._id.entityType,
                    timestamp: { $gte: startDate, $lte: endDate }
                })
                    .populate('userId', 'firstName lastName')
                    .sort({ timestamp: 1 })
                    .limit(50);

                return {
                    entityId: entity._id.entityId.toString(),
                    entityType: entity._id.entityType,
                    events: events.map(event => ({
                        timestamp: event.timestamp,
                        action: event.action,
                        userId: event.userId.toString(),
                        details: event.details
                    }))
                };
            })
        );

        return entityFlows;
    }

    /**
     * Generate risk heatmap data
     */
    private async generateRiskHeatmap(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData['riskHeatmap']> {
        const pipeline = [
            {
                $match: {
                    workplaceId: new Types.ObjectId(workplaceId),
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        category: '$complianceCategory',
                        riskLevel: '$riskLevel'
                    },
                    count: { $sum: 1 }
                }
            }
        ];

        const results = await MTRAuditLog.aggregate(pipeline);
        const totalEvents = results.reduce((sum, r) => sum + r.count, 0);

        // Group by category and calculate trends (simplified)
        const categoryMap = new Map<string, any>();
        results.forEach(result => {
            const category = result._id.category;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, {
                    category,
                    riskLevels: { low: 0, medium: 0, high: 0, critical: 0 },
                    total: 0
                });
            }

            const categoryData = categoryMap.get(category);
            categoryData.riskLevels[result._id.riskLevel] = result.count;
            categoryData.total += result.count;
        });

        return Array.from(categoryMap.values()).map(data => {
            // Determine overall risk level for category
            const { critical, high, medium, low } = data.riskLevels;
            let overallRisk: 'low' | 'medium' | 'high' | 'critical';

            if (critical > 0) overallRisk = 'critical';
            else if (high > data.total * 0.1) overallRisk = 'high';
            else if (medium > data.total * 0.3) overallRisk = 'medium';
            else overallRisk = 'low';

            return {
                category: data.category,
                riskLevel: overallRisk,
                count: data.total,
                percentage: totalEvents > 0 ? (data.total / totalEvents) * 100 : 0,
                trend: 'stable' as const // Would implement trend analysis
            };
        });
    }

    /**
     * Calculate compliance metrics
     */
    private async calculateComplianceMetrics(
        workplaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditVisualizationData['complianceMetrics']> {
        const auditLogs = await MTRAuditLog.find({
            workplaceId: new Types.ObjectId(workplaceId),
            timestamp: { $gte: startDate, $lte: endDate }
        });

        const totalLogs = auditLogs.length;
        const completeLogsCount = auditLogs.filter(log =>
            log.action && log.resourceType && log.userId && log.timestamp
        ).length;

        const accessViolations = auditLogs.filter(log =>
            log.action === 'security_violation' || log.riskLevel === 'critical'
        ).length;

        return {
            auditCoverage: totalLogs > 0 ? (completeLogsCount / totalLogs) * 100 : 100,
            dataIntegrity: 95, // Would implement checksum validation
            accessCompliance: Math.max(0, 100 - (accessViolations / totalLogs) * 100),
            retentionCompliance: 90 // Would implement retention policy checking
        };
    }

    /**
     * Generate search aggregations
     */
    private async generateAggregations(query: any): Promise<AuditSearchResult['aggregations']> {
        const pipeline = [
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' },
                    uniqueEntities: { $addToSet: '$resourceId' },
                    eventsByType: { $push: '$action' },
                    eventsByRisk: { $push: '$riskLevel' },
                    eventsByCompliance: { $push: '$complianceCategory' },
                    timeDistribution: { $push: { $hour: '$timestamp' } }
                }
            }
        ];

        const result = await MTRAuditLog.aggregate(pipeline);
        const data = result[0] || {
            totalEvents: 0,
            uniqueUsers: [],
            uniqueEntities: [],
            eventsByType: [],
            eventsByRisk: [],
            eventsByCompliance: [],
            timeDistribution: []
        };

        // Count occurrences
        const countOccurrences = (arr: any[]) => {
            return arr.reduce((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
            }, {});
        };

        return {
            totalEvents: data.totalEvents,
            uniqueUsers: data.uniqueUsers.length,
            uniqueEntities: data.uniqueEntities.length,
            eventsByType: countOccurrences(data.eventsByType),
            eventsByRisk: countOccurrences(data.eventsByRisk),
            eventsByCompliance: countOccurrences(data.eventsByCompliance),
            timeDistribution: countOccurrences(data.timeDistribution)
        };
    }

    /**
     * Export audit visualization data
     */
    async exportVisualizationData(
        workplaceId: string,
        startDate: Date,
        endDate: Date,
        format: 'json' | 'csv' | 'pdf' = 'json'
    ): Promise<{ data: any; filename: string; contentType: string }> {
        const visualizationData = await this.generateVisualizationData(workplaceId, startDate, endDate);

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `audit_visualization_${timestamp}.${format}`;

        switch (format) {
            case 'json':
                return {
                    data: JSON.stringify(visualizationData, null, 2),
                    filename,
                    contentType: 'application/json'
                };

            case 'csv':
                // Convert timeline data to CSV
                const csvHeaders = ['Date', 'Total Events', 'Critical Events', 'Top Event Type'];
                const csvRows = visualizationData.timeline.map(item => [
                    item.date,
                    item.events.toString(),
                    item.criticalEvents.toString(),
                    Object.keys(item.eventTypes)[0] || 'N/A'
                ]);

                const csvContent = [
                    csvHeaders.join(','),
                    ...csvRows.map(row => row.join(','))
                ].join('\n');

                return {
                    data: csvContent,
                    filename,
                    contentType: 'text/csv'
                };

            case 'pdf':
                // Return structured data for PDF generation
                return {
                    data: {
                        title: 'Audit Trail Visualization Report',
                        generatedAt: new Date(),
                        period: { startDate, endDate },
                        workplaceId,
                        visualizationData
                    },
                    filename,
                    contentType: 'application/pdf'
                };

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
}

export default new AuditVisualizationService();