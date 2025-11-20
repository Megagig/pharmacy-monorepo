import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth, AuthRequest } from '../middlewares/auth';
import { chatService } from '../services/chat';
import { getChatSocketService } from '../services/chat/ChatSocketService';
import { chatFileService } from '../services/chat/ChatFileService';
import { chatNotificationService } from '../services/chat/ChatNotificationService';
import logger from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = chatFileService.getMulterConfig();

/**
 * Validation middleware
 */
const handleValidationErrors = (
  req: express.Request,
  res: Response,
  next: express.NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array(),
    });
    return;
  }
  next();
};

// ==================== CONVERSATION ENDPOINTS ====================

/**
 * @route   GET /api/chat/conversations
 * @desc    Get user's conversations with filtering
 * @access  Private
 */
router.get(
  '/conversations',
  auth,
  [
    query('status').optional().isIn(['active', 'archived', 'resolved']),
    query('type').optional().isIn(['direct', 'group', 'patient_query', 'prescription_discussion', 'broadcast']),
    query('isPinned').optional().isBoolean(),
    query('patientId').optional().isMongoId(),
    query('search').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const filters = {
        status: req.query.status as any,
        type: req.query.type as any,
        isPinned: req.query.isPinned === 'true' ? true : req.query.isPinned === 'false' ? false : undefined,
        patientId: req.query.patientId as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const conversations = await chatService.getConversations(userId, workplaceId, filters);

      res.json({
        success: true,
        data: conversations,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: conversations.length,
        },
      });
    } catch (error) {
      logger.error('Error getting conversations', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get conversations',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post(
  '/conversations',
  auth,
  [
    body('type').isIn(['direct', 'group', 'patient_query', 'prescription_discussion', 'broadcast']),
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('participants').isArray({ min: 1, max: 50 }),
    body('participants.*.userId').isMongoId(),
    body('participants.*.role').isIn(['pharmacist', 'doctor', 'patient', 'admin']),
    body('patientId').optional().isMongoId(),
    body('prescriptionId').optional().isMongoId(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const data = {
        ...req.body,
        createdBy: userId,
        workplaceId,
      };

      const conversation = await chatService.createConversation(data);

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation created successfully',
      });
    } catch (error) {
      logger.error('Error creating conversation', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to create conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get conversation details
 * @access  Private
 */
router.get(
  '/conversations/:id',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const conversation = await chatService.getConversation(conversationId, userId, workplaceId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      logger.error('Error getting conversation', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/conversations/:id
 * @desc    Update conversation
 * @access  Private
 */
router.put(
  '/conversations/:id',
  auth,
  [
    param('id').isMongoId(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('status').optional().isIn(['active', 'archived', 'resolved']),
    body('isPinned').optional().isBoolean(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const conversation = await chatService.updateConversation(
        conversationId,
        userId,
        workplaceId,
        req.body
      );

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation updated successfully',
      });
    } catch (error) {
      logger.error('Error updating conversation', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to update conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/conversations/:id/pin
 * @desc    Pin conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/pin',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const conversation = await chatService.pinConversation(conversationId, userId, workplaceId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation pinned successfully',
      });
    } catch (error) {
      logger.error('Error pinning conversation', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to pin conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/conversations/:id/archive
 * @desc    Archive conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/archive',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const conversation = await chatService.archiveConversation(conversationId, userId, workplaceId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation archived successfully',
      });
    } catch (error) {
      logger.error('Error archiving conversation', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to archive conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/conversations/:id/participants
 * @desc    Add participant to conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/participants',
  auth,
  [
    param('id').isMongoId(),
    body('userId').isMongoId(),
    body('role').isIn(['pharmacist', 'doctor', 'patient', 'admin']),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const { userId: newUserId, role } = req.body;
      const addedBy = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      await chatService.addParticipant(conversationId, newUserId, role, addedBy, workplaceId);

      res.json({
        success: true,
        message: 'Participant added successfully',
      });
    } catch (error) {
      logger.error('Error adding participant', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to add participant',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/conversations/:id/participants/:userId
 * @desc    Remove participant from conversation
 * @access  Private
 */
router.delete(
  '/conversations/:id/participants/:userId',
  auth,
  [param('id').isMongoId(), param('userId').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userIdToRemove = req.params.userId;
      const removedBy = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      await chatService.removeParticipant(conversationId, userIdToRemove, removedBy, workplaceId);

      res.json({
        success: true,
        message: 'Participant removed successfully',
      });
    } catch (error) {
      logger.error('Error removing participant', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to remove participant',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/conversations/:id/read
 * @desc    Mark conversation as read
 * @access  Private
 */
router.put(
  '/conversations/:id/read',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      await chatService.markConversationAsRead(conversationId, userId, workplaceId);

      res.json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error) {
      logger.error('Error marking conversation as read', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to mark conversation as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== MESSAGE ENDPOINTS ====================

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get messages for a conversation
 * @access  Private
 */
router.get(
  '/conversations/:id/messages',
  auth,
  [
    param('id').isMongoId(),
    query('threadId').optional().isMongoId(),
    query('before').optional().isISO8601(),
    query('after').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const filters = {
        threadId: req.query.threadId as string,
        before: req.query.before ? new Date(req.query.before as string) : undefined,
        after: req.query.after ? new Date(req.query.after as string) : undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const messages = await chatService.getMessages(conversationId, userId, workplaceId, filters);

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: messages.length,
        },
      });
    } catch (error) {
      logger.error('Error getting messages', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get messages',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/conversations/:id/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(
  '/conversations/:id/messages',
  auth,
  [
    param('id').isMongoId(),
    body('content.text').optional().isString().trim().isLength({ min: 1, max: 10000 }),
    body('content.type').isIn(['text', 'file', 'image', 'system']),
    body('threadId').optional().isMongoId(),
    body('parentMessageId').optional().isMongoId(),
    body('mentions').optional().isArray(),
    body('mentions.*').optional().isMongoId(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const senderId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const data = {
        conversationId,
        senderId,
        workplaceId,
        ...req.body,
      };

      const message = await chatService.sendMessage(data);

      // Emit real-time notification
      try {
        const socketService = getChatSocketService();
        socketService.sendMessageNotification(conversationId, {
          conversationId,
          messageId: message._id.toString(),
          senderId: message.senderId.toString(),
          content: message.content,
          createdAt: message.createdAt,
        });
      } catch (socketError) {
        logger.error('Failed to emit message notification', { socketError });
      }

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message sent successfully',
      });
    } catch (error) {
      logger.error('Error sending message', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/messages/:id
 * @desc    Edit message
 * @access  Private
 */
router.put(
  '/messages/:id',
  auth,
  [
    param('id').isMongoId(),
    body('content').isString().trim().isLength({ min: 1, max: 10000 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const { content } = req.body;

      const message = await chatService.editMessage(messageId, userId, workplaceId, content);

      // Emit real-time notification
      try {
        const socketService = getChatSocketService();
        socketService.sendMessageEditedNotification(
          message.conversationId.toString(),
          messageId,
          content,
          userId
        );
      } catch (socketError) {
        logger.error('Failed to emit message edited notification', { socketError });
      }

      res.json({
        success: true,
        data: message,
        message: 'Message edited successfully',
      });
    } catch (error) {
      logger.error('Error editing message', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to edit message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/messages/:id
 * @desc    Delete message
 * @access  Private
 */
router.delete(
  '/messages/:id',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const message = await chatService.deleteMessage(messageId, userId, workplaceId);

      // Emit real-time notification
      try {
        const socketService = getChatSocketService();
        if (message) {
          socketService.sendMessageDeletedNotification(
            message.conversationId.toString(),
            messageId,
            userId
          );
        }
      } catch (socketError) {
        logger.error('Failed to emit message deleted notification', { socketError });
      }

      res.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting message', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to delete message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/messages/:id/read
 * @desc    Mark message as read
 * @access  Private
 */
router.put(
  '/messages/:id/read',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      await chatService.markMessageAsRead(messageId, userId, workplaceId);

      res.json({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error) {
      logger.error('Error marking message as read', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to mark message as read',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== REACTION ENDPOINTS ====================

/**
 * @route   POST /api/chat/messages/:id/reactions
 * @desc    Add reaction to message
 * @access  Private
 */
router.post(
  '/messages/:id/reactions',
  auth,
  [
    param('id').isMongoId(),
    body('emoji').isString().isIn(['👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔', '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊']),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const { emoji } = req.body;

      const message = await chatService.addReaction(messageId, userId, workplaceId, emoji);

      // Emit real-time notification
      try {
        const socketService = getChatSocketService();
        socketService.sendReactionNotification(
          message.conversationId.toString(),
          messageId,
          userId,
          emoji,
          'added'
        );
      } catch (socketError) {
        logger.error('Failed to emit reaction notification', { socketError });
      }

      res.json({
        success: true,
        data: message,
        message: 'Reaction added successfully',
      });
    } catch (error) {
      logger.error('Error adding reaction', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to add reaction',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/messages/:id/reactions/:emoji
 * @desc    Remove reaction from message
 * @access  Private
 */
router.delete(
  '/messages/:id/reactions/:emoji',
  auth,
  [param('id').isMongoId(), param('emoji').isString()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const emoji = decodeURIComponent(req.params.emoji);

      const message = await chatService.removeReaction(messageId, userId, workplaceId, emoji);

      // Emit real-time notification
      try {
        const socketService = getChatSocketService();
        socketService.sendReactionNotification(
          message.conversationId.toString(),
          messageId,
          userId,
          emoji,
          'removed'
        );
      } catch (socketError) {
        logger.error('Failed to emit reaction notification', { socketError });
      }

      res.json({
        success: true,
        data: message,
        message: 'Reaction removed successfully',
      });
    } catch (error) {
      logger.error('Error removing reaction', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to remove reaction',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get total unread count for user
 * @access  Private
 */
router.get(
  '/unread-count',
  auth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();

      const unreadCount = await chatService.getUnreadCount(userId, workplaceId);

      res.json({
        success: true,
        data: { unreadCount },
      });
    } catch (error) {
      logger.error('Error getting unread count', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== MODERATION ENDPOINTS ====================

/**
 * @route   POST /api/chat/messages/:id/report
 * @desc    Report a message for moderation
 * @access  Private
 */
router.post(
  '/messages/:id/report',
  auth,
  [
    param('id').isMongoId(),
    body('reason').isString().isIn(['inappropriate', 'spam', 'harassment', 'privacy_violation', 'other']),
    body('description').optional().isString().trim().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const { reason, description } = req.body;

      const message = await chatService.reportMessage(
        messageId,
        userId,
        workplaceId,
        reason,
        description
      );

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message reported successfully. Admins have been notified.',
      });
    } catch (error) {
      logger.error('Error reporting message', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to report message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/moderation/queue
 * @desc    Get moderation queue (flagged messages) - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/moderation/queue',
  auth,
  [
    query('status').optional().isIn(['pending', 'reviewed', 'dismissed']),
    query('reason').optional().isString(),
    query('before').optional().isISO8601(),
    query('after').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const filters = {
        status: req.query.status as any,
        reason: req.query.reason as string,
        before: req.query.before ? new Date(req.query.before as string) : undefined,
        after: req.query.after ? new Date(req.query.after as string) : undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const messages = await chatService.getModerationQueue(workplaceId, filters);

      res.json({
        success: true,
        data: messages,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: messages.length,
        },
      });
    } catch (error) {
      logger.error('Error getting moderation queue', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get moderation queue',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/messages/:id/flags/:flagId/dismiss
 * @desc    Dismiss a message flag - Admin only
 * @access  Private (Admin)
 */
router.post(
  '/messages/:id/flags/:flagId/dismiss',
  auth,
  [
    param('id').isMongoId(),
    param('flagId').isMongoId(),
    body('reviewNotes').optional().isString().trim().isLength({ max: 1000 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const flagId = req.params.flagId;
      const adminId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;
      const { reviewNotes } = req.body;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const message = await chatService.dismissMessageFlag(
        messageId,
        flagId,
        adminId,
        workplaceId,
        reviewNotes
      );

      res.json({
        success: true,
        data: message,
        message: 'Flag dismissed successfully',
      });
    } catch (error) {
      logger.error('Error dismissing flag', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to dismiss flag',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/messages/:id/admin
 * @desc    Admin delete message with audit logging - Admin only
 * @access  Private (Admin)
 */
router.delete(
  '/messages/:id/admin',
  auth,
  [
    param('id').isMongoId(),
    body('reason').isString().trim().isLength({ min: 1, max: 500 }),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const messageId = req.params.id;
      const adminId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;
      const { reason } = req.body;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      await chatService.adminDeleteMessage(messageId, adminId, workplaceId, reason);

      res.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting message', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to delete message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/analytics
 * @desc    Get communication analytics - Admin only
 * @access  Private (Admin)
 */
router.get(
  '/analytics',
  auth,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();
      const userRole = req.user!.role;

      // Check if user is admin
      if (!['admin', 'super_admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
        return;
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const analytics = await chatService.getCommunicationAnalytics(workplaceId, startDate, endDate);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error getting analytics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== FILE UPLOAD ENDPOINTS ====================

/**
 * @route   POST /api/chat/files/upload
 * @desc    Upload files
 * @access  Private
 */
router.post(
  '/files/upload',
  auth,
  upload.array('files', 10),
  [
    body('conversationId').isMongoId(),
    body('messageId').isMongoId(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const workplaceId = req.user!.workplaceId.toString();
      const { conversationId, messageId } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
        return;
      }

      // Upload all files
      const uploadResults = await Promise.all(
        files.map(file =>
          chatFileService.uploadFile({
            file,
            conversationId,
            messageId,
            uploadedBy: userId,
            workplaceId,
          })
        )
      );

      // Scan files asynchronously
      uploadResults.forEach(result => {
        chatFileService.scanFile(result.fileId).catch(error => {
          logger.error('Error scanning file', { error, fileId: result.fileId });
        });
      });

      res.status(201).json({
        success: true,
        data: uploadResults,
        message: 'Files uploaded successfully',
      });
    } catch (error) {
      logger.error('Error uploading files', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to upload files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/files/:id
 * @desc    Get file metadata and download URL
 * @access  Private
 */
router.get(
  '/files/:id',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const fileId = req.params.id;

      const fileMetadata = await chatFileService.getFileMetadata(fileId);

      // Generate fresh download URL
      const downloadUrl = await chatFileService.getDownloadUrl(fileMetadata.s3Key);

      res.json({
        success: true,
        data: {
          ...fileMetadata.toObject(),
          downloadUrl,
        },
      });
    } catch (error) {
      logger.error('Error getting file', { error });
      res.status(404).json({
        success: false,
        message: 'File not found',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/files/:id
 * @desc    Delete file
 * @access  Private
 */
router.delete(
  '/files/:id',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const fileId = req.params.id;
      const userId = req.user!.id;

      await chatFileService.deleteFileAndMetadata(fileId, userId);

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting file', { error });
      res.status(400).json({
        success: false,
        message: 'Failed to delete file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/conversations/:id/files
 * @desc    Get all files in a conversation
 * @access  Private
 */
router.get(
  '/conversations/:id/files',
  auth,
  [
    param('id').isMongoId(),
    query('type').optional().isString(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const conversationId = req.params.id;
      const mimeType = req.query.type as string;

      const files = await chatFileService.getConversationFiles(conversationId, mimeType);

      res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      logger.error('Error getting conversation files', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get conversation files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/storage-stats
 * @desc    Get storage statistics for workplace
 * @access  Private
 */
router.get(
  '/storage-stats',
  auth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const workplaceId = req.user!.workplaceId.toString();

      const stats = await chatFileService.getStorageStats(workplaceId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting storage stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get storage stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/health
 * @desc    Health check for chat module
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    module: 'chat',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      conversations: true,
      messages: true,
      reactions: true,
      threading: true,
      mentions: true,
      readReceipts: true,
      fileUploads: true,
    },
  });
});

export default router;
