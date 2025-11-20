import express from 'express';
import {
  getUserSuggestions,
  searchMessagesByMentions,
  getMentionStats,
  getMentionedUsers,
} from '../controllers/mentionController';
import { auth } from '../middlewares/auth';
import { loadWorkspaceContext } from '../middlewares/workspaceContext';
import rateLimiting from '../middlewares/rateLimiting';

const router = express.Router();

// Apply authentication and workspace context to all routes
router.use(auth);
router.use(loadWorkspaceContext);

/**
 * @route   GET /api/mentions/conversations/:conversationId/suggestions
 * @desc    Get user suggestions for mentions in a conversation
 * @access  Private
 * @params  conversationId - ID of the conversation
 * @query   query - Search query for filtering users
 * @query   limit - Maximum number of suggestions (default: 10)
 */
router.get(
  '/conversations/:conversationId/suggestions',
  rateLimiting.createRateLimiter({ windowMs: 60000, max: 100 }), // 100 requests per minute
  getUserSuggestions
);

/**
 * @route   GET /api/mentions/conversations/:conversationId/messages
 * @desc    Search messages by mentions in a conversation
 * @access  Private
 * @params  conversationId - ID of the conversation
 * @query   userId - Filter by specific mentioned user (optional)
 * @query   limit - Maximum number of messages (default: 50)
 * @query   page - Page number for pagination (default: 1)
 */
router.get(
  '/conversations/:conversationId/messages',
  rateLimiting.createRateLimiter({ windowMs: 60000, max: 50 }), // 50 requests per minute
  searchMessagesByMentions
);

/**
 * @route   GET /api/mentions/conversations/:conversationId/stats
 * @desc    Get mention statistics for a conversation
 * @access  Private
 * @params  conversationId - ID of the conversation
 */
router.get(
  '/conversations/:conversationId/stats',
  rateLimiting.createRateLimiter({ windowMs: 60000, max: 30 }), // 30 requests per minute
  getMentionStats
);

/**
 * @route   GET /api/mentions/conversations/:conversationId/users
 * @desc    Get users mentioned in a conversation
 * @access  Private
 * @params  conversationId - ID of the conversation
 */
router.get(
  '/conversations/:conversationId/users',
  rateLimiting.createRateLimiter({ windowMs: 60000, max: 30 }), // 30 requests per minute
  getMentionedUsers
);

export default router;
