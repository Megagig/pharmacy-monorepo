/**
 * Audit Visualization Service Tests
 * Tests for audit visualization and search capabilities
 */

import { Types } from 'mongoose';
import auditVisualizationService from '../services/auditVisualizationService';
import MTRAuditLog from '../../../models/MTRAuditLog';

// Mock dependencies
jest.mock('../../../models/MTRAuditLog');

const mockMTRAuditLog = MTRAuditLog as jest.Mocked<typeof MTRAuditLog>;

describe('AuditVisualizationService', () => {
    const mockWorkplaceId = new Types.ObjectId().toString();
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateVisualizationData', () => {
        it('should generate comprehensive visualization data', async () => {
            // Mock timeline aggregation
            mockMTRAuditLog.aggregate
                .mockResolvedValueOnce([
                    {
                        _id: { date: '2024-01-01' },
                        events: 10,
                        criticalEvents: 2,
                        eventTypes: ['diagnostic_request_created', 'ai_analysis_completed']
                    },
                    {
                        _id: { date: '2024-01-02' },
                        events: 15,
                        criticalEvents: 1,
                        eventTypes: ['diagnostic_request_created', 'pharmacist_review_completed']
                    }
                ])
                // Mock user activity aggregation
                .mockResolvedValueOnce([
                    {
                        _id: new Types.ObjectId(),
                        totalEvents: 25,
                        lastActivity: new Date('2024-01-02'),
                        riskEvents: 3,
                        eventTypes: ['diagnostic_request_created', 'ai_analysis_completed'],
                        errorCount: 1,
                        user: [{
                            firstName: 'John',
                            lastName: 'Doe'
                        }]
                    }
                ])
                // Mock entity flow aggregation
                .mockResolvedValueOnce([
                    {
                        _id: {
                            entityId: new Types.ObjectId(),
                            entityType: 'diagnostic_request'
                        },
                        eventCount: 5
                    }
                ])
                // Mock risk heatmap aggregation
                .mockResolvedValueOnce([
                    {
                        _id: {
                            category: 'clinical_documentation',
                            riskLevel: 'medium'
                        },
                        count: 10
                    },
                    {
                        _id: {
                            category: 'patient_safety',
                            riskLevel: 'high'
                        },
                        count: 3
                    }
                ]);

            // Mock entity flow events
            mockMTRAuditLog.find.mockResolvedValue([
                {
                    timestamp: new Date('2024-01-01T10:00:00Z'),
                    action: 'diagnostic_request_created',
                    userId: new Types.ObjectId(),
                    details: { patientId: 'patient123' }
                },
                {
                    timestamp: new Date('2024-01-01T10:05:00Z'),
                    action: 'ai_analysis_completed',
                    userId: new Types.ObjectId(),
                    details: { confidence: 0.85 }
                }
            ] as any);

            // Mock compliance metrics
            mockMTRAuditLog.find.mockResolvedValue([
                {
                    action: 'diagnostic_request_created',
                    resourceType: 'diagnostic_request',
                    userId: new Types.ObjectId(),
                    timestamp: new Date()
                }
            ] as any);

            const visualizationData = await auditVisualizationService.generateVisualizationData(
                mockWorkplaceId,
                startDate,
                endDate
            );

            expect(visualizationData).toMatchObject({
                timeline: expect.arrayContaining([
                    expect.objectContaining({
                        date: '2024-01-01',
                        events: 10,
                        criticalEvents: 2,
                        eventTypes: expect.objectContaining({
                            'diagnostic_request_created': expect.any(Number)
                        })
                    })
                ]),
                userActivity: expect.arrayContaining([
                    expect.objectContaining({
                        userId: expect.any(String),
                        userName: 'John Doe',
                        totalEvents: 25,
                        riskScore: expect.any(Number),
                        eventBreakdown: expect.any(Object)
                    })
                ]),
                entityFlow: expect.arrayContaining([
                    expect.objectContaining({
                        entityId: expect.any(String),
                        entityType: 'diagnostic_request',
                        events: expect.arrayContaining([
                            expect.objectContaining({
                                timestamp: expect.any(Date),
                                action: expect.any(String),
                                userId: expect.any(String)
                            })
                        ])
                    })
                ]),
                riskHeatmap: expect.arrayContaining([
                    expect.objectContaining({
                        category: expect.any(String),
                        riskLevel: expect.stringMatching(/low|medium|high|critical/),
                        count: expect.any(Number),
                        percentage: expect.any(Number)
                    })
                ]),
                complianceMetrics: expect.objectContaining({
                    auditCoverage: expect.any(Number),
                    dataIntegrity: expect.any(Number),
                    accessCompliance: expect.any(Number),
                    retentionCompliance: expect.any(Number)
                })
            });
        });

        it('should handle empty data gracefully', async () => {
            mockMTRAuditLog.aggregate.mockResolvedValue([]);
            mockMTRAuditLog.find.mockResolvedValue([]);

            const visualizationData = await auditVisualizationService.generateVisualizationData(
                mockWorkplaceId,
                startDate,
                endDate
            );

            expect(visualizationData.timeline).toHaveLength(0);
            expect(visualizationData.userActivity).toHaveLength(0);
            expect(visualizationData.entityFlow).toHaveLength(0);
            expect(visualizationData.riskHeatmap).toHaveLength(0);
            expect(visualizationData.complianceMetrics).toBeDefined();
        });
    });

    describe('searchAuditEvents', () => {
        it('should perform advanced search with multiple filters', async () => {
            const mockEvents = [
                {
                    _id: new Types.ObjectId(),
                    timestamp: new Date('2024-01-01T10:00:00Z'),
                    action: 'diagnostic_request_created',
                    resourceType: 'diagnostic_request',
                    resourceId: new Types.ObjectId(),
                    userId: {
                        _id: new Types.ObjectId(),
                        firstName: 'John',
                        lastName: 'Doe'
                    },
                    riskLevel: 'medium',
                    complianceCategory: 'clinical_documentation',
                    details: { patientId: 'patient123' },
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0'
                }
            ];

            mockMTRAuditLog.countDocuments.mockResolvedValue(1);
            mockMTRAuditLog.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockEvents)
            } as any);

            // Mock aggregation for search aggregations
            mockMTRAuditLog.aggregate.mockResolvedValue([
                {
                    _id: null,
                    totalEvents: 1,
                    uniqueUsers: [new Types.ObjectId()],
                    uniqueEntities: [new Types.ObjectId()],
                    eventsByType: ['diagnostic_request_created'],
                    eventsByRisk: ['medium'],
                    eventsByCompliance: ['clinical_documentation'],
                    timeDistribution: [10]
                }
            ]);

            const filters = {
                workplaceId: mockWorkplaceId,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                eventTypes: ['diagnostic_request_created'],
                riskLevels: ['medium', 'high'],
                searchText: 'diagnostic'
            };

            const result = await auditVisualizationService.searchAuditEvents(filters, 1, 50);

            expect(result).toMatchObject({
                events: expect.arrayContaining([
                    expect.objectContaining({
                        id: expect.any(String),
                        timestamp: expect.any(Date),
                        action: 'diagnostic_request_created',
                        entityType: 'diagnostic_request',
                        userId: expect.any(String),
                        userName: 'John Doe',
                        riskLevel: 'medium',
                        complianceCategory: 'clinical_documentation'
                    })
                ]),
                aggregations: expect.objectContaining({
                    totalEvents: 1,
                    uniqueUsers: 1,
                    uniqueEntities: 1,
                    eventsByType: expect.objectContaining({
                        'diagnostic_request_created': 1
                    }),
                    eventsByRisk: expect.objectContaining({
                        'medium': 1
                    })
                }),
                pagination: expect.objectContaining({
                    page: 1,
                    limit: 50,
                    total: 1,
                    hasMore: false
                })
            });

            expect(mockMTRAuditLog.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    workplaceId: new Types.ObjectId(mockWorkplaceId),
                    timestamp: expect.objectContaining({
                        $gte: filters.startDate,
                        $lte: filters.endDate
                    }),
                    action: { $in: filters.eventTypes },
                    riskLevel: { $in: filters.riskLevels },
                    $or: expect.arrayContaining([
                        { action: { $regex: 'diagnostic', $options: 'i' } }
                    ])
                })
            );
        });

        it('should handle pagination correctly', async () => {
            mockMTRAuditLog.countDocuments.mockResolvedValue(150);
            mockMTRAuditLog.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            } as any);

            mockMTRAuditLog.aggregate.mockResolvedValue([{
                _id: null,
                totalEvents: 150,
                uniqueUsers: [],
                uniqueEntities: [],
                eventsByType: [],
                eventsByRisk: [],
                eventsByCompliance: [],
                timeDistribution: []
            }]);

            const filters = { workplaceId: mockWorkplaceId };
            const result = await auditVisualizationService.searchAuditEvents(filters, 2, 50);

            expect(result.pagination).toMatchObject({
                page: 2,
                limit: 50,
                total: 150,
                hasMore: true
            });

            expect(mockMTRAuditLog.find().skip).toHaveBeenCalledWith(50); // (page - 1) * limit
            expect(mockMTRAuditLog.find().limit).toHaveBeenCalledWith(50);
        });

        it('should filter by error status', async () => {
            mockMTRAuditLog.countDocuments.mockResolvedValue(0);
            mockMTRAuditLog.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            } as any);

            mockMTRAuditLog.aggregate.mockResolvedValue([]);

            const filters = {
                workplaceId: mockWorkplaceId,
                hasErrors: true
            };

            await auditVisualizationService.searchAuditEvents(filters);

            expect(mockMTRAuditLog.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorMessage: { $ne: null }
                })
            );
        });

        it('should filter by IP addresses and session IDs', async () => {
            mockMTRAuditLog.countDocuments.mockResolvedValue(0);
            mockMTRAuditLog.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            } as any);

            mockMTRAuditLog.aggregate.mockResolvedValue([]);

            const filters = {
                workplaceId: mockWorkplaceId,
                ipAddresses: ['192.168.1.1', '10.0.0.1'],
                sessionIds: ['session123', 'session456']
            };

            await auditVisualizationService.searchAuditEvents(filters);

            expect(mockMTRAuditLog.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    ipAddress: { $in: filters.ipAddresses },
                    sessionId: { $in: filters.sessionIds }
                })
            );
        });
    });

    describe('exportVisualizationData', () => {
        beforeEach(() => {
            // Mock the generateVisualizationData method
            jest.spyOn(auditVisualizationService, 'generateVisualizationData').mockResolvedValue({
                timeline: [
                    {
                        date: '2024-01-01',
                        events: 10,
                        criticalEvents: 2,
                        eventTypes: { 'diagnostic_request_created': 8, 'ai_analysis_completed': 2 }
                    }
                ],
                userActivity: [],
                entityFlow: [],
                riskHeatmap: [],
                complianceMetrics: {
                    auditCoverage: 95,
                    dataIntegrity: 98,
                    accessCompliance: 92,
                    retentionCompliance: 90
                }
            });
        });

        it('should export data in JSON format', async () => {
            const result = await auditVisualizationService.exportVisualizationData(
                mockWorkplaceId,
                startDate,
                endDate,
                'json'
            );

            expect(result.contentType).toBe('application/json');
            expect(result.filename).toMatch(/audit_visualization_\d{4}-\d{2}-\d{2}\.json/);
            expect(JSON.parse(result.data)).toMatchObject({
                timeline: expect.any(Array),
                complianceMetrics: expect.any(Object)
            });
        });

        it('should export data in CSV format', async () => {
            const result = await auditVisualizationService.exportVisualizationData(
                mockWorkplaceId,
                startDate,
                endDate,
                'csv'
            );

            expect(result.contentType).toBe('text/csv');
            expect(result.filename).toMatch(/audit_visualization_\d{4}-\d{2}-\d{2}\.csv/);
            expect(result.data).toContain('Date,Total Events,Critical Events,Top Event Type');
            expect(result.data).toContain('2024-01-01,10,2,diagnostic_request_created');
        });

        it('should export data in PDF format', async () => {
            const result = await auditVisualizationService.exportVisualizationData(
                mockWorkplaceId,
                startDate,
                endDate,
                'pdf'
            );

            expect(result.contentType).toBe('application/pdf');
            expect(result.filename).toMatch(/audit_visualization_\d{4}-\d{2}-\d{2}\.pdf/);
            expect(result.data).toMatchObject({
                title: 'Audit Trail Visualization Report',
                generatedAt: expect.any(Date),
                period: { startDate, endDate },
                workplaceId: mockWorkplaceId,
                visualizationData: expect.any(Object)
            });
        });

        it('should throw error for unsupported format', async () => {
            await expect(
                auditVisualizationService.exportVisualizationData(
                    mockWorkplaceId,
                    startDate,
                    endDate,
                    'xml' as any
                )
            ).rejects.toThrow('Unsupported export format: xml');
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            mockMTRAuditLog.aggregate.mockRejectedValue(new Error('Database connection failed'));

            await expect(
                auditVisualizationService.generateVisualizationData(
                    mockWorkplaceId,
                    startDate,
                    endDate
                )
            ).rejects.toThrow('Failed to generate audit visualization data');
        });

        it('should handle search errors gracefully', async () => {
            mockMTRAuditLog.countDocuments.mockRejectedValue(new Error('Query failed'));

            await expect(
                auditVisualizationService.searchAuditEvents({
                    workplaceId: mockWorkplaceId
                })
            ).rejects.toThrow('Failed to search audit events');
        });
    });
});