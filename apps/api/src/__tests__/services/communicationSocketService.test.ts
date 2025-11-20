import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import CommunicationSocketService from '../../services/communicationSocketService';

describe('CommunicationSocketService', () => {
    let httpServer: any;
    let io: SocketIOServer;
    let communicationSocket: CommunicationSocketService;

    beforeAll(async () => {
        // Setup HTTP server and Socket.IO
        httpServer = createServer();
        io = new SocketIOServer(httpServer, {
            cors: { origin: '*', methods: ['GET', 'POST'] },
        });

        // Initialize communication socket service
        communicationSocket = new CommunicationSocketService(io);
    });

    afterAll(async () => {
        httpServer?.close();
    });

    describe('Service Initialization', () => {
        it('should initialize successfully', () => {
            expect(communicationSocket).toBeDefined();
            expect(communicationSocket.getConnectedUsersCount()).toBe(0);
        });

        it('should have correct initial state', () => {
            expect(communicationSocket.isUserConnected('non-existent-user')).toBe(false);
            expect(communicationSocket.getWorkplaceConnectedUsers('non-existent-workplace')).toEqual([]);
        });
    });

    describe('Public Methods', () => {
        it('should handle message notifications', () => {
            const mockMessage = {
                _id: 'message-123',
                senderId: 'user-123',
                content: { text: 'Test message', type: 'text' },
                createdAt: new Date(),
            };

            // Should not throw error even with no connected users
            expect(() => {
                communicationSocket.sendMessageNotification('conversation-123', mockMessage);
            }).not.toThrow();
        });

        it('should handle conversation updates', () => {
            const updateData = {
                action: 'participant_added',
                userId: 'user-123',
            };

            // Should not throw error even with no connected users
            expect(() => {
                communicationSocket.sendConversationUpdate('conversation-123', updateData);
            }).not.toThrow();
        });

        it('should handle system announcements', () => {
            const announcement = {
                title: 'System Maintenance',
                message: 'System will be down for maintenance',
            };

            // Should not throw error even with no connected users
            expect(() => {
                communicationSocket.sendConversationAnnouncement('conversation-123', announcement);
            }).not.toThrow();
        });

        it('should handle emergency alerts', () => {
            const alert = {
                type: 'emergency',
                message: 'Emergency alert',
            };

            // Should not throw error even with no connected users
            expect(() => {
                communicationSocket.sendConversationEmergencyAlert('conversation-123', alert);
            }).not.toThrow();
        });
    });

    describe('Connection Management', () => {
        it('should track connected users correctly', () => {
            expect(communicationSocket.getConnectedUsersCount()).toBe(0);

            // Test with non-existent user
            expect(communicationSocket.isUserConnected('fake-user-id')).toBe(false);
        });

        it('should get workplace users correctly', () => {
            const workplaceUsers = communicationSocket.getWorkplaceConnectedUsers('workplace-123');
            expect(Array.isArray(workplaceUsers)).toBe(true);
            expect(workplaceUsers).toHaveLength(0); // No users connected yet
        });
    });
});