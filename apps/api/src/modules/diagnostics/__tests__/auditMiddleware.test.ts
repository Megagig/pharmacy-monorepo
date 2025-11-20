/**
 * Audit Middleware Tests
 * Tests for comprehensive audit logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
    auditTimer,
    diagnosticAuditLogger,
    auditDiagnosticRequest,
    auditAIProcessing,
    setAuditData,
    setAIMetadata
} from '../middlewares/auditMiddleware';
import diagnosticAuditService from '../services/diagnosticAuditService';
import logger from '../../../utils/logger';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../services/diagnosticAuditService');
jest.mock('../../../utils/logger');

const mockDiagnosticAuditService = diagnosticAuditService as jest.Mocked<typeof diagnosticAuditService>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Audit Middleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            method: 'POST',
            path: '/api/diagnostics',
            originalUrl: '/api/diagnostics',
            headers: {
                'user-agent': 'Mozilla/5.0',
                'x-request-id': 'req-123'
            },
            body: {
                patientId: 'patient123',
                consentObtained: true
            },
            params: {
                id: 'diagnostic123'
            },
            query: {},
            user: {
                id: 'user123',
                workplaceId: 'workplace123'
            },
            ip: '192.168.1.1',
            sessionID: 'session123',
            get: jest.fn((header: string) => {
                const headers: { [key: string]: string } = {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/json'
                };
                return headers[header];
            })
        };

        mockRes = {
            statusCode: 200,
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            on: jest.fn(),
            locals: {}
        };

        mockNext = jest.fn();
    });

    describe('auditTimer', () => {
        it('should set start time and generate request hash', () => {
            const startTime = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(startTime);

            auditTimer(mockReq, mockRes, mockNext);

            expect(mockReq.startTime).toBe(startTime);
            expect(mockReq.requestHash).toBeDefined();
            expect(typeof mockReq.requestHash).toBe('string');
            expect(mockReq.requestHash).toHaveLength(64); // SHA-256 hash length
            expect(mockNext).toHaveBeenCalled();
        });

        it('should generate different hashes for different requests', () => {
            const req1 = { ...mockReq, body: { test: 'data1' } };
            const req2 = { ...mockReq, body: { test: 'data2' } };

            auditTimer(req1, mockRes, mockNext);
            auditTimer(req2, mockRes, mockNext);

            expect(req1.requestHash).not.toBe(req2.requestHash);
        });
    });

    describe('diagnosticAuditLogger', () => {
        it('should log audit event on response finish', async () => {
            const middleware = diagnosticAuditLogger({
                eventType: 'diagnostic_request_created',
                entityType: 'diagnostic_request',
                severity: 'medium'
            });

            mockReq.startTime = Date.now() - 1000; // 1 second ago
            mockReq.requestHash = 'test-hash';

            // Mock response finish event
            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();

            // Simulate response finish
            mockRes.locals.responseBody = { success: true, data: { id: 'result123' } };
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'diagnostic_request_created',
                    entityType: 'diagnostic_request',
                    entityId: 'diagnostic123',
                    userId: 'user123',
                    workplaceId: 'workplace123',
                    details: expect.objectContaining({
                        requestMethod: 'POST',
                        requestPath: '/api/diagnostics',
                        responseStatus: 200,
                        responseTime: expect.any(Number),
                        requestHash: 'test-hash'
                    }),
                    metadata: expect.objectContaining({
                        ipAddress: '192.168.1.1',
                        userAgent: 'Mozilla/5.0',
                        sessionId: 'session123',
                        requestId: 'req-123'
                    }),
                    severity: 'medium'
                })
            );
        });

        it('should skip logging if user is not authenticated', async () => {
            const middleware = diagnosticAuditLogger();
            mockReq.user = null;

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).not.toHaveBeenCalled();
        });

        it('should skip success logs when configured', async () => {
            const middleware = diagnosticAuditLogger({ skipSuccessLog: true });

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            mockRes.statusCode = 200; // Success status
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).not.toHaveBeenCalled();
        });

        it('should log error details for failed requests', async () => {
            const middleware = diagnosticAuditLogger();

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            mockRes.statusCode = 400;
            mockRes.locals.responseBody = {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input data'
                }
            };

            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: expect.objectContaining({
                        errorCode: 'VALIDATION_ERROR',
                        errorMessage: 'Invalid input data'
                    }),
                    severity: 'high' // Error should increase severity
                })
            );
        });

        it('should log security violation for missing consent', async () => {
            const middleware = diagnosticAuditLogger({ requireConsent: true });
            mockReq.body.consentObtained = false;

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logSecurityViolation).toHaveBeenCalledWith(
                'user123',
                'workplace123',
                'missing_consent',
                expect.objectContaining({
                    requestPath: '/api/diagnostics',
                    requestMethod: 'POST'
                }),
                expect.any(Object)
            );

            expect(mockDiagnosticAuditService.logAuditEvent).not.toHaveBeenCalled();
        });

        it('should include AI metadata when AI processing is enabled', async () => {
            const middleware = diagnosticAuditLogger({ aiProcessing: true });

            mockReq.auditData = {
                aiMetadata: {
                    modelId: 'deepseek-v3.1',
                    confidenceScore: 0.85,
                    tokenUsage: { totalTokens: 1500 }
                }
            };

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: expect.objectContaining({
                        aiMetadata: expect.objectContaining({
                            modelId: 'deepseek-v3.1',
                            confidenceScore: 0.85
                        })
                    }),
                    aiMetadata: expect.objectContaining({
                        modelId: 'deepseek-v3.1',
                        confidenceScore: 0.85
                    })
                })
            );
        });

        it('should handle audit logging errors gracefully', async () => {
            const middleware = diagnosticAuditLogger();
            mockDiagnosticAuditService.logAuditEvent.mockRejectedValue(
                new Error('Audit service unavailable')
            );

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to log diagnostic audit event:',
                expect.objectContaining({
                    error: 'Audit service unavailable'
                })
            );
        });
    });

    describe('auditDiagnosticRequest', () => {
        it('should use correct default configuration', async () => {
            mockReq.body.consentObtained = true;

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            auditDiagnosticRequest(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'diagnostic_request_created',
                    entityType: 'diagnostic_request',
                    severity: 'medium'
                })
            );
        });
    });

    describe('auditAIProcessing', () => {
        it('should use correct AI processing configuration', async () => {
            mockReq.body.consentObtained = true;
            mockReq.auditData = {
                aiMetadata: {
                    modelId: 'deepseek-v3.1'
                }
            };

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            auditAIProcessing(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'ai_analysis_requested',
                    entityType: 'diagnostic_request',
                    severity: 'high'
                })
            );
        });
    });

    describe('setAuditData', () => {
        it('should set audit data on request object', () => {
            const auditData = {
                eventType: 'custom_event',
                entityId: 'entity123',
                severity: 'high' as const
            };

            setAuditData(mockReq, auditData);

            expect(mockReq.auditData).toEqual(auditData);
        });

        it('should merge with existing audit data', () => {
            mockReq.auditData = {
                eventType: 'existing_event',
                entityId: 'entity123'
            };

            setAuditData(mockReq, {
                severity: 'high' as const,
                details: { test: 'data' }
            });

            expect(mockReq.auditData).toEqual({
                eventType: 'existing_event',
                entityId: 'entity123',
                severity: 'high',
                details: { test: 'data' }
            });
        });
    });

    describe('setAIMetadata', () => {
        it('should set AI metadata on request object', () => {
            const aiMetadata = {
                modelId: 'deepseek-v3.1',
                confidenceScore: 0.85,
                tokenUsage: { totalTokens: 1500 }
            };

            setAIMetadata(mockReq, aiMetadata);

            expect(mockReq.auditData?.aiMetadata).toEqual(aiMetadata);
        });

        it('should create auditData if it does not exist', () => {
            expect(mockReq.auditData).toBeUndefined();

            setAIMetadata(mockReq, { modelId: 'test-model' });

            expect(mockReq.auditData).toBeDefined();
            expect(mockReq.auditData.aiMetadata).toEqual({ modelId: 'test-model' });
        });
    });

    describe('helper functions', () => {
        it('should sanitize sensitive request body data', async () => {
            const middleware = diagnosticAuditLogger();
            mockReq.body = {
                patientId: 'patient123',
                password: 'secret123',
                apiKey: 'key123',
                largeField: 'x'.repeat(2000)
            };

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            const loggedDetails = mockDiagnosticAuditService.logAuditEvent.mock.calls[0]?.[0]?.details;

            expect(loggedDetails.requestBody.password).toBe('[REDACTED]');
            expect(loggedDetails.requestBody.apiKey).toBe('[REDACTED]');
            expect(loggedDetails.requestBody.patientId).toBe('patient123');
            expect(loggedDetails.requestBody.largeField).toContain('[TRUNCATED]');
        });

        it('should determine severity based on request characteristics', async () => {
            const middleware = diagnosticAuditLogger();

            // Test DELETE request (should be critical)
            mockReq.method = 'DELETE';
            mockRes.statusCode = 200;

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'critical'
                })
            );
        });

        it('should extract entity ID from response body', async () => {
            const middleware = diagnosticAuditLogger();
            mockReq.params = {}; // No ID in params

            let finishCallback: () => void;
            mockRes.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'finish') {
                    finishCallback = callback;
                }
            });

            middleware(mockReq, mockRes, mockNext);
            mockRes.locals.responseBody = {
                data: {
                    request: {
                        _id: 'extracted123'
                    }
                }
            };
            await finishCallback!();

            expect(mockDiagnosticAuditService.logAuditEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityId: 'extracted123'
                })
            );
        });
    });
});