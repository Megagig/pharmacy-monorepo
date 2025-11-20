import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import User from '../models/User';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { notificationService } from './notificationService';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    workplaceId?: string;
    role?: string;
}

interface SocketUserData {
    userId: string;
    workplaceId: string;
    role: string;
    email: string;
    firstName: string;
    lastName: string;
}

interface TypingUser {
    userId: string;
    userData: SocketUserData;
    timestamp: Date;
}

interface SendMessageData {
    conversationId: string;
    content: {
        text?: string;
        type: 'text' | 'file' | 'image' | 'clinical_note' | 'voice_note';
        attachments?: any[];
    };
    threadId?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: 'normal' | 'high' | 'urgent';
}

interface CreateConversationData {
    title?: string;
    type: 'direct' | 'group' | 'patient_query' | 'clinical_consultation';
    participants: string[];
    patientId?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
}

/**
 * Socket.IO service for real-time communication hub
 */
export class CommunicationSocketService {
    private io: SocketIOServer;
    private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
    private socketUsers: Map<string, SocketUserData> = new Map(); // socketId -> userData
    private conversationRooms: Map<string, Set<string>> = new Map(); // conversationId -> Set of socketIds
    private typingUsers: Map<string, Map<string, TypingUser>> = new Map(); // conversationId -> userId -> TypingUser
    private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // socketId:conversationId -> timeout

    constructor(io: SocketIOServer) {
        this.io = io;
        this.setupSocketHandlers();
        logger.info('Communication Socket service initialized');
    }

    /**
     * Setup Socket.IO event handlers with authentication middleware
     */
    private setupSocketHandlers(): void {
        // Authentication middleware - support both token and cookie auth
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                let user = null;
                logger.info('🔍 [Socket Auth] Attempting authentication for socket:', socket.id);
                
                // Try token-based auth first (for backward compatibility)
                const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.replace('Bearer ', '');

                if (token) {
                    try {
                        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
                        // Handle both old and new token formats
                        const userId = decoded.userId || decoded.id;
                        logger.info('🔍 [Socket Auth] Header token decoded:', {
                            userId: userId,
                            iat: decoded.iat,
                            exp: decoded.exp
                        });
                        user = await User.findById(userId)
                            .select('_id workplaceId role email firstName lastName');
                    } catch (tokenError) {
                        logger.warn('🔍 [Socket Auth] Token authentication failed:', tokenError.message);
                    }
                }

                // If token auth failed, try cookie-based auth
                if (!user) {
                    const cookies = socket.handshake.headers.cookie;
                    logger.info('🔍 [Socket Auth] Checking cookies:', !!cookies);
                    logger.info('🔍 [Socket Auth] All headers:', Object.keys(socket.handshake.headers));
                    logger.info('🔍 [Socket Auth] Cookie header length:', cookies?.length || 0);
                    
                    if (cookies) {
                        // Parse cookies to find auth token
                        const cookieObj: Record<string, string> = {};
                        cookies.split(';').forEach(cookie => {
                            const [name, value] = cookie.trim().split('=');
                            if (name && value) {
                                try {
                                    cookieObj[name] = decodeURIComponent(value);
                                } catch (e) {
                                    // If decoding fails, use raw value
                                    cookieObj[name] = value;
                                }
                            }
                        });

                        logger.info('🔍 [Socket Auth] Parsed cookies:', Object.keys(cookieObj));
                        logger.info('🔍 [Socket Auth] Cookie values:', {
                            hasAccessToken: !!cookieObj['accessToken'],
                            hasToken: !!cookieObj['token'],
                            accessTokenLength: cookieObj['accessToken']?.length || 0,
                            tokenLength: cookieObj['token']?.length || 0
                        });
                        
                        // Look for auth token in cookies (try multiple cookie names for compatibility)
                        const authToken = cookieObj['accessToken'] || cookieObj['token'];
                        
                        if (authToken) {
                            logger.info('🔍 [Socket Auth] Found auth cookie, verifying...');
                            try {
                                const decoded = jwt.verify(authToken, process.env.JWT_SECRET!) as any;
                                // Handle both old and new token formats
                                const userId = decoded.userId || decoded.id;
                                logger.info('🔍 [Socket Auth] Token decoded successfully:', {
                                    userId: userId,
                                    iat: decoded.iat,
                                    exp: decoded.exp
                                });
                                
                                user = await User.findById(userId)
                                    .select('_id workplaceId role email firstName lastName');
                                if (user) {
                                    logger.info('🔍 [Socket Auth] Cookie auth successful for user:', user.email);
                                } else {
                                    logger.warn('🔍 [Socket Auth] User not found in database for ID:', userId);
                                    // Try to find any user to see if database connection is working
                                    const anyUser = await User.findOne().select('_id email');
                                    logger.info('🔍 [Socket Auth] Database test - found any user:', !!anyUser);
                                }
                            } catch (cookieError) {
                                logger.warn('🔍 [Socket Auth] Cookie authentication failed:', cookieError.message);
                            }
                        } else {
                            logger.warn('🔍 [Socket Auth] No auth cookies found. Available cookies:', Object.keys(cookieObj));
                        }
                    }
                }

                if (!user) {
                    return next(new Error('Authentication required - no valid token or session found'));
                }

                // Attach user data to socket
                socket.userId = user._id.toString();
                socket.workplaceId = user.workplaceId?.toString();
                socket.role = user.role;

                // Store user data
                this.socketUsers.set(socket.id, {
                    userId: user._id.toString(),
                    workplaceId: user.workplaceId?.toString() || '',
                    role: user.role,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                });

                next();
            } catch (error) {
                logger.error('Socket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            this.handleConnection(socket);
        });
    }

    /**
     * Handle new socket connection
     */
    private handleConnection(socket: AuthenticatedSocket): void {
        const userId = socket.userId!;
        const userData = this.socketUsers.get(socket.id)!;

        logger.info(`User ${userData.firstName} ${userData.lastName} connected to communication hub (${socket.id})`);

        // Track user connection
        if (!this.connectedUsers.has(userId)) {
            this.connectedUsers.set(userId, new Set());
        }
        this.connectedUsers.get(userId)!.add(socket.id);

        // Join user-specific room and workplace room
        socket.join(`user:${userId}`);
        socket.join(`workplace:${socket.workplaceId}`);

        // Setup event handlers
        this.setupConversationHandlers(socket);
        this.setupMessageHandlers(socket);
        this.setupTypingHandlers(socket);
        this.setupPresenceHandlers(socket);
        this.setupFileHandlers(socket);

        // Send initial data
        this.sendInitialData(socket);

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
            this.sendErrorToSocket(socket, 'connection_error', 'Connection error occurred');
        });
    }

    /**
     * Handle socket disconnection
     */
    private handleDisconnection(socket: AuthenticatedSocket): void {
        const userId = socket.userId!;
        const userData = this.socketUsers.get(socket.id);

        if (userData) {
            logger.info(`User ${userData.firstName} ${userData.lastName} disconnected from communication hub (${socket.id})`);
        }

        // Clean up typing indicators
        this.cleanupTypingForSocket(socket);

        // Remove from conversation rooms
        this.conversationRooms.forEach((sockets, conversationId) => {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    this.conversationRooms.delete(conversationId);
                }
            }
        });

        // Remove from tracking
        if (this.connectedUsers.has(userId)) {
            this.connectedUsers.get(userId)!.delete(socket.id);
            if (this.connectedUsers.get(userId)!.size === 0) {
                this.connectedUsers.delete(userId);
                // Broadcast user offline status
                this.broadcastUserPresence(userId, false);
            }
        }
        this.socketUsers.delete(socket.id);
    }

    /**
     * Setup conversation-related event handlers
     */
    private setupConversationHandlers(socket: AuthenticatedSocket): void {
        // Join conversation room
        socket.on('conversation:join', async (data: { conversationId: string }) => {
            try {
                const conversation = await Conversation.findById(data.conversationId);

                if (!conversation) {
                    return this.sendErrorToSocket(socket, 'conversation_not_found', 'Conversation not found');
                }

                // Check if user is a participant
                if (!conversation.hasParticipant(socket.userId! as any)) {
                    return this.sendErrorToSocket(socket, 'access_denied', 'Not a participant in this conversation');
                }

                socket.join(`conversation:${data.conversationId}`);

                // Track conversation room
                if (!this.conversationRooms.has(data.conversationId)) {
                    this.conversationRooms.set(data.conversationId, new Set());
                }
                this.conversationRooms.get(data.conversationId)!.add(socket.id);

                // Notify other participants that user joined
                socket.to(`conversation:${data.conversationId}`).emit('conversation:participant_joined', {
                    conversationId: data.conversationId,
                    userId: socket.userId,
                    userData: this.socketUsers.get(socket.id),
                    timestamp: new Date(),
                });

                logger.debug(`User ${socket.userId} joined conversation ${data.conversationId}`);
            } catch (error) {
                logger.error('Error joining conversation:', error);
                this.sendErrorToSocket(socket, 'join_conversation_error', 'Failed to join conversation');
            }
        });

        // Leave conversation room
        socket.on('conversation:leave', (data: { conversationId: string }) => {
            socket.leave(`conversation:${data.conversationId}`);

            // Remove from conversation room tracking
            if (this.conversationRooms.has(data.conversationId)) {
                this.conversationRooms.get(data.conversationId)!.delete(socket.id);
                if (this.conversationRooms.get(data.conversationId)!.size === 0) {
                    this.conversationRooms.delete(data.conversationId);
                }
            }

            // Clean up typing for this conversation
            this.stopTyping(socket, data.conversationId);

            // Notify other participants that user left
            socket.to(`conversation:${data.conversationId}`).emit('conversation:participant_left', {
                conversationId: data.conversationId,
                userId: socket.userId,
                timestamp: new Date(),
            });

            logger.debug(`User ${socket.userId} left conversation ${data.conversationId}`);
        });

        // Create new conversation
        socket.on('conversation:create', async (data: CreateConversationData) => {
            try {
                // Validate participants
                const participants = await User.find({
                    _id: { $in: data.participants },
                    workplaceId: socket.workplaceId,
                }).select('_id role');

                if (participants.length !== data.participants.length) {
                    return this.sendErrorToSocket(socket, 'invalid_participants', 'Some participants not found');
                }

                // Create conversation
                const conversation = new Conversation({
                    title: data.title,
                    type: data.type,
                    participants: participants.map(p => ({
                        userId: p._id,
                        role: p.role,
                        joinedAt: new Date(),
                        permissions: this.getDefaultPermissions(p.role),
                    })),
                    patientId: data.patientId,
                    priority: data.priority || 'normal',
                    tags: data.tags || [],
                    createdBy: socket.userId,
                    workplaceId: socket.workplaceId,
                    metadata: {
                        isEncrypted: true,
                        priority: data.priority || 'normal',
                        tags: data.tags || [],
                    },
                });

                await conversation.save();

                // Notify all participants
                participants.forEach(participant => {
                    this.io.to(`user:${participant._id}`).emit('conversation:created', {
                        conversation: conversation.toObject(),
                        createdBy: this.socketUsers.get(socket.id),
                        timestamp: new Date(),
                    });
                });

                // Send success response to creator
                socket.emit('conversation:create_success', {
                    conversation: conversation.toObject(),
                    timestamp: new Date(),
                });

                logger.info(`Conversation ${conversation._id} created by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error creating conversation:', error);
                this.sendErrorToSocket(socket, 'create_conversation_error', 'Failed to create conversation');
            }
        });

        // Update conversation (title, participants, etc.)
        socket.on('conversation:update', async (data: {
            conversationId: string;
            updates: Partial<CreateConversationData>
        }) => {
            try {
                const conversation = await Conversation.findById(data.conversationId);

                if (!conversation) {
                    return this.sendErrorToSocket(socket, 'conversation_not_found', 'Conversation not found');
                }

                // Check permissions
                const userRole = conversation.getParticipantRole(socket.userId! as any);
                if (!userRole || !['pharmacist', 'doctor'].includes(userRole)) {
                    return this.sendErrorToSocket(socket, 'insufficient_permissions', 'Insufficient permissions to update conversation');
                }

                // Update conversation
                if (data.updates.title) conversation.title = data.updates.title;
                if (data.updates.priority) conversation.priority = data.updates.priority;
                if (data.updates.tags) conversation.tags = data.updates.tags;

                // conversation.updatedBy = socket.userId! as any; // Remove this line as updatedBy doesn't exist
                await conversation.save();

                // Broadcast update to all participants
                this.io.to(`conversation:${data.conversationId}`).emit('conversation:updated', {
                    conversationId: data.conversationId,
                    updates: data.updates,
                    updatedBy: this.socketUsers.get(socket.id),
                    timestamp: new Date(),
                });

                logger.info(`Conversation ${data.conversationId} updated by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error updating conversation:', error);
                this.sendErrorToSocket(socket, 'update_conversation_error', 'Failed to update conversation');
            }
        });
    }

    /**
     * Setup message-related event handlers
     */
    private setupMessageHandlers(socket: AuthenticatedSocket): void {
        // Send message
        socket.on('message:send', async (data: SendMessageData) => {
            try {
                const conversation = await Conversation.findById(data.conversationId);

                if (!conversation) {
                    return this.sendErrorToSocket(socket, 'conversation_not_found', 'Conversation not found');
                }

                // Check if user is a participant
                if (!conversation.hasParticipant(socket.userId! as any)) {
                    return this.sendErrorToSocket(socket, 'access_denied', 'Not a participant in this conversation');
                }

                // Create message
                const message = new Message({
                    conversationId: data.conversationId,
                    senderId: socket.userId,
                    content: data.content,
                    threadId: data.threadId,
                    parentMessageId: data.parentMessageId,
                    mentions: data.mentions || [],
                    priority: data.priority || 'normal',
                    workplaceId: socket.workplaceId,
                    createdBy: socket.userId,
                });

                await message.save();

                // Populate sender data
                await message.populate('senderId', 'firstName lastName role');

                // Update conversation
                conversation.updateLastMessage(message._id);
                conversation.incrementUnreadCount(socket.userId! as any);
                await conversation.save();

                // Broadcast message to conversation participants
                this.io.to(`conversation:${data.conversationId}`).emit('message:received', {
                    message: message.toObject(),
                    conversationId: data.conversationId,
                    timestamp: new Date(),
                });

                // Send notifications for mentions
                if (data.mentions && data.mentions.length > 0) {
                    await this.handleMentionNotifications(data.mentions, message, conversation);
                }

                // Stop typing indicator for sender
                this.stopTyping(socket, data.conversationId);

                logger.debug(`Message sent by user ${socket.userId} in conversation ${data.conversationId}`);
            } catch (error) {
                logger.error('Error sending message:', error);
                this.sendErrorToSocket(socket, 'send_message_error', 'Failed to send message');
            }
        });

        // Mark message as read
        socket.on('message:mark_read', async (data: { messageId: string; conversationId: string }) => {
            try {
                const message = await Message.findById(data.messageId);

                if (!message) {
                    return this.sendErrorToSocket(socket, 'message_not_found', 'Message not found');
                }

                // Mark as read
                message.markAsRead(socket.userId! as any);
                await message.save();

                // Update conversation unread count
                const conversation = await Conversation.findById(data.conversationId);
                if (conversation) {
                    conversation.markAsRead(socket.userId! as any);
                    await conversation.save();
                }

                // Broadcast read receipt to conversation
                socket.to(`conversation:${data.conversationId}`).emit('message:read_receipt', {
                    messageId: data.messageId,
                    userId: socket.userId,
                    userData: this.socketUsers.get(socket.id),
                    readAt: new Date(),
                });

                logger.debug(`Message ${data.messageId} marked as read by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error marking message as read:', error);
                this.sendErrorToSocket(socket, 'mark_read_error', 'Failed to mark message as read');
            }
        });

        // Add reaction to message
        socket.on('message:add_reaction', async (data: { messageId: string; emoji: string; conversationId: string }) => {
            try {
                const message = await Message.findById(data.messageId);

                if (!message) {
                    return this.sendErrorToSocket(socket, 'message_not_found', 'Message not found');
                }

                message.addReaction(socket.userId! as any, data.emoji);
                await message.save();

                // Broadcast reaction to conversation
                this.io.to(`conversation:${data.conversationId}`).emit('message:reaction_added', {
                    messageId: data.messageId,
                    emoji: data.emoji,
                    userId: socket.userId,
                    userData: this.socketUsers.get(socket.id),
                    timestamp: new Date(),
                });

                logger.debug(`Reaction ${data.emoji} added to message ${data.messageId} by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error adding reaction:', error);
                this.sendErrorToSocket(socket, 'add_reaction_error', 'Failed to add reaction');
            }
        });

        // Remove reaction from message
        socket.on('message:remove_reaction', async (data: { messageId: string; emoji: string; conversationId: string }) => {
            try {
                const message = await Message.findById(data.messageId);

                if (!message) {
                    return this.sendErrorToSocket(socket, 'message_not_found', 'Message not found');
                }

                message.removeReaction(socket.userId! as any, data.emoji);
                await message.save();

                // Broadcast reaction removal to conversation
                this.io.to(`conversation:${data.conversationId}`).emit('message:reaction_removed', {
                    messageId: data.messageId,
                    emoji: data.emoji,
                    userId: socket.userId,
                    timestamp: new Date(),
                });

                logger.debug(`Reaction ${data.emoji} removed from message ${data.messageId} by user ${socket.userId}`);
            } catch (error) {
                logger.error('Error removing reaction:', error);
                this.sendErrorToSocket(socket, 'remove_reaction_error', 'Failed to remove reaction');
            }
        });
    }

    /**
     * Setup typing indicator handlers
     */
    private setupTypingHandlers(socket: AuthenticatedSocket): void {
        // Start typing
        socket.on('typing:start', (data: { conversationId: string }) => {
            this.startTyping(socket, data.conversationId);
        });

        // Stop typing
        socket.on('typing:stop', (data: { conversationId: string }) => {
            this.stopTyping(socket, data.conversationId);
        });
    }

    /**
     * Setup presence-related event handlers
     */
    private setupPresenceHandlers(socket: AuthenticatedSocket): void {
        // Broadcast user online status
        this.broadcastUserPresence(socket.userId!, true);

        // Get online users in conversation
        socket.on('presence:get_conversation_users', (data: { conversationId: string }) => {
            const conversationSockets = this.conversationRooms.get(data.conversationId);
            const onlineUsers = conversationSockets ?
                Array.from(conversationSockets).map(socketId => this.socketUsers.get(socketId)).filter(Boolean) : [];

            socket.emit('presence:conversation_users', {
                conversationId: data.conversationId,
                onlineUsers,
                timestamp: new Date(),
            });
        });

        // Update user status
        socket.on('presence:update_status', (data: { status: string }) => {
            const userData = this.socketUsers.get(socket.id);
            if (userData) {
                // Broadcast status update to workplace
                socket.to(`workplace:${socket.workplaceId}`).emit('presence:user_status_changed', {
                    userId: socket.userId,
                    status: data.status,
                    userData,
                    timestamp: new Date(),
                });
            }
        });
    }

    /**
     * Setup file-related event handlers
     */
    private setupFileHandlers(socket: AuthenticatedSocket): void {
        // File upload progress
        socket.on('file:upload_progress', (data: { conversationId: string; fileName: string; progress: number }) => {
            socket.to(`conversation:${data.conversationId}`).emit('file:upload_progress', {
                conversationId: data.conversationId,
                fileName: data.fileName,
                progress: data.progress,
                userId: socket.userId,
                timestamp: new Date(),
            });
        });

        // File upload complete
        socket.on('file:upload_complete', (data: { conversationId: string; fileData: any }) => {
            socket.to(`conversation:${data.conversationId}`).emit('file:upload_complete', {
                conversationId: data.conversationId,
                fileData: data.fileData,
                userId: socket.userId,
                userData: this.socketUsers.get(socket.id),
                timestamp: new Date(),
            });
        });
    }

    /**
     * Start typing indicator
     */
    private startTyping(socket: AuthenticatedSocket, conversationId: string): void {
        const userId = socket.userId!;
        const userData = this.socketUsers.get(socket.id)!;

        // Clear existing timeout
        const timeoutKey = `${socket.id}:${conversationId}`;
        if (this.typingTimeouts.has(timeoutKey)) {
            clearTimeout(this.typingTimeouts.get(timeoutKey)!);
        }

        // Add to typing users
        if (!this.typingUsers.has(conversationId)) {
            this.typingUsers.set(conversationId, new Map());
        }
        this.typingUsers.get(conversationId)!.set(userId, {
            userId,
            userData,
            timestamp: new Date(),
        });

        // Broadcast typing indicator
        socket.to(`conversation:${conversationId}`).emit('typing:user_started', {
            conversationId,
            userId,
            userData,
            timestamp: new Date(),
        });

        // Set timeout to auto-stop typing after 3 seconds
        const timeout = setTimeout(() => {
            this.stopTyping(socket, conversationId);
        }, 3000);

        this.typingTimeouts.set(timeoutKey, timeout);

        logger.debug(`User ${userId} started typing in conversation ${conversationId}`);
    }

    /**
     * Stop typing indicator
     */
    private stopTyping(socket: AuthenticatedSocket, conversationId: string): void {
        const userId = socket.userId!;
        const timeoutKey = `${socket.id}:${conversationId}`;

        // Clear timeout
        if (this.typingTimeouts.has(timeoutKey)) {
            clearTimeout(this.typingTimeouts.get(timeoutKey)!);
            this.typingTimeouts.delete(timeoutKey);
        }

        // Remove from typing users
        if (this.typingUsers.has(conversationId)) {
            this.typingUsers.get(conversationId)!.delete(userId);
            if (this.typingUsers.get(conversationId)!.size === 0) {
                this.typingUsers.delete(conversationId);
            }
        }

        // Broadcast stop typing
        socket.to(`conversation:${conversationId}`).emit('typing:user_stopped', {
            conversationId,
            userId,
            timestamp: new Date(),
        });

        logger.debug(`User ${userId} stopped typing in conversation ${conversationId}`);
    }

    /**
     * Clean up typing indicators for a socket
     */
    private cleanupTypingForSocket(socket: AuthenticatedSocket): void {
        const userId = socket.userId!;

        // Clear all timeouts for this socket
        Array.from(this.typingTimeouts.keys())
            .filter(key => key.startsWith(socket.id))
            .forEach(key => {
                clearTimeout(this.typingTimeouts.get(key)!);
                this.typingTimeouts.delete(key);
            });

        // Remove from all typing users maps
        this.typingUsers.forEach((users, conversationId) => {
            if (users.has(userId)) {
                users.delete(userId);
                // Broadcast stop typing
                socket.to(`conversation:${conversationId}`).emit('typing:user_stopped', {
                    conversationId,
                    userId,
                    timestamp: new Date(),
                });
            }
        });
    }

    /**
     * Send initial data to newly connected user
     */
    private async sendInitialData(socket: AuthenticatedSocket): Promise<void> {
        try {
            // Send user's conversations with unread counts
            const conversations = await Conversation.find({
                workplaceId: socket.workplaceId,
                'participants.userId': socket.userId,
                'participants.leftAt': { $exists: false },
                status: { $ne: 'closed' },
            })
                .populate('participants.userId', 'firstName lastName role')
                .populate('patientId', 'firstName lastName mrn')
                .populate('lastMessageId', 'content.text senderId createdAt')
                .sort({ lastMessageAt: -1 });

            socket.emit('conversations:initial_load', {
                conversations: conversations.map(conv => ({
                    ...conv.toObject(),
                    unreadCount: conv.unreadCount.get(socket.userId!) || 0,
                })),
                timestamp: new Date(),
            });

            logger.debug(`Sent initial data to user ${socket.userId}`);
        } catch (error) {
            logger.error('Error sending initial data:', error);
        }
    }

    /**
     * Handle mention notifications
     */
    private async handleMentionNotifications(
        mentions: string[],
        message: any,
        conversation: any
    ): Promise<void> {
        try {
            // For now, just log the mentions - notification service integration can be added later
            logger.info(`Mentions handled for message ${message._id}: ${mentions.join(', ')}`);
        } catch (error) {
            logger.error('Error handling mention notifications:', error);
        }
    }

    /**
     * Broadcast user presence to workplace
     */
    private broadcastUserPresence(userId: string, isOnline: boolean): void {
        const userData = Array.from(this.socketUsers.values()).find(u => u.userId === userId);

        if (userData) {
            this.io.to(`workplace:${userData.workplaceId}`).emit('presence:user_presence_changed', {
                userId,
                isOnline,
                userData,
                timestamp: new Date(),
            });
        }
    }

    /**
     * Get default permissions based on role
     */
    private getDefaultPermissions(role: string): string[] {
        switch (role) {
            case 'patient':
                return ['read_messages', 'send_messages', 'upload_files'];
            case 'pharmacist':
            case 'doctor':
                return [
                    'read_messages', 'send_messages', 'upload_files',
                    'view_patient_data', 'manage_clinical_context'
                ];
            default:
                return ['read_messages', 'send_messages'];
        }
    }

    /**
     * Send error message to socket
     */
    private sendErrorToSocket(socket: Socket, errorCode: string, message: string): void {
        socket.emit('error', {
            code: errorCode,
            message,
            timestamp: new Date(),
        });
    }

    // Public methods for external use

    /**
     * Send message notification to conversation participants
     */
    public sendMessageNotification(conversationId: string, message: any, excludeUserId?: string): void {
        const notificationData = {
            messageId: message._id,
            conversationId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt,
        };

        if (excludeUserId) {
            this.io.to(`conversation:${conversationId}`)
                .except(`user:${excludeUserId}`)
                .emit('message:received', notificationData);
        } else {
            this.io.to(`conversation:${conversationId}`).emit('message:received', notificationData);
        }
    }

    /**
     * Send conversation update to participants
     */
    public sendConversationUpdate(conversationId: string, updateData: any): void {
        this.io.to(`conversation:${conversationId}`).emit('conversation:updated', {
            conversationId,
            ...updateData,
            timestamp: new Date(),
        });
    }

    /**
     * Get connected users count
     */
    public getConnectedUsersCount(): number {
        return this.connectedUsers.size;
    }

    /**
     * Check if user is connected
     */
    public isUserConnected(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    /**
     * Get all connected users in workplace
     */
    public getWorkplaceConnectedUsers(workplaceId: string): SocketUserData[] {
        return Array.from(this.socketUsers.values())
            .filter(user => user.workplaceId === workplaceId);
    }

    /**
     * Send system announcement to conversation
     */
    public sendConversationAnnouncement(conversationId: string, announcement: any): void {
        this.io.to(`conversation:${conversationId}`).emit('system:announcement', {
            conversationId,
            ...announcement,
            timestamp: new Date(),
        });
    }

    /**
     * Send emergency alert to conversation
     */
    public sendConversationEmergencyAlert(conversationId: string, alert: any): void {
        this.io.to(`conversation:${conversationId}`).emit('system:emergency_alert', {
            conversationId,
            ...alert,
            timestamp: new Date(),
        });
    }
}

export default CommunicationSocketService;