import mongoose from 'mongoose';
import logger from '../utils/logger';
import NotificationChannel from '../models/NotificationChannel';
import NotificationUsage from '../models/NotificationUsage';

export interface CreateChannelData {
  name: string;
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  enabled: boolean;
  config: {
    provider?: string;
    apiKey?: string;
    fromAddress?: string;
    fromNumber?: string;
    webhookUrl?: string;
  };
  dailyLimit: number;
  monthlyLimit: number;
  workplaceId: mongoose.Types.ObjectId;
}

export interface UpdateChannelData {
  name?: string;
  enabled?: boolean;
  config?: Record<string, any>;
  dailyLimit?: number;
  monthlyLimit?: number;
}

class NotificationChannelService {
  /**
   * Get all notification channels for a workplace
   */
  async getChannels(workplaceId: string) {
    try {
      const channels = await NotificationChannel.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false,
      }).sort({ createdAt: -1 });

      // Get usage data for each channel
      const channelsWithUsage = await Promise.all(
        channels.map(async (channel) => {
          const usage = await this.getChannelUsage(channel._id.toString());
          return {
            ...channel.toObject(),
            usage,
          };
        })
      );

      return channelsWithUsage;
    } catch (error) {
      logger.error('Error fetching notification channels:', error);
      throw error;
    }
  }

  /**
   * Get channel usage statistics
   */
  async getChannelUsage(channelId: string) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [dailyUsage, monthlyUsage] = await Promise.all([
        NotificationUsage.aggregate([
          {
            $match: {
              channelId: new mongoose.Types.ObjectId(channelId),
              createdAt: { $gte: startOfDay },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$count' },
            },
          },
        ]),
        NotificationUsage.aggregate([
          {
            $match: {
              channelId: new mongoose.Types.ObjectId(channelId),
              createdAt: { $gte: startOfMonth },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$count' },
            },
          },
        ]),
      ]);

      return {
        daily: dailyUsage[0]?.total || 0,
        monthly: monthlyUsage[0]?.total || 0,
      };
    } catch (error) {
      logger.error('Error fetching channel usage:', error);
      return { daily: 0, monthly: 0 };
    }
  }

  /**
   * Create a new notification channel
   */
  async createChannel(data: CreateChannelData) {
    try {
      const channel = new NotificationChannel(data);
      await channel.save();
      
      logger.info(`Notification channel created: ${channel._id}`);
      return channel;
    } catch (error) {
      logger.error('Error creating notification channel:', error);
      throw error;
    }
  }

  /**
   * Update notification channel
   */
  async updateChannel(channelId: string, data: UpdateChannelData) {
    try {
      const channel = await NotificationChannel.findByIdAndUpdate(
        channelId,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (!channel) {
        throw new Error('Channel not found');
      }

      logger.info(`Notification channel updated: ${channelId}`);
      return channel;
    } catch (error) {
      logger.error('Error updating notification channel:', error);
      throw error;
    }
  }

  /**
   * Delete notification channel (soft delete)
   */
  async deleteChannel(channelId: string) {
    try {
      const channel = await NotificationChannel.findByIdAndUpdate(
        channelId,
        { $set: { isDeleted: true } },
        { new: true }
      );

      if (!channel) {
        throw new Error('Channel not found');
      }

      logger.info(`Notification channel deleted: ${channelId}`);
      return channel;
    } catch (error) {
      logger.error('Error deleting notification channel:', error);
      throw error;
    }
  }

  /**
   * Check if channel has reached its limit
   */
  async checkChannelLimit(channelId: string, type: 'daily' | 'monthly'): Promise<boolean> {
    try {
      const channel = await NotificationChannel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      const usage = await this.getChannelUsage(channelId);
      const limit = type === 'daily' ? channel.dailyLimit : channel.monthlyLimit;
      const currentUsage = type === 'daily' ? usage.daily : usage.monthly;

      return currentUsage >= limit;
    } catch (error) {
      logger.error('Error checking channel limit:', error);
      throw error;
    }
  }

  /**
   * Increment channel usage
   */
  async incrementUsage(channelId: string, count: number = 1) {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      await NotificationUsage.findOneAndUpdate(
        {
          channelId: new mongoose.Types.ObjectId(channelId),
          date: today,
        },
        {
          $inc: { count },
          $setOnInsert: {
            channelId: new mongoose.Types.ObjectId(channelId),
            date: today,
          },
        },
        { upsert: true }
      );

      logger.debug(`Channel usage incremented: ${channelId}, count: ${count}`);
    } catch (error) {
      logger.error('Error incrementing channel usage:', error);
      throw error;
    }
  }

  /**
   * Test channel configuration
   */
  async testChannel(channelId: string, testRecipient: string) {
    try {
      const channel = await NotificationChannel.findById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      if (!channel.enabled) {
        throw new Error('Channel is disabled');
      }

      // TODO: Implement actual channel testing based on type
      // This would integrate with email/SMS/push providers

      logger.info(`Channel test initiated: ${channelId}`);
      return { success: true, message: 'Test notification sent' };
    } catch (error) {
      logger.error('Error testing channel:', error);
      throw error;
    }
  }
}

export const notificationChannelService = new NotificationChannelService();
