import mongoose from 'mongoose';
import { ChatConversation, IConversation, ChatMessage, IMessage } from '../../models/chat';
import User from '../../models/User';
import Patient from '../../models/Patient';
import logger from '../../utils/logger';
import { chatNotificationService } from './ChatNotificationService';

/**
 * ChatService - Complete Chat Service
 * 
 * Handles conversation management, message operations, and reactions
 */

export interface CreateConversationDTO {
  type: 'direct' | 'group' | 'patient_query' | 'prescription_discussion' | 'broadcast';
  title?: string;
  participants: Array<{
    userId: string;
    role: 'pharmacist' | 'doctor' | 'patient' | 'admin';
  }>;
  patientId?: string;
  prescriptionId?: string;
  createdBy: string;
  workplaceId: string;
}

export interface UpdateConversationDTO {
  title?: string;
  status?: 'active' | 'archived' | 'resolved';
  isPinned?: boolean;
}

export interface ConversationFilters {
  status?: 'active' | 'archived' | 'resolved';
  type?: 'direct' | 'group' | 'patient_query' | 'prescription_discussion' | 'broadcast';
  isPinned?: boolean;
  patientId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateBroadcastDTO {
  title: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  audienceType: 'all' | 'roles' | 'specific';
  roles?: string[]; // For audienceType: 'roles'
  userIds?: string[]; // For audienceType: 'specific'
  workplaceId: string;
  createdBy: string;
}

export interface BroadcastStats {
  broadcastId: string;
  totalRecipients: number;
  delivered: number;
  read: number;
  deliveryRate: number;
  readRate: number;
}

export interface SendMessageDTO {
  conversationId: string;
  senderId: string;
  content: {
    text?: string;
    type: 'text' | 'file' | 'image' | 'system';
  };
  threadId?: string;
  parentMessageId?: string;
  mentions?: string[];
  workplaceId: string;
}

export interface MessageFilters {
  threadId?: string;
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export class ChatService {
  /**
   * Create a new conversation
   */
  async createConversation(data: CreateConversationDTO): Promise<IConversation> {
    try {
      logger.info('Creating conversation', {
        type: data.type,
        participantCount: data.participants.length,
        workplaceId: data.workplaceId,
      });

      // Validate participants exist and belong to workplace
      const participantIds = data.participants.map(p => p.userId);
      const users = await User.find({
        _id: { $in: participantIds },
        workplaceId: data.workplaceId,
      }).select('_id role firstName lastName');

      if (users.length !== participantIds.length) {
        throw new Error('Some participants not found or not in the same workplace');
      }

      // Ensure creator is included in participants
      if (!participantIds.includes(data.createdBy)) {
        logger.warn('Creator not in participants, adding them', {
          createdBy: data.createdBy,
          type: data.type,
        });
        
        const creator = users.find(u => u._id.toString() === data.createdBy);
        if (creator) {
          data.participants.push({
            userId: data.createdBy,
            role: creator.role as any,
          });
        }
      }

      // Validate patient if provided
      if (data.patientId) {
        const patient = await Patient.findOne({
          _id: data.patientId,
          workplaceId: data.workplaceId,
        });

        if (!patient) {
          throw new Error('Patient not found or not in the same workplace');
        }
      }

      // For direct conversations, ensure exactly 2 participants
      if (data.type === 'direct' && data.participants.length !== 2) {
        throw new Error('Direct conversations must have exactly 2 participants');
      }

      // Create conversation
      const conversation = new ChatConversation({
        type: data.type,
        title: data.title,
        participants: data.participants.map(p => ({
          userId: new mongoose.Types.ObjectId(p.userId),
          role: p.role,
          joinedAt: new Date(),
        })),
        patientId: data.patientId ? new mongoose.Types.ObjectId(data.patientId) : undefined,
        prescriptionId: data.prescriptionId ? new mongoose.Types.ObjectId(data.prescriptionId) : undefined,
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
      });

      await conversation.save();

      // Send notifications to participants (except creator)
      const otherParticipants = users.filter(u => u._id.toString() !== data.createdBy);
      
      for (const participant of otherParticipants) {
        try {
          await chatNotificationService.sendConversationInviteNotification(
            participant._id.toString(),
            data.createdBy,
            conversation._id.toString(),
            conversation.title,
            data.workplaceId
          );
        } catch (notifError) {
          logger.error('Failed to send conversation notification', {
            error: notifError,
            participantId: participant._id,
          });
        }
      }

      logger.info('Conversation created successfully', {
        conversationId: conversation._id,
        type: conversation.type,
      });

      return conversation;
    } catch (error) {
      logger.error('Error creating conversation', { error });
      throw error;
    }
  }

  /**
   * Create a prescription discussion conversation
   * Automatically adds prescribing doctor, patient, and pharmacist as participants
   */
  async createPrescriptionDiscussion(
    prescriptionId: string,
    patientId: string,
    doctorId: string,
    pharmacistId: string,
    workplaceId: string,
    prescriptionDetails?: {
      medicationName?: string;
      rxNumber?: string;
    }
  ): Promise<IConversation> {
    try {
      logger.info('Creating prescription discussion', {
        prescriptionId,
        patientId,
        doctorId,
        pharmacistId,
        workplaceId,
      });

      // Check if a discussion already exists for this prescription
      const existingDiscussion = await ChatConversation.findOne({
        prescriptionId: new mongoose.Types.ObjectId(prescriptionId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        status: { $ne: 'archived' },
      });

      if (existingDiscussion) {
        logger.info('Prescription discussion already exists', {
          conversationId: existingDiscussion._id,
          prescriptionId,
        });
        return existingDiscussion;
      }

      // Fetch user details to determine roles
      const [doctor, patient, pharmacist] = await Promise.all([
        User.findById(doctorId).select('firstName lastName role'),
        Patient.findById(patientId).select('firstName lastName'),
        User.findById(pharmacistId).select('firstName lastName role'),
      ]);

      if (!doctor || !patient || !pharmacist) {
        throw new Error('Doctor, patient, or pharmacist not found');
      }

      // Create conversation title
      const medicationName = prescriptionDetails?.medicationName || 'Prescription';
      const rxNumber = prescriptionDetails?.rxNumber || '';
      const title = rxNumber
        ? `${medicationName} Discussion (Rx: ${rxNumber})`
        : `${medicationName} Discussion`;

      // Create participants array
      const participants = [
        {
          userId: doctorId,
          role: 'doctor' as const,
        },
        {
          userId: patientId,
          role: 'patient' as const,
        },
        {
          userId: pharmacistId,
          role: 'pharmacist' as const,
        },
      ];

      // Create the conversation
      const conversation = await this.createConversation({
        type: 'prescription_discussion',
        title,
        participants,
        patientId,
        prescriptionId,
        createdBy: pharmacistId,
        workplaceId,
      });

      // Send initial system message
      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: pharmacistId,
        content: {
          text: `Prescription discussion started for ${medicationName}${rxNumber ? ` (Rx: ${rxNumber})` : ''}. All parties can now discuss this prescription.`,
          type: 'system',
        },
        workplaceId,
      });

      logger.info('Prescription discussion created successfully', {
        conversationId: conversation._id,
        prescriptionId,
      });

      return conversation;
    } catch (error) {
      logger.error('Error creating prescription discussion', { error, prescriptionId });
      throw error;
    }
  }

  /**
   * Get conversations for a user with filtering
   */
  async getConversations(
    userId: string,
    workplaceId: string,
    filters: ConversationFilters = {}
  ): Promise<IConversation[]> {
    try {
      logger.debug('Getting conversations', {
        userId,
        workplaceId,
        filters,
      });

      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        'participants.userId': new mongoose.Types.ObjectId(userId),
        'participants.leftAt': { $exists: false },
      };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      } else {
        query.status = { $ne: 'archived' }; // Default: exclude archived
      }

      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.isPinned !== undefined) {
        query.isPinned = filters.isPinned;
      }

      if (filters.patientId) {
        query.patientId = new mongoose.Types.ObjectId(filters.patientId);
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const conversations = await ChatConversation.find(query)
        .populate('participants.userId', 'firstName lastName role email')
        .populate('patientId', 'firstName lastName mrn')
        .populate('prescriptionId', 'medicationName')
        .sort({ isPinned: -1, updatedAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0)
        .lean();

      logger.debug('Conversations retrieved', {
        count: conversations.length,
        userId,
      });

      return conversations as any;
    } catch (error) {
      logger.error('Error getting conversations', { error, userId });
      throw error;
    }
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation | null> {
    try {
      const conversation = await ChatConversation.findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        'participants.userId': new mongoose.Types.ObjectId(userId),
        'participants.leftAt': { $exists: false },
      })
        .populate('participants.userId', 'firstName lastName role email')
        .populate('patientId', 'firstName lastName mrn')
        .populate('prescriptionId', 'medicationName');

      if (!conversation) {
        logger.warn('Conversation not found or access denied', {
          conversationId,
          userId,
        });
        return null;
      }

      return conversation;
    } catch (error) {
      logger.error('Error getting conversation', { error, conversationId });
      throw error;
    }
  }

  /**
   * Update conversation details
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    workplaceId: string,
    updates: UpdateConversationDTO
  ): Promise<IConversation | null> {
    try {
      logger.info('Updating conversation', {
        conversationId,
        userId,
        updates,
      });

      // Get conversation and verify access
      const conversation = await this.getConversation(conversationId, userId, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Check if user has permission to update
      const userRole = conversation.getParticipantRole(new mongoose.Types.ObjectId(userId));
      
      if (!userRole || !['pharmacist', 'doctor', 'admin'].includes(userRole)) {
        throw new Error('Insufficient permissions to update conversation');
      }

      // Apply updates
      if (updates.title !== undefined) {
        conversation.title = updates.title;
      }

      if (updates.status !== undefined) {
        conversation.status = updates.status;
      }

      if (updates.isPinned !== undefined) {
        conversation.isPinned = updates.isPinned;
      }

      await conversation.save();

      logger.info('Conversation updated successfully', {
        conversationId,
        updates,
      });

      return conversation;
    } catch (error) {
      logger.error('Error updating conversation', { error, conversationId });
      throw error;
    }
  }

  /**
   * Pin a conversation
   */
  async pinConversation(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation | null> {
    return this.updateConversation(conversationId, userId, workplaceId, {
      isPinned: true,
    });
  }

  /**
   * Unpin a conversation
   */
  async unpinConversation(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation | null> {
    return this.updateConversation(conversationId, userId, workplaceId, {
      isPinned: false,
    });
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation | null> {
    return this.updateConversation(conversationId, userId, workplaceId, {
      status: 'archived',
    });
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation | null> {
    return this.updateConversation(conversationId, userId, workplaceId, {
      status: 'active',
    });
  }

  /**
   * Add participant to conversation
   */
  async addParticipant(
    conversationId: string,
    newUserId: string,
    role: 'pharmacist' | 'doctor' | 'patient' | 'admin',
    addedBy: string,
    workplaceId: string
  ): Promise<void> {
    try {
      logger.info('Adding participant to conversation', {
        conversationId,
        newUserId,
        role,
        addedBy,
      });

      // Get conversation
      const conversation = await this.getConversation(conversationId, addedBy, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Check if user adding participant has permission
      const adderRole = conversation.getParticipantRole(new mongoose.Types.ObjectId(addedBy));
      
      if (!adderRole || !['pharmacist', 'doctor', 'admin'].includes(adderRole)) {
        throw new Error('Insufficient permissions to add participants');
      }

      // Validate new user exists and belongs to workplace
      const newUser = await User.findOne({
        _id: new mongoose.Types.ObjectId(newUserId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      }).select('_id firstName lastName role');

      if (!newUser) {
        throw new Error('User not found or not in the same workplace');
      }

      // Add participant
      conversation.addParticipant(new mongoose.Types.ObjectId(newUserId), role);
      await conversation.save();

      // Send notification to new participant
      try {
        await chatNotificationService.sendConversationInviteNotification(
          newUser._id.toString(),
          addedBy,
          conversation._id.toString(),
          conversation.title,
          workplaceId
        );
      } catch (notifError) {
        logger.error('Failed to send participant added notification', {
          error: notifError,
        });
      }

      logger.info('Participant added successfully', {
        conversationId,
        newUserId,
      });
    } catch (error) {
      logger.error('Error adding participant', { error, conversationId });
      throw error;
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(
    conversationId: string,
    userIdToRemove: string,
    removedBy: string,
    workplaceId: string
  ): Promise<void> {
    try {
      logger.info('Removing participant from conversation', {
        conversationId,
        userIdToRemove,
        removedBy,
      });

      // Get conversation
      const conversation = await this.getConversation(conversationId, removedBy, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Check permissions (can remove self or if admin/pharmacist/doctor)
      const removerRole = conversation.getParticipantRole(new mongoose.Types.ObjectId(removedBy));
      
      if (
        userIdToRemove !== removedBy &&
        (!removerRole || !['pharmacist', 'doctor', 'admin'].includes(removerRole))
      ) {
        throw new Error('Insufficient permissions to remove participants');
      }

      // Remove participant
      conversation.removeParticipant(new mongoose.Types.ObjectId(userIdToRemove));
      await conversation.save();

      logger.info('Participant removed successfully', {
        conversationId,
        userIdToRemove,
      });
    } catch (error) {
      logger.error('Error removing participant', { error, conversationId });
      throw error;
    }
  }

  /**
   * Get conversations for a specific patient
   */
  async getPatientConversations(
    patientId: string,
    userId: string,
    workplaceId: string
  ): Promise<IConversation[]> {
    try {
      // Verify patient exists and user has access
      const patient = await Patient.findOne({
        _id: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      return this.getConversations(userId, workplaceId, {
        patientId,
        status: 'active',
      });
    } catch (error) {
      logger.error('Error getting patient conversations', { error, patientId });
      throw error;
    }
  }

  /**
   * Mark conversation as read for user
   */
  async markConversationAsRead(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId, userId, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      conversation.markAsRead(new mongoose.Types.ObjectId(userId));
      await conversation.save();

      logger.debug('Conversation marked as read', {
        conversationId,
        userId,
      });
    } catch (error) {
      logger.error('Error marking conversation as read', { error, conversationId });
      throw error;
    }
  }

  /**
   * Get unread count for user across all conversations
   */
  async getUnreadCount(userId: string, workplaceId: string): Promise<number> {
    try {
      const conversations = await this.getConversations(userId, workplaceId, {
        status: 'active',
      });

      const totalUnread = conversations.reduce((sum, conv) => {
        const unread = conv.unreadCounts.get(userId) || 0;
        return sum + unread;
      }, 0);

      return totalUnread;
    } catch (error) {
      logger.error('Error getting unread count', { error, userId });
      throw error;
    }
  }

  // ==================== MESSAGE OPERATIONS ====================

  /**
   * Send a message in a conversation
   */
  async sendMessage(data: SendMessageDTO): Promise<IMessage> {
    try {
      logger.info('Sending message', {
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.content.type,
      });

      // Validate conversation exists and user is participant
      const conversation = await this.getConversation(
        data.conversationId,
        data.senderId,
        data.workplaceId
      );

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Validate parent message if replying to thread
      if (data.parentMessageId) {
        const parentMessage = await ChatMessage.findOne({
          _id: new mongoose.Types.ObjectId(data.parentMessageId),
          conversationId: new mongoose.Types.ObjectId(data.conversationId),
        });

        if (!parentMessage) {
          throw new Error('Parent message not found');
        }
      }

      // Validate mentions are participants
      if (data.mentions && data.mentions.length > 0) {
        const mentionedUserIds = data.mentions.map(id => new mongoose.Types.ObjectId(id));
        const validMentions = mentionedUserIds.filter(mentionId =>
          conversation.hasParticipant(mentionId)
        );

        if (validMentions.length !== mentionedUserIds.length) {
          logger.warn('Some mentioned users are not participants', {
            conversationId: data.conversationId,
            mentions: data.mentions,
          });
        }
      }

      // Create message
      const message = new ChatMessage({
        conversationId: new mongoose.Types.ObjectId(data.conversationId),
        senderId: new mongoose.Types.ObjectId(data.senderId),
        content: data.content,
        threadId: data.threadId ? new mongoose.Types.ObjectId(data.threadId) : undefined,
        parentMessageId: data.parentMessageId ? new mongoose.Types.ObjectId(data.parentMessageId) : undefined,
        mentions: data.mentions?.map(id => new mongoose.Types.ObjectId(id)) || [],
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
      });

      await message.save();

      // Populate sender data
      await message.populate('senderId', 'firstName lastName role email');

      // Handle mentions - send notifications
      if (data.mentions && data.mentions.length > 0) {
        await this.handleMentionNotifications(message, conversation);
      }

      logger.info('Message sent successfully', {
        messageId: message._id,
        conversationId: data.conversationId,
      });

      return message;
    } catch (error) {
      logger.error('Error sending message', { error });
      throw error;
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    userId: string,
    workplaceId: string,
    filters: MessageFilters = {}
  ): Promise<IMessage[]> {
    try {
      logger.debug('Getting messages', {
        conversationId,
        userId,
        filters,
      });

      // Validate user is participant
      const conversation = await this.getConversation(conversationId, userId, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const query: any = {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isDeleted: false,
      };

      if (filters.threadId) {
        query.threadId = new mongoose.Types.ObjectId(filters.threadId);
      }

      if (filters.before) {
        query.createdAt = { $lt: filters.before };
      }

      if (filters.after) {
        query.createdAt = { ...query.createdAt, $gt: filters.after };
      }

      const messages = await ChatMessage.find(query)
        .populate('senderId', 'firstName lastName role email')
        .populate('mentions', 'firstName lastName role')
        .populate('readBy.userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0);

      logger.debug('Messages retrieved', {
        count: messages.length,
        conversationId,
      });

      return messages;
    } catch (error) {
      logger.error('Error getting messages', { error, conversationId });
      throw error;
    }
  }

  /**
   * Edit a message (within 15-minute window)
   */
  async editMessage(
    messageId: string,
    userId: string,
    workplaceId: string,
    newContent: string
  ): Promise<IMessage> {
    try {
      logger.info('Editing message', {
        messageId,
        userId,
      });

      // Get message and verify ownership
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        senderId: new mongoose.Types.ObjectId(userId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found or not authorized to edit');
      }

      // Edit message (will throw if outside 15-minute window)
      message.edit(newContent);
      await message.save();

      // Populate sender data
      await message.populate('senderId', 'firstName lastName role email');

      logger.info('Message edited successfully', {
        messageId,
      });

      return message;
    } catch (error) {
      logger.error('Error editing message', { error, messageId });
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    workplaceId: string
  ): Promise<IMessage> {
    try {
      logger.info('Deleting message', {
        messageId,
        userId,
      });

      // Get message and verify ownership or admin permission
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Check if user is sender or has admin permission
      const conversation = await ChatConversation.findById(message.conversationId);
      const userRole = conversation?.getParticipantRole(new mongoose.Types.ObjectId(userId));

      const canDelete =
        message.senderId.toString() === userId ||
        (userRole && ['admin', 'pharmacist', 'doctor'].includes(userRole));

      if (!canDelete) {
        throw new Error('Not authorized to delete this message');
      }

      // Soft delete
      message.softDelete();
      await message.save();

      logger.info('Message deleted successfully', {
        messageId,
      });

      return message;
    } catch (error) {
      logger.error('Error deleting message', { error, messageId });
      throw error;
    }
  }

  // ==================== REACTIONS AND READ RECEIPTS ====================

  /**
   * Add reaction to a message
   */
  async addReaction(
    messageId: string,
    userId: string,
    workplaceId: string,
    emoji: string
  ): Promise<IMessage> {
    try {
      logger.debug('Adding reaction', {
        messageId,
        userId,
        emoji,
      });

      // Get message and verify user has access
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user is participant in conversation
      const conversation = await ChatConversation.findById(message.conversationId);
      
      if (!conversation?.hasParticipant(new mongoose.Types.ObjectId(userId))) {
        throw new Error('Not authorized to react to this message');
      }

      // Add reaction
      message.addReaction(new mongoose.Types.ObjectId(userId), emoji);
      await message.save();

      // Populate data
      await message.populate('senderId', 'firstName lastName role');

      logger.debug('Reaction added successfully', {
        messageId,
        emoji,
      });

      return message;
    } catch (error) {
      logger.error('Error adding reaction', { error, messageId });
      throw error;
    }
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(
    messageId: string,
    userId: string,
    workplaceId: string,
    emoji: string
  ): Promise<IMessage> {
    try {
      logger.debug('Removing reaction', {
        messageId,
        userId,
        emoji,
      });

      // Get message
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Remove reaction
      message.removeReaction(new mongoose.Types.ObjectId(userId), emoji);
      await message.save();

      // Populate data
      await message.populate('senderId', 'firstName lastName role');

      logger.debug('Reaction removed successfully', {
        messageId,
        emoji,
      });

      return message;
    } catch (error) {
      logger.error('Error removing reaction', { error, messageId });
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    messageId: string,
    userId: string,
    workplaceId: string
  ): Promise<void> {
    try {
      logger.debug('Marking message as read', {
        messageId,
        userId,
      });

      // Get message
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify user is participant
      const conversation = await ChatConversation.findById(message.conversationId);
      
      if (!conversation?.hasParticipant(new mongoose.Types.ObjectId(userId))) {
        throw new Error('Not authorized to mark this message as read');
      }

      // Mark as read
      message.markAsRead(new mongoose.Types.ObjectId(userId));
      await message.save();

      // Update conversation unread count
      conversation.markAsRead(new mongoose.Types.ObjectId(userId));
      await conversation.save();

      logger.debug('Message marked as read', {
        messageId,
        userId,
      });
    } catch (error) {
      logger.error('Error marking message as read', { error, messageId });
      throw error;
    }
  }

  /**
   * Mark all messages in conversation as read
   */
  async markConversationMessagesAsRead(
    conversationId: string,
    userId: string,
    workplaceId: string
  ): Promise<void> {
    try {
      logger.debug('Marking all conversation messages as read', {
        conversationId,
        userId,
      });

      // Verify user is participant
      const conversation = await this.getConversation(conversationId, userId, workplaceId);

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Get all unread messages
      const messages = await ChatMessage.find({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isDeleted: false,
      });

      // Mark each as read
      for (const message of messages) {
        if (!message.isReadBy(new mongoose.Types.ObjectId(userId))) {
          message.markAsRead(new mongoose.Types.ObjectId(userId));
          await message.save();
        }
      }

      // Update conversation unread count
      conversation.markAsRead(new mongoose.Types.ObjectId(userId));
      await conversation.save();

      logger.debug('All messages marked as read', {
        conversationId,
        count: messages.length,
      });
    } catch (error) {
      logger.error('Error marking conversation messages as read', { error, conversationId });
      throw error;
    }
  }

  /**
   * Post prescription update notification to discussion
   * Sends a system message when prescription is updated
   */
  async postPrescriptionUpdate(
    prescriptionId: string,
    workplaceId: string,
    updateDetails: {
      field: string;
      oldValue?: string;
      newValue?: string;
      updatedBy: string;
    }
  ): Promise<void> {
    try {
      logger.info('Posting prescription update to discussion', {
        prescriptionId,
        field: updateDetails.field,
      });

      // Find the prescription discussion conversation
      const conversation = await ChatConversation.findOne({
        prescriptionId: new mongoose.Types.ObjectId(prescriptionId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        type: 'prescription_discussion',
        status: { $ne: 'archived' },
      });

      if (!conversation) {
        logger.debug('No active prescription discussion found', { prescriptionId });
        return;
      }

      // Get updater info
      const updater = await User.findById(updateDetails.updatedBy).select('firstName lastName role');
      const updaterName = updater ? `${updater.firstName} ${updater.lastName}` : 'Someone';

      // Create update message
      let updateMessage = `${updaterName} updated the prescription`;
      
      if (updateDetails.field && updateDetails.newValue) {
        updateMessage += `: ${updateDetails.field} changed`;
        if (updateDetails.oldValue) {
          updateMessage += ` from "${updateDetails.oldValue}" to "${updateDetails.newValue}"`;
        } else {
          updateMessage += ` to "${updateDetails.newValue}"`;
        }
      }

      // Post system message
      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: updateDetails.updatedBy,
        content: {
          text: updateMessage,
          type: 'system',
        },
        workplaceId,
      });

      // Notify all participants
      for (const participant of conversation.participants) {
        if (participant.userId.toString() === updateDetails.updatedBy) continue; // Skip updater

        try {
          await chatNotificationService.sendNewMessageNotification(
            participant.userId.toString(),
            updateDetails.updatedBy,
            conversation._id.toString(),
            '', // messageId will be set by sendMessage
            updateMessage,
            workplaceId
          );
        } catch (notifError) {
          logger.error('Failed to send prescription update notification', {
            error: notifError,
            participantId: participant.userId,
          });
        }
      }

      logger.info('Prescription update posted successfully', {
        conversationId: conversation._id,
        prescriptionId,
      });
    } catch (error) {
      logger.error('Error posting prescription update', { error, prescriptionId });
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Resolve prescription discussion
   * Marks the conversation as resolved
   */
  async resolvePrescriptionDiscussion(
    conversationId: string,
    userId: string,
    workplaceId: string,
    resolutionNote?: string
  ): Promise<IConversation> {
    try {
      logger.info('Resolving prescription discussion', {
        conversationId,
        userId,
      });

      const conversation = await ChatConversation.findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        type: 'prescription_discussion',
      });

      if (!conversation) {
        throw new Error('Prescription discussion not found');
      }

      // Verify user is a participant
      if (!conversation.hasParticipant(new mongoose.Types.ObjectId(userId))) {
        throw new Error('User is not a participant in this discussion');
      }

      // Update status to resolved
      conversation.status = 'resolved';
      await conversation.save();

      // Get resolver info
      const resolver = await User.findById(userId).select('firstName lastName role');
      const resolverName = resolver ? `${resolver.firstName} ${resolver.lastName}` : 'Someone';

      // Post resolution message
      const resolutionMessage = resolutionNote
        ? `${resolverName} marked this discussion as resolved: ${resolutionNote}`
        : `${resolverName} marked this discussion as resolved`;

      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: userId,
        content: {
          text: resolutionMessage,
          type: 'system',
        },
        workplaceId,
      });

      // Notify all participants
      for (const participant of conversation.participants) {
        if (participant.userId.toString() === userId) continue; // Skip resolver

        try {
          await chatNotificationService.sendNewMessageNotification(
            participant.userId.toString(),
            userId,
            conversation._id.toString(),
            '',
            resolutionMessage,
            workplaceId
          );
        } catch (notifError) {
          logger.error('Failed to send resolution notification', {
            error: notifError,
            participantId: participant.userId,
          });
        }
      }

      logger.info('Prescription discussion resolved successfully', {
        conversationId,
      });

      return conversation;
    } catch (error) {
      logger.error('Error resolving prescription discussion', { error, conversationId });
      throw error;
    }
  }

  /**
   * Create a broadcast message
   * Sends a message to multiple users based on audience selection
   */
  async createBroadcast(data: CreateBroadcastDTO): Promise<{
    conversation: IConversation;
    stats: BroadcastStats;
  }> {
    try {
      logger.info('Creating broadcast', {
        audienceType: data.audienceType,
        workplaceId: data.workplaceId,
      });

      // Determine recipients based on audience type
      let recipients: string[] = [];

      if (data.audienceType === 'all') {
        // Get all active users in workplace
        const users = await User.find({
          workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
          isActive: true,
        }).select('_id');
        recipients = users.map(u => u._id.toString());
      } else if (data.audienceType === 'roles' && data.roles) {
        // Get users with specific roles
        const users = await User.find({
          workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
          role: { $in: data.roles },
          isActive: true,
        }).select('_id');
        recipients = users.map(u => u._id.toString());
      } else if (data.audienceType === 'specific' && data.userIds) {
        // Use specific user IDs
        recipients = data.userIds;
      }

      if (recipients.length === 0) {
        throw new Error('No recipients found for broadcast');
      }

      // Create broadcast conversation
      const participants = recipients.map(userId => ({
        userId,
        role: 'patient' as const, // Default role for broadcast recipients
      }));

      const conversation = await this.createConversation({
        type: 'broadcast',
        title: data.title,
        participants,
        createdBy: data.createdBy,
        workplaceId: data.workplaceId,
      });

      // Send broadcast message
      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: data.createdBy,
        content: {
          text: data.message,
          type: 'text',
        },
        workplaceId: data.workplaceId,
      });

      // Send notifications based on priority
      const notificationPriority = data.priority === 'urgent' ? 'urgent' : data.priority === 'high' ? 'high' : 'normal';
      
      for (const recipientId of recipients) {
        try {
          await chatNotificationService.sendNewMessageNotification(
            recipientId,
            data.createdBy,
            conversation._id.toString(),
            '', // messageId will be set by sendMessage
            data.message.substring(0, 100),
            data.workplaceId
          );
        } catch (notifError) {
          logger.error('Failed to send broadcast notification', {
            error: notifError,
            recipientId,
          });
        }
      }

      logger.info('Broadcast created successfully', {
        conversationId: conversation._id,
        recipientCount: recipients.length,
      });

      return {
        conversation,
        stats: {
          broadcastId: conversation._id.toString(),
          totalRecipients: recipients.length,
          delivered: recipients.length,
          read: 0,
          deliveryRate: 100,
          readRate: 0,
        },
      };
    } catch (error) {
      logger.error('Error creating broadcast', { error });
      throw error;
    }
  }

  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(broadcastId: string, workplaceId: string): Promise<BroadcastStats> {
    try {
      const conversation = await ChatConversation.findOne({
        _id: new mongoose.Types.ObjectId(broadcastId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        type: 'broadcast',
      });

      if (!conversation) {
        throw new Error('Broadcast not found');
      }

      const totalRecipients = conversation.participants.length;
      
      // Count read receipts
      const readCount = conversation.participants.filter(
        p => (p as any).lastReadAt !== undefined
      ).length;

      return {
        broadcastId,
        totalRecipients,
        delivered: totalRecipients, // All delivered immediately
        read: readCount,
        deliveryRate: 100,
        readRate: totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0,
      };
    } catch (error) {
      logger.error('Error getting broadcast stats', { error, broadcastId });
      throw error;
    }
  }

  // ==================== MODERATION METHODS ====================

  /**
   * Report a message for moderation
   */
  async reportMessage(
    messageId: string,
    reportedBy: string,
    workplaceId: string,
    reason: 'inappropriate' | 'spam' | 'harassment' | 'privacy_violation' | 'other',
    description?: string
  ): Promise<IMessage> {
    try {
      logger.info('Reporting message', {
        messageId,
        reportedBy,
        reason,
      });

      // Get message
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify reporter is a participant in the conversation
      const conversation = await ChatConversation.findById(message.conversationId);
      
      if (!conversation?.hasParticipant(new mongoose.Types.ObjectId(reportedBy))) {
        throw new Error('Not authorized to report this message');
      }

      // Add flag to message
      message.addFlag(new mongoose.Types.ObjectId(reportedBy), reason, description);
      await message.save();

      // Notify admins of flagged message
      await this.notifyAdminsOfFlaggedMessage(message, reportedBy, reason, workplaceId);

      logger.info('Message reported successfully', {
        messageId,
        reason,
      });

      return message;
    } catch (error) {
      logger.error('Error reporting message', { error, messageId });
      throw error;
    }
  }

  /**
   * Get moderation queue (flagged messages)
   */
  async getModerationQueue(
    workplaceId: string,
    filters: {
      status?: 'pending' | 'reviewed' | 'dismissed';
      reason?: string;
      before?: Date;
      after?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<IMessage[]> {
    try {
      logger.debug('Getting moderation queue', {
        workplaceId,
        filters,
      });

      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isFlagged: true,
      };

      // Apply filters
      if (filters.status) {
        query['flags.status'] = filters.status;
      }

      if (filters.reason) {
        query['flags.reason'] = filters.reason;
      }

      if (filters.before) {
        query.createdAt = { $lt: filters.before };
      }

      if (filters.after) {
        query.createdAt = { ...query.createdAt, $gt: filters.after };
      }

      const messages = await ChatMessage.find(query)
        .populate('senderId', 'firstName lastName role email')
        .populate('conversationId', 'title type')
        .populate('flags.reportedBy', 'firstName lastName role')
        .populate('flags.reviewedBy', 'firstName lastName role')
        .sort({ 'flags.reportedAt': -1 })
        .limit(filters.limit || 50)
        .skip(filters.offset || 0);

      logger.debug('Moderation queue retrieved', {
        count: messages.length,
        workplaceId,
      });

      return messages;
    } catch (error) {
      logger.error('Error getting moderation queue', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Admin delete message with audit logging
   */
  async adminDeleteMessage(
    messageId: string,
    adminId: string,
    workplaceId: string,
    reason: string
  ): Promise<void> {
    try {
      logger.info('Admin deleting message', {
        messageId,
        adminId,
        reason,
      });

      // Get message
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify admin permission
      const admin = await User.findById(adminId);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
        throw new Error('Insufficient permissions');
      }

      // Log to audit trail
      await this.logAdminAction(
        adminId,
        'message_deleted',
        {
          messageId,
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          reason,
          originalContent: message.content.text,
        },
        workplaceId
      );

      // Soft delete the message
      message.softDelete();
      await message.save();

      // Notify message sender
      try {
        await chatNotificationService.sendNewMessageNotification(
          message.senderId.toString(),
          adminId,
          message.conversationId.toString(),
          messageId,
          'Your message was removed by an administrator',
          workplaceId
        );
      } catch (notifError) {
        logger.error('Failed to notify sender of deletion', { error: notifError });
      }

      logger.info('Message deleted by admin successfully', {
        messageId,
        adminId,
      });
    } catch (error) {
      logger.error('Error in admin message deletion', { error, messageId });
      throw error;
    }
  }

  /**
   * Dismiss a flag
   */
  async dismissMessageFlag(
    messageId: string,
    flagId: string,
    adminId: string,
    workplaceId: string,
    reviewNotes?: string
  ): Promise<IMessage> {
    try {
      logger.info('Dismissing message flag', {
        messageId,
        flagId,
        adminId,
      });

      // Get message
      const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Verify admin permission
      const admin = await User.findById(adminId);
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
        throw new Error('Insufficient permissions');
      }

      // Dismiss flag
      message.dismissFlag(flagId, new mongoose.Types.ObjectId(adminId), reviewNotes);
      await message.save();

      // Log to audit trail
      await this.logAdminAction(
        adminId,
        'flag_dismissed',
        {
          messageId,
          flagId,
          reviewNotes,
        },
        workplaceId
      );

      logger.info('Flag dismissed successfully', {
        messageId,
        flagId,
      });

      return message;
    } catch (error) {
      logger.error('Error dismissing flag', { error, messageId, flagId });
      throw error;
    }
  }

  /**
   * Get communication analytics
   */
  async getCommunicationAnalytics(
    workplaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    messagesSent: number;
    activeUsers: number;
    averageResponseTime: number;
    conversationsByType: Record<string, number>;
    messagesByDay: Array<{ date: string; count: number }>;
    topUsers: Array<{ userId: string; name: string; messageCount: number }>;
  }> {
    try {
      logger.info('Getting communication analytics', {
        workplaceId,
        startDate,
        endDate,
      });

      const dateFilter: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      };

      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = startDate;
        if (endDate) dateFilter.createdAt.$lte = endDate;
      }

      // Get total messages sent
      const messagesSent = await ChatMessage.countDocuments({
        ...dateFilter,
        isDeleted: false,
      });

      // Get active users (users who sent at least one message)
      const activeUsersResult = await ChatMessage.aggregate([
        { $match: { ...dateFilter, isDeleted: false } },
        { $group: { _id: '$senderId' } },
        { $count: 'count' },
      ]);
      const activeUsers = activeUsersResult[0]?.count || 0;

      // Get conversations by type
      const conversationsByTypeResult = await ChatConversation.aggregate([
        {
          $match: {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            ...(startDate || endDate
              ? {
                  createdAt: {
                    ...(startDate ? { $gte: startDate } : {}),
                    ...(endDate ? { $lte: endDate } : {}),
                  },
                }
              : {}),
          },
        },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);

      const conversationsByType: Record<string, number> = {};
      conversationsByTypeResult.forEach((item) => {
        conversationsByType[item._id] = item.count;
      });

      // Get messages by day
      const messagesByDayResult = await ChatMessage.aggregate([
        { $match: { ...dateFilter, isDeleted: false } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]);

      const messagesByDay = messagesByDayResult.map((item) => ({
        date: item._id,
        count: item.count,
      }));

      // Get top users by message count
      const topUsersResult = await ChatMessage.aggregate([
        { $match: { ...dateFilter, isDeleted: false } },
        { $group: { _id: '$senderId', messageCount: { $sum: 1 } } },
        { $sort: { messageCount: -1 } },
        { $limit: 10 },
      ]);

      // Populate user names
      const topUsers = await Promise.all(
        topUsersResult.map(async (item) => {
          const user = await User.findById(item._id).select('firstName lastName');
          return {
            userId: item._id.toString(),
            name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            messageCount: item.messageCount,
          };
        })
      );

      // Calculate average response time (simplified - time between messages in conversations)
      const responseTimeResult = await ChatMessage.aggregate([
        { $match: { ...dateFilter, isDeleted: false } },
        { $sort: { conversationId: 1, createdAt: 1 } },
        {
          $group: {
            _id: '$conversationId',
            messages: { $push: { createdAt: '$createdAt', senderId: '$senderId' } },
          },
        },
      ]);

      let totalResponseTime = 0;
      let responseCount = 0;

      responseTimeResult.forEach((conv) => {
        for (let i = 1; i < conv.messages.length; i++) {
          const prevMsg = conv.messages[i - 1];
          const currMsg = conv.messages[i];
          
          // Only count if different senders (actual response)
          if (prevMsg.senderId.toString() !== currMsg.senderId.toString()) {
            const timeDiff = new Date(currMsg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
            totalResponseTime += timeDiff;
            responseCount++;
          }
        }
      });

      const averageResponseTime = responseCount > 0 
        ? Math.round(totalResponseTime / responseCount / 1000 / 60) // Convert to minutes
        : 0;

      logger.info('Communication analytics retrieved', {
        workplaceId,
        messagesSent,
        activeUsers,
      });

      return {
        messagesSent,
        activeUsers,
        averageResponseTime,
        conversationsByType,
        messagesByDay,
        topUsers,
      };
    } catch (error) {
      logger.error('Error getting communication analytics', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Log admin action to audit trail
   */
  private async logAdminAction(
    adminId: string,
    action: string,
    details: any,
    workplaceId: string
  ): Promise<void> {
    try {
      // Import audit service dynamically to avoid circular dependencies
      const { default: UnifiedAuditService } = await import('../unifiedAuditService');
      
      await UnifiedAuditService.logActivity({
        userId: new mongoose.Types.ObjectId(adminId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        activityType: 'admin_action',
        action,
        description: `Admin action: ${action}`,
        targetEntity: details.messageId ? {
          entityType: 'message',
          entityId: details.messageId,
          entityName: 'Message'
        } : undefined,
        metadata: details,
        ipAddress: 'system',
        userAgent: 'admin-action',
      });
    } catch (error) {
      logger.error('Error logging admin action', { error });
      // Don't throw - audit logging failure shouldn't block the action
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Notify admins of flagged message
   */
  private async notifyAdminsOfFlaggedMessage(
    message: IMessage,
    reportedBy: string,
    reason: string,
    workplaceId: string
  ): Promise<void> {
    try {
      // Find all admins in the workplace
      const admins = await User.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        role: { $in: ['admin', 'super_admin'] },
      }).select('_id');

      const reporter = await User.findById(reportedBy).select('firstName lastName');
      const reporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : 'A user';

      // Send notification to each admin
      for (const admin of admins) {
        try {
          await chatNotificationService.sendFlaggedMessageNotification(
            admin._id.toString(),
            message._id.toString(),
            message.conversationId.toString(),
            reporterName,
            reason,
            workplaceId
          );
        } catch (notifError) {
          logger.error('Failed to send flagged message notification to admin', {
            error: notifError,
            adminId: admin._id,
          });
        }
      }
    } catch (error) {
      logger.error('Error notifying admins of flagged message', { error });
    }
  }

  /**
   * Handle mention notifications
   */
  private async handleMentionNotifications(
    message: IMessage,
    conversation: IConversation
  ): Promise<void> {
    try {
      const sender = await User.findById(message.senderId).select('firstName lastName');
      if (!sender) return;

      const senderName = `${sender.firstName} ${sender.lastName}`;
      const messagePreview = message.content.text?.substring(0, 100) || 'New message';

      for (const mentionedUserId of message.mentions) {
        // Skip if mentioning self
        if (mentionedUserId.toString() === message.senderId.toString()) continue;

        // Verify mentioned user is a participant
        if (!conversation.hasParticipant(mentionedUserId)) {
          logger.warn('Mentioned user is not a participant', {
            mentionedUserId,
            conversationId: conversation._id,
          });
          continue;
        }

        try {
          await chatNotificationService.sendMentionNotification(
            mentionedUserId.toString(),
            message.senderId.toString(),
            conversation._id.toString(),
            message._id.toString(),
            messagePreview,
            conversation.workplaceId.toString()
          );
        } catch (notifError) {
          logger.error('Failed to send mention notification', {
            error: notifError,
            mentionedUserId,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling mention notifications', { error });
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
