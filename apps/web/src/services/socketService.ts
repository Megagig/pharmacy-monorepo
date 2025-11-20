import { io, Socket } from 'socket.io-client';
import { Message, Conversation, CommunicationNotification } from '../stores/types';

// Socket event types for type safety
interface ServerToClientEvents {
    message_received: (message: Message) => void;
    message_updated: (message: Message) => void;
    user_typing: (data: { userId: string; conversationId: string }) => void;
    user_stopped_typing: (data: { userId: string; conversationId: string }) => void;
    notification_received: (notification: CommunicationNotification) => void;
    conversation_updated: (conversation: Conversation) => void;
    participant_joined: (data: { userId: string; conversationId: string }) => void;
    participant_left: (data: { userId: string; conversationId: string }) => void;
    error_notification: (data: { type: string; message: string; retry?: boolean }) => void;
    connect: () => void;
    disconnect: (reason: string) => void;
    reconnect: (attemptNumber: number) => void;
    reconnect_error: (error: Error) => void;
    connect_error: (error: Error) => void;
}

interface ClientToServerEvents {
    join_conversation: (conversationId: string) => void;
    leave_conversation: (conversationId: string) => void;
    send_message: (messageData: SendMessageSocketData) => void;
    typing_start: (conversationId: string) => void;
    typing_stop: (conversationId: string) => void;
    mark_read: (messageId: string) => void;
}

interface SendMessageSocketData {
    conversationId: string;
    content: {
        text?: string;
        type: 'text' | 'file' | 'image' | 'clinical_note' | 'system';
    };
    threadId?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: 'normal' | 'urgent';
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface SocketServiceConfig {
    url?: string;
    autoConnect?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    timeout?: number;
}

export interface SocketEventHandlers {
    onMessageReceived?: (message: Message) => void;
    onMessageUpdated?: (message: Message) => void;
    onUserTyping?: (conversationId: string, userId: string) => void;
    onUserStoppedTyping?: (conversationId: string, userId: string) => void;
    onNotificationReceived?: (notification: CommunicationNotification) => void;
    onConversationUpdated?: (conversation: Conversation) => void;
    onParticipantJoined?: (conversationId: string, userId: string) => void;
    onParticipantLeft?: (conversationId: string, userId: string) => void;
    onConnectionStatusChange?: (status: ConnectionStatus) => void;
    onError?: (error: string) => void;
}

class SocketService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    private connectionStatus: ConnectionStatus = 'disconnected';
    private eventHandlers: SocketEventHandlers = {};
    private joinedConversations: Set<string> = new Set();
    private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isManualDisconnect = false;
    private missedMessagesQueue: Message[] = [];

    constructor(private config: SocketServiceConfig = {}) {
        this.maxReconnectAttempts = config.reconnectionAttempts || 5;
        this.reconnectDelay = config.reconnectionDelay || 1000;
    }

    /**
     * Initialize socket connection with cookie-based authentication
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Prefer Vite env var when available; fallback to same-origin path or localhost
                const envUrl = import.meta.env.VITE_SOCKET_URL;
                const socketUrl = this.config.url || envUrl || `${window.location.origin.replace(/:\\d+$/, ':5000')}`;

                this.socket = io(socketUrl, {
                    withCredentials: true, // Include httpOnly cookies for authentication
                    autoConnect: this.config.autoConnect !== false,
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: this.reconnectDelay,
                    timeout: this.config.timeout || 20000,
                    transports: ['websocket', 'polling'],
                });

                this.setupEventListeners();
                this.isManualDisconnect = false;

                // Handle initial connection
                this.socket.on('connect', () => {
                    this.setConnectionStatus('connected');
                    this.reconnectAttempts = 0;
                    this.rejoinConversations();
                    this.processMissedMessages();
                    resolve();
                });

                // Handle connection errors
                this.socket.on('connect_error', (error) => {
                    this.setConnectionStatus('error');
                    this.eventHandlers.onError?.(error.message);
                    reject(error);
                });

                // Start connection if autoConnect is enabled
                if (this.config.autoConnect !== false) {
                    this.setConnectionStatus('connecting');
                    this.socket.connect();
                }
            } catch (error) {
                this.setConnectionStatus('error');
                reject(error);
            }
        });
    }

    /**
     * Disconnect socket connection
     */
    disconnect(): void {
        this.isManualDisconnect = true;
        this.clearTypingTimeouts();
        this.joinedConversations.clear();

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.setConnectionStatus('disconnected');
    }

    /**
     * Set up all socket event listeners
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            this.setConnectionStatus('connected');
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            this.setConnectionStatus('disconnected');

            // Don't attempt reconnection if it was manual
            if (!this.isManualDisconnect && reason === 'io server disconnect') {
                this.attemptReconnection();
            }
        });

        this.socket.on('reconnect', () => {
            this.setConnectionStatus('connected');
            this.reconnectAttempts = 0;
            this.rejoinConversations();
            this.processMissedMessages();
        });

        this.socket.on('reconnect_error', (error) => {
            this.setConnectionStatus('error');
            this.eventHandlers.onError?.(error.message);
        });

        // Message events
        this.socket.on('message_received', (message) => {
            this.eventHandlers.onMessageReceived?.(message);
        });

        this.socket.on('message_updated', (message) => {
            this.eventHandlers.onMessageUpdated?.(message);
        });

        // Typing events
        this.socket.on('user_typing', ({ userId, conversationId }) => {
            this.eventHandlers.onUserTyping?.(conversationId, userId);
        });

        this.socket.on('user_stopped_typing', ({ userId, conversationId }) => {
            this.eventHandlers.onUserStoppedTyping?.(conversationId, userId);
        });

        // Notification events
        this.socket.on('notification_received', (notification) => {
            this.eventHandlers.onNotificationReceived?.(notification);
        });

        // Conversation events
        this.socket.on('conversation_updated', (conversation) => {
            this.eventHandlers.onConversationUpdated?.(conversation);
        });

        this.socket.on('participant_joined', ({ userId, conversationId }) => {
            this.eventHandlers.onParticipantJoined?.(conversationId, userId);
        });

        this.socket.on('participant_left', ({ userId, conversationId }) => {
            this.eventHandlers.onParticipantLeft?.(conversationId, userId);
        });

        // Error events
        this.socket.on('error_notification', ({ type, message, retry }) => {
            this.eventHandlers.onError?.(message);

            if (retry && type === 'connection_error') {
                this.attemptReconnection();
            }
        });
    }

    /**
     * Set event handlers for socket events
     */
    setEventHandlers(handlers: SocketEventHandlers): void {
        this.eventHandlers = { ...this.eventHandlers, ...handlers };
    }

    /**
     * Join a conversation room
     */
    joinConversation(conversationId: string): void {
        if (!this.socket || !this.isConnected()) {
            console.warn('Socket not connected, queuing conversation join');
            this.joinedConversations.add(conversationId);
            return;
        }

        this.socket.emit('join_conversation', conversationId);
        this.joinedConversations.add(conversationId);
    }

    /**
     * Leave a conversation room
     */
    leaveConversation(conversationId: string): void {
        if (!this.socket || !this.isConnected()) {
            this.joinedConversations.delete(conversationId);
            return;
        }

        this.socket.emit('leave_conversation', conversationId);
        this.joinedConversations.delete(conversationId);
    }

    /**
     * Send a message through socket
     */
    sendMessage(messageData: SendMessageSocketData): void {
        if (!this.socket || !this.isConnected()) {
            this.eventHandlers.onError?.('Cannot send message: Socket not connected');
            return;
        }

        this.socket.emit('send_message', messageData);
    }

    /**
     * Start typing indicator
     */
    startTyping(conversationId: string): void {
        if (!this.socket || !this.isConnected()) return;

        this.socket.emit('typing_start', conversationId);

        // Clear existing timeout
        const existingTimeout = this.typingTimeouts.get(conversationId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set timeout to stop typing after 3 seconds of inactivity
        const timeout = setTimeout(() => {
            this.stopTyping(conversationId);
        }, 3000);

        this.typingTimeouts.set(conversationId, timeout);
    }

    /**
     * Stop typing indicator
     */
    stopTyping(conversationId: string): void {
        if (!this.socket || !this.isConnected()) return;

        this.socket.emit('typing_stop', conversationId);

        const timeout = this.typingTimeouts.get(conversationId);
        if (timeout) {
            clearTimeout(timeout);
            this.typingTimeouts.delete(conversationId);
        }
    }

    /**
     * Mark message as read
     */
    markMessageAsRead(messageId: string): void {
        if (!this.socket || !this.isConnected()) return;

        this.socket.emit('mark_read', messageId);
    }

    /**
     * Get current connection status
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    /**
     * Check if socket is connected
     */
    isConnected(): boolean {
        return this.socket?.connected === true;
    }

    /**
     * Get socket instance (for advanced usage)
     */
    getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
        return this.socket;
    }

    /**
     * Private helper methods
     */
    private setConnectionStatus(status: ConnectionStatus): void {
        if (this.connectionStatus !== status) {
            this.connectionStatus = status;
            this.eventHandlers.onConnectionStatusChange?.(status);
        }
    }

    private async checkAuthentication(): Promise<boolean> {
        // Check if user is authenticated by making a request to auth endpoint
        try {
            const { authService } = await import('./authService');
            const response = await authService.getCurrentUser();
            return response.success && !!response.user;
        } catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
    }

    private attemptReconnection(): void {
        if (this.isManualDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        this.reconnectAttempts++;
        this.setConnectionStatus('reconnecting');

        setTimeout(() => {
            if (this.socket && !this.socket.connected) {
                this.socket.connect();
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    private rejoinConversations(): void {
        // Rejoin all previously joined conversations after reconnection
        this.joinedConversations.forEach(conversationId => {
            if (this.socket && this.isConnected()) {
                this.socket.emit('join_conversation', conversationId);
            }
        });
    }

    private processMissedMessages(): void {
        // Process any messages that were queued while disconnected
        if (this.missedMessagesQueue.length > 0) {
            this.missedMessagesQueue.forEach(message => {
                this.eventHandlers.onMessageReceived?.(message);
            });
            this.missedMessagesQueue = [];
        }
    }

    private clearTypingTimeouts(): void {
        this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
        this.typingTimeouts.clear();
    }

    /**
     * Utility methods for debugging and monitoring
     */
    getConnectionInfo(): {
        status: ConnectionStatus;
        reconnectAttempts: number;
        joinedConversations: string[];
        socketId?: string;
    } {
        return {
            status: this.connectionStatus,
            reconnectAttempts: this.reconnectAttempts,
            joinedConversations: Array.from(this.joinedConversations),
            socketId: this.socket?.id,
        };
    }

    /**
     * Force reconnection (useful for testing or manual recovery)
     */
    forceReconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket.connect();
        }
    }

    /**
     * Refresh authentication (useful when cookies are updated)
     */
    async refreshAuthentication(): Promise<void> {
        const isAuth = await this.checkAuthentication();
        if (!isAuth && this.isConnected()) {
            // If no longer authenticated, disconnect
            this.disconnect();
        } else if (isAuth && !this.isConnected()) {
            // If authenticated but not connected, try to connect
            await this.connect();
        }
    }
}

// Create singleton instance
export const socketService = new SocketService();

// Export types via declarations above (avoid duplicate export conflicts)