import { Router } from 'express';
import patientMessagingController from '../controllers/patientMessagingController';
import { patientPortalAuth, patientPortalRateLimit, logPatientActivity } from '../middlewares/patientPortalAuth';
import { createPatientAttachmentUpload, processUploadedFiles } from '../middlewares/upload';
import { validateRequest } from '../middlewares/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply patient portal authentication to all routes
router.use(patientPortalAuth);

// Validation schemas
const conversationValidation = [
  body('pharmacistId')
    .isMongoId()
    .withMessage('Valid pharmacist ID is required'),
];

const messageValidation = [
  param('conversationId')
    .isMongoId()
    .withMessage('Valid conversation ID is required'),
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters'),
];

const conversationParamValidation = [
  param('conversationId')
    .isMongoId()
    .withMessage('Valid conversation ID is required'),
];

const messageQueryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
];

// Create upload middleware for attachments
const attachmentUpload = createPatientAttachmentUpload();

/**
 * @route   POST /api/patient-portal/messaging/conversations
 * @desc    Get or create conversation with pharmacist
 * @access  Private (Patient)
 */
router.post(
  '/conversations',
  patientPortalRateLimit(20, 15 * 60 * 1000), // 20 requests per 15 minutes
  logPatientActivity('create_conversation'),
  conversationValidation,
  validateRequest,
  patientMessagingController.getOrCreateConversation
);

/**
 * @route   GET /api/patient-portal/messaging/conversations
 * @desc    Get patient's conversations
 * @access  Private (Patient)
 */
router.get(
  '/conversations',
  patientPortalRateLimit(60, 15 * 60 * 1000), // 60 requests per 15 minutes
  logPatientActivity('get_conversations'),
  patientMessagingController.getConversations
);

/**
 * @route   GET /api/patient-portal/messaging/conversations/:conversationId
 * @desc    Get conversation details
 * @access  Private (Patient)
 */
router.get(
  '/conversations/:conversationId',
  patientPortalRateLimit(60, 15 * 60 * 1000), // 60 requests per 15 minutes
  logPatientActivity('get_conversation_details'),
  conversationParamValidation,
  validateRequest,
  patientMessagingController.getConversationDetails
);

/**
 * @route   GET /api/patient-portal/messaging/conversations/:conversationId/messages
 * @desc    Get messages from a conversation
 * @access  Private (Patient)
 */
router.get(
  '/conversations/:conversationId/messages',
  patientPortalRateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  logPatientActivity('get_messages'),
  conversationParamValidation,
  messageQueryValidation,
  validateRequest,
  patientMessagingController.getMessages
);

/**
 * @route   POST /api/patient-portal/messaging/conversations/:conversationId/messages
 * @desc    Send a message
 * @access  Private (Patient)
 */
router.post(
  '/conversations/:conversationId/messages',
  patientPortalRateLimit(50, 15 * 60 * 1000), // 50 messages per 15 minutes
  logPatientActivity('send_message'),
  attachmentUpload.array('attachments', 5), // Allow up to 5 attachments
  processUploadedFiles('patientAttachments'),
  messageValidation,
  validateRequest,
  patientMessagingController.sendMessage
);

/**
 * @route   POST /api/patient-portal/messaging/conversations/:conversationId/attachments
 * @desc    Upload attachment for conversation
 * @access  Private (Patient)
 */
router.post(
  '/conversations/:conversationId/attachments',
  patientPortalRateLimit(20, 15 * 60 * 1000), // 20 uploads per 15 minutes
  logPatientActivity('upload_attachment'),
  attachmentUpload.single('attachment'),
  processUploadedFiles('patientAttachments'),
  conversationParamValidation,
  validateRequest,
  patientMessagingController.uploadAttachment
);

/**
 * @route   PUT /api/patient-portal/messaging/conversations/:conversationId/read
 * @desc    Mark conversation as read
 * @access  Private (Patient)
 */
router.put(
  '/conversations/:conversationId/read',
  patientPortalRateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  logPatientActivity('mark_as_read'),
  conversationParamValidation,
  validateRequest,
  patientMessagingController.markAsRead
);

/**
 * @route   GET /api/patient-portal/messaging/unread-count
 * @desc    Get unread message count
 * @access  Private (Patient)
 */
router.get(
  '/unread-count',
  patientPortalRateLimit(60, 15 * 60 * 1000), // 60 requests per 15 minutes
  logPatientActivity('get_unread_count'),
  patientMessagingController.getUnreadCount
);

// Error handling middleware for this router
router.use((error: any, req: any, res: any, next: any) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the maximum limit',
      code: 'FILE_TOO_LARGE',
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files uploaded',
      code: 'TOO_MANY_FILES',
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field',
      code: 'UNEXPECTED_FILE',
    });
  }

  next(error);
});

export default router;