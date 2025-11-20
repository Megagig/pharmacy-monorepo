import * as cron from "node-cron";
import { notificationService } from "./notificationService";
import Notification from "../models/Notification";
import User from "../models/User";
import logger from "../utils/logger";
import mongoose from "mongoose";

interface ScheduledJob {
  id: string;
  cronExpression: string;
  task: cron.ScheduledTask;
  description: string;
}

/**
 * Service for scheduling and managing notification delivery
 */
export class NotificationSchedulerService {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.setupDefaultJobs();
  }

  /**
   * Start the notification scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Notification scheduler is already running");
      return;
    }

    this.scheduledJobs.forEach((job) => {
      job.task.start();
    });

    this.isRunning = true;
    logger.info("Notification scheduler started");
  }

  /**
   * Stop the notification scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn("Notification scheduler is not running");
      return;
    }

    this.scheduledJobs.forEach((job) => {
      job.task.stop();
    });

    this.isRunning = false;
    logger.info("Notification scheduler stopped");
  }

  /**
   * Setup default scheduled jobs
   */
  private setupDefaultJobs(): void {
    // Process scheduled notifications every minute
    this.addJob(
      "process-scheduled",
      "* * * * *", // Every minute
      async () => {
        await this.processScheduledNotifications();
      },
      "Process scheduled notifications",
    );

    // Retry failed notifications every 5 minutes
    this.addJob(
      "retry-failed",
      "*/5 * * * *", // Every 5 minutes
      async () => {
        await this.retryFailedNotifications();
      },
      "Retry failed notifications",
    );

    // Send daily digest at 8 AM
    this.addJob(
      "daily-digest",
      "0 8 * * *", // 8 AM daily
      async () => {
        await this.sendDailyDigests();
      },
      "Send daily notification digests",
    );

    // Send weekly digest on Monday at 9 AM
    this.addJob(
      "weekly-digest",
      "0 9 * * 1", // 9 AM on Mondays
      async () => {
        await this.sendWeeklyDigests();
      },
      "Send weekly notification digests",
    );

    // Clean up expired notifications daily at 2 AM
    this.addJob(
      "cleanup-expired",
      "0 2 * * *", // 2 AM daily
      async () => {
        await this.cleanupExpiredNotifications();
      },
      "Clean up expired notifications",
    );

    // Archive old notifications weekly on Sunday at 3 AM
    this.addJob(
      "archive-old",
      "0 3 * * 0", // 3 AM on Sundays
      async () => {
        await this.archiveOldNotifications();
      },
      "Archive old notifications",
    );

    // Update notification statistics hourly
    this.addJob(
      "update-stats",
      "0 * * * *", // Every hour
      async () => {
        await this.updateNotificationStatistics();
      },
      "Update notification statistics",
    );
  }

  /**
   * Add a new scheduled job
   */
  addJob(
    id: string,
    cronExpression: string,
    taskFunction: () => Promise<void>,
    description: string,
  ): void {
    if (this.scheduledJobs.has(id)) {
      logger.warn(`Job with id '${id}' already exists`);
      return;
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          logger.debug(`Running scheduled job: ${id}`);
          await taskFunction();
          logger.debug(`Completed scheduled job: ${id}`);
        } catch (error) {
          logger.error(`Error in scheduled job '${id}':`, error);
        }
      },
      {
        timezone: process.env.TIMEZONE || "UTC",
      },
    );

    this.scheduledJobs.set(id, {
      id,
      cronExpression,
      task,
      description,
    });

    logger.info(
      `Added scheduled job: ${id} (${cronExpression}) - ${description}`,
    );
  }

  /**
   * Remove a scheduled job
   */
  removeJob(id: string): void {
    const job = this.scheduledJobs.get(id);
    if (!job) {
      logger.warn(`Job with id '${id}' not found`);
      return;
    }

    job.task.stop();
    this.scheduledJobs.delete(id);
    logger.info(`Removed scheduled job: ${id}`);
  }

  /**
   * Process scheduled notifications that are due
   */
  private async processScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notification.find({
        scheduledFor: { $lte: new Date() },
        status: "pending",
      });

      if (scheduledNotifications.length === 0) {
        return;
      }

      logger.debug(
        `Processing ${scheduledNotifications.length} scheduled notifications`,
      );

      for (const notification of scheduledNotifications) {
        try {
          await notificationService.deliverNotification(notification);
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
    }
  }

  /**
   * Retry failed notifications
   */
  private async retryFailedNotifications(): Promise<void> {
    try {
      await notificationService.retryFailedNotifications();
    } catch (error) {
      logger.error("Error retrying failed notifications:", error);
    }
  }

  /**
   * Send daily notification digests
   */
  private async sendDailyDigests(): Promise<void> {
    try {
      const users = await User.find({
        "notificationPreferences.batchDigest": true,
        "notificationPreferences.digestFrequency": "daily",
      }).select(
        "_id email firstName lastName workplaceId notificationPreferences",
      );

      logger.debug(`Sending daily digests to ${users.length} users`);

      for (const user of users) {
        try {
          await this.sendDigestToUser(user, "daily");
        } catch (error) {
          logger.error(
            `Failed to send daily digest to user ${user._id}:`,
            error,
          );
        }
      }

      logger.info(`Sent daily digests to ${users.length} users`);
    } catch (error) {
      logger.error("Error sending daily digests:", error);
    }
  }

  /**
   * Send weekly notification digests
   */
  private async sendWeeklyDigests(): Promise<void> {
    try {
      const users = await User.find({
        "notificationPreferences.batchDigest": true,
        "notificationPreferences.digestFrequency": "weekly",
      }).select(
        "_id email firstName lastName workplaceId notificationPreferences",
      );

      logger.debug(`Sending weekly digests to ${users.length} users`);

      for (const user of users) {
        try {
          await this.sendDigestToUser(user, "weekly");
        } catch (error) {
          logger.error(
            `Failed to send weekly digest to user ${user._id}:`,
            error,
          );
        }
      }

      logger.info(`Sent weekly digests to ${users.length} users`);
    } catch (error) {
      logger.error("Error sending weekly digests:", error);
    }
  }

  /**
   * Send digest notification to a specific user
   */
  private async sendDigestToUser(
    user: any,
    frequency: "daily" | "weekly",
  ): Promise<void> {
    const now = new Date();
    const startDate = new Date();

    if (frequency === "daily") {
      startDate.setDate(now.getDate() - 1);
    } else {
      startDate.setDate(now.getDate() - 7);
    }

    // Get unread notifications for the period
    const notifications = await Notification.find({
      userId: user._id,
      workplaceId: user.workplaceId,
      status: "unread",
      createdAt: { $gte: startDate, $lte: now },
    })
      .populate("data.senderId", "firstName lastName")
      .populate("data.patientId", "firstName lastName mrn")
      .sort({ priority: -1, createdAt: -1 })
      .limit(20);

    if (notifications.length === 0) {
      return; // No notifications to digest
    }

    // Group notifications by type
    const groupedNotifications = notifications.reduce(
      (groups, notification) => {
        const type = notification.type;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(notification);
        return groups;
      },
      {} as Record<string, any[]>,
    );

    // Create digest content
    const digestContent = this.createDigestContent(
      groupedNotifications,
      frequency,
    );

    // Send digest notification
    await notificationService.createNotification({
      userId: user._id,
      type: "system_notification",
      title: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Notification Digest`,
      content: `You have ${notifications.length} unread notifications from the past ${frequency === "daily" ? "day" : "week"}.`,
      data: {
        metadata: {
          isDigest: true,
          frequency,
          notificationCount: notifications.length,
          digestContent,
        },
      },
      priority: "normal",
      deliveryChannels: {
        inApp: true,
        email: user.notificationPreferences?.email !== false,
        sms: false,
        push: false,
      },
      workplaceId: user.workplaceId,
      createdBy: user._id,
    });
  }

  /**
   * Create digest content from grouped notifications
   */
  private createDigestContent(
    groupedNotifications: Record<string, any[]>,
    frequency: string,
  ): string {
    let content = `<h3>${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Notification Summary</h3>`;

    const typeLabels: Record<string, string> = {
      new_message: "💬 New Messages",
      mention: "🏷️ Mentions",
      patient_query: "🏥 Patient Queries",
      clinical_alert: "⚕️ Clinical Alerts",
      therapy_update: "💊 Therapy Updates",
      urgent_message: "🚨 Urgent Messages",
      conversation_invite: "👥 Conversation Invites",
      file_shared: "📎 Files Shared",
    };

    Object.entries(groupedNotifications).forEach(([type, notifications]) => {
      const label = typeLabels[type] || type.replace("_", " ").toUpperCase();
      content += `<h4>${label} (${notifications.length})</h4><ul>`;

      notifications.slice(0, 5).forEach((notification) => {
        content += `<li>${notification.title} - ${notification.createdAt.toLocaleDateString()}</li>`;
      });

      if (notifications.length > 5) {
        content += `<li>... and ${notifications.length - 5} more</li>`;
      }

      content += "</ul>";
    });

    return content;
  }

  /**
   * Clean up expired notifications
   */
  private async cleanupExpiredNotifications(): Promise<void> {
    try {
      // Mark expired notifications as archived
      const result = await Notification.updateMany(
        {
          expiresAt: { $lt: new Date() },
          status: { $ne: "archived" },
        },
        {
          $set: {
            status: "archived",
            archivedAt: new Date(),
          },
        },
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `Marked ${result.modifiedCount} expired notifications as archived`,
        );
      }
    } catch (error) {
      logger.error("Error cleaning up expired notifications:", error);
    }
  }

  /**
   * Archive old notifications
   */
  private async archiveOldNotifications(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Archive notifications older than 90 days

      const result = await Notification.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          status: { $in: ["read", "dismissed"] },
        },
        {
          $set: {
            status: "archived",
            updatedAt: new Date(),
          },
        },
      );

      if (result.modifiedCount > 0) {
        logger.info(`Archived ${result.modifiedCount} old notifications`);
      }
    } catch (error) {
      logger.error("Error archiving old notifications:", error);
    }
  }

  /**
   * Update notification statistics
   */
  private async updateNotificationStatistics(): Promise<void> {
    try {
      // This could be used to update cached statistics or metrics
      // For now, we'll just log the current counts
      const stats = await Notification.aggregate([
        {
          $group: {
            _id: {
              status: "$status",
              type: "$type",
            },
            count: { $sum: 1 },
          },
        },
      ]);

      logger.debug("Current notification statistics:", stats);
    } catch (error) {
      logger.error("Error updating notification statistics:", error);
    }
  }

  /**
   * Schedule a one-time notification
   */
  async scheduleOneTimeNotification(
    notificationData: any,
    scheduledFor: Date,
  ): Promise<void> {
    const delay = scheduledFor.getTime() - Date.now();

    if (delay <= 0) {
      // Send immediately if scheduled time has passed
      await notificationService.createNotification(notificationData);
      return;
    }

    // Schedule for future delivery
    setTimeout(async () => {
      try {
        await notificationService.createNotification(notificationData);
        logger.debug(
          `Delivered scheduled notification for user ${notificationData.userId}`,
        );
      } catch (error) {
        logger.error("Error delivering scheduled notification:", error);
      }
    }, delay);

    logger.debug(
      `Scheduled one-time notification for ${scheduledFor.toISOString()}`,
    );
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    jobCount: number;
    jobs: Array<{ id: string; description: string; cronExpression: string }>;
  } {
    return {
      isRunning: this.isRunning,
      jobCount: this.scheduledJobs.size,
      jobs: Array.from(this.scheduledJobs.values()).map((job) => ({
        id: job.id,
        description: job.description,
        cronExpression: job.cronExpression,
      })),
    };
  }
}

export const notificationSchedulerService = new NotificationSchedulerService();
export default notificationSchedulerService;
