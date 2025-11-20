import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import CommunicationSocketService from '../../services/communicationSocketService';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';

describe('Communication Socket Service Integration Tests', () => {
    let mongoServer: MongoMemoryServer;
    let httpServer: any;
    let io: SocketIOServer;
    let communicationSocket: CommunicationSocketService;
    let clientSocket1: ClientSocket;
    let clientSocket2: ClientSocket;
    let testWorkplace: any;
    let testUser1: any;
    let testUser2: any;
    let testPatient: any;
    let token1: string;
    let token2: string;

    beforeAll(async () => {
        // Setup MongoDB Memory Server
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            subscriptionPlan: 'professional',
            subscriptionStatus: 'active',
        });

        // Create test users
        testUser1 = await User.create({
            firstName: 'John',
            lastName: 'Pharmacist',
            email: 'john@test.com',
            password: 'password123',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isActive: true,
        });

        testUser2 = await User.create({
            firstName: 'Jane',
            lastName: 'Doctor',
            email: 'jane@test.com',
            password: 'password123',
            role: 'doctor',
            workplaceId: testWorkplace._id,
            isActive: true,
        });

        // Create JWT tokens
        token1 = jwt.sign(
            { id: testUser1._id, workplaceId: testWorkplace._id },
            process.env.JWT_SECRET || 'test-secret'
        );

        token2 = jwt.sign(
            { id: testUser2._id, workplaceId: testWorkplace._id },
            process.env.JWT_SECRET || 'test-secret'
        );

        // Setup HTTP server and Socket.IO
        httpServer = createServer();
        io = new SocketIOServer(httpServer, {
            cors: { origin: '*', methods: ['GET', 'POST'] },
        });

        // Initialize communication socket service
        communicationSocket = new CommunicationSocketService(io);

        // Start server
        await new Promise<void>((resolve) => {
            httpServer.listen(0, () => {
                const port = (httpServer.address() as any).port;

                // Create client connections
                clientSocket1 = Client(`http://localhost:${port}`, {
                    auth: { token: token1 },
                    transports: ['websocket'],
                });

                clientSocket2 = Client(`http://localhost:${port}`, {
                    auth: { token: token2 },
                    transports: ['websocket'],
                });

                resolve();
            });
        });

        // Wait for connections
        await Promise.all([
            new Promise<void>((resolve) => clientSocket1.on('connect', resolve)),
            new Promise<void>((resolve) => clientSocket2.on('connect', resolve)),
        ]);
    });

    afterAll(async () => {
        clientSocket1?.disconnect();
        clientSocket2?.disconnect();
        httpServer?.close();
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clean up collections before each test
        await Conversation.deleteMany({});
        await Message.deleteMany({});
    });

    describe('Authentication', () => {
        it('should authenticate users with valid tokens', (done) => {
            expect(clientSocket1.connected).toBe(true);
            expect(clientSocket2.connected).toBe(true);
            done();
        });

        it('should reject connections with invalid tokens', (done) => {
            const invalidClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
                auth: { token: 'invalid-token' },
                transports: ['websocket'],
            });

            invalidClient.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication failed');
                invalidClient.disconnect();
                done();
            });
        });
    });

    describe('Conversation Management', () => {
        it('should create a conversation and notify participants', (done) => {
            const conversationData = {
                title: 'Test Conversation',
                type: 'group',
                participants: [testUser1._id.toString(), testUser2._id.toString()],
                priority: 'normal',
            };

            // Listen for conversation created event on user2's socket
            clientSocket2.on('conversation:created', (data) => {
                expect(data.conversation.title).toBe('Test Conversation');
                expect(data.conversation.type).toBe('group');
                expect(data.conversation.participants).toHaveLength(2);
                done();
            });

            // User1 creates conversation
            clientSocket1.emit('conversation:create', conversationData);
        });

        it('should allow users to join and leave conversations', async () => {
            // Create a test conversation
            const conversation = await Conversation.create({
                title: 'Test Join/Leave',
                type: 'group',
                participants: [
                    { userId: testUser1._id, role: 'pharmacist', joinedAt: new Date() },
                    { userId: testUser2._id, role: 'doctor', joinedAt: new Date() },
                ],
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                metadata: { isEncrypted: true, priority: 'normal', tags: [] },
            });

            return new Promise<void>((resolve) => {
                // Listen for participant joined event
                clientSocket2.on('conversation:participant_joined', (data) => {
                    expect(data.conversationId).toBe(conversation._id.toString());
                    expect(data.userId).toBe(testUser1._id.toString());

                    // Now test leaving
                    clientSocket1.emit('conversation:leave', { conversationId: conversation._id.toString() });
                });

                clientSocket2.on('conversation:participant_left', (data) => {
                    expect(data.conversationId).toBe(conversation._id.toString());
                    expect(data.userId).toBe(testUser1._id.toString());
                    resolve();
                });

                // User1 joins conversation
                clientSocket1.emit('conversation:join', { conversationId: conversation._id.toString() });
            });
        });
    });

    describe('Real-time Messaging', () => {
        let testConversation: any;

        beforeEach(async () => {
            testConversation = await Conversation.create({
                title: 'Test Messages',
                type: 'direct',
                participants: [
                    { userId: testUser1._id, role: 'pharmacist', joinedAt: new Date() },
                    { userId: testUser2._id, role: 'doctor', joinedAt: new Date() },
                ],
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                metadata: { isEncrypted: true, priority: 'normal', tags: [] },
            });

            // Both users join the conversation
            clientSocket1.emit('conversation:join', { conversationId: testConversation._id.toString() });
            clientSocket2.emit('conversation:join', { conversationId: testConversation._id.toString() });

            // Wait a bit for join events to process
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        it('should send and receive messages in real-time', (done) => {
            const messageData = {
                conversationId: testConversation._id.toString(),
                content: {
                    text: 'Hello from user1!',
                    type: 'text',
                },
                priority: 'normal',
            };

            // User2 listens for message
            clientSocket2.on('message:received', (data) => {
                expect(data.message.content.text).toBe('Hello from user1!');
                expect(data.conversationId).toBe(testConversation._id.toString());
                done();
            });

            // User1 sends message
            clientSocket1.emit('message:send', messageData);
        });

        it('should handle message reactions', async () => {
            // Create a test message
            const message = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser1._id,
                content: { text: 'React to this!', type: 'text' },
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
            });

            return new Promise<void>((resolve) => {
                // Listen for reaction added event
                clientSocket1.on('message:reaction_added', (data) => {
                    expect(data.messageId).toBe(message._id.toString());
                    expect(data.emoji).toBe('👍');
                    expect(data.userId).toBe(testUser2._id.toString());
                    resolve();
                });

                // User2 adds reaction
                clientSocket2.emit('message:add_reaction', {
                    messageId: message._id.toString(),
                    emoji: '👍',
                    conversationId: testConversation._id.toString(),
                });
            });
        });

        it('should handle message read receipts', async () => {
            // Create a test message
            const message = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser1._id,
                content: { text: 'Mark me as read!', type: 'text' },
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
            });

            return new Promise<void>((resolve) => {
                // Listen for read receipt
                clientSocket1.on('message:read_receipt', (data) => {
                    expect(data.messageId).toBe(message._id.toString());
                    expect(data.userId).toBe(testUser2._id.toString());
                    resolve();
                });

                // User2 marks message as read
                clientSocket2.emit('message:mark_read', {
                    messageId: message._id.toString(),
                    conversationId: testConversation._id.toString(),
                });
            });
        });
    });

    describe('Typing Indicators', () => {
        let testConversation: any;

        beforeEach(async () => {
            testConversation = await Conversation.create({
                title: 'Test Typing',
                type: 'direct',
                participants: [
                    { userId: testUser1._id, role: 'pharmacist', joinedAt: new Date() },
                    { userId: testUser2._id, role: 'doctor', joinedAt: new Date() },
                ],
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                metadata: { isEncrypted: true, priority: 'normal', tags: [] },
            });

            // Both users join the conversation
            clientSocket1.emit('conversation:join', { conversationId: testConversation._id.toString() });
            clientSocket2.emit('conversation:join', { conversationId: testConversation._id.toString() });

            await new Promise(resolve => setTimeout(resolve, 100));
        });

        it('should broadcast typing indicators', (done) => {
            // User2 listens for typing events
            clientSocket2.on('typing:user_started', (data) => {
                expect(data.conversationId).toBe(testConversation._id.toString());
                expect(data.userId).toBe(testUser1._id.toString());
                done();
            });

            // User1 starts typing
            clientSocket1.emit('typing:start', { conversationId: testConversation._id.toString() });
        });

        it('should handle stop typing events', (done) => {
            let startReceived = false;

            // User2 listens for typing events
            clientSocket2.on('typing:user_started', (data) => {
                startReceived = true;
                expect(data.conversationId).toBe(testConversation._id.toString());

                // Stop typing after receiving start
                clientSocket1.emit('typing:stop', { conversationId: testConversation._id.toString() });
            });

            clientSocket2.on('typing:user_stopped', (data) => {
                expect(startReceived).toBe(true);
                expect(data.conversationId).toBe(testConversation._id.toString());
                expect(data.userId).toBe(testUser1._id.toString());
                done();
            });

            // User1 starts typing
            clientSocket1.emit('typing:start', { conversationId: testConversation._id.toString() });
        });

        it('should auto-stop typing after timeout', (done) => {
            // User2 listens for typing events
            clientSocket2.on('typing:user_started', () => {
                // Don't manually stop typing, let it timeout
            });

            clientSocket2.on('typing:user_stopped', (data) => {
                expect(data.conversationId).toBe(testConversation._id.toString());
                expect(data.userId).toBe(testUser1._id.toString());
                done();
            });

            // User1 starts typing (should auto-stop after 3 seconds)
            clientSocket1.emit('typing:start', { conversationId: testConversation._id.toString() });
        }, 5000); // Increase timeout for this test
    });

    describe('Presence Management', () => {
        it('should broadcast user presence changes', (done) => {
            // User2 listens for presence changes
            clientSocket2.on('presence:user_presence_changed', (data) => {
                if (data.userId === testUser1._id.toString()) {
                    expect(data.isOnline).toBe(true);
                    expect(data.userData.firstName).toBe('John');
                    done();
                }
            });

            // Presence should be broadcast when user1 connects (already connected, so this might not trigger)
            // Let's trigger a status update instead
            clientSocket1.emit('presence:update_status', { status: 'available' });
        });

        it('should get online users in conversation', async () => {
            const conversation = await Conversation.create({
                title: 'Test Presence',
                type: 'group',
                participants: [
                    { userId: testUser1._id, role: 'pharmacist', joinedAt: new Date() },
                    { userId: testUser2._id, role: 'doctor', joinedAt: new Date() },
                ],
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                metadata: { isEncrypted: true, priority: 'normal', tags: [] },
            });

            // Both users join
            clientSocket1.emit('conversation:join', { conversationId: conversation._id.toString() });
            clientSocket2.emit('conversation:join', { conversationId: conversation._id.toString() });

            await new Promise(resolve => setTimeout(resolve, 100));

            return new Promise<void>((resolve) => {
                clientSocket1.on('presence:conversation_users', (data) => {
                    expect(data.conversationId).toBe(conversation._id.toString());
                    expect(data.onlineUsers).toHaveLength(2);
                    resolve();
                });

                clientSocket1.emit('presence:get_conversation_users', {
                    conversationId: conversation._id.toString()
                });
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid conversation access', (done) => {
            const fakeConversationId = new mongoose.Types.ObjectId().toString();

            clientSocket1.on('error', (error) => {
                expect(error.code).toBe('conversation_not_found');
                done();
            });

            clientSocket1.emit('conversation:join', { conversationId: fakeConversationId });
        });

        it('should handle invalid message data', (done) => {
            clientSocket1.on('error', (error) => {
                expect(error.code).toBe('conversation_not_found');
                done();
            });

            clientSocket1.emit('message:send', {
                conversationId: new mongoose.Types.ObjectId().toString(),
                content: { text: 'This should fail', type: 'text' },
            });
        });
    });

    describe('Connection Management', () => {
        it('should track connected users', () => {
            expect(communicationSocket.getConnectedUsersCount()).toBeGreaterThan(0);
            expect(communicationSocket.isUserConnected(testUser1._id.toString())).toBe(true);
            expect(communicationSocket.isUserConnected(testUser2._id.toString())).toBe(true);
        });

        it('should get workplace connected users', () => {
            const workplaceUsers = communicationSocket.getWorkplaceConnectedUsers(testWorkplace._id.toString());
            expect(workplaceUsers).toHaveLength(2);
            expect(workplaceUsers.some(u => u.userId === testUser1._id.toString())).toBe(true);
            expect(workplaceUsers.some(u => u.userId === testUser2._id.toString())).toBe(true);
        });

        it('should handle disconnection cleanup', (done) => {
            const tempClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
                auth: { token: token1 },
                transports: ['websocket'],
            });

            tempClient.on('connect', () => {
                // Disconnect immediately
                tempClient.disconnect();

                // Give some time for cleanup
                setTimeout(() => {
                    // The original user should still be connected via clientSocket1
                    expect(communicationSocket.isUserConnected(testUser1._id.toString())).toBe(true);
                    done();
                }, 100);
            });
        });
    });

    describe('File Upload Events', () => {
        let testConversation: any;

        beforeEach(async () => {
            testConversation = await Conversation.create({
                title: 'Test File Upload',
                type: 'direct',
                participants: [
                    { userId: testUser1._id, role: 'pharmacist', joinedAt: new Date() },
                    { userId: testUser2._id, role: 'doctor', joinedAt: new Date() },
                ],
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                metadata: { isEncrypted: true, priority: 'normal', tags: [] },
            });

            clientSocket1.emit('conversation:join', { conversationId: testConversation._id.toString() });
            clientSocket2.emit('conversation:join', { conversationId: testConversation._id.toString() });

            await new Promise(resolve => setTimeout(resolve, 100));
        });

        it('should broadcast file upload progress', (done) => {
            const uploadData = {
                conversationId: testConversation._id.toString(),
                fileName: 'test-file.pdf',
                progress: 50,
            };

            clientSocket2.on('file:upload_progress', (data) => {
                expect(data.conversationId).toBe(testConversation._id.toString());
                expect(data.fileName).toBe('test-file.pdf');
                expect(data.progress).toBe(50);
                expect(data.userId).toBe(testUser1._id.toString());
                done();
            });

            clientSocket1.emit('file:upload_progress', uploadData);
        });

        it('should broadcast file upload completion', (done) => {
            const fileData = {
                conversationId: testConversation._id.toString(),
                fileData: {
                    fileName: 'test-file.pdf',
                    fileSize: 1024,
                    mimeType: 'application/pdf',
                    secureUrl: 'https://example.com/file.pdf',
                },
            };

            clientSocket2.on('file:upload_complete', (data) => {
                expect(data.conversationId).toBe(testConversation._id.toString());
                expect(data.fileData.fileName).toBe('test-file.pdf');
                expect(data.userId).toBe(testUser1._id.toString());
                done();
            });

            clientSocket1.emit('file:upload_complete', fileData);
        });
    });
});