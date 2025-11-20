import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Message from '../../models/Message';
import User from '../../models/User';
import Conversation from '../../models/Conversation';
import Workplace from '../../models/Workplace';
import { communicationService } from '../../services/communicationService';

describe('Message Reactions Service', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser1: any;
    let testUser2: any;
    let testConversation: any;
    let testMessage: any;

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
        await Promise.all([
            Message.deleteMany({}),
            User.deleteMany({}),
            Conversation.deleteMany({}),
            Workplace.deleteMany({}),
        ]);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'Test Country',
            },
        });

        // Create test users
        testUser1 = await User.create({
            email: 'pharmacist@test.com',
            password: 'hashedpassword',
            firstName: 'John',
            lastName: 'Pharmacist',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isEmailVerified: true,
        });

        testUser2 = await User.create({
            email: 'doctor@test.com',
            password: 'hashedpassword',
            firstName: 'Jane',
            lastName: 'Doctor',
            role: 'doctor',
            workplaceId: testWorkplace._id,
            isEmailVerified: true,
        });

        // Create test conversation
        testConversation = await Conversation.create({
            type: 'direct',
            participants: [
                {
                    userId: testUser1._id,
                    role: 'pharmacist',
                    joinedAt: new Date(),
                    permissions: ['read_messages', 'send_messages'],
                },
                {
                    userId: testUser2._id,
                    role: 'doctor',
                    joinedAt: new Date(),
                    permissions: ['read_messages', 'send_messages'],
                },
            ],
            createdBy: testUser1._id,
            workplaceId: testWorkplace._id,
            metadata: {
                isEncrypted: true,
            },
        });

        // Create test message
        testMessage = await Message.create({
            conversationId: testConversation._id,
            senderId: testUser1._id,
            content: {
                text: 'Test message for reactions',
                type: 'text',
            },
            workplaceId: testWorkplace._id,
            createdBy: testUser1._id,
        });
    });

    describe('addMessageReaction', () => {
        it('should add a reaction to a message', async () => {
            const emoji = '👍';

            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                emoji,
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
            expect(updatedMessage?.reactions?.[0]?.emoji).toBe(emoji);
            expect(updatedMessage?.reactions?.[0]?.userId.toString()).toBe(testUser2._id.toString());
        });

        it('should not add duplicate reactions from the same user', async () => {
            const emoji = '❤️';

            // Add reaction twice
            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                emoji,
                testWorkplace._id.toString()
            );

            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                emoji,
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
        });

        it('should allow different users to add the same emoji', async () => {
            const emoji = '😊';

            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser1._id.toString(),
                emoji,
                testWorkplace._id.toString()
            );

            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                emoji,
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(2);
            expect(updatedMessage?.reactions.every(r => r.emoji === emoji)).toBe(true);
        });

        it('should throw error for non-existent message', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            await expect(
                communicationService.addMessageReaction(
                    nonExistentId.toString(),
                    testUser2._id.toString(),
                    '👍',
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Message not found');
        });

        it('should throw error for non-participant user', async () => {
            // Create user not in conversation
            const outsideUser = await User.create({
                email: 'outside@test.com',
                password: 'hashedpassword',
                firstName: 'Outside',
                lastName: 'User',
                role: 'patient',
                workplaceId: testWorkplace._id,
                isEmailVerified: true,
            });

            await expect(
                communicationService.addMessageReaction(
                    testMessage._id.toString(),
                    outsideUser._id.toString(),
                    '👍',
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Access denied');
        });
    });

    describe('removeMessageReaction', () => {
        beforeEach(async () => {
            // Add a reaction to remove
            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                '👍',
                testWorkplace._id.toString()
            );
        });

        it('should remove a reaction from a message', async () => {
            await communicationService.removeMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                '👍',
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(0);
        });

        it('should only remove the specific user\'s reaction', async () => {
            // Add reaction from another user
            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser1._id.toString(),
                '👍',
                testWorkplace._id.toString()
            );

            // Remove only user2's reaction
            await communicationService.removeMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                '👍',
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
            expect(updatedMessage?.reactions?.[0]?.userId.toString()).toBe(testUser1._id.toString());
        });

        it('should handle removing non-existent reaction gracefully', async () => {
            await communicationService.removeMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                '❤️', // Different emoji
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1); // Original reaction still there
        });
    });

    describe('Healthcare-specific emoji validation', () => {
        const healthcareEmojis = [
            '👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔',
            '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊'
        ];

        it('should accept all healthcare-specific emojis', async () => {
            for (const emoji of healthcareEmojis) {
                await expect(
                    communicationService.addMessageReaction(
                        testMessage._id.toString(),
                        testUser2._id.toString(),
                        emoji,
                        testWorkplace._id.toString()
                    )
                ).resolves.not.toThrow();
            }
        });
    });

    describe('Message status tracking', () => {
        it('should track read receipts correctly', async () => {
            await communicationService.markMessageAsRead(
                testMessage._id.toString(),
                testUser2._id.toString(),
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.readBy).toHaveLength(1);
            expect(updatedMessage?.readBy?.[0]?.userId.toString()).toBe(testUser2._id.toString());
            expect(updatedMessage?.status).toBe('read');
        });

        it('should not duplicate read receipts', async () => {
            // Mark as read twice
            await communicationService.markMessageAsRead(
                testMessage._id.toString(),
                testUser2._id.toString(),
                testWorkplace._id.toString()
            );

            await communicationService.markMessageAsRead(
                testMessage._id.toString(),
                testUser2._id.toString(),
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.readBy).toHaveLength(1);
        });
    });

    describe('getMessageStatuses', () => {
        let message2: any;

        beforeEach(async () => {
            message2 = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser2._id,
                content: {
                    text: 'Second test message',
                    type: 'text',
                },
                workplaceId: testWorkplace._id,
                createdBy: testUser2._id,
            });

            // Add some reactions and read receipts
            await communicationService.addMessageReaction(
                testMessage._id.toString(),
                testUser2._id.toString(),
                '👍',
                testWorkplace._id.toString()
            );

            await communicationService.markMessageAsRead(
                message2._id.toString(),
                testUser1._id.toString(),
                testWorkplace._id.toString()
            );
        });

        it('should return statuses for multiple messages', async () => {
            const messageIds = [testMessage._id.toString(), message2._id.toString()];

            const statuses = await communicationService.getMessageStatuses(
                messageIds,
                testUser1._id.toString(),
                testWorkplace._id.toString()
            );

            expect(Object.keys(statuses)).toHaveLength(2);
            expect(statuses[testMessage._id.toString()]).toBeDefined();
            expect(statuses[message2._id.toString()]).toBeDefined();

            // Check reaction data
            expect(statuses[testMessage._id.toString()]?.reactions).toHaveLength(1);
            expect(statuses[testMessage._id.toString()]?.reactions?.[0]?.emoji).toBe('👍');

            // Check read receipt data
            expect(statuses[message2._id.toString()]?.readBy).toHaveLength(1);
        });

        it('should handle empty message IDs array', async () => {
            const statuses = await communicationService.getMessageStatuses(
                [],
                testUser1._id.toString(),
                testWorkplace._id.toString()
            );

            expect(Object.keys(statuses)).toHaveLength(0);
        });
    });
});