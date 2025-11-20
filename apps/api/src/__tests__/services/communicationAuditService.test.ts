import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import CommunicationAuditService, { CommunicationAuditContext } from '../../services/communicationAuditService';
import CommunicationAuditLog from '../../models/CommunicationAuditLog';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('CommunicationAuditService', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let auditContext: CommunicationAuditContext;

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
        await CommunicationAuditLog.deleteMany({});
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

        // Create audit context
        auditContext = {
            userId: testUser._id,
            workplaceId: testWorkplace._id,
            ipAddress: '192.168.1.1',
            userAgent: 'Test User Agent',
            sessionId: 'test-session-123',
        };
    });

    describe('createAuditLog', () => {
        it('should create a basic audit log entry', async () => {
            const targetId = new mongoose.Types.ObjectId();
            const auditData = {
                action: 'message_sent' as const,
                targetId,
                targetType: 'message' as const,
                details: {
                    conversationId: new mongoose.Types.ObjectId(),
                    metadata: {
                        messageType: 'text',
                        priority: 'normal',
                    },
                },
            };

            const auditLog = await CommunicationAuditService.createAuditLog(auditContext, auditData);

            expect(auditLog).toBeDefined();
            expect(auditLog.action).toBe('message_sent');
            expect(auditLog.userId.toString()).toBe(testUser._id.toString());
            expect(auditLog.workplaceId.toString()).toBe(testWorkplace._id.toString());
            expect(auditLog.targetId.toString()).toBe(targetId.toString());
            expect(auditLog.targetType).toBe('message');
            expect(auditLog.success).toBe(true);
            expect(auditLog.riskLevel).toBeDefined();
            expect(auditLog.complianceCategory).toBeDefined();
        });

        it('should set risk level automatically', async () => {
            const targetId = new mongoose.Types.ObjectId();
            const auditData = {
                action: 'conversation_exported' as const,
                targetId,
                targetType: 'conversation' as const,
                details: {
                    conversationId: new mongoose.Types.ObjectId(),
                    metadata: {
                        exportFormat: 'csv',
                        messageCount: 100,
                    },
                },
            };

            const auditLog = await CommunicationAuditService.createAuditLog(auditContext, auditData);

            expect(auditLog.riskLevel).toBe('critical');
        });

        it('should handle failed operations', async () => {
            const targetId = new mongoose.Types.ObjectId();
            const auditData = {
                action: 'message_sent' as const,
                targetId,
                targetType: 'message' as const,
                details: {
                    conversationId: new mongoose.Types.ObjectId(),
                },
                success: false,
                errorMessage: 'Failed to send message',
            };

            const auditLog = await CommunicationAuditService.createAuditLog(auditContext, auditData);

            expect(auditLog.success).toBe(false);
            expect(auditLog.errorMessage).toBe('Failed to send message');
        });
    });

    describe('logMessageSent', () => {
        it('should log message sent activity', async () => {
            const messageId = new mongoose.Types.ObjectId();
            const conversationId = new mongoose.Types.ObjectId();
            const patientId = new mongoose.Types.ObjectId();

            const auditLog = await CommunicationAuditService.logMessageSent(
                auditContext,
                messageId,
                conversationId,
                {
                    messageType: 'text',
                    hasAttachments: false,
                    mentionCount: 2,
                    priority: 'high',
                    patientId,
                }
            );

            expect(auditLog.action).toBe('message_sent');
            expect(auditLog.targetId.toString()).toBe(messageId.toString());
            expect(auditLog.details.conversationId?.toString()).toBe(conversationId.toString());
            expect(auditLog.details.patientId?.toString()).toBe(patientId.toString());
            expect(auditLog.details.metadata?.messageType).toBe('text');
            expect(auditLog.details.metadata?.mentionCount).toBe(2);
            expect(auditLog.details.metadata?.priority).toBe('high');
        });
    });

    describe('logConversationCreated', () => {
        it('should log conversation creation', async () => {
            const conversationId = new mongoose.Types.ObjectId();
            const patientId = new mongoose.Types.ObjectId();

            const auditLog = await CommunicationAuditService.logConversationCreated(
                auditContext,
                conversationId,
                {
                    conversationType: 'patient_query',
                    participantCount: 3,
                    patientId,
                    priority: 'urgent',
                }
            );

            expect(auditLog.action).toBe('conversation_created');
            expect(auditLog.targetId.toString()).toBe(conversationId.toString());
            expect(auditLog.details.conversationId?.toString()).toBe(conversationId.toString());
            expect(auditLog.details.patientId?.toString()).toBe(patientId.toString());
            expect(auditLog.details.metadata?.conversationType).toBe('patient_query');
            expect(auditLog.details.metadata?.participantCount).toBe(3);
            expect(auditLog.details.metadata?.priority).toBe('urgent');
        });
    });

    describe('getAuditLogs', () => {
        beforeEach(async () => {
            // Create test audit logs
            const logs = [
                {
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'low',
                    complianceCategory: 'communication_security',
                },
                {
                    action: 'conversation_exported',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'critical',
                    complianceCategory: 'data_access',
                },
            ];

            await CommunicationAuditLog.insertMany(logs);
        });

        it('should get all audit logs for workplace', async () => {
            const result = await CommunicationAuditService.getAuditLogs(testWorkplace._id.toString());

            expect(result.logs).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(50);
        });

        it('should filter by action', async () => {
            const result = await CommunicationAuditService.getAuditLogs(testWorkplace._id.toString(), {
                action: 'message_sent',
            });

            expect(result.logs).toHaveLength(1);
            expect(result.logs[0]?.action).toBe('message_sent');
        });

        it('should filter by risk level', async () => {
            const result = await CommunicationAuditService.getAuditLogs(testWorkplace._id.toString(), {
                riskLevel: 'critical',
            });

            expect(result.logs).toHaveLength(1);
            expect(result.logs[0]?.riskLevel).toBe('critical');
        });

        it('should paginate results', async () => {
            const result = await CommunicationAuditService.getAuditLogs(testWorkplace._id.toString(), {
                limit: 1,
                offset: 0,
            });

            expect(result.logs).toHaveLength(1);
            expect(result.total).toBe(2);
            expect(result.pages).toBe(2);
        });
    });

    describe('exportAuditLogs', () => {
        beforeEach(async () => {
            // Create test audit log
            await CommunicationAuditLog.create({
                action: 'message_sent',
                userId: testUser._id,
                targetId: new mongoose.Types.ObjectId(),
                targetType: 'message',
                details: { conversationId: new mongoose.Types.ObjectId() },
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
                riskLevel: 'low',
                complianceCategory: 'communication_security',
            });
        });

        it('should export audit logs as CSV', async () => {
            const csvData = await CommunicationAuditService.exportAuditLogs(
                testWorkplace._id.toString(),
                {},
                'csv'
            );

            expect(csvData).toContain('Timestamp,Action,User');
            expect(csvData).toContain('message_sent');
            expect(csvData).toContain('John Doe');
        });

        it('should export audit logs as JSON', async () => {
            const jsonData = await CommunicationAuditService.exportAuditLogs(
                testWorkplace._id.toString(),
                {},
                'json'
            );

            const parsedData = JSON.parse(jsonData);
            expect(Array.isArray(parsedData)).toBe(true);
            expect(parsedData).toHaveLength(1);
            expect(parsedData[0].action).toBe('message_sent');
        });
    });

    describe('getHighRiskActivities', () => {
        beforeEach(async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            // Create high-risk and low-risk activities
            await CommunicationAuditLog.insertMany([
                {
                    action: 'conversation_exported',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'critical',
                    complianceCategory: 'data_access',
                    timestamp: yesterday,
                },
                {
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'low',
                    complianceCategory: 'communication_security',
                    timestamp: yesterday,
                },
            ]);
        });

        it('should return only high-risk activities', async () => {
            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            const now = new Date();

            const activities = await CommunicationAuditService.getHighRiskActivities(
                testWorkplace._id.toString(),
                { start: twoDaysAgo, end: now }
            );

            expect(activities).toHaveLength(1);
            expect(activities[0]?.riskLevel).toBe('critical');
            expect(activities[0]?.action).toBe('conversation_exported');
        });
    });

    describe('generateComplianceReport', () => {
        beforeEach(async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            await CommunicationAuditLog.insertMany([
                {
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'low',
                    complianceCategory: 'communication_security',
                    success: true,
                    timestamp: yesterday,
                },
                {
                    action: 'conversation_exported',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'critical',
                    complianceCategory: 'data_access',
                    success: true,
                    timestamp: yesterday,
                },
            ]);
        });

        it('should generate compliance report', async () => {
            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            const now = new Date();

            const report = await CommunicationAuditService.generateComplianceReport(
                testWorkplace._id.toString(),
                { start: twoDaysAgo, end: now }
            );

            expect(Array.isArray(report)).toBe(true);
            expect(report.length).toBeGreaterThan(0);

            // Check that report contains compliance categories
            const categories = report.map(item => item._id.complianceCategory);
            expect(categories).toContain('communication_security');
            expect(categories).toContain('data_access');
        });
    });

    describe('cleanupOldLogs', () => {
        beforeEach(async () => {
            const oldDate = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000); // 10 years ago
            const recentDate = new Date();

            await CommunicationAuditLog.insertMany([
                {
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'low',
                    complianceCategory: 'communication_security',
                    timestamp: oldDate,
                },
                {
                    action: 'message_sent',
                    userId: testUser._id,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: { conversationId: new mongoose.Types.ObjectId() },
                    workplaceId: testWorkplace._id,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Agent',
                    riskLevel: 'low',
                    complianceCategory: 'communication_security',
                    timestamp: recentDate,
                },
            ]);
        });

        it('should clean up old logs', async () => {
            const initialCount = await CommunicationAuditLog.countDocuments();
            expect(initialCount).toBe(2);

            const deletedCount = await CommunicationAuditService.cleanupOldLogs(365); // Keep 1 year

            expect(deletedCount).toBe(1);

            const remainingCount = await CommunicationAuditLog.countDocuments();
            expect(remainingCount).toBe(1);
        });
    });

    describe('createAuditContext', () => {
        it('should create audit context from request', () => {
            const mockReq = {
                user: {
                    _id: testUser._id,
                    workplaceId: testWorkplace._id,
                },
                ip: '192.168.1.100',
                connection: { remoteAddress: '192.168.1.100' },
                get: jest.fn().mockReturnValue('Mozilla/5.0'),
                sessionID: 'session-123',
            } as any;

            const context = CommunicationAuditService.createAuditContext(mockReq);

            expect(context.userId.toString()).toBe(testUser._id.toString());
            expect(context.workplaceId.toString()).toBe(testWorkplace._id.toString());
            expect(context.ipAddress).toBe('192.168.1.100');
            expect(context.userAgent).toBe('Mozilla/5.0');
            expect(context.sessionId).toBe('session-123');
        });
    });
});