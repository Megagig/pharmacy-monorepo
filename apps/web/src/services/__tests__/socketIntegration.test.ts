import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { socketService } from '../socketService';
import { useSocket } from '../../hooks/useSocket';
import { authService } from '../authService';
import { useCommunicationStore } from '../../stores/communicationStore';

// Mock dependencies
vi.mock('../authService');
vi.mock('../../stores/communicationStore');
vi.mock('socket.io-client', () => ({
    io: vi.fn(),
}));

describe('Socket.IO Client Integration', () => {
    let mockSocket: any;
    let mockStoreActions: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock socket instance
        mockSocket = {
            id: 'test-socket-id',
            connected: false,
            connect: vi.fn(),
            disconnect: vi.fn(),
            on: vi.fn(),
            emit: vi.fn(),
            auth: {},
        };

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

        // Mock io function
        const { io } = require('socket.io-client');
        io.mockReturnValue(mockSocket);
    });

    afterEach(() => {
        socketService.disconnect();
    });

    describe('Complete Messaging Workflow', () => {
        it('should handle complete real-time messaging workflow', async () => {
            // 1. Initialize socket connection
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            // 2. Connect to socket
            await act(async () => {
                await result.current.connect();
            });

            // Simulate successful connection
            const connectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'connect'
            )[1];
            mockSocket.connected = true;
            connectHandler();

            expect(result.current.isConnected).toBe(true);

            // 3. Join a conversation
            act(() => {
                result.current.joinConversation('conv-1');
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'conv-1');

            // 4. Send a message
            const messageData = {
                conversationId: 'conv-1',
                content: { text: 'Hello World', type: 'text' as const },
            };

            act(() => {
                result.current.sendMessage(messageData);
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('send_message', messageData);

            // 5. Receive a message
            const receivedMessage = {
                _id: 'msg-1',
                conversationId: 'conv-1',
                senderId: 'other-user',
                content: { text: 'Hello back!', type: 'text' },
                createdAt: new Date().toISOString(),
            };

            const messageHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'message_received'
            )[1];

            act(() => {
                messageHandler(receivedMessage);
            });

            expect(mockStoreActions.handleSocketMessage).toHaveBeenCalledWith(receivedMessage);

            // 6. Start typing
            act(() => {
                result.current.startTyping('conv-1');
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('typing_start', 'conv-1');

            // 7. Receive typing indicator
            const typingHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'user_typing'
            )[1];

            act(() => {
                typingHandler({ userId: 'other-user', conversationId: 'conv-1' });
            });

            expect(mockStoreActions.handleSocketUserTyping).toHaveBeenCalledWith('conv-1', 'other-user');

            // 8. Stop typing
            act(() => {
                result.current.stopTyping('conv-1');
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', 'conv-1');

            // 9. Mark message as read
            act(() => {
                result.current.markMessageAsRead('msg-1');
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('mark_read', 'msg-1');

            // 10. Leave conversation
            act(() => {
                result.current.leaveConversation('conv-1');
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('leave_conversation', 'conv-1');

            // 11. Disconnect
            act(() => {
                result.current.disconnect();
            });

            expect(mockSocket.disconnect).toHaveBeenCalled();
        });
    });

    describe('Reconnection Scenarios', () => {
        it('should handle connection loss and reconnection', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            // Initial connection
            await act(async () => {
                await result.current.connect();
            });

            const connectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'connect'
            )[1];
            mockSocket.connected = true;
            connectHandler();

            // Join conversation
            act(() => {
                result.current.joinConversation('conv-1');
            });

            // Simulate connection loss
            const disconnectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'disconnect'
            )[1];

            mockSocket.connected = false;
            act(() => {
                disconnectHandler('transport close');
            });

            expect(result.current.isConnected).toBe(false);

            // Simulate reconnection
            const reconnectHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'reconnect'
            )[1];

            mockSocket.connected = true;
            act(() => {
                reconnectHandler(1);
            });

            // Should rejoin conversations after reconnection
            expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'conv-1');
        });

        it('should handle authentication errors during connection', async () => {
            (authService.getCurrentUser as any).mockRejectedValue(
                new Error('Authentication failed')
            );

            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await expect(result.current.connect()).rejects.toThrow('Authentication required');
        });
    });

    describe('Error Handling', () => {
        it('should handle socket errors gracefully', async () => {
            const onError = vi.fn();
            const { result } = renderHook(() =>
                useSocket({ autoConnect: false, onError })
            );

            await act(async () => {
                await result.current.connect();
            });

            // Simulate socket error
            const errorHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'error_notification'
            )[1];

            act(() => {
                errorHandler({
                    type: 'connection_error',
                    message: 'Network error',
                    retry: false
                });
            });

            expect(onError).toHaveBeenCalledWith('Network error');
        });

        it('should handle message send failures', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            // Try to send message when disconnected
            mockSocket.connected = false;

            const messageData = {
                conversationId: 'conv-1',
                content: { text: 'Hello', type: 'text' as const },
            };

            act(() => {
                result.current.sendMessage(messageData);
            });

            // Should not emit when disconnected
            expect(mockSocket.emit).not.toHaveBeenCalledWith('send_message', messageData);
        });
    });

    describe('Notification Handling', () => {
        it('should handle real-time notifications', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            const notification = {
                _id: 'notif-1',
                userId: 'test-user',
                type: 'new_message' as const,
                title: 'New Message',
                content: 'You have a new message from John',
                data: {
                    conversationId: 'conv-1',
                    messageId: 'msg-1',
                    senderId: 'john-user',
                },
                priority: 'normal' as const,
                status: 'unread' as const,
                createdAt: new Date().toISOString(),
            };

            const notificationHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'notification_received'
            )[1];

            act(() => {
                notificationHandler(notification);
            });

            expect(mockStoreActions.addNotification).toHaveBeenCalledWith(notification);
        });
    });

    describe('Conversation Management', () => {
        it('should handle conversation updates', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            const updatedConversation = {
                _id: 'conv-1',
                title: 'Updated Conversation',
                type: 'group' as const,
                status: 'active' as const,
                participants: [
                    { userId: 'user-1', role: 'pharmacist' as const },
                    { userId: 'user-2', role: 'patient' as const },
                ],
                lastMessageAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const conversationHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'conversation_updated'
            )[1];

            act(() => {
                conversationHandler(updatedConversation);
            });

            expect(mockStoreActions.handleSocketConversationUpdate).toHaveBeenCalledWith(
                updatedConversation
            );
        });

        it('should handle participant events', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            // Test participant joined
            const participantJoinedHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'participant_joined'
            )[1];

            act(() => {
                participantJoinedHandler({ userId: 'new-user', conversationId: 'conv-1' });
            });

            // Test participant left
            const participantLeftHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'participant_left'
            )[1];

            act(() => {
                participantLeftHandler({ userId: 'old-user', conversationId: 'conv-1' });
            });

            // These events are logged but don't trigger store updates directly
            // The actual conversation update would come through conversation_updated event
        });
    });

    describe('Performance and Optimization', () => {
        it('should handle multiple rapid events efficiently', async () => {
            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            const messageHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'message_received'
            )[1];

            // Send multiple messages rapidly
            const messages = Array.from({ length: 10 }, (_, i) => ({
                _id: `msg-${i}`,
                conversationId: 'conv-1',
                senderId: 'user-1',
                content: { text: `Message ${i}`, type: 'text' as const },
                createdAt: new Date().toISOString(),
            }));

            act(() => {
                messages.forEach(message => {
                    messageHandler(message);
                });
            });

            expect(mockStoreActions.handleSocketMessage).toHaveBeenCalledTimes(10);
        });

        it('should debounce typing indicators', async () => {
            vi.useFakeTimers();

            const { result } = renderHook(() => useSocket({ autoConnect: false }));

            await act(async () => {
                await result.current.connect();
            });

            mockSocket.connected = true;

            // Start typing multiple times rapidly
            act(() => {
                result.current.startTyping('conv-1');
                result.current.startTyping('conv-1');
                result.current.startTyping('conv-1');
            });

            // Should only emit once
            expect(mockSocket.emit).toHaveBeenCalledWith('typing_start', 'conv-1');
            expect(mockSocket.emit).toHaveBeenCalledTimes(1);

            // Fast-forward time to trigger auto-stop
            act(() => {
                vi.advanceTimersByTime(3000);
            });

            // Should auto-stop typing
            await waitFor(() => {
                expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', 'conv-1');
            });

            vi.useRealTimers();
        });
    });
});