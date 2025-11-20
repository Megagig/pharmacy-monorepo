import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import communicationController from '../controllers/communicationController';
import { uploadMiddleware } from '../services/fileUploadService';
import {
  auditMessage,
  auditConversation,
  auditFile,
  auditSearch,
  auditPatientCommunicationAccess,
  auditBulkOperation,
  auditHighRiskOperation,
} from '../middlewares/communicationAuditMiddleware';
import {
  encryptMessageContent,
  decryptMessageContent,
  validateEncryptionCompliance,
} from '../middlewares/encryptionMiddleware';

// Enhanced security middleware
import communicationRBAC from '../middlewares/communicationRBAC';
import communicationRateLimiting from '../middlewares/communicationRateLimiting';
import communicationSecurity from '../middlewares/communicationSecurity';
import communicationCSRF from '../middlewares/communicationCSRF';
import communicationSessionManagement from '../middlewares/communicationSessionManagement';
import {
  monitorSecurityEvents,
  monitorDataAccess,
} from '../middlewares/securityMonitoring';

const router = express.Router();

// Apply global security middleware for all communication routes
router.use(communicationSecurity.setCommunicationCSP);
router.use(communicationSecurity.preventNoSQLInjection);
router.use(communicationSecurity.validateCommunicationInput);
router.use(communicationSessionManagement.validateSession);
router.use(communicationCSRF.setCSRFCookie);

// Validation middleware
const handleValidationErrors = (
  req: express.Request,
  res: express.Response,
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

// Conversation routes

/**
 * @route   GET /api/communication/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get(
  '/conversations',
  auth,
  communicationRateLimiting.searchRateLimit,
  [
    query('status')
      .optional()
      .isIn(['active', 'archived', 'resolved', 'closed']),
    query('type')
      .optional()
      .isIn(['direct', 'group', 'patient_query', 'clinical_consultation']),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    query('patientId').optional().isMongoId(),
    query('search').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeSearchQuery,
  monitorDataAccess('conversation'),
  communicationController.getConversations
);

/**
 * @route   POST /api/communication/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post(
  '/conversations',
  auth,
  communicationRateLimiting.conversationRateLimit,
  communicationCSRF.doubleSubmitCSRF,  // Use double-submit pattern instead of token store
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('type').isIn([
      'direct',
      'group',
      'patient_query',
      'clinical_consultation',
    ]),
    body('participants').isArray({ min: 1, max: 50 }),
    // Accept both string IDs and objects with userId/role
    body('participants.*').custom((value) => {
      // If it's a string, it should be a valid MongoDB ID
      if (typeof value === 'string') {
        return /^[a-f\d]{24}$/i.test(value);
      }
      // If it's an object, it should have userId and role
      if (typeof value === 'object' && value.userId && value.role) {
        return /^[a-f\d]{24}$/i.test(value.userId);
      }
      throw new Error('Invalid participant format');
    }),
    body('patientId').optional().isMongoId(),
    body('caseId').optional().isString().trim().isLength({ max: 100 }),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('tags').optional().isArray(),
    body('tags.*').isString().trim().isLength({ max: 50 }),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeConversationData,
  communicationRBAC.validateParticipantRoles,
  communicationRBAC.enforceConversationTypeRestrictions,
  monitorSecurityEvents('conversation_creation'),
  ...auditConversation('conversation_created'),
  communicationController.createConversation
);

/**
 * @route   GET /api/communication/conversations/:id
 * @desc    Get conversation details
 * @access  Private
 */
router.get(
  '/conversations/:id',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  communicationRBAC.requireConversationAccess('canViewConversation'),
  monitorDataAccess('conversation'),
  communicationController.getConversation
);

/**
 * @route   PUT /api/communication/conversations/:id
 * @desc    Update conversation
 * @access  Private
 */
router.put(
  '/conversations/:id',
  auth,
  communicationCSRF.requireCSRFToken,
  [
    param('id').isMongoId(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('tags').optional().isArray(),
    body('tags.*').isString().trim().isLength({ max: 50 }),
    body('status')
      .optional()
      .isIn(['active', 'archived', 'resolved', 'closed']),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeConversationData,
  communicationRBAC.requireConversationAccess('canUpdateConversation'),
  monitorSecurityEvents('conversation_update'),
  communicationController.updateConversation
);

/**
 * @route   POST /api/communication/conversations/:id/participants
 * @desc    Add participant to conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/participants',
  auth,
  [
    param('id').isMongoId(),
    body('userId').isMongoId(),
    body('role').isIn([
      'pharmacist',
      'doctor',
      'patient',
      'pharmacy_team',
      'intern_pharmacist',
    ]),
  ],
  handleValidationErrors,
  ...auditConversation('participant_added'),
  communicationController.addParticipant
);

/**
 * @route   DELETE /api/communication/conversations/:id/participants/:userId
 * @desc    Remove participant from conversation
 * @access  Private
 */
router.delete(
  '/conversations/:id/participants/:userId',
  auth,
  [param('id').isMongoId(), param('userId').isMongoId()],
  handleValidationErrors,
  ...auditConversation('participant_removed'),
  communicationController.removeParticipant
);

// Message routes

/**
 * @route   GET /api/communication/conversations/:id/messages
 * @desc    Get messages for a conversation
 * @access  Private
 */
router.get(
  '/conversations/:id/messages',
  auth,
  [
    param('id').isMongoId(),
    query('type')
      .optional()
      .isIn(['text', 'file', 'image', 'clinical_note', 'system', 'voice_note']),
    query('senderId').optional().isMongoId(),
    query('mentions').optional().isMongoId(),
    query('priority').optional().isIn(['normal', 'high', 'urgent']),
    query('before').optional().isISO8601(),
    query('after').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  decryptMessageContent,
  communicationController.getMessages
);

/**
 * @route   POST /api/communication/conversations/:id/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(
  '/conversations/:id/messages',
  auth,
  communicationRateLimiting.messageRateLimit,
  communicationRateLimiting.burstProtection,
  communicationRateLimiting.spamDetection,
  communicationCSRF.requireCSRFToken,
  [
    param('id').isMongoId(),
    // Content can be sent as JSON string in FormData or as object
    body('content')
      .custom((value) => {
        // If it's a string, try to parse it as JSON
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object';
          } catch {
            return false;
          }
        }
        // If it's already an object, that's fine too
        return typeof value === 'object' && value !== null;
      })
      .withMessage('Content must be a valid JSON object'),
    body('threadId').optional().isMongoId(),
    body('parentMessageId').optional().isMongoId(),
    body('mentions')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed);
          } catch {
            return false;
          }
        }
        return Array.isArray(value);
      }),
    body('priority').optional().isIn(['normal', 'high', 'urgent']),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeMessageContent,
  communicationRBAC.requireConversationAccess('canSendMessage'),
  encryptMessageContent,
  validateEncryptionCompliance,
  monitorSecurityEvents('message_sent'),
  auditMessage('message_sent'),
  communicationController.sendMessage
);

/**
 * @route   PUT /api/communication/messages/:id/read
 * @desc    Mark message as read
 * @access  Private
 */
router.put(
  '/messages/:id/read',
  auth,
  [param('id').isMongoId()],
  handleValidationErrors,
  ...auditMessage('message_read'),
  communicationController.markMessageAsRead
);

/**
 * @route   POST /api/communication/messages/:id/reactions
 * @desc    Add reaction to message
 * @access  Private
 */
router.post(
  '/messages/:id/reactions',
  auth,
  communicationCSRF.requireCSRFToken,
  [
    param('id').isMongoId(),
    body('emoji')
      .isString()
      .isIn([
        '👍',
        '👎',
        '❤️',
        '😊',
        '😢',
        '😮',
        '😡',
        '🤔',
        '✅',
        '❌',
        '⚠️',
        '🚨',
        '📋',
        '💊',
        '🩺',
        '📊',
      ]),
  ],
  handleValidationErrors,
  communicationSecurity.validateEmojiReaction,
  communicationRBAC.requireMessageAccess('canSendMessage'),
  communicationController.addReaction
);

/**
 * @route   DELETE /api/communication/messages/:id/reactions/:emoji
 * @desc    Remove reaction from message
 * @access  Private
 */
router.delete(
  '/messages/:id/reactions/:emoji',
  auth,
  [param('id').isMongoId(), param('emoji').isString()],
  handleValidationErrors,
  communicationController.removeReaction
);

/**
 * @route   PUT /api/communication/messages/:id
 * @desc    Edit message
 * @access  Private
 */
router.put(
  '/messages/:id',
  auth,
  communicationCSRF.requireCSRFToken,
  [
    param('id').isMongoId(),
    body('content').isString().trim().isLength({ min: 1, max: 10000 }),
    body('reason').optional().isString().trim().isLength({ max: 200 }),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeMessageContent,
  communicationRBAC.requireMessageAccess('canEditMessage'),
  monitorSecurityEvents('message_edit'),
  communicationController.editMessage
);

/**
 * @route   DELETE /api/communication/messages/:id
 * @desc    Delete message
 * @access  Private
 */
router.delete(
  '/messages/:id',
  auth,
  communicationCSRF.requireCSRFToken,
  [
    param('id').isMongoId(),
    body('reason').optional().isString().trim().isLength({ max: 200 }),
  ],
  handleValidationErrors,
  communicationRBAC.requireMessageAccess('canDeleteMessage'),
  monitorSecurityEvents('message_delete'),
  communicationController.deleteMessage
);

/**
 * @route   POST /api/communication/messages/statuses
 * @desc    Get message statuses for multiple messages
 * @access  Private
 */
router.post(
  '/messages/statuses',
  auth,
  [
    body('messageIds').isArray({ min: 1, max: 100 }),
    body('messageIds.*').isMongoId(),
  ],
  handleValidationErrors,
  communicationController.getMessageStatuses
);

// Search routes

/**
 * @route   GET /api/communication/search/messages
 * @desc    Enhanced message search with advanced filtering
 * @access  Private
 */
router.get(
  '/search/messages',
  auth,
  [
    query('q').isString().trim().isLength({ min: 1, max: 100 }),
    query('conversationId').optional().isMongoId(),
    query('senderId').optional().isMongoId(),
    query('participantId').optional().isMongoId(),
    query('type')
      .optional()
      .isIn(['text', 'file', 'image', 'clinical_note', 'system', 'voice_note']),
    query('fileType').optional().isString().trim(),
    query('priority').optional().isIn(['normal', 'high', 'urgent']),
    query('hasAttachments').optional().isBoolean(),
    query('hasMentions').optional().isBoolean(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('tags').optional().isArray(),
    query('tags.*').optional().isString().trim(),
    query('sortBy').optional().isIn(['relevance', 'date', 'sender']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  decryptMessageContent,
  ...auditSearch('message_search'),
  communicationController.searchMessages
);

/**
 * @route   GET /api/communication/search/conversations
 * @desc    Search conversations
 * @access  Private
 */
router.get(
  '/search/conversations',
  auth,
  [
    query('q').isString().trim().isLength({ min: 1, max: 100 }),
    query('type')
      .optional()
      .isIn(['direct', 'group', 'patient_query', 'clinical_consultation']),
    query('status')
      .optional()
      .isIn(['active', 'archived', 'resolved', 'closed']),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    query('patientId').optional().isMongoId(),
    query('tags').optional().isArray(),
    query('tags.*').optional().isString().trim(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('sortBy').optional().isIn(['relevance', 'date']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  communicationController.searchConversations
);

/**
 * @route   GET /api/communication/search/suggestions
 * @desc    Get search suggestions
 * @access  Private
 */
router.get(
  '/search/suggestions',
  auth,
  [query('q').optional().isString().trim().isLength({ max: 100 })],
  handleValidationErrors,
  communicationController.getSearchSuggestions
);

/**
 * @route   GET /api/communication/search/history
 * @desc    Get user's search history
 * @access  Private
 */
router.get(
  '/search/history',
  auth,
  [
    query('type').optional().isIn(['message', 'conversation']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  handleValidationErrors,
  communicationController.getSearchHistory
);

/**
 * @route   GET /api/communication/search/popular
 * @desc    Get popular searches in workplace
 * @access  Private
 */
router.get(
  '/search/popular',
  auth,
  [
    query('type').optional().isIn(['message', 'conversation']),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  handleValidationErrors,
  communicationController.getPopularSearches
);

/**
 * @route   POST /api/communication/search/save
 * @desc    Save a search for future use
 * @access  Private
 */
router.post(
  '/search/save',
  auth,
  [
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().trim().isLength({ max: 500 }),
    body('query').isString().trim().isLength({ min: 1, max: 500 }),
    body('filters').optional().isObject(),
    body('searchType').isIn(['message', 'conversation']),
    body('isPublic').optional().isBoolean(),
  ],
  handleValidationErrors,
  communicationController.saveSearch
);

/**
 * @route   GET /api/communication/search/saved
 * @desc    Get user's saved searches
 * @access  Private
 */
router.get(
  '/search/saved',
  auth,
  [
    query('type').optional().isIn(['message', 'conversation']),
    query('includePublic').optional().isBoolean(),
  ],
  handleValidationErrors,
  communicationController.getSavedSearches
);

/**
 * @route   POST /api/communication/search/saved/:searchId/use
 * @desc    Use a saved search (increment use count)
 * @access  Private
 */
router.post(
  '/search/saved/:searchId/use',
  auth,
  [param('searchId').isMongoId()],
  handleValidationErrors,
  communicationController.useSavedSearch
);

/**
 * @route   DELETE /api/communication/search/saved/:searchId
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete(
  '/search/saved/:searchId',
  auth,
  [param('searchId').isMongoId()],
  handleValidationErrors,
  communicationController.deleteSavedSearch
);

// Patient-specific routes

/**
 * @route   GET /api/communication/patients/:patientId/conversations
 * @desc    Get conversations for a specific patient
 * @access  Private
 */
router.get(
  '/patients/:patientId/conversations',
  auth,
  [
    param('patientId').isMongoId(),
    query('status')
      .optional()
      .isIn(['active', 'archived', 'resolved', 'closed']),
    query('type').optional().isIn(['patient_query', 'clinical_consultation']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  handleValidationErrors,
  decryptMessageContent,
  auditPatientCommunicationAccess,
  communicationController.getPatientConversations
);

/**
 * @route   POST /api/communication/patients/:patientId/queries
 * @desc    Create a patient query conversation
 * @access  Private
 */
router.post(
  '/patients/:patientId/queries',
  auth,
  [
    param('patientId').isMongoId(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('message').isString().trim().isLength({ min: 1, max: 10000 }),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('tags').optional().isArray(),
    body('tags.*').isString().trim().isLength({ max: 50 }),
  ],
  handleValidationErrors,
  encryptMessageContent,
  validateEncryptionCompliance,
  auditPatientCommunicationAccess,
  ...auditConversation('conversation_created'),
  communicationController.createPatientQuery
);

// Analytics and reporting routes

/**
 * @route   GET /api/communication/analytics/summary
 * @desc    Get communication analytics summary
 * @access  Private
 */
router.get(
  '/analytics/summary',
  auth,
  [
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('patientId').optional().isMongoId(),
  ],
  handleValidationErrors,
  communicationController.getAnalyticsSummary
);

// File upload routes

/**
 * @route   POST /api/communication/upload
 * @desc    Upload files for communication
 * @access  Private
 */
router.post(
  '/upload',
  auth,
  communicationRateLimiting.fileUploadRateLimit,
  communicationCSRF.requireCSRFToken,
  uploadMiddleware.array('files', 10), // Allow up to 10 files
  [
    body('conversationId').optional().isMongoId(),
    body('messageType').optional().isIn(['file', 'image', 'voice_note']),
  ],
  handleValidationErrors,
  communicationSecurity.validateFileUpload,
  communicationRBAC.requireFileAccess('upload'),
  monitorSecurityEvents('file_upload'),
  ...auditFile('file_uploaded'),
  communicationController.uploadFiles
);

/**
 * @route   GET /api/communication/files/:fileId
 * @desc    Get file details and secure download URL
 * @access  Private
 */
router.get(
  '/files/:fileId',
  auth,
  [param('fileId').isString().trim()],
  handleValidationErrors,
  communicationController.getFile
);

/**
 * @route   DELETE /api/communication/files/:fileId
 * @desc    Delete uploaded file
 * @access  Private
 */
router.delete(
  '/files/:fileId',
  auth,
  [param('fileId').isString().trim()],
  handleValidationErrors,
  communicationController.deleteFile
);

/**
 * @route   GET /api/communication/conversations/:id/files
 * @desc    Get all files shared in a conversation
 * @access  Private
 */
router.get(
  '/conversations/:id/files',
  auth,
  [
    param('id').isMongoId(),
    query('type').optional().isIn(['file', 'image', 'voice_note']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  communicationController.getConversationFiles
);

// Security and session management endpoints

/**
 * @route   GET /api/communication/csrf-token
 * @desc    Get CSRF token for secure operations
 * @access  Private
 */
router.get('/csrf-token', auth, communicationCSRF.provideCSRFToken);

/**
 * @route   GET /api/communication/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get(
  '/sessions',
  auth,
  communicationSessionManagement.sessionManagementEndpoints.getSessions
);

/**
 * @route   DELETE /api/communication/sessions/:sessionId
 * @desc    Terminate specific session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  auth,
  communicationCSRF.requireCSRFToken,
  communicationSessionManagement.sessionManagementEndpoints.terminateSession
);

/**
 * @route   DELETE /api/communication/sessions
 * @desc    Terminate all other sessions
 * @access  Private
 */
router.delete(
  '/sessions',
  auth,
  communicationCSRF.requireCSRFToken,
  communicationSessionManagement.sessionManagementEndpoints
    .terminateAllOtherSessions
);

/**
 * @route   GET /api/communication/health
 * @desc    Health check for communication module
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    module: 'communication-hub',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      realTimeMessaging: true,
      fileSharing: true,
      encryption: true,
      notifications: true,
      search: true,
      analytics: true,
      threading: true,
      security: {
        rbac: true,
        rateLimiting: true,
        inputSanitization: true,
        csrfProtection: true,
        sessionManagement: true,
        auditLogging: true,
      },
    },
  });
});

// Threading routes

/**
 * @route   POST /api/communication/messages/:messageId/thread
 * @desc    Create a thread from a message
 * @access  Private
 */
router.post(
  '/messages/:messageId/thread',
  auth,
  [param('messageId').isMongoId().withMessage('Valid message ID is required')],
  handleValidationErrors,
  auditMessage('message_sent'),
  communicationController.createThread
);

/**
 * @route   GET /api/communication/threads/:threadId/messages
 * @desc    Get thread messages
 * @access  Private
 */
router.get(
  '/threads/:threadId/messages',
  auth,
  [
    param('threadId').isMongoId().withMessage('Valid thread ID is required'),
    query('senderId').optional().isMongoId(),
    query('before').optional().isISO8601(),
    query('after').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  handleValidationErrors,
  auditMessage('message_read'),
  decryptMessageContent,
  communicationController.getThreadMessages
);

/**
 * @route   GET /api/communication/threads/:threadId/summary
 * @desc    Get thread summary
 * @access  Private
 */
router.get(
  '/threads/:threadId/summary',
  auth,
  [param('threadId').isMongoId().withMessage('Valid thread ID is required')],
  handleValidationErrors,
  auditMessage('message_read'),
  communicationController.getThreadSummary
);

/**
 * @route   POST /api/communication/threads/:threadId/reply
 * @desc    Reply to a thread
 * @access  Private
 */
router.post(
  '/threads/:threadId/reply',
  auth,
  uploadMiddleware.array('attachments', 10),
  [
    param('threadId').isMongoId().withMessage('Valid thread ID is required'),
    body('content.text')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 10000 }),
    body('content.type').isIn(['text', 'file', 'image', 'clinical_note']),
    body('mentions').optional().isArray(),
    body('mentions.*').optional().isMongoId(),
    body('priority').optional().isIn(['normal', 'high', 'urgent']),
  ],
  handleValidationErrors,
  validateEncryptionCompliance,
  encryptMessageContent,
  auditMessage('message_sent'),
  communicationController.replyToThread
);

/**
 * @route   GET /api/communication/conversations/:conversationId/threads
 * @desc    Get conversation threads
 * @access  Private
 */
router.get(
  '/conversations/:conversationId/threads',
  auth,
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Valid conversation ID is required'),
  ],
  handleValidationErrors,
  auditConversation('participant_added'),
  communicationController.getConversationThreads
);

/**
 * @route   GET /api/communication/participants/search
 * @desc    Search for participants (users) to add to conversations
 * @access  Private
 */
router.get(
  '/participants/search',
  auth,
  communicationRateLimiting.searchRateLimit,
  [
    query('q').optional().isString().trim().isLength({ min: 0, max: 100 }),
    query('role')
      .optional()
      .isIn(['doctor', 'pharmacist', 'patient', 'admin', 'super_admin']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  handleValidationErrors,
  communicationSecurity.sanitizeSearchQuery,
  communicationController.searchParticipants
);

export default router;
