import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Enhanced file upload middleware for patient portal
 * Supports blog featured images, patient attachments, and comprehensive security
 */

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
  maxFiles: number;
  enableVirusScanning?: boolean;
}

export interface UploadedFileData {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
  category: string;
  securityScan?: {
    scanned: boolean;
    safe: boolean;
    scanDate: Date;
  };
}

export class PatientPortalUploadService {
  // Upload configurations for different file types
  private static readonly UPLOAD_CONFIGS: Record<string, UploadConfig> = {
    // Blog featured images
    blogImages: {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      uploadPath: 'uploads/blog/images',
      maxFiles: 1,
      enableVirusScanning: true,
    },

    // Patient attachments (messages, medical records)
    patientAttachments: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.txt'],
      uploadPath: 'uploads/patient/attachments',
      maxFiles: 5,
      enableVirusScanning: true,
    },

    // Patient profile avatars
    patientAvatars: {
      maxFileSize: 2 * 1024 * 1024, // 2MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      uploadPath: 'uploads/patient/avatars',
      maxFiles: 1,
      enableVirusScanning: false,
    },

    // Medical documents (lab results, prescriptions)
    medicalDocuments: {
      maxFileSize: 15 * 1024 * 1024, // 15MB
      allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/dicom', // Medical imaging
      ],
      allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.dcm'],
      uploadPath: 'uploads/patient/medical',
      maxFiles: 10,
      enableVirusScanning: true,
    },
  };

  // Dangerous file extensions and signatures
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1', '.py', '.rb', '.pl',
    '.msi', '.deb', '.rpm', '.dmg', '.app', '.apk', '.ipa',
  ];

  private static readonly EXECUTABLE_SIGNATURES = [
    Buffer.from([0x4D, 0x5A]), // PE executable (MZ)
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O executable
    Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O executable (32-bit)
    Buffer.from([0xFE, 0xED, 0xFA, 0xCF]), // Mach-O executable (64-bit)
  ];

  /**
   * Initialize upload directories
   */
  static initializeUploadDirectories(): void {
    Object.values(this.UPLOAD_CONFIGS).forEach(config => {
      const fullPath = path.join(process.cwd(), config.uploadPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logger.info('Created upload directory', { path: fullPath });
      }
    });
  }

  /**
   * Generate secure filename with category prefix
   */
  private static generateSecureFilename(originalName: string, category: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const sanitizedName = path.basename(originalName, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .substring(0, 50);
    
    return `${category}-${timestamp}-${randomBytes}-${sanitizedName}${ext}`;
  }

  /**
   * Validate file against configuration
   */
  private static validateFile(
    file: Express.Multer.File,
    config: UploadConfig
  ): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > config.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${config.maxFileSize / (1024 * 1024)}MB`,
      };
    }

    // Check MIME type
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `File type ${file.mimetype} is not allowed`,
      };
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed`,
      };
    }

    // Check for dangerous extensions
    if (this.DANGEROUS_EXTENSIONS.includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed for security reasons`,
      };
    }

    // Validate filename
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\') ||
      file.originalname.includes('\0')
    ) {
      return {
        isValid: false,
        error: 'Invalid characters in filename',
      };
    }

    // Check for empty file
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'Empty files are not allowed',
      };
    }

    return { isValid: true };
  }

  /**
   * Scan file for malicious content
   */
  private static async scanFileContent(
    filePath: string,
    enableScanning: boolean = true
  ): Promise<{ isSafe: boolean; error?: string }> {
    if (!enableScanning) {
      return { isSafe: true };
    }

    try {
      // Read first 1KB to check for executable signatures
      const buffer = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      // Check for executable signatures
      for (const signature of this.EXECUTABLE_SIGNATURES) {
        if (bytesRead >= signature.length) {
          if (buffer.subarray(0, signature.length).equals(signature)) {
            return {
              isSafe: false,
              error: 'File contains executable content',
            };
          }
        }
      }

      // Check for script content in text files
      const fileContent = buffer.subarray(0, bytesRead).toString('utf8', 0, Math.min(bytesRead, 512));
      const scriptPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i, // Event handlers
        /eval\s*\(/i,
        /document\.write/i,
        /window\.location/i,
      ];

      for (const pattern of scriptPatterns) {
        if (pattern.test(fileContent)) {
          return {
            isSafe: false,
            error: 'File contains potentially malicious script content',
          };
        }
      }

      // Additional checks for image files
      const ext = path.extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        // Check for embedded scripts in image metadata
        if (fileContent.includes('<script') || fileContent.includes('javascript:')) {
          return {
            isSafe: false,
            error: 'Image file contains embedded scripts',
          };
        }
      }

      return { isSafe: true };
    } catch (error: any) {
      logger.error('Error scanning file content', { filePath, error: error.message });
      return {
        isSafe: false,
        error: 'Unable to scan file content',
      };
    }
  }

  /**
   * Create multer storage for specific category
   */
  static createStorage(category: string): multer.StorageEngine {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      throw new Error(`Unknown upload category: ${category}`);
    }

    return multer.diskStorage({
      destination: (req: Request, file: Express.Multer.File, cb) => {
        const uploadPath = path.join(process.cwd(), config.uploadPath);
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req: Request, file: Express.Multer.File, cb) => {
        const secureFilename = this.generateSecureFilename(file.originalname, category);
        cb(null, secureFilename);
      },
    });
  }

  /**
   * Create file filter for specific category
   */
  static createFileFilter(category: string): multer.Options['fileFilter'] {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      throw new Error(`Unknown upload category: ${category}`);
    }

    return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const validation = this.validateFile(file, config);

      if (!validation.isValid) {
        cb(new Error(validation.error || 'Invalid file'));
        return;
      }

      cb(null, true);
    };
  }

  /**
   * Create configured multer instance for category
   */
  static createUploadMiddleware(category: string): multer.Multer {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      throw new Error(`Unknown upload category: ${category}`);
    }

    return multer({
      storage: this.createStorage(category),
      fileFilter: this.createFileFilter(category),
      limits: {
        fileSize: config.maxFileSize,
        files: config.maxFiles,
        fieldSize: 1024 * 1024, // 1MB field size limit
        fieldNameSize: 100, // Field name size limit
        fields: 10, // Maximum number of non-file fields
      },
    });
  }

  /**
   * Process uploaded file with security scanning
   */
  static async processUploadedFile(
    file: Express.Multer.File,
    category: string
  ): Promise<{
    success: boolean;
    fileData?: UploadedFileData;
    error?: string;
  }> {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      return {
        success: false,
        error: `Unknown upload category: ${category}`,
      };
    }

    try {
      const filePath = file.path;

      // Perform content scanning
      const scanResult = await this.scanFileContent(filePath, config.enableVirusScanning);
      if (!scanResult.isSafe) {
        // Delete the unsafe file
        await this.deleteFile(filePath);
        return {
          success: false,
          error: scanResult.error || 'File failed security scan',
        };
      }

      // Generate file URL
      const fileUrl = this.getFileUrl(file.filename, category);

      // Return file data
      const fileData: UploadedFileData = {
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: fileUrl,
        uploadedAt: new Date(),
        category,
        securityScan: config.enableVirusScanning ? {
          scanned: true,
          safe: scanResult.isSafe,
          scanDate: new Date(),
        } : undefined,
      };

      return {
        success: true,
        fileData,
      };
    } catch (error: any) {
      logger.error('Error processing uploaded file', {
        filename: file.filename,
        category,
        error: error.message,
      });

      // Clean up file on error
      if (file.path && fs.existsSync(file.path)) {
        await this.deleteFile(file.path);
      }

      return {
        success: false,
        error: 'Failed to process uploaded file',
      };
    }
  }

  /**
   * Delete file from filesystem
   */
  static async deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          logger.error('Error deleting file', { filePath, error: err.message });
          reject(err);
        } else {
          logger.info('File deleted successfully', { filePath });
          resolve();
        }
      });
    });
  }

  /**
   * Generate file URL for category
   */
  static getFileUrl(filename: string, category: string): string {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      throw new Error(`Unknown upload category: ${category}`);
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const relativePath = config.uploadPath.replace('uploads/', '');
    return `${baseUrl}/uploads/${relativePath}/${filename}`;
  }

  /**
   * Check if file exists
   */
  static fileExists(filename: string, category: string): boolean {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      return false;
    }

    const filePath = path.join(process.cwd(), config.uploadPath, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Get file path
   */
  static getFilePath(filename: string, category: string): string | null {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      return null;
    }

    return path.join(process.cwd(), config.uploadPath, filename);
  }

  /**
   * Get file stats
   */
  static getFileStats(filename: string, category: string): fs.Stats | null {
    try {
      const filePath = this.getFilePath(filename, category);
      if (!filePath) {
        return null;
      }
      return fs.statSync(filePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up old files for category
   */
  static async cleanupOldFiles(category: string, daysOld: number = 30): Promise<number> {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      throw new Error(`Unknown upload category: ${category}`);
    }

    try {
      const uploadPath = path.join(process.cwd(), config.uploadPath);
      const files = fs.readdirSync(uploadPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(uploadPath, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          await this.deleteFile(filePath);
          deletedCount++;
        }
      }

      logger.info('Cleanup completed', { category, deletedCount, daysOld });
      return deletedCount;
    } catch (error: any) {
      logger.error('Error during file cleanup', { category, error: error.message });
      throw error;
    }
  }

  /**
   * Get upload statistics for category
   */
  static getUploadStats(category: string): { size: number; fileCount: number } {
    const config = this.UPLOAD_CONFIGS[category];
    if (!config) {
      return { size: 0, fileCount: 0 };
    }

    try {
      const uploadPath = path.join(process.cwd(), config.uploadPath);
      const files = fs.readdirSync(uploadPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(uploadPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        size: totalSize,
        fileCount: files.length,
      };
    } catch (error) {
      return { size: 0, fileCount: 0 };
    }
  }
}

// Middleware factory functions for different upload types
export const createBlogImageUpload = () => {
  return PatientPortalUploadService.createUploadMiddleware('blogImages');
};

export const createPatientAttachmentUpload = () => {
  return PatientPortalUploadService.createUploadMiddleware('patientAttachments');
};

export const createPatientAvatarUpload = () => {
  return PatientPortalUploadService.createUploadMiddleware('patientAvatars');
};

export const createMedicalDocumentUpload = () => {
  return PatientPortalUploadService.createUploadMiddleware('medicalDocuments');
};

// Middleware for processing uploaded files
export const processUploadedFiles = (category: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files && !req.file) {
        return next();
      }

      const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
      const singleFile = req.file as Express.Multer.File;

      const processedFiles: UploadedFileData[] = [];
      const errors: string[] = [];

      // Process single file
      if (singleFile) {
        const result = await PatientPortalUploadService.processUploadedFile(singleFile, category);
        if (result.success && result.fileData) {
          processedFiles.push(result.fileData);
        } else {
          errors.push(result.error || 'Failed to process file');
        }
      }

      // Process multiple files
      if (files) {
        const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
        
        for (const file of fileArray) {
          const result = await PatientPortalUploadService.processUploadedFile(file, category);
          if (result.success && result.fileData) {
            processedFiles.push(result.fileData);
          } else {
            errors.push(result.error || 'Failed to process file');
          }
        }
      }

      // Attach processed files to request
      req.uploadedFiles = processedFiles;
      req.uploadErrors = errors;

      // If there are errors but some files succeeded, continue
      // If all files failed, return error
      if (errors.length > 0 && processedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          errors,
        });
      }

      next();
    } catch (error: any) {
      logger.error('Error in upload processing middleware', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'File upload processing failed',
        error: error.message,
      });
    }
  };
};

// Initialize upload directories on module load
PatientPortalUploadService.initializeUploadDirectories();

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      uploadedFiles?: UploadedFileData[];
      uploadErrors?: string[];
    }
  }
}

export default PatientPortalUploadService;