import mongoose from "mongoose";
import Conversation, { IConversation } from "../models/Conversation";
import Message, { IMessage } from "../models/Message";
import User from "../models/User";
import Patient from "../models/Patient";
import logger from "../utils/logger";
import { notificationService } from "./notificationService";
import CommunicationAuditService from "./communicationAuditService";

export interface CreateConversationData {
  title?: string;
  type: "direct" | "group" | "patient_query" | "clinical_consultation";
  participants: string[];
  patientId?: string;
  caseId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  tags?: string[];
  createdBy: string;
  workplaceId: string;
  skipWorkplaceValidation?: boolean; // Allow super admins to create cross-workplace conversations
}

export interface SendMessageData {
  conversationId: string;
  senderId: string;
  content: {
    text?: string;
    type: "text" | "file" | "image" | "clinical_note" | "system" | "voice_note";
    attachments?: any[];
    metadata?: any;
  };
  threadId?: string;
  parentMessageId?: string;
  mentions?: string[];
  priority?: "normal" | "high" | "urgent";
  workplaceId: string;
}

export interface ConversationFilters {
  status?: "active" | "archived" | "resolved" | "closed";
  type?: "direct" | "group" | "patient_query" | "clinical_consultation";
  priority?: "low" | "normal" | "high" | "urgent";
  patientId?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MessageFilters {
  type?: "text" | "file" | "image" | "clinical_note" | "system" | "voice_note";
  senderId?: string;
  mentions?: string;
  priority?: "normal" | "high" | "urgent";
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  conversationId?: string;
  senderId?: string;
  type?: string;
  priority?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

/**
 * Service for managing conversations and messages
 */
export class CommunicationService {
  /**
   * Create a new conversation
   */
  async createConversation(
    data: CreateConversationData,
  ): Promise<IConversation> {
    try {
      // Extract participant IDs (handle both string array and object array formats)
      const participantIds = data.participants.map((p: any) =>
        typeof p === 'string' ? p : p.userId
      );

      // Ensure the creator is included as a participant for ALL conversation types
      if (!participantIds.includes(data.createdBy)) {
        logger.warn('Creator not in participants, adding them', {
          createdBy: data.createdBy,
          type: data.type,
          participants: participantIds,
          service: 'communication-service'
        });
        participantIds.push(data.createdBy);
      }

      // Validate participants exist and belong to the same workplace
      // Skip workplace validation for super admins creating cross-workplace conversations
      // Validate participants - they can be either users or patients
      const participantQuery: any = { _id: { $in: participantIds } };
      if (!data.skipWorkplaceValidation) {
        participantQuery.workplaceId = data.workplaceId;
      }

      // Check both User and Patient collections for participants
      logger.info('Searching for participants', {
        participantIds,
        participantQuery,
        workplaceId: data.workplaceId,
        skipWorkplaceValidation: data.skipWorkplaceValidation,
      });

      const [users, patients] = await Promise.all([
        User.find(participantQuery).select("_id role firstName lastName"),
        Patient.find(participantQuery).select("_id firstName lastName")
      ]);

      logger.info('Participant search results', {
        usersFound: users.map(u => ({ id: u._id.toString(), role: u.role, name: `${u.firstName} ${u.lastName}` })),
        patientsFound: patients.map(p => ({ id: p._id.toString(), name: `${p.firstName} ${p.lastName}` })),
      });

      // If no patients found with workspace filter, check if they exist at all
      if (patients.length === 0 && !data.skipWorkplaceValidation) {
        const patientsWithoutWorkspaceFilter = await Patient.find({ _id: { $in: participantIds } }).select("_id firstName lastName workplaceId");
        logger.info('Patients found without workspace filter', {
          patientsFound: patientsWithoutWorkspaceFilter.map(p => ({
            id: p._id.toString(),
            name: `${p.firstName} ${p.lastName}`,
            workplaceId: p.workplaceId?.toString()
          })),
        });
      }

      // Combine users and patients, adding role for patients
      const allParticipants = [
        ...users.map(u => ({ _id: u._id, role: u.role, firstName: u.firstName, lastName: u.lastName })),
        ...patients.map(p => ({ _id: p._id, role: 'patient', firstName: p.firstName, lastName: p.lastName }))
      ];

      if (allParticipants.length !== participantIds.length) {
        logger.error('Participant validation failed', {
          expected: participantIds.length,
          found: allParticipants.length,
          participantIds,
          foundIds: allParticipants.map(p => p._id.toString()),
          foundUsers: users.length,
          foundPatients: patients.length,
          workplaceId: data.workplaceId,
          skipValidation: data.skipWorkplaceValidation,
        });
        throw new Error(
          "Some participants not found or not in the same workplace",
        );
      }

      const participants = allParticipants;

      // Validate patient if provided
      if (data.patientId) {
        const patientQuery: any = { _id: data.patientId };
        if (!data.skipWorkplaceValidation) {
          patientQuery.workplaceId = data.workplaceId;
        }

        const patient = await Patient.findOne(patientQuery);

        if (!patient) {
          throw new Error("Patient not found or not in the same workplace");
        }
      }

      // Create conversation
      const conversation = new Conversation({
        title: data.title,
        type: data.type,
        participants: participants.map((p) => ({
          userId: p._id,
          role: p.role,
          joinedAt: new Date(),
          permissions: this.getDefaultPermissions(p.role),
        })),
        patientId: data.patientId,
        caseId: data.caseId,
        priority: data.priority || "normal",
        tags: data.tags || [],
        createdBy: data.createdBy,
        workplaceId: data.workplaceId,
        metadata: {
          isEncrypted: true,
          priority: data.priority || "normal",
          tags: data.tags || [],
        },
      });

      await conversation.save();

      // Create system message for conversation creation
      await this.createSystemMessage(
        conversation._id.toString(),
        data.createdBy,
        "conversation_created",
        `Conversation "${conversation.title}" was created`,
        data.workplaceId,
      );

      // Send notifications to participants (except creator)
      const otherParticipants = participants.filter(
        (p) => p._id.toString() !== data.createdBy,
      );
      for (const participant of otherParticipants) {
        await notificationService.createNotification({
          userId: participant._id.toString(),
          type: "conversation_invite",
          title: "New Conversation",
          content: `You've been added to a new conversation: ${conversation.title}`,
          data: {
            conversationId: conversation._id,
            senderId: data.createdBy as any,
          },
          priority: "normal",
          deliveryChannels: {
            inApp: true,
            email: false,
            sms: false,
          },
          workplaceId: data.workplaceId as any,
          createdBy: data.createdBy as any,
        });
      }

      logger.info(
        `Conversation ${conversation._id} created by user ${data.createdBy}`,
      );
      return conversation;
    } catch (error) {
      logger.error("Error creating conversation:", error);
      throw error;
    }
  }

  /**
   * Add participant to conversation
   */
  async addParticipant(
    conversationId: string,
    userId: string,
    role: string,
    addedBy: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Check if user adding participant has permission
      const adderRole = conversation.getParticipantRole(addedBy as any);
      if (!adderRole || !["pharmacist", "doctor"].includes(adderRole)) {
        throw new Error("Insufficient permissions to add participants");
      }

      // Validate user exists and belongs to workplace
      const user = await User.findOne({
        _id: userId,
        workplaceId,
      }).select("_id role firstName lastName");

      if (!user) {
        throw new Error("User not found or not in the same workplace");
      }

      // Add participant
      conversation.addParticipant(user._id, role);
      await conversation.save();

      // Create system message
      await this.createSystemMessage(
        conversationId,
        addedBy,
        "participant_added",
        `${user.firstName} ${user.lastName} was added to the conversation`,
        workplaceId,
      );

      // Send notification to new participant
      await notificationService.createNotification({
        userId: userId as any,
        type: "conversation_invite",
        title: "Participant Added",
        content: `You've been added to a conversation${conversation ? ": " + conversation.title : ""}`,
        data: {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          senderId: addedBy as any,
        },
        priority: "normal",
        deliveryChannels: {
          inApp: true,
          email: false,
          sms: false,
        },
        workplaceId: workplaceId as any,
        createdBy: addedBy as any,
      });

      logger.info(
        `User ${userId} added to conversation ${conversationId} by ${addedBy}`,
      );
    } catch (error) {
      logger.error("Error adding participant:", error);
      throw error;
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(
    conversationId: string,
    userId: string,
    removedBy: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Check permissions (can remove self or if pharmacist/doctor)
      const removerRole = conversation.getParticipantRole(removedBy as any);
      if (
        userId !== removedBy &&
        (!removerRole || !["pharmacist", "doctor"].includes(removerRole))
      ) {
        throw new Error("Insufficient permissions to remove participants");
      }

      const user = await User.findById(userId).select("firstName lastName");
      if (!user) {
        throw new Error("User not found");
      }

      // Remove participant
      conversation.removeParticipant(userId as any);
      await conversation.save();

      // Create system message
      const action =
        userId === removedBy ? "participant_left" : "participant_removed";
      const message =
        userId === removedBy
          ? `${user.firstName} ${user.lastName} left the conversation`
          : `${user.firstName} ${user.lastName} was removed from the conversation`;

      await this.createSystemMessage(
        conversationId,
        removedBy,
        action,
        message,
        workplaceId,
      );

      logger.info(
        `User ${userId} removed from conversation ${conversationId} by ${removedBy}`,
      );
    } catch (error) {
      logger.error("Error removing participant:", error);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(data: SendMessageData): Promise<IMessage> {
    try {
      logger.info('🔍 [CommunicationService.sendMessage] Starting', {
        conversationId: data.conversationId,
        senderId: data.senderId,
        workplaceId: data.workplaceId,
      });

      // Validate conversation exists and user is participant
      const conversation = await Conversation.findOne({
        _id: data.conversationId,
        workplaceId: data.workplaceId,
      });

      logger.info('🔍 [CommunicationService.sendMessage] Conversation lookup', {
        found: !!conversation,
        conversationId: data.conversationId,
        workplaceId: data.workplaceId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const isParticipant = conversation.hasParticipant(data.senderId as any);
      logger.info('🔍 [CommunicationService.sendMessage] Participant check', {
        senderId: data.senderId,
        isParticipant,
        participants: conversation.participants.map(p => p.userId.toString()),
      });

      if (!isParticipant) {
        throw new Error("User is not a participant in this conversation");
      }

      // Validate parent message if replying
      if (data.parentMessageId) {
        const parentMessage = await Message.findOne({
          _id: data.parentMessageId,
          conversationId: data.conversationId,
        });

        if (!parentMessage) {
          throw new Error("Parent message not found");
        }
      }

      // Create message
      const message = new Message({
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        threadId: data.threadId,
        parentMessageId: data.parentMessageId,
        mentions: data.mentions || [],
        priority: data.priority || "normal",
        workplaceId: data.workplaceId,
        createdBy: data.senderId,
      });

      await message.save();

      // Update conversation
      conversation.updateLastMessage(message._id);
      conversation.incrementUnreadCount(data.senderId as any);
      await conversation.save();

      // Populate sender data
      await message.populate("senderId", "firstName lastName role");

      // Handle mentions
      if (data.mentions && data.mentions.length > 0) {
        await this.handleMentions(data.mentions, message, conversation);
      }

      // Send notifications for urgent messages
      if (data.priority === "urgent") {
        await this.handleUrgentMessageNotifications(message, conversation);
      }

      logger.debug(
        `Message sent by user ${data.senderId} in conversation ${data.conversationId}`,
      );
      return message;
    } catch (error) {
      logger.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   */
  async getConversations(
    userId: string,
    workplaceId: string,
    filters: ConversationFilters = {},
  ): Promise<IConversation[]> {
    try {
      const query: any = {
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      };

      if (filters.status) {
        query.status = filters.status;
      } else {
        query.status = { $ne: "closed" };
      }

      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.patientId) {
        query.patientId = filters.patientId;
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const conversations = await Conversation.find(query)
        .populate("participants.userId", "firstName lastName role")
        .populate("patientId", "firstName lastName mrn")
        .populate("lastMessageId", "content.text senderId createdAt")
        .sort({ lastMessageAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0);

      return conversations;
    } catch (error) {
      logger.error("Error getting conversations:", error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    workplaceId: string,
    filters: MessageFilters = {},
    skipParticipantCheck: boolean = false,
  ): Promise<IMessage[]> {
    try {
      // Validate user is participant (skip for super admins)
      logger.info('Getting messages', {
        conversationId,
        userId,
        workplaceId,
        skipParticipantCheck,
        service: 'communication-service'
      });

      const conversationQuery: any = {
        _id: conversationId,
        workplaceId,
      };

      // Only check participant if not skipping
      if (!skipParticipantCheck) {
        conversationQuery["participants.userId"] = userId;
        conversationQuery["participants.leftAt"] = { $exists: false };
      }

      logger.info('🔍 [CommunicationService.getMessages] Looking up conversation', {
        conversationId,
        workplaceId,
        skipParticipantCheck,
      });

      const conversation = await Conversation.findOne(conversationQuery)
        .lean() // Use lean for better performance
        .maxTimeMS(5000); // 5 second timeout

      if (!conversation) {
        logger.error('Conversation not found', {
          conversationId,
          userId,
          workplaceId,
          skipParticipantCheck,
          service: 'communication-service'
        });
        throw new Error("Conversation not found or access denied");
      }

      logger.info('✅ [CommunicationService.getMessages] Conversation found', {
        conversationId,
        conversationType: conversation.type,
      });

      const query: any = { conversationId };

      if (filters.type) {
        query["content.type"] = filters.type;
      }

      if (filters.senderId) {
        query.senderId = filters.senderId;
      }

      if (filters.mentions) {
        query.mentions = filters.mentions;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.before) {
        query.createdAt = { ...query.createdAt, $lt: filters.before };
      }

      if (filters.after) {
        query.createdAt = { ...query.createdAt, $gt: filters.after };
      }

      // Check message count first to avoid loading too much data
      const messageCount = await Message.countDocuments(query).maxTimeMS(3000);

      logger.info('🔍 [CommunicationService.getMessages] Executing query', {
        conversationId,
        queryKeys: Object.keys(query),
        messageCount,
        limit: Math.min(filters.limit || 50, 100),
        skip: filters.offset || 0,
      });

      if (messageCount > 10000) {
        logger.warn('⚠️ [CommunicationService.getMessages] Large message count detected', {
          conversationId,
          messageCount,
        });
      }

      // Populate sender data for all messages including system messages
      const messages = await Message.find(query)
        .populate("senderId", "firstName lastName role")
        .sort({ createdAt: -1 })
        .limit(Math.min(filters.limit || 50, 100)) // Cap at 100 messages max
        .skip(filters.offset || 0)
        .maxTimeMS(10000); // 10 second timeout

      logger.info('✅ [CommunicationService.getMessages] Query completed', {
        conversationId,
        messagesCount: messages.length,
      });

      // Debug: Log sender information for each message
      messages.forEach((msg, index) => {
        const sender = msg.senderId as any; // Type assertion for populated field
        logger.info(`Message ${index} sender info`, {
          messageId: msg._id,
          senderId: sender,
          senderType: typeof sender,
          contentType: msg.content?.type,
          hasFirstName: sender?.firstName,
          hasLastName: sender?.lastName,
        });
      });

      return messages;
    } catch (error) {
      logger.error("Error getting messages:", error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    messageId: string,
    userId: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      message.markAsRead(userId as any);
      await message.save();

      // Update conversation unread count
      conversation.markAsRead(userId as any);
      await conversation.save();

      logger.debug(`Message ${messageId} marked as read by user ${userId}`);
    } catch (error) {
      logger.error("Error marking message as read:", error);
      throw error;
    }
  }

  /**
   * Search messages
   */
  async searchMessages(
    workplaceId: string,
    query: string,
    userId: string,
    filters: SearchFilters = {},
  ): Promise<IMessage[]> {
    try {
      const searchQuery: any = {
        workplaceId,
        $text: { $search: query },
      };

      // Only search in conversations where user is a participant
      const userConversations = await Conversation.find({
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      }).select("_id");

      searchQuery.conversationId = { $in: userConversations.map((c) => c._id) };

      if (filters.conversationId) {
        searchQuery.conversationId = filters.conversationId;
      }

      if (filters.senderId) {
        searchQuery.senderId = filters.senderId;
      }

      if (filters.type) {
        searchQuery["content.type"] = filters.type;
      }

      if (filters.priority) {
        searchQuery.priority = filters.priority;
      }

      if (filters.dateFrom || filters.dateTo) {
        searchQuery.createdAt = {};
        if (filters.dateFrom) {
          searchQuery.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          searchQuery.createdAt.$lte = filters.dateTo;
        }
      }

      const messages = await Message.find(searchQuery, {
        score: { $meta: "textScore" },
      })
        .populate("senderId", "firstName lastName role")
        .populate("conversationId", "title type")
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .limit(filters.limit || 50);

      return messages;
    } catch (error) {
      logger.error("Error searching messages:", error);
      throw error;
    }
  }

  /**
   * Create a thread from a message
   */
  async createThread(
    messageId: string,
    userId: string,
    workplaceId: string,
  ): Promise<string> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      // If message already has a threadId, return it
      if (message.threadId) {
        return message.threadId.toString();
      }

      // Create thread by setting the message's threadId to its own ID
      message.threadId = message._id;
      await message.save();

      logger.info(`Thread created from message ${messageId} by user ${userId}`);
      return message._id.toString();
    } catch (error) {
      logger.error("Error creating thread:", error);
      throw error;
    }
  }

  /**
   * Get thread messages
   */
  async getThreadMessages(
    threadId: string,
    userId: string,
    workplaceId: string,
    filters: MessageFilters = {},
  ): Promise<{ rootMessage: IMessage; replies: IMessage[] }> {
    try {
      // Get the root message (thread starter)
      const rootMessage = await Message.findOne({
        _id: threadId,
        workplaceId,
      }).populate("senderId", "firstName lastName role");

      if (!rootMessage) {
        throw new Error("Thread not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: rootMessage.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      // Get thread replies
      const query: any = {
        threadId,
        _id: { $ne: threadId }, // Exclude the root message
        workplaceId,
      };

      if (filters.senderId) {
        query.senderId = filters.senderId;
      }

      if (filters.before) {
        query.createdAt = { ...query.createdAt, $lt: filters.before };
      }

      if (filters.after) {
        query.createdAt = { ...query.createdAt, $gt: filters.after };
      }

      const replies = await Message.find(query)
        .populate("senderId", "firstName lastName role")
        .populate("mentions", "firstName lastName role")
        .populate("readBy.userId", "firstName lastName")
        .sort({ createdAt: 1 }) // Chronological order for threads
        .limit(filters.limit || 100);

      return { rootMessage, replies };
    } catch (error) {
      logger.error("Error getting thread messages:", error);
      throw error;
    }
  }

  /**
   * Get thread summary
   */
  async getThreadSummary(
    threadId: string,
    userId: string,
    workplaceId: string,
  ): Promise<{
    threadId: string;
    rootMessage: IMessage;
    replyCount: number;
    participants: string[];
    lastReplyAt?: Date;
    unreadCount: number;
  }> {
    try {
      // Get the root message
      const rootMessage = await Message.findOne({
        _id: threadId,
        workplaceId,
      }).populate("senderId", "firstName lastName role");

      if (!rootMessage) {
        throw new Error("Thread not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: rootMessage.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      // Get thread statistics
      const threadStats = await Message.aggregate([
        {
          $match: {
            threadId: new mongoose.Types.ObjectId(threadId),
            _id: { $ne: new mongoose.Types.ObjectId(threadId) },
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
          },
        },
        {
          $group: {
            _id: null,
            replyCount: { $sum: 1 },
            participants: { $addToSet: "$senderId" },
            lastReplyAt: { $max: "$createdAt" },
            unreadMessages: {
              $push: {
                $cond: [
                  {
                    $not: {
                      $in: [
                        new mongoose.Types.ObjectId(userId),
                        "$readBy.userId",
                      ],
                    },
                  },
                  "$_id",
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            replyCount: 1,
            participants: 1,
            lastReplyAt: 1,
            unreadCount: {
              $size: {
                $filter: {
                  input: "$unreadMessages",
                  cond: { $ne: ["$$this", null] },
                },
              },
            },
          },
        },
      ]);

      const stats = threadStats[0] || {
        replyCount: 0,
        participants: [],
        lastReplyAt: null,
        unreadCount: 0,
      };

      return {
        threadId,
        rootMessage,
        replyCount: stats.replyCount,
        participants: stats.participants.map((p: any) => p.toString()),
        lastReplyAt: stats.lastReplyAt,
        unreadCount: stats.unreadCount,
      };
    } catch (error) {
      logger.error("Error getting thread summary:", error);
      throw error;
    }
  }

  /**
   * Reply to a thread
   */
  async replyToThread(
    threadId: string,
    data: Omit<SendMessageData, "threadId" | "parentMessageId">,
  ): Promise<IMessage> {
    try {
      // Get the root message to validate thread exists
      const rootMessage = await Message.findOne({
        _id: threadId,
        workplaceId: data.workplaceId,
      });

      if (!rootMessage) {
        throw new Error("Thread not found");
      }

      // Send message with thread context
      const replyData: SendMessageData = {
        ...data,
        threadId,
        parentMessageId: threadId, // Parent is the root message
      };

      return await this.sendMessage(replyData);
    } catch (error) {
      logger.error("Error replying to thread:", error);
      throw error;
    }
  }

  /**
   * Get conversation threads
   */
  async getConversationThreads(
    conversationId: string,
    userId: string,
    workplaceId: string,
  ): Promise<
    Array<{
      threadId: string;
      rootMessage: IMessage;
      replyCount: number;
      lastReplyAt?: Date;
      unreadCount: number;
    }>
  > {
    try {
      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Conversation not found or access denied");
      }

      // Get all root messages that have threads
      const rootMessages = await Message.find({
        conversationId,
        threadId: { $exists: true },
        workplaceId,
      }).populate("senderId", "firstName lastName role");

      // Get thread summaries
      const threadSummaries = await Promise.all(
        rootMessages.map(async (rootMessage) => {
          if (rootMessage.threadId?.toString() === rootMessage._id.toString()) {
            const summary = await this.getThreadSummary(
              rootMessage._id.toString(),
              userId,
              workplaceId,
            );
            return {
              threadId: summary.threadId,
              rootMessage: summary.rootMessage,
              replyCount: summary.replyCount,
              lastReplyAt: summary.lastReplyAt,
              unreadCount: summary.unreadCount,
            };
          }
          return null;
        }),
      );

      return threadSummaries.filter(Boolean) as Array<{
        threadId: string;
        rootMessage: IMessage;
        replyCount: number;
        lastReplyAt?: Date;
        unreadCount: number;
      }>;
    } catch (error) {
      logger.error("Error getting conversation threads:", error);
      throw error;
    }
  }

  /**
   * Create system message
   */
  private async createSystemMessage(
    conversationId: string,
    performedBy: string,
    action: string,
    text: string,
    workplaceId: string,
  ): Promise<IMessage> {
    const message = new Message({
      conversationId,
      senderId: performedBy,
      content: {
        text,
        type: "system",
        metadata: {
          systemAction: {
            action,
            performedBy,
            timestamp: new Date(),
          },
        },
      },
      workplaceId,
      createdBy: performedBy,
    });

    await message.save();

    // Populate sender data for system messages too
    await message.populate("senderId", "firstName lastName role");

    logger.info('System message created with populated sender', {
      messageId: message._id,
      senderId: message.senderId,
      senderType: typeof message.senderId,
      action,
      text
    });

    return message;
  }

  /**
   * Handle mention notifications
   */
  private async handleMentions(
    mentions: string[],
    message: IMessage,
    conversation: IConversation,
  ): Promise<void> {
    try {
      // Get sender information
      const sender = await User.findById(message.senderId).select(
        "firstName lastName",
      );
      if (!sender) return;

      const senderName = `${sender.firstName} ${sender.lastName}`;
      const messagePreview =
        message.content.text?.substring(0, 100) || "New message";

      for (const mentionedUserId of mentions) {
        // Skip if mentioning self
        if (mentionedUserId === message.senderId.toString()) continue;

        // Verify mentioned user is a participant or can be added to conversation
        const isParticipant = conversation.hasParticipant(
          mentionedUserId as any,
        );

        if (isParticipant) {
          await notificationService.createNotification({
            userId: mentionedUserId as any,
            type: "mention",
            title: `${senderName} mentioned you`,
            content:
              messagePreview.length > 100
                ? messagePreview.substring(0, 100) + "..."
                : messagePreview,
            data: {
              conversationId: conversation._id,
              messageId: message._id,
              senderId: message.senderId,
              actionUrl: `/conversations/${conversation._id}?message=${message._id}`,
            },
            priority: message.priority === "urgent" ? "urgent" : "normal",
            deliveryChannels: {
              inApp: true,
              email: message.priority === "urgent",
              sms: false,
            },
            workplaceId: conversation.workplaceId,
            createdBy: message.senderId,
          });

          logger.debug(
            `Mention notification sent to user ${mentionedUserId} for message ${message._id}`,
          );
        } else {
          logger.warn(
            `User ${mentionedUserId} mentioned but not a participant in conversation ${conversation._id}`,
          );
        }
      }
    } catch (error) {
      logger.error("Error handling mentions:", error);
    }
  }

  /**
   * Handle urgent message notifications
   */
  private async handleUrgentMessageNotifications(
    message: IMessage,
    conversation: IConversation,
  ): Promise<void> {
    try {
      // Get sender information
      const sender = await User.findById(message.senderId).select(
        "firstName lastName",
      );
      const senderName = sender
        ? `${sender.firstName} ${sender.lastName}`
        : "Someone";
      const messageContent = message.content.text || "New message";

      const participants = conversation.participants.filter(
        (p) => !p.leftAt && p.userId.toString() !== message.senderId.toString(),
      );

      for (const participant of participants) {
        await notificationService.createNotification({
          userId: participant.userId as any,
          type: "urgent_message",
          title: "Urgent Message",
          content: `${senderName} sent an urgent message: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? "..." : ""}`,
          data: {
            conversationId: conversation._id,
            messageId: message._id,
            senderId: message.senderId,
          },
          priority: "urgent",
          deliveryChannels: {
            inApp: true,
            email: true,
            sms: false,
          },
          workplaceId: conversation.workplaceId,
          createdBy: message.senderId,
        });
      }
    } catch (error) {
      logger.error("Error handling urgent message notifications:", error);
    }
  }

  /**
   * Delete message with audit trail
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    workplaceId: string,
    reason?: string,
  ): Promise<void> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found");
      }

      // Check if user can delete (only sender or admin)
      if (message.senderId.toString() !== userId) {
        // Check if user is admin/pharmacist
        const user = await User.findById(userId);
        if (!user || !["pharmacist", "doctor"].includes(user.role)) {
          throw new Error("Insufficient permissions to delete message");
        }
      }

      // Soft delete the message
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = userId as any;
      await message.save();

      // TODO: Create audit log for message deletion
      // await CommunicationAuditService.logMessageAction({
      //     action: 'message_deleted',
      //     userId,
      //     messageId: message._id,
      //     conversationId: message.conversationId,
      //     details: {
      //         reason,
      //         originalContent: message.content.text,
      //         deletedAt: message.deletedAt,
      //     },
      //     workplaceId,
      // });

      logger.info(`Message ${messageId} deleted by user ${userId}`);
    } catch (error) {
      logger.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Add reaction to message
   */
  async addMessageReaction(
    messageId: string,
    userId: string,
    emoji: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      message.addReaction(userId as any, emoji);
      await message.save();

      // TODO: Create audit log for reaction added
      // await CommunicationAuditService.logMessageAction({
      //     action: 'reaction_added',
      //     userId,
      //     messageId: message._id,
      //     conversationId: message.conversationId,
      //     details: {
      //         emoji,
      //         timestamp: new Date(),
      //     },
      //     workplaceId,
      // });

      logger.debug(
        `Reaction ${emoji} added to message ${messageId} by user ${userId}`,
      );
    } catch (error) {
      logger.error("Error adding reaction:", error);
      throw error;
    }
  }

  /**
   * Remove reaction from message
   */
  async removeMessageReaction(
    messageId: string,
    userId: string,
    emoji: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found");
      }

      // Validate user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        "participants.userId": userId,
        "participants.leftAt": { $exists: false },
      });

      if (!conversation) {
        throw new Error("Access denied");
      }

      message.removeReaction(userId as any, emoji);
      await message.save();

      // TODO: Create audit log for reaction removed
      // await CommunicationAuditService.logMessageAction({
      //     action: 'reaction_removed',
      //     userId,
      //     messageId: message._id,
      //     conversationId: message.conversationId,
      //     details: {
      //         emoji,
      //         timestamp: new Date(),
      //     },
      //     workplaceId,
      // });

      logger.debug(
        `Reaction ${emoji} removed from message ${messageId} by user ${userId}`,
      );
    } catch (error) {
      logger.error("Error removing reaction:", error);
      throw error;
    }
  }

  /**
   * Edit message with version tracking
   */
  async editMessage(
    messageId: string,
    userId: string,
    newContent: string,
    reason: string,
    workplaceId: string,
  ): Promise<void> {
    try {
      const message = await Message.findOne({
        _id: messageId,
        senderId: userId,
        workplaceId,
      });

      if (!message) {
        throw new Error("Message not found or not authorized to edit");
      }

      // Check if message is too old to edit (24 hours)
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours

      if (messageAge > maxEditAge) {
        throw new Error("Message is too old to edit");
      }

      const originalContent = message.content.text;
      message.addEdit(newContent, userId as any, reason);
      await message.save();

      // TODO: Create audit log for message edited
      // await CommunicationAuditService.logMessageAction({
      //     action: 'message_edited',
      //     userId,
      //     messageId: message._id,
      //     conversationId: message.conversationId,
      //     details: {
      //         originalContent,
      //         newContent,
      //         reason,
      //         editedAt: new Date(),
      //     },
      //     workplaceId,
      // });

      logger.info(`Message ${messageId} edited by user ${userId}`);
    } catch (error) {
      logger.error("Error editing message:", error);
      throw error;
    }
  }

  /**
   * Get message status for multiple messages
   */
  async getMessageStatuses(
    messageIds: string[],
    userId: string,
    workplaceId: string,
  ): Promise<
    Record<string, { status: string; readBy: any[]; reactions: any[] }>
  > {
    try {
      const messages = await Message.find({
        _id: { $in: messageIds },
        workplaceId,
      }).select("_id status readBy reactions");

      const statuses: Record<string, any> = {};

      messages.forEach((message) => {
        statuses[message._id.toString()] = {
          status: message.status,
          readBy: message.readBy,
          reactions: message.reactions,
        };
      });

      return statuses;
    } catch (error) {
      logger.error("Error getting message statuses:", error);
      throw error;
    }
  }

  /**
   * Get default permissions based on role
   */
  private getDefaultPermissions(role: string): string[] {
    switch (role) {
      case "patient":
        return ["read_messages", "send_messages", "upload_files"];
      case "pharmacist":
      case "doctor":
        return [
          "read_messages",
          "send_messages",
          "upload_files",
          "view_patient_data",
          "manage_clinical_context",
        ];
      default:
        return ["read_messages", "send_messages"];
    }
  }
}

export const communicationService = new CommunicationService();
export default communicationService;
