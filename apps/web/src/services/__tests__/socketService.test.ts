import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import { socketService, ConnectionStatus } from '../socketService';
import { authService } from '../authService';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    io: vi.fn(),
}));

// Mock auth service
vi.mock('../authService', () => ({
    authService: {
        getCurrentUser: vi.fn(),
    },
}));

describe('SocketService', () => {
    let mockSocket: any;
    let mockEventHandlers: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock socket
        mockSocket = {
            id: 'test-socket-id',
            connected: false,
            connect: vi.fn(),
            disconnect: vi.fn(),
            on: vi.fn(),
            emit: vi.fn(),
            auth: {},
        };

        mockEventHandlers = {};

        // Mock io function
        (io as any).mockReturnValue(mockSocket);

        // Mock auth service
        (authService.getCurrentUser as any).mockResolvedValue({
            success: true,
            user: { id: 'test-user', email: 'test@example.com' },
        });
    });

    afterEach(() => {
        socketService.disconnect();
    });

    describe('Connection Management', () => {
        it('should initialize socket with correct configuration', async () => {
            await socketService.connect();

            expect(io).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    withCredentials: true,
                    autoConnect: true,
                    reconnection: true,
                    transports: ['websocket', 'polling'],
                })
            );
        });

        it('should set up event listeners on connection', async () => {
            await socketService.connect();

            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('message_received', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('user_typing', expect.any(Function));
        });

        it('should handle connection success', async () => {
            const connectionPromise = socketService.connect();

            // Simulate successful connection
            const connectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'connect'
            )[1];
            mockSocket.connected = true;
            connectHandler();

            await expect(connectionPromise).resolves.toBeUndefined();
            expect(socketService.getConnectionStatus()).toBe('connected');
        });

        it('should handle connection error', async () => {
            const connectionPromise = socketService.connect();

            // Simulate connection error
            const errorHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'connect_error'
            )[1];
            const error = new Error('Connection failed');
            errorHandler(error);

            await expect(connectionPromise).rejects.toThrow('Connection failed');
            expect(socketService.getConnectionStatus()).toBe('error');
        });

        it('should disconnect properly', () => {
            socketService.disconnect();

            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(socketService.getConnectionStatus()).toBe('disconnected');
        });

        it('should check authentication before connecting', async () => {
            (authService.getCurrentUser as any).mockResolvedValue({
                success: false,
                user: null,
            });

            await expect(socketService.connect()).rejects.toThrow();
            expect(authService.getCurrentUser).toHaveBeenCalled();
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await socketService.connect();
            mockSocket.connected = true;
        });

        it('should handle message received events', () => {
            const mockMessage = {
                _id: 'msg-1',
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' },
                senderId: 'user-1',
            };

            const onMessageReceived = vi.fn();
            socketService.setEventHandlers({ onMessageReceived });

            // Simulate message received
            const messageHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'message_received'
            )[1];
            messageHandler(mockMessage);

            expect(onMessageReceived).toHaveBeenCalledWith(mockMessage);
        });

        it('should handle typing events', () => {
            const onUserTyping = vi.fn();
            socketService.setEventHandlers({ onUserTyping });

            // Simulate typing event
            const typingHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'user_typing'
            )[1];
            typingHandler({ userId: 'user-1', conversationId: 'conv-1' });

            expect(onUserTyping).toHaveBeenCalledWith('conv-1', 'user-1');
        });

        it('should handle notification events', () => {
            const mockNotification = {
                _id: 'notif-1',
                type: 'new_message',
                title: 'New Message',
                content: 'You have a new message',
            };

            const onNotificationReceived = vi.fn();
            socketService.setEventHandlers({ onNotificationReceived });

            // Simulate notification
            const notificationHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'notification_received'
            )[1];
            notificationHandler(mockNotification);

            expect(onNotificationReceived).toHaveBeenCalledWith(mockNotification);
        });
    });

    describe('Conversation Management', () => {
        beforeEach(async () => {
            await socketService.connect();
            mockSocket.connected = true;
        });

        it('should join conversation', () => {
            socketService.joinConversation('conv-1');

            expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'conv-1');
        });

        it('should leave conversation', () => {
            socketService.leaveConversation('conv-1');

            expect(mockSocket.emit).toHaveBeenCalledWith('leave_conversation', 'conv-1');
        });

        it('should queue conversation joins when disconnected', () => {
            mockSocket.connected = false;

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            socketService.joinConversation('conv-1');

            expect(consoleSpy).toHaveBeenCalledWith(
                'Socket not connected, queuing conversation join'
            );
            expect(mockSocket.emit).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('Message Operations', () => {
        beforeEach(async () => {
            await socketService.connect();
            mockSocket.connected = true;
        });

        it('should send message', () => {
            const messageData = {
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' as const },
            };

            socketService.sendMessage(messageData);

            expect(mockSocket.emit).toHaveBeenCalledWith('send_message', messageData);
        });

        it('should mark message as read', () => {
            socketService.markMessageAsRead('msg-1');

            expect(mockSocket.emit).toHaveBeenCalledWith('mark_read', 'msg-1');
        });

        it('should handle send message when disconnected', () => {
            mockSocket.connected = false;

            const onError = vi.fn();
            socketService.setEventHandlers({ onError });

            const messageData = {
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' as const },
            };

            socketService.sendMessage(messageData);

            expect(onError).toHaveBeenCalledWith('Cannot send message: Socket not connected');
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('Typing Indicators', () => {
        beforeEach(async () => {
            await socketService.connect();
            mockSocket.connected = true;
        });

        it('should start typing', () => {
            socketService.startTyping('conv-1');

            expect(mockSocket.emit).toHaveBeenCalledWith('typing_start', 'conv-1');
        });

        it('should stop typing', () => {
            socketService.stopTyping('conv-1');

            expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', 'conv-1');
        });

        it('should auto-stop typing after timeout', (done) => {
            vi.useFakeTimers();

            socketService.startTyping('conv-1');

            // Fast-forward time
            vi.advanceTimersByTime(3000);

            // Should have called stop typing
            setTimeout(() => {
                expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', 'conv-1');
                vi.useRealTimers();
                done();
            }, 0);
        });
    });

    describe('Reconnection Logic', () => {
        it('should attempt reconnection on disconnect', async () => {
            await socketService.connect();
            mockSocket.connected = true;

            // Simulate disconnect
            const disconnectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'disconnect'
            )[1];

            mockSocket.connected = false;
            disconnectHandler('io server disconnect');

            expect(socketService.getConnectionStatus()).toBe('disconnected');
        });

        it('should rejoin conversations after reconnection', async () => {
            await socketService.connect();
            mockSocket.connected = true;

            // Join a conversation
            socketService.joinConversation('conv-1');

            // Simulate reconnection
            const reconnectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'reconnect'
            )[1];
            reconnectHandler(1);

            // Should rejoin the conversation
            expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'conv-1');
        });

        it('should not reconnect on manual disconnect', async () => {
            await socketService.connect();
            mockSocket.connected = true;

            socketService.disconnect();

            // Simulate disconnect event
            const disconnectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'disconnect'
            )[1];
            disconnectHandler('client namespace disconnect');

            // Should not attempt reconnection
            expect(socketService.getConnectionStatus()).toBe('disconnected');
        });
    });

    describe('Connection Status', () => {
        it('should return correct connection status', () => {
            expect(socketService.getConnectionStatus()).toBe('disconnected');
            expect(socketService.isConnected()).toBe(false);
        });

        it('should provide connection info', async () => {
            await socketService.connect();
            mockSocket.connected = true;
            mockSocket.id = 'test-socket-id';

            const info = socketService.getConnectionInfo();

            expect(info).toEqual({
                status: expect.any(String),
                reconnectAttempts: expect.any(Number),
                joinedConversations: expect.any(Array),
                socketId: 'test-socket-id',
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle authentication errors', async () => {
            (authService.getCurrentUser as any).mockRejectedValue(
                new Error('Authentication failed')
            );

            const isAuth = await (socketService as any).checkAuthentication();
            expect(isAuth).toBe(false);
        });

        it('should handle socket errors', async () => {
            await socketService.connect();

            const onError = vi.fn();
            socketService.setEventHandlers({ onError });

            // Simulate socket error
            const errorHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'error_notification'
            )[1];
            errorHandler({ type: 'connection_error', message: 'Connection lost', retry: true });

            expect(onError).toHaveBeenCalledWith('Connection lost');
        });
    });

    describe('Force Reconnect', () => {
        it('should force reconnection', async () => {
            await socketService.connect();
            mockSocket.connected = true;

            socketService.forceReconnect();

            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(mockSocket.connect).toHaveBeenCalled();
        });
    });
});