import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import Notification, {
  INotification,
  INotificationData,
  INotificationDeliveryChannels,
} from "../models/Notification";
import User from "../models/User";
import Patient from "../models/Patient";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { sendEmail } from "../utils/email";
import { sendSMS } from "../utils/sms";
import {
  notificationTemplateService,
  NotificationTemplateService,
} from "../templates/notifications/notificationTemplates";
import logger from "../utils/logger";

export interface CreateNotificationData {
  userId: mongoose.Types.ObjectId;
  type: INotification["type"];
  title: string;
  content: string;
  data: INotificationData;
  priority?: INotification["priority"];
  deliveryChannels?: Partial<INotificationDeliveryChannels>;
  scheduledFor?: Date;
  expiresAt?: Date;
  groupKey?: string;
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
}

export interface NotificationFilters {
  type?: INotification["type"];
  status?: INotification["status"];
  priority?: INotification["priority"];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;

  // Communication-specific preferences
  newMessage: boolean;
  mentions: boolean;
  conversationInvites: boolean;
  patientQueries: boolean;
  urgentMessages: boolean;

  // Clinical preferences
  therapyUpdates: boolean;
  clinicalAlerts: boolean;
  interventionAssignments: boolean;

  // Timing preferences
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };

  // Batching preferences
  batchDigest: boolean;
  digestFrequency: "hourly" | "daily" | "weekly";
}

export interface NotificationTemplate {
  subject: string;
  content: string;
  htmlTemplate?: string;
  smsTemplate?: string;
  variables: Record<string, any>;
}

class NotificationService {
  private io: SocketIOServer | null = null;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Set Socket.IO server instance for real-time notifications
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
    logger.info("Socket.IO server set for NotificationService");
  }

  /**
   * Create a new notification
   */
  async createNotification(
    data: CreateNotificationData,
  ): Promise<INotification> {
    try {
      // Get user preferences to determine delivery channels
      const user = await User.findById(data.userId).select(
        "notificationPreferences",
      );
      const preferences = this.getUserPreferences(
        user?.notificationPreferences,
      );

      // Apply user preferences to delivery channels
      const deliveryChannels = this.applyUserPreferences(
        data.deliveryChannels || {},
        preferences,
        data.type,
      );

      // Check quiet hours
      if (this.isInQuietHours(preferences.quietHours)) {
        // Schedule for after quiet hours unless it's urgent
        if (!["urgent", "critical"].includes(data.priority || "normal")) {
          data.scheduledFor = this.getNextAvailableTime(preferences.quietHours);
        }
      }

      const notification = new Notification({
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        data: data.data,
        priority: data.priority || "normal",
        deliveryChannels,
        scheduledFor: data.scheduledFor,
        expiresAt: data.expiresAt,
        groupKey: data.groupKey,
        workplaceId: data.workplaceId,
        createdBy: data.createdBy,
      });

      await notification.save();

      // Send immediately if not scheduled
      if (!data.scheduledFor || data.scheduledFor <= new Date()) {
        await this.deliverNotification(notification);
      }

      logger.info(
        `Notification created: ${notification._id} for user ${data.userId}`,
      );
      return notification;
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Send real-time notification via Socket.IO
   */
  async sendRealTimeNotification(
    userId: string,
    notification: INotification,
  ): Promise<void> {
    if (!this.io) {
      logger.warn("Socket.IO server not available for real-time notifications");
      return;
    }

    try {
      // Find user's active socket connections
      const userSockets = await this.getUserSockets(userId);

      if (userSockets.length === 0) {
        logger.debug(`No active sockets found for user ${userId}`);
        return;
      }

      const notificationData = {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        priority: notification.priority,
        data: notification.data,
        createdAt: notification.createdAt,
        isUrgent: notification.priority === "urgent",
      };

      // Send to all user's active connections
      userSockets.forEach((socketId) => {
        this.io!.to(socketId).emit("notification_received", notificationData);
      });

      // Update delivery status
      notification.updateDeliveryStatus("inApp", "delivered");
      await notification.save();

      logger.debug(
        `Real-time notification sent to ${userSockets.length} sockets for user ${userId}`,
      );
    } catch (error) {
      logger.error("Error sending real-time notification:", error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    userId: string,
    notification: INotification,
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select(
        "email firstName lastName",
      );
      if (!user || !user.email) {
        throw new Error("User email not found");
      }

      const template = this.getNotificationTemplate(
        notification.type,
        notification.data,
      );

      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.htmlTemplate || template.content,
        text: template.content,
      });

      // Update delivery status
      notification.updateDeliveryStatus("email", "sent");
      await notification.save();

      logger.debug(`Email notification sent to ${user.email}`);
    } catch (error) {
      logger.error("Error sending email notification:", error);
      notification.updateDeliveryStatus("email", "failed", {
        reason: (error as Error).message,
      });
      await notification.save();
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMSNotification(
    userId: string,
    notification: INotification,
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select(
        "phone firstName lastName",
      );
      if (!user || !user.phone) {
        throw new Error("User phone number not found");
      }

      const template = this.getNotificationTemplate(
        notification.type,
        notification.data,
      );
      const smsContent = template.smsTemplate || template.content;

      await sendSMS(user.phone, smsContent);

      // Update delivery status
      notification.updateDeliveryStatus("sms", "sent");
      await notification.save();

      logger.debug(`SMS notification sent to ${user.phone}`);
    } catch (error) {
      logger.error("Error sending SMS notification:", error);
      notification.updateDeliveryStatus("sms", "failed", {
        reason: (error as Error).message,
      });
      await notification.save();
      throw error;
    }
  }

  /**
   * Deliver notification through all enabled channels
   */
  async deliverNotification(notification: INotification): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    // In-app notification
    if (notification.deliveryChannels.inApp) {
      deliveryPromises.push(
        this.sendRealTimeNotification(
          notification.userId.toString(),
          notification,
        ).catch((error) => {
          logger.error("In-app delivery failed:", error);
        }),
      );
    }

    // Email notification
    if (notification.deliveryChannels.email) {
      deliveryPromises.push(
        this.sendEmailNotification(
          notification.userId.toString(),
          notification,
        ).catch((error) => {
          logger.error("Email delivery failed:", error);
        }),
      );
    }

    // SMS notification
    if (notification.deliveryChannels.sms) {
      deliveryPromises.push(
        this.sendSMSNotification(
          notification.userId.toString(),
          notification,
        ).catch((error) => {
          logger.error("SMS delivery failed:", error);
        }),
      );
    }

    // Wait for all deliveries to complete
    await Promise.allSettled(deliveryPromises);

    // Mark notification as sent
    notification.sentAt = new Date();
    await notification.save();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId: userId,
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      notification.markAsRead();
      await notification.save();

      // Emit real-time update
      if (this.io) {
        const userSockets = await this.getUserSockets(userId);
        userSockets.forEach((socketId) => {
          this.io!.to(socketId).emit("notification_read", {
            notificationId,
            readAt: notification.readAt,
          });
        });
      }

      logger.debug(
        `Notification ${notificationId} marked as read by user ${userId}`,
      );
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Get user notifications with filtering
   */
  async getUserNotifications(
    userId: string,
    workplaceId: string,
    filters: NotificationFilters = {},
  ): Promise<{
    notifications: INotification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      // Apply filters
      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = filters.startDate;
        if (filters.endDate) query.createdAt.$lte = filters.endDate;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .populate("data.senderId", "firstName lastName role")
          .populate("data.conversationId", "title type")
          .populate("data.patientId", "firstName lastName mrn")
          .sort({ priority: -1, createdAt: -1 })
          .limit(filters.limit || 50)
          .skip(filters.offset || 0),
        Notification.countDocuments(query),
        Notification.countDocuments({ ...query, status: "unread" }),
      ]);

      return { notifications, total, unreadCount };
    } catch (error) {
      logger.error("Error getting user notifications:", error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notification.find({
        scheduledFor: { $lte: new Date() },
        status: "pending",
      });

      for (const notification of scheduledNotifications) {
        try {
          await this.deliverNotification(notification);
        } catch (error) {
          logger.error(
            `Failed to deliver scheduled notification ${notification._id}:`,
            error,
          );
        }
      }

      logger.info(
        `Processed ${scheduledNotifications.length} scheduled notifications`,
      );
    } catch (error) {
      logger.error("Error processing scheduled notifications:", error);
      throw error;
    }
  }

  /**
   * Create conversation-related notifications
   */
  async createConversationNotification(
    type: "new_message" | "mention" | "conversation_invite",
    conversationId: string,
    senderId: string,
    recipientIds: string[],
    messageId?: string,
    customContent?: string,
  ): Promise<INotification[]> {
    try {
      const [conversation, sender, message] = await Promise.all([
        Conversation.findById(conversationId).populate(
          "patientId",
          "firstName lastName",
        ),
        User.findById(senderId).select("firstName lastName role"),
        messageId ? Message.findById(messageId) : null,
      ]);

      if (!conversation || !sender) {
        throw new Error("Conversation or sender not found");
      }

      const notifications: INotification[] = [];

      for (const recipientId of recipientIds) {
        // Skip sending notification to sender
        if (recipientId === senderId) continue;

        const template = this.getConversationNotificationTemplate(
          type,
          conversation,
          sender,
          message,
          customContent,
        );

        const notification = await this.createNotification({
          userId: new mongoose.Types.ObjectId(recipientId),
          type,
          title: template.subject,
          content: template.content,
          data: {
            conversationId: conversation._id,
            messageId: messageId
              ? new mongoose.Types.ObjectId(messageId)
              : undefined,
            senderId: sender._id,
            patientId: conversation.patientId?._id,
            actionUrl: `/communication-hub/conversations/${conversationId}`,
          },
          priority: type === "mention" ? "high" : "normal",
          workplaceId: conversation.workplaceId,
          createdBy: sender._id,
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error("Error creating conversation notification:", error);
      throw error;
    }
  }

  /**
   * Create patient query notification
   */
  async createPatientQueryNotification(
    patientId: string,
    conversationId: string,
    messageContent: string,
    recipientIds: string[],
  ): Promise<INotification[]> {
    try {
      const [patient, conversation] = await Promise.all([
        Patient.findById(patientId).select("firstName lastName mrn"),
        Conversation.findById(conversationId),
      ]);

      if (!patient || !conversation) {
        throw new Error("Patient or conversation not found");
      }

      const notifications: INotification[] = [];

      for (const recipientId of recipientIds) {
        const notification = await this.createNotification({
          userId: new mongoose.Types.ObjectId(recipientId),
          type: "patient_query",
          title: `New Patient Query from ${patient.firstName} ${patient.lastName}`,
          content: `Patient ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn}) has sent a new query: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? "..." : ""}"`,
          data: {
            conversationId: conversation._id,
            patientId: patient._id,
            actionUrl: `/communication-hub/conversations/${conversationId}`,
            metadata: {
              patientMRN: patient.mrn,
              queryPreview: messageContent.substring(0, 200),
            },
          },
          priority: "high",
          workplaceId: conversation.workplaceId,
          createdBy: patient._id,
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error("Error creating patient query notification:", error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<void> {
    try {
      await User.findByIdAndUpdate(
        userId,
        { $set: { notificationPreferences: preferences } },
        { new: true },
      );

      logger.info(`Updated notification preferences for user ${userId}`);
    } catch (error) {
      logger.error("Error updating notification preferences:", error);
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    try {
      const user = await User.findById(userId).select(
        "notificationPreferences",
      );
      return this.getUserPreferences(user?.notificationPreferences);
    } catch (error) {
      logger.error("Error getting notification preferences:", error);
      throw error;
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<void> {
    try {
      const failedNotifications = await Notification.find({
        "deliveryStatus.status": "failed",
        "deliveryStatus.attempts": { $lt: 5 },
        expiresAt: { $gt: new Date() },
      });

      for (const notification of failedNotifications) {
        for (const deliveryStatus of notification.deliveryStatus) {
          if (
            deliveryStatus.status === "failed" &&
            notification.canRetryDelivery(deliveryStatus.channel)
          ) {
            try {
              switch (deliveryStatus.channel) {
                case "email":
                  await this.sendEmailNotification(
                    notification.userId.toString(),
                    notification,
                  );
                  break;
                case "sms":
                  await this.sendSMSNotification(
                    notification.userId.toString(),
                    notification,
                  );
                  break;
                case "inApp":
                  await this.sendRealTimeNotification(
                    notification.userId.toString(),
                    notification,
                  );
                  break;
              }
            } catch (error) {
              logger.error(
                `Retry failed for notification ${notification._id}, channel ${deliveryStatus.channel}:`,
                error,
              );
            }
          }
        }
      }

      logger.info(
        `Processed retry for ${failedNotifications.length} failed notifications`,
      );
    } catch (error) {
      logger.error("Error retrying failed notifications:", error);
      throw error;
    }
  }

  // Private helper methods

  private getUserPreferences(preferences: any): NotificationPreferences {
    const defaultPreferences: NotificationPreferences = {
      inApp: true,
      email: true,
      sms: false,
      push: true,
      newMessage: true,
      mentions: true,
      conversationInvites: true,
      patientQueries: true,
      urgentMessages: true,
      therapyUpdates: true,
      clinicalAlerts: true,
      interventionAssignments: true,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "UTC",
      },
      batchDigest: false,
      digestFrequency: "daily",
    };

    return { ...defaultPreferences, ...preferences };
  }

  private applyUserPreferences(
    requestedChannels: Partial<INotificationDeliveryChannels>,
    preferences: NotificationPreferences,
    notificationType: INotification["type"],
  ): INotificationDeliveryChannels {
    const channels: INotificationDeliveryChannels = {
      inApp: requestedChannels.inApp ?? preferences.inApp,
      email: requestedChannels.email ?? preferences.email,
      sms: requestedChannels.sms ?? preferences.sms,
      push: requestedChannels.push ?? preferences.push,
    };

    // Apply type-specific preferences
    switch (notificationType) {
      case "new_message":
        if (!preferences.newMessage) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "mention":
        if (!preferences.mentions) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "conversation_invite":
        if (!preferences.conversationInvites) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "patient_query":
        if (!preferences.patientQueries) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "urgent_message":
        if (!preferences.urgentMessages) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "therapy_update":
        if (!preferences.therapyUpdates) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "clinical_alert":
        if (!preferences.clinicalAlerts) {
          channels.email = false;
          channels.sms = false;
        }
        break;
      case "intervention_assigned":
        if (!preferences.interventionAssignments) {
          channels.email = false;
          channels.sms = false;
        }
        break;
    }

    return channels;
  }

  private isInQuietHours(
    quietHours: NotificationPreferences["quietHours"],
  ): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now
      .toLocaleTimeString("en-US", {
        hour12: false,
        timeZone: quietHours.timezone,
      })
      .substring(0, 5);

    return (
      currentTime >= quietHours.startTime || currentTime <= quietHours.endTime
    );
  }

  private getNextAvailableTime(
    quietHours: NotificationPreferences["quietHours"],
  ): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [endHour, endMinute] = quietHours.endTime.split(":").map(Number);
    tomorrow.setHours(endHour || 17, endMinute || 0, 0, 0);

    return tomorrow;
  }

  private async getUserSockets(userId: string): Promise<string[]> {
    if (!this.io) return [];

    const sockets: string[] = [];
    const allSockets = await this.io.fetchSockets();

    for (const socket of allSockets) {
      if (socket.data.userId === userId) {
        sockets.push(socket.id);
      }
    }

    return sockets;
  }

  private initializeTemplates(): void {
    // Initialize notification templates
    this.templates.set("new_message", {
      subject: "New Message from {{senderName}}",
      content: "{{senderName}} sent you a message in {{conversationTitle}}",
      htmlTemplate: `
                <h3>New Message</h3>
                <p><strong>{{senderName}}</strong> sent you a message in <strong>{{conversationTitle}}</strong></p>
                <blockquote>{{messagePreview}}</blockquote>
                <a href="{{actionUrl}}">View Conversation</a>
            `,
      smsTemplate: "New message from {{senderName}}: {{messagePreview}}",
      variables: {},
    });

    this.templates.set("mention", {
      subject: "You were mentioned by {{senderName}}",
      content: "{{senderName}} mentioned you in {{conversationTitle}}",
      htmlTemplate: `
                <h3>You were mentioned</h3>
                <p><strong>{{senderName}}</strong> mentioned you in <strong>{{conversationTitle}}</strong></p>
                <blockquote>{{messagePreview}}</blockquote>
                <a href="{{actionUrl}}">View Message</a>
            `,
      smsTemplate: "{{senderName}} mentioned you: {{messagePreview}}",
      variables: {},
    });

    this.templates.set("patient_query", {
      subject: "New Patient Query from {{patientName}}",
      content: "Patient {{patientName}} has sent a new query",
      htmlTemplate: `
                <h3>New Patient Query</h3>
                <p>Patient <strong>{{patientName}}</strong> (MRN: {{patientMRN}}) has sent a new query:</p>
                <blockquote>{{queryPreview}}</blockquote>
                <a href="{{actionUrl}}">Respond to Query</a>
            `,
      smsTemplate: "New patient query from {{patientName}}: {{queryPreview}}",
      variables: {},
    });
  }

  private getNotificationTemplate(
    type: string,
    data: INotificationData,
  ): NotificationTemplate {
    const variables = NotificationTemplateService.getTemplateVariables(
      type,
      data,
    );
    const template = notificationTemplateService.getTemplate(type, variables);
    return {
      ...template,
      variables,
    };
  }

  private getConversationNotificationTemplate(
    type: string,
    conversation: any,
    sender: any,
    message: any,
    customContent?: string,
  ): { subject: string; content: string } {
    const senderName = `${sender.firstName} ${sender.lastName}`;
    const conversationTitle = conversation.title || "Conversation";
    const messagePreview =
      message?.content?.text?.substring(0, 100) || customContent || "";

    switch (type) {
      case "new_message":
        return {
          subject: `New message from ${senderName}`,
          content: `${senderName} sent a message in ${conversationTitle}: "${messagePreview}"`,
        };
      case "mention":
        return {
          subject: `You were mentioned by ${senderName}`,
          content: `${senderName} mentioned you in ${conversationTitle}: "${messagePreview}"`,
        };
      case "conversation_invite":
        return {
          subject: `Invited to conversation by ${senderName}`,
          content: `${senderName} invited you to join ${conversationTitle}`,
        };
      default:
        return {
          subject: "Communication Hub Notification",
          content: "You have a new notification",
        };
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
