import { Server as SocketIOServer } from 'socket.io';
import PatientPortalWebSocketHandler from '../websocket/patientPortalHandler';
import logger from '../utils/logger';

/**
 * Integration service to connect patient portal WebSocket functionality
 * with the main application and messaging services
 */
export class PatientPortalWebSocketIntegration {
  private static instance: PatientPortalWebSocketIntegration;
  private webSocketHandler: PatientPortalWebSocketHandler | null = null;
  private io: SocketIOServer | null = null;

  private constructor() {}

  static getInstance(): PatientPortalWebSocketIntegration {
    if (!PatientPortalWebSocketIntegration.instance) {
      PatientPortalWebSocketIntegration.instance = new PatientPortalWebSocketIntegration();
    }
    return PatientPortalWebSocketIntegration.instance;
  }

  /**
   * Initialize WebSocket integration with Socket.IO server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.webSocketHandler = new PatientPortalWebSocketHandler(io);
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    logger.info('Patient portal WebSocket integration initialized');
  }

  /**
   * Get WebSocket handler instance
   */
  getHandler(): PatientPortalWebSocketHandler | null {
    return this.webSocketHandler;
  }

  /**
   * Broadcast new message to conversation participants
   */
  broadcastNewMessage(conversationId: string, message: any): void {
    if (this.webSocketHandler) {
      this.webSocketHandler.broadcastToConversation(conversationId, 'new_message', {
        message,
        conversationId,
        timestamp: new Date(),
      });
      
      logger.debug('Broadcasted new message via WebSocket', {
        conversationId,
        messageId: message._id,
      });
    }
  }

  /**
   * Broadcast message read status to conversation participants
   */
  broadcastMessageRead(conversationId: string, patientUserId: string): void {
    if (this.webSocketHandler) {
      this.webSocketHandler.broadcastToConversation(conversationId, 'message_read', {
        conversationId,
        patientUserId,
        timestamp: new Date(),
      });
      
      logger.debug('Broadcasted message read status via WebSocket', {
        conversationId,
        patientUserId,
      });
    }
  }

  /**
   * Send notification to specific patient
   */
  sendNotificationToPatient(patientUserId: string, notification: any): void {
    if (this.webSocketHandler) {
      this.webSocketHandler.sendNotificationToPatient(patientUserId, notification);
      
      logger.debug('Sent notification to patient via WebSocket', {
        patientUserId,
        notificationType: notification.type,
      });
    }
  }

  /**
   * Broadcast conversation status update
   */
  broadcastConversationUpdate(conversationId: string, update: any): void {
    if (this.webSocketHandler) {
      this.webSocketHandler.broadcastToConversation(conversationId, 'conversation_updated', {
        conversationId,
        update,
        timestamp: new Date(),
      });
      
      logger.debug('Broadcasted conversation update via WebSocket', {
        conversationId,
        updateType: update.type,
      });
    }
  }

  /**
   * Get online status for patients in workspace
   */
  getOnlinePatientsForWorkspace(workplaceId: string): any[] {
    if (this.webSocketHandler) {
      return this.webSocketHandler.getOnlinePatientsForWorkspace(workplaceId);
    }
    return [];
  }

  /**
   * Check if patient is currently online
   */
  isPatientOnline(patientUserId: string): boolean {
    if (this.webSocketHandler) {
      return this.webSocketHandler.isPatientOnline(patientUserId);
    }
    return false;
  }

  /**
   * Get patient's last seen time
   */
  getPatientLastSeen(patientUserId: string): Date | null {
    if (this.webSocketHandler) {
      return this.webSocketHandler.getPatientLastSeen(patientUserId);
    }
    return null;
  }

  /**
   * Get typing indicators for conversation
   */
  getTypingIndicators(conversationId: string): string[] {
    if (this.webSocketHandler) {
      return this.webSocketHandler.getTypingIndicators(conversationId);
    }
    return [];
  }

  /**
   * Broadcast typing indicator to conversation
   */
  broadcastTypingIndicator(conversationId: string, patientUserId: string, isTyping: boolean): void {
    if (this.webSocketHandler) {
      const event = isTyping ? 'typing_start' : 'typing_stop';
      this.webSocketHandler.broadcastToConversation(conversationId, event, {
        conversationId,
        patientUserId,
        timestamp: new Date(),
      });
      
      logger.debug('Broadcasted typing indicator via WebSocket', {
        conversationId,
        patientUserId,
        isTyping,
      });
    }
  }

  /**
   * Broadcast patient status update to workspace
   */
  broadcastPatientStatusUpdate(workplaceId: string, patientUserId: string, status: any): void {
    if (this.io) {
      this.io.of('/patient-portal').to(`workspace:${workplaceId}`).emit('patient_status_update', {
        patientUserId,
        status,
        timestamp: new Date(),
      });
      
      logger.debug('Broadcasted patient status update via WebSocket', {
        workplaceId,
        patientUserId,
        status: status.type,
      });
    }
  }

  /**
   * Send system notification to all patients in workspace
   */
  broadcastSystemNotification(workplaceId: string, notification: any): void {
    if (this.io) {
      this.io.of('/patient-portal').to(`workspace:${workplaceId}`).emit('system_notification', {
        notification,
        timestamp: new Date(),
      });
      
      logger.info('Broadcasted system notification to workspace via WebSocket', {
        workplaceId,
        notificationType: notification.type,
      });
    }
  }

  /**
   * Handle patient portal maintenance mode
   */
  enableMaintenanceMode(workplaceId?: string): void {
    if (this.io) {
      const target = workplaceId 
        ? this.io.of('/patient-portal').to(`workspace:${workplaceId}`)
        : this.io.of('/patient-portal');
      
      target.emit('maintenance_mode', {
        enabled: true,
        message: 'Patient portal is temporarily unavailable for maintenance',
        timestamp: new Date(),
      });
      
      logger.info('Enabled maintenance mode via WebSocket', { workplaceId });
    }
  }

  /**
   * Disable maintenance mode
   */
  disableMaintenanceMode(workplaceId?: string): void {
    if (this.io) {
      const target = workplaceId 
        ? this.io.of('/patient-portal').to(`workspace:${workplaceId}`)
        : this.io.of('/patient-portal');
      
      target.emit('maintenance_mode', {
        enabled: false,
        message: 'Patient portal is now available',
        timestamp: new Date(),
      });
      
      logger.info('Disabled maintenance mode via WebSocket', { workplaceId });
    }
  }

  /**
   * Get WebSocket connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    onlinePatients: number;
    activeConversations: number;
  } {
    if (this.io && this.webSocketHandler) {
      const namespace = this.io.of('/patient-portal');
      const totalConnections = namespace.sockets.size;
      
      // Get online patients across all workspaces
      const allOnlinePatients = new Set();
      // This would need to be implemented in the handler to track across workspaces
      
      return {
        totalConnections,
        onlinePatients: allOnlinePatients.size,
        activeConversations: 0, // Would need to track active conversations
      };
    }
    
    return {
      totalConnections: 0,
      onlinePatients: 0,
      activeConversations: 0,
    };
  }

  /**
   * Start periodic cleanup of inactive connections
   */
  private startPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      if (this.webSocketHandler) {
        this.webSocketHandler.cleanupInactiveConnections();
      }
    }, 5 * 60 * 1000);
    
    logger.info('Started periodic WebSocket cleanup');
  }

  /**
   * Gracefully shutdown WebSocket connections
   */
  shutdown(): void {
    if (this.io) {
      this.io.of('/patient-portal').emit('server_shutdown', {
        message: 'Server is shutting down. Please reconnect in a moment.',
        timestamp: new Date(),
      });
      
      // Give clients time to receive the message
      setTimeout(() => {
        this.io?.of('/patient-portal').disconnectSockets(true);
      }, 1000);
      
      logger.info('Patient portal WebSocket shutdown initiated');
    }
  }
}

export default PatientPortalWebSocketIntegration;