import express from 'express';
import { auth } from '../middlewares/auth';
import rbac from '../middlewares/rbac';
import { FileUploadService } from '../services/fileUploadService';
import CommunicationFileController from '../controllers/communicationFileController';
import rateLimiting from '../middlewares/rateLimiting';

const router = express.Router();

// Create upload middleware with enhanced security
const uploadMiddleware = FileUploadService.createUploadMiddleware();

// Apply authentication and RBAC to all routes
router.use(auth);
router.use(rbac.requireRole('pharmacist', 'doctor', 'patient'));

// Apply rate limiting for file operations
const fileUploadLimiter = rateLimiting.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Too many file uploads, please try again later',
});

const fileDownloadLimiter = rateLimiting.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 downloads per window
  message: 'Too many file downloads, please try again later',
});

/**
 * @route POST /api/communication/upload
 * @desc Upload file to conversation
 * @access Private (Pharmacist, Doctor, Patient)
 */
router.post(
  '/upload',
  fileUploadLimiter,
  uploadMiddleware.single('file'),
  CommunicationFileController.uploadFile
);

/**
 * @route GET /api/communication/files/:fileId/download
 * @desc Download file with access control
 * @access Private (Pharmacist, Doctor, Patient)
 */
router.get(
  '/files/:fileId/download',
  fileDownloadLimiter,
  CommunicationFileController.downloadFile
);

/**
 * @route DELETE /api/communication/files/:fileId
 * @desc Delete file (owner or admin only)
 * @access Private (File Owner or Admin)
 */
router.delete('/files/:fileId', CommunicationFileController.deleteFile);

/**
 * @route GET /api/communication/files/:fileId/metadata
 * @desc Get file metadata
 * @access Private (Pharmacist, Doctor, Patient)
 */
router.get(
  '/files/:fileId/metadata',
  CommunicationFileController.getFileMetadata
);

/**
 * @route GET /api/communication/conversations/:conversationId/files
 * @desc List files in a conversation
 * @access Private (Conversation Participants)
 */
router.get(
  '/conversations/:conversationId/files',
  CommunicationFileController.listConversationFiles
);

export default router;
