import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import communicationAuditController from '../../controllers/communicationAuditController';
import CommunicationAuditService from '../../services/communicationAuditService';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { AuthRequest } from '../../types/auth';

// Mock the audit service
jest.mock('../../services/communicationAuditService');
const mockAuditService = CommunicationAuditService as jest.Mocked<typeof CommunicationAuditService>;

// Mock express-validator
jest.mock('express-validator', () => ({
    validationResult: jest.fn().mockReturnValue({
        isEmpty: () => true,
        array: () => [],
    }),
}));

describe('CommunicationAuditController', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;

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
            query: {},
            params: {},
        } as any;

        // Setup mock response
        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('getAuditLogs', () => {
        beforeEach(() => {
            mockAuditService.getAuditLogs.mockResolvedValue({
                logs: [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        action: 'message_sent',
                        userId: testUser._id,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'message',
                        timestamp: new Date(),
                        riskLevel: 'low',
                        complianceCategory: 'communication_security',
                    },
                ],
                total: 1,
                page: 1,
                limit: 50,
                pages: 1,
            } as any);
        });

        it('should get audit logs successfully', async () => {
            mockReq.query = {
                action: 'message_sent',
                limit: '10',
                offset: '0',
            };

            await communicationAuditController.getAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    action: 'message_sent',
                    limit: 10,
                    offset: 0,
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Audit logs retrieved successfully',
                data: expect.any(Array),
                pagination: expect.objectContaining({
                    total: 1,
                    page: 1,
                    limit: 50,
                    pages: 1,
                }),
            });
        });

        it('should handle service errors', async () => {
            mockAuditService.getAuditLogs.mockRejectedValue(new Error('Service error'));

            await communicationAuditController.getAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to retrieve audit logs',
                error: undefined, // In production mode
            });
        });
    });

    describe('getConversationAuditLogs', () => {
        beforeEach(() => {
            mockAuditService.getConversationAuditLogs.mockResolvedValue([
                {
                    _id: new mongoose.Types.ObjectId(),
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    timestamp: new Date(),
                },
            ] as any);
        });

        it('should get conversation audit logs successfully', async () => {
            const conversationId = new mongoose.Types.ObjectId().toString();
            mockReq.params = { conversationId };
            mockReq.query = { limit: '50' };

            await communicationAuditController.getConversationAuditLogs(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getConversationAuditLogs).toHaveBeenCalledWith(
                conversationId,
                testWorkplace._id.toString(),
                expect.objectContaining({
                    limit: 50,
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Conversation audit logs retrieved successfully',
                data: expect.any(Array),
                count: 1,
            });
        });
    });

    describe('getHighRiskActivities', () => {
        beforeEach(() => {
            mockAuditService.getHighRiskActivities.mockResolvedValue([
                {
                    _id: new mongoose.Types.ObjectId(),
                    action: 'conversation_exported',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    riskLevel: 'critical',
                    timestamp: new Date(),
                },
            ] as any);
        });

        it('should get high-risk activities successfully', async () => {
            const startDate = new Date('2023-01-01').toISOString();
            const endDate = new Date('2023-12-31').toISOString();
            mockReq.query = { startDate, endDate };

            await communicationAuditController.getHighRiskActivities(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getHighRiskActivities).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    start: new Date(startDate),
                    end: new Date(endDate),
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'High-risk activities retrieved successfully',
                data: expect.any(Array),
                count: 1,
                dateRange: expect.any(Object),
            });
        });

        it('should use default date range when not provided', async () => {
            await communicationAuditController.getHighRiskActivities(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getHighRiskActivities).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    start: expect.any(Date),
                    end: expect.any(Date),
                })
            );
        });
    });

    describe('generateComplianceReport', () => {
        beforeEach(() => {
            mockAuditService.generateComplianceReport.mockResolvedValue([
                {
                    _id: {
                        complianceCategory: 'communication_security',
                        riskLevel: 'low',
                        success: true,
                    },
                    count: 10,
                    avgDuration: 150,
                },
            ] as any);
        });

        it('should generate compliance report successfully', async () => {
            const startDate = new Date('2023-01-01').toISOString();
            const endDate = new Date('2023-12-31').toISOString();
            mockReq.query = { startDate, endDate };

            await communicationAuditController.generateComplianceReport(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.generateComplianceReport).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    start: new Date(startDate),
                    end: new Date(endDate),
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Compliance report generated successfully',
                data: expect.any(Array),
                dateRange: expect.any(Object),
                generatedAt: expect.any(Date),
            });
        });
    });

    describe('exportAuditLogs', () => {
        beforeEach(() => {
            mockAuditService.exportAuditLogs.mockResolvedValue('CSV data here');
        });

        it('should export audit logs as CSV', async () => {
            mockReq.query = {
                format: 'csv',
                action: 'message_sent',
                startDate: new Date('2023-01-01').toISOString(),
            };

            await communicationAuditController.exportAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockAuditService.exportAuditLogs).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    action: 'message_sent',
                    startDate: new Date('2023-01-01'),
                }),
                'csv'
            );

            expect(mockRes.setHeader).toHaveBeenCalledWith(
                'Content-Disposition',
                expect.stringContaining('attachment; filename=')
            );
            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockRes.send).toHaveBeenCalledWith('CSV data here');
        });

        it('should export audit logs as JSON', async () => {
            mockReq.query = { format: 'json' };
            mockAuditService.exportAuditLogs.mockResolvedValue('{"data": "json"}');

            await communicationAuditController.exportAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockAuditService.exportAuditLogs).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.any(Object),
                'json'
            );

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(mockRes.send).toHaveBeenCalledWith('{"data": "json"}');
        });
    });

    describe('getUserActivitySummary', () => {
        beforeEach(() => {
            mockAuditService.getUserActivitySummary.mockResolvedValue([
                {
                    _id: 'message_sent',
                    count: 25,
                    lastActivity: new Date(),
                    successRate: 0.96,
                },
            ] as any);
        });

        it('should get user activity summary successfully', async () => {
            const userId = new mongoose.Types.ObjectId().toString();
            mockReq.params = { userId };
            mockReq.query = {
                startDate: new Date('2023-01-01').toISOString(),
                endDate: new Date('2023-12-31').toISOString(),
            };

            await communicationAuditController.getUserActivitySummary(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getUserActivitySummary).toHaveBeenCalledWith(
                userId,
                testWorkplace._id.toString(),
                expect.objectContaining({
                    start: new Date('2023-01-01'),
                    end: new Date('2023-12-31'),
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'User activity summary retrieved successfully',
                data: expect.any(Array),
                userId,
                dateRange: expect.any(Object),
            });
        });

        it('should use current user ID when not provided', async () => {
            await communicationAuditController.getUserActivitySummary(
                mockReq as AuthRequest,
                mockRes as Response
            );

            expect(mockAuditService.getUserActivitySummary).toHaveBeenCalledWith(
                testUser._id.toString(),
                testWorkplace._id.toString(),
                expect.any(Object)
            );
        });
    });

    describe('getAuditStatistics', () => {
        beforeEach(() => {
            mockAuditService.getAuditLogs.mockResolvedValue({
                logs: [],
                total: 100,
                page: 1,
                limit: 1,
                pages: 100,
            } as any);

            mockAuditService.getHighRiskActivities.mockResolvedValue([
                { riskLevel: 'high' },
                { riskLevel: 'critical' },
            ] as any);

            mockAuditService.generateComplianceReport.mockResolvedValue([
                { _id: { complianceCategory: 'communication_security' }, count: 50 },
            ] as any);
        });

        it('should get audit statistics successfully', async () => {
            await communicationAuditController.getAuditStatistics(mockReq as AuthRequest, mockRes as Response);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Audit statistics retrieved successfully',
                data: expect.objectContaining({
                    totalActivities: 100,
                    highRiskActivities: 2,
                    recentActivities: expect.any(Number),
                    complianceSummary: expect.any(Array),
                    dateRange: expect.any(Object),
                    generatedAt: expect.any(Date),
                }),
            });
        });
    });

    describe('searchAuditLogs', () => {
        beforeEach(() => {
            mockAuditService.getAuditLogs.mockResolvedValue({
                logs: [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        action: 'message_sent',
                        userId: testUser._id,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'message',
                        timestamp: new Date(),
                    },
                ],
                total: 1,
                page: 1,
                limit: 50,
                pages: 1,
            } as any);
        });

        it('should search audit logs successfully', async () => {
            mockReq.query = {
                q: 'message',
                startDate: new Date('2023-01-01').toISOString(),
                limit: '25',
            };

            await communicationAuditController.searchAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
                testWorkplace._id.toString(),
                expect.objectContaining({
                    action: 'message_sent',
                    startDate: new Date('2023-01-01'),
                    limit: 25,
                })
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Audit logs search completed',
                data: expect.any(Array),
                searchQuery: 'message',
                pagination: expect.any(Object),
            });
        });

        it('should reject short search queries', async () => {
            mockReq.query = { q: 'a' };

            await communicationAuditController.searchAuditLogs(mockReq as AuthRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Search query must be at least 2 characters long',
            });
        });
    });
});