import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { generateToken } from '../../utils/token';

describe('Threading Endpoints', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let testConversation: any;
    let testMessage: any;
    let authToken: string;

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

        // Generate auth token
        authToken = generateToken(testUser._id.toString(), testWorkplace._id.toString());

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

    describe('POST /api/communication/messages/:messageId/thread', () => {
        it('should create a thread from a message', async () => {
            const response = await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.threadId).toBe(testMessage._id.toString());

            // Verify message was updated
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.threadId?.toString()).toBe(testMessage._id.toString());
        });

        it('should return 400 for invalid message ID', async () => {
            const response = await request(app)
                .post('/api/communication/messages/invalid-id/thread')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Valid message ID is required');
        });

        it('should return 401 without authentication', async () => {
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .expect(401);
        });

        it('should return 500 for non-existent message', async () => {
            const fakeMessageId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/communication/messages/${fakeMessageId}/thread`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to create thread');
        });
    });

    describe('GET /api/communication/threads/:threadId/messages', () => {
        let threadId: string;
        let replyMessage: any;

        beforeEach(async () => {
            // Create thread
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`);

            threadId = testMessage._id.toString();

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

        it('should return thread messages', async () => {
            const response = await request(app)
                .get(`/api/communication/threads/${threadId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.rootMessage._id).toBe(testMessage._id.toString());
            expect(response.body.data.replies).toHaveLength(1);
            expect(response.body.data.replies[0]._id).toBe(replyMessage._id.toString());
        });

        it('should filter by sender', async () => {
            // Create another user and message
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

            const response = await request(app)
                .get(`/api/communication/threads/${threadId}/messages`)
                .query({ senderId: testUser._id.toString() })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.replies).toHaveLength(1);
            expect(response.body.data.replies[0].senderId).toBe(testUser._id.toString());
        });

        it('should return 400 for invalid thread ID', async () => {
            const response = await request(app)
                .get('/api/communication/threads/invalid-id/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/threads/:threadId/summary', () => {
        let threadId: string;

        beforeEach(async () => {
            // Create thread
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`);

            threadId = testMessage._id.toString();

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

        it('should return thread summary', async () => {
            const response = await request(app)
                .get(`/api/communication/threads/${threadId}/summary`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.threadId).toBe(threadId);
            expect(response.body.data.rootMessage._id).toBe(testMessage._id.toString());
            expect(response.body.data.replyCount).toBe(3);
            expect(response.body.data.participants).toHaveLength(1);
            expect(response.body.data.lastReplyAt).toBeDefined();
        });

        it('should return 400 for invalid thread ID', async () => {
            const response = await request(app)
                .get('/api/communication/threads/invalid-id/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/communication/threads/:threadId/reply', () => {
        let threadId: string;

        beforeEach(async () => {
            // Create thread
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`);

            threadId = testMessage._id.toString();
        });

        it('should create a reply to thread', async () => {
            const replyData = {
                content: {
                    text: 'This is a thread reply',
                    type: 'text',
                },
            };

            const response = await request(app)
                .post(`/api/communication/threads/${threadId}/reply`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(replyData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.threadId).toBe(threadId);
            expect(response.body.data.parentMessageId).toBe(threadId);
            expect(response.body.data.content.text).toBe('This is a thread reply');
        });

        it('should return 400 for missing content', async () => {
            const response = await request(app)
                .post(`/api/communication/threads/${threadId}/reply`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Message content is required');
        });

        it('should return 400 for invalid thread ID', async () => {
            const replyData = {
                content: {
                    text: 'This is a thread reply',
                    type: 'text',
                },
            };

            const response = await request(app)
                .post('/api/communication/threads/invalid-id/reply')
                .set('Authorization', `Bearer ${authToken}`)
                .send(replyData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should handle mentions in reply', async () => {
            const replyData = {
                content: {
                    text: 'This is a thread reply with mention',
                    type: 'text',
                },
                mentions: [testUser._id.toString()],
            };

            const response = await request(app)
                .post(`/api/communication/threads/${threadId}/reply`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(replyData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.mentions).toContain(testUser._id.toString());
        });
    });

    describe('GET /api/communication/conversations/:conversationId/threads', () => {
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
            await request(app)
                .post(`/api/communication/messages/${message1._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`);

            await request(app)
                .post(`/api/communication/messages/${message2._id}/thread`)
                .set('Authorization', `Bearer ${authToken}`);

            // Add replies to first thread
            await Message.create({
                conversationId: testConversation._id,
                senderId: testUser._id,
                content: { text: 'Reply to thread 1', type: 'text' },
                threadId: message1._id,
                parentMessageId: message1._id,
                workplaceId: testWorkplace._id,
                createdBy: testUser._id,
            });

            const response = await request(app)
                .get(`/api/communication/conversations/${testConversation._id}/threads`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);

            const thread1 = response.body.data.find((t: any) => t.threadId === message1._id.toString());
            expect(thread1.replyCount).toBe(1);

            const thread2 = response.body.data.find((t: any) => t.threadId === message2._id.toString());
            expect(thread2.replyCount).toBe(0);
        });

        it('should return empty array for conversation with no threads', async () => {
            const response = await request(app)
                .get(`/api/communication/conversations/${testConversation._id}/threads`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });

        it('should return 400 for invalid conversation ID', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/invalid-id/threads')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Authentication and Authorization', () => {
        it('should require authentication for all threading endpoints', async () => {
            const endpoints = [
                { method: 'post', path: `/api/communication/messages/${testMessage._id}/thread` },
                { method: 'get', path: `/api/communication/threads/${testMessage._id}/messages` },
                { method: 'get', path: `/api/communication/threads/${testMessage._id}/summary` },
                { method: 'post', path: `/api/communication/threads/${testMessage._id}/reply` },
                { method: 'get', path: `/api/communication/conversations/${testConversation._id}/threads` },
            ];

            for (const endpoint of endpoints) {
                await request(app)
                [endpoint.method as keyof typeof request](endpoint.path)
                    .expect(401);
            }
        });

        it('should deny access to users from different workplaces', async () => {
            // Create another workplace and user
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

            const otherAuthToken = generateToken(otherUser._id.toString(), otherWorkplace._id.toString());

            const response = await request(app)
                .post(`/api/communication/messages/${testMessage._id}/thread`)
                .set('Authorization', `Bearer ${otherAuthToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
        });
    });
});