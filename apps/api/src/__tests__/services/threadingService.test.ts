import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { communicationService } from '../../services/communicationService';
import Message from '../../models/Message';
import Conversation from '../../models/Conversation';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
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
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Threading Service', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
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
            User.deleteMany({}),
            Workplace.deleteMany({}),
            Conversation.deleteMany({}),
            Message.deleteMany({}),
        ]);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
        });

        // Create test user
        testUser = await User.create({
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
        });

        // Create test conversation
        testConversation = await Conversation.create({
            type: 'group',
            participants: [{
                userId: testUser._id,
                role: 'pharmacist',
                joinedAt: new Date(),
                permissions: ['read_messages', 'send_messages'],
            }],
            createdBy: testUser._id,
            workplaceId: testWorkplace._id,
        });

        // Create test message
        testMessage = await Message.create({
            conversationId: testConversation._id,
            senderId: testUser._id,
            content: {
                text: 'This is a test message for threading',
                type: 'text',
            },
            workplaceId: testWorkplace._id,
            createdBy: testUser._id,
        });
    });

    describe('createThread', () => {
        it('should create a thread from a message', async () => {
            const threadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(threadId).toBe(testMessage._id.toString());

            // Verify message was updated with threadId
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.threadId?.toString()).toBe(testMessage._id.toString());
        });

        it('should return existing threadId if message already has one', async () => {
            // First create thread
            const firstThreadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            // Try to create thread again
            const secondThreadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(firstThreadId).toBe(secondThreadId);
        });

        it('should throw error for non-existent message', async () => {
            const fakeMessageId = new mongoose.Types.ObjectId().toString();

            await expect(
                communicationService.createThread(
                    fakeMessageId,
                    testUser._id.toString(),
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Message not found');
        });

        it('should throw error for unauthorized user', async () => {
            // Create another user in different workplace
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                address: '456 Other St',
                phone: '555-0456',
                email: 'other@pharmacy.com',
            });

            const otherUser = await User.create({
                firstName: 'Other',
                lastName: 'User',
                email: 'other@example.com',
                password: 'hashedpassword',
                role: 'pharmacist',
                workplaceId: otherWorkplace._id,
            });

            await expect(
                communicationService.createThread(
                    testMessage._id.toString(),
                    otherUser._id.toString(),
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Access denied');
        });
    });

    describe('getThreadMessages', () => {
        let threadId: string;
        let replyMessage: any;

        beforeEach(async () => {
            // Create thread
            threadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            // Create reply message
            replyMessage = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser._id,
                content: {
                    text: 'This is a reply to the thread',
                    type: 'text',
                },
                threadId: new mongoose.Types.ObjectId(threadId),
                parentMessageId: new mongoose.Types.ObjectId(threadId),
                workplaceId: testWorkplace._id,
                createdBy: testUser._id,
            });
        });

        it('should return thread messages with root and replies', async () => {
            const result = await communicationService.getThreadMessages(
                threadId,
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(result.rootMessage._id.toString()).toBe(testMessage._id.toString());
            expect(result.replies).toHaveLength(1);
            expect(result.replies[0]?._id.toString()).toBe(replyMessage._id.toString());
        });

        it('should filter replies by sender if specified', async () => {
            // Create another user and reply
            const anotherUser = await User.create({
                firstName: 'Another',
                lastName: 'User',
                email: 'another@example.com',
                password: 'hashedpassword',
                role: 'doctor',
                workplaceId: testWorkplace._id,
            });

            // Add another user to conversation
            testConversation.participants.push({
                userId: anotherUser._id,
                role: 'doctor',
                joinedAt: new Date(),
                permissions: ['read_messages', 'send_messages'],
            });
            await testConversation.save();

            await Message.create({
                conversationId: testConversation._id,
                senderId: anotherUser._id,
                content: {
                    text: 'Another reply',
                    type: 'text',
                },
                threadId: new mongoose.Types.ObjectId(threadId),
                parentMessageId: new mongoose.Types.ObjectId(threadId),
                workplaceId: testWorkplace._id,
                createdBy: anotherUser._id,
            });

            const result = await communicationService.getThreadMessages(
                threadId,
                testUser._id.toString(),
                testWorkplace._id.toString(),
                { senderId: testUser._id.toString() }
            );

            expect(result.replies).toHaveLength(1);
            expect(result.replies[0]?.senderId.toString()).toBe(testUser._id.toString());
        });

        it('should throw error for non-existent thread', async () => {
            const fakeThreadId = new mongoose.Types.ObjectId().toString();

            await expect(
                communicationService.getThreadMessages(
                    fakeThreadId,
                    testUser._id.toString(),
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Thread not found');
        });
    });

    describe('getThreadSummary', () => {
        let threadId: string;

        beforeEach(async () => {
            // Create thread
            threadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            // Create multiple replies
            for (let i = 0; i < 3; i++) {
                await Message.create({
                    conversationId: testConversation._id,
                    senderId: testUser._id,
                    content: {
                        text: `Reply ${i + 1}`,
                        type: 'text',
                    },
                    threadId: new mongoose.Types.ObjectId(threadId),
                    parentMessageId: new mongoose.Types.ObjectId(threadId),
                    workplaceId: testWorkplace._id,
                    createdBy: testUser._id,
                });
            }
        });

        it('should return correct thread summary', async () => {
            const summary = await communicationService.getThreadSummary(
                threadId,
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(summary.threadId).toBe(threadId);
            expect(summary.rootMessage._id.toString()).toBe(testMessage._id.toString());
            expect(summary.replyCount).toBe(3);
            expect(summary.participants).toHaveLength(1);
            expect(summary.participants[0]).toBe(testUser._id.toString());
            expect(summary.lastReplyAt).toBeDefined();
        });

        it('should calculate unread count correctly', async () => {
            // Create another user
            const anotherUser = await User.create({
                firstName: 'Another',
                lastName: 'User',
                email: 'another@example.com',
                password: 'hashedpassword',
                role: 'doctor',
                workplaceId: testWorkplace._id,
            });

            // Add to conversation
            testConversation.participants.push({
                userId: anotherUser._id,
                role: 'doctor',
                joinedAt: new Date(),
                permissions: ['read_messages', 'send_messages'],
            });
            await testConversation.save();

            // Create unread message
            await Message.create({
                conversationId: testConversation._id,
                senderId: anotherUser._id,
                content: {
                    text: 'Unread reply',
                    type: 'text',
                },
                threadId: new mongoose.Types.ObjectId(threadId),
                parentMessageId: new mongoose.Types.ObjectId(threadId),
                workplaceId: testWorkplace._id,
                createdBy: anotherUser._id,
            });

            const summary = await communicationService.getThreadSummary(
                threadId,
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(summary.unreadCount).toBe(1);
        });
    });

    describe('replyToThread', () => {
        let threadId: string;

        beforeEach(async () => {
            threadId = await communicationService.createThread(
                testMessage._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );
        });

        it('should create a reply to thread', async () => {
            const replyData = {
                conversationId: testConversation._id.toString(),
                senderId: testUser._id.toString(),
                content: {
                    text: 'This is a thread reply',
                    type: 'text' as const,
                },
                workplaceId: testWorkplace._id.toString(),
            };

            const reply = await communicationService.replyToThread(threadId, replyData);

            expect(reply.threadId?.toString()).toBe(threadId);
            expect(reply.parentMessageId?.toString()).toBe(threadId);
            expect(reply.content.text).toBe('This is a thread reply');
        });

        it('should throw error for non-existent thread', async () => {
            const fakeThreadId = new mongoose.Types.ObjectId().toString();
            const replyData = {
                conversationId: testConversation._id.toString(),
                senderId: testUser._id.toString(),
                content: {
                    text: 'This is a thread reply',
                    type: 'text' as const,
                },
                workplaceId: testWorkplace._id.toString(),
            };

            await expect(
                communicationService.replyToThread(fakeThreadId, replyData)
            ).rejects.toThrow('Thread not found');
        });
    });

    describe('getConversationThreads', () => {
        it('should return all threads in a conversation', async () => {
            // Create multiple messages and threads
            const message1 = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser._id,
                content: { text: 'Message 1', type: 'text' },
                workplaceId: testWorkplace._id,
                createdBy: testUser._id,
            });

            const message2 = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser._id,
                content: { text: 'Message 2', type: 'text' },
                workplaceId: testWorkplace._id,
                createdBy: testUser._id,
            });

            // Create threads
            const thread1Id = await communicationService.createThread(
                message1._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            const thread2Id = await communicationService.createThread(
                message2._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            // Add replies to threads
            await Message.create({
                conversationId: testConversation._id,
                senderId: testUser._id,
                content: { text: 'Reply to thread 1', type: 'text' },
                threadId: new mongoose.Types.ObjectId(thread1Id),
                parentMessageId: new mongoose.Types.ObjectId(thread1Id),
                workplaceId: testWorkplace._id,
                createdBy: testUser._id,
            });

            const threads = await communicationService.getConversationThreads(
                testConversation._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(threads).toHaveLength(2);
            expect(threads.map(t => t.threadId)).toContain(thread1Id);
            expect(threads.map(t => t.threadId)).toContain(thread2Id);

            const thread1Summary = threads.find(t => t.threadId === thread1Id);
            expect(thread1Summary?.replyCount).toBe(1);
        });

        it('should return empty array for conversation with no threads', async () => {
            const threads = await communicationService.getConversationThreads(
                testConversation._id.toString(),
                testUser._id.toString(),
                testWorkplace._id.toString()
            );

            expect(threads).toHaveLength(0);
        });
    });
});