/**
 * Audit Controller Tests
 * Tests for audit API endpoints and compliance reporting
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import auditController from '../controllers/auditController';
import diagnosticAuditService from '../services/diagnosticAuditService';
import { AuthRequest } from '../../../types/auth';

// Mock the audit service
jest.mock('../services/diagnosticAuditService');

const mockAuditService = diagnosticAuditService as jest.Mocked<typeof diagnosticAuditService>;

describe('AuditController', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });

        mockReq = {
            user: {
                _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
                workplaceId: new Types.ObjectId('507f1f77bcf86cd799439012'),
                role: 'pharmacist'
            },
            query: {},
            params: {},
            body: {},
            ip: '192.168.1.1',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
            headers: { 'x-request-id': 'req-123' }
        };

        mockRes = {
            json: mockJson,
            status: mockStatus,
            setHeader: jest.fn(),
            send: jest.fn()
        };

        jest.clearAllMocks();
    });

    describe('searchAuditEvents', () => {
        it('should search audit events successfully', async () => {
            const mockResults = {
                events: [
                    {
                        userId: 'user123',
                        action: 'diagnostic_request_created',
                        timestamp: new Date(),
                        details: { entityType: 'diagnostic_request' }
                    }
                ],
                total: 1,
                hasMore: false
            };

            mockAuditService.searchAuditEvents.mockResolvedValue(mockResults);

            await auditController.searchAuditEvents(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.searchAuditEvents).toHaveBeenCalledWith({
                workplaceId: 'workplace123',
                limit: 50,
                offset: 0
            });

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    events: mockResults.events,
                    pagination: {
                        total: 1,
                        limit: 50,
                        offset: 0,
                        hasMore: false
                    }
                }
            });
        });

        it('should handle query parameters correctly', async () => {
            mockReq.query = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                eventTypes: 'diagnostic_request_created,ai_analysis_completed',
                entityTypes: 'diagnostic_request,diagnostic_result',
                userIds: 'user1,user2',
                patientIds: 'patient1,patient2',
                severity: 'high,critical',
                entityId: 'entity123',
                searchText: 'test search',
                limit: '25',
                offset: '10'
            };

            const mockResults = { events: [], total: 0, hasMore: false };
            mockAuditService.searchAuditEvents.mockResolvedValue(mockResults);

            await auditController.searchAuditEvents(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.searchAuditEvents).toHaveBeenCalledWith({
                workplaceId: 'workplace123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                eventTypes: ['diagnostic_request_created', 'ai_analysis_completed'],
                entityTypes: ['diagnostic_request', 'diagnostic_result'],
                userIds: ['user1', 'user2'],
                patientIds: ['patient1', 'patient2'],
                severity: ['high', 'critical'],
                entityId: 'entity123',
                searchText: 'test search',
                limit: 25,
                offset: 10
            });
        });

        it('should handle search errors', async () => {
            mockAuditService.searchAuditEvents.mockRejectedValue(
                new Error('Database connection failed')
            );

            await auditController.searchAuditEvents(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'AUDIT_SEARCH_ERROR',
                    message: 'Failed to search audit events',
                    details: 'Database connection failed'
                }
            });
        });
    });

    describe('getEntityAuditTrail', () => {
        it('should get entity audit trail successfully', async () => {
            mockReq.params = {
                entityType: 'diagnostic_request',
                entityId: 'request123'
            };

            const mockAuditTrail = [
                {
                    userId: 'user123',
                    action: 'diagnostic_request_created',
                    timestamp: new Date()
                },
                {
                    userId: 'user123',
                    action: 'ai_analysis_completed',
                    timestamp: new Date()
                }
            ];

            mockAuditService.getEntityAuditTrail.mockResolvedValue(mockAuditTrail);

            await auditController.getEntityAuditTrail(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getEntityAuditTrail).toHaveBeenCalledWith(
                'diagnostic_request',
                'request123',
                'workplace123'
            );

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    entityType: 'diagnostic_request',
                    entityId: 'request123',
                    auditTrail: mockAuditTrail
                }
            });
        });

        it('should handle missing parameters', async () => {
            mockReq.params = { entityType: 'diagnostic_request' }; // Missing entityId

            await auditController.getEntityAuditTrail(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Entity type and ID are required'
                }
            });
        });
    });

    describe('generateComplianceReport', () => {
        it('should generate compliance report successfully', async () => {
            mockReq.query = {
                reportType: 'hipaa',
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            };

            const mockReport = {
                reportId: 'report123',
                workplaceId: 'workplace123',
                reportType: 'hipaa' as const,
                period: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31')
                },
                generatedAt: new Date(),
                generatedBy: 'user123',
                summary: {
                    totalEvents: 100,
                    criticalEvents: 2,
                    securityViolations: 1,
                    dataAccessEvents: 5,
                    aiUsageEvents: 50,
                    consentEvents: 10
                },
                findings: [],
                dataRetention: {
                    totalRecords: 1000,
                    recordsNearingExpiry: 50,
                    expiredRecords: 5,
                    retentionPolicy: '7 years'
                },
                aiUsage: {
                    totalRequests: 50,
                    uniqueUsers: 10,
                    averageConfidence: 0.85,
                    modelUsage: {}
                },
                complianceStatus: {
                    hipaaCompliant: true,
                    gdprCompliant: true,
                    issues: [],
                    recommendations: []
                }
            };

            mockAuditService.generateComplianceReport.mockResolvedValue(mockReport);

            await auditController.generateComplianceReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.generateComplianceReport).toHaveBeenCalledWith(
                'workplace123',
                'hipaa',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                'user123'
            );

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockReport
            });
        });

        it('should handle missing parameters', async () => {
            mockReq.query = { reportType: 'hipaa' }; // Missing dates

            await auditController.generateComplianceReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'MISSING_PARAMETERS',
                    message: 'Report type, start date, and end date are required'
                }
            });
        });

        it('should handle invalid report type', async () => {
            mockReq.query = {
                reportType: 'invalid_type',
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            };

            await auditController.generateComplianceReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INVALID_REPORT_TYPE',
                    message: 'Report type must be one of: hipaa, gdpr, audit_trail, data_access, ai_usage'
                }
            });
        });
    });

    describe('logSecurityViolation', () => {
        it('should log security violation successfully', async () => {
            mockReq.body = {
                violationType: 'unauthorized_access',
                details: {
                    attemptedResource: 'patient_data',
                    reason: 'Invalid permissions'
                }
            };

            mockAuditService.logSecurityViolation.mockResolvedValue(undefined);

            await auditController.logSecurityViolation(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.logSecurityViolation).toHaveBeenCalledWith(
                'user123',
                'workplace123',
                'unauthorized_access',
                {
                    attemptedResource: 'patient_data',
                    reason: 'Invalid permissions'
                },
                {
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    requestId: 'req-123'
                }
            );

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                message: 'Security violation logged successfully'
            });
        });

        it('should handle missing violation type', async () => {
            mockReq.body = { details: {} }; // Missing violationType

            await auditController.logSecurityViolation(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'MISSING_VIOLATION_TYPE',
                    message: 'Violation type is required'
                }
            });
        });
    });

    describe('getAuditStatistics', () => {
        it('should return audit statistics successfully', async () => {
            const mockEvents = [
                {
                    userId: 'user1',
                    action: 'diagnostic_request_created',
                    timestamp: new Date('2024-01-15'),
                    details: { severity: 'medium' }
                },
                {
                    userId: 'user2',
                    action: 'ai_analysis_completed',
                    timestamp: new Date('2024-01-16'),
                    details: { severity: 'high' }
                },
                {
                    userId: 'user1',
                    action: 'security_violation',
                    timestamp: new Date('2024-01-17'),
                    details: { severity: 'critical' }
                }
            ];

            mockAuditService.searchAuditEvents.mockResolvedValue({
                events: mockEvents,
                total: 3,
                hasMore: false
            });

            await auditController.getAuditStatistics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            const response = mockJson.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.data.summary).toEqual({
                totalEvents: 3,
                uniqueUsers: 2,
                criticalEvents: 1,
                securityViolations: 1
            });
            expect(response.data.breakdown.eventsByType).toContainEqual({
                type: 'diagnostic_request_created',
                count: 1
            });
            expect(response.data.breakdown.eventsBySeverity).toContainEqual({
                severity: 'critical',
                count: 1
            });
        });

        it('should handle different period parameters', async () => {
            mockReq.query = { period: '7d' };

            mockAuditService.searchAuditEvents.mockResolvedValue({
                events: [],
                total: 0,
                hasMore: false
            });

            await auditController.getAuditStatistics(
                mockReq as AuthRequest,
                mockRes as Response
            );

            const response = mockJson.mock.calls[0][0];
            expect(response.data.period).toBe('7d');
        });
    });

    describe('archiveAuditRecords', () => {
        it('should archive audit records successfully', async () => {
            mockReq.body = { retentionDays: 2555 };

            const mockResult = {
                archivedCount: 100,
                deletedCount: 10
            };

            mockAuditService.archiveOldRecords.mockResolvedValue(mockResult);

            await auditController.archiveAuditRecords(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.archiveOldRecords).toHaveBeenCalledWith(
                'workplace123',
                2555
            );

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    archivedCount: 100,
                    deletedCount: 10,
                    message: 'Audit records archived successfully'
                }
            });
        });

        it('should handle invalid retention period', async () => {
            mockReq.body = { retentionDays: 0 };

            await auditController.archiveAuditRecords(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INVALID_RETENTION_PERIOD',
                    message: 'Retention days must be a positive number'
                }
            });
        });
    });

    describe('exportAuditData', () => {
        it('should export audit data as JSON successfully', async () => {
            mockReq.query = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                format: 'json'
            };

            const mockEvents = [
                {
                    userId: 'user123',
                    action: 'diagnostic_request_created',
                    timestamp: new Date(),
                    details: { entityType: 'diagnostic_request' }
                }
            ];

            mockAuditService.searchAuditEvents.mockResolvedValue({
                events: mockEvents,
                total: 1,
                hasMore: false
            });

            mockAuditService.logAuditEvent.mockResolvedValue(undefined);

            await auditController.exportAuditData(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(mockRes.setHeader).toHaveBeenCalledWith(
                'Content-Disposition',
                expect.stringMatching(/attachment; filename="audit_export_\d+\.json"/)
            );

            expect(mockJson).toHaveBeenCalledWith({
                exportInfo: expect.objectContaining({
                    workplaceId: 'workplace123',
                    dateRange: {
                        startDate: '2024-01-01',
                        endDate: '2024-01-31'
                    },
                    exportedBy: 'user123',
                    recordCount: 1
                }),
                auditEvents: mockEvents
            });
        });

        it('should export audit data as CSV successfully', async () => {
            mockReq.query = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                format: 'csv'
            };

            const mockEvents = [
                {
                    userId: 'user123',
                    action: 'diagnostic_request_created',
                    timestamp: new Date('2024-01-15T10:00:00Z'),
                    details: {
                        entityType: 'diagnostic_request',
                        entityId: 'req123',
                        severity: 'medium'
                    }
                }
            ];

            mockAuditService.searchAuditEvents.mockResolvedValue({
                events: mockEvents,
                total: 1,
                hasMore: false
            });

            mockAuditService.logAuditEvent.mockResolvedValue(undefined);

            await auditController.exportAuditData(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockRes.setHeader).toHaveBeenCalledWith(
                'Content-Disposition',
                expect.stringMatching(/attachment; filename="audit_export_\d+\.csv"/)
            );

            expect(mockRes.send).toHaveBeenCalledWith(
                expect.stringContaining('Timestamp,Event Type,Entity Type,Entity ID,User ID,Severity,Details')
            );
        });

        it('should handle missing date range', async () => {
            mockReq.query = { format: 'json' }; // Missing dates

            await auditController.exportAuditData(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'MISSING_DATE_RANGE',
                    message: 'Start date and end date are required'
                }
            });
        });
    });
});