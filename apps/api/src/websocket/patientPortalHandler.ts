import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import Conversation from '../models/Conversation';
import { PatientMessagingService } from '../services/PatientMessagingService';
import logger from '../utils/logger';

// Extended socket interface for patient portal
export interface PatientPortalSocket extends Socket {
  patientUserId?: mongoose.Types.ObjectId;
  workplaceId?: mongoose.Types.ObjectId;
  patientUser?: IPatientUser;
  isAuthenticated?: boolean;
  lastActivity?: Date;
}

// Typing indicator data
interface TypingData {
  conversationId: string;
  patientUserId: string;
  isTyping: boolean;
  timestamp: Date;
}

// Online status data
interface OnlineStatusData {
  patientUserId: string;
  workplaceId: string;
  isOnline: boolean;
  lastSeen: Date;
}

export class PatientPortalWebSocketHandler {
  private io: SocketIOServer;
  private messagingService: PatientMessagingService;
  private connectedPatients: Map<string, PatientPortalSocket> = new Map();
  private typingIndicators: Map<string, Set<string>> = new Map(); // conversationId -> Set of typing userIds
  private onlineStatus: Map<string, OnlineStatusData> = new Map(); // patientUserId -> status

  constructor(io: SocketIOServer) {
    this.io = io;
    this.messagingService = new PatientMessagingService();
    this.setupPatientPortalNamespace();
  }

  /**
   * Setup patient portal WebSocket namespace
   */
  private setupPatientPortalNamespace(): void {
    const patientPortalNamespace = this.io.of('/patient-portal');

    // Authentication middleware
    patientPortalNamespace.use(async (socket: PatientPortalSocket, next) => {
      try {
        const authenticated = await this.authenticatePatientSocket(socket);
        if (authenticated) {
          next();
        } else {
          next(new Error('Authentication failed'));
        }
      } catch (error: any) {
        logger.error('Patient portal WebSocket authentication error', {
          error: error.message,
          socketId: socket.id,
        });
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    patientPortalNamespace.on('connection', (socket: PatientPortalSocket) => {
      this.handlePatientConnection(socket);
    });

    logger.info('Patient portal WebSocket namespace initialized');
  }

  /**
   * Authenticate patient socket connection
   */
  async authenticatePatientSocket(socket: PatientPortalSocket): Promise<boolean> {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('No authentication token provided for patient portal WebSocket');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      if (!decoded.patientUserId) {
        logger.warn('Invalid token format for patient portal WebSocket', { decoded });
        return false;
      }

      // Fetch patient user from database
      const patientUser = await PatientUser.findOne({
        _id: decoded.patientUserId,
        status: 'active',
        isDeleted: false,
      }).lean();

      if (!patientUser) {
        logger.warn('Patient user not found or inactive', { patientUserId: decoded.patientUserId });
        return false;
      }

      // Attach patient data to socket
      socket.patientUserId = new mongoose.Types.ObjectId(decoded.patientUserId);
      socket.workplaceId = patientUser.workplaceId;
      socket.patientUser = patientUser;
      socket.isAuthenticated = true;
      socket.lastActivity = new Date();

      logger.info('Patient portal WebSocket authentication successful', {
        patientUserId: socket.patientUserId,
        workplaceId: socket.workplaceId,
        socketId: socket.id,
      });

      return true;
    } catch (error: any) {
      logger.error('Error authenticating patient socket', {
        error: error.message,
        socketId: socket.id,
      });
      return false;
    }
  }

  /**
   * Handle new patient connection
   */
  private handlePatientConnection(socket: PatientPortalSocket): void {
    const patientUserId = socket.patientUserId!.toString();
    const workplaceId = socket.workplaceId!.toString();

    // Store connected patient
    this.connectedPatients.set(patientUserId, socket);

    // Update online status
    this.updatePatientOnlineStatus(patientUserId, workplaceId, true);

    // Join patient to their workspace room
    socket.join(`workspace:${workplaceId}`);

    // Join patient to their personal room
    socket.join(`patient:${patientUserId}`);

    logger.info('Patient connected to WebSocket', {
      patientUserId,
      workplaceId,
      socketId: socket.id,
    });

    // Setup event handlers
    this.setupPatientEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handlePatientDisconnection(socket, reason);
    });

    // Send connection confirmation
    socket.emit('connected', {
      success: true,
      patientUserId,
      workplaceId,
      timestamp: new Date(),
    });
  }

  /**
   * Setup event handlers for patient socket
   */
  private setupPatientEventHandlers(socket: PatientPortalSocket): void {
    const patientUserId = socket.patientUserId!.toString();

    // Join conversation room
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      try {
        await this.handleJoinConversation(socket, data.conversationId);
      } catch (error: any) {
        socket.emit('error', {
          type: 'join_conversation_error',
          message: error.message,
        });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      this.handleLeaveConversation(socket, data.conversationId);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string }) => {
      this.handleTypingStart(socket, data.conversationId);
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      this.handleTypingStop(socket, data.conversationId);
    });

    // Handle message sending (real-time confirmation)
    socket.on('send_message', async (data: { conversationId: string; content: string; attachments?: any[] }) => {
      try {
        await this.handlePatientMessage(socket, data);
      } catch (error: any) {
        socket.emit('message_error', {
          error: error.message,
          conversationId: data.conversationId,
        });
      }
    });

    // Handle message read status
    socket.on('mark_as_read', async (data: { conversationId: string }) => {
      try {
        await this.handleMarkAsRead(socket, data.conversationId);
      } catch (error: any) {
        socket.emit('error', {
          type: 'mark_as_read_error',
          message: error.message,
        });
      }
    });

    // Handle activity updates
    socket.on('activity', () => {
      socket.lastActivity = new Date();
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Patient portal WebSocket error', {
        error: error.message,
        patientUserId,
        socketId: socket.id,
      });
    });
  }

  /**
   * Handle patient joining a conversation
   */
  private async handleJoinConversation(socket: PatientPortalSocket, conversationId: string): Promise<void> {
    const patientUserId = socket.patientUserId!;
    const workplaceId = socket.workplaceId!;

    // Validate conversation access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workplaceId,
      'participants.userId': patientUserId,
      'participants.leftAt': { $exists: false },
      isDeleted: false,
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Join conversation room
    socket.join(`conversation:${conversationId}`);

    // Notify other participants that patient joined
    socket.to(`conversation:${conversationId}`).emit('participant_joined', {
      conversationId,
      patientUserId: patientUserId.toString(),
      timestamp: new Date(),
    });

    socket.emit('conversation_joined', {
      conversationId,
      success: true,
      timestamp: new Date(),
    });

    logger.info('Patient joined conversation', {
      patientUserId: patientUserId.toString(),
      conversationId,
      socketId: socket.id,
    });
  }

  /**
   * Handle patient leaving a conversation
   */
  private handleLeaveConversation(socket: PatientPortalSocket, conversationId: string): void {
    const patientUserId = socket.patientUserId!.toString();

    // Leave conversation room
    socket.leave(`conversation:${conversationId}`);

    // Notify other participants that patient left
    socket.to(`conversation:${conversationId}`).emit('participant_left', {
      conversationId,
      patientUserId,
      timestamp: new Date(),
    });

    // Stop typing indicator if active
    this.handleTypingStop(socket, conversationId);

    socket.emit('conversation_left', {
      conversationId,
      success: true,
      timestamp: new Date(),
    });

    logger.info('Patient left conversation', {
      patientUserId,
      conversationId,
      socketId: socket.id,
    });
  }

  /**
   * Handle typing start indicator
   */
  private handleTypingStart(socket: PatientPortalSocket, conversationId: string): void {
    const patientUserId = socket.patientUserId!.toString();

    // Add to typing indicators
    if (!this.typingIndicators.has(conversationId)) {
      this.typingIndicators.set(conversationId, new Set());
    }
    this.typingIndicators.get(conversationId)!.add(patientUserId);

    // Broadcast typing indicator to other participants
    socket.to(`conversation:${conversationId}`).emit('typing_start', {
      conversationId,
      patientUserId,
      timestamp: new Date(),
    });

    logger.debug('Patient started typing', {
      patientUserId,
      conversationId,
    });
  }

  /**
   * Handle typing stop indicator
   */
  private handleTypingStop(socket: PatientPortalSocket, conversationId: string): void {
    const patientUserId = socket.patientUserId!.toString();

    // Remove from typing indicators
    if (this.typingIndicators.has(conversationId)) {
      this.typingIndicators.get(conversationId)!.delete(patientUserId);
      
      // Clean up empty sets
      if (this.typingIndicators.get(conversationId)!.size === 0) {
        this.typingIndicators.delete(conversationId);
      }
    }

    // Broadcast typing stop to other participants
    socket.to(`conversation:${conversationId}`).emit('typing_stop', {
      conversationId,
      patientUserId,
      timestamp: new Date(),
    });

    logger.debug('Patient stopped typing', {
      patientUserId,
      conversationId,
    });
  }

  /**
   * Handle real-time message sending
   */
  private async handlePatientMessage(
    socket: PatientPortalSocket,
    data: { conversationId: string; content: string; attachments?: any[] }
  ): Promise<void> {
    const patientUserId = socket.patientUserId!;
    const { conversationId, content, attachments } = data;

    try {
      // Send message through service
      const message = await this.messagingService.sendMessage(
        new mongoose.Types.ObjectId(conversationId),
        patientUserId,
        content,
        attachments
      );

      // Stop typing indicator
      this.handleTypingStop(socket, conversationId);

      // Broadcast message to conversation participants
      this.broadcastToConversation(conversationId, 'new_message', {
        message,
        conversationId,
        timestamp: new Date(),
      });

      // Send confirmation to sender
      socket.emit('message_sent', {
        messageId: message._id,
        conversationId,
        timestamp: new Date(),
      });

      logger.info('Real-time message sent', {
        messageId: message._id,
        conversationId,
        patientUserId: patientUserId.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending real-time message', {
        error: error.message,
        conversationId,
        patientUserId: patientUserId.toString(),
      });
      throw error;
    }
  }

  /**
   * Handle marking conversation as read
   */
  private async handleMarkAsRead(socket: PatientPortalSocket, conversationId: string): Promise<void> {
    const patientUserId = socket.patientUserId!;

    try {
      await this.messagingService.markAsRead(
        new mongoose.Types.ObjectId(conversationId),
        patientUserId
      );

      // Broadcast read status to conversation participants
      socket.to(`conversation:${conversationId}`).emit('message_read', {
        conversationId,
        patientUserId: patientUserId.toString(),
        timestamp: new Date(),
      });

      socket.emit('marked_as_read', {
        conversationId,
        success: true,
        timestamp: new Date(),
      });

      logger.info('Conversation marked as read via WebSocket', {
        conversationId,
        patientUserId: patientUserId.toString(),
      });
    } catch (error: any) {
      logger.error('Error marking conversation as read via WebSocket', {
        error: error.message,
        conversationId,
        patientUserId: patientUserId.toString(),
      });
      throw error;
    }
  }

  /**
   * Handle patient disconnection
   */
  private handlePatientDisconnection(socket: PatientPortalSocket, reason: string): void {
    const patientUserId = socket.patientUserId?.toString();
    const workplaceId = socket.workplaceId?.toString();

    if (patientUserId) {
      // Remove from connected patients
      this.connectedPatients.delete(patientUserId);

      // Update online status
      if (workplaceId) {
        this.updatePatientOnlineStatus(patientUserId, workplaceId, false);
      }

      // Clean up typing indicators
      for (const [conversationId, typingUsers] of this.typingIndicators.entries()) {
        if (typingUsers.has(patientUserId)) {
          typingUsers.delete(patientUserId);
          
          // Broadcast typing stop
          socket.to(`conversation:${conversationId}`).emit('typing_stop', {
            conversationId,
            patientUserId,
            timestamp: new Date(),
          });

          // Clean up empty sets
          if (typingUsers.size === 0) {
            this.typingIndicators.delete(conversationId);
          }
        }
      }

      logger.info('Patient disconnected from WebSocket', {
        patientUserId,
        workplaceId,
        socketId: socket.id,
        reason,
      });
    }
  }

  /**
   * Update patient online status
   */
  private updatePatientOnlineStatus(patientUserId: string, workplaceId: string, isOnline: boolean): void {
    const statusData: OnlineStatusData = {
      patientUserId,
      workplaceId,
      isOnline,
      lastSeen: new Date(),
    };

    this.onlineStatus.set(patientUserId, statusData);

    // Broadcast status update to workspace
    this.io.of('/patient-portal').to(`workspace:${workplaceId}`).emit('patient_status_update', statusData);

    logger.debug('Patient online status updated', {
      patientUserId,
      workplaceId,
      isOnline,
    });
  }

  /**
   * Broadcast message to all participants in a conversation
   */
  public broadcastToConversation(conversationId: string, event: string, data: any): void {
    this.io.of('/patient-portal').to(`conversation:${conversationId}`).emit(event, data);
  }

  /**
   * Send notification to specific patient
   */
  public sendNotificationToPatient(patientUserId: string, notification: any): void {
    this.io.of('/patient-portal').to(`patient:${patientUserId}`).emit('notification', notification);
  }

  /**
   * Get online patients for workspace
   */
  public getOnlinePatientsForWorkspace(workplaceId: string): OnlineStatusData[] {
    return Array.from(this.onlineStatus.values()).filter(
      status => status.workplaceId === workplaceId && status.isOnline
    );
  }

  /**
   * Get typing indicators for conversation
   */
  public getTypingIndicators(conversationId: string): string[] {
    return Array.from(this.typingIndicators.get(conversationId) || []);
  }

  /**
   * Check if patient is online
   */
  public isPatientOnline(patientUserId: string): boolean {
    const status = this.onlineStatus.get(patientUserId);
    return status ? status.isOnline : false;
  }

  /**
   * Get patient's last seen time
   */
  public getPatientLastSeen(patientUserId: string): Date | null {
    const status = this.onlineStatus.get(patientUserId);
    return status ? status.lastSeen : null;
  }

  /**
   * Cleanup inactive connections (called periodically)
   */
  public cleanupInactiveConnections(): void {
    const now = new Date();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [patientUserId, socket] of this.connectedPatients.entries()) {
      if (socket.lastActivity && (now.getTime() - socket.lastActivity.getTime()) > inactivityThreshold) {
        logger.info('Disconnecting inactive patient socket', {
          patientUserId,
          lastActivity: socket.lastActivity,
          socketId: socket.id,
        });
        
        socket.disconnect(true);
      }
    }

    // Clean up old online status entries
    for (const [patientUserId, status] of this.onlineStatus.entries()) {
      if (!status.isOnline && (now.getTime() - status.lastSeen.getTime()) > (24 * 60 * 60 * 1000)) {
        this.onlineStatus.delete(patientUserId);
      }
    }
  }
}

export default PatientPortalWebSocketHandler;