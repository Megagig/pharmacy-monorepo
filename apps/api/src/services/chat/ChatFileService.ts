import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
// import sharp from 'sharp'; // Optional: Install with npm install sharp
// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // Optional: Install with npm install @aws-sdk/client-s3
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // Optional: Install with npm install @aws-sdk/s3-request-presigner
import { ChatFileMetadata } from '../../models/chat';
import logger from '../../utils/logger';
import mongoose from 'mongoose';

/**
 * ChatFileService - File Upload and Management
 * 
 * Handles file uploads to S3, thumbnail generation, and virus scanning
 */

export interface UploadFileData {
  file: Express.Multer.File;
  conversationId: string;
  messageId: string;
  uploadedBy: string;
  workplaceId: string;
}

export interface FileUploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl?: string;
  secureUrl: string;
}

export class ChatFileService {
  private s3Client: any; // S3Client - requires @aws-sdk/client-s3
  private bucket: string;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];

  constructor() {
    // Initialize S3 client (requires @aws-sdk/client-s3 package)
    // Uncomment when AWS SDK is installed:
    // this.s3Client = new S3Client({
    //   region: process.env.AWS_REGION || 'us-east-1',
    //   credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    //   },
    // });

    this.bucket = process.env.AWS_S3_BUCKET || 'chat-files-bucket';
  }

  /**
   * Configure multer for file uploads
   */
  getMulterConfig(): multer.Multer {
    const storage = multer.memoryStorage();

    const fileFilter = (
      req: Express.Request,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback
    ) => {
      if (this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`));
      }
    };

    return multer({
      storage,
      limits: {
        fileSize: this.MAX_FILE_SIZE,
        files: 10, // Max 10 files per upload
      },
      fileFilter,
    });
  }

  /**
   * Upload file to S3 and create metadata
   */
  async uploadFile(data: UploadFileData): Promise<FileUploadResult> {
    try {
      logger.info('Uploading file', {
        fileName: data.file.originalname,
        size: data.file.size,
        mimeType: data.file.mimetype,
      });

      // Validate file
      this.validateFile(data.file);

      // Generate S3 key
      const s3Key = this.generateS3Key(data.workplaceId, data.file.originalname);

      // Upload to S3
      await this.uploadToS3(s3Key, data.file.buffer, data.file.mimetype);

      // Generate thumbnail for images
      let thumbnailUrl: string | undefined;
      if (data.file.mimetype.startsWith('image/')) {
        thumbnailUrl = await this.generateThumbnail(s3Key, data.file.buffer);
      }

      // Create file metadata
      const fileMetadata = new ChatFileMetadata({
        conversationId: new mongoose.Types.ObjectId(data.conversationId),
        messageId: new mongoose.Types.ObjectId(data.messageId),
        uploadedBy: new mongoose.Types.ObjectId(data.uploadedBy),
        fileName: data.file.originalname,
        fileSize: data.file.size,
        mimeType: data.file.mimetype,
        s3Key,
        s3Bucket: this.bucket,
        thumbnailUrl,
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
      });

      await fileMetadata.save();

      // Get secure URL
      const secureUrl = await this.getDownloadUrl(s3Key);

      logger.info('File uploaded successfully', {
        fileId: fileMetadata._id,
        s3Key,
      });

      return {
        fileId: fileMetadata._id.toString(),
        fileName: data.file.originalname,
        fileSize: data.file.size,
        mimeType: data.file.mimetype,
        s3Key,
        s3Bucket: this.bucket,
        thumbnailUrl,
        secureUrl,
      };
    } catch (error) {
      logger.error('Error uploading file', { error });
      throw error;
    }
  }

  /**
   * Validate file
   */
  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Check filename for dangerous patterns
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      throw new Error('Invalid characters in filename');
    }

    // Check for dangerous extensions
    const ext = path.extname(file.originalname).toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'];
    if (dangerousExtensions.includes(ext)) {
      throw new Error(`File extension ${ext} is not allowed for security reasons`);
    }
  }

  /**
   * Generate S3 key
   */
  private generateS3Key(workplaceId: string, originalName: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(originalName);
    return `chat-files/${workplaceId}/${timestamp}-${randomString}${ext}`;
  }

  /**
   * Upload to S3
   */
  private async uploadToS3(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    // Requires @aws-sdk/client-s3 package
    throw new Error('S3 upload not configured. Install @aws-sdk/client-s3 and configure AWS credentials.');
    // Uncomment when AWS SDK is installed:
    // const command = new PutObjectCommand({
    //   Bucket: this.bucket,
    //   Key: key,
    //   Body: buffer,
    //   ContentType: mimeType,
    //   ServerSideEncryption: 'AES256',
    // });
    // await this.s3Client.send(command);
  }

  /**
   * Generate thumbnail for images
   */
  private async generateThumbnail(s3Key: string, buffer: Buffer): Promise<string> {
    try {
      // Requires sharp package - install with: npm install sharp
      logger.warn('Thumbnail generation not available. Install sharp package.');
      return '';
      // Uncomment when sharp is installed:
      // const thumbnailBuffer = await sharp(buffer)
      //   .resize(200, 200, {
      //     fit: 'inside',
      //     withoutEnlargement: true,
      //   })
      //   .jpeg({ quality: 80 })
      //   .toBuffer();
      // const thumbnailKey = s3Key.replace(/\.[^.]+$/, '_thumb.jpg');
      // await this.uploadToS3(thumbnailKey, thumbnailBuffer, 'image/jpeg');
      // return await this.getDownloadUrl(thumbnailKey);
    } catch (error) {
      logger.error('Error generating thumbnail', { error });
      return '';
    }
  }

  /**
   * Get signed download URL
   */
  async getDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Requires @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
      throw new Error('S3 download not configured. Install AWS SDK packages.');
      // Uncomment when AWS SDK is installed:
      // const command = new GetObjectCommand({
      //   Bucket: this.bucket,
      //   Key: s3Key,
      // });
      // const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      // return url;
    } catch (error) {
      logger.error('Error generating download URL', { error });
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      // Requires @aws-sdk/client-s3
      throw new Error('S3 delete not configured. Install AWS SDK packages.');
      // Uncomment when AWS SDK is installed:
      // const command = new DeleteObjectCommand({
      //   Bucket: this.bucket,
      //   Key: s3Key,
      // });
      // await this.s3Client.send(command);
      // const thumbnailKey = s3Key.replace(/\.[^.]+$/, '_thumb.jpg');
      // try {
      //   const thumbnailCommand = new DeleteObjectCommand({
      //     Bucket: this.bucket,
      //     Key: thumbnailKey,
      //   });
      //   await this.s3Client.send(thumbnailCommand);
      // } catch (thumbError) {
      //   // Thumbnail might not exist, ignore error
      // }
      logger.info('File deleted from S3', { s3Key });
    } catch (error) {
      logger.error('Error deleting file from S3', { error });
      throw error;
    }
  }

  /**
   * Scan file for viruses (placeholder - integrate with ClamAV or AWS S3 scanning)
   */
  async scanFile(fileId: string): Promise<'clean' | 'infected'> {
    try {
      // In production, integrate with ClamAV or AWS S3 virus scanning
      // For now, mark all files as clean after basic validation
      
      const fileMetadata = await ChatFileMetadata.findById(fileId);
      if (!fileMetadata) {
        throw new Error('File not found');
      }

      // Simulate virus scan
      // In production: await clamav.scanFile(fileMetadata.s3Key)
      const scanResult = 'clean';

      // Update file metadata
      fileMetadata.markAsScanned(scanResult);
      await fileMetadata.save();

      logger.info('File scanned', { fileId, result: scanResult });

      return scanResult;
    } catch (error) {
      logger.error('Error scanning file', { error });
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<any> {
    try {
      const fileMetadata = await ChatFileMetadata.findById(fileId)
        .populate('uploadedBy', 'firstName lastName role')
        .populate('conversationId', 'title type');

      if (!fileMetadata) {
        throw new Error('File not found');
      }

      return fileMetadata;
    } catch (error) {
      logger.error('Error getting file metadata', { error });
      throw error;
    }
  }

  /**
   * Get files for conversation
   */
  async getConversationFiles(conversationId: string, mimeType?: string): Promise<any[]> {
    try {
      const files = await (ChatFileMetadata as any).findByConversation(
        new mongoose.Types.ObjectId(conversationId),
        { mimeType }
      );

      return files;
    } catch (error) {
      logger.error('Error getting conversation files', { error });
      throw error;
    }
  }

  /**
   * Delete file and metadata
   */
  async deleteFileAndMetadata(fileId: string, userId: string): Promise<void> {
    try {
      const fileMetadata = await ChatFileMetadata.findById(fileId);

      if (!fileMetadata) {
        throw new Error('File not found');
      }

      // Check if user is uploader or has admin permission
      if (fileMetadata.uploadedBy.toString() !== userId) {
        // In production, check if user has admin permission
        throw new Error('Not authorized to delete this file');
      }

      // Delete from S3
      await this.deleteFile(fileMetadata.s3Key);

      // Delete metadata
      await ChatFileMetadata.findByIdAndDelete(fileId);

      logger.info('File and metadata deleted', { fileId });
    } catch (error) {
      logger.error('Error deleting file and metadata', { error });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(workplaceId: string): Promise<any> {
    try {
      const stats = await (ChatFileMetadata as any).getStorageStats(
        new mongoose.Types.ObjectId(workplaceId)
      );

      return stats;
    } catch (error) {
      logger.error('Error getting storage stats', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const chatFileService = new ChatFileService();
export default chatFileService;
