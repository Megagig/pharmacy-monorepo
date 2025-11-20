import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
    captureCommunicationAuditData,
    logCommunicationAuditTrail,
    auditMessage,
    auditConversation,
    logCommunicationEvent,
    auditPatientCommunicationAccess,
} from '../../middlewares/communicationAuditMiddleware';
import CommunicationAuditService from '../../services/communicationAuditService';
import CommunicationAuditLog from '../../models/CommunicationAuditLog';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { AuthRequest } from '../../types/auth';

// Mock the audit service
jest.mock('../../services/communicationAuditService');
const mockAuditService = CommunicationAuditService as jest.Mocked<typeof CommunicationAuditService>;

describe('CommunicationAuditMiddleware', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await User.deleteMany({});
        await Workplace.deleteMany({});

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionPlan: 'professional',
        });

        // Create test user
        testUser = await User.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
        });

        // Setup mock request
        mockReq = {
            user: {
                _id: testUser._id,
                workplaceId: testWorkplace._id,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@test.com',
                role: 'pharmacist',
            },
            method: 'POST',
            originalUrl: '/api/communication/conversations/123/messages',
            params: { id: '507f1f77bcf86cd799439011' },
            query: {},
            body: {
                content: {
                    text: 'Test message',
                    type: 'text',
                },
                priority: 'normal',
            },
            ip: '192.168.1.1',
            connection: { remoteAddress: '192.168.1.1' },
            get: jest.fn().mockReturnValue('Test User Agent'),
            sessionID: 'test-session-123',
        } as any;

        // Setup mock response
        mockRes = {
            statusCode: 200,
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('captureCommunicationAuditData', () => {
        it('should capture audit data in request', () => {
            const middleware = captureCommunicationAuditData('message_sent', 'message');

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.communicationAuditData).toBeDefined();
            expect(mockReq.communicationAuditData!.action).toBe('message_sent');
            expect(mockReq.communicationAuditData!.targetType).toBe('message');
            expect(mockReq.communicationAuditData!.startTime).toBeDefined();
            expect(mockReq.communicationAuditData!.details).toEqual({
                method: 'POST',
                url: '/api/communication/conversations/123/messages',
                params: { id: '507f1f77bcf86cd799439011' },
                query: {},
                body: {
                    content: {
                        text: 'Test message',
                        type: 'text',
                    },
                    priority: 'normal',
                },
            });
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('logCommunicationAuditTrail', () => {
        beforeEach(() => {
            mockReq.communicationAuditData = {
                action: 'message_sent',
                targetType: 'message',
                startTime: Date.now() - 100,
                details: {
                    method: 'POST',
                    url: '/api/communication/conversations/123/messages',
                },
            };

            mockAuditService.createAuditContext.mockReturnValue({
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test User Agent',
                sessionId: 'test-session-123',
            });

            mockAuditService.createAuditLog.mockResolvedValue({} as any);
        });

        it('should log audit trail after successful response', async () => {
            const middleware = logCommunicationAuditTrail;

            // Mock res.json to simulate response
            const originalJson = mockRes.json;
            mockRes.json = jest.fn().mockImplementation((body) => {
                // Simulate the middleware behavior
                setTimeout(async () => {
                    expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                        expect.objectContaining({
                            userId: testUser._id,
                            workplaceId: testWorkplace._id,
                        }),
                        expect.objectContaining({
                            action: 'message_sent',
                            targetType: 'message',
                            success: true,
                            duration: expect.any(Number),
                        })
                    );
                }, 0);

                return originalJson?.call(mockRes, body);
            });

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            // Simulate response
            mockRes.json!({ success: true, data: { _id: '507f1f77bcf86cd799439012' } });

            expect(mockNext).toHaveBeenCalled();
        });

        it('should log audit trail after failed response', async () => {
            mockRes.statusCode = 400;

            const middleware = logCommunicationAuditTrail;

            // Mock res.json to simulate error response
            mockRes.json = jest.fn().mockImplementation((body) => {
                setTimeout(async () => {
                    expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                        expect.any(Object),
                        expect.objectContaining({
                            success: false,
                            errorMessage: 'Validation failed',
                        })
                    );
                }, 0);

                return body;
            });

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            // Simulate error response
            mockRes.json!({ success: false, message: 'Validation failed' });

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('auditMessage', () => {
        it('should return array of middleware functions', () => {
            const middlewares = auditMessage('message_sent');

            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares).toHaveLength(2);
            expect(typeof middlewares[0]).toBe('function');
            expect(typeof middlewares[1]).toBe('function');
        });
    });

    describe('auditConversation', () => {
        it('should return array of middleware functions', () => {
            const middlewares = auditConversation('conversation_created');

            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares).toHaveLength(2);
            expect(typeof middlewares[0]).toBe('function');
            expect(typeof middlewares[1]).toBe('function');
        });
    });

    describe('logCommunicationEvent', () => {
        beforeEach(() => {
            mockAuditService.createAuditContext.mockReturnValue({
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test User Agent',
                sessionId: 'test-session-123',
            });

            mockAuditService.createAuditLog.mockResolvedValue({} as any);
        });

        it('should log communication event manually', async () => {
            const targetId = '507f1f77bcf86cd799439011';
            const details = {
                conversationId: new mongoose.Types.ObjectId(),
                metadata: { test: 'data' },
            };

            await logCommunicationEvent(
                mockReq as AuthRequest,
                'custom_action',
                targetId,
                'conversation',
                details
            );

            expect(mockAuditService.createAuditContext).toHaveBeenCalledWith(mockReq);
            expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: testUser._id,
                    workplaceId: testWorkplace._id,
                }),
                expect.objectContaining({
                    action: 'custom_action',
                    targetId: new mongoose.Types.ObjectId(targetId),
                    targetType: 'conversation',
                    details,
                    success: true,
                })
            );
        });

        it('should handle missing user gracefully', async () => {
            mockReq.user = undefined;

            await logCommunicationEvent(
                mockReq as AuthRequest,
                'custom_action',
                '507f1f77bcf86cd799439011',
                'conversation'
            );

            expect(mockAuditService.createAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('auditPatientCommunicationAccess', () => {
        beforeEach(() => {
            mockReq.params = { patientId: '507f1f77bcf86cd799439011' };
            mockAuditService.createAuditContext.mockReturnValue({
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test User Agent',
                sessionId: 'test-session-123',
            });
            mockAuditService.createAuditLog.mockResolvedValue({} as any);
        });

        it('should audit patient communication access', async () => {
            await auditPatientCommunicationAccess(
                mockReq as AuthRequest,
                mockRes as Response,
                mockNext
            );

            expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: testUser._id,
                    workplaceId: testWorkplace._id,
                }),
                expect.objectContaining({
                    action: 'patient_communication_accessed',
                    targetId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
                    targetType: 'user',
                    details: expect.objectContaining({
                        patientId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
                        accessType: 'communication_review',
                    }),
                })
            );

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle missing patient ID', async () => {
            mockReq.params = {};

            await auditPatientCommunicationAccess(
                mockReq as AuthRequest,
                mockRes as Response,
                mockNext
            );

            expect(mockAuditService.createAuditLog).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle audit service errors gracefully', async () => {
            mockAuditService.createAuditLog.mockRejectedValue(new Error('Audit service error'));

            await auditPatientCommunicationAccess(
                mockReq as AuthRequest,
                mockRes as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('extractActionMetadata', () => {
        it('should extract message_sent metadata', () => {
            mockReq.communicationAuditData = {
                action: 'message_sent',
                targetType: 'message',
                startTime: Date.now(),
                details: {},
            };

            mockReq.body = {
                content: { type: 'text', attachments: ['file1.pdf'] },
                mentions: ['user1', 'user2'],
                priority: 'high',
                threadId: 'thread123',
            };

            const middleware = logCommunicationAuditTrail;

            // Mock res.json to capture metadata
            mockRes.json = jest.fn().mockImplementation((body) => {
                setTimeout(() => {
                    expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                        expect.any(Object),
                        expect.objectContaining({
                            details: expect.objectContaining({
                                metadata: expect.objectContaining({
                                    messageType: 'text',
                                    hasAttachments: true,
                                    mentionCount: 2,
                                    priority: 'high',
                                    threadId: 'thread123',
                                }),
                            }),
                        })
                    );
                }, 0);

                return body;
            });

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
            mockRes.json!({ success: true });
        });

        it('should extract conversation_created metadata', () => {
            mockReq.communicationAuditData = {
                action: 'conversation_created',
                targetType: 'conversation',
                startTime: Date.now(),
                details: {},
            };

            mockReq.body = {
                type: 'patient_query',
                participants: ['user1', 'user2', 'user3'],
                priority: 'urgent',
                tags: ['important', 'patient-care'],
            };

            const middleware = logCommunicationAuditTrail;

            mockRes.json = jest.fn().mockImplementation((body) => {
                setTimeout(() => {
                    expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
                        expect.any(Object),
                        expect.objectContaining({
                            details: expect.objectContaining({
                                metadata: expect.objectContaining({
                                    conversationType: 'patient_query',
                                    participantCount: 3,
                                    priority: 'urgent',
                                    tags: ['important', 'patient-care'],
                                }),
                            }),
                        })
                    );
                }, 0);

                return body;
            });

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
            mockRes.json!({ success: true });
        });
    });
});