import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Conversation, { IConversation } from '../../models/Conversation';
import Message, { IMessage } from '../../models/Message';
import Notification, { INotification } from '../../models/Notification';
import CommunicationAuditLog, { ICommunicationAuditLog } from '../../models/CommunicationAuditLog';
import { createCommunicationIndexes } from '../../utils/communicationIndexes';

describe('Enhanced Communication Models', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;
    let userId1: mongoose.Types.ObjectId;
    let userId2: mongoose.Types.ObjectId;
    let userId3: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create indexes for testing
        await createCommunicationIndexes();

        // Setup test data
        workplaceId = new mongoose.Types.ObjectId();
        userId1 = new mongoose.Types.ObjectId();
        userId2 = new mongoose.Types.ObjectId();
        userId3 = new mongoose.Types.ObjectId();
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

    describe('Enhanced Conversation Model', () => {
        describe('Advanced Validation', () => {
            it('should validate clinical context metadata', async () => {
                const conversationData = {
                    type: 'clinical_consultation',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages', 'send_messages', 'manage_clinical_context'],
                        },
                        {
                            userId: userId2,
                            role: 'doctor',
                            permissions: ['read_messages', 'send_messages', 'view_patient_data'],
                        },
                    ],
                    patientId,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                        clinicalContext: {
                            diagnosis: 'Hypertension with diabetes complications',
                            medications: [new mongoose.Types.ObjectId()],
                            conditions: ['Type 2 Diabetes', 'Hypertension'],
                            interventionIds: [new mongoose.Types.ObjectId()],
                        },
                    },
                };

                const conversation = new Conversation(conversationData);
                const savedConversation = await conversation.save();

                expect(savedConversation.metadata.clinicalContext?.diagnosis).toBe('Hypertension with diabetes complications');
                expect(savedConversation.metadata.clinicalContext?.medications).toHaveLength(1);
                expect(savedConversation.metadata.clinicalContext?.conditions).toContain('Type 2 Diabetes');
                expect(savedConversation.metadata.encryptionKeyId).toBeDefined();
            });

            it('should validate participant permissions based on role', async () => {
                const conversationData = {
                    type: 'patient_query',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            // Permissions will be auto-set based on role
                        },
                        {
                            userId: userId2,
                            role: 'patient',
                            // Permissions will be auto-set based on role
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

                const pharmacist = savedConversation.participants.find(p => p.role === 'pharmacist');
                const patient = savedConversation.participants.find(p => p.role === 'patient');

                expect(pharmacist?.permissions).toContain('view_patient_data');
                expect(pharmacist?.permissions).toContain('manage_clinical_context');
                expect(patient?.permissions).toContain('read_messages');
                expect(patient?.permissions).toContain('send_messages');
                expect(patient?.permissions).not.toContain('view_patient_data');
            });

            it('should enforce maximum participant limit', async () => {
                const participants = Array.from({ length: 51 }, (_, i) => ({
                    userId: new mongoose.Types.ObjectId(),
                    role: 'pharmacist' as const,
                    permissions: ['read_messages'],
                }));

                const conversationData = {
                    type: 'group' as const,
                    participants,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                };

                const conversation = new Conversation(conversationData);

                await expect(conversation.save()).rejects.toThrow(/between 1 and 50 participants/);
            });

            it('should validate conversation title length', async () => {
                const conversationData = {
                    title: 'a'.repeat(201), // Exceeds 200 character limit
                    type: 'group' as const,
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist' as const,
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

                await expect(conversation.save()).rejects.toThrow(/cannot exceed 200 characters/);
            });
        });

        describe('Enhanced Instance Methods', () => {
            let conversation: IConversation;

            beforeEach(async () => {
                conversation = new Conversation({
                    type: 'clinical_consultation',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages', 'send_messages'],
                        },
                    ],
                    patientId,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                    },
                });
                await conversation.save();
            });

            it('should handle unread count management correctly', () => {
                conversation.addParticipant(userId2, 'doctor');
                conversation.addParticipant(userId3, 'patient');

                // Simulate message sent by userId1
                conversation.incrementUnreadCount(userId1);

                expect(conversation.unreadCount.get(userId1.toString())).toBe(0);
                expect(conversation.unreadCount.get(userId2.toString())).toBe(1);
                expect(conversation.unreadCount.get(userId3.toString())).toBe(1);

                // Mark as read by userId2
                conversation.markAsRead(userId2);
                expect(conversation.unreadCount.get(userId2.toString())).toBe(0);

                const participant2 = conversation.participants.find(
                    p => p.userId.toString() === userId2.toString()
                );
                expect(participant2?.lastReadAt).toBeDefined();
            });

            it('should validate participant role retrieval', () => {
                conversation.addParticipant(userId2, 'doctor', ['read_messages', 'send_messages', 'view_patient_data']);

                expect(conversation.getParticipantRole(userId1)).toBe('pharmacist');
                expect(conversation.getParticipantRole(userId2)).toBe('doctor');
                expect(conversation.getParticipantRole(userId3)).toBeNull();
            });

            it('should handle participant removal with audit trail', () => {
                conversation.addParticipant(userId2, 'doctor');
                expect(conversation.hasParticipant(userId2)).toBe(true);

                conversation.removeParticipant(userId2);
                expect(conversation.hasParticipant(userId2)).toBe(false);

                const removedParticipant = conversation.participants.find(
                    p => p.userId.toString() === userId2.toString()
                );
                expect(removedParticipant?.leftAt).toBeDefined();
                expect(conversation.unreadCount.has(userId2.toString())).toBe(false);
            });
        });

        describe('Performance and Indexing', () => {
            beforeEach(async () => {
                // Create test conversations for performance testing
                const conversations = Array.from({ length: 100 }, (_, i) => ({
                    type: i % 2 === 0 ? 'patient_query' : 'group',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages'],
                        },
                    ],
                    patientId: i % 3 === 0 ? patientId : undefined,
                    workplaceId,
                    createdBy: userId1,
                    status: i % 4 === 0 ? 'archived' : 'active',
                    priority: i % 5 === 0 ? 'urgent' : 'normal',
                    tags: [`tag${i % 10}`],
                    metadata: {
                        isEncrypted: true,
                    },
                }));

                await Conversation.insertMany(conversations);
            });

            it('should efficiently query conversations by participant', async () => {
                const startTime = Date.now();
                const conversations = await (Conversation as any).findByParticipant(userId1, workplaceId);
                const queryTime = Date.now() - startTime;

                expect(conversations.length).toBeGreaterThan(0);
                expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
            });

            it('should efficiently query conversations by patient', async () => {
                const startTime = Date.now();
                const conversations = await (Conversation as any).findByPatient(patientId, workplaceId);
                const queryTime = Date.now() - startTime;

                expect(conversations.length).toBeGreaterThan(0);
                expect(queryTime).toBeLessThan(100);
            });

            it('should support text search on conversation content', async () => {
                // Create conversation with searchable content
                await Conversation.create({
                    title: 'Diabetes Management Discussion',
                    type: 'clinical_consultation',
                    participants: [
                        {
                            userId: userId1,
                            role: 'pharmacist',
                            permissions: ['read_messages'],
                        },
                    ],
                    patientId,
                    workplaceId,
                    createdBy: userId1,
                    metadata: {
                        isEncrypted: true,
                        clinicalContext: {
                            diagnosis: 'Type 2 Diabetes with complications',
                            conditions: ['Diabetes', 'Hypertension'],
                        },
                    },
                });

                const searchResults = await Conversation.find({
                    workplaceId,
                    $text: { $search: 'diabetes' },
                });

                expect(searchResults.length).toBeGreaterThan(0);
                expect(searchResults[0]?.title).toContain('Diabetes');
            });
        });
    });

    describe('Enhanced Message Model', () => {
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

        describe('Advanced Content Validation', () => {
            it('should validate clinical note message metadata', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        text: 'Patient shows significant improvement in blood glucose levels',
                        type: 'clinical_note',
                        metadata: {
                            clinicalData: {
                                patientId,
                                interventionId: new mongoose.Types.ObjectId(),
                                medicationId: new mongoose.Types.ObjectId(),
                            },
                        },
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);
                const savedMessage = await message.save();

                expect(savedMessage.content.type).toBe('clinical_note');
                expect(savedMessage.content.metadata?.clinicalData?.patientId?.toString()).toBe(patientId.toString());
                expect(savedMessage.isEncrypted).toBe(true);
                expect(savedMessage.encryptionKeyId).toBeDefined();
            });

            it('should validate system message with required metadata', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'system',
                        metadata: {
                            originalText: 'Dr. Smith joined the conversation',
                            systemAction: {
                                action: 'participant_added',
                                performedBy: userId1,
                                timestamp: new Date(),
                            },
                        },
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);
                const savedMessage = await message.save();

                expect(savedMessage.content.type).toBe('system');
                expect(savedMessage.content.metadata?.systemAction?.action).toBe('participant_added');
            });

            it('should validate file attachment security', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'file',
                        attachments: [
                            {
                                fileId: 'secure-file-123',
                                fileName: 'lab_results.pdf',
                                fileSize: 2048576, // 2MB
                                mimeType: 'application/pdf',
                                secureUrl: 'https://secure-storage.example.com/files/secure-file-123',
                                thumbnailUrl: 'https://secure-storage.example.com/thumbnails/secure-file-123',
                                uploadedAt: new Date(),
                            },
                        ],
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);
                const savedMessage = await message.save();

                expect(savedMessage.content.attachments).toHaveLength(1);
                expect(savedMessage.content.attachments?.[0]?.fileName).toBe('lab_results.pdf');
                expect(savedMessage.hasAttachments()).toBe(true);
                expect(savedMessage.getAttachmentCount()).toBe(1);
            });

            it('should reject dangerous file types', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'file',
                        attachments: [
                            {
                                fileId: 'malicious-file-123',
                                fileName: 'virus.exe',
                                fileSize: 1024,
                                mimeType: 'application/x-executable',
                                secureUrl: 'https://example.com/virus.exe',
                                uploadedAt: new Date(),
                            },
                        ],
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow(/File type not allowed/);
            });

            it('should enforce file size limits', async () => {
                const messageData = {
                    conversationId,
                    senderId: userId1,
                    content: {
                        type: 'file',
                        attachments: [
                            {
                                fileId: 'large-file-123',
                                fileName: 'huge_file.pdf',
                                fileSize: 200 * 1024 * 1024, // 200MB - exceeds 100MB limit
                                mimeType: 'application/pdf',
                                secureUrl: 'https://example.com/huge_file.pdf',
                                uploadedAt: new Date(),
                            },
                        ],
                    },
                    workplaceId,
                    createdBy: userId1,
                };

                const message = new Message(messageData);

                await expect(message.save()).rejects.toThrow(/File size cannot exceed 100MB/);
            });
        });

        describe('Enhanced Message Features', () => {
            let message: IMessage;

            beforeEach(async () => {
                message = new Message({
                    conversationId,
                    senderId: userId1,
                    content: {
                        text: 'How are you feeling today? Any side effects from the new medication?',
                        type: 'text',
                    },
                    mentions: [userId2],
                    workplaceId,
                    createdBy: userId1,
                });
                await message.save();
            });

            it('should handle message reactions with healthcare-specific emojis', () => {
                // Add various reactions
                message.addReaction(userId2, '👍');
                message.addReaction(userId2, '💊'); // Healthcare-specific emoji
                message.addReaction(userId1, '📋'); // Healthcare-specific emoji

                expect(message.reactions).toHaveLength(3);

                // Remove specific reaction
                message.removeReaction(userId2, '👍');
                expect(message.reactions).toHaveLength(2);

                // Verify healthcare emojis are preserved
                const healthcareReactions = message.reactions.filter(r =>
                    ['💊', '📋', '🩺', '📊'].includes(r.emoji)
                );
                expect(healthcareReactions).toHaveLength(2);
            });

            it('should track message edit history with reasons', () => {
                const originalText = message.content.text;
                const editedText = 'How are you feeling today? Any side effects from the medication? Please let me know.';
                const editReason = 'Added clarification request';

                message.addEdit(editedText, userId1, editReason);

                expect(message.content.text).toBe(editedText);
                expect(message.editHistory).toHaveLength(1);
                expect(message.editHistory[0]?.content).toBe(originalText);
                expect(message.editHistory[0]?.reason).toBe(editReason);
                expect(message.editHistory[0]?.editedBy.toString()).toBe(userId1.toString());
            });

            it('should handle read receipts and status tracking', () => {
                // Mark as read by different users
                message.markAsRead(userId2);
                message.markAsRead(userId3);

                expect(message.readBy).toHaveLength(2);
                expect(message.isReadBy(userId2)).toBe(true);
                expect(message.isReadBy(userId3)).toBe(true);
                expect(message.isReadBy(userId1)).toBe(false); // Sender hasn't "read" their own message

                // Verify read timestamps
                const user2Read = message.readBy.find(r => r.userId.toString() === userId2.toString());
                expect(user2Read?.readAt).toBeDefined();
            });

            it('should handle message threading correctly', async () => {
                // Create a reply to the original message
                const replyMessage = new Message({
                    conversationId,
                    senderId: userId2,
                    parentMessageId: message._id,
                    content: {
                        text: 'I feel much better, thank you for asking!',
                        type: 'text',
                    },
                    workplaceId,
                    createdBy: userId2,
                });
                await replyMessage.save();

                // Verify threading relationship
                expect(replyMessage.parentMessageId?.toString()).toBe(message._id.toString());

                // Test reply count virtual
                const messageWithReplies = await Message.findById(message._id).populate('replyCount');
                expect(messageWithReplies).toBeDefined();
            });
        });

        describe('Message Search and Performance', () => {
            beforeEach(async () => {
                // Create messages for search testing
                const messages = [
                    {
                        conversationId,
                        senderId: userId1,
                        content: { text: 'Patient medication adherence discussion', type: 'text' },
                        workplaceId,
                        createdBy: userId1,
                    },
                    {
                        conversationId,
                        senderId: userId2,
                        content: { text: 'Blood pressure monitoring results', type: 'text' },
                        workplaceId,
                        createdBy: userId2,
                    },
                    {
                        conversationId,
                        senderId: userId1,
                        content: { text: 'Diabetes management plan update', type: 'text' },
                        workplaceId,
                        createdBy: userId1,
                    },
                ];

                await Message.insertMany(messages);
            });

            it('should support full-text search on message content', async () => {
                const searchResults = await (Message as any).searchMessages(workplaceId, 'medication adherence');

                expect(searchResults.length).toBeGreaterThan(0);
                expect(searchResults[0]?.content.text).toContain('medication');
            });

            it('should efficiently paginate conversation messages', async () => {
                const startTime = Date.now();
                const messages = await (Message as any).findByConversation(conversationId, { limit: 10 });
                const queryTime = Date.now() - startTime;

                expect(messages.length).toBeGreaterThan(0);
                expect(queryTime).toBeLessThan(100); // Should complete quickly
            });

            it('should filter messages by type and sender', async () => {
                const textMessages = await Message.find({
                    conversationId,
                    'content.type': 'text',
                    senderId: userId1,
                }).sort({ createdAt: -1 });

                expect(textMessages.length).toBeGreaterThan(0);
                textMessages.forEach(msg => {
                    expect(msg.content.type).toBe('text');
                    expect(msg.senderId.toString()).toBe(userId1.toString());
                });
            });
        });
    });

    describe('Enhanced Notification Model', () => {
        describe('Advanced Notification Features', () => {
            it('should create notification with multiple delivery channels', async () => {
                const notificationData = {
                    userId: userId1,
                    type: 'clinical_alert',
                    title: 'Critical Drug Interaction Alert',
                    content: 'Potential interaction detected between prescribed medications',
                    data: {
                        patientId,
                        interventionId: new mongoose.Types.ObjectId(),
                        actionUrl: '/interventions/123',
                        metadata: {
                            severity: 'high',
                            medications: ['Warfarin', 'Aspirin'],
                        },
                    },
                    priority: 'critical',
                    deliveryChannels: {
                        inApp: true,
                        email: true,
                        sms: true,
                        push: true,
                    },
                    workplaceId,
                    createdBy: userId2,
                };

                const notification = new Notification(notificationData);
                const savedNotification = await notification.save();

                expect(savedNotification.priority).toBe('critical');
                expect(savedNotification.deliveryStatus).toHaveLength(4); // All channels enabled
                expect(savedNotification.expiresAt).toBeDefined();
                expect(savedNotification.groupKey).toContain('clinical_alert');
            });

            it('should handle notification scheduling and expiration', async () => {
                const scheduledTime = new Date(Date.now() + 60000); // 1 minute from now
                const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now

                const notificationData = {
                    userId: userId1,
                    type: 'therapy_update',
                    title: 'Scheduled Therapy Review',
                    content: 'Your therapy review is scheduled for tomorrow',
                    data: {
                        patientId,
                        actionUrl: '/therapy-reviews/456',
                    },
                    scheduledFor: scheduledTime,
                    expiresAt: expirationTime,
                    deliveryChannels: {
                        inApp: true,
                        email: false,
                        sms: false,
                        push: false,
                    },
                    workplaceId,
                    createdBy: userId2,
                };

                const notification = new Notification(notificationData);
                const savedNotification = await notification.save();

                expect(savedNotification.scheduledFor?.getTime()).toBe(scheduledTime.getTime());
                expect(savedNotification.expiresAt?.getTime()).toBe(expirationTime.getTime());
                expect(savedNotification.isExpired()).toBe(false);

                // Test expiration check
                savedNotification.expiresAt = new Date(Date.now() - 1000); // 1 second ago
                expect(savedNotification.isExpired()).toBe(true);
            });

            it('should track delivery status across multiple channels', async () => {
                const notification = new Notification({
                    userId: userId1,
                    type: 'new_message',
                    title: 'New Message',
                    content: 'You have a new message',
                    data: {
                        conversationId: new mongoose.Types.ObjectId(),
                        senderId: userId2,
                    },
                    deliveryChannels: {
                        inApp: true,
                        email: true,
                        sms: false,
                        push: true,
                    },
                    workplaceId,
                    createdBy: userId2,
                });
                await notification.save();

                // Simulate delivery attempts
                notification.updateDeliveryStatus('inApp', 'delivered');
                notification.updateDeliveryStatus('email', 'sent');
                notification.updateDeliveryStatus('push', 'failed', { reason: 'Device not registered' });

                const inAppStatus = notification.getDeliveryStatusForChannel('inApp');
                const emailStatus = notification.getDeliveryStatusForChannel('email');
                const pushStatus = notification.getDeliveryStatusForChannel('push');

                expect(inAppStatus?.status).toBe('delivered');
                expect(emailStatus?.status).toBe('sent');
                expect(pushStatus?.status).toBe('failed');
                expect(pushStatus?.failureReason).toBe('Device not registered');

                // Test retry eligibility
                expect(notification.canRetryDelivery('push')).toBe(true);
                expect(notification.canRetryDelivery('inApp')).toBe(false); // Already delivered
            });

            it('should handle notification grouping and batching', async () => {
                const groupKey = 'patient_updates_123';
                const batchId = 'batch_456';

                const notifications = [
                    {
                        userId: userId1,
                        type: 'patient_query',
                        title: 'Patient Question 1',
                        content: 'Patient has a question about medication',
                        data: { patientId },
                        groupKey,
                        batchId,
                        deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                        workplaceId,
                        createdBy: userId2,
                    },
                    {
                        userId: userId1,
                        type: 'patient_query',
                        title: 'Patient Question 2',
                        content: 'Patient has another question',
                        data: { patientId },
                        groupKey,
                        batchId,
                        deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                        workplaceId,
                        createdBy: userId2,
                    },
                ];

                await Notification.insertMany(notifications);

                // Query grouped notifications
                const groupedNotifications = await Notification.find({
                    groupKey,
                    userId: userId1,
                });

                expect(groupedNotifications).toHaveLength(2);
                groupedNotifications.forEach(notif => {
                    expect(notif.groupKey).toBe(groupKey);
                    expect(notif.batchId).toBe(batchId);
                });
            });
        });

        describe('Notification Query Performance', () => {
            beforeEach(async () => {
                // Create test notifications
                const notifications = Array.from({ length: 50 }, (_, i) => ({
                    userId: i % 2 === 0 ? userId1 : userId2,
                    type: i % 3 === 0 ? 'clinical_alert' : 'new_message',
                    title: `Test Notification ${i}`,
                    content: `Test content ${i}`,
                    data: {
                        patientId: i % 4 === 0 ? patientId : undefined,
                    },
                    status: i % 5 === 0 ? 'read' : 'unread',
                    priority: i % 7 === 0 ? 'urgent' : 'normal',
                    deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                }));

                await Notification.insertMany(notifications);
            });

            it('should efficiently query unread notifications', async () => {
                const startTime = Date.now();
                const unreadNotifications = await (Notification as any).findUnreadByUser(userId1, workplaceId);
                const queryTime = Date.now() - startTime;

                expect(unreadNotifications.length).toBeGreaterThan(0);
                expect(queryTime).toBeLessThan(100);

                unreadNotifications.forEach((notif: any) => {
                    expect(notif.status).toBe('unread');
                    expect(notif.userId.toString()).toBe(userId1.toString());
                });
            });

            it('should efficiently count unread notifications', async () => {
                const startTime = Date.now();
                const unreadCount = await (Notification as any).getUnreadCountByUser(userId1, workplaceId);
                const queryTime = Date.now() - startTime;

                expect(unreadCount).toBeGreaterThan(0);
                expect(queryTime).toBeLessThan(50);
            });

            it('should find scheduled notifications for delivery', async () => {
                // Create scheduled notification
                await Notification.create({
                    userId: userId1,
                    type: 'system_notification',
                    title: 'Scheduled Notification',
                    content: 'This is a scheduled notification',
                    data: {},
                    scheduledFor: new Date(Date.now() - 1000), // 1 second ago
                    deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                    workplaceId,
                    createdBy: userId2,
                });

                const scheduledNotifications = await (Notification as any).findScheduledForDelivery();

                expect(scheduledNotifications.length).toBeGreaterThan(0);
                expect(scheduledNotifications[0]?.title).toBe('Scheduled Notification');
            });
        });
    });

    describe('Enhanced Communication Audit Log Model', () => {
        describe('Advanced Audit Features', () => {
            it('should automatically determine risk level based on action', async () => {
                const auditData = {
                    action: 'conversation_exported',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    details: {
                        conversationId: new mongoose.Types.ObjectId(),
                        patientId,
                        metadata: {
                            exportFormat: 'pdf',
                            exportReason: 'compliance audit',
                        },
                    },
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0 (Healthcare App)',
                    workplaceId,
                };

                const auditLog = new CommunicationAuditLog(auditData);
                const savedAuditLog = await auditLog.save();

                expect(savedAuditLog.riskLevel).toBe('critical'); // Export is critical risk
                expect(savedAuditLog.complianceCategory).toBe('data_access');
                expect(savedAuditLog.isHighRisk()).toBe(true);
            });

            it('should track operation duration and success status', async () => {
                const auditData = {
                    action: 'message_sent',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'message',
                    details: {
                        conversationId: new mongoose.Types.ObjectId(),
                        messageId: new mongoose.Types.ObjectId(),
                    },
                    ipAddress: '10.0.0.1',
                    userAgent: 'Mobile App v2.1',
                    success: false,
                    errorMessage: 'Network timeout during message encryption',
                    duration: 5000, // 5 seconds
                    workplaceId,
                };

                const auditLog = new CommunicationAuditLog(auditData);
                const savedAuditLog = await auditLog.save();

                expect(savedAuditLog.success).toBe(false);
                expect(savedAuditLog.errorMessage).toBe('Network timeout during message encryption');
                expect(savedAuditLog.duration).toBe(5000);
                expect(savedAuditLog.riskLevel).toBe('medium'); // Failed operation increases risk
            });

            it('should format audit details for reporting', async () => {
                const auditLog = new CommunicationAuditLog({
                    action: 'participant_added',
                    userId: userId1,
                    targetId: new mongoose.Types.ObjectId(),
                    targetType: 'conversation',
                    details: {
                        conversationId: new mongoose.Types.ObjectId(),
                        patientId,
                        participantIds: [userId2, userId3],
                        metadata: {
                            addedRole: 'doctor',
                            addedPermissions: ['read_messages', 'send_messages'],
                        },
                    },
                    ipAddress: '172.16.0.1',
                    userAgent: 'Web App Chrome/91.0',
                    workplaceId,
                });
                await auditLog.save();

                const formattedDetails = auditLog.getFormattedDetails();

                expect(formattedDetails).toContain('Conversation:');
                expect(formattedDetails).toContain('Patient:');
                expect(formattedDetails).toContain('Participants: 2');
            });
        });

        describe('Audit Query and Reporting', () => {
            beforeEach(async () => {
                // Create audit log entries for testing
                const auditEntries = [
                    {
                        action: 'message_sent',
                        userId: userId1,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'message',
                        details: { conversationId: new mongoose.Types.ObjectId() },
                        riskLevel: 'low',
                        complianceCategory: 'communication_security',
                        ipAddress: '192.168.1.1',
                        userAgent: 'Test Browser',
                        workplaceId,
                    },
                    {
                        action: 'conversation_exported',
                        userId: userId2,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'conversation',
                        details: { conversationId: new mongoose.Types.ObjectId(), patientId },
                        riskLevel: 'critical',
                        complianceCategory: 'data_access',
                        ipAddress: '192.168.1.2',
                        userAgent: 'Test Browser',
                        workplaceId,
                    },
                    {
                        action: 'file_downloaded',
                        userId: userId1,
                        targetId: new mongoose.Types.ObjectId(),
                        targetType: 'file',
                        details: { fileId: 'file123', fileName: 'patient_report.pdf' },
                        riskLevel: 'medium',
                        complianceCategory: 'file_security',
                        ipAddress: '192.168.1.1',
                        userAgent: 'Test Browser',
                        workplaceId,
                    },
                ];

                await CommunicationAuditLog.insertMany(auditEntries);
            });

            it('should find high-risk activities efficiently', async () => {
                const timeRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
                    end: new Date(),
                };

                const highRiskActivities = await (CommunicationAuditLog as any).findHighRiskActivities(
                    workplaceId,
                    timeRange
                );

                expect(highRiskActivities.length).toBeGreaterThan(0);
                highRiskActivities.forEach((activity: any) => {
                    expect(['high', 'critical']).toContain(activity.riskLevel);
                });
            });

            it('should generate compliance reports', async () => {
                const dateRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date(),
                };

                const complianceReport = await (CommunicationAuditLog as any).getComplianceReport(
                    workplaceId,
                    dateRange
                );

                expect(complianceReport.length).toBeGreaterThan(0);

                const reportItem = complianceReport[0];
                expect(reportItem._id).toHaveProperty('complianceCategory');
                expect(reportItem._id).toHaveProperty('riskLevel');
                expect(reportItem).toHaveProperty('count');
            });

            it('should provide user activity summaries', async () => {
                const dateRange = {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date(),
                };

                const activitySummary = await (CommunicationAuditLog as any).getUserActivitySummary(
                    userId1,
                    workplaceId,
                    dateRange
                );

                expect(activitySummary.length).toBeGreaterThan(0);

                const summaryItem = activitySummary[0];
                expect(summaryItem).toHaveProperty('_id'); // action
                expect(summaryItem).toHaveProperty('count');
                expect(summaryItem).toHaveProperty('successRate');
                expect(summaryItem).toHaveProperty('lastActivity');
            });

            it('should log actions using static method', async () => {
                const actionDetails = {
                    conversationId: new mongoose.Types.ObjectId(),
                    messageId: new mongoose.Types.ObjectId(),
                    metadata: {
                        messageType: 'clinical_note',
                        priority: 'urgent',
                    },
                };

                const context = {
                    workplaceId,
                    ipAddress: '10.0.0.100',
                    userAgent: 'Mobile App v3.0',
                    sessionId: 'session_789',
                    success: true,
                    duration: 150,
                };

                const auditLog = await (CommunicationAuditLog as any).logAction(
                    'message_sent',
                    userId1,
                    new mongoose.Types.ObjectId(),
                    'message',
                    actionDetails,
                    context
                );

                expect(auditLog.action).toBe('message_sent');
                expect(auditLog.userId.toString()).toBe(userId1.toString());
                expect(auditLog.success).toBe(true);
                expect(auditLog.duration).toBe(150);
                expect(auditLog.sessionId).toBe('session_789');
            });
        });
    });

    describe('Cross-Model Integration', () => {
        it('should maintain referential integrity across models', async () => {
            // Create conversation
            const conversation = await Conversation.create({
                type: 'patient_query',
                participants: [
                    { userId: userId1, role: 'pharmacist', permissions: ['read_messages', 'send_messages'] },
                    { userId: userId2, role: 'patient', permissions: ['read_messages', 'send_messages'] },
                ],
                patientId,
                workplaceId,
                createdBy: userId1,
                metadata: { isEncrypted: true },
            });

            // Create message in conversation
            const message = await Message.create({
                conversationId: conversation._id,
                senderId: userId1,
                content: {
                    text: 'How are you feeling with the new medication?',
                    type: 'text',
                },
                mentions: [userId2],
                workplaceId,
                createdBy: userId1,
            });

            // Create notification for the message
            const notification = await Notification.create({
                userId: userId2,
                type: 'mention',
                title: 'You were mentioned in a message',
                content: 'Dr. Smith mentioned you in a conversation',
                data: {
                    conversationId: conversation._id,
                    messageId: message._id,
                    senderId: userId1,
                },
                deliveryChannels: { inApp: true, email: false, sms: false, push: false },
                workplaceId,
                createdBy: userId1,
            });

            // Create audit log for the message
            const auditLog = await CommunicationAuditLog.create({
                action: 'message_sent',
                userId: userId1,
                targetId: message._id,
                targetType: 'message',
                details: {
                    conversationId: conversation._id,
                    messageId: message._id,
                    patientId,
                },
                ipAddress: '192.168.1.1',
                userAgent: 'Test Browser',
                workplaceId,
            });

            // Verify all relationships
            expect(message.conversationId.toString()).toBe(conversation._id.toString());
            expect(notification.data.conversationId?.toString()).toBe(conversation._id.toString());
            expect(notification.data.messageId?.toString()).toBe(message._id.toString());
            expect(auditLog.details.conversationId?.toString()).toBe(conversation._id.toString());
            expect(auditLog.details.messageId?.toString()).toBe(message._id.toString());

            // Test cascade updates
            conversation.updateLastMessage(message._id);
            await conversation.save();

            expect(conversation.lastMessageId?.toString()).toBe(message._id.toString());
        });

        it('should handle concurrent operations safely', async () => {
            const conversation = await Conversation.create({
                type: 'group',
                participants: [
                    { userId: userId1, role: 'pharmacist', permissions: ['read_messages', 'send_messages'] },
                ],
                workplaceId,
                createdBy: userId1,
                metadata: { isEncrypted: true },
            });

            // Simulate concurrent message sending
            const messagePromises = Array.from({ length: 10 }, (_, i) =>
                Message.create({
                    conversationId: conversation._id,
                    senderId: userId1,
                    content: {
                        text: `Concurrent message ${i}`,
                        type: 'text',
                    },
                    workplaceId,
                    createdBy: userId1,
                })
            );

            const messages = await Promise.all(messagePromises);

            expect(messages).toHaveLength(10);
            messages.forEach((message, index) => {
                expect(message.content.text).toBe(`Concurrent message ${index}`);
                expect(message.conversationId.toString()).toBe(conversation._id.toString());
            });
        });
    });
});