import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../../utils/logger';
import User from '../../models/User';
import { getPresenceModel } from '../../models/chat';

/**
 * ChatSocketService - Real-Time Communication
 * 
 * Handles WebSocket connections for real-time messaging, typing indicators, and presence
 */

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workplaceId?: string;
  role?: string;
}

interface SocketUserData {
  userId: string;
  workplaceId: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface TypingData {
  conversationId: string;
}

interface MessageData {
  conversationId: string;
  messageId: string;
  senderId: string;
  content: {
    text?: string;
    type: string;
  };
  createdAt: Date;
}

export class ChatSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, SocketUserData> = new Map(); // socketId -> userData
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // socketId:conversationId -> timeout

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('ChatSocketService initialized');
  }

  /**
   * Setup Socket.IO event handlers with authentication
   */
  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.id).select(
          '_id workplaceId role firstName lastName'
        );

        if (!user) {
          return next(new Error('User not found'));
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
          firstName: user.firstName,
          lastName: user.lastName,
        });

        next();
      } catch (error) {
        logger.error('Socket authentication error', { error });
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
    const socketId = socket.id;

    logger.info('User connected via socket', { userId, socketId });

    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);

    // Update presence to online
    this.updateUserPresence(userId, socketId, 'online');

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Broadcast user online status
    this.broadcastPresenceUpdate(userId, 'online');

    // Setup event handlers
    this.setupEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Setup event handlers for a socket
   */
  private setupEventHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Join conversation room
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug('User joined conversation room', { userId, conversationId });
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug('User left conversation room', { userId, conversationId });
    });

    // Typing indicator - start
    socket.on('typing:start', (data: TypingData) => {
      this.handleTypingStart(socket, data.conversationId);
    });

    // Typing indicator - stop
    socket.on('typing:stop', (data: TypingData) => {
      this.handleTypingStop(socket, data.conversationId);
    });

    // User status update
    socket.on('user:status', (status: 'online' | 'away' | 'offline') => {
      this.updateUserPresence(userId, socket.id, status);
      this.broadcastPresenceUpdate(userId, status);
    });

    // Heartbeat for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const socketId = socket.id;

    logger.info('User disconnected from socket', { userId, socketId });

    // Remove from connected users
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        // User has no more connections, set offline
        this.updateUserPresence(userId, socketId, 'offline');
        this.broadcastPresenceUpdate(userId, 'offline');
      }
    }

    // Remove socket user data
    this.socketUsers.delete(socketId);

    // Clear any typing timeouts
    this.clearTypingTimeouts(socketId);
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: AuthenticatedSocket, conversationId: string): void {
    const userId = socket.userId!;
    const userData = this.socketUsers.get(socket.id);

    if (!userData) return;

    // Clear existing timeout
    const timeoutKey = `${socket.id}:${conversationId}`;
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey)!);
    }

    // Broadcast typing to conversation participants (except sender)
    socket.to(`conversation:${conversationId}`).emit('user:typing', {
      conversationId,
      userId,
      userData: {
        firstName: userData.firstName,
        lastName: userData.lastName,
      },
    });

    // Auto-stop typing after 3 seconds
    const timeout = setTimeout(() => {
      this.handleTypingStop(socket, conversationId);
    }, 3000);

    this.typingTimeouts.set(timeoutKey, timeout);

    logger.debug('User started typing', { userId, conversationId });
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, conversationId: string): void {
    const userId = socket.userId!;

    // Clear timeout
    const timeoutKey = `${socket.id}:${conversationId}`;
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey)!);
      this.typingTimeouts.delete(timeoutKey);
    }

    // Broadcast stop typing to conversation participants
    socket.to(`conversation:${conversationId}`).emit('user:stop_typing', {
      conversationId,
      userId,
    });

    logger.debug('User stopped typing', { userId, conversationId });
  }

  /**
   * Clear all typing timeouts for a socket
   */
  private clearTypingTimeouts(socketId: string): void {
    const keysToDelete: string[] = [];

    this.typingTimeouts.forEach((timeout, key) => {
      if (key.startsWith(socketId)) {
        clearTimeout(timeout);
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.typingTimeouts.delete(key));
  }

  /**
   * Update user presence in Redis
   */
  private async updateUserPresence(
    userId: string,
    socketId: string,
    status: 'online' | 'away' | 'offline'
  ): Promise<void> {
    try {
      const presenceModel = getPresenceModel();

      if (status === 'online') {
        await presenceModel.setUserOnline(userId, socketId);
      } else if (status === 'away') {
        await presenceModel.setUserAway(userId);
      } else if (status === 'offline') {
        await presenceModel.setUserOffline(userId, socketId);
      }
    } catch (error) {
      logger.error('Error updating user presence', { error, userId, status });
    }
  }

  /**
   * Broadcast presence update to relevant users
   */
  private broadcastPresenceUpdate(userId: string, status: string): void {
    // Broadcast to all users in the same workplace
    // In a real implementation, you'd want to be more selective
    this.io.emit('user:presence', {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Send new message notification to conversation participants
   */
  sendMessageNotification(conversationId: string, message: MessageData): void {
    this.io.to(`conversation:${conversationId}`).emit('message:new', {
      conversationId,
      message,
      timestamp: new Date(),
    });

    logger.debug('Message notification sent', { conversationId, messageId: message.messageId });
  }

  /**
   * Send message edited notification
   */
  sendMessageEditedNotification(
    conversationId: string,
    messageId: string,
    content: string,
    editedBy: string
  ): void {
    this.io.to(`conversation:${conversationId}`).emit('message:edited', {
      conversationId,
      messageId,
      content,
      editedBy,
      timestamp: new Date(),
    });

    logger.debug('Message edited notification sent', { conversationId, messageId });
  }

  /**
   * Send message deleted notification
   */
  sendMessageDeletedNotification(
    conversationId: string,
    messageId: string,
    deletedBy: string
  ): void {
    this.io.to(`conversation:${conversationId}`).emit('message:deleted', {
      conversationId,
      messageId,
      deletedBy,
      timestamp: new Date(),
    });

    logger.debug('Message deleted notification sent', { conversationId, messageId });
  }

  /**
   * Send reaction added notification
   */
  sendReactionNotification(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string,
    action: 'added' | 'removed'
  ): void {
    const event = action === 'added' ? 'message:reaction_added' : 'message:reaction_removed';

    this.io.to(`conversation:${conversationId}`).emit(event, {
      conversationId,
      messageId,
      userId,
      emoji,
      timestamp: new Date(),
    });

    logger.debug('Reaction notification sent', { conversationId, messageId, action, emoji });
  }

  /**
   * Send conversation updated notification
   */
  sendConversationUpdate(conversationId: string, updates: any): void {
    this.io.to(`conversation:${conversationId}`).emit('conversation:updated', {
      conversationId,
      updates,
      timestamp: new Date(),
    });

    logger.debug('Conversation update sent', { conversationId });
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(userId: string, notification: any): void {
    this.io.to(`user:${userId}`).emit('notification:new', {
      notification,
      timestamp: new Date(),
    });

    logger.debug('User notification sent', { userId });
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get user's socket IDs
   */
  getUserSocketIds(userId: string): string[] {
    const sockets = this.connectedUsers.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Disconnect user (for admin purposes)
   */
  disconnectUser(userId: string, reason?: string): void {
    const socketIds = this.getUserSocketIds(userId);

    socketIds.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        logger.info('User disconnected by admin', { userId, socketId, reason });
      }
    });
  }

  /**
   * Broadcast system message to all users
   */
  broadcastSystemMessage(message: string, data?: any): void {
    this.io.emit('system:message', {
      message,
      data,
      timestamp: new Date(),
    });

    logger.info('System message broadcasted', { message });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connectedUsers: number;
    totalConnections: number;
    averageConnectionsPerUser: number;
  } {
    const connectedUsers = this.connectedUsers.size;
    let totalConnections = 0;

    this.connectedUsers.forEach(sockets => {
      totalConnections += sockets.size;
    });

    return {
      connectedUsers,
      totalConnections,
      averageConnectionsPerUser: connectedUsers > 0 ? totalConnections / connectedUsers : 0,
    };
  }

  /**
   * Notify pharmacists about new consultation request
   */
  notifyConsultationRequest(pharmacistIds: string[], consultationData: any): void {
    pharmacistIds.forEach(pharmacistId => {
      this.io.to(`user:${pharmacistId}`).emit('consultation:new_request', {
        ...consultationData,
        timestamp: new Date(),
      });
    });

    logger.info('Consultation request notification sent', {
      pharmacistCount: pharmacistIds.length,
      requestId: consultationData.requestId,
    });
  }

  /**
   * Notify patient that consultation was accepted
   */
  notifyConsultationAccepted(patientId: string, consultationData: any): void {
    this.io.to(`user:${patientId}`).emit('consultation:accepted', {
      ...consultationData,
      timestamp: new Date(),
    });

    logger.info('Consultation accepted notification sent', {
      patientId,
      requestId: consultationData.requestId,
    });
  }

  /**
   * Notify supervisors about escalated consultation
   */
  notifyConsultationEscalated(supervisorIds: string[], consultationData: any): void {
    supervisorIds.forEach(supervisorId => {
      this.io.to(`user:${supervisorId}`).emit('consultation:escalated', {
        ...consultationData,
        timestamp: new Date(),
      });
    });

    logger.info('Consultation escalation notification sent', {
      supervisorCount: supervisorIds.length,
      requestId: consultationData.requestId,
    });
  }

  /**
   * Notify patient that consultation was completed
   */
  notifyConsultationCompleted(patientId: string, consultationData: any): void {
    this.io.to(`user:${patientId}`).emit('consultation:completed', {
      ...consultationData,
      timestamp: new Date(),
    });

    logger.info('Consultation completed notification sent', {
      patientId,
      requestId: consultationData.requestId,
    });
  }

  /**
   * Broadcast consultation queue update to all pharmacists in workplace
   */
  broadcastQueueUpdate(workplaceId: string, queueData: any): void {
    this.io.to(`workplace:${workplaceId}:pharmacists`).emit('consultation:queue_update', {
      ...queueData,
      timestamp: new Date(),
    });

    logger.debug('Consultation queue update broadcasted', { workplaceId });
  }
}

// Export singleton instance (will be initialized in server.ts)
let chatSocketService: ChatSocketService | null = null;

export const initializeChatSocketService = (io: SocketIOServer): ChatSocketService => {
  chatSocketService = new ChatSocketService(io);
  return chatSocketService;
};

export const getChatSocketService = (): ChatSocketService => {
  if (!chatSocketService) {
    throw new Error('ChatSocketService not initialized. Call initializeChatSocketService first.');
  }
  return chatSocketService;
};

export default ChatSocketService;
