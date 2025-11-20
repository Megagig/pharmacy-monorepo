import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CommunicationService } from '../../services/communicationService';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import CommunicationAuditLog from '../../models/CommunicationAuditLog';
import { encryptionService } from '../../services/encryptionService';

// Mock the encryption service
jest.mock('../../services/encryptionService', () => ({
    encryptionService: {
        generateEncryptionKey: jest.fn(),
        encryptMessage: jest.fn(),
        decryptMessage: jest.fn(),
    },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

describe('CommunicationService', () => {
    let mongoServer: MongoMemoryServer;
    let communicationService: CommunicationService;
    let testWorkplaceId: string;
    let testUserId: string;
    let testPatientId: string;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Close existing connection if any
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await Conversation.deleteMany({});
        await Message.deleteMany({});
        await CommunicationAuditLog.deleteMany({});

        // Reset mocks
        jest.clearAllMocks();

        // Initialize service and test data
        communicationService = new CommunicationService();
        testWorkplaceId = new mongoose.Types.ObjectId().toString();
        testUserId = new mongoose.Types.ObjectId().toString();
        testPatientId = new mongoose.Types.ObjectId().toString();

        // Setup encryption service mocks
        (encryptionService.generateEncryptionKey as jest.Mock).mockResolvedValue('test-key-123');
        (encryptionService.encryptMessage as jest.Mock).mockResolvedValue('encrypted-content');
        (encryptionService.decryptMessage as jest.Mock).mockResolvedValue('decrypted-content');
    });

    describe('createConversation', () => {
        it('should create a direct conversation successfully', async () => {
            const conversationData = {
                type: 'direct' as const,
                participants: [
                    { userId: testUserId, role: 'pharmacist' as const },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' as const },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            };

            const conversation = await communicationService.createConversation(conversationData);

            expect(conversation).toBeDefined();
            expect(conversation.type).toBe('direct');
            expect(conversation.participants).toHaveLength(2);
            expect(conversation.status).toBe('active');
            expect(conversation.metadata.isEncrypted).toBe(true);
            expect(encryptionService.generateEncryptionKey).toHaveBeenCalled();
        });

        it('should create a patient query conversation with patient ID', async () => {
            const conversationData = {
                type: 'patient_query' as const,
                participants: [
                    { userId: testUserId, role: 'pharmacist' as const },
                    { userId: testPatientId, role: 'patient' as const },
                ],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                priority: 'high' as const,
                tags: ['medication-query', 'urgent'],
            };

            const conversation = await communicationService.createConversation(conversationData);

            expect(conversation.type).toBe('patient_query');
            expect(conversation.patientId?.toString()).toBe(testPatientId);
            expect(conversation.priority).toBe('high');
            expect(conversation.tags).toContain('medication-query');
        });

        it('should throw error when creating patient query without patient ID', async () => {
            const conversationData = {
                type: 'patient_query' as const,
                participants: [
                    { userId: testUserId, role: 'pharmacist' as const },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            };

            await expect(communicationService.createConversation(conversationData))
                .rejects.toThrow('Patient ID is required for patient queries and clinical consultations');
        });

        it('should throw error when no participants provided', async () => {
            const conversationData = {
                type: 'direct' as const,
                participants: [],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            };

            await expect(communicationService.createConversation(conversationData))
                .rejects.toThrow('Conversation must have at least one participant');
        });

        it('should throw error when too many participants', async () => {
            const participants = Array.from({ length: 51 }, (_, i) => ({
                userId: new mongoose.Types.ObjectId().toString(),
                role: 'patient' as const,
            }));

            const conversationData = {
                type: 'group' as const,
                participants,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            };

            await expect(communicationService.createConversation(conversationData))
                .rejects.toThrow('Conversation cannot have more than 50 participants');
        });

        it('should create conversation with clinical context', async () => {
            const conversationData = {
                type: 'clinical_consultation' as const,
                participants: [
                    { userId: testUserId, role: 'pharmacist' as const },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'doctor' as const },
                ],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                clinicalContext: {
                    diagnosis: 'Hypertension',
                    conditions: ['High blood pressure', 'Diabetes'],
                    medications: [new mongoose.Types.ObjectId().toString()],
                },
            };

            const conversation = await communicationService.createConversation(conversationData);

            expect(conversation.metadata.clinicalContext?.diagnosis).toBe('Hypertension');
            expect(conversation.metadata.clinicalContext?.conditions).toContain('High blood pressure');
            expect(conversation.metadata.clinicalContext?.medications).toHaveLength(1);
        });
    });

    describe('addParticipant', () => {
        let conversationId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'group',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();
        });

        it('should add participant successfully', async () => {
            const newUserId = new mongoose.Types.ObjectId().toString();

            await communicationService.addParticipant(
                conversationId,
                newUserId,
                'doctor',
                testUserId
            );

            const updatedConversation = await Conversation.findById(conversationId);
            expect(updatedConversation?.participants).toHaveLength(2);
            expect(updatedConversation?.participants.some(p => p.userId.toString() === newUserId)).toBe(true);
        });

        it('should throw error when adding existing participant', async () => {
            await expect(communicationService.addParticipant(
                conversationId,
                testUserId,
                'doctor',
                testUserId
            )).rejects.toThrow('User is already a participant in this conversation');
        });

        it('should throw error when conversation not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.addParticipant(
                nonExistentId,
                new mongoose.Types.ObjectId().toString(),
                'doctor',
                testUserId
            )).rejects.toThrow('Conversation not found');
        });
    });

    describe('removeParticipant', () => {
        let conversationId: string;
        let participantId: string;

        beforeEach(async () => {
            participantId = new mongoose.Types.ObjectId().toString();
            const conversation = await communicationService.createConversation({
                type: 'group',
                participants: [
                    { userId: testUserId, role: 'pharmacist' },
                    { userId: participantId, role: 'doctor' },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();
        });

        it('should remove participant successfully', async () => {
            await communicationService.removeParticipant(conversationId, participantId, testUserId);

            const updatedConversation = await Conversation.findById(conversationId);
            const participant = updatedConversation?.participants.find(p => p.userId.toString() === participantId);
            expect(participant?.leftAt).toBeDefined();
        });

        it('should throw error when removing non-existent participant', async () => {
            const nonExistentUserId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.removeParticipant(
                conversationId,
                nonExistentUserId,
                testUserId
            )).rejects.toThrow('User is not an active participant in this conversation');
        });
    });

    describe('sendMessage', () => {
        let conversationId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [
                    { userId: testUserId, role: 'pharmacist' },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();
        });

        it('should send text message successfully', async () => {
            const messageData = {
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'Hello, how can I help you?',
                    type: 'text' as const,
                },
                workplaceId: testWorkplaceId,
            };

            const message = await communicationService.sendMessage(messageData);

            expect(message).toBeDefined();
            expect(message.senderId.toString()).toBe(testUserId);
            expect(message.status).toBe('sent');
            expect(encryptionService.encryptMessage).toHaveBeenCalledWith(
                'Hello, how can I help you?',
                'test-key-123'
            );
        });

        it('should send message with attachments', async () => {
            const messageData = {
                conversationId,
                senderId: testUserId,
                content: {
                    type: 'file' as const,
                    attachments: [{
                        fileId: 'file-123',
                        fileName: 'prescription.pdf',
                        fileSize: 1024,
                        mimeType: 'application/pdf',
                        secureUrl: 'https://secure-storage.com/file-123',
                    }],
                },
                workplaceId: testWorkplaceId,
            };

            const message = await communicationService.sendMessage(messageData);

            expect(message.content.attachments).toHaveLength(1);
            expect(message.content.attachments?.[0]?.fileName).toBe('prescription.pdf');
        });

        it('should send message with mentions', async () => {
            const mentionedUserId = new mongoose.Types.ObjectId().toString();
            const messageData = {
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'Please review this case',
                    type: 'text' as const,
                },
                mentions: [mentionedUserId],
                priority: 'high' as const,
                workplaceId: testWorkplaceId,
            };

            const message = await communicationService.sendMessage(messageData);

            expect(message.mentions).toHaveLength(1);
            expect(message.mentions[0]!.toString()).toBe(mentionedUserId);
            expect(message.priority).toBe('high');
        });

        it('should throw error when sender is not participant', async () => {
            const nonParticipantId = new mongoose.Types.ObjectId().toString();
            const messageData = {
                conversationId,
                senderId: nonParticipantId,
                content: {
                    text: 'Unauthorized message',
                    type: 'text' as const,
                },
                workplaceId: testWorkplaceId,
            };

            await expect(communicationService.sendMessage(messageData))
                .rejects.toThrow('User is not a participant in this conversation');
        });

        it('should throw error when conversation not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const messageData = {
                conversationId: nonExistentId,
                senderId: testUserId,
                content: {
                    text: 'Message to non-existent conversation',
                    type: 'text' as const,
                },
                workplaceId: testWorkplaceId,
            };

            await expect(communicationService.sendMessage(messageData))
                .rejects.toThrow('Conversation not found');
        });
    });

    describe('getConversations', () => {
        beforeEach(async () => {
            // Create test conversations
            await communicationService.createConversation({
                type: 'direct',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                priority: 'normal',
            });

            await communicationService.createConversation({
                type: 'patient_query',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                priority: 'high',
                tags: ['urgent'],
            });
        });

        it('should get all conversations for user', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId
            );

            expect(conversations).toHaveLength(2);
            expect(conversations.every((c: any) => c.participants.some((p: any) => p.userId.toString() === testUserId))).toBe(true);
        });

        it('should filter conversations by type', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId,
                { type: 'patient_query' }
            );

            expect(conversations).toHaveLength(1);
            expect(conversations[0]?.type).toBe('patient_query');
        });

        it('should filter conversations by priority', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId,
                { priority: 'high' }
            );

            expect(conversations).toHaveLength(1);
            expect(conversations[0]?.priority).toBe('high');
        });

        it('should filter conversations by patient ID', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId,
                { patientId: testPatientId }
            );

            expect(conversations).toHaveLength(1);
            expect(conversations[0]?.patientId?.toString()).toBe(testPatientId);
        });

        it('should filter conversations by tags', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId,
                { tags: ['urgent'] }
            );

            expect(conversations).toHaveLength(1);
            expect(conversations[0]?.tags).toContain('urgent');
        });

        it('should apply pagination', async () => {
            const conversations = await communicationService.getConversations(
                testUserId,
                testWorkplaceId,
                { limit: 1, offset: 0 }
            );

            expect(conversations).toHaveLength(1);
        });
    });

    describe('getMessages', () => {
        let conversationId: string;
        let messageId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [
                    { userId: testUserId, role: 'pharmacist' },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();

            const message = await communicationService.sendMessage({
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'Test message',
                    type: 'text',
                },
                workplaceId: testWorkplaceId,
            });
            messageId = message._id.toString();
        });

        it('should get messages for conversation', async () => {
            const messages = await communicationService.getMessages(
                conversationId,
                testUserId
            );

            expect(messages).toHaveLength(1);
            expect(messages[0]?._id.toString()).toBe(messageId);
            expect(encryptionService.decryptMessage).toHaveBeenCalled();
        });

        it('should apply pagination with limit', async () => {
            // Send another message
            await communicationService.sendMessage({
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'Second message',
                    type: 'text',
                },
                workplaceId: testWorkplaceId,
            });

            const messages = await communicationService.getMessages(
                conversationId,
                testUserId,
                { limit: 1 }
            );

            expect(messages).toHaveLength(1);
        });

        it('should throw error when user has no access to conversation', async () => {
            const unauthorizedUserId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.getMessages(
                conversationId,
                unauthorizedUserId
            )).rejects.toThrow('User does not have access to this conversation');
        });

        it('should throw error when conversation not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.getMessages(
                nonExistentId,
                testUserId
            )).rejects.toThrow('Conversation not found');
        });

        it('should handle decryption errors gracefully', async () => {
            (encryptionService.decryptMessage as jest.Mock).mockRejectedValueOnce(
                new Error('Decryption failed')
            );

            const messages = await communicationService.getMessages(
                conversationId,
                testUserId
            );

            expect(messages).toHaveLength(1);
            // Should return encrypted content when decryption fails
            expect(messages[0]?.content.text).toBe('encrypted-content');
        });
    });

    describe('markMessageAsRead', () => {
        let conversationId: string;
        let messageId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [
                    { userId: testUserId, role: 'pharmacist' },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();

            const message = await communicationService.sendMessage({
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'Test message',
                    type: 'text',
                },
                workplaceId: testWorkplaceId,
            });
            messageId = message._id.toString();
        });

        it('should mark message as read successfully', async () => {
            await communicationService.markMessageAsRead(messageId, testUserId);

            const message = await Message.findById(messageId);
            expect(message?.readBy.some(r => r.userId.toString() === testUserId)).toBe(true);
        });

        it('should throw error when message not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.markMessageAsRead(nonExistentId, testUserId))
                .rejects.toThrow('Message not found');
        });

        it('should throw error when user has no access', async () => {
            const unauthorizedUserId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.markMessageAsRead(messageId, unauthorizedUserId))
                .rejects.toThrow('User does not have access to this message');
        });
    });

    describe('searchMessages', () => {
        let conversationId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [
                    { userId: testUserId, role: 'pharmacist' },
                    { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();

            await communicationService.sendMessage({
                conversationId,
                senderId: testUserId,
                content: {
                    text: 'medication dosage question',
                    type: 'text',
                },
                workplaceId: testWorkplaceId,
            });
        });

        it('should search messages successfully', async () => {
            const messages = await communicationService.searchMessages(
                'medication',
                testUserId,
                { workplaceId: testWorkplaceId }
            );

            expect(messages).toHaveLength(1);
            expect(encryptionService.decryptMessage).toHaveBeenCalled();
        });

        it('should filter search by conversation ID', async () => {
            const messages = await communicationService.searchMessages(
                'medication',
                testUserId,
                {
                    workplaceId: testWorkplaceId,
                    conversationId
                }
            );

            expect(messages).toHaveLength(1);
            expect(messages[0]?.conversationId.toString()).toBe(conversationId);
        });

        it('should filter search by message type', async () => {
            const messages = await communicationService.searchMessages(
                'medication',
                testUserId,
                {
                    workplaceId: testWorkplaceId,
                    type: 'text'
                }
            );

            expect(messages).toHaveLength(1);
            expect(messages[0]?.content.type).toBe('text');
        });

        it('should throw error for empty search query', async () => {
            await expect(communicationService.searchMessages(
                '',
                testUserId,
                { workplaceId: testWorkplaceId }
            )).rejects.toThrow('Search query cannot be empty');
        });

        it('should handle decryption errors in search', async () => {
            (encryptionService.decryptMessage as jest.Mock).mockRejectedValueOnce(
                new Error('Decryption failed')
            );

            const messages = await communicationService.searchMessages(
                'medication',
                testUserId,
                { workplaceId: testWorkplaceId }
            );

            expect(messages).toHaveLength(1);
            // Should return encrypted content when decryption fails
            expect(messages[0]?.content.text).toBe('encrypted-content');
        });
    });

    describe('updateConversationStatus', () => {
        let conversationId: string;

        beforeEach(async () => {
            const conversation = await communicationService.createConversation({
                type: 'patient_query',
                participants: [
                    {
                        userId: testUserId,
                        role: 'pharmacist',
                        permissions: ['read_messages', 'send_messages', 'edit_conversation']
                    },
                ],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
            conversationId = conversation._id.toString();
        });

        it('should update conversation status successfully', async () => {
            const updatedConversation = await communicationService.updateConversationStatus(
                conversationId,
                'resolved',
                testUserId
            );

            expect(updatedConversation.status).toBe('resolved');
        });

        it('should throw error when conversation not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(communicationService.updateConversationStatus(
                nonExistentId,
                'resolved',
                testUserId
            )).rejects.toThrow('Conversation not found');
        });

        it('should throw error when user lacks permission', async () => {
            // Create conversation with user without edit permission
            const limitedUserId = new mongoose.Types.ObjectId().toString();
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [
                    {
                        userId: limitedUserId,
                        role: 'patient',
                        permissions: ['read_messages', 'send_messages'] // No edit_conversation permission
                    },
                ],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });

            await expect(communicationService.updateConversationStatus(
                conversation._id.toString(),
                'resolved',
                limitedUserId
            )).rejects.toThrow('User does not have permission to update conversation status');
        });
    });

    describe('getConversationStats', () => {
        beforeEach(async () => {
            // Create various types of conversations for stats testing
            await communicationService.createConversation({
                type: 'patient_query',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                priority: 'urgent',
            });

            const resolvedConversation = await communicationService.createConversation({
                type: 'patient_query',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                patientId: testPatientId,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });

            // Update one conversation to resolved status
            await Conversation.findByIdAndUpdate(resolvedConversation._id, { status: 'resolved' });
        });

        it('should return conversation statistics', async () => {
            const stats = await communicationService.getConversationStats(
                testUserId,
                testWorkplaceId
            );

            expect(stats).toHaveProperty('totalConversations');
            expect(stats).toHaveProperty('unreadConversations');
            expect(stats).toHaveProperty('activeQueries');
            expect(stats).toHaveProperty('resolvedQueries');
            expect(stats).toHaveProperty('urgentConversations');

            expect(stats.totalConversations).toBeGreaterThan(0);
            expect(stats.activeQueries).toBeGreaterThan(0);
            expect(stats.resolvedQueries).toBeGreaterThan(0);
            expect(stats.urgentConversations).toBeGreaterThan(0);
        });
    });

    describe('getDefaultPermissions', () => {
        it('should return correct permissions for patient role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('patient');

            expect(permissions).toContain('read_messages');
            expect(permissions).toContain('send_messages');
            expect(permissions).toContain('upload_files');
            expect(permissions).not.toContain('add_participants');
        });

        it('should return correct permissions for pharmacist role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('pharmacist');

            expect(permissions).toContain('read_messages');
            expect(permissions).toContain('send_messages');
            expect(permissions).toContain('upload_files');
            expect(permissions).toContain('add_participants');
            expect(permissions).toContain('edit_conversation');
            expect(permissions).toContain('view_patient_data');
            expect(permissions).toContain('manage_clinical_context');
        });

        it('should return correct permissions for doctor role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('doctor');

            expect(permissions).toContain('read_messages');
            expect(permissions).toContain('send_messages');
            expect(permissions).toContain('upload_files');
            expect(permissions).toContain('add_participants');
            expect(permissions).toContain('edit_conversation');
            expect(permissions).toContain('view_patient_data');
            expect(permissions).toContain('manage_clinical_context');
        });

        it('should return correct permissions for intern_pharmacist role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('intern_pharmacist');

            expect(permissions).toContain('read_messages');
            expect(permissions).toContain('send_messages');
            expect(permissions).toContain('upload_files');
            expect(permissions).toContain('view_patient_data');
            expect(permissions).not.toContain('add_participants');
            expect(permissions).not.toContain('edit_conversation');
        });

        it('should return correct permissions for pharmacy_team role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('pharmacy_team');

            expect(permissions).toContain('read_messages');
            expect(permissions).toContain('send_messages');
            expect(permissions).toContain('upload_files');
            expect(permissions).not.toContain('add_participants');
            expect(permissions).not.toContain('view_patient_data');
        });

        it('should return default permissions for unknown role', () => {
            const service = new CommunicationService();
            const permissions = (service as any).getDefaultPermissions('unknown_role');

            expect(permissions).toEqual(['read_messages', 'send_messages']);
        });
    });

    describe('audit logging', () => {
        it('should log audit events for conversation creation', async () => {
            await communicationService.createConversation({
                type: 'direct',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });

            const auditLogs = await CommunicationAuditLog.find({ action: 'conversation_created' });
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0]!.userId.toString()).toBe(testUserId);
        });

        it('should log audit events for message sending', async () => {
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });

            await communicationService.sendMessage({
                conversationId: conversation._id.toString(),
                senderId: testUserId,
                content: {
                    text: 'Test message',
                    type: 'text',
                },
                workplaceId: testWorkplaceId,
            });

            const auditLogs = await CommunicationAuditLog.find({ action: 'message_sent' });
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0]!.userId.toString()).toBe(testUserId);
        });

        it('should continue operation even if audit logging fails', async () => {
            // Mock CommunicationAuditLog to throw error
            jest.spyOn(CommunicationAuditLog.prototype, 'save').mockRejectedValueOnce(
                new Error('Audit logging failed')
            );

            // Should not throw error despite audit logging failure
            const conversation = await communicationService.createConversation({
                type: 'direct',
                participants: [{ userId: testUserId, role: 'pharmacist' }],
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });

            expect(conversation).toBeDefined();
        });
    });
});