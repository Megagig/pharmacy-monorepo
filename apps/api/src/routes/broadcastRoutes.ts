import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import { chatService } from '../services/chat/ChatService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/chat/broadcasts
 * @desc    Create a broadcast message
 * @access  Private (Admin only)
 */
router.post(
  '/',
  auth,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('priority').isIn(['normal', 'high', 'urgent']).withMessage('Invalid priority'),
    body('audienceType').isIn(['all', 'roles', 'specific']).withMessage('Invalid audience type'),
    body('roles').optional().isArray(),
    body('userIds').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const createdBy = (req as any).user.userId;

      const result = await chatService.createBroadcast({
        ...req.body,
        workplaceId,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Broadcast sent successfully',
      });
    } catch (error) {
      logger.error('Error creating broadcast', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create broadcast',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/broadcasts
 * @desc    List broadcast messages
 * @access  Private
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const workplaceId = (req as any).user.workplaceId;
    const userId = (req as any).user.userId;

    const broadcasts = await chatService.getConversations(userId, workplaceId, {
      type: 'broadcast',
    });

    res.json({
      success: true,
      data: broadcasts,
      count: broadcasts.length,
    });
  } catch (error) {
    logger.error('Error getting broadcasts', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get broadcasts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/chat/broadcasts/:id/stats
 * @desc    Get broadcast statistics
 * @access  Private (Admin only)
 */
router.get(
  '/:id/stats',
  auth,
  [param('id').isMongoId().withMessage('Valid broadcast ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      const stats = await chatService.getBroadcastStats(id, workplaceId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting broadcast stats', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get broadcast statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
