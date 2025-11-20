/**
 * Diagnostic Audit Service Tests
 * Tests for audit logging completeness and accuracy
 */

import { Types } from 'mongoose';
import diagnosticAuditService from '../services/diagnosticAuditService';
import { AuditService } from '../../../services/auditService';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the audit service
jest.mock('../../../services/auditService');

const mockAuditService = auditService as jest.Mocked<typeof auditService>;

describe('DiagnosticAuditService', () => {
    const mockWorkplaceId = new Types.ObjectId().toString();
    const mockUserId = new Types.ObjectId().toString();
    const mockPatientId = new Types.ObjectId().toString();
    const mockRequestId = new Types.ObjectId().toString();
    const mockResultId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('logDiagnosticRequestCreated', () => {
        it('should log diagnostic request creation with proper audit data', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const details = {
                symptoms: ['headache', 'fever'],
                vitals: { temperature: 101.5 },
                medications: ['aspirin'],
                allergies: ['penicillin'],
                consentObtained: true
            };

            const metadata = {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                requestId: 'req-123'
            };

            await diagnosticAuditService.logDiagnosticRequestCreated(
                mockRequestId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                details,
                metadata
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'diagnostic_request_created',
                resource: `diagnostic_request:${mockRequestId}`,
                details: expect.objectContaining({
                    entityType: 'diagnostic_request',
                    entityId: mockRequestId,
                    patientId: mockPatientId,
                    severity: 'medium',
                    symptoms: details.symptoms,
                    vitals: details.vitals,
                    medications: 1,
                    allergies: 1,
                    consentObtained: true,
                    regulatoryContext: expect.objectContaining({
                        hipaaCompliant: true,
                        gdprCompliant: true,
                        dataRetentionPeriod: 2555,
                        consentRequired: true,
                        consentObtained: true
                    }),
                    metadata
                }),
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                workplaceId: mockWorkplaceId
            });
        });

        it('should handle missing optional metadata', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const details = {
                symptoms: ['headache'],
                consentObtained: true
            };

            await diagnosticAuditService.logDiagnosticRequestCreated(
                mockRequestId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                details
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: mockUserId,
                    action: 'diagnostic_request_created',
                    ipAddress: undefined,
                    userAgent: undefined
                })
            );
        });
    });

    describe('logAIAnalysisRequested', () => {
        it('should log AI analysis request with AI metadata', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const aiMetadata = {
                modelId: 'deepseek-v3.1',
                modelVersion: '1.0.0',
                promptHash: 'abc123',
                promptVersion: 'v1.0'
            };

            await diagnosticAuditService.logAIAnalysisRequested(
                mockRequestId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                aiMetadata
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'ai_analysis_requested',
                resource: `diagnostic_request:${mockRequestId}`,
                details: expect.objectContaining({
                    entityType: 'diagnostic_request',
                    entityId: mockRequestId,
                    patientId: mockPatientId,
                    severity: 'high',
                    modelRequested: aiMetadata.modelId,
                    promptVersion: aiMetadata.promptVersion,
                    consentVerified: true,
                    aiMetadata: expect.objectContaining({
                        modelId: aiMetadata.modelId,
                        modelVersion: aiMetadata.modelVersion,
                        promptHash: aiMetadata.promptHash,
                        responseHash: '',
                        tokenUsage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0
                        },
                        processingTime: 0
                    }),
                    regulatoryContext: expect.objectContaining({
                        hipaaCompliant: true,
                        gdprCompliant: true,
                        consentRequired: true,
                        consentObtained: true
                    })
                }),
                ipAddress: undefined,
                userAgent: undefined,
                workplaceId: mockWorkplaceId
            });
        });
    });

    describe('logAIAnalysisCompleted', () => {
        it('should log AI analysis completion with comprehensive metadata', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const aiMetadata = {
                modelId: 'deepseek-v3.1',
                modelVersion: '1.0.0',
                promptHash: 'abc123',
                responseHash: 'def456',
                tokenUsage: {
                    promptTokens: 500,
                    completionTokens: 300,
                    totalTokens: 800
                },
                confidenceScore: 0.85,
                processingTime: 15000,
                diagnosesCount: 3,
                suggestedTestsCount: 2,
                medicationSuggestionsCount: 1,
                redFlagsCount: 0,
                referralRecommended: false
            };

            await diagnosticAuditService.logAIAnalysisCompleted(
                mockRequestId,
                mockResultId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                aiMetadata
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'ai_analysis_completed',
                resource: `diagnostic_result:${mockResultId}`,
                details: expect.objectContaining({
                    entityType: 'diagnostic_result',
                    entityId: mockResultId,
                    patientId: mockPatientId,
                    severity: 'high',
                    requestId: mockRequestId,
                    diagnosesCount: 3,
                    suggestedTestsCount: 2,
                    medicationSuggestionsCount: 1,
                    redFlagsCount: 0,
                    referralRecommended: false,
                    aiMetadata: expect.objectContaining({
                        modelId: aiMetadata.modelId,
                        modelVersion: aiMetadata.modelVersion,
                        promptHash: aiMetadata.promptHash,
                        responseHash: aiMetadata.responseHash,
                        tokenUsage: aiMetadata.tokenUsage,
                        confidenceScore: aiMetadata.confidenceScore,
                        processingTime: aiMetadata.processingTime
                    })
                }),
                ipAddress: undefined,
                userAgent: undefined,
                workplaceId: mockWorkplaceId
            });
        });
    });

    describe('logPharmacistReview', () => {
        it('should log approved review correctly', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const reviewDetails = {
                status: 'approved',
                reviewTime: 300000 // 5 minutes
            };

            await diagnosticAuditService.logPharmacistReview(
                mockResultId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                reviewDetails
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'diagnostic_approved',
                resource: `diagnostic_result:${mockResultId}`,
                details: expect.objectContaining({
                    entityType: 'diagnostic_result',
                    entityId: mockResultId,
                    patientId: mockPatientId,
                    severity: 'high',
                    reviewStatus: 'approved',
                    reviewTime: 300000
                }),
                ipAddress: undefined,
                userAgent: undefined,
                workplaceId: mockWorkplaceId
            });
        });

        it('should log modified review with modifications', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const reviewDetails = {
                status: 'modified',
                modifications: 'Changed dosage recommendation',
                reviewTime: 450000 // 7.5 minutes
            };

            await diagnosticAuditService.logPharmacistReview(
                mockResultId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                reviewDetails
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'diagnostic_modified',
                resource: `diagnostic_result:${mockResultId}`,
                details: expect.objectContaining({
                    reviewStatus: 'modified',
                    modifications: 'Changed dosage recommendation',
                    reviewTime: 450000
                }),
                ipAddress: undefined,
                userAgent: undefined,
                workplaceId: mockWorkplaceId
            });
        });

        it('should log rejected review with reason', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const reviewDetails = {
                status: 'rejected',
                rejectionReason: 'Insufficient clinical data',
                reviewTime: 180000 // 3 minutes
            };

            await diagnosticAuditService.logPharmacistReview(
                mockResultId,
                mockUserId,
                mockWorkplaceId,
                mockPatientId,
                reviewDetails
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'diagnostic_rejected',
                resource: `diagnostic_result:${mockResultId}`,
                details: expect.objectContaining({
                    reviewStatus: 'rejected',
                    rejectionReason: 'Insufficient clinical data',
                    reviewTime: 180000
                }),
                ipAddress: undefined,
                userAgent: undefined,
                workplaceId: mockWorkplaceId
            });
        });
    });

    describe('logSecurityViolation', () => {
        it('should log security violation with critical severity', async () => {
            mockAuditService.logActivity.mockResolvedValue({} as any);

            const violationType = 'unauthorized_access';
            const details = {
                attemptedResource: 'patient_data',
                reason: 'Invalid permissions'
            };

            const metadata = {
                ipAddress: '192.168.1.100',
                userAgent: 'Suspicious Agent',
                requestId: 'req-456'
            };

            await diagnosticAuditService.logSecurityViolation(
                mockUserId,
                mockWorkplaceId,
                violationType,
                details,
                metadata
            );

            expect(mockAuditService.logActivity).toHaveBeenCalledWith({
                userId: mockUserId,
                action: 'security_violation',
                resource: `diagnostic_request:security_event`,
                details: expect.objectContaining({
                    entityType: 'diagnostic_request',
                    entityId: 'security_event',
                    severity: 'critical',
                    violationType,
                    attemptedResource: 'patient_data',
                    reason: 'Invalid permissions',
                    metadata
                }),
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                workplaceId: mockWorkplaceId
            });
        });
    });

    describe('searchAuditEvents', () => {
        it('should search audit events with proper criteria', async () => {
            const mockAuditResults = {
                logs: [
                    {
                        userId: mockUserId,
                        action: 'diagnostic_request_created',
                        resource: `diagnostic_request:${mockRequestId}`,
                        details: {
                            entityType: 'diagnostic_request',
                            entityId: mockRequestId,
                            severity: 'medium'
                        },
                        timestamp: new Date(),
                        workplaceId: mockWorkplaceId
                    },
                    {
                        userId: mockUserId,
                        action: 'ai_analysis_completed',
                        resource: `diagnostic_result:${mockResultId}`,
                        details: {
                            entityType: 'diagnostic_result',
                            entityId: mockResultId,
                            severity: 'high'
                        },
                        timestamp: new Date(),
                        workplaceId: mockWorkplaceId
                    }
                ],
                total: 2,
                hasMore: false
            };

            mockAuditService.getAuditLogs.mockResolvedValue(mockAuditResults);

            const criteria = {
                workplaceId: mockWorkplaceId,
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                eventTypes: ['diagnostic_request_created', 'ai_analysis_completed'],
                limit: 50,
                offset: 0
            };

            const result = await diagnosticAuditService.searchAuditEvents(criteria);

            expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
                expect.any(Object), // workplaceId as ObjectId
                expect.objectContaining({
                    startDate: criteria.startDate,
                    endDate: criteria.endDate,
                    action: criteria.eventTypes[0]
                }),
                expect.objectContaining({
                    page: 1,
                    limit: 50
                })
            );

            expect(result).toEqual({
                events: mockAuditResults.logs,
                total: 2,
                hasMore: false
            });
        });

        it('should filter out non-diagnostic events', async () => {
            const mockAuditResults = {
                logs: [
                    {
                        userId: mockUserId,
                        action: 'diagnostic_request_created',
                        resource: `diagnostic_request:${mockRequestId}`,
                        details: {
                            entityType: 'diagnostic_request',
                            entityId: mockRequestId
                        },
                        timestamp: new Date(),
                        workplaceId: mockWorkplaceId
                    },
                    {
                        userId: mockUserId,
                        action: 'user_login',
                        resource: 'auth',
                        details: {
                            entityType: 'user'
                        },
                        timestamp: new Date(),
                        workplaceId: mockWorkplaceId
                    }
                ],
                total: 2,
                hasMore: false
            };

            mockAuditService.getAuditLogs.mockResolvedValue(mockAuditResults);

            const result = await diagnosticAuditService.searchAuditEvents({
                workplaceId: mockWorkplaceId
            });

            // Should only return diagnostic-related events
            expect(result.events).toHaveLength(1);
            expect(result.events[0].details.entityType).toBe('diagnostic_request');
        });

        it('should handle search errors', async () => {
            mockAuditService.getAuditLogs.mockRejectedValue(new Error('Database error'));

            await expect(
                diagnosticAuditService.searchAuditEvents({ workplaceId: mockWorkplaceId })
            ).rejects.toThrow('Failed to search audit events');
        });
    });

    describe('generateComplianceReport', () => {
        it('should generate comprehensive compliance report', async () => {
            const mockAuditEvents = [
                {
                    userId: mockUserId,
                    action: 'diagnostic_request_created',
                    details: {
                        entityType: 'diagnostic_request',
                        severity: 'medium',
                        consentObtained: true
                    },
                    timestamp: new Date()
                },
                {
                    userId: mockUserId,
                    action: 'ai_analysis_completed',
                    details: {
                        entityType: 'diagnostic_result',
                        severity: 'high',
                        aiMetadata: {
                            modelId: 'deepseek-v3.1',
                            tokenUsage: { totalTokens: 800 },
                            processingTime: 15000,
                            confidenceScore: 0.85
                        }
                    },
                    timestamp: new Date()
                },
                {
                    userId: mockUserId,
                    action: 'security_violation',
                    details: {
                        entityType: 'diagnostic_request',
                        severity: 'critical'
                    },
                    timestamp: new Date()
                }
            ];

            // Mock the searchAuditEvents method
            jest.spyOn(diagnosticAuditService, 'searchAuditEvents').mockResolvedValue({
                events: mockAuditEvents,
                total: 3,
                hasMore: false
            });

            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const report = await diagnosticAuditService.generateComplianceReport(
                mockWorkplaceId,
                'hipaa',
                startDate,
                endDate,
                mockUserId
            );

            expect(report).toEqual({
                reportId: expect.any(String),
                workplaceId: mockWorkplaceId,
                reportType: 'hipaa',
                period: { startDate, endDate },
                generatedAt: expect.any(Date),
                generatedBy: mockUserId,
                summary: {
                    totalEvents: 3,
                    criticalEvents: 1,
                    securityViolations: 1,
                    dataAccessEvents: 0,
                    aiUsageEvents: 1,
                    consentEvents: 0
                },
                findings: expect.arrayContaining([
                    expect.objectContaining({
                        category: 'Security',
                        severity: 'critical',
                        description: '1 security violations detected',
                        count: 1
                    })
                ]),
                dataRetention: expect.objectContaining({
                    totalRecords: expect.any(Number),
                    recordsNearingExpiry: expect.any(Number),
                    expiredRecords: expect.any(Number)
                }),
                aiUsage: expect.objectContaining({
                    totalRequests: 1,
                    uniqueUsers: 1,
                    averageConfidence: 0.85,
                    modelUsage: expect.objectContaining({
                        'deepseek-v3.1': expect.objectContaining({
                            requests: 1,
                            averageTokens: 800,
                            averageProcessingTime: 15000
                        })
                    })
                }),
                complianceStatus: expect.objectContaining({
                    hipaaCompliant: false, // Due to security violation
                    gdprCompliant: false,
                    issues: expect.arrayContaining([
                        '1 security violations detected'
                    ]),
                    recommendations: expect.any(Array)
                })
            });
        });

        it('should handle report generation errors', async () => {
            jest.spyOn(diagnosticAuditService, 'searchAuditEvents').mockRejectedValue(
                new Error('Search failed')
            );

            await expect(
                diagnosticAuditService.generateComplianceReport(
                    mockWorkplaceId,
                    'hipaa',
                    new Date(),
                    new Date(),
                    mockUserId
                )
            ).rejects.toThrow('Failed to generate compliance report');
        });
    });

    describe('getEntityAuditTrail', () => {
        it('should retrieve audit trail for specific entity', async () => {
            const mockAuditEvents = [
                {
                    userId: mockUserId,
                    action: 'diagnostic_request_created',
                    timestamp: new Date('2024-01-01T10:00:00Z')
                },
                {
                    userId: mockUserId,
                    action: 'ai_analysis_completed',
                    timestamp: new Date('2024-01-01T10:05:00Z')
                },
                {
                    userId: mockUserId,
                    action: 'diagnostic_approved',
                    timestamp: new Date('2024-01-01T10:10:00Z')
                }
            ];

            jest.spyOn(diagnosticAuditService, 'searchAuditEvents').mockResolvedValue({
                events: mockAuditEvents,
                total: 3,
                hasMore: false
            });

            const result = await diagnosticAuditService.getEntityAuditTrail(
                'diagnostic_request',
                mockRequestId,
                mockWorkplaceId
            );

            expect(diagnosticAuditService.searchAuditEvents).toHaveBeenCalledWith({
                workplaceId: mockWorkplaceId,
                entityId: mockRequestId,
                limit: 1000
            });

            // Should be sorted by timestamp descending (most recent first)
            expect(result).toHaveLength(3);
            expect(new Date(result[0].timestamp).getTime()).toBeGreaterThan(
                new Date(result[1].timestamp).getTime()
            );
        });
    });
});