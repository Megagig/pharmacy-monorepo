import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PatientMessagingService } from '../services/PatientMessagingService';
import { createPatientAttachmentUpload } from '../middlewares/upload';
import logger from '../utils/logger';

// Extend Request interface for patient portal authentication
export interface PatientPortalRequest extends Request {
  patientUser?: {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  workplaceId?: mongoose.Types.ObjectId;
  uploadedFiles?: any[];
  uploadErrors?: string[];
}

export class PatientMessagingController {
  private messagingService: PatientMessagingService;

  constructor() {
    this.messagingService = new PatientMessagingService();
  }

  /**
   * Get or create conversation with pharmacist
   * POST /api/patient-portal/messaging/conversations
   */
  async getOrCreateConversation(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { pharmacistId } = req.body;
      const patientUserId = req.patientUser!._id;
      const workplaceId = req.patientUser!.workplaceId;

      // Validate pharmacist ID
      if (!pharmacistId || !mongoose.Types.ObjectId.isValid(pharmacistId)) {
        res.status(400).json({
          success: false,
          message: 'Valid pharmacist ID is required',
        });
        return;
      }

      const conversation = await this.messagingService.getOrCreateConversation(
        patientUserId,
        new mongoose.Types.ObjectId(pharmacistId),
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Conversation retrieved successfully',
        data: {
          conversation,
        },
      });
    } catch (error: any) {
      logger.error('Error in getOrCreateConversation controller', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        pharmacistId: req.body.pharmacistId,
      });

      if (error.message.includes('not found') || error.message.includes('not active')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get patient's conversations
   * GET /api/patient-portal/messaging/conversations
   */
  async getConversations(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const patientUserId = req.patientUser!._id;
      const workplaceId = req.patientUser!.workplaceId;

      const conversations = await this.messagingService.getPatientConversations(
        patientUserId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: {
          conversations,
          count: conversations.length,
        },
      });
    } catch (error: any) {
      logger.error('Error in getConversations controller', {
        error: error.message,
        patientUserId: req.patientUser?._id,
      });

      if (error.message.includes('not found') || error.message.includes('not active')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get messages from a conversation
   * GET /api/patient-portal/messaging/conversations/:conversationId/messages
   */
  async getMessages(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { limit = '50', skip = '0' } = req.query;
      const patientUserId = req.patientUser!._id;

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
        return;
      }

      // Validate and parse pagination parameters
      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
      const skipNum = Math.max(parseInt(skip as string, 10) || 0, 0);

      const messages = await this.messagingService.getMessages(
        new mongoose.Types.ObjectId(conversationId),
        patientUserId,
        limitNum,
        skipNum
      );

      res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
          count: messages.length,
          pagination: {
            limit: limitNum,
            skip: skipNum,
            hasMore: messages.length === limitNum,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error in getMessages controller', {
        error: error.message,
        conversationId: req.params.conversationId,
        patientUserId: req.patientUser?._id,
      });

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Send a message
   * POST /api/patient-portal/messaging/conversations/:conversationId/messages
   */
  async sendMessage(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const patientUserId = req.patientUser!._id;
      const attachments = req.uploadedFiles || [];

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
        return;
      }

      // Validate content
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Message content is required',
        });
        return;
      }

      // Check for upload errors
      if (req.uploadErrors && req.uploadErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'File upload errors occurred',
          errors: req.uploadErrors,
        });
        return;
      }

      const message = await this.messagingService.sendMessage(
        new mongoose.Types.ObjectId(conversationId),
        patientUserId,
        content.trim(),
        attachments
      );

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          message,
        },
      });
    } catch (error: any) {
      logger.error('Error in sendMessage controller', {
        error: error.message,
        conversationId: req.params.conversationId,
        patientUserId: req.patientUser?._id,
      });

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes('empty') ||
        error.message.includes('exceeds') ||
        error.message.includes('permissions')
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Upload attachment for conversation
   * POST /api/patient-portal/messaging/conversations/:conversationId/attachments
   */
  async uploadAttachment(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { conversationId } = req.params;

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
        return;
      }

      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      // Check for upload errors
      if (req.uploadErrors && req.uploadErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'File upload failed',
          errors: req.uploadErrors,
        });
        return;
      }

      const attachment = await this.messagingService.uploadAttachment(
        req.file,
        new mongoose.Types.ObjectId(conversationId)
      );

      res.status(201).json({
        success: true,
        message: 'Attachment uploaded successfully',
        data: {
          attachment,
        },
      });
    } catch (error: any) {
      logger.error('Error in uploadAttachment controller', {
        error: error.message,
        conversationId: req.params.conversationId,
        patientUserId: req.patientUser?._id,
        filename: req.file?.originalname,
      });

      if (error.message.includes('not allowed') || error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Mark conversation as read
   * PUT /api/patient-portal/messaging/conversations/:conversationId/read
   */
  async markAsRead(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const patientUserId = req.patientUser!._id;

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
        return;
      }

      await this.messagingService.markAsRead(
        new mongoose.Types.ObjectId(conversationId),
        patientUserId
      );

      res.status(200).json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error: any) {
      logger.error('Error in markAsRead controller', {
        error: error.message,
        conversationId: req.params.conversationId,
        patientUserId: req.patientUser?._id,
      });

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get conversation details
   * GET /api/patient-portal/messaging/conversations/:conversationId
   */
  async getConversationDetails(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const patientUserId = req.patientUser!._id;
      const workplaceId = req.patientUser!.workplaceId;

      // Validate conversation ID
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
        return;
      }

      // Get conversation details by getting the first conversation that matches
      const conversations = await this.messagingService.getPatientConversations(
        patientUserId,
        workplaceId
      );

      const conversation = conversations.find(
        conv => conv._id.toString() === conversationId
      );

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Conversation details retrieved successfully',
        data: {
          conversation,
        },
      });
    } catch (error: any) {
      logger.error('Error in getConversationDetails controller', {
        error: error.message,
        conversationId: req.params.conversationId,
        patientUserId: req.patientUser?._id,
      });

      next(error);
    }
  }

  /**
   * Get unread message count
   * GET /api/patient-portal/messaging/unread-count
   */
  async getUnreadCount(
    req: PatientPortalRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const patientUserId = req.patientUser!._id;
      const workplaceId = req.patientUser!.workplaceId;

      const conversations = await this.messagingService.getPatientConversations(
        patientUserId,
        workplaceId
      );

      // Calculate total unread count
      let totalUnreadCount = 0;
      const conversationUnreadCounts: { [conversationId: string]: number } = {};

      conversations.forEach(conversation => {
        const unreadCount = (conversation as any).unreadCount?.get?.(patientUserId.toString()) || 0;
        totalUnreadCount += unreadCount;
        conversationUnreadCounts[conversation._id.toString()] = unreadCount;
      });

      res.status(200).json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: {
          totalUnreadCount,
          conversationUnreadCounts,
        },
      });
    } catch (error: any) {
      logger.error('Error in getUnreadCount controller', {
        error: error.message,
        patientUserId: req.patientUser?._id,
      });

      next(error);
    }
  }
}

export default new PatientMessagingController();