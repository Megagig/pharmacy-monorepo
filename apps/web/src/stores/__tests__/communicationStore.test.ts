import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunicationStore } from '../communicationStore';
import type { Conversation, Message, CommunicationNotification } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('CommunicationStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');

        // Reset store state before each test
        const { result } = renderHook(() => useCommunicationStore());
        act(() => {
            result.current.resetStore();
        });
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const { result } = renderHook(() => useCommunicationStore());

            expect(result.current.conversations).toEqual([]);
            expect(result.current.activeConversation).toBeNull();
            expect(result.current.messages).toEqual({});
            expect(result.current.notifications).toEqual([]);
            expect(result.current.unreadCount).toBe(0);
            expect(result.current.sidebarOpen).toBe(true);
            expect(result.current.selectedThread).toBeNull();
            expect(result.current.searchQuery).toBe('');
        });
    });

    describe('Conversation Management', () => {
        const mockConversation: Conversation = {
            _id: 'conv-1',
            title: 'Test Conversation',
            type: 'patient_query',
            participants: [
                {
                    userId: 'user-1',
                    role: 'pharmacist',
                    joinedAt: '2024-01-01T00:00:00Z',
                    permissions: ['read', 'write'],
                },
            ],
            status: 'active',
            priority: 'normal',
            tags: [],
            lastMessageAt: '2024-01-01T00:00:00Z',
            createdBy: 'user-1',
            workplaceId: 'workplace-1',
            metadata: {
                isEncrypted: true,
            },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        };

        it('should set active conversation', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setActiveConversation(mockConversation);
            });

            expect(result.current.activeConversation).toEqual(mockConversation);
        });

        it('should update conversation', () => {
            const { result } = renderHook(() => useCommunicationStore());

            // First add a conversation
            act(() => {
                result.current.conversations = [mockConversation];
            });

            // Then update it
            act(() => {
                result.current.updateConversation('conv-1', { title: 'Updated Title' });
            });

            expect(result.current.conversations[0].title).toBe('Updated Title');
        });
    });

    describe('Message Management', () => {
        const mockMessage: Message = {
            _id: 'msg-1',
            conversationId: 'conv-1',
            senderId: 'user-1',
            content: {
                text: 'Hello, world!',
                type: 'text',
            },
            mentions: [],
            reactions: [],
            status: 'sent',
            priority: 'normal',
            readBy: [],
            editHistory: [],
            isDeleted: false,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        };

        it('should add message to conversation', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addMessage('conv-1', mockMessage);
            });

            expect(result.current.messages['conv-1']).toContain(mockMessage);
        });

        it('should not add duplicate messages', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addMessage('conv-1', mockMessage);
                result.current.addMessage('conv-1', mockMessage); // Duplicate
            });

            expect(result.current.messages['conv-1']).toHaveLength(1);
        });

        it('should update message', () => {
            const { result } = renderHook(() => useCommunicationStore());

            // First add a message
            act(() => {
                result.current.addMessage('conv-1', mockMessage);
            });

            // Then update it
            act(() => {
                result.current.updateMessage('msg-1', { status: 'read' });
            });

            expect(result.current.messages['conv-1'][0].status).toBe('read');
        });

        it('should handle optimistic message sending', () => {
            const { result } = renderHook(() => useCommunicationStore());

            let tempId: string = '';
            act(() => {
                tempId = result.current.optimisticSendMessage('conv-1', {
                    senderId: 'user-1',
                    content: { text: 'Optimistic message', type: 'text' },
                });
            });

            expect(tempId).toMatch(/^temp_/);
            expect(result.current.messages['conv-1']).toHaveLength(1);
            expect(result.current.messages['conv-1'][0]._id).toBe(tempId);
        });

        it('should confirm optimistic message', () => {
            const { result } = renderHook(() => useCommunicationStore());

            let tempId: string = '';
            act(() => {
                tempId = result.current.optimisticSendMessage('conv-1', {
                    senderId: 'user-1',
                    content: { text: 'Optimistic message', type: 'text' },
                });
            });

            act(() => {
                result.current.confirmOptimisticMessage(tempId, mockMessage);
            });

            expect(result.current.messages['conv-1'][0]._id).toBe('msg-1');
        });

        it('should reject optimistic message', () => {
            const { result } = renderHook(() => useCommunicationStore());

            let tempId: string = '';
            act(() => {
                tempId = result.current.optimisticSendMessage('conv-1', {
                    senderId: 'user-1',
                    content: { text: 'Optimistic message', type: 'text' },
                });
            });

            act(() => {
                result.current.rejectOptimisticMessage(tempId, 'Network error');
            });

            expect(result.current.messages['conv-1'][0].status).toBe('failed');
            expect(result.current.errors.sendMessage).toBe('Network error');
        });
    });

    describe('Real-time Updates', () => {
        it('should handle typing users', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setTypingUsers('conv-1', ['user-1', 'user-2']);
            });

            expect(result.current.typingUsers['conv-1']).toEqual(['user-1', 'user-2']);
        });

        it('should add typing user', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addTypingUser('conv-1', 'user-1');
                result.current.addTypingUser('conv-1', 'user-2');
            });

            expect(result.current.typingUsers['conv-1']).toEqual(['user-1', 'user-2']);
        });

        it('should not add duplicate typing user', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addTypingUser('conv-1', 'user-1');
                result.current.addTypingUser('conv-1', 'user-1'); // Duplicate
            });

            expect(result.current.typingUsers['conv-1']).toEqual(['user-1']);
        });

        it('should remove typing user', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setTypingUsers('conv-1', ['user-1', 'user-2']);
                result.current.removeTypingUser('conv-1', 'user-1');
            });

            expect(result.current.typingUsers['conv-1']).toEqual(['user-2']);
        });

        it('should handle socket message', () => {
            const { result } = renderHook(() => useCommunicationStore());
            const mockMessage: Message = {
                _id: 'msg-socket',
                conversationId: 'conv-1',
                senderId: 'user-2',
                content: { text: 'Socket message', type: 'text' },
                mentions: [],
                reactions: [],
                status: 'sent',
                priority: 'normal',
                readBy: [],
                editHistory: [],
                isDeleted: false,
                createdAt: '2024-01-01T01:00:00Z',
                updatedAt: '2024-01-01T01:00:00Z',
            };

            act(() => {
                result.current.handleSocketMessage(mockMessage);
            });

            expect(result.current.messages['conv-1']).toContain(mockMessage);
        });
    });

    describe('Notification Management', () => {
        const mockNotification: CommunicationNotification = {
            _id: 'notif-1',
            userId: 'user-1',
            type: 'new_message',
            title: 'New Message',
            content: 'You have a new message',
            data: {
                conversationId: 'conv-1',
                messageId: 'msg-1',
            },
            priority: 'normal',
            status: 'unread',
            deliveryChannels: {
                inApp: true,
                email: false,
                sms: false,
            },
            workplaceId: 'workplace-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        };

        it('should add notification and update unread count', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addNotification(mockNotification);
            });

            expect(result.current.notifications).toContain(mockNotification);
            expect(result.current.unreadCount).toBe(1);
        });

        it('should mark notification as read', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addNotification(mockNotification);
                result.current.markNotificationAsRead('notif-1');
            });

            expect(result.current.notifications[0].status).toBe('read');
            expect(result.current.unreadCount).toBe(0);
        });

        it('should mark all notifications as read', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addNotification(mockNotification);
                result.current.addNotification({
                    ...mockNotification,
                    _id: 'notif-2',
                });
                result.current.markAllNotificationsAsRead();
            });

            expect(result.current.notifications.every(n => n.status === 'read')).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it('should remove notification', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.addNotification(mockNotification);
                result.current.removeNotification('notif-1');
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe('UI State Management', () => {
        it('should manage sidebar state', () => {
            const { result } = renderHook(() => useCommunicationStore());

            expect(result.current.sidebarOpen).toBe(true);

            act(() => {
                result.current.setSidebarOpen(false);
            });

            expect(result.current.sidebarOpen).toBe(false);
        });

        it('should manage selected thread', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setSelectedThread('thread-1');
            });

            expect(result.current.selectedThread).toBe('thread-1');
        });

        it('should manage search query', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setSearchQuery('test search');
            });

            expect(result.current.searchQuery).toBe('test search');
        });
    });

    describe('Error Handling', () => {
        it('should set and clear errors', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setError('testError', 'Something went wrong');
            });

            expect(result.current.errors.testError).toBe('Something went wrong');

            act(() => {
                result.current.clearErrors();
            });

            expect(result.current.errors).toEqual({});
        });

        it('should handle loading states', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setLoading('testLoading', true);
            });

            expect(result.current.loading.testLoading).toBe(true);

            act(() => {
                result.current.setLoading('testLoading', false);
            });

            expect(result.current.loading.testLoading).toBe(false);
        });
    });

    describe('Store Reset', () => {
        it('should reset store to initial state', () => {
            const { result } = renderHook(() => useCommunicationStore());

            // Modify state
            act(() => {
                result.current.addMessage('conv-1', {
                    _id: 'msg-1',
                    conversationId: 'conv-1',
                    senderId: 'user-1',
                    content: { text: 'Test', type: 'text' },
                    mentions: [],
                    reactions: [],
                    status: 'sent',
                    priority: 'normal',
                    readBy: [],
                    editHistory: [],
                    isDeleted: false,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                });
                result.current.setSidebarOpen(false);
                result.current.setSearchQuery('test');
            });

            // Reset store
            act(() => {
                result.current.resetStore();
            });

            // Verify reset
            expect(result.current.messages).toEqual({});
            expect(result.current.sidebarOpen).toBe(true);
            expect(result.current.searchQuery).toBe('');
        });
    });

    describe('Filters and Search', () => {
        it('should set conversation filters', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setConversationFilters({ search: 'test', type: 'patient_query' });
            });

            expect(result.current.conversationFilters.search).toBe('test');
            expect(result.current.conversationFilters.type).toBe('patient_query');
        });

        it('should clear conversation filters', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setConversationFilters({ search: 'test', type: 'patient_query' });
                result.current.clearConversationFilters();
            });

            expect(result.current.conversationFilters.search).toBe('');
            expect(result.current.conversationFilters.type).toBeUndefined();
        });

        it('should set message filters', () => {
            const { result } = renderHook(() => useCommunicationStore());

            act(() => {
                result.current.setMessageFilters('conv-1', { search: 'test message' });
            });

            expect(result.current.messageFilters['conv-1']?.search).toBe('test message');
        });
    });
});