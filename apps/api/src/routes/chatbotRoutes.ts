import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import { chatbotService } from '../services/chat/ChatbotService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/chatbot/message
 * @desc    Send message to chatbot
 * @access  Public (can be used by unauthenticated users)
 */
router.post(
  '/message',
  [
    body('sessionId').trim().notEmpty().withMessage('Session ID is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('userId').optional().isMongoId(),
    body('workplaceId').optional().isMongoId(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId, message, userId, workplaceId } = req.body;

      const response = await chatbotService.processMessage(
        sessionId,
        message,
        userId,
        workplaceId
      );

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Error processing chatbot message', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to process message',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chatbot/escalate
 * @desc    Escalate chatbot conversation to human
 * @access  Private
 */
router.post(
  '/escalate',
  auth,
  [
    body('sessionId').trim().notEmpty().withMessage('Session ID is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId, reason } = req.body;
      const patientId = (req as any).user.userId;
      const workplaceId = (req as any).user.workplaceId;

      const result = await chatbotService.escalateToHuman(
        sessionId,
        reason,
        patientId,
        workplaceId
      );

      res.json({
        success: true,
        data: result,
        message: 'Conversation escalated to pharmacist successfully',
      });
    } catch (error) {
      logger.error('Error escalating chatbot conversation', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to escalate conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chatbot/analytics
 * @desc    Get chatbot analytics
 * @access  Private (Admin only)
 */
router.get(
  '/analytics',
  auth,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { startDate, endDate } = req.query;

      const analytics = await chatbotService.getAnalytics(
        workplaceId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error getting chatbot analytics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chatbot/session/:sessionId
 * @desc    Clear chatbot session
 * @access  Public
 */
router.delete(
  '/session/:sessionId',
  [param('sessionId').trim().notEmpty().withMessage('Session ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sessionId } = req.params;

      chatbotService.clearSession(sessionId);

      res.json({
        success: true,
        message: 'Session cleared successfully',
      });
    } catch (error) {
      logger.error('Error clearing chatbot session', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to clear session',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
