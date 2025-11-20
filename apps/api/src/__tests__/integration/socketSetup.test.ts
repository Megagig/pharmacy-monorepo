import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import CommunicationSocketService from '../../services/communicationSocketService';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

describe('Socket.IO Setup Integration Test', () => {
    let mongoServer: MongoMemoryServer;
    let httpServer: any;
    let io: SocketIOServer;
    let communicationSocket: CommunicationSocketService;
    let clientSocket: ClientSocket;
    let testWorkplace: any;
    let testUser: any;
    let token: string;

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

        // Create test user
        testUser = await User.create({
            firstName: 'John',
            lastName: 'Pharmacist',
            email: 'john@test.com',
            password: 'password123',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isActive: true,
        });

        // Create JWT token
        token = jwt.sign(
            { id: testUser._id, workplaceId: testWorkplace._id },
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

                // Create client connection
                clientSocket = Client(`http://localhost:${port}`, {
                    auth: { token },
                    transports: ['websocket'],
                });

                resolve();
            });
        });

        // Wait for connection
        await new Promise<void>((resolve) => clientSocket.on('connect', resolve));
    });

    afterAll(async () => {
        clientSocket?.disconnect();
        httpServer?.close();
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('Basic Socket.IO Setup', () => {
        it('should authenticate user successfully', () => {
            expect(clientSocket.connected).toBe(true);
        });

        it('should track connected users', () => {
            expect(communicationSocket.getConnectedUsersCount()).toBeGreaterThan(0);
            expect(communicationSocket.isUserConnected(testUser._id.toString())).toBe(true);
        });

        it('should handle basic socket events', (done) => {
            clientSocket.emit('presence:update_status', { status: 'available' });

            // If no error occurs within 1 second, consider it successful
            setTimeout(() => {
                done();
            }, 1000);
        });

        it('should reject invalid authentication', (done) => {
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

    describe('Communication Socket Service Methods', () => {
        it('should get workplace connected users', () => {
            const workplaceUsers = communicationSocket.getWorkplaceConnectedUsers(testWorkplace._id.toString());
            expect(workplaceUsers).toHaveLength(1);
            expect(workplaceUsers[0].userId).toBe(testUser._id.toString());
            expect(workplaceUsers[0].firstName).toBe('John');
        });

        it('should send system announcements', (done) => {
            const announcement = {
                title: 'System Maintenance',
                message: 'System will be down for maintenance',
            };

            clientSocket.on('system:announcement', (data) => {
                expect(data.title).toBe('System Maintenance');
                expect(data.message).toBe('System will be down for maintenance');
                done();
            });

            communicationSocket.sendConversationAnnouncement('test-conversation', announcement);
        });
    });
});