/**
 * Compliance Reporting Service Tests
 * Tests for compliance reporting completeness and accuracy
 */

import { Types } from 'mongoose';
import complianceReportingService from '../services/complianceReportingService';
import diagnosticAuditService from '../services/diagnosticAuditService';
import MTRAuditLog from '../../../models/MTRAuditLog';
import DiagnosticRequest from '../models/DiagnosticRequest';
import DiagnosticResult from '../models/DiagnosticResult';

// Mock dependencies
jest.mock('../services/diagnosticAuditService');
jest.mock('../../../models/MTRAuditLog');
jest.mock('../models/DiagnosticRequest');
jest.mock('../models/DiagnosticResult');

const mockDiagnosticAuditService = diagnosticAuditService as jest.Mocked<typeof diagnosticAuditService>;
const mockMTRAuditLog = MTRAuditLog as jest.Mocked<typeof MTRAuditLog>;
const mockDiagnosticRequest = DiagnosticRequest as jest.Mocked<typeof DiagnosticRequest>;
const mockDiagnosticResult = DiagnosticResult as jest.Mocked<typeof DiagnosticResult>;

describe('ComplianceReportingService', () => {
    const mockWorkplaceId = new Types.ObjectId().toString();
    const mockUserId = new Types.ObjectId().toString();
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateRegulatoryReport', () => {
        it('should generate HIPAA compliance report with correct structure', async () => {
            // Mock audit events
            const mockAuditEvents = [
                {
                    userId: mockUserId,
                    action: 'diagnostic_request_created',
                    timestamp: new Date(),
                    details: {
                        severity: 'medium',
                        regulatoryContext: {
                            consentObtained: true
                        }
                    }
                },
                {
                    userId: mockUserId,
                    action: 'ai_analysis_completed',
                    timestamp: new Date(),
                    details: {
                        severity: 'high',
                        aiMetadata: {
                            modelId: 'deepseek-v3.1',
                            confidenceScore: 0.85,
                            tokenUsage: {
                                totalTokens: 1500
                            }
                        }
                    }
                }
            ];

            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: mockAuditEvents,
                total: 2,
                hasMore: false
            });

            // Mock database counts
            mockDiagnosticRequest.countDocuments.mockResolvedValue(100);
            mockDiagnosticResult.countDocuments.mockResolvedValue(95);
            mockMTRAuditLog.find.mockResolvedValue([
                {
                    action: 'diagnostic_request_created',
                    resourceType: 'diagnostic_request',
                    userId: new Types.ObjectId(mockUserId),
                    timestamp: new Date(),
                    riskLevel: 'medium',
                    details: {}
                }
            ] as any);

            const report = await complianceReportingService.generateRegulatoryReport(
                mockWorkplaceId,
                'hipaa',
                startDate,
                endDate,
                mockUserId
            );

            expect(report).toMatchObject({
                reportType: 'hipaa',
                workplaceId: mockWorkplaceId,
                generatedBy: mockUserId,
                period: { startDate, endDate },
                executiveSummary: expect.objectContaining({
                    complianceScore: expect.any(Number),
                    overallStatus: expect.stringMatching(/compliant|non_compliant|needs_attention/)
                }),
                dataGovernance: expect.objectContaining({
                    dataRetentionCompliance: expect.objectContaining({
                        totalRecords: expect.any(Number),
                        recordsWithinPolicy: expect.any(Number)
                    }),
                    dataClassification: expect.objectContaining({
                        phi: expect.any(Number),
                        pii: expect.any(Number)
                    })
                }),
                auditTrail: expect.objectContaining({
                    completeness: expect.any(Number),
                    integrity: expect.any(Number)
                }),
                securityMetrics: expect.objectContaining({
                    accessViolations: expect.any(Number),
                    failedLogins: expect.any(Number)
                }),
                aiGovernance: expect.objectContaining({
                    consentCompliance: expect.any(Number),
                    modelTransparency: expect.any(Number)
                }),
                recommendations: expect.arrayContaining([
                    expect.objectContaining({
                        priority: expect.stringMatching(/critical|high|medium|low/),
                        category: expect.any(String),
                        description: expect.any(String)
                    })
                ])
            });

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'data_export',
                    entityType: 'diagnostic_request',
                    userId: mockUserId,
                    workplaceId: mockWorkplaceId
                })
            );
        });

        it('should generate GDPR compliance report with privacy-specific metrics', async () => {
            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: [],
                total: 0,
                hasMore: false
            });

            mockDiagnosticRequest.countDocuments.mockResolvedValue(50);
            mockDiagnosticResult.countDocuments.mockResolvedValue(45);
            mockMTRAuditLog.find.mockResolvedValue([]);

            const report = await complianceReportingService.generateRegulatoryReport(
                mockWorkplaceId,
                'gdpr',
                startDate,
                endDate,
                mockUserId
            );

            expect(report.reportType).toBe('gdpr');
            expect(report.dataGovernance.dataClassification.pii).toBeGreaterThan(0);
            expect(report.aiGovernance?.consentCompliance).toBeDefined();
        });

        it('should handle errors gracefully', async () => {
            mockDiagnosticAuditService.searchAuditEvents.mockRejectedValue(
                new Error('Database connection failed')
            );

            await expect(
                complianceReportingService.generateRegulatoryReport(
                    mockWorkplaceId,
                    'hipaa',
                    startDate,
                    endDate,
                    mockUserId
                )
            ).rejects.toThrow('Failed to generate regulatory compliance report');
        });
    });

    describe('detectAnomalies', () => {
        it('should detect user behavior anomalies', async () => {
            const mockAuditEvents = [
                // Normal user activity
                { userId: 'user1', timestamp: new Date(), action: 'diagnostic_request_created' },
                { userId: 'user1', timestamp: new Date(), action: 'diagnostic_request_created' },

                // Anomalous user activity (high volume)
                ...Array(50).fill(null).map(() => ({
                    userId: 'user2',
                    timestamp: new Date(),
                    action: 'diagnostic_request_created'
                }))
            ];

            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: mockAuditEvents,
                total: mockAuditEvents.length,
                hasMore: false
            });

            const anomalies = await complianceReportingService.detectAnomalies(
                mockWorkplaceId,
                30
            );

            expect(anomalies).toHaveLength(1);
            expect(anomalies[0]).toMatchObject({
                anomalyType: 'user_behavior',
                severity: expect.stringMatching(/high|critical/),
                description: expect.stringContaining('user2'),
                affectedEntities: ['user2'],
                riskScore: expect.any(Number),
                recommendedActions: expect.arrayContaining([
                    expect.stringContaining('Review user access permissions')
                ])
            });
        });

        it('should detect time pattern anomalies', async () => {
            const afterHoursEvents = Array(20).fill(null).map(() => ({
                userId: 'user1',
                timestamp: new Date('2024-01-01T02:00:00Z'), // 2 AM
                action: 'diagnostic_request_created'
            }));

            const normalEvents = Array(10).fill(null).map(() => ({
                userId: 'user1',
                timestamp: new Date('2024-01-01T14:00:00Z'), // 2 PM
                action: 'diagnostic_request_created'
            }));

            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: [...afterHoursEvents, ...normalEvents],
                total: 30,
                hasMore: false
            });

            const anomalies = await complianceReportingService.detectAnomalies(
                mockWorkplaceId,
                30
            );

            const timeAnomaly = anomalies.find(a => a.anomalyType === 'time_pattern');
            expect(timeAnomaly).toBeDefined();
            expect(timeAnomaly?.description).toContain('activities detected outside business hours');
        });

        it('should return empty array when no anomalies detected', async () => {
            const normalEvents = Array(10).fill(null).map(() => ({
                userId: 'user1',
                timestamp: new Date('2024-01-01T14:00:00Z'),
                action: 'diagnostic_request_created'
            }));

            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: normalEvents,
                total: 10,
                hasMore: false
            });

            const anomalies = await complianceReportingService.detectAnomalies(
                mockWorkplaceId,
                30
            );

            expect(anomalies).toHaveLength(0);
        });
    });

    describe('getDataRetentionPolicies', () => {
        it('should return default data retention policies', () => {
            const policies = complianceReportingService.getDataRetentionPolicies();

            expect(policies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        recordType: 'diagnostic_request',
                        retentionPeriod: 2555, // 7 years
                        archivalRequired: true,
                        regulatoryBasis: expect.arrayContaining(['HIPAA'])
                    }),
                    expect.objectContaining({
                        recordType: 'audit_log',
                        retentionPeriod: 1095, // 3 years
                        regulatoryBasis: expect.arrayContaining(['HIPAA', 'SOX'])
                    })
                ])
            );
        });
    });

    describe('updateDataRetentionPolicy', () => {
        it('should update existing policy', () => {
            const originalPolicies = complianceReportingService.getDataRetentionPolicies();
            const originalDiagnosticPolicy = originalPolicies.find(p => p.recordType === 'diagnostic_request');

            complianceReportingService.updateDataRetentionPolicy('diagnostic_request', {
                retentionPeriod: 3650, // 10 years
                legalHold: true
            });

            const updatedPolicies = complianceReportingService.getDataRetentionPolicies();
            const updatedDiagnosticPolicy = updatedPolicies.find(p => p.recordType === 'diagnostic_request');

            expect(updatedDiagnosticPolicy?.retentionPeriod).toBe(3650);
            expect(updatedDiagnosticPolicy?.legalHold).toBe(true);
            expect(updatedDiagnosticPolicy?.archivalRequired).toBe(originalDiagnosticPolicy?.archivalRequired);
        });

        it('should create new policy for unknown record type', () => {
            complianceReportingService.updateDataRetentionPolicy('new_record_type', {
                retentionPeriod: 1825, // 5 years
                archivalRequired: false,
                regulatoryBasis: ['Custom Regulation']
            });

            const policies = complianceReportingService.getDataRetentionPolicies();
            const newPolicy = policies.find(p => p.recordType === 'new_record_type');

            expect(newPolicy).toMatchObject({
                recordType: 'new_record_type',
                retentionPeriod: 1825,
                archivalRequired: false,
                regulatoryBasis: ['Custom Regulation']
            });
        });
    });

    describe('compliance score calculation', () => {
        it('should calculate high compliance score for clean data', async () => {
            // Mock clean audit data
            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: [
                    {
                        userId: mockUserId,
                        action: 'diagnostic_request_created',
                        timestamp: new Date(),
                        details: {
                            severity: 'medium',
                            regulatoryContext: { consentObtained: true }
                        }
                    }
                ],
                total: 1,
                hasMore: false
            });

            mockDiagnosticRequest.countDocuments.mockResolvedValue(100);
            mockDiagnosticResult.countDocuments.mockResolvedValue(100);
            mockMTRAuditLog.find.mockResolvedValue([
                {
                    action: 'diagnostic_request_created',
                    resourceType: 'diagnostic_request',
                    userId: new Types.ObjectId(mockUserId),
                    timestamp: new Date(),
                    riskLevel: 'low'
                }
            ] as any);

            const report = await complianceReportingService.generateRegulatoryReport(
                mockWorkplaceId,
                'hipaa',
                startDate,
                endDate,
                mockUserId
            );

            expect(report.executiveSummary.complianceScore).toBeGreaterThan(80);
            expect(report.executiveSummary.overallStatus).toBe('compliant');
        });

        it('should calculate low compliance score for problematic data', async () => {
            // Mock problematic audit data
            mockDiagnosticAuditService.searchAuditEvents.mockResolvedValue({
                events: [
                    {
                        userId: mockUserId,
                        action: 'security_violation',
                        timestamp: new Date(),
                        details: { severity: 'critical' }
                    },
                    {
                        userId: mockUserId,
                        action: 'diagnostic_request_created',
                        timestamp: new Date(),
                        details: {
                            severity: 'medium',
                            regulatoryContext: { consentObtained: false }
                        }
                    }
                ],
                total: 2,
                hasMore: false
            });

            // Mock expired records
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 2556); // Beyond 7 years

            mockDiagnosticRequest.countDocuments
                .mockResolvedValueOnce(100) // Total records
                .mockResolvedValueOnce(100) // Records nearing expiry
                .mockResolvedValueOnce(20); // Expired records

            mockDiagnosticResult.countDocuments.mockResolvedValue(100);
            mockMTRAuditLog.find.mockResolvedValue([
                {
                    action: 'security_violation',
                    resourceType: 'diagnostic_request',
                    userId: new Types.ObjectId(mockUserId),
                    timestamp: new Date(),
                    riskLevel: 'critical'
                }
            ] as any);

            const report = await complianceReportingService.generateRegulatoryReport(
                mockWorkplaceId,
                'hipaa',
                startDate,
                endDate,
                mockUserId
            );

            expect(report.executiveSummary.complianceScore).toBeLessThan(70);
            expect(report.executiveSummary.overallStatus).toBe('non_compliant');
            expect(report.recommendations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        priority: 'critical',
                        category: 'Data Retention'
                    })
                ])
            );
        });
    });
});