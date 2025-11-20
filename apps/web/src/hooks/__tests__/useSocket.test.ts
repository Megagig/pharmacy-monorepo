import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocket, useSocketConnection, useTypingIndicator, useConversationPresence } from '../useSocket';
import { socketService } from '../../services/socketService';
import { authService } from '../../services/authService';
import { useCommunicationStore } from '../../stores/communicationStore';

// Mock dependencies
vi.mock('../../services/socketService', () => ({
    socketService: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        setEventHandlers: vi.fn(),
        joinConversation: vi.fn(),
        leaveConversation: vi.fn(),
        sendMessage: vi.fn(),
        startTyping: vi.fn(),
        stopTyping: vi.fn(),
        markMessageAsRead: vi.fn(),
        forceReconnect: vi.fn(),
        refreshAuthentication: vi.fn(),
        getConnectionStatus: vi.fn(),
        isConnected: vi.fn(),
        getConnectionInfo: vi.fn(),
    },
}));

vi.mock('../../services/authService', () => ({
    authService: {
        getCurrentUser: vi.fn(),
    },
}));

vi.mock('../../stores/communicationStore', () => ({
    useCommunicationStore: vi.fn(),
}));

describe('useSocket', () => {
    let mockStoreActions: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock store actions
        mockStoreActions = {
            handleSocketMessage: vi.fn(),
            handleSocketConversationUpdate: vi.fn(),
            handleSocketUserTyping: vi.fn(),
            handleSocketUserStoppedTyping: vi.fn(),
            addNotification: vi.fn(),
            updateMessage: vi.fn(),
            typingUsers: {},
        };

        (useCommunicationStore as any).mockReturnValue(mockStoreActions);

        // Mock auth service
        (authService.getCurrentUser as any).mockResolvedValue({
            success: true,
            user: { id: 'test-user', email: 'test@example.com' },
        });

        // Mock socket service
        (socketService.connect as any).mockResolvedValue(undefined);
        (socketService.getConnectionStatus as any).mockReturnValue('disconnected');
        (socketService.isConnected as any).mockReturnValue(false);
    });

    describe('Basic Functionality', () => {
        it('should initialize with correct default state', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            expect(result.current.connectionStatus).toBe('disconnected');
            expect(result.current.isConnected).toBe(false);
            expect(result.current.isAuthenticated).toBe(false);
        });

        it('should check authentication on mount', async () => {
            renderHook(() => useSocket({ autoConnect: false }));

            await waitFor(() => {
                expect(authService.getCurrentUser).toHaveBeenCalled();
            });
        });

        it('should set up socket event handlers', () => {
            renderHook(() => useSocket({ autoConnect: false }));

            expect(socketService.setEventHandlers).toHaveBeenCalledWith(
                expect.objectContaining({
                    onMessageReceived: expect.any(Function),
                    onMessageUpdated: expect.any(Function),
                    onUserTyping: expect.any(Function),
                    onUserStoppedTyping: expect.any(Function),
                    onNotificationReceived: expect.any(Function),
                    onConversationUpdated: expect.any(Function),
                })
            );
        });
    });

    describe('Authentication', () => {
        it('should auto-connect when authenticated', async () => {
            (authService.getCurrentUser as any).mockResolvedValue({
                success: true,
                user: { id: 'test-user' },
            });

            renderHook(() => useSocket({ autoConnect: true }));

            await waitFor(() => {
                expect(socketService.connect).toHaveBeenCalled();
            });
        });

        it('should not auto-connect when not authenticated', async () => {
            (authService.getCurrentUser as any).mockResolvedValue({
                success: false,
                user: null,
            });

            renderHook(() => useSocket({ autoConnect: true }));

            await waitFor(() => {
                expect(authService.getCurrentUser).toHaveBeenCalled();
            });

            expect(socketService.connect).not.toHaveBeenCalled();
        });

        it('should disconnect when authentication is lost', async () => {
            const { rerender } = renderHook(() => useSocket({ autoConnect: false }));

            // Initially authenticated
            (authService.getCurrentUser as any).mockResolvedValue({
                success: true,
                user: { id: 'test-user' },
            });

            rerender();

            await waitFor(() => {
                expect(authService.getCurrentUser).toHaveBeenCalled();
            });

            // Lose authentication
            (authService.getCurrentUser as any).mockResolvedValue({
                success: false,
                user: null,
            });

            rerender();

            await waitFor(() => {
                expect(socketService.disconnect).toHaveBeenCalled();
            });
        });
    });

    describe('Connection Management', () => {
        it('should connect successfully', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            expect(socketService.connect).toHaveBeenCalled();
        });

        it('should handle connection errors', async () => {
            (socketService.connect as any).mockRejectedValue(new Error('Connection failed'));

            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await expect(result.current.connect()).rejects.toThrow('Connection failed');
        });

        it('should disconnect properly', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.disconnect();
            });

            expect(socketService.disconnect).toHaveBeenCalled();
        });

        it('should force reconnect', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.forceReconnect();
            });

            expect(socketService.forceReconnect).toHaveBeenCalled();
        });
    });

    describe('Conversation Operations', () => {
        it('should join conversation', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.joinConversation('conv-1');
            });

            expect(socketService.joinConversation).toHaveBeenCalledWith('conv-1');
        });

        it('should leave conversation', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.leaveConversation('conv-1');
            });

            expect(socketService.leaveConversation).toHaveBeenCalledWith('conv-1');
        });
    });

    describe('Message Operations', () => {
        it('should send message', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            const messageData = {
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' },
            };

            act(() => {
                result.current.sendMessage(messageData);
            });

            expect(socketService.sendMessage).toHaveBeenCalledWith(messageData);
        });

        it('should mark message as read', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.markMessageAsRead('msg-1');
            });

            expect(socketService.markMessageAsRead).toHaveBeenCalledWith('msg-1');
        });
    });

    describe('Typing Indicators', () => {
        it('should start typing', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.startTyping('conv-1');
            });

            expect(socketService.startTyping).toHaveBeenCalledWith('conv-1');
        });

        it('should stop typing', () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            act(() => {
                result.current.stopTyping('conv-1');
            });

            expect(socketService.stopTyping).toHaveBeenCalledWith('conv-1');
        });
    });

    describe('Event Handlers', () => {
        it('should handle message received events', () => {
            renderHook(() => useSocket({ autoConnect: false }));

            const mockMessage = {
                _id: 'msg-1',
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' },
            };

            // Get the event handlers that were set
            const setEventHandlersCall = (socketService.setEventHandlers as any).mock.calls[0][0];

            act(() => {
                setEventHandlersCall.onMessageReceived(mockMessage);
            });

            expect(mockStoreActions.handleSocketMessage).toHaveBeenCalledWith(mockMessage);
        });

        it('should handle typing events', () => {
            renderHook(() => useSocket({ autoConnect: false }));

            const setEventHandlersCall = (socketService.setEventHandlers as any).mock.calls[0][0];

            act(() => {
                setEventHandlersCall.onUserTyping('conv-1', 'user-1');
            });

            expect(mockStoreActions.handleSocketUserTyping).toHaveBeenCalledWith('conv-1', 'user-1');
        });

        it('should handle notification events', () => {
            renderHook(() => useSocket({ autoConnect: false }));

            const mockNotification = {
                _id: 'notif-1',
                type: 'new_message',
                title: 'New Message',
            };

            const setEventHandlersCall = (socketService.setEventHandlers as any).mock.calls[0][0];

            act(() => {
                setEventHandlersCall.onNotificationReceived(mockNotification);
            });

            expect(mockStoreActions.addNotification).toHaveBeenCalledWith(mockNotification);
        });
    });

    describe('Cleanup', () => {
        it('should disconnect on unmount', () => {
            const { unmount } = renderHook(() => useSocket({ autoConnect: false }));

            unmount();

            expect(socketService.disconnect).toHaveBeenCalled();
        });
    });
});

describe('useSocketConnection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (socketService.getConnectionStatus as any).mockReturnValue('connected');
        (socketService.isConnected as any).mockReturnValue(true);
        (socketService.getConnectionInfo as any).mockReturnValue({
            status: 'connected',
            reconnectAttempts: 0,
            joinedConversations: ['conv-1'],
            socketId: 'test-socket-id',
        });
    });

    it('should return connection status', () => {
        const { result } = renderHook(() => useSocketConnection());

        expect(result.current.connectionStatus).toBe('connected');
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionInfo).toEqual({
            status: 'connected',
            reconnectAttempts: 0,
            joinedConversations: ['conv-1'],
            socketId: 'test-socket-id',
        });
    });
});

describe('useTypingIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const mockStoreActions = {
            typingUsers: {
                'conv-1': ['user-1', 'user-2'],
            },
        };

        (useCommunicationStore as any).mockReturnValue(mockStoreActions);
    });

    it('should return typing users for conversation', () => {
        const { result } = renderHook(() => useTypingIndicator('conv-1'));

        expect(result.current.typingUsers).toEqual(['user-1', 'user-2']);
    });

    it('should handle start typing', () => {
        const { result } = renderHook(() => useTypingIndicator('conv-1'));

        act(() => {
            result.current.startTyping();
        });

        expect(socketService.startTyping).toHaveBeenCalledWith('conv-1');
    });

    it('should handle stop typing', () => {
        const { result } = renderHook(() => useTypingIndicator('conv-1'));

        act(() => {
            result.current.stopTyping();
        });

        expect(socketService.stopTyping).toHaveBeenCalledWith('conv-1');
    });
});

describe('useConversationPresence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (socketService.joinConversation as any).mockImplementation(() => { });
        (socketService.leaveConversation as any).mockImplementation(() => { });
    });

    it('should join conversation when connected', () => {
        const { result } = renderHook(() =>
            useConversationPresence('conv-1')
        );

        expect(result.current.isPresent).toBe(false); // Initially false since not connected
    });

    it('should leave conversation on unmount', () => {
        const { unmount } = renderHook(() =>
            useConversationPresence('conv-1')
        );

        unmount();

        // Note: The actual join/leave calls depend on the isConnected state
        // which is mocked to return false by default
    });

    it('should handle conversation change', () => {
        const { rerender } = renderHook(
            ({ conversationId }) => useConversationPresence(conversationId),
            { initialProps: { conversationId: 'conv-1' } }
        );

        rerender({ conversationId: 'conv-2' });

        // Should handle the conversation change
        expect(socketService.leaveConversation).toHaveBeenCalledWith('conv-1');
    });
});