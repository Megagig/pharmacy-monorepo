import { describe, it, expect, vi, beforeEach } from 'vitest';
import { socketService } from '../socketService';

// Mock socket.io-client
const mockSocket = {
    id: 'test-socket-id',
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    auth: {},
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket),
}));

// Mock auth service
vi.mock('../authService', () => ({
    authService: {
        getCurrentUser: vi.fn().mockResolvedValue({
            success: true,
            user: { id: 'test-user', email: 'test@example.com' },
        }),
    },
}));

describe('SocketService - Basic Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSocket.connected = false;
    });

    it('should initialize with disconnected status', () => {
        expect(socketService.getConnectionStatus()).toBe('disconnected');
        expect(socketService.isConnected()).toBe(false);
    });

    it('should set event handlers', () => {
        const handlers = {
            onMessageReceived: vi.fn(),
            onConnectionStatusChange: vi.fn(),
        };

        socketService.setEventHandlers(handlers);

        // Should not throw
        expect(true).toBe(true);
    });

    it('should handle join/leave conversation when disconnected', () => {
        mockSocket.connected = false;

        // Should not throw when disconnected
        socketService.joinConversation('conv-1');
        socketService.leaveConversation('conv-1');

        expect(true).toBe(true);
    });

    it('should provide connection info', () => {
        const info = socketService.getConnectionInfo();

        expect(info).toHaveProperty('status');
        expect(info).toHaveProperty('reconnectAttempts');
        expect(info).toHaveProperty('joinedConversations');
    });

    it('should handle force reconnect when socket exists', () => {
        // This should not throw even if socket is not connected
        socketService.forceReconnect();
        expect(true).toBe(true);
    });
});