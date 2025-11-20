import { notificationService } from '../notificationService';
import User from '../../models/User';
import logger from '../../utils/logger';
import mongoose from 'mongoose';

/**
 * ChatNotificationService - Notification Integration
 * 
 * Handles notification preferences and integrates with unified notification system
 */

export interface ChatNotificationPreferences {
  newMessage: boolean;
  mentions: boolean;
  conversationInvites: boolean;
  urgentMessages: boolean;
  muteConversations: string[]; // Array of conversation IDs to mute
  doNotDisturb: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

export class ChatNotificationService {
  /**
   * Send new message notification
   */
  async sendNewMessageNotification(
    userId: string,
    senderId: string,
    conversationId: string,
    messageId: string,
    messagePreview: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.newMessage) {
        logger.debug('New message notifications disabled for user', { userId });
        return;
      }

      // Check if conversation is muted
      if (preferences.muteConversations.includes(conversationId)) {
        logger.debug('Conversation is muted', { userId, conversationId });
        return;
      }

      // Check do not disturb
      if (preferences.doNotDisturb || this.isInQuietHours(preferences.quietHours)) {
        logger.debug('User in do not disturb mode', { userId });
        return;
      }

      // Get sender info
      const sender = await User.findById(senderId).select('firstName lastName');
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      // Send notification via unified system
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'new_message',
        title: `New message from ${senderName}`,
        content: messagePreview,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          senderId: new mongoose.Types.ObjectId(senderId),
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: false,
          sms: false,
        },
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdBy: new mongoose.Types.ObjectId(senderId),
      });

      logger.debug('New message notification sent', { userId, conversationId });
    } catch (error) {
      logger.error('Error sending new message notification', { error, userId });
    }
  }

  /**
   * Send mention notification
   */
  async sendMentionNotification(
    userId: string,
    senderId: string,
    conversationId: string,
    messageId: string,
    messagePreview: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.mentions) {
        logger.debug('Mention notifications disabled for user', { userId });
        return;
      }

      // Mentions override mute settings but respect DND
      if (preferences.doNotDisturb) {
        logger.debug('User in do not disturb mode', { userId });
        return;
      }

      // Get sender info
      const sender = await User.findById(senderId).select('firstName lastName');
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      // Send notification via unified system
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'mention',
        title: `${senderName} mentioned you`,
        content: messagePreview,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          senderId: new mongoose.Types.ObjectId(senderId),
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: true, // Email for mentions
          sms: false,
        },
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdBy: new mongoose.Types.ObjectId(senderId),
      });

      logger.debug('Mention notification sent', { userId, conversationId });
    } catch (error) {
      logger.error('Error sending mention notification', { error, userId });
    }
  }

  /**
   * Send conversation invite notification
   */
  async sendConversationInviteNotification(
    userId: string,
    invitedBy: string,
    conversationId: string,
    conversationTitle: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.conversationInvites) {
        logger.debug('Conversation invite notifications disabled for user', { userId });
        return;
      }

      // Get inviter info
      const inviter = await User.findById(invitedBy).select('firstName lastName');
      const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone';

      // Send notification via unified system
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'conversation_invite',
        title: 'Added to Conversation',
        content: `${inviterName} added you to: ${conversationTitle}`,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          senderId: new mongoose.Types.ObjectId(invitedBy),
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: false,
          sms: false,
        },
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdBy: new mongoose.Types.ObjectId(invitedBy),
      });

      logger.debug('Conversation invite notification sent', { userId, conversationId });
    } catch (error) {
      logger.error('Error sending conversation invite notification', { error, userId });
    }
  }

  /**
   * Send flagged message notification to admins
   */
  async sendFlaggedMessageNotification(
    adminId: string,
    messageId: string,
    conversationId: string,
    reporterName: string,
    reason: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Send notification via unified system
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(adminId),
        type: 'flagged_message',
        title: '🚩 Message Flagged for Review',
        content: `${reporterName} reported a message for: ${reason}`,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          reason,
        },
        priority: 'normal',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: false,
        },
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdBy: new mongoose.Types.ObjectId(adminId),
      });

      logger.debug('Flagged message notification sent to admin', { adminId, messageId });
    } catch (error) {
      logger.error('Error sending flagged message notification', { error, adminId });
    }
  }

  /**
   * Send urgent message notification
   */
  async sendUrgentMessageNotification(
    userId: string,
    senderId: string,
    conversationId: string,
    messageId: string,
    messagePreview: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.urgentMessages) {
        logger.debug('Urgent message notifications disabled for user', { userId });
        return;
      }

      // Urgent messages override most settings except DND
      if (preferences.doNotDisturb) {
        logger.debug('User in do not disturb mode', { userId });
        return;
      }

      // Get sender info
      const sender = await User.findById(senderId).select('firstName lastName');
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      // Send notification via unified system
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'urgent_message',
        title: `🚨 Urgent message from ${senderName}`,
        content: messagePreview,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          messageId: new mongoose.Types.ObjectId(messageId),
          senderId: new mongoose.Types.ObjectId(senderId),
        },
        priority: 'urgent',
        deliveryChannels: {
          inApp: true,
          email: true,
          sms: true, // SMS for urgent messages
        },
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdBy: new mongoose.Types.ObjectId(senderId),
      });

      logger.debug('Urgent message notification sent', { userId, conversationId });
    } catch (error) {
      logger.error('Error sending urgent message notification', { error, userId });
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<ChatNotificationPreferences> {
    try {
      const user = await User.findById(userId).select('notificationPreferences chatPreferences');

      // Default preferences
      const defaultPreferences: ChatNotificationPreferences = {
        newMessage: true,
        mentions: true,
        conversationInvites: true,
        urgentMessages: true,
        muteConversations: [],
        doNotDisturb: false,
      };

      if (!user) {
        return defaultPreferences;
      }

      // Get preferences from user document
      const userPrefs: any = user.get('chatPreferences') || {};
      const notifPrefs: any = user.get('notificationPreferences') || {};

      return {
        newMessage: notifPrefs.newMessage !== false,
        mentions: notifPrefs.mentions !== false,
        conversationInvites: notifPrefs.conversationInvites !== false,
        urgentMessages: notifPrefs.urgentMessages !== false,
        muteConversations: userPrefs.muteConversations || [],
        doNotDisturb: userPrefs.doNotDisturb || false,
        quietHours: notifPrefs.quietHours,
      };
    } catch (error) {
      logger.error('Error getting user preferences', { error, userId });
      // Return defaults on error
      return {
        newMessage: true,
        mentions: true,
        conversationInvites: true,
        urgentMessages: true,
        muteConversations: [],
        doNotDisturb: false,
      };
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<ChatNotificationPreferences>
  ): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Update chat preferences
      const currentPrefs = user.get('chatPreferences') || {};
      user.set('chatPreferences', {
        ...currentPrefs,
        ...preferences,
      });

      await user.save();

      logger.info('User notification preferences updated', { userId });
    } catch (error) {
      logger.error('Error updating user preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Mute conversation
   */
  async muteConversation(userId: string, conversationId: string): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.muteConversations.includes(conversationId)) {
        preferences.muteConversations.push(conversationId);
        await this.updateUserPreferences(userId, preferences);
      }

      logger.info('Conversation muted', { userId, conversationId });
    } catch (error) {
      logger.error('Error muting conversation', { error, userId, conversationId });
      throw error;
    }
  }

  /**
   * Unmute conversation
   */
  async unmuteConversation(userId: string, conversationId: string): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.muteConversations = preferences.muteConversations.filter(
        id => id !== conversationId
      );
      await this.updateUserPreferences(userId, preferences);

      logger.info('Conversation unmuted', { userId, conversationId });
    } catch (error) {
      logger.error('Error unmuting conversation', { error, userId, conversationId });
      throw error;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(quietHours?: ChatNotificationPreferences['quietHours']): boolean {
    if (!quietHours || !quietHours.enabled) {
      return false;
    }

    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: quietHours.timezone || 'UTC',
      });

      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
      const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch (error) {
      logger.error('Error checking quiet hours', { error });
      return false;
    }
  }
}

// Export singleton instance
export const chatNotificationService = new ChatNotificationService();
export default chatNotificationService;
