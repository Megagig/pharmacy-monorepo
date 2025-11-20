// Legacy upload service - now uses the enhanced FileUploadService
import FileUploadService, { uploadMiddleware } from '../services/fileUploadService';

// Export the enhanced upload middleware
export const upload = uploadMiddleware;

// Export helper functions for backward compatibility
export const deleteFile = FileUploadService.deleteFile.bind(FileUploadService);
export const getFileUrl = FileUploadService.getFileUrl.bind(FileUploadService);
export const validateFileExists = FileUploadService.fileExists.bind(FileUploadService);

// Additional exports from the enhanced service
export const fileExists = FileUploadService.fileExists.bind(FileUploadService);
export const getFilePath = FileUploadService.getFilePath.bind(FileUploadService);
export const getFileStats = FileUploadService.getFileStats.bind(FileUploadService);

export default {
  upload,
  deleteFile,
  getFileUrl,
  validateFileExists,
  fileExists,
  getFilePath,
  getFileStats
};
