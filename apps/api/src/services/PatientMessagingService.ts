import mongoose from 'mongoose';
import Conversation, { IConversation, IConversationParticipant } from '../models/Conversation';
import Message, { IMessage } from '../models/Message';
import PatientUser, { IPatientUser } from '../models/PatientUser';
import User from '../models/User';
import { PatientPortalUploadService, UploadedFileData } from '../middlewares/upload';
import logger from '../utils/logger';
import { notificationService } from './notificationService';

export interface IPatientMessagingService {
  getOrCreateConversation(
    patientUserId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IConversation>;
  
  sendMessage(
    conversationId: mongoose.Types.ObjectId,
    senderId: mongoose.Types.ObjectId,
    content: string,
    attachments?: UploadedFileData[]
  ): Promise<IMessage>;
  
  getMessages(
    conversationId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    limit?: number,
    skip?: number
  ): Promise<IMessage[]>;
  
  markAsRead(
    conversationId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId
  ): Promise<void>;
  
  getPatientConversations(
    patientUserId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IConversation[]>;
  
  validateAttachment(file: Express.Multer.File): Promise<boolean>;
  
  uploadAttachment(
    file: Express.Multer.File,
    conversationId: mongoose.Types.ObjectId
  ): Promise<UploadedFileData>;
}

export class PatientMessagingService implements IPatientMessagingService {
  /**
   * Get or create a conversation between patient and pharmacist
   */
  async getOrCreateConversation(
    patientUserId: mongoose.Types.ObjectId,
    pharmacistId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IConversation> {
    try {
      // Validate patient user exists and belongs to workspace
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        status: 'active',
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found or not active');
      }

      // Validate pharmacist exists and belongs to workspace
      const pharmacist = await User.findOne({
        _id: pharmacistId,
        workplaceId,
        isDeleted: false,
      });

      if (!pharmacist) {
        throw new Error('Pharmacist not found');
      }

      // Check if conversation already exists between these participants
      const existingConversation = await Conversation.findOne({
        workplaceId,
        type: 'patient_query',
        'participants.userId': { $all: [patientUserId, pharmacistId] },
        'participants.leftAt': { $exists: false },
        status: { $in: ['active', 'resolved'] },
        isDeleted: false,
      }).populate('participants.userId', 'firstName lastName role');

      if (existingConversation) {
        logger.info('Found existing conversation', {
          conversationId: existingConversation._id,
          patientUserId,
          pharmacistId,
        });
        return existingConversation;
      }

      // Create new conversation
      const newConversation = new Conversation({
        title: `Patient Query - ${patientUser.firstName} ${patientUser.lastName}`,
        type: 'patient_query',
        participants: [
          {
            userId: patientUserId,
            role: 'patient',
            joinedAt: new Date(),
            permissions: ['read_messages', 'send_messages', 'upload_files'],
          },
          {
            userId: pharmacistId,
            role: pharmacist.role,
            joinedAt: new Date(),
            permissions: [
              'read_messages',
              'send_messages',
              'upload_files',
              'view_patient_data',
              'manage_clinical_context',
            ],
          },
        ],
        patientId: patientUser.patientId, // Link to actual Patient record
        status: 'active',
        priority: 'normal',
        workplaceId,
        metadata: {
          isEncrypted: true,
          priority: 'normal',
          tags: ['patient_portal'],
        },
        createdBy: patientUserId,
      });

      await newConversation.save();

      // Populate participants for response
      await newConversation.populate('participants.userId', 'firstName lastName role');

      logger.info('Created new patient conversation', {
        conversationId: newConversation._id,
        patientUserId,
        pharmacistId,
        workplaceId,
      });

      // Send notification to pharmacist about new conversation
      try {
        await notificationService.createNotification({
          userId: pharmacistId,
          type: 'patient_query',
          title: 'New Patient Message',
          content: `${patientUser.firstName} ${patientUser.lastName} has started a conversation`,
          data: {
            conversationId: newConversation._id,
            patientId: patientUser.patientId,
            senderId: patientUserId,
          },
          workplaceId,
          createdBy: patientUserId,
        });
      } catch (notificationError: any) {
        logger.warn('Failed to send conversation notification', {
          error: notificationError.message,
          conversationId: newConversation._id,
        });
      }

      return newConversation;
    } catch (error: any) {
      logger.error('Error getting or creating conversation', {
        error: error.message,
        patientUserId,
        pharmacistId,
        workplaceId,
      });
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: mongoose.Types.ObjectId,
    senderId: mongoose.Types.ObjectId,
    content: string,
    attachments?: UploadedFileData[]
  ): Promise<IMessage> {
    try {
      // Validate conversation exists and sender is participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': senderId,
        'participants.leftAt': { $exists: false },
        status: { $in: ['active', 'resolved'] },
        isDeleted: false,
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Get sender information
      const senderParticipant = conversation.participants.find(
        p => p.userId.toString() === senderId.toString() && !p.leftAt
      );

      if (!senderParticipant) {
        throw new Error('Sender is not an active participant');
      }

      // Check if sender has permission to send messages
      if (!senderParticipant.permissions.includes('send_messages')) {
        throw new Error('Insufficient permissions to send messages');
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error('Message content cannot be empty');
      }

      if (content.length > 5000) {
        throw new Error('Message content exceeds maximum length of 5000 characters');
      }

      // Create message
      const messageData: any = {
        conversationId,
        senderId,
        content: {
          text: content.trim(),
          type: 'text',
        },
        metadata: {
          isEncrypted: conversation.metadata.isEncrypted,
          source: 'patient_portal',
        },
        workplaceId: conversation.workplaceId,
      };

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        messageData.content.attachments = attachments.map(attachment => ({
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url,
          uploadedAt: attachment.uploadedAt,
        }));
      }

      const message = new Message(messageData);
      await message.save();

      // Update conversation
      conversation.updateLastMessage(message._id);
      conversation.incrementUnreadCount(senderId);
      await conversation.save();

      // Populate sender information
      await message.populate('senderId', 'firstName lastName role');

      logger.info('Message sent successfully', {
        messageId: message._id,
        conversationId,
        senderId,
        hasAttachments: !!(attachments && attachments.length > 0),
      });

      // Send notifications to other participants
      const otherParticipants = conversation.participants.filter(
        p => p.userId.toString() !== senderId.toString() && !p.leftAt
      );

      for (const participant of otherParticipants) {
        try {
          await notificationService.createNotification({
            userId: participant.userId,
            type: 'new_message',
            title: 'New Message',
            content: `New message from ${(message.senderId as any).firstName} ${(message.senderId as any).lastName}`,
            data: {
              conversationId,
              messageId: message._id,
              senderId,
            },
            workplaceId: conversation.workplaceId,
            createdBy: senderId,
          });
        } catch (notificationError: any) {
          logger.warn('Failed to send message notification', {
            error: notificationError.message,
            participantId: participant.userId,
            messageId: message._id,
          });
        }
      }

      return message;
    } catch (error: any) {
      logger.error('Error sending message', {
        error: error.message,
        conversationId,
        senderId,
      });
      throw error;
    }
  }

  /**
   * Get messages from a conversation
   */
  async getMessages(
    conversationId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId,
    limit: number = 50,
    skip: number = 0
  ): Promise<IMessage[]> {
    try {
      // Validate conversation access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': patientUserId,
        'participants.leftAt': { $exists: false },
        isDeleted: false,
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Get messages
      const messages = await Message.find({
        conversationId,
        isDeleted: false,
      })
        .populate('senderId', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100)) // Cap at 100 messages per request
        .skip(skip);

      logger.info('Retrieved messages', {
        conversationId,
        patientUserId,
        messageCount: messages.length,
        limit,
        skip,
      });

      return messages.reverse(); // Return in chronological order
    } catch (error: any) {
      logger.error('Error getting messages', {
        error: error.message,
        conversationId,
        patientUserId,
      });
      throw error;
    }
  }

  /**
   * Mark conversation as read for patient
   */
  async markAsRead(
    conversationId: mongoose.Types.ObjectId,
    patientUserId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      // Find and update conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': patientUserId,
        'participants.leftAt': { $exists: false },
        isDeleted: false,
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Mark as read
      conversation.markAsRead(patientUserId);
      await conversation.save();

      logger.info('Conversation marked as read', {
        conversationId,
        patientUserId,
      });
    } catch (error: any) {
      logger.error('Error marking conversation as read', {
        error: error.message,
        conversationId,
        patientUserId,
      });
      throw error;
    }
  }

  /**
   * Get all conversations for a patient
   */
  async getPatientConversations(
    patientUserId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IConversation[]> {
    try {
      // Validate patient user
      const patientUser = await PatientUser.findOne({
        _id: patientUserId,
        workplaceId,
        status: 'active',
        isDeleted: false,
      });

      if (!patientUser) {
        throw new Error('Patient user not found or not active');
      }

      // Get conversations
      const conversations = await Conversation.find({
        workplaceId,
        'participants.userId': patientUserId,
        'participants.leftAt': { $exists: false },
        status: { $ne: 'closed' },
        isDeleted: false,
      })
        .populate('participants.userId', 'firstName lastName role')
        .populate('patientId', 'firstName lastName mrn')
        .populate('lastMessageId', 'content.text senderId createdAt')
        .sort({ lastMessageAt: -1 });

      logger.info('Retrieved patient conversations', {
        patientUserId,
        workplaceId,
        conversationCount: conversations.length,
      });

      return conversations;
    } catch (error: any) {
      logger.error('Error getting patient conversations', {
        error: error.message,
        patientUserId,
        workplaceId,
      });
      throw error;
    }
  }

  /**
   * Validate file attachment
   */
  async validateAttachment(file: Express.Multer.File): Promise<boolean> {
    try {
      // Check file size (10MB limit for patient attachments)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Check allowed file types
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(`File type ${file.mimetype} is not allowed`);
      }

      // Check file extension
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.txt'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error(`File extension ${fileExtension} is not allowed`);
      }

      // Validate filename
      if (
        file.originalname.includes('..') ||
        file.originalname.includes('/') ||
        file.originalname.includes('\\') ||
        file.originalname.includes('\0')
      ) {
        throw new Error('Invalid characters in filename');
      }

      return true;
    } catch (error: any) {
      logger.warn('File validation failed', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload attachment for conversation
   */
  async uploadAttachment(
    file: Express.Multer.File,
    conversationId: mongoose.Types.ObjectId
  ): Promise<UploadedFileData> {
    try {
      // Validate file
      await this.validateAttachment(file);

      // Process upload using existing upload service
      const result = await PatientPortalUploadService.processUploadedFile(file, 'patientAttachments');

      if (!result.success || !result.fileData) {
        throw new Error(result.error || 'Failed to upload attachment');
      }

      logger.info('Attachment uploaded successfully', {
        conversationId,
        filename: result.fileData.fileName,
        originalName: result.fileData.originalName,
        size: result.fileData.size,
      });

      return result.fileData;
    } catch (error: any) {
      logger.error('Error uploading attachment', {
        error: error.message,
        conversationId,
        filename: file.originalname,
      });
      throw error;
    }
  }
}

export default new PatientMessagingService();