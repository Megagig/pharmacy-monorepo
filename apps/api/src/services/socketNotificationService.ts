import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { notificationService } from "./notificationService";
import logger from "../utils/logger";
import User from "../models/User";
import Notification from "../models/Notification";

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

/**
 * Socket.IO service for real-time notifications
 */
export class SocketNotificationService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, SocketUserData> = new Map(); // socketId -> userData

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();

    // Set the socket server in notification service
    notificationService.setSocketServer(io);

    logger.info("Socket notification service initialized");
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.id).select(
          "_id workplaceId role email firstName lastName",
        );

        if (!user) {
          return next(new Error("User not found"));
        }

        // Attach user data to socket
        socket.userId = user._id.toString();
        socket.workplaceId = user.workplaceId?.toString() || "";
        socket.role = user.role;

        // Store user data
        this.socketUsers.set(socket.id, {
          userId: user._id.toString(),
          workplaceId: user.workplaceId?.toString() || "",
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        next();
      } catch (error) {
        logger.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // Connection handler
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const userData = this.socketUsers.get(socket.id)!;

    logger.info(
      `User ${userData.firstName} ${userData.lastName} connected (${socket.id})`,
    );

    // Track user connection
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`workplace:${socket.workplaceId}`);

    // Send initial data
    this.sendInitialNotifications(socket);

    // Setup event handlers
    this.setupNotificationHandlers(socket);
    this.setupConversationHandlers(socket);
    this.setupPresenceHandlers(socket);

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const userData = this.socketUsers.get(socket.id);

    if (userData) {
      logger.info(
        `User ${userData.firstName} ${userData.lastName} disconnected (${socket.id})`,
      );
    }

    // Remove from tracking
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(socket.id);
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.socketUsers.delete(socket.id);

    // Broadcast user offline status
    this.broadcastUserPresence(userId, false);
  }

  /**
   * Setup notification-specific event handlers
   */
  private setupNotificationHandlers(socket: AuthenticatedSocket): void {
    // Mark notification as read
    socket.on(
      "notification:mark_read",
      async (data: { notificationId: string }) => {
        try {
          await notificationService.markAsRead(
            data.notificationId,
            socket.userId!,
          );

          // Broadcast to all user's connections
          this.io.to(`user:${socket.userId}`).emit("notification:marked_read", {
            notificationId: data.notificationId,
            readAt: new Date(),
          });

          logger.debug(
            `Notification ${data.notificationId} marked as read by user ${socket.userId}`,
          );
        } catch (error: any) {
          logger.error("Error marking notification as read:", error);
          socket.emit("notification:error", {
            message: "Failed to mark notification as read",
            error: error?.message || "Unknown error",
          });
        }
      },
    );

    // Get unread count
    socket.on("notification:get_unread_count", async () => {
      try {
        const unreadCount = await Notification.countDocuments({
          userId: new mongoose.Types.ObjectId(socket.userId!),
          workplaceId: new mongoose.Types.ObjectId(socket.workplaceId!),
          status: "unread",
        });

        socket.emit("notification:unread_count", { unreadCount });
      } catch (error: any) {
        logger.error("Error getting unread count:", error);
        socket.emit("notification:error", {
          message: "Failed to get unread count",
          error: error?.message || "Unknown error",
        });
      }
    });

    // Get recent notifications
    socket.on(
      "notification:get_recent",
      async (data: { limit?: number } = {}) => {
        try {
          const result = await notificationService.getUserNotifications(
            socket.userId!,
            socket.workplaceId!,
            { limit: data.limit || 10, status: "unread" },
          );

          socket.emit("notification:recent_list", result);
        } catch (error: any) {
          logger.error("Error getting recent notifications:", error);
          socket.emit("notification:error", {
            message: "Failed to get recent notifications",
            error: error?.message || "Unknown error",
          });
        }
      },
    );

    // Update notification preferences
    socket.on("notification:update_preferences", async (preferences: any) => {
      try {
        await notificationService.updateNotificationPreferences(
          socket.userId!,
          preferences,
        );

        socket.emit("notification:preferences_updated", {
          success: true,
          preferences,
        });

        logger.debug(
          `Notification preferences updated for user ${socket.userId}`,
        );
      } catch (error: any) {
        logger.error("Error updating notification preferences:", error);
        socket.emit("notification:error", {
          message: "Failed to update notification preferences",
          error: error?.message || "Unknown error",
        });
      }
    });
  }

  /**
   * Setup conversation-related event handlers
   */
  private setupConversationHandlers(socket: AuthenticatedSocket): void {
    // Join conversation room
    socket.on("conversation:join", (data: { conversationId: string }) => {
      socket.join(`conversation:${data.conversationId}`);
      logger.debug(
        `User ${socket.userId} joined conversation ${data.conversationId}`,
      );
    });

    // Leave conversation room
    socket.on("conversation:leave", (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`);
      logger.debug(
        `User ${socket.userId} left conversation ${data.conversationId}`,
      );
    });

    // Typing indicators
    socket.on(
      "conversation:typing_start",
      (data: { conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit("conversation:user_typing", {
            userId: socket.userId,
            conversationId: data.conversationId,
            userData: this.socketUsers.get(socket.id),
          });
      },
    );

    socket.on(
      "conversation:typing_stop",
      (data: { conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit("conversation:user_stopped_typing", {
            userId: socket.userId,
            conversationId: data.conversationId,
          });
      },
    );

    // Message read receipts
    socket.on(
      "message:mark_read",
      (data: { messageId: string; conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit("message:read_receipt", {
            messageId: data.messageId,
            userId: socket.userId,
            readAt: new Date(),
          });
      },
    );
  }

  /**
   * Setup presence-related event handlers
   */
  private setupPresenceHandlers(socket: AuthenticatedSocket): void {
    // Broadcast user online status
    this.broadcastUserPresence(socket.userId!, true);

    // Handle presence requests
    socket.on("presence:get_online_users", () => {
      const onlineUsers = Array.from(this.connectedUsers.keys())
        .map((userId) => {
          const sockets = this.connectedUsers.get(userId)!;
          const firstSocket = Array.from(sockets)[0];
          return firstSocket ? this.socketUsers.get(firstSocket) || null : null;
        })
        .filter(Boolean);

      socket.emit("presence:online_users", onlineUsers);
    });

    // Handle status updates
    socket.on("presence:update_status", (data: { status: string }) => {
      const userData = this.socketUsers.get(socket.id);
      if (userData) {
        // Broadcast status update to workplace
        socket
          .to(`workplace:${socket.workplaceId}`)
          .emit("presence:user_status_changed", {
            userId: socket.userId,
            status: data.status,
            userData,
          });
      }
    });
  }

  /**
   * Send initial notifications to newly connected user
   */
  private async sendInitialNotifications(
    socket: AuthenticatedSocket,
  ): Promise<void> {
    try {
      // Send unread count
      const unreadCount = await Notification.countDocuments({
        userId: new mongoose.Types.ObjectId(socket.userId!),
        workplaceId: new mongoose.Types.ObjectId(socket.workplaceId!),
        status: "unread",
      });

      socket.emit("notification:unread_count", { unreadCount });

      // Send recent unread notifications
      const result = await notificationService.getUserNotifications(
        socket.userId!,
        socket.workplaceId!,
        { limit: 5, status: "unread" },
      );

      socket.emit("notification:initial_load", result);

      logger.debug(`Sent initial notifications to user ${socket.userId}`);
    } catch (error: any) {
      logger.error("Error sending initial notifications:", error);
    }
  }

  /**
   * Broadcast user presence to workplace
   */
  private broadcastUserPresence(userId: string, isOnline: boolean): void {
    const userData = Array.from(this.socketUsers.values()).find(
      (u) => u.userId === userId,
    );

    if (userData) {
      this.io
        .to(`workplace:${userData.workplaceId}`)
        .emit("presence:user_presence_changed", {
          userId,
          isOnline,
          userData,
          timestamp: new Date(),
        });
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: any,
  ): Promise<void> {
    const userSockets = this.connectedUsers.get(userId);

    if (userSockets && userSockets.size > 0) {
      this.io.to(`user:${userId}`).emit("notification:received", {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt,
        isUrgent: notification.isUrgent,
      });

      // Update unread count
      const unreadCount = await Notification.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        workplaceId: new mongoose.Types.ObjectId(
          notification.workplaceId.toString(),
        ),
        status: "unread",
      });

      this.io
        .to(`user:${userId}`)
        .emit("notification:unread_count", { unreadCount });

      logger.debug(`Sent real-time notification to user ${userId}`);
    }
  }

  /**
   * Send message notification to conversation participants
   */
  sendMessageNotification(
    conversationId: string,
    message: any,
    excludeUserId?: string,
  ): void {
    const notificationData = {
      messageId: message._id,
      conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      senderData: this.socketUsers.get(message.senderId),
    };

    // Send to conversation room, excluding sender
    if (excludeUserId) {
      this.io
        .to(`conversation:${conversationId}`)
        .except(`user:${excludeUserId}`)
        .emit("message:received", notificationData);
    } else {
      this.io
        .to(`conversation:${conversationId}`)
        .emit("message:received", notificationData);
    }
  }

  /**
   * Send conversation update to participants
   */
  sendConversationUpdate(conversationId: string, updateData: any): void {
    this.io.to(`conversation:${conversationId}`).emit("conversation:updated", {
      conversationId,
      ...updateData,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get user connection status
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get all connected users in workplace
   */
  getWorkplaceConnectedUsers(workplaceId: string): SocketUserData[] {
    return Array.from(this.socketUsers.values()).filter(
      (user) => user.workplaceId === workplaceId,
    );
  }

  /**
   * Send system announcement to all users in workplace
   */
  sendWorkplaceAnnouncement(workplaceId: string, announcement: any): void {
    this.io.to(`workplace:${workplaceId}`).emit("system:announcement", {
      ...announcement,
      timestamp: new Date(),
    });
  }

  /**
   * Send emergency alert to all connected users
   */
  sendEmergencyAlert(alert: any): void {
    this.io.emit("system:emergency_alert", {
      ...alert,
      timestamp: new Date(),
    });
  }
}

export default SocketNotificationService;
