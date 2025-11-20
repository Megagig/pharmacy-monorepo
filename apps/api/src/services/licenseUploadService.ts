import { v2 as cloudinary } from 'cloudinary';
import { Request } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// Configure multer for both memory and disk storage
const memoryStorage = multer.memoryStorage();

// Disk storage as backup
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'licenses');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user?._id || 'unknown';
    const uniqueSuffix = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `license-${userId}-${uniqueSuffix}${extension}`);
  },
});

// Use memory storage for Cloudinary-first approach
const storage = memoryStorage;

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.'
      ),
      false
    );
  }
};

// Export multer upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export class LicenseUploadService {
  /**
   * Get multer upload middleware
   */
  getMulterUpload() {
    return upload;
  }

  /**
   * Upload license document with Cloudinary-first approach and local backup
   */
  async uploadLicenseDocument(file: Express.Multer.File, userId: string): Promise<{
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    localFilePath?: string;
    fileSize: number;
    mimeType: string;
    uploadMethod: 'cloudinary' | 'local' | 'both';
    error?: string;
  }> {
    let cloudinaryResult: any = null;
    let localFilePath: string | null = null;
    let uploadMethod: 'cloudinary' | 'local' | 'both' = 'local';

    try {
      // First, try Cloudinary upload
      try {
        cloudinaryResult = await this.uploadToCloudinary(file, userId);
        uploadMethod = 'cloudinary';
        console.log('✅ Cloudinary upload successful');
      } catch (cloudinaryError) {
        console.warn('⚠️ Cloudinary upload failed, falling back to local storage:', cloudinaryError);
      }

      // Always create local backup (or primary if Cloudinary failed)
      try {
        localFilePath = await this.saveToLocalStorage(file, userId);
        if (uploadMethod === 'cloudinary') {
          uploadMethod = 'both';
          console.log('✅ Local backup created successfully');
        } else {
          uploadMethod = 'local';
          console.log('✅ Local storage upload successful');
        }
      } catch (localError) {
        console.error('❌ Local storage failed:', localError);
        if (!cloudinaryResult) {
          throw new Error('Both Cloudinary and local storage failed');
        }
      }

      return {
        cloudinaryUrl: cloudinaryResult?.url,
        cloudinaryPublicId: cloudinaryResult?.publicId,
        localFilePath,
        fileSize: cloudinaryResult?.fileSize || file.size,
        mimeType: file.mimetype,
        uploadMethod,
      };
    } catch (error) {
      console.error('❌ Complete upload failure:', error);
      throw new Error('Failed to upload license document');
    }
  }

  /**
   * Upload to Cloudinary only
   */
  private async uploadToCloudinary(file: Express.Multer.File, userId: string): Promise<{
    url: string;
    publicId: string;
    fileSize: number;
    mimeType: string;
  }> {
    // Create a readable stream from the buffer
    const stream = Readable.from(file.buffer);
    
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'pharma-care/licenses',
          public_id: `license-${userId}-${Date.now()}`,
          resource_type: 'auto', // Handles both images and PDFs
          transformation: file.mimetype.startsWith('image/') ? [
            { width: 1200, height: 1600, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ] : undefined
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      stream.pipe(uploadStream);
    });

    const uploadResult = result as any;

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      fileSize: uploadResult.bytes,
      mimeType: file.mimetype,
    };
  }

  /**
   * Save to local storage as backup
   */
  private async saveToLocalStorage(file: Express.Multer.File, userId: string): Promise<string> {
    const uploadPath = path.join(process.cwd(), 'uploads', 'licenses');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const uniqueSuffix = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `license-${userId}-${uniqueSuffix}${extension}`;
    const filePath = path.join(uploadPath, filename);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);
    
    return filePath;
  }

  /**
   * Delete license document from both Cloudinary and local storage
   */
  async deleteLicenseDocument(cloudinaryPublicId?: string, localFilePath?: string): Promise<void> {
    const deletionResults = [];

    // Delete from Cloudinary if exists
    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId);
        deletionResults.push('✅ Cloudinary deletion successful');
      } catch (error) {
        console.error('⚠️ Cloudinary deletion failed:', error);
        deletionResults.push('❌ Cloudinary deletion failed');
      }
    }

    // Delete from local storage if exists
    if (localFilePath) {
      try {
        if (fs.existsSync(localFilePath)) {
          await fs.promises.unlink(localFilePath);
          deletionResults.push('✅ Local file deletion successful');
        }
      } catch (error) {
        console.error('⚠️ Local file deletion failed:', error);
        deletionResults.push('❌ Local file deletion failed');
      }
    }

    console.log('License document deletion results:', deletionResults);
  }

  /**
   * Delete from Cloudinary only (for backward compatibility)
   */
  async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary deletion error:', error);
      // Don't throw error for deletion failures - log and continue
    }
  }

  /**
   * Validate license file
   */
  validateFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'application/pdf',
      'image/webp',
    ];
    
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 5MB'
      };
    }

    return { isValid: true };
  }
}

export const licenseUploadService = new LicenseUploadService();