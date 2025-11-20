import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Conversation, { IConversation } from '../../models/Conversation';
import Message, { IMessage } from '../../models/Message';
import Notification, { INotification } from '../../models/Notification';
import CommunicationAuditLog, { ICommunicationAuditLog } from '../../models/CommunicationAuditLog';

describe('Communication Models', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;
    let userId1: mongoose.Types.ObjectId;
    let userId2: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Setup test data
        workplaceId = new mongoose.Types.ObjectId();
        userId1 = new mongoose.Types.ObjectId();
        userId2 = new mongoose.Types.ObjectId();
        patientId = new mongoose.Types.ObjectId();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clean up collections before each test
        await Conversation.deleteMany({});
        await Message.deleteMany({});
        await Notification.deleteMany({});
        await CommunicationAuditLog.deleteMany({});
    });

    describe('Conversation Model', () => {
        describe('Validation', () => {
            it('should create a valid conversation', async () => {
                const conversationData = {
                    type: 'patient_query',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages', 'send_messages'],
                        },
                        {
                            userId: userId2,
                            role: 'patient',
                            permissions: ['read_messages', 'send_messages'],
                        },
                    ],
                    patientId,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                };

                const conversation = new Conversation(conversationData);
                const savedConversation = await conversation.save();

                expect(savedConversation._id).toBeDefined();
                expect(savedConversation.type).toBe('patient_query');
                expect(savedConversation.participants).toHaveLength(2);
                expect(savedConversation.status).toBe('active');
                expect(savedConversation.priority).toBe('normal');
                expect(savedConversation.metadata.isEncrypted).toBe(true);
                expect(savedConversation.metadata.encryptionKeyId).toBeDefined();
            });

            it('should require patientId for patient_query type', async () => {
                const conversationData = {
                    type: 'patient_query',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages', 'send_messages'],
                        },
                    ],
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                };

                const conversation = new Conversation(conversationData);

                await expect(conversation.save()).rejects.toThrow();
            });

            it('should validate participant count limits', async () => {
                const participants = Array.from({ length: 51 }, (_, i) => ({
                    userId: new mongoose.Types.ObjectId(),
                    role: 'pharmacist',
                    permissions: ['read_messages'],
                }));

                const conversationData = {
                    type: 'group',
                    participants,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                };

                const conversation = new Conversation(conversationData);

                await expect(conversation.save()).rejects.toThrow();
            });

            it('should validate conversation type enum', async () => {
                const conversationData = {
                    type: 'invalid_type',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages'],
                        },
                    ],
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                };

                const conversation = new Conversation(conversationData);

                await expect(conversation.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let conversation: IConversation;

            beforeEach(async () => {
                conversation = new Conversation({
                    type: 'group',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages', 'send_messages'],
                        },
                    ],
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                });
                await conversation.save();
            });

            it('should add participant correctly', () => {
                conversation.addParticipant(userId2, 'patient');

                expect(conversation.participants).toHaveLength(2);
                expect(conversation.hasParticipant(userId2)).toBe(true);
                expect(conversation.getParticipantRole(userId2)).toBe('patient');
            });

            it('should prevent adding duplicate participants', () => {
                expect(() => {
                    conversation.addParticipant(userId1, 'pharmacist');
                }).toThrow('User is already a participant in this conversation');
            });

            it('should remove participant correctly', () => {
                conversation.addParticipant(userId2, 'patient');
                conversation.removeParticipant(userId2);

                const participant = conversation.participants.find(
                    p => p.userId.toString() === userId2.toString()
                );
                expect(participant?.leftAt).toBeDefined();
                expect(conversation.hasParticipant(userId2)).toBe(false);
            });

            it('should update last message correctly', () => {
                const messageId = new mongoose.Types.ObjectId();
                const originalTime = conversation.lastMessageAt;

                conversation.updateLastMessage(messageId);

                expect(conversation.lastMessageId?.toString()).toBe(messageId.toString());
                expect(conversation.lastMessageAt.getTime()).toBeGreaterThan(originalTime.getTime());
            });

            it('should increment unread count correctly', () => {
                conversation.addParticipant(userId2, 'patient');
                conversation.incrementUnreadCount(userId1);

                expect(conversation.unreadCount.get(userId2.toString())).toBe(1);
                expect(conversation.unreadCount.get(userId1.toString())).toBe(0);
            });

            it('should mark as read correctly', () => {
                conversation.addParticipant(userId2, 'patient');
                conversation.incrementUnreadCount();
                conversation.markAsRead(userId2);

                expect(conversation.unreadCount.get(userId2.toString())).toBe(0);

                const participant = conversation.participants.find(
                    p => p.userId.toString() === userId2.toString()
                );
                expect(participant?.lastReadAt).toBeDefined();
            });
        });

        describe('Static Methods', () => {
            beforeEach(async () => {
                // Create test conversations
                await Conversation.create([
                    {
                        type: 'patient_query',
                        participants: [
                            { userId: userId1, role: 'pharmacist', permissions: ['read_messages'] },
                            { userId: userId2, role: 'patient', permissions: ['read_messages'] },
                        ],
                        patientId,
                        workplaceId,
                        createdBy: userId1,
                        status: 'active',
                        metadata: { isEncrypted: true },
                    },
                    {
                        type: 'group',
                        participants: [
                            { userId: userId1, role: 'pharmacist', permissions: ['read_messages'] },
                        ],
                        workplaceId,
                        createdBy: userId1,
                        status: 'archived',
                        metadata: { isEncrypted: true },
                    },
                ]);
            });

            it('should find conversations by participant', async () => {
                const conversations = await Conversation.findByParticipant(userId1, workplaceId);

                expect(conversations).toHaveLength(1); // Only active conversation
                expect(conversations[0].type).toBe('patient_query');
            });

            it('should find conversations by patient', async () => {
                const conversations = await Conversation.findByPatient(patientId, workplaceId);

                expect(conversations).toHaveLength(1);
                expect(conversations[0].patientId?.toString()).toBe(patientId.toString());
            });
        });
    });

    describe('Message Model', () => {
        let conversationId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            const conversation = await Conversation.create({
                type: 'direct',
                participants: [
                    { userId: userId1, role: 'pharmacist', permissions: ['read_messages'] },
                    { userId: userId2, role: 'patient', permissions: ['read_messages'] },
                ],
                workplaceId,
                createdBy: userId1,
                metadata: { isEncrypted: true },
            });
            conversationId = conversation._id;
        });

        describe('Validation', () => {
            it('should create a valid text message', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        text: 'Hello, how are you feeling today?',
                        type: 'text',
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);
                const savedMessage = await message.save();

                expect(savedMessage._id).toBeDefined();
                expect(savedMessage.content.text).toBe('Hello, how are you feeling today?');
                expect(savedMessage.content.type).toBe('text');
                expect(savedMessage.status).toBe('sent');
                expect(savedMessage.priority).toBe('normal');
                expect(savedMessage.isEncrypted).toBe(true);
                expect(savedMessage.encryptionKeyId).toBeDefined();
            });

            it('should require text for text messages', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'text',
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow();
            });

            it('should require attachments for file messages', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'file',
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow();
            });

            it('should validate attachment file types', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'file',
                        attachments: [
                            {
                                fileId: 'file123',
                                fileName: 'malicious.exe',
                                fileSize: 1024,
                                mimeType: 'application/x-executable',
                                secureUrl: 'https://example.com/file123',
                                uploadedAt: new Date(),
                            },
                        ],
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow();
            });

            it('should validate system message metadata', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'system',
                        metadata: {
                            originalText: 'User joined the conversation',
                        },
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let message: IMessage;

            beforeEach(async () => {
                message = new Message({
                    conversationId,
                    senderId: userId1,
                    content: {
                        text: 'Test message',
                        type: 'text',
                    },
                    workplaceId,
                    createdBy: userId1,
                });
                await message.save();
            });

            it('should add reaction correctly', () => {
                message.addReaction(userId2, '👍');

                expect(message.reactions).toHaveLength(1);
                expect(message.reactions[0].userId.toString()).toBe(userId2.toString());
                expect(message.reactions[0].emoji).toBe('👍');
            });

            it('should remove duplicate reactions', () => {
                message.addReaction(userId2, '👍');
                message.addReaction(userId2, '👍'); // Same user, same emoji

                expect(message.reactions).toHaveLength(1);
            });

            it('should remove reaction correctly', () => {
                message.addReaction(userId2, '👍');
                message.removeReaction(userId2, '👍');

                expect(message.reactions).toHaveLength(0);
            });

            it('should mark as read correctly', () => {
                message.markAsRead(userId2);

                expect(message.readBy).toHaveLength(1);
                expect(message.readBy[0].userId.toString()).toBe(userId2.toString());
                expect(message.isReadBy(userId2)).toBe(true);
            });

            it('should add edit history correctly', () => {
                const originalText = message.content.text;
                const newText = 'Updated message';

                message.addEdit(newText, userId1, 'Fixed typo');

                expect(message.content.text).toBe(newText);
                expect(message.editHistory).toHaveLength(1);
                expect(message.editHistory[0].content).toBe(originalText);
                expect(message.editHistory[0].reason).toBe('Fixed typo');
            });

            it('should handle attachments correctly', () => {
                message.content.attachments = [
                    {
                        fileId: 'file123',
                        fileName: 'test.pdf',
                        fileSize: 1024,
                        mimeType: 'application/pdf',
                        secureUrl: 'https://example.com/file123',
                        uploadedAt: new Date(),
                    },
                ];

                expect(message.hasAttachments()).toBe(true);
                expect(message.getAttachmentCount()).toBe(1);
            });
        });

        describe('Static Methods', () => {
            beforeEach(async () => {
                // Create test messages
                await Message.create([
                    {
                        conversationId,
                        senderId: userId1,
                        content: { text: 'First message', type: 'text' },
                        workplaceId,
                        createdBy: userId1,
                    },
                    {
                        conversationId,
                        senderId: userId2,
                        content: { text: 'Second message with keyword', type: 'text' },
                        workplaceId,
                        createdBy: userId2,
                    },
                ]);
            });

            it('should find messages by conversation', async () => {
                const messages = await Message.findByConversation(conversationId);

                expect(messages).toHaveLength(2);
                expect(messages[0].createdAt.getTime()).toBeGreaterThan(messages[1].createdAt.getTime());
            });

            it('should search messages by text', async () => {
                const messages = await Message.searchMessages(workplaceId, 'keyword');

                expect(messages).toHaveLength(1);
                expect(messages[0].content.text).toContain('keyword');
            });
        });
    });

    describe('Notification Model', () => {
        describe('Validation', () => {
            it('should create a valid notification', async () => {
                const notificationData = {
                    userId: userId1,
                    type: 'new_message',
                    title: 'New Message',
                    content: 'You have received a new message',
                    data: {
                        conversationId: new mongoose.Types.ObjectId(),
                        senderId: userId2,
                    },
                    deliveryChannels: {
                        inApp: true,
                        email: false,
                        sms: false,
                        push: true,
                    },
                    workplaceId,
                    createdBy: userId2,
                };

                const notification = new Notification(notificationData);
                const savedNotification = await notification.save();

                expect(savedNotification._id).toBeDefined();
                expect(savedNotification.type).toBe('new_message');
                expect(savedNotification.status).toBe('unread');
                expect(savedNotification.priority).toBe('normal');
                expect(savedNotification.expiresAt).toBeDefined();
                expect(savedNotification.deliveryStatus).toHaveLength(2); // inApp and push
            });

            it('should validate notification type enum', async () => {
                const notificationData = {
                    userId: userId1,
                    type: 'invalid_type',
                    title: 'Test',
                    content: 'Test content',
                    data: {},
                    deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                };

                const notification = new Notification(notificationData);

                await expect(notification.save()).rejects.toThrow();
            });

            it('should validate title and content length', async () => {
                const notificationData = {
                    userId: userId1,
                    type: 'new_message',
                    title: 'a'.repeat(201), // Too long
                    content: 'Test content',
                    data: {},
                    deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                };

                const notification = new Notification(notificationData);

                await expect(notification.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let notification: INotification;

            beforeEach(async () => {
                notification = new Notification({
                    userId: userId1,
                    type: 'new_message',
                    title: 'Test Notification',
                    content: 'Test content',
                    data: {},
                    deliveryChannels: { inApp: true, email: true, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                });
                await notification.save();
            });

            it('should mark as read correctly', () => {
                notification.markAsRead();

                expect(notification.status).toBe('read');
                expect(notification.readAt).toBeDefined();
            });

            it('should mark as dismissed correctly', () => {
                notification.markAsDismissed();

                expect(notification.status).toBe('dismissed');
                expect(notification.dismissedAt).toBeDefined();
            });

            it('should update delivery status correctly', () => {
                notification.updateDeliveryStatus('email', 'sent');

                const emailStatus = notification.getDeliveryStatusForChannel('email');
                expect(emailStatus?.status).toBe('sent');
                expect(emailStatus?.sentAt).toBeDefined();
                expect(emailStatus?.attempts).toBe(1);
            });

            it('should handle delivery failures correctly', () => {
                notification.updateDeliveryStatus('email', 'failed', { reason: 'Invalid email' });

                const emailStatus = notification.getDeliveryStatusForChannel('email');
                expect(emailStatus?.status).toBe('failed');
                expect(emailStatus?.failureReason).toBe('Invalid email');
                expect(emailStatus?.attempts).toBe(1);
            });

            it('should check retry eligibility correctly', () => {
                // Fresh notification should allow retry
                expect(notification.canRetryDelivery('email')).toBe(true);

                // After max attempts, should not allow retry
                for (let i = 0; i < 5; i++) {
                    notification.updateDeliveryStatus('email', 'failed');
                }
                expect(notification.canRetryDelivery('email')).toBe(false);
            });

            it('should check expiration correctly', () => {
                expect(notification.isExpired()).toBe(false);

                notification.expiresAt = new Date(Date.now() - 1000); // 1 second ago
                expect(notification.isExpired()).toBe(true);
            });
        });

        describe('Static Methods', () => {
            beforeEach(async () => {
                // Create test notifications
                await Notification.create([
                    {
                        userId: userId1,
                        type: 'new_message',
                        title: 'Unread Notification',
                        content: 'Test content',
                        data: {},
                        status: 'unread',
                        deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                        workplaceId,
                        createdBy: userId2,
                    },
                    {
                        userId: userId1,
                        type: 'clinical_alert',
                        title: 'Read Notification',
                        content: 'Test content',
                        data: {},
                        status: 'read',
                        deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                        workplaceId,
                        createdBy: userId2,
                    },
                ]);
            });

            it('should find unread notifications by user', async () => {
                const notifications = await Notification.findUnreadByUser(userId1, workplaceId);

                expect(notifications).toHaveLength(1);
                expect(notifications[0].status).toBe('unread');
            });

            it('should get unread count by user', async () => {
                const count = await Notification.getUnreadCountByUser(userId1, workplaceId);

                expect(count).toBe(1);
            });

            it('should find scheduled notifications', async () => {
                // Create scheduled notification
                await Notification.create({
                    userId: userId1,
                    type: 'system_notification',
                    title: 'Scheduled Notification',
                    content: 'Test content',
                    data: {},
                    scheduledFor: new Date(Date.now() - 1000), // 1 second ago
                    deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                });

                const scheduled = await Notification.findScheduledForDelivery();

                expect(scheduled).toHaveLength(1);
                expect(scheduled[0].title).toBe('Scheduled Notification');
            });
        });
    });

    describe('CommunicationAuditLog Model', () => {
        describe('Validation', () => {
            it('should create a valid audit log', async () => {
                const auditData = {
                    action: 'message_sent',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: {
                        conversationId: new mongoose.Types.ObjectId(),
                        messageId: new mongoose.Types.ObjectId(),
                    },
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0 Test Browser',
                    workplaceId,
                };

                const auditLog = new CommunicationAuditLog(auditData);
                const savedAuditLog = await auditLog.save();

                expect(savedAuditLog._id).toBeDefined();
                expect(savedAuditLog.action).toBe('message_sent');
                expect(savedAuditLog.success).toBe(true);
                expect(savedAuditLog.riskLevel).toBe('low');
                expect(savedAuditLog.complianceCategory).toBe('communication_security');
            });

            it('should validate action enum', async () => {
                const auditData = {
                    action: 'invalid_action',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: {},
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Browser',
                    workplaceId,
                };

                const auditLog = new CommunicationAuditLog(auditData);

                await expect(auditLog.save()).rejects.toThrow();
            });

            it('should validate IP address format', async () => {
                const auditData = {
                    action: 'message_sent',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: {},
                    ipAddress: 'invalid-ip',
                    userAgent: 'Test Browser',
                    workplaceId,
                };

                const auditLog = new CommunicationAuditLog(auditData);

                await expect(auditLog.save()).rejects.toThrow();
            });
        });

        describe('Instance Methods', () => {
            let auditLog: ICommunicationAuditLog;

            beforeEach(async () => {
                auditLog = new CommunicationAuditLog({
                    action: 'message_deleted',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: {
                        conversationId: new mongoose.Types.ObjectId(),
                        messageId: new mongoose.Types.ObjectId(),
                    },
                    ipAddress: '192.168.1.1',
                    userAgent: 'Test Browser',
                    workplaceId,
                });
            });

            it('should set risk level automatically', () => {
                auditLog.setRiskLevel();

                expect(auditLog.riskLevel).toBe('high'); // message_deleted is high risk
            });

            it('should identify high risk actions', () => {
                auditLog.setRiskLevel();

                expect(auditLog.isHighRisk()).toBe(true);
            });

            it('should format details correctly', () => {
                const formatted = auditLog.getFormattedDetails();

                expect(formatted).toContain('Conversation:');
                expect(formatted).toContain('Message:');
            });

            it('should increase risk level for failed operations', () => {
                auditLog.action = 'message_sent'; // Normally low risk
                auditLog.success = false;
                auditLog.setRiskLevel();

                expect(auditLog.riskLevel).toBe('medium');
            });
        });

        describe('Static Methods', () => {
            let conversationId: mongoose.Types.ObjectId;

            beforeEach(async () => {
                conversationId = new mongoose.Types.ObjectId();

                // Create test audit logs
                await CommunicationAuditLog.create([
                    {
                        action: 'message_sent',
                        userId: userId1,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'message',
                        details: { conversationId },
                        ipAddress: '192.168.1.1',
                        userAgent: 'Test Browser',
                        workplaceId,
                        riskLevel: 'low',
                        complianceCategory: 'communication_security',
                    },
                    {
                        action: 'message_deleted',
                        userId: userId1,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'message',
                        details: { conversationId },
                        ipAddress: '192.168.1.1',
                        userAgent: 'Test Browser',
                        workplaceId,
                        riskLevel: 'high',
                        complianceCategory: 'message_integrity',
                    },
                ]);
            });

            it('should log action correctly', async () => {
                const auditLog = await CommunicationAuditLog.logAction(
                    'conversation_created',
                    userId1,
                    conversationId,
                    'conversation',
                    { conversationId },
                    {
                        workplaceId,
                        ipAddress: '192.168.1.1',
                        userAgent: 'Test Browser',
                    }
                );

                expect(auditLog.action).toBe('conversation_created');
                expect(auditLog.success).toBe(true);
            });

            it('should find logs by conversation', async () => {
                const logs = await CommunicationAuditLog.findByConversation(conversationId, workplaceId);

                expect(logs).toHaveLength(2);
            });

            it('should find high risk activities', async () => {
                const timeRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date(),
                };

                const highRiskLogs = await CommunicationAuditLog.findHighRiskActivities(workplaceId, timeRange);

                expect(highRiskLogs).toHaveLength(1);
                expect(highRiskLogs[0].riskLevel).toBe('high');
            });

            it('should generate compliance report', async () => {
                const dateRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date(),
                };

                const report = await CommunicationAuditLog.getComplianceReport(workplaceId, dateRange);

                expect(report).toHaveLength(2); // Two different compliance categories
            });

            it('should generate user activity summary', async () => {
                const dateRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date(),
                };

                const summary = await CommunicationAuditLog.getUserActivitySummary(userId1, workplaceId, dateRange);

                expect(summary).toHaveLength(2); // Two different actions
                expect(summary[0].count).toBeGreaterThan(0);
            });
        });
    });
});