import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import {
    Conversation,
    Message,
    CommunicationNotification,
    ConversationFilters,
    MessageFilters,
    SendMessageData,
    CreateConversationData,
    LoadingState,
    ErrorState,
} from './types';
import { communicationCache } from '../services/cacheService';
import { offlineStorage } from '../services/offlineStorageService';
import { performanceMonitor } from '../utils/performanceMonitor';
// import { useConnectionPool } from '../hooks/useConnectionPool';
import { apiClient } from '../services/apiClient';

// Helper function to safely parse JSON responses
const safeJsonParse = async (response: Response, allowEmpty: boolean = false): Promise<any> => {
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            if (allowEmpty) {
                return { success: false, data: [], message: 'Invalid JSON response' };
            }
            throw new Error('Invalid JSON response from server');
        }
    } else {
        // Try to get text response and see if it's actually JSON
        const textResponse = await response.text();

        // Check if it's an HTML error page (common when endpoints don't exist)
        if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
            console.warn('Received HTML response instead of JSON - endpoint may not exist');
            if (allowEmpty) {
                // Return appropriate empty response based on common API patterns
                return {
                    success: true,
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
                    message: 'No data available'
                };
            }
            throw new Error(`Server returned HTML instead of JSON: ${response.status} ${response.statusText}`);
        }

        // Handle empty responses
        if (!textResponse.trim()) {
            console.warn('Received empty response');
            if (allowEmpty) {
                return {
                    success: true,
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
                    message: 'Empty response'
                };
            }
            throw new Error(`Server returned empty response: ${response.status} ${response.statusText}`);
        }

        try {
            return JSON.parse(textResponse);
        } catch (error) {
            console.warn('Response is not JSON:', textResponse.substring(0, 200));
            if (allowEmpty) {
                return {
                    success: true,
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
                    message: 'Invalid JSON response'
                };
            }
            throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
        }
    }
};

interface CommunicationState {
    // Conversations
    conversations: Conversation[];
    activeConversation: Conversation | null;
    conversationLoading: boolean;

    // Messages
    messages: Record<string, Message[]>; // conversationId -> messages
    messageLoading: boolean;
    typingUsers: Record<string, string[]>; // conversationId -> userIds

    // Notifications
    notifications: CommunicationNotification[];
    unreadCount: number;

    // UI State
    sidebarOpen: boolean;
    selectedThread: string | null;
    searchQuery: string;

    // Filters and Pagination
    conversationFilters: ConversationFilters;
    messageFilters: Record<string, MessageFilters>; // conversationId -> filters
    conversationPagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
    messagePagination: Record<string, {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasMore: boolean;
    }>; // conversationId -> pagination

    // Loading and Error States
    loading: LoadingState;
    errors: ErrorState;

    // Actions - Conversation Management
    setActiveConversation: (conversation: Conversation | null) => void;
    createConversation: (data: CreateConversationData) => Promise<Conversation | null>;
    createPatientQuery: (params: {
        patientId: string;
        title?: string;
        message: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        tags?: string[];
    }) => Promise<Conversation | null>;
    fetchConversations: (filters?: ConversationFilters) => Promise<void>;
    updateConversation: (id: string, updates: Partial<Conversation>) => void;
    deleteConversation: (id: string) => Promise<boolean>;
    addParticipant: (conversationId: string, userId: string, role: string) => Promise<boolean>;
    removeParticipant: (conversationId: string, userId: string) => Promise<boolean>;
    archiveConversation: (conversationId: string) => Promise<boolean>;
    resolveConversation: (conversationId: string) => Promise<boolean>;

    // Actions - Message Management
    sendMessage: (data: SendMessageData) => Promise<Message | null>;
    fetchMessages: (conversationId: string, filters?: MessageFilters) => Promise<void>;
    loadMoreMessages: (conversationId: string) => Promise<void>;
    addMessage: (conversationId: string, message: Message) => void;
    updateMessage: (messageId: string, updates: Partial<Message>) => void;
    deleteMessage: (messageId: string) => Promise<boolean>;
    markMessageAsRead: (messageId: string) => Promise<void>;
    markConversationAsRead: (conversationId: string) => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<boolean>;
    addReaction: (messageId: string, emoji: string) => Promise<boolean>;
    removeReaction: (messageId: string, emoji: string) => Promise<boolean>;
    getRecentMessages: (limit?: number) => Message[];

    // Actions - Threading
    createThread: (messageId: string) => Promise<string | null>;
    fetchThreadMessages: (threadId: string) => Promise<{ rootMessage: Message; replies: Message[] } | null>;
    fetchThreadSummary: (threadId: string) => Promise<any>;
    replyToThread: (threadId: string, content: string, attachments?: File[], mentions?: string[]) => Promise<Message | null>;
    getConversationThreads: (conversationId: string) => Promise<any[]>;

    // Actions - File Management
    uploadFiles: (conversationId: string, files: File[]) => Promise<unknown[]>;
    downloadFile: (fileId: string) => Promise<void>;
    deleteFile: (fileId: string) => Promise<boolean>;
    getFileMetadata: (fileId: string) => Promise<unknown>;
    listConversationFiles: (conversationId: string, filters?: Record<string, any>) => Promise<any[]>;

    // Actions - Real-time Updates
    setTypingUsers: (conversationId: string, userIds: string[]) => void;
    addTypingUser: (conversationId: string, userId: string) => void;
    removeTypingUser: (conversationId: string, userId: string) => void;
    handleSocketMessage: (message: Message) => void;
    handleSocketConversationUpdate: (conversation: Conversation) => void;
    handleSocketUserTyping: (conversationId: string, userId: string) => void;
    handleSocketUserStoppedTyping: (conversationId: string, userId: string) => void;

    // Actions - Notification Management
    addNotification: (notification: CommunicationNotification) => void;
    markNotificationAsRead: (notificationId: string) => void;
    markAllNotificationsAsRead: () => void;
    removeNotification: (notificationId: string) => void;
    fetchNotifications: () => Promise<void>;

    // Actions - Search and Filters
    setConversationFilters: (filters: Partial<ConversationFilters>) => void;
    setMessageFilters: (conversationId: string, filters: Partial<MessageFilters>) => void;
    clearConversationFilters: () => void;
    clearMessageFilters: (conversationId: string) => void;
    searchConversations: (searchTerm: string) => void;
    searchMessages: (conversationId: string, searchTerm: string) => void;

    // Actions - UI State
    setSidebarOpen: (open: boolean) => void;
    setSelectedThread: (threadId: string | null) => void;
    setSearchQuery: (query: string) => void;

    // Actions - Utility
    clearErrors: () => void;
    setLoading: (key: string, loading: boolean) => void;
    setError: (key: string, error: string | null) => void;
    resetStore: () => void;

    // Actions - Optimistic Updates
    optimisticSendMessage: (conversationId: string, tempMessage: Partial<Message>) => string;
    confirmOptimisticMessage: (tempId: string, confirmedMessage: Message) => void;
    rejectOptimisticMessage: (tempId: string, error: string) => void;
}

export const useCommunicationStore = create<CommunicationState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                // Initial state
                conversations: [],
                activeConversation: null,
                conversationLoading: false,
                messages: {},
                messageLoading: false,
                typingUsers: {},
                notifications: [],
                unreadCount: 0,
                sidebarOpen: true,
                selectedThread: null,
                searchQuery: '',
                conversationFilters: {
                    search: '',
                    sortBy: 'lastMessageAt',
                    sortOrder: 'desc',
                    page: 1,
                    limit: 20,
                },
                messageFilters: {},
                conversationPagination: {
                    page: 1,
                    limit: 20,
                    total: 0,
                    pages: 0,
                },
                messagePagination: {},
                loading: {},
                errors: {},

                // Conversation Management Actions
                setActiveConversation: (conversation) => {
                    set({ activeConversation: conversation });
                },

                createConversation: async (data) => {
                    const { setLoading, setError } = get();
                    setLoading('createConversation', true);
                    setError('createConversation', null);

                    try {
                        const response = await apiClient.post('/communication/conversations', data);

                        if (!response.data.success) {
                            throw new Error(response.data.message || 'Failed to create conversation');
                        }

                        const newConversation = response.data.data;

                        // Add to conversations list
                        set((state) => ({
                            conversations: [newConversation, ...state.conversations],
                            conversationPagination: {
                                ...state.conversationPagination,
                                total: state.conversationPagination.total + 1,
                            },
                        }));

                        return newConversation;
                    } catch (error: any) {
                        const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
                        setError('createConversation', errorMessage);
                        return null;
                    } finally {
                        setLoading('createConversation', false);
                    }
                },

                createPatientQuery: async ({ patientId, title, message, priority = 'normal', tags = [] }) => {
                    const { setLoading, setError } = get();
                    setLoading('createPatientQuery', true);
                    setError('createPatientQuery', null);

                    try {
                        const { data: response } = await apiClient.post(`/communication/patients/${patientId}/queries`, {
                            title,
                            message,
                            priority,
                            tags,
                        });

                        if (!response?.success) {
                            throw new Error(response?.message || 'Failed to create patient query');
                        }

                        const conversation: Conversation = response.data?.conversation;
                        const initialMessage: Message | undefined = response.data?.initialMessage;

                        if (!conversation) {
                            throw new Error('Server did not return a conversation');
                        }

                        // Update state with the new conversation
                        set((state) => ({
                            conversations: [conversation, ...state.conversations],
                            conversationPagination: {
                                ...state.conversationPagination,
                                total: (state.conversationPagination.total || 0) + 1,
                            },
                        }));

                        // Seed messages list with initial message if provided
                        if (initialMessage) {
                            set((state) => ({
                                messages: {
                                    ...state.messages,
                                    [conversation._id]: [initialMessage],
                                },
                            }));
                        }

                        return conversation;
                    } catch (error: any) {
                        const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
                        setError('createPatientQuery', errorMessage);
                        return null;
                    } finally {
                        setLoading('createPatientQuery', false);
                    }
                },

                fetchConversations: async (filters) => {
                    const { setLoading, setError } = get();
                    // Fetching conversations (debug log removed)

                    return performanceMonitor.measureFunction('fetch_conversations', async () => {
                        setLoading('fetchConversations', true);
                        setError('fetchConversations', null);

                        try {
                            const currentFilters = filters || get().conversationFilters;
                            const cacheKey = JSON.stringify(currentFilters);

                            // Check cache first
                            const cachedConversations = communicationCache.getCachedConversationList(cacheKey);
                            if (cachedConversations) {
                                set({
                                    conversations: cachedConversations,
                                });
                                return;
                            }

                            // Try offline storage if online request fails
                            let conversations: Conversation[] = [];
                            let pagination = {
                                page: currentFilters.page || 1,
                                limit: currentFilters.limit || 20,
                                total: 0,
                                pages: 0,
                            };

                            try {
                                const queryParams = new URLSearchParams();
                                Object.entries(currentFilters).forEach(([key, value]) => {
                                    if (value !== undefined && value !== null && value !== '') {
                                        queryParams.append(key, value.toString());
                                    }
                                });

                                // Use centralized axios client to ensure cookies + CSRF
                                const response = await apiClient.get(`/communication/conversations?${queryParams.toString()}`);
                                const result = response.data;

                                if (!result.success) {
                                    throw new Error(result.message || 'Failed to fetch conversations');
                                }

                                conversations = result.data || [];
                                pagination = {
                                    page: result.pagination?.page || currentFilters.page || 1,
                                    limit: result.pagination?.limit || currentFilters.limit || 20,
                                    total: result.pagination?.total || 0,
                                    pages: Math.ceil((result.pagination?.total || 0) / (result.pagination?.limit || 20)),
                                };
                                
                                // Conversations fetched successfully


                                // Cache the results
                                communicationCache.cacheConversationList(cacheKey, conversations);

                                // Store offline for future use
                                conversations.forEach(conv => offlineStorage.storeConversation(conv));

                            } catch (networkError) {
                                // Fall back to offline storage
                                const workplaceId = localStorage.getItem('workplaceId');
                                if (workplaceId) {
                                    conversations = await offlineStorage.getStoredConversations(workplaceId);
                                }

                                if (conversations.length === 0) {
                                    // If no offline data and it's a network error, show empty state instead of error
                                    if (networkError instanceof Error && networkError.message.includes('404')) {
                                        console.warn('Communication endpoints not available - showing empty state');
                                        set({
                                            conversations: [],
                                            conversationPagination: pagination,
                                        });
                                        return;
                                    }
                                    throw networkError;
                                }
                            }

                            set({
                                conversations,
                                conversationPagination: pagination,
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                            setError('fetchConversations', errorMessage);
                        } finally {
                            setLoading('fetchConversations', false);
                        }
                    });
                },

                updateConversation: (id, updates) => {
                    set((state) => ({
                        conversations: state.conversations.map((conv) =>
                            conv._id === id ? { ...conv, ...updates } : conv
                        ),
                        activeConversation:
                            state.activeConversation && state.activeConversation._id === id
                                ? { ...state.activeConversation, ...updates }
                                : state.activeConversation,
                    }));
                },

                deleteConversation: async (id) => {
                    const { setLoading, setError } = get();
                    setLoading('deleteConversation', true);
                    setError('deleteConversation', null);

                    try {
                        await apiClient.delete(`/communication/conversations/${id}`);

                        // Remove from state
                        set((state) => {
                            // Clone maps to safely delete keys without assigning undefined (which violates Record<string, T>)
                            const newMessages = { ...state.messages } as Record<string, Message[]>;
                            const newMessagePagination = { ...state.messagePagination } as Record<string, { page: number; limit: number; total: number; pages: number; hasMore: boolean; }>;
                            delete newMessages[id];
                            delete newMessagePagination[id];

                            return {
                                conversations: state.conversations.filter((conv) => conv._id !== id),
                                activeConversation:
                                    state.activeConversation && state.activeConversation._id === id
                                        ? null
                                        : state.activeConversation,
                                messages: newMessages,
                                messagePagination: newMessagePagination,
                            };
                        });

                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('deleteConversation', errorMessage);
                        return false;
                    } finally {
                        setLoading('deleteConversation', false);
                    }
                },

                addParticipant: async (conversationId, userId, role) => {
                    const { setLoading, setError } = get();
                    setLoading('addParticipant', true);
                    setError('addParticipant', null);

                    try {
                        const { data: result } = await apiClient.post(`/communication/conversations/${conversationId}/participants`, { userId, role });
                        if (result?.success && result.data) {
                            get().updateConversation(conversationId, result.data);
                        }
                        return !!result?.success;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('addParticipant', errorMessage);
                        return false;
                    } finally {
                        setLoading('addParticipant', false);
                    }
                },

                removeParticipant: async (conversationId, userId) => {
                    const { setLoading, setError } = get();
                    setLoading('removeParticipant', true);
                    setError('removeParticipant', null);

                    try {
                        const { data: result } = await apiClient.delete(`/communication/conversations/${conversationId}/participants/${userId}`);
                        if (result?.success && result.data) {
                            get().updateConversation(conversationId, result.data);
                        }
                        return !!result?.success;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('removeParticipant', errorMessage);
                        return false;
                    } finally {
                        setLoading('removeParticipant', false);
                    }
                },

                archiveConversation: async (conversationId) => {
                    const { setLoading, setError } = get();
                    setLoading('archiveConversation', true);
                    setError('archiveConversation', null);

                    try {
                        await apiClient.put(`/communication/conversations/${conversationId}`, { status: 'archived' });

                        get().updateConversation(conversationId, { status: 'archived' });
                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('archiveConversation', errorMessage);
                        return false;
                    } finally {
                        setLoading('archiveConversation', false);
                    }
                },

                resolveConversation: async (conversationId) => {
                    const { setLoading, setError } = get();
                    setLoading('resolveConversation', true);
                    setError('resolveConversation', null);

                    try {
                        await apiClient.put(`/communication/conversations/${conversationId}`, { status: 'resolved' });

                        get().updateConversation(conversationId, { status: 'resolved' });
                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('resolveConversation', errorMessage);
                        return false;
                    } finally {
                        setLoading('resolveConversation', false);
                    }
                },

                // Message Management Actions
                sendMessage: async (data) => {
                    const { setLoading, setError } = get();
                    setLoading('sendMessage', true);
                    setError('sendMessage', null);

                    try {
                        // Try to get CSRF token, but don't block if it fails
                        try {
                            await apiClient.get('/communication/csrf-token');
                        } catch (csrfError) {
                            console.warn('Failed to fetch CSRF token, proceeding without it:', csrfError);
                            // Continue with message sending even if CSRF token fails
                        }

                        const formData = new FormData();
                        formData.append('conversationId', data.conversationId);
                        formData.append('content', JSON.stringify({
                            text: data.content.text,
                            type: data.content.type,
                        }));

                        if (data.threadId) formData.append('threadId', data.threadId);
                        if (data.parentMessageId) formData.append('parentMessageId', data.parentMessageId);
                        if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));
                        if (data.priority) formData.append('priority', data.priority);

                        // Add file attachments
                        if (data.content.attachments) {
                            data.content.attachments.forEach((file) => {
                                formData.append(`attachments`, file);
                            });
                        }

                        const response = await apiClient.post(`/communication/conversations/${data.conversationId}/messages`, formData);
                        const result = response.data;
                        
                        if (!result.success) {
                            throw new Error(result.message || 'Failed to send message');
                        }

                        const newMessage = result.data;

                        // Ensure senderId is populated with current user info if available
                        if (data.currentUser && typeof newMessage.senderId === 'string') {
                            // Create a new message object to avoid mutating the original
                            const enhancedMessage = {
                                ...newMessage,
                                senderId: {
                                    _id: data.currentUser.id,
                                    firstName: data.currentUser.firstName,
                                    lastName: data.currentUser.lastName,
                                    role: data.currentUser.role,
                                },
                                // Ensure createdAt is properly set
                                createdAt: newMessage.createdAt || new Date().toISOString()
                            };
                            
                            // Add the enhanced message to conversation
                            get().addMessage(data.conversationId, enhancedMessage);
                        } else {
                            // Add message as-is if no enhancement needed, but ensure createdAt is valid
                            const messageToAdd = {
                                ...newMessage,
                                createdAt: newMessage.createdAt || new Date().toISOString()
                            };
                            get().addMessage(data.conversationId, messageToAdd);
                        }

                        // Update conversation's lastMessageAt
                        get().updateConversation(data.conversationId, {
                            lastMessageAt: newMessage.createdAt,
                        });

                        return newMessage;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('sendMessage', errorMessage);
                        return null;
                    } finally {
                        setLoading('sendMessage', false);
                    }
                },

                fetchMessages: async (conversationId, filters) => {
                    const { setLoading, setError } = get();

                    return performanceMonitor.measureFunction('fetch_messages', async () => {
                        setLoading('fetchMessages', true);
                        setError('fetchMessages', null);

                        try {
                            const currentFilters = filters || get().messageFilters[conversationId] || {
                                sortBy: 'createdAt',
                                sortOrder: 'desc',
                                page: 1,
                                limit: 50,
                            };

                            const page = currentFilters.page || 1;

                            // Check cache first
                            const cachedMessages = communicationCache.getCachedMessageList(conversationId, page);
                            if (cachedMessages) {
                                set((state) => {
                                    const existingMessages = state.messages[conversationId] || [];
                                    
                                    // Merge cached messages with existing ones, preserving populated fields
                                    const messageMap = new Map();
                                    existingMessages.forEach(msg => messageMap.set(msg._id, msg));
                                    cachedMessages.forEach(msg => {
                                        const existingMsg = messageMap.get(msg._id);
                                        if (existingMsg) {
                                            // Merge messages, preserving populated fields from existing message
                                            const mergedMsg = { ...msg };
                                            
                                            // Preserve populated senderId if it exists in existing message
                                            if (typeof existingMsg.senderId === 'object' && typeof msg.senderId === 'string') {
                                                mergedMsg.senderId = existingMsg.senderId;
                                            }
                                            
                                            // Preserve valid createdAt if the new one is invalid
                                            if (existingMsg.createdAt && (!msg.createdAt || typeof msg.createdAt === 'object')) {
                                                mergedMsg.createdAt = existingMsg.createdAt;
                                            }
                                            
                                            messageMap.set(msg._id, mergedMsg);
                                        } else {
                                            messageMap.set(msg._id, msg);
                                        }
                                    });
                                    
                                    const mergedMessages = Array.from(messageMap.values())
                                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                    return {
                                        messages: {
                                            ...state.messages,
                                            [conversationId]: mergedMessages,
                                        },
                                    };
                                });
                                return;
                            }

                            let messages: Message[] = [];
                            let pagination = {
                                page: currentFilters.page || 1,
                                limit: currentFilters.limit || 50,
                                total: 0,
                                pages: 0,
                                hasMore: false,
                            };

                            try {
                                const queryParams = new URLSearchParams();
                                Object.entries(currentFilters).forEach(([key, value]) => {
                                    if (value !== undefined && value !== null && value !== '') {
                                        queryParams.append(key, value.toString());
                                    }
                                });

                                const response = await apiClient.get(`/communication/conversations/${conversationId}/messages?${queryParams}`);
                                const result = response.data;

                                if (!result.success) {
                                    throw new Error(result.message || 'Failed to fetch messages');
                                }

                                messages = result.data || [];
                                pagination = {
                                    page: result.pagination?.page || currentFilters.page || 1,
                                    limit: result.pagination?.limit || currentFilters.limit || 50,
                                    total: result.pagination?.total || 0,
                                    pages: Math.ceil((result.pagination?.total || 0) / (result.pagination?.limit || 50)),
                                    hasMore: result.pagination?.hasMore || false,
                                };

                                // Cache the results
                                communicationCache.cacheMessageList(conversationId, messages, page);

                                // Store offline
                                messages.forEach(msg => offlineStorage.storeMessage(msg));

                            } catch (networkError) {
                                // Fall back to offline storage
                                messages = await offlineStorage.getStoredMessages(conversationId, currentFilters.limit);

                                if (messages.length === 0) {
                                    throw networkError;
                                }
                            }

                            set((state) => {
                                const existingMessages = state.messages[conversationId] || [];
                                
                                // Merge messages, avoiding duplicates and preserving populated fields
                                const messageMap = new Map();
                                
                                // Add existing messages first
                                existingMessages.forEach(msg => messageMap.set(msg._id, msg));
                                
                                // Add/update with fetched messages, but preserve populated senderId and other enhanced fields
                                messages.forEach(msg => {
                                    const existingMsg = messageMap.get(msg._id);
                                    if (existingMsg) {
                                        // Merge messages, preserving populated fields from existing message
                                        const mergedMsg = { ...msg };
                                        
                                        // Preserve populated senderId if it exists in existing message
                                        if (typeof existingMsg.senderId === 'object' && typeof msg.senderId === 'string') {
                                            mergedMsg.senderId = existingMsg.senderId;
                                        }
                                        
                                        // Preserve valid createdAt if the new one is invalid
                                        if (existingMsg.createdAt && (!msg.createdAt || typeof msg.createdAt === 'object')) {
                                            mergedMsg.createdAt = existingMsg.createdAt;
                                        }
                                        
                                        messageMap.set(msg._id, mergedMsg);
                                    } else {
                                        messageMap.set(msg._id, msg);
                                    }
                                });
                                
                                const mergedMessages = Array.from(messageMap.values())
                                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                return {
                                    messages: {
                                        ...state.messages,
                                        [conversationId]: mergedMessages,
                                    },
                                    messagePagination: {
                                        ...state.messagePagination,
                                        [conversationId]: pagination,
                                    },
                                };
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                            setError('fetchMessages', errorMessage);
                        } finally {
                            setLoading('fetchMessages', false);
                        }
                    }, { conversationId });
                },

                loadMoreMessages: async (conversationId) => {
                    const { messagePagination, messageFilters } = get();
                    const currentPagination = messagePagination[conversationId];

                    if (!currentPagination || !currentPagination.hasMore) {
                        return;
                    }

                    const nextPage = currentPagination.page + 1;
                    const filters = {
                        ...messageFilters[conversationId],
                        page: nextPage,
                    };

                    await get().fetchMessages(conversationId, filters);
                },

                addMessage: (conversationId, message) => {
                    set((state) => {
                        const existingMessages = state.messages[conversationId] || [];
                        const messageExists = existingMessages.some(m => m._id === message._id);

                        if (messageExists) {
                            return state; // Don't add duplicate messages
                        }

                        return {
                            messages: {
                                ...state.messages,
                                [conversationId]: [...existingMessages, message],
                            },
                        };
                    });
                },

                updateMessage: (messageId, updates) => {
                    set((state) => {
                        const newMessages = { ...state.messages };

                        Object.keys(newMessages).forEach((conversationId) => {
                            newMessages[conversationId] = newMessages[conversationId].map((message) =>
                                message._id === messageId ? { ...message, ...updates } : message
                            );
                        });

                        return { messages: newMessages };
                    });
                },

                deleteMessage: async (messageId, reason = 'Message deleted') => {
                    const { setLoading, setError } = get();
                    setLoading('deleteMessage', true);
                    setError('deleteMessage', null);

                    try {
                        await apiClient.delete(`/communication/messages/${messageId}`, { data: { reason } });

                        // Mark message as deleted in state
                        get().updateMessage(messageId, {
                            isDeleted: true,
                            deletedAt: new Date().toISOString(),
                            deletedBy: localStorage.getItem('userId') || '',
                        });

                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('deleteMessage', errorMessage);
                        return false;
                    } finally {
                        setLoading('deleteMessage', false);
                    }
                },

                markMessageAsRead: async (messageId) => {
                    try {
                        await apiClient.put(`/communication/messages/${messageId}/read`);

                        // Update message status and add to readBy array
                        const currentMessages = get().messages;
                        Object.keys(currentMessages).forEach((conversationId) => {
                            const messageIndex = currentMessages[conversationId].findIndex(m => m._id === messageId);
                            if (messageIndex !== -1) {
                                const message = currentMessages[conversationId][messageIndex];
                                const userId = localStorage.getItem('userId') || '';

                                // Check if user hasn't already read this message
                                const alreadyRead = message.readBy.some(r => r.userId === userId);
                                if (!alreadyRead) {
                                    message.readBy.push({
                                        userId,
                                        readAt: new Date().toISOString(),
                                    });
                                }

                                get().updateMessage(messageId, {
                                    status: 'read',
                                    readBy: message.readBy
                                });
                            }
                        });
                    } catch (error) {
                        console.error('Failed to mark message as read:', error);
                    }
                },

                markConversationAsRead: async (conversationId) => {
                    try {
                        // TODO: Implement mark conversation as read endpoint
                        // For now, just mark all messages as read locally
                        // await apiClient.patch(`/communication/conversations/${conversationId}/read`);

                        // Mark all messages in conversation as read
                        const messages = get().messages[conversationId] || [];
                        messages.forEach((message) => {
                            if (message.status !== 'read') {
                                get().updateMessage(message._id, { status: 'read' });
                            }
                        });
                    } catch (error) {
                        console.error('Failed to mark conversation as read:', error);
                    }
                },

                editMessage: async (messageId, newContent, reason = 'Message edited') => {
                    const { setLoading, setError } = get();
                    setLoading('editMessage', true);
                    setError('editMessage', null);

                    try {
                        const result = (await apiClient.put(`/communication/messages/${messageId}`, { content: newContent, reason })).data;
                        get().updateMessage(messageId, result.data);

                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('editMessage', errorMessage);
                        return false;
                    } finally {
                        setLoading('editMessage', false);
                    }
                },

                addReaction: async (messageId, emoji) => {
                    try {
                        await apiClient.post(`/communication/messages/${messageId}/reactions`, { emoji });

                        // Optimistically update the UI
                        const currentMessages = get().messages;
                        Object.keys(currentMessages).forEach((conversationId) => {
                            const messageIndex = currentMessages[conversationId].findIndex(m => m._id === messageId);
                            if (messageIndex !== -1) {
                                const message = currentMessages[conversationId][messageIndex];
                                const existingReactionIndex = message.reactions.findIndex(
                                    r => r.emoji === emoji && r.userId === localStorage.getItem('userId')
                                );

                                if (existingReactionIndex === -1) {
                                    message.reactions.push({
                                        userId: localStorage.getItem('userId') || '',
                                        emoji,
                                        createdAt: new Date().toISOString(),
                                    });
                                    get().updateMessage(messageId, { reactions: message.reactions });
                                }
                            }
                        });

                        return true;
                    } catch (error) {
                        console.error('Failed to add reaction:', error);
                        return false;
                    }
                },

                removeReaction: async (messageId, emoji) => {
                    try {
                        await apiClient.delete(`/communication/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);

                        // Optimistically update the UI
                        const currentMessages = get().messages;
                        Object.keys(currentMessages).forEach((conversationId) => {
                            const messageIndex = currentMessages[conversationId].findIndex(m => m._id === messageId);
                            if (messageIndex !== -1) {
                                const message = currentMessages[conversationId][messageIndex];
                                message.reactions = message.reactions.filter(
                                    r => !(r.emoji === emoji && r.userId === localStorage.getItem('userId'))
                                );
                                get().updateMessage(messageId, { reactions: message.reactions });
                            }
                        });

                        return true;
                    } catch (error) {
                        console.error('Failed to remove reaction:', error);
                        return false;
                    }
                },

                getRecentMessages: (limit = 10) => {
                    const { messages } = get();
                    const allMessages: Message[] = [];

                    // Collect all messages from all conversations
                    Object.values(messages).forEach((conversationMessages) => {
                        allMessages.push(...conversationMessages);
                    });

                    // Sort by creation date (most recent first) and limit
                    return allMessages
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, limit);
                },

                // Threading Actions
                createThread: async (messageId) => {
                    const { setLoading, setError } = get();
                    setLoading('createThread', true);
                    setError('createThread', null);

                    try {
                        const result = (await apiClient.post(`/communication/messages/${messageId}/thread`)).data;
                        const threadId = result.data.threadId;

                        // Update the message to include threadId
                        get().updateMessage(messageId, { threadId });

                        return threadId;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('createThread', errorMessage);
                        return null;
                    } finally {
                        setLoading('createThread', false);
                    }
                },

                fetchThreadMessages: async (threadId) => {
                    const { setLoading, setError } = get();
                    setLoading('fetchThreadMessages', true);
                    setError('fetchThreadMessages', null);

                    try {
                        const result = (await apiClient.get(`/communication/threads/${threadId}/messages`)).data;
                        return result.data;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('fetchThreadMessages', errorMessage);
                        return null;
                    } finally {
                        setLoading('fetchThreadMessages', false);
                    }
                },

                fetchThreadSummary: async (threadId) => {
                    const { setLoading, setError } = get();
                    setLoading('fetchThreadSummary', true);
                    setError('fetchThreadSummary', null);

                    try {
                        const result = (await apiClient.get(`/communication/threads/${threadId}/summary`)).data;
                        return result.data;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('fetchThreadSummary', errorMessage);
                        return null;
                    } finally {
                        setLoading('fetchThreadSummary', false);
                    }
                },

                replyToThread: async (threadId, content, attachments, mentions) => {
                    const { setLoading, setError } = get();
                    setLoading('replyToThread', true);
                    setError('replyToThread', null);

                    try {
                        const formData = new FormData();
                        formData.append('content', JSON.stringify({
                            text: content,
                            type: 'text',
                        }));

                        if (mentions) {
                            formData.append('mentions', JSON.stringify(mentions));
                        }

                        // Add file attachments
                        if (attachments) {
                            attachments.forEach((file) => {
                                formData.append('attachments', file);
                            });
                        }

                        const result = (await apiClient.post(`/communication/threads/${threadId}/reply`, formData)).data;
                        const newMessage = result.data;

                        // Add message to conversation
                        get().addMessage(newMessage.conversationId, newMessage);

                        return newMessage;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('replyToThread', errorMessage);
                        return null;
                    } finally {
                        setLoading('replyToThread', false);
                    }
                },

                getConversationThreads: async (conversationId) => {
                    const { setLoading, setError } = get();
                    setLoading('getConversationThreads', true);
                    setError('getConversationThreads', null);

                    try {
                        const result = (await apiClient.get(`/communication/conversations/${conversationId}/threads`)).data;
                        return result.data;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('getConversationThreads', errorMessage);
                        return [];
                    } finally {
                        setLoading('getConversationThreads', false);
                    }
                },

                // Real-time Update Actions
                setTypingUsers: (conversationId, userIds) => {
                    set((state) => ({
                        typingUsers: {
                            ...state.typingUsers,
                            [conversationId]: userIds,
                        },
                    }));
                },

                addTypingUser: (conversationId, userId) => {
                    set((state) => {
                        const currentTyping = state.typingUsers[conversationId] || [];
                        if (currentTyping.includes(userId)) {
                            return state;
                        }

                        return {
                            typingUsers: {
                                ...state.typingUsers,
                                [conversationId]: [...currentTyping, userId],
                            },
                        };
                    });
                },

                removeTypingUser: (conversationId, userId) => {
                    set((state) => {
                        const currentTyping = state.typingUsers[conversationId] || [];

                        return {
                            typingUsers: {
                                ...state.typingUsers,
                                [conversationId]: currentTyping.filter(id => id !== userId),
                            },
                        };
                    });
                },

                handleSocketMessage: (message) => {
                    get().addMessage(message.conversationId, message);

                    // Update conversation's lastMessageAt
                    get().updateConversation(message.conversationId, {
                        lastMessageAt: message.createdAt,
                    });
                },

                handleSocketConversationUpdate: (conversation) => {
                    get().updateConversation(conversation._id, conversation);
                },

                handleSocketUserTyping: (conversationId, userId) => {
                    get().addTypingUser(conversationId, userId);
                },

                handleSocketUserStoppedTyping: (conversationId, userId) => {
                    get().removeTypingUser(conversationId, userId);
                },

                // Notification Management Actions
                addNotification: (notification) => {
                    set((state) => ({
                        notifications: [notification, ...state.notifications],
                        unreadCount: notification.status === 'unread'
                            ? state.unreadCount + 1
                            : state.unreadCount,
                    }));
                },

                markNotificationAsRead: (notificationId) => {
                    set((state) => {
                        const notification = state.notifications.find(n => n._id === notificationId);
                        const wasUnread = notification && notification.status === 'unread';

                        return {
                            notifications: state.notifications.map((n) =>
                                n._id === notificationId ? { ...n, status: 'read' as const } : n
                            ),
                            unreadCount: wasUnread
                                ? Math.max(0, state.unreadCount - 1)
                                : state.unreadCount,
                        };
                    });
                },

                markAllNotificationsAsRead: () => {
                    set((state) => ({
                        notifications: state.notifications.map((n) => ({ ...n, status: 'read' as const })),
                        unreadCount: 0,
                    }));
                },

                removeNotification: (notificationId) => {
                    set((state) => {
                        const notification = state.notifications.find(n => n._id === notificationId);
                        const wasUnread = notification && notification.status === 'unread';

                        return {
                            notifications: state.notifications.filter((n) => n._id !== notificationId),
                            unreadCount: wasUnread
                                ? Math.max(0, state.unreadCount - 1)
                                : state.unreadCount,
                        };
                    });
                },

                fetchNotifications: async () => {
                    const { setLoading, setError } = get();
                    setLoading('fetchNotifications', true);
                    setError('fetchNotifications', null);

                    try {
                        const response = await fetch('/api/communication/notifications', {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            },
                        });

                        if (!response.ok) {
                            // If notifications endpoint doesn't exist, return empty data
                            if (response.status === 404) {
                                set({
                                    notifications: [],
                                    unreadCount: 0,
                                });
                                return;
                            }

                            try {
                                const errorData = await safeJsonParse(response, true);
                                throw new Error(errorData.message || 'Failed to fetch notifications');
                            } catch (parseError) {
                                throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
                            }
                        }

                        const result = await safeJsonParse(response, true);
                        if (!result.success) {
                            throw new Error(result.message || 'Failed to fetch notifications');
                        }

                        const notifications = result.data || [];
                        const unreadCount = notifications.filter((n: CommunicationNotification) => n.status === 'unread').length;

                        set({
                            notifications,
                            unreadCount,
                        });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                        setError('fetchNotifications', errorMessage);
                    } finally {
                        setLoading('fetchNotifications', false);
                    }
                },

                // Search and Filter Actions
                setConversationFilters: (filters) => {
                    set((state) => ({
                        conversationFilters: { ...state.conversationFilters, ...filters },
                    }));
                },

                setMessageFilters: (conversationId, filters) => {
                    set((state) => ({
                        messageFilters: {
                            ...state.messageFilters,
                            [conversationId]: {
                                ...state.messageFilters[conversationId],
                                ...filters,
                            },
                        },
                    }));
                },

                clearConversationFilters: () => {
                    set({
                        conversationFilters: {
                            search: '',
                            sortBy: 'lastMessageAt',
                            sortOrder: 'desc',
                            page: 1,
                            limit: 20,
                        },
                    });
                },

                clearMessageFilters: (conversationId) => {
                    set((state) => ({
                        messageFilters: {
                            ...state.messageFilters,
                            [conversationId]: {
                                sortBy: 'createdAt',
                                sortOrder: 'desc',
                                page: 1,
                                limit: 50,
                            },
                        },
                    }));
                },

                searchConversations: (searchTerm) => {
                    get().setConversationFilters({ search: searchTerm, page: 1 });
                    get().fetchConversations();
                },

                searchMessages: (conversationId, searchTerm) => {
                    get().setMessageFilters(conversationId, { search: searchTerm, page: 1 });
                    get().fetchMessages(conversationId);
                },

                // UI State Actions
                setSidebarOpen: (open) => set({ sidebarOpen: open }),
                setSelectedThread: (threadId) => set({ selectedThread: threadId }),
                setSearchQuery: (query) => set({ searchQuery: query }),

                // Utility Actions
                clearErrors: () => set({ errors: {} }),

                setLoading: (key, loading) =>
                    set((state) => ({
                        loading: { ...state.loading, [key]: loading },
                    })),

                setError: (key, error) =>
                    set((state) => ({
                        errors: { ...state.errors, [key]: error },
                    })),

                resetStore: () => {
                    set({
                        conversations: [],
                        activeConversation: null,
                        conversationLoading: false,
                        messages: {},
                        messageLoading: false,
                        typingUsers: {},
                        notifications: [],
                        unreadCount: 0,
                        sidebarOpen: true,
                        selectedThread: null,
                        searchQuery: '',
                        conversationFilters: {
                            search: '',
                            sortBy: 'lastMessageAt',
                            sortOrder: 'desc',
                            page: 1,
                            limit: 20,
                        },
                        messageFilters: {},
                        conversationPagination: {
                            page: 1,
                            limit: 20,
                            total: 0,
                            pages: 0,
                        },
                        messagePagination: {},
                        loading: {},
                        errors: {},
                    });
                },

                // Optimistic Update Actions
                optimisticSendMessage: (conversationId, tempMessage) => {
                    const tempId = `temp_${Date.now()}_${Math.random()}`;
                    const optimisticMessage: Message = {
                        _id: tempId,
                        conversationId,
                        senderId: tempMessage.senderId || '',
                        content: tempMessage.content || { type: 'text', text: '' },
                        mentions: tempMessage.mentions || [],
                        reactions: [],
                        status: 'sent',
                        priority: tempMessage.priority || 'normal',
                        readBy: [],
                        editHistory: [],
                        isDeleted: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        threadId: tempMessage.threadId,
                        parentMessageId: tempMessage.parentMessageId,
                    };

                    get().addMessage(conversationId, optimisticMessage);
                    return tempId;
                },

                confirmOptimisticMessage: (tempId, confirmedMessage) => {
                    set((state) => {
                        const newMessages = { ...state.messages };

                        Object.keys(newMessages).forEach((conversationId) => {
                            newMessages[conversationId] = newMessages[conversationId].map((message) =>
                                message._id === tempId ? confirmedMessage : message
                            );
                        });

                        return { messages: newMessages };
                    });
                },

                rejectOptimisticMessage: (tempId, error) => {
                    // Mark the optimistic message as failed
                    get().updateMessage(tempId, { status: 'failed' });
                    get().setError('sendMessage', error);
                },

                // File Management Actions
                uploadFiles: async (conversationId, files) => {
                    const { setLoading, setError } = get();
                    setLoading('uploadFiles', true);
                    setError('uploadFiles', null);

                    try {
                        const formData = new FormData();
                        formData.append('conversationId', conversationId);

                        files.forEach((file) => {
                            formData.append('files', file);
                        });

                        const response = await fetch('/api/communication/upload', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            },
                            body: formData,
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || errorData.error || 'Upload failed');
                        }

                        const result = await response.json();
                        if (!result.success) {
                            throw new Error(result.message || 'Upload failed');
                        }

                        return result.data || [];
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'File upload failed';
                        setError('uploadFiles', errorMessage);
                        throw error;
                    } finally {
                        setLoading('uploadFiles', false);
                    }
                },

                downloadFile: async (fileId) => {
                    const { setLoading, setError } = get();
                    setLoading('downloadFile', true);
                    setError('downloadFile', null);

                    try {
                        const { data: result } = await apiClient.get(`/communication/files/${fileId}`);
                        if (!result.success) {
                            throw new Error(result.message || 'Download failed');
                        }

                        // Create download link
                        const link = document.createElement('a');
                        link.href = result.data.downloadUrl || result.data.url;
                        link.download = result.data.fileName || result.data.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'File download failed';
                        setError('downloadFile', errorMessage);
                        throw error;
                    } finally {
                        setLoading('downloadFile', false);
                    }
                },

                deleteFile: async (fileId) => {
                    const { setLoading, setError } = get();
                    setLoading('deleteFile', true);
                    setError('deleteFile', null);

                    try {
                        await apiClient.delete(`/communication/files/${fileId}`);
                        return true;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'File deletion failed';
                        setError('deleteFile', errorMessage);
                        return false;
                    } finally {
                        setLoading('deleteFile', false);
                    }
                },

                getFileMetadata: async (fileId) => {
                    const { setLoading, setError } = get();
                    setLoading('getFileMetadata', true);
                    setError('getFileMetadata', null);

                    try {
                        const { data: result } = await apiClient.get(`/communication/files/${fileId}/metadata`);
                        return result.file;
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Failed to get file metadata';
                        setError('getFileMetadata', errorMessage);
                        throw error;
                    } finally {
                        setLoading('getFileMetadata', false);
                    }
                },

                listConversationFiles: async (conversationId, filters: Record<string, any> = {}) => {
                    const { setLoading, setError } = get();
                    setLoading('listConversationFiles', true);
                    setError('listConversationFiles', null);

                    try {
                        const queryParams = new URLSearchParams();
                        Object.entries(filters as Record<string, any>).forEach(([key, value]) => {
                            if (value !== undefined && value !== null && value !== '') {
                                queryParams.append(key, value.toString());
                            }
                        });

                        const { data: result } = await apiClient.get(`/communication/conversations/${conversationId}/files?${queryParams}`);
                        if (!result.success) {
                            throw new Error(result.message || 'Failed to list files');
                        }

                        return result.data || [];
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Failed to list conversation files';
                        setError('listConversationFiles', errorMessage);
                        return [];
                    } finally {
                        setLoading('listConversationFiles', false);
                    }
                },
            }),
            {
                name: 'communication-store',
                partialize: (state) => ({
                    // Only persist UI state and filters, not data
                    sidebarOpen: state.sidebarOpen,
                    conversationFilters: state.conversationFilters,
                    searchQuery: state.searchQuery,
                }),
            }
        )
    )
);

// Utility hooks for easier access to specific communication states

// Conversation hooks
export const useConversations = () =>
    useCommunicationStore((state) => ({
        conversations: state.conversations,
        loading: state.loading.fetchConversations || false,
        error: state.errors.fetchConversations || null,
        pagination: state.conversationPagination,
        filters: state.conversationFilters,
        fetchConversations: state.fetchConversations,
        setFilters: state.setConversationFilters,
        clearFilters: state.clearConversationFilters,
        searchConversations: state.searchConversations,
    }));

export const useActiveConversation = () =>
    useCommunicationStore((state) => ({
        activeConversation: state.activeConversation,
        setActiveConversation: state.setActiveConversation,
        loading: state.conversationLoading,
        updateConversation: state.updateConversation,
        archiveConversation: state.archiveConversation,
        resolveConversation: state.resolveConversation,
    }));

export const useConversationActions = () =>
    useCommunicationStore((state) => ({
        createConversation: state.createConversation,
        deleteConversation: state.deleteConversation,
        addParticipant: state.addParticipant,
        removeParticipant: state.removeParticipant,
        loading: {
            create: state.loading.createConversation || false,
            delete: state.loading.deleteConversation || false,
            addParticipant: state.loading.addParticipant || false,
            removeParticipant: state.loading.removeParticipant || false,
        },
        errors: {
            create: state.errors.createConversation || null,
            delete: state.errors.deleteConversation || null,
            addParticipant: state.errors.addParticipant || null,
            removeParticipant: state.errors.removeParticipant || null,
        },
    }));

// Message hooks
export const useMessages = (conversationId?: string) =>
    useCommunicationStore((state) => ({
        messages: conversationId ? state.messages[conversationId] || [] : [],
        loading: state.loading.fetchMessages || false,
        error: state.errors.fetchMessages || null,
        pagination: conversationId ? state.messagePagination[conversationId] : undefined,
        filters: conversationId ? state.messageFilters[conversationId] : undefined,
        fetchMessages: state.fetchMessages,
        loadMoreMessages: state.loadMoreMessages,
        setFilters: (filters: Partial<MessageFilters>) =>
            conversationId ? state.setMessageFilters(conversationId, filters) : undefined,
        clearFilters: () =>
            conversationId ? state.clearMessageFilters(conversationId) : undefined,
        searchMessages: (searchTerm: string) =>
            conversationId ? state.searchMessages(conversationId, searchTerm) : undefined,
    }));

export const useMessageActions = () =>
    useCommunicationStore((state) => ({
        sendMessage: state.sendMessage,
        deleteMessage: state.deleteMessage,
        editMessage: state.editMessage,
        markMessageAsRead: state.markMessageAsRead,
        markConversationAsRead: state.markConversationAsRead,
        addReaction: state.addReaction,
        removeReaction: state.removeReaction,
        optimisticSendMessage: state.optimisticSendMessage,
        confirmOptimisticMessage: state.confirmOptimisticMessage,
        rejectOptimisticMessage: state.rejectOptimisticMessage,
        loading: {
            send: state.loading.sendMessage || false,
            delete: state.loading.deleteMessage || false,
            edit: state.loading.editMessage || false,
        },
        errors: {
            send: state.errors.sendMessage || null,
            delete: state.errors.deleteMessage || null,
            edit: state.errors.editMessage || null,
        },
    }));

// Real-time hooks
export const useRealTimeUpdates = () =>
    useCommunicationStore((state) => ({
        typingUsers: state.typingUsers,
        setTypingUsers: state.setTypingUsers,
        addTypingUser: state.addTypingUser,
        removeTypingUser: state.removeTypingUser,
        handleSocketMessage: state.handleSocketMessage,
        handleSocketConversationUpdate: state.handleSocketConversationUpdate,
        handleSocketUserTyping: state.handleSocketUserTyping,
        handleSocketUserStoppedTyping: state.handleSocketUserStoppedTyping,
    }));

// Notification hooks
export const useNotifications = () =>
    useCommunicationStore((state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        loading: state.loading.fetchNotifications || false,
        error: state.errors.fetchNotifications || null,
        fetchNotifications: state.fetchNotifications,
        addNotification: state.addNotification,
        markNotificationAsRead: state.markNotificationAsRead,
        markAllNotificationsAsRead: state.markAllNotificationsAsRead,
        removeNotification: state.removeNotification,
    }));

// UI state hooks
export const useCommunicationUI = () =>
    useCommunicationStore((state) => ({
        sidebarOpen: state.sidebarOpen,
        selectedThread: state.selectedThread,
        searchQuery: state.searchQuery,
        setSidebarOpen: state.setSidebarOpen,
        setSelectedThread: state.setSelectedThread,
        setSearchQuery: state.setSearchQuery,
    }));

// Utility hooks
export const useCommunicationUtils = () =>
    useCommunicationStore((state) => ({
        clearErrors: state.clearErrors,
        resetStore: state.resetStore,
        setLoading: state.setLoading,
        setError: state.setError,
        loading: state.loading,
        errors: state.errors,
    }));

// Selector hooks for performance optimization
export const useConversationById = (conversationId: string) =>
    useCommunicationStore((state) =>
        state.conversations.find(conv => conv._id === conversationId)
    );

export const useMessageById = (messageId: string) =>
    useCommunicationStore((state) => {
        for (const messages of Object.values(state.messages)) {
            const message = messages.find(msg => msg._id === messageId);
            if (message) return message;
        }
        return undefined;
    });

export const useUnreadConversationsCount = () =>
    useCommunicationStore((state) => {
        // Calculate unread conversations based on messages
        let unreadCount = 0;
        state.conversations.forEach(conv => {
            const messages = state.messages[conv._id] || [];
            const hasUnreadMessages = messages.some(msg => msg.status !== 'read');
            if (hasUnreadMessages) unreadCount++;
        });
        return unreadCount;
    });

export const useTypingUsersForConversation = (conversationId: string) =>
    useCommunicationStore((state) => state.typingUsers[conversationId] || []);

// File management hooks
export const useFileUpload = () =>
    useCommunicationStore((state) => ({
        uploadFiles: state.uploadFiles,
        loading: state.loading.uploadFiles || false,
        error: state.errors.uploadFiles || null,
    }));

export const useFileActions = () =>
    useCommunicationStore((state) => ({
        downloadFile: state.downloadFile,
        deleteFile: state.deleteFile,
        getFileMetadata: state.getFileMetadata,
        listConversationFiles: state.listConversationFiles,
        loading: {
            download: state.loading.downloadFile || false,
            delete: state.loading.deleteFile || false,
            metadata: state.loading.getFileMetadata || false,
            list: state.loading.listConversationFiles || false,
        },
        errors: {
            download: state.errors.downloadFile || null,
            delete: state.errors.deleteFile || null,
            metadata: state.errors.getFileMetadata || null,
            list: state.errors.listConversationFiles || null,
        },
    }));