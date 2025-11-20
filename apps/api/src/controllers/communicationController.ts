import { Request, Response } from "express";
import mongoose from "mongoose";
import { communicationService } from "../services/communicationService";
import { messageSearchService } from "../services/messageSearchService";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import User from "../models/User";
import Patient from "../models/Patient";
import { SearchHistory, SavedSearch } from "../models/SearchHistory";
import logger from "../utils/logger";
import FileUploadService from "../services/fileUploadService";
import { AuthenticatedRequest } from "../types/auth";

// Helper function to convert ObjectId to string
const toStringId = (id: string | mongoose.Types.ObjectId): string => {
  return typeof id === 'string' ? id : id.toString();
};

/**
 * Controller for communication hub endpoints
 */
export class CommunicationController {
  /**
   * Get user's conversations
   */
  async getConversations(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = typeof req.user!.workplaceId === 'string'
        ? req.user!.workplaceId
        : req.user!.workplaceId.toString();

      const filters = {
        status: req.query.status as
          | "active"
          | "resolved"
          | "closed"
          | "archived"
          | undefined,
        type: req.query.type as
          | "direct"
          | "group"
          | "patient_query"
          | "clinical_consultation"
          | undefined,
        priority: req.query.priority as
          | "normal"
          | "high"
          | "urgent"
          | "low"
          | undefined,
        patientId: req.query.patientId as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        tags: req.query.tags
          ? Array.isArray(req.query.tags)
            ? (req.query.tags as string[]).map((tag) => tag.toString())
            : [req.query.tags.toString()]
          : undefined,
      };

      const conversations = await communicationService.getConversations(
        userId,
        workplaceId,
        filters,
      );

      // Add unread counts for each conversation
      const conversationsWithUnread = conversations.map((conv) => ({
        ...conv.toObject(),
        unreadCount: conv.unreadCount.get(userId) || 0,
      }));

      res.json({
        success: true,
        data: conversationsWithUnread,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: conversationsWithUnread.length,
        },
      });
    } catch (error) {
      logger.error("Error getting conversations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      const conversationData = {
        ...req.body,
        createdBy: userId,
        workplaceId,
        // Allow super admins to create cross-workplace conversations
        skipWorkplaceValidation: req.user!.role === 'super_admin',
      };

      const conversation =
        await communicationService.createConversation(conversationData);

      // Get socket service and notify participants
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket) {
        conversation.participants.forEach((participant) => {
          if (participant.userId.toString() !== userId) {
            communicationSocket.io
              .to(`user:${participant.userId}`)
              .emit("conversation:created", {
                conversation: conversation.toObject(),
                timestamp: new Date(),
              });
          }
        });
      }

      res.status(201).json({
        success: true,
        data: conversation,
        message: "Conversation created successfully",
      });
    } catch (error) {
      logger.error("Error creating conversation:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create conversation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get conversation details
   */
  async getConversation(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      })
        .populate("participants.userId", "firstName lastName role")
        .populate("patientId", "firstName lastName mrn")
        .populate("lastMessageId", "content.text senderId createdAt");

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: "Conversation not found or access denied",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...conversation.toObject(),
          unreadCount: conversation.unreadCount.get(userId) || 0,
        },
      });
    } catch (error) {
      logger.error("Error getting conversation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update conversation
   */
  async updateConversation(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: "Conversation not found or access denied",
        });
        return;
      }

      // Check permissions
      const userRole = conversation.getParticipantRole(userId as any);
      if (!userRole || !["pharmacist", "doctor"].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to update conversation",
        });
        return;
      }

      // Update fields
      if (req.body.title) conversation.title = req.body.title;
      if (req.body.priority) conversation.priority = req.body.priority;
      if (req.body.tags) conversation.tags = req.body.tags;
      if (req.body.status) conversation.status = req.body.status;

      (conversation as any).updatedBy = userId as any;
      await conversation.save();

      // Notify participants via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket) {
        communicationSocket.sendConversationUpdate(conversationId, {
          updates: req.body,
          updatedBy: userId,
        });
      }

      res.json({
        success: true,
        data: conversation,
        message: "Conversation updated successfully",
      });
    } catch (error) {
      logger.error("Error updating conversation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update conversation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Add participant to conversation
   */
  async addParticipant(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const conversationId = req.params.id;
      const { userId: newUserId, role } = req.body;
      const addedBy = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!conversationId || typeof conversationId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid conversation ID is required",
        });
        return;
      }

      await communicationService.addParticipant(
        conversationId,
        newUserId,
        role,
        addedBy,
        workplaceId,
      );

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket) {
        communicationSocket.sendConversationUpdate(conversationId, {
          action: "participant_added",
          userId: newUserId,
          addedBy,
        });
      }

      res.json({
        success: true,
        message: "Participant added successfully",
      });
    } catch (error) {
      logger.error("Error adding participant:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add participant",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const conversationId = req.params.id;
      const userIdToRemove = req.params.userId;

      if (!userIdToRemove || typeof userIdToRemove !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid user ID is required",
        });
        return;
      }
      const removedBy = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!conversationId || typeof conversationId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid conversation ID is required",
        });
        return;
      }

      await communicationService.removeParticipant(
        conversationId,
        userIdToRemove,
        removedBy,
        workplaceId,
      );

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket) {
        communicationSocket.sendConversationUpdate(conversationId, {
          action: "participant_removed",
          userId: userIdToRemove,
          removedBy,
        });
      }

      res.json({
        success: true,
        message: "Participant removed successfully",
      });
    } catch (error) {
      logger.error("Error removing participant:", error);
      res.status(400).json({
        success: false,
        message: "Failed to remove participant",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const isAdmin = userRole === 'super_admin' || (req as any).isAdmin === true;

      if (!conversationId || typeof conversationId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid conversation ID is required",
        });
        return;
      }

      // For super admins, fetch the conversation to get its workplaceId
      // For regular users, use their workplaceId
      let workplaceId: string;
      if (isAdmin) {
        const conversation = await Conversation.findById(conversationId).select('workplaceId');
        if (!conversation) {
          res.status(404).json({
            success: false,
            message: "Conversation not found",
          });
          return;
        }
        workplaceId = toStringId(conversation.workplaceId);
      } else {
        workplaceId = toStringId(req.user!.workplaceId);
      }

      const filters = {
        type: req.query.type as
          | "text"
          | "file"
          | "image"
          | "clinical_note"
          | "system"
          | "voice_note"
          | undefined,
        senderId: req.query.senderId as string,
        mentions: req.query.mentions as string,
        priority: req.query.priority as
          | "normal"
          | "high"
          | "urgent"
          | undefined,
        before: req.query.before
          ? new Date(req.query.before as string)
          : undefined,
        after: req.query.after
          ? new Date(req.query.after as string)
          : undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const messages = await communicationService.getMessages(
        conversationId,
        userId,
        workplaceId,
        filters,
        isAdmin, // Skip participant check for super admins
      );

      // Ensure ObjectIds are properly serialized to strings
      const serializedMessages = messages.map(message => {
        const messageObj = message.toObject ? message.toObject() : message;
        return {
          ...messageObj,
          _id: messageObj._id ? messageObj._id.toString() : undefined,
          conversationId: messageObj.conversationId ? messageObj.conversationId.toString() : undefined,
          senderId: typeof messageObj.senderId === 'object' && messageObj.senderId._id
            ? messageObj.senderId._id.toString()
            : messageObj.senderId ? messageObj.senderId.toString() : undefined,
        };
      });

      res.json({
        success: true,
        data: serializedMessages,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: messages.length,
        },
      });
    } catch (error) {
      logger.error("Error getting messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send a message
   */
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const conversationId = req.params.id;
      const senderId = req.user!.id;
      const userRole = req.user!.role;
      const isAdmin = userRole === 'super_admin' || (req as any).isAdmin === true;

      if (!conversationId || typeof conversationId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid conversation ID is required",
        });
        return;
      }

      // For super admins, fetch the conversation to get its workplaceId
      // For regular users, use their workplaceId
      let workplaceId: string;
      if (isAdmin) {
        const conversation = await Conversation.findById(conversationId).select('workplaceId');
        if (!conversation) {
          res.status(404).json({
            success: false,
            message: "Conversation not found",
          });
          return;
        }
        workplaceId = toStringId(conversation.workplaceId);
        logger.info('🔍 [sendMessage] Super admin sending message to cross-workplace conversation', {
          conversationId,
          conversationWorkplaceId: workplaceId,
          userWorkplaceId: toStringId(req.user!.workplaceId),
        });
      } else {
        workplaceId = toStringId(req.user!.workplaceId);
      }

      // Parse JSON strings from FormData if needed
      let content = req.body.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (error) {
          res.status(400).json({
            success: false,
            message: "Invalid content format",
          });
          return;
        }
      }

      let mentions = req.body.mentions;
      if (typeof mentions === 'string') {
        try {
          mentions = JSON.parse(mentions);
        } catch (error) {
          mentions = [];
        }
      }

      const messageData = {
        conversationId,
        senderId,
        workplaceId,
        content,
        threadId: req.body.threadId,
        parentMessageId: req.body.parentMessageId,
        mentions,
        priority: req.body.priority,
      };

      logger.info('🔍 [sendMessage] Attempting to send message', {
        conversationId,
        senderId,
        workplaceId,
        hasContent: !!messageData.content,
        contentType: messageData.content?.type,
      });

      const message = await communicationService.sendMessage(messageData);

      logger.info('✅ [sendMessage] Message sent successfully', {
        messageId: message._id,
        conversationId,
      });

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket) {
        communicationSocket.sendMessageNotification(
          conversationId,
          message,
          senderId,
        );
      }

      res.status(201).json({
        success: true,
        data: message,
        message: "Message sent successfully",
      });
    } catch (error) {
      logger.error("❌ [sendMessage] Error sending message:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.params.id,
        senderId: req.user?.id,
      });
      res.status(400).json({
        success: false,
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!messageId || typeof messageId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      await communicationService.markMessageAsRead(
        messageId,
        userId,
        workplaceId,
      );

      res.json({
        success: true,
        message: "Message marked as read",
      });
    } catch (error) {
      logger.error("Error marking message as read:", error);
      res.status(400).json({
        success: false,
        message: "Failed to mark message as read",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const messageId = req.params.id;
      const { emoji } = req.body;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!messageId || typeof messageId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      await communicationService.addMessageReaction(
        messageId,
        userId,
        emoji,
        workplaceId,
      );

      // Get updated message for socket notification
      const message = await Message.findById(messageId);

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket && message) {
        communicationSocket.io
          .to(`conversation:${message.conversationId}`)
          .emit("message:reaction_added", {
            messageId,
            emoji,
            userId,
            timestamp: new Date(),
            reactions: message.reactions,
          });
      }

      res.json({
        success: true,
        message: "Reaction added successfully",
      });
    } catch (error) {
      logger.error("Error adding reaction:", error);
      res.status(400).json({
        success: false,
        message: "Failed to add reaction",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const messageId = req.params.id;
      const emoji = req.params.emoji;

      if (!emoji || typeof emoji !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid emoji is required",
        });
        return;
      }
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!messageId || typeof messageId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      await communicationService.removeMessageReaction(
        messageId,
        userId,
        emoji,
        workplaceId,
      );

      // Get updated message for socket notification
      const message = await Message.findById(messageId);

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket && message) {
        communicationSocket.io
          .to(`conversation:${message.conversationId}`)
          .emit("message:reaction_removed", {
            messageId,
            emoji,
            userId,
            timestamp: new Date(),
            reactions: message.reactions,
          });
      }

      res.json({
        success: true,
        message: "Reaction removed successfully",
      });
    } catch (error) {
      logger.error("Error removing reaction:", error);
      res.status(400).json({
        success: false,
        message: "Failed to remove reaction",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Edit message
   */
  async editMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const messageId = req.params.id;
      const { content, reason } = req.body;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      const message = await Message.findOne({
        _id: messageId,
        senderId: userId,
        workplaceId,
      });

      if (!message) {
        res.status(404).json({
          success: false,
          message: "Message not found or not authorized to edit",
        });
        return;
      }

      if (!messageId || typeof messageId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      await communicationService.editMessage(
        messageId,
        userId,
        content,
        reason || "Message edited",
        workplaceId,
      );

      // Get updated message
      const updatedMessage = await Message.findById(messageId)
        .populate("senderId", "firstName lastName role")
        .populate("editHistory.editedBy", "firstName lastName");

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket && updatedMessage) {
        communicationSocket.io
          .to(`conversation:${updatedMessage.conversationId}`)
          .emit("message:edited", {
            messageId,
            content,
            editedBy: userId,
            timestamp: new Date(),
            editHistory: updatedMessage.editHistory,
          });
      }

      res.json({
        success: true,
        data: updatedMessage,
        message: "Message edited successfully",
      });
    } catch (error) {
      logger.error("Error editing message:", error);
      res.status(400).json({
        success: false,
        message: "Failed to edit message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const messageId = req.params.id;
      const { reason } = req.body;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!messageId || typeof messageId !== "string") {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      await communicationService.deleteMessage(
        messageId,
        userId,
        workplaceId,
        reason,
      );

      // Get updated message to show deletion
      const message = await Message.findById(messageId);

      // Notify via socket
      const app = req.app;
      const communicationSocket = app.get("communicationSocket");
      if (communicationSocket && message) {
        communicationSocket.io
          .to(`conversation:${message.conversationId}`)
          .emit("message:deleted", {
            messageId,
            deletedBy: userId,
            timestamp: new Date(),
            reason,
          });
      }

      res.json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting message:", error);
      res.status(400).json({
        success: false,
        message: "Failed to delete message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get message statuses
   */
  async getMessageStatuses(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { messageIds } = req.body;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Message IDs array is required",
        });
        return;
      }

      const statuses = await communicationService.getMessageStatuses(
        messageIds,
        userId,
        workplaceId,
      );

      res.json({
        success: true,
        data: statuses,
      });
    } catch (error) {
      logger.error("Error getting message statuses:", error);
      res.status(400).json({
        success: false,
        message: "Failed to get message statuses",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Enhanced message search with advanced filtering and analytics
   */
  async searchMessages(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const query = req.query.q as string;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      const filters = {
        query,
        conversationId: req.query.conversationId as string,
        senderId: req.query.senderId as string,
        participantId: req.query.participantId as string,
        messageType: req.query.type as any,
        fileType: req.query.fileType as string,
        priority: req.query.priority as any,
        hasAttachments:
          req.query.hasAttachments === "true"
            ? true
            : req.query.hasAttachments === "false"
              ? false
              : undefined,
        hasMentions:
          req.query.hasMentions === "true"
            ? true
            : req.query.hasMentions === "false"
              ? false
              : undefined,
        dateFrom: req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : undefined,
        dateTo: req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : undefined,
        tags: req.query.tags
          ? Array.isArray(req.query.tags)
            ? (req.query.tags as string[]).map((tag) => tag.toString())
            : [req.query.tags.toString()]
          : undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        sortBy: (req.query.sortBy as any) || "relevance",
        sortOrder: (req.query.sortOrder as any) || "desc",
      };

      const { results, stats } = await messageSearchService.searchMessages(
        workplaceId,
        userId,
        filters,
      );

      // Save search history if query is provided
      if (query && query.trim()) {
        await messageSearchService.saveSearchHistory(
          userId,
          query,
          filters,
          stats.totalResults,
        );

        // Create search history record
        const searchHistory = new SearchHistory({
          userId,
          workplaceId,
          query: query.trim(),
          filters: {
            conversationId: filters.conversationId,
            senderId: filters.senderId,
            messageType: filters.messageType,
            priority: filters.priority,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            tags: filters.tags,
          },
          resultCount: stats.totalResults,
          searchType: "message",
          executionTime: Date.now() - startTime,
        });

        await searchHistory.save();
      }

      res.json({
        success: true,
        data: results,
        stats,
        query,
        filters: {
          applied: Object.keys(filters).filter(
            (key) =>
              filters[key as keyof typeof filters] !== undefined &&
              filters[key as keyof typeof filters] !== null &&
              filters[key as keyof typeof filters] !== "",
          ),
          available: [
            "conversationId",
            "senderId",
            "participantId",
            "messageType",
            "fileType",
            "priority",
            "hasAttachments",
            "hasMentions",
            "dateFrom",
            "dateTo",
            "tags",
          ],
        },
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: stats.totalResults,
          hasMore: stats.totalResults > filters.offset + filters.limit,
        },
      });
    } catch (error) {
      logger.error("Error in enhanced message search:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search messages",
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Enhanced conversation search with advanced filtering
   */
  async searchConversations(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const query = req.query.q as string;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      const filters = {
        query,
        priority: req.query.priority as any,
        tags: req.query.tags
          ? Array.isArray(req.query.tags)
            ? (req.query.tags as string[]).map((tag) => tag.toString())
            : [req.query.tags.toString()]
          : undefined,
        dateFrom: req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : undefined,
        dateTo: req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        sortBy: (req.query.sortBy as any) || "relevance",
        sortOrder: (req.query.sortOrder as any) || "desc",
      };

      const { results, stats } = await messageSearchService.searchConversations(
        workplaceId,
        userId,
        filters,
      );

      // Save search history if query is provided
      if (query && query.trim()) {
        const searchHistory = new SearchHistory({
          userId,
          workplaceId,
          query: query.trim(),
          filters: {
            priority: filters.priority,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            tags: filters.tags,
          },
          resultCount: stats.totalResults || 0,
          searchType: "conversation",
          executionTime: Date.now() - startTime,
        });

        await searchHistory.save();
      }

      res.json({
        success: true,
        data: results,
        stats,
        query,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: stats.totalResults || 0,
          hasMore: (stats.totalResults || 0) > filters.offset + filters.limit,
        },
      });
    } catch (error) {
      logger.error("Error in enhanced conversation search:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search conversations",
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Get conversations for a specific patient
   */
  async getPatientConversations(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const patientId = req.params.patientId;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      // Check if the authenticated user is the patient themselves
      const isPatientSelf = userId === patientId;

      let patientInfo: any = null;
      let targetWorkplaceId = workplaceId;

      if (isPatientSelf) {
        // For patient portal users, check User collection first
        const user = await User.findById(patientId);

        if (!user) {
          res.status(404).json({
            success: false,
            message: "User not found",
          });
          return;
        }

        // Try to find Patient document, but don't require it
        const patient = await Patient.findOne({ _id: patientId });

        if (patient) {
          // Use patient data if available
          patientInfo = {
            id: patient._id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            mrn: patient.mrn,
          };
          targetWorkplaceId = toStringId(patient.workplaceId);
        } else {
          // Fall back to user data
          patientInfo = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            mrn: null,
          };
          targetWorkplaceId = toStringId(user.workplaceId);
        }
      } else {
        // For healthcare providers accessing patient data, require Patient document
        const patient = await Patient.findOne({
          _id: patientId,
          workplaceId,
        });

        if (!patient) {
          res.status(404).json({
            success: false,
            message: "Patient not found",
          });
          return;
        }

        patientInfo = {
          id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          mrn: patient.mrn,
        };
        targetWorkplaceId = workplaceId;
      }

      const filters = {
        patientId,
        status: req.query.status as
          | "active"
          | "resolved"
          | "closed"
          | "archived"
          | undefined,
        type: req.query.type as
          | "direct"
          | "group"
          | "patient_query"
          | "clinical_consultation"
          | undefined,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const conversations = await communicationService.getConversations(
        userId,
        targetWorkplaceId,
        filters,
      );

      res.json({
        success: true,
        data: conversations,
        patient: patientInfo,
      });
    } catch (error) {
      logger.error("Error getting patient conversations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get patient conversations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create a patient query conversation
   */
  async createPatientQuery(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const patientId = req.params.patientId;
      const { title, message, priority, tags } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const workplaceId = toStringId(req.user!.workplaceId);

      // Check if user is super admin or has admin flag set by middleware
      const isAdmin = userRole === 'super_admin' || (req as any).isAdmin === true;

      // Debug logging
      logger.info('🔍 [createPatientQuery] Request details:', {
        patientId,
        userId,
        userRole,
        workplaceId,
        isAdmin,
        hasMessage: !!message,
      });

      // Verify patient exists - admins can access patients from any workplace
      const patientQuery: any = { _id: patientId };
      if (!isAdmin) {
        patientQuery.workplaceId = workplaceId;
      }

      logger.info('🔍 [createPatientQuery] Patient query:', patientQuery);

      const patient = await Patient.findOne(patientQuery);

      logger.info('🔍 [createPatientQuery] Patient found:', {
        found: !!patient,
        patientWorkplaceId: patient?.workplaceId?.toString(),
        requestWorkplaceId: workplaceId,
      });

      if (!patient) {
        logger.warn('⚠️ [createPatientQuery] Patient not found with query:', patientQuery);
        res.status(404).json({
          success: false,
          message: "Patient not found",
        });
        return;
      }

      // Use the patient's workplace for finding healthcare providers
      const targetWorkplaceId = toStringId(patient.workplaceId);

      // Find appropriate healthcare providers to include
      const healthcareProviders = await User.find({
        workplaceId: targetWorkplaceId,
        role: { $in: ["pharmacist", "doctor"] },
        isActive: true,
      }).limit(5); // Include up to 5 providers

      const participants = [
        userId,
        ...healthcareProviders.map((p) => p._id.toString()),
      ];

      // Create conversation - use patient's workplace
      const conversationData = {
        title: title || `Query for ${patient.firstName} ${patient.lastName}`,
        type: "patient_query" as const,
        participants,
        patientId,
        priority: priority || "normal",
        tags: tags || ["patient-query"],
        createdBy: userId,
        workplaceId: targetWorkplaceId,
        skipWorkplaceValidation: isAdmin, // Allow super admins to create cross-workplace conversations
      };

      logger.info('🔍 [createPatientQuery] Creating conversation with data:', {
        participantsCount: participants.length,
        targetWorkplaceId,
        skipWorkplaceValidation: isAdmin,
      });

      const conversation =
        await communicationService.createConversation(conversationData);

      // Send initial message - use patient's workplace
      const messageData = {
        conversationId: conversation._id.toString(),
        senderId: userId,
        workplaceId: targetWorkplaceId,
        content: {
          text: message,
          type: "text" as const,
        },
        priority: priority || "normal",
      };

      const initialMessage =
        await communicationService.sendMessage(messageData);

      res.status(201).json({
        success: true,
        data: {
          conversation,
          initialMessage,
        },
        message: "Patient query created successfully",
      });
    } catch (error) {
      logger.error("Error creating patient query:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create patient query",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const workplaceId = req.user!.workplaceId;
      const dateFrom = req.query.dateFrom
        ? new Date(req.query.dateFrom as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = req.query.dateTo
        ? new Date(req.query.dateTo as string)
        : new Date();
      const patientId = req.query.patientId as string;

      const matchQuery: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        createdAt: { $gte: dateFrom, $lte: dateTo },
      };

      if (patientId) {
        matchQuery.patientId = new mongoose.Types.ObjectId(patientId);
      }

      // Get conversation statistics
      const conversationStats = await Conversation.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            activeConversations: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            resolvedConversations: {
              $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
            },
            urgentConversations: {
              $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
            },
          },
        },
      ]);

      // Get message statistics
      const messageStats = await Message.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            textMessages: {
              $sum: { $cond: [{ $eq: ["$content.type", "text"] }, 1, 0] },
            },
            fileMessages: {
              $sum: { $cond: [{ $eq: ["$content.type", "file"] }, 1, 0] },
            },
            urgentMessages: {
              $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
            },
          },
        },
      ]);

      // Get response time statistics
      const responseTimeStats = await Message.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "messages",
            let: {
              conversationId: "$conversationId",
              messageTime: "$createdAt",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$conversationId", "$$conversationId"] },
                      { $lt: ["$createdAt", "$$messageTime"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "previousMessage",
          },
        },
        {
          $match: {
            previousMessage: { $ne: [] },
          },
        },
        {
          $addFields: {
            responseTime: {
              $subtract: [
                "$createdAt",
                { $arrayElemAt: ["$previousMessage.createdAt", 0] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: "$responseTime" },
            minResponseTime: { $min: "$responseTime" },
            maxResponseTime: { $max: "$responseTime" },
          },
        },
      ]);

      const summary = {
        dateRange: { from: dateFrom, to: dateTo },
        conversations: conversationStats[0] || {
          totalConversations: 0,
          activeConversations: 0,
          resolvedConversations: 0,
          urgentConversations: 0,
        },
        messages: messageStats[0] || {
          totalMessages: 0,
          textMessages: 0,
          fileMessages: 0,
          urgentMessages: 0,
        },
        responseTime: responseTimeStats[0]
          ? {
            average: Math.round(
              responseTimeStats[0].avgResponseTime / (1000 * 60),
            ), // minutes
            min: Math.round(
              responseTimeStats[0].minResponseTime / (1000 * 60),
            ),
            max: Math.round(
              responseTimeStats[0].maxResponseTime / (1000 * 60),
            ),
          }
          : null,
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error("Error getting analytics summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get analytics summary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Upload files for communication
   */
  async uploadFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const files = req.files as any[];
      const { conversationId, messageType = "file" } = req.body;
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
        return;
      }

      // Validate conversation if provided
      if (conversationId) {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          workplaceId,
          "participants.userId": userId,
          "participants.leftAt": { $exists: false },
        });

        if (!conversation) {
          res.status(404).json({
            success: false,
            message: "Conversation not found or access denied",
          });
          return;
        }
      }

      // Process uploaded files
      const processedFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          const result = await FileUploadService.processUploadedFile(file);

          if (result.success) {
            processedFiles.push({
              fileId: result.fileData.fileName,
              fileName: result.fileData.originalName,
              fileSize: result.fileData.size,
              mimeType: result.fileData.mimeType,
              secureUrl: result.fileData.url,
              uploadedAt: result.fileData.uploadedAt,
            });
          } else {
            errors.push({
              fileName: file.originalname,
              error: result.error,
            });
          }
        } catch (error) {
          errors.push({
            fileName: file.originalname,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // If sending as message, create message with attachments
      if (conversationId && processedFiles.length > 0) {
        const messageData = {
          conversationId,
          senderId: userId,
          workplaceId,
          content: {
            text: `Shared ${processedFiles.length} file(s)`,
            type: messageType as any,
            attachments: processedFiles,
          },
        };

        const message = await communicationService.sendMessage(messageData);

        // Notify via socket
        const app = req.app;
        const communicationSocket = app.get("communicationSocket");
        if (communicationSocket) {
          communicationSocket.sendMessageNotification(
            conversationId,
            message,
            userId,
          );
        }
      }

      res.status(201).json({
        success: true,
        data: {
          uploadedFiles: processedFiles,
          errors: errors.length > 0 ? errors : undefined,
        },
        message: `Successfully uploaded ${processedFiles.length} file(s)`,
      });
    } catch (error) {
      logger.error("Error uploading files:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload files",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get file details and secure download URL
   */
  async getFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      // Check if file exists
      if (
        !fileId ||
        typeof fileId !== "string" ||
        !FileUploadService.fileExists(fileId)
      ) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Find message containing this file to verify access
      const message = await Message.findOne({
        workplaceId,
        "content.attachments.fileId": fileId,
      }).populate("conversationId");

      if (!message) {
        res.status(404).json({
          success: false,
          message: "File not found in any accessible conversation",
        });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        res.status(403).json({
          success: false,
          message: "Access denied to this file",
        });
        return;
      }

      // Get file attachment details
      const attachment = message.content.attachments?.find(
        (att) => att.fileId === fileId,
      );
      if (!attachment) {
        res.status(404).json({
          success: false,
          message: "File attachment not found",
        });
        return;
      }

      // Get file stats
      const fileStats = fileId ? FileUploadService.getFileStats(fileId) : null;

      res.json({
        success: true,
        data: {
          fileId: attachment.fileId,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          secureUrl: attachment.secureUrl,
          uploadedAt: attachment.uploadedAt,
          conversationId: message.conversationId,
          messageId: message._id,
          stats: fileStats
            ? {
              size: fileStats.size,
              created: fileStats.birthtime,
              modified: fileStats.mtime,
            }
            : null,
        },
      });
    } catch (error) {
      logger.error("Error getting file:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get file",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      // Find message containing this file
      const message = await Message.findOne({
        workplaceId,
        "content.attachments.fileId": fileId,
      });

      if (!message) {
        res.status(404).json({
          success: false,
          message: "File not found",
        });
        return;
      }

      // Verify user is the sender or has admin role
      const user = await User.findById(userId);
      if (
        message.senderId.toString() !== userId &&
        !["admin", "super_admin"].includes(user?.role || "")
      ) {
        res.status(403).json({
          success: false,
          message: "Only the file uploader or admin can delete files",
        });
        return;
      }

      // Delete file from filesystem
      const filePath = fileId ? FileUploadService.getFilePath(fileId) : null;
      if (!filePath) {
        res.status(404).json({
          success: false,
          message: "File path not found",
        });
        return;
      }
      await FileUploadService.deleteFile(filePath);

      // Remove attachment from message
      message.content.attachments =
        message.content.attachments?.filter((att) => att.fileId !== fileId) ||
        [];
      await message.save();

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting file:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete file",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get all files shared in a conversation
   */
  async getConversationFiles(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;
      const { type, limit = 50, offset = 0 } = req.query;

      // Verify user has access to conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: "Conversation not found or access denied",
        });
        return;
      }

      // Build query for messages with attachments
      const query: any = {
        conversationId,
        "content.attachments": { $exists: true, $ne: [] },
      };

      if (type) {
        query["content.type"] = type;
      }

      // Get messages with files
      const messages = await Message.find(query)
        .populate("senderId", "firstName lastName role")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string));

      // Extract file information
      const files = [];
      for (const message of messages) {
        if (message.content.attachments) {
          for (const attachment of message.content.attachments) {
            files.push({
              ...attachment,
              messageId: message._id,
              senderId: message.senderId,
              sentAt: message.createdAt,
            });
          }
        }
      }

      res.json({
        success: true,
        data: files,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: files.length,
        },
      });
    } catch (error) {
      logger.error("Error getting conversation files:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation files",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const query = req.query.q as string;

      const suggestions = await messageSearchService.getSearchSuggestions(
        workplaceId,
        userId,
        query,
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      logger.error("Error getting search suggestions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get search suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const searchType = req.query.type as "message" | "conversation";
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await (SearchHistory as any).getRecentSearches(
        new mongoose.Types.ObjectId(userId),
        limit,
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error("Error getting search history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get search history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get popular searches in workplace
   */
  async getPopularSearches(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const workplaceId = req.user!.workplaceId;
      const searchType = req.query.type as "message" | "conversation";
      const limit = parseInt(req.query.limit as string) || 10;

      const popularSearches = await (SearchHistory as any).getPopularSearches(
        new mongoose.Types.ObjectId(workplaceId),
        searchType,
        limit,
      );

      res.json({
        success: true,
        data: popularSearches,
      });
    } catch (error) {
      logger.error("Error getting popular searches:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get popular searches",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Save a search for future use
   */
  async saveSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;

      const savedSearch = new SavedSearch({
        userId,
        workplaceId,
        name: req.body.name,
        description: req.body.description,
        query: req.body.query,
        filters: req.body.filters || {},
        searchType: req.body.searchType,
        isPublic: req.body.isPublic || false,
      });

      await savedSearch.save();

      res.status(201).json({
        success: true,
        data: savedSearch,
        message: "Search saved successfully",
      });
    } catch (error) {
      logger.error("Error saving search:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save search",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get user's saved searches
   */
  async getSavedSearches(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;
      const searchType = req.query.type as "message" | "conversation";
      const includePublic = req.query.includePublic === "true";

      let savedSearches;

      if (includePublic) {
        // Get both user's searches and public searches
        const [userSearches, publicSearches] = await Promise.all([
          (SavedSearch as any).getUserSearches(
            new mongoose.Types.ObjectId(userId),
            searchType,
          ),
          (SavedSearch as any).getPublicSearches(
            new mongoose.Types.ObjectId(workplaceId),
            searchType,
          ),
        ]);

        savedSearches = {
          userSearches,
          publicSearches: publicSearches.filter(
            (search: any) => search.userId.toString() !== userId,
          ),
        };
      } else {
        savedSearches = await (SavedSearch as any).getUserSearches(
          new mongoose.Types.ObjectId(userId),
          searchType,
        );
      }

      res.json({
        success: true,
        data: savedSearches,
      });
    } catch (error) {
      logger.error("Error getting saved searches:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get saved searches",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Use a saved search (increment use count)
   */
  async useSavedSearch(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const searchId = req.params.searchId;

      const savedSearch = await SavedSearch.findOne({
        _id: searchId,
        $or: [
          { userId },
          { isPublic: true, workplaceId: req.user!.workplaceId },
        ],
      });

      if (!savedSearch) {
        res.status(404).json({
          success: false,
          message: "Saved search not found",
        });
        return;
      }

      await (savedSearch as any).incrementUseCount();

      res.json({
        success: true,
        data: savedSearch,
        message: "Saved search loaded successfully",
      });
    } catch (error) {
      logger.error("Error using saved search:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load saved search",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const searchId = req.params.searchId;

      const savedSearch = await SavedSearch.findOneAndDelete({
        _id: searchId,
        userId, // Only allow users to delete their own searches
      });

      if (!savedSearch) {
        res.status(404).json({
          success: false,
          message: "Saved search not found or access denied",
        });
        return;
      }

      res.json({
        success: true,
        message: "Saved search deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting saved search:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete saved search",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create a thread from a message
   */
  async createThread(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const { messageId } = req.params;

      if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
        res.status(400).json({
          success: false,
          message: "Valid message ID is required",
        });
        return;
      }

      const threadId = await communicationService.createThread(
        messageId,
        userId,
        workplaceId,
      );

      res.json({
        success: true,
        message: "Thread created successfully",
        data: { threadId },
      });
    } catch (error) {
      logger.error("Error creating thread:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create thread",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get thread messages
   */
  async getThreadMessages(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const { threadId } = req.params;

      if (!threadId || !mongoose.Types.ObjectId.isValid(threadId)) {
        res.status(400).json({
          success: false,
          message: "Valid thread ID is required",
        });
        return;
      }

      const filters = {
        senderId: req.query.senderId as string,
        before: req.query.before
          ? new Date(req.query.before as string)
          : undefined,
        after: req.query.after
          ? new Date(req.query.after as string)
          : undefined,
        limit: parseInt(req.query.limit as string) || 100,
      };

      const threadData = await communicationService.getThreadMessages(
        threadId,
        userId,
        workplaceId,
        filters,
      );

      res.json({
        success: true,
        message: "Thread messages retrieved successfully",
        data: threadData,
      });
    } catch (error) {
      logger.error("Error getting thread messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get thread messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get thread summary
   */
  async getThreadSummary(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const { threadId } = req.params;

      if (!threadId || !mongoose.Types.ObjectId.isValid(threadId)) {
        res.status(400).json({
          success: false,
          message: "Valid thread ID is required",
        });
        return;
      }

      const summary = await communicationService.getThreadSummary(
        threadId,
        userId,
        workplaceId,
      );

      res.json({
        success: true,
        message: "Thread summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      logger.error("Error getting thread summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get thread summary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Reply to a thread
   */
  async replyToThread(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const { threadId } = req.params;

      if (!threadId || !mongoose.Types.ObjectId.isValid(threadId)) {
        res.status(400).json({
          success: false,
          message: "Valid thread ID is required",
        });
        return;
      }

      const { content, mentions, priority } = req.body;

      if (!content || !content.text?.trim()) {
        res.status(400).json({
          success: false,
          message: "Message content is required",
        });
        return;
      }

      // Handle file attachments
      let attachments: any[] = [];
      if (req.files && Array.isArray(req.files)) {
        attachments = req.files as any[];
      }

      const messageData = {
        conversationId: "", // Will be set by the service
        senderId: userId,
        content: {
          ...content,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        mentions: mentions || [],
        priority: priority || "normal",
        workplaceId,
      };

      const message = await communicationService.replyToThread(
        threadId,
        messageData,
      );

      res.status(201).json({
        success: true,
        message: "Reply sent successfully",
        data: message,
      });
    } catch (error) {
      logger.error("Error replying to thread:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send reply",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get conversation threads
   */
  async getConversationThreads(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = toStringId(req.user!.workplaceId);
      const { conversationId } = req.params;

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: "Valid conversation ID is required",
        });
        return;
      }

      const threads = await communicationService.getConversationThreads(
        conversationId,
        userId,
        workplaceId,
      );

      res.json({
        success: true,
        message: "Conversation threads retrieved successfully",
        data: threads,
      });
    } catch (error) {
      logger.error("Error getting conversation threads:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get conversation threads",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Search for participants to add to conversations
   */
  async searchParticipants(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId;
      const { q = '', role, limit = 50 } = req.query;

      logger.info('Searching participants:', { userId, workplaceId, q, role, limit });

      // Build search query - make workplaceId optional for flexibility
      const searchQuery: any = {
        status: 'active', // Only active users
        _id: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude current user
      };

      // Add workplace filter if user has a workplace
      if (workplaceId) {
        searchQuery.workplaceId = new mongoose.Types.ObjectId(workplaceId);
      }

      // Add role filter if specified
      if (role) {
        searchQuery.role = role;
      }

      // Add text search if query provided
      if (q && typeof q === 'string' && q.trim()) {
        searchQuery.$or = [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ];
      }

      logger.info('Search query:', JSON.stringify(searchQuery));

      // Find users
      let users = await User.find(searchQuery)
        .select('_id firstName lastName email role avatar')
        .limit(Number(limit))
        .lean();

      logger.info(`Found ${users.length} participants with workplace filter`);

      // If no users found and workplaceId was used, try again without workplace restriction
      if (users.length === 0 && workplaceId) {
        logger.info('No participants found with workplace filter, searching without workplace restriction');
        const broadSearchQuery: any = {
          status: 'active',
          _id: { $ne: new mongoose.Types.ObjectId(userId) },
        };

        if (role) {
          broadSearchQuery.role = role;
        }

        if (q && typeof q === 'string' && q.trim()) {
          broadSearchQuery.$or = [
            { firstName: { $regex: q, $options: 'i' } },
            { lastName: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ];
        }

        users = await User.find(broadSearchQuery)
          .select('_id firstName lastName email role avatar')
          .limit(Number(limit))
          .lean();

        logger.info(`Found ${users.length} participants without workplace filter`);
      }

      // Format response
      const participants = users.map((user: any) => ({
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      }));

      res.json({
        success: true,
        message: "Participants retrieved successfully",
        data: participants,
        count: participants.length,
      });
    } catch (error) {
      logger.error("Error searching participants:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search participants",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const communicationController = new CommunicationController();
export default communicationController;
