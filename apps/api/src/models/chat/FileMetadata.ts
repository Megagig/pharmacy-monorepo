import mongoose, { Document, Schema } from 'mongoose';

/**
 * FileMetadata Model for Communication Module
 * 
 * Tracks files uploaded in conversations with security and metadata
 */

export interface IFileMetadata extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  messageId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  
  // File information
  fileName: string;
  fileSize: number;
  mimeType: string;
  
  // Storage
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl?: string;
  
  // Security
  isScanned: boolean;
  scanResult?: 'clean' | 'infected' | 'pending';
  
  // Timestamps and tenancy
  uploadedAt: Date;
  workplaceId: mongoose.Types.ObjectId;
  
  // Instance methods
  markAsScanned(result: 'clean' | 'infected'): void;
  getDownloadUrl(expiresIn?: number): string;
}

const fileMetadataSchema = new Schema({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatConversation',
    required: true,
    index: true,
  },
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatMessage',
    required: true,
    index: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [255, 'File name cannot exceed 255 characters'],
  },
  fileSize: {
    type: Number,
    required: true,
    min: [0, 'File size cannot be negative'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'],
  },
  mimeType: {
    type: String,
    required: true,
    validate: {
      validator: function (mimeType: string) {
        // Allowed file types for healthcare communication
        const allowedTypes = [
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
        return allowedTypes.includes(mimeType);
      },
      message: 'File type not allowed for healthcare communication',
    },
  },
  s3Key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  s3Bucket: {
    type: String,
    required: true,
  },
  thumbnailUrl: {
    type: String,
    validate: {
      validator: function (url: string) {
        return !url || /^https?:\/\/.+/.test(url);
      },
      message: 'Invalid thumbnail URL format',
    },
  },
  isScanned: {
    type: Boolean,
    default: false,
    required: true,
    index: true,
  },
  scanResult: {
    type: String,
    enum: ['clean', 'infected', 'pending'],
    default: 'pending',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  workplaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workplace',
    required: true,
    index: true,
  },
}, {
  timestamps: false, // Using uploadedAt instead
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes for optimal query performance
fileMetadataSchema.index({ conversationId: 1, uploadedAt: -1 });
fileMetadataSchema.index({ workplaceId: 1, uploadedBy: 1, uploadedAt: -1 });
fileMetadataSchema.index({ workplaceId: 1, mimeType: 1, uploadedAt: -1 });
fileMetadataSchema.index({ isScanned: 1, scanResult: 1 });

// Virtual for file type category
fileMetadataSchema.virtual('fileType').get(function (this: IFileMetadata) {
  if (this.mimeType.startsWith('image/')) return 'image';
  if (this.mimeType.startsWith('audio/')) return 'audio';
  if (this.mimeType === 'application/pdf') return 'pdf';
  if (this.mimeType.includes('word')) return 'document';
  if (this.mimeType.includes('excel') || this.mimeType.includes('spreadsheet')) return 'spreadsheet';
  return 'file';
});

// Virtual for human-readable file size
fileMetadataSchema.virtual('fileSizeFormatted').get(function (this: IFileMetadata) {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for is image
fileMetadataSchema.virtual('isImage').get(function (this: IFileMetadata) {
  return this.mimeType.startsWith('image/');
});

// Virtual for is safe
fileMetadataSchema.virtual('isSafe').get(function (this: IFileMetadata) {
  return this.isScanned && this.scanResult === 'clean';
});

// Instance Methods

fileMetadataSchema.methods.markAsScanned = function (
  this: IFileMetadata,
  result: 'clean' | 'infected'
): void {
  this.isScanned = true;
  this.scanResult = result;
};

fileMetadataSchema.methods.getDownloadUrl = function (
  this: IFileMetadata,
  expiresIn: number = 3600
): string {
  // This will be implemented in the service layer with AWS SDK
  // For now, return a placeholder
  return `https://${this.s3Bucket}.s3.amazonaws.com/${this.s3Key}`;
};

// Pre-save middleware
fileMetadataSchema.pre('save', function (this: IFileMetadata) {
  // Validate file size based on type
  const maxSizes: Record<string, number> = {
    'image': 5 * 1024 * 1024, // 5MB for images
    'audio': 10 * 1024 * 1024, // 10MB for audio
    'document': 10 * 1024 * 1024, // 10MB for documents
  };

  const fileType = this.mimeType.split('/')[0];
  const maxSize = maxSizes[fileType] || 10 * 1024 * 1024;

  if (this.fileSize > maxSize) {
    throw new Error(`File size exceeds maximum allowed for ${fileType} files`);
  }

  // Generate S3 key if not set
  if (!this.s3Key) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = this.fileName.split('.').pop();
    this.s3Key = `chat-files/${this.workplaceId}/${timestamp}-${randomString}.${extension}`;
  }
});

// Static methods
fileMetadataSchema.statics.findByConversation = function (
  conversationId: mongoose.Types.ObjectId,
  options: any = {}
) {
  const { limit = 50, mimeType } = options;

  const query: any = {
    conversationId,
    isScanned: true,
    scanResult: 'clean',
  };

  if (mimeType) {
    query.mimeType = mimeType;
  }

  return this.find(query)
    .populate('uploadedBy', 'firstName lastName role')
    .populate('messageId', 'content.text createdAt')
    .sort({ uploadedAt: -1 })
    .limit(limit);
};

fileMetadataSchema.statics.findByUser = function (
  userId: mongoose.Types.ObjectId,
  workplaceId: mongoose.Types.ObjectId,
  options: any = {}
) {
  const { limit = 50 } = options;

  return this.find({
    uploadedBy: userId,
    workplaceId,
    isScanned: true,
    scanResult: 'clean',
  })
    .populate('conversationId', 'title type')
    .sort({ uploadedAt: -1 })
    .limit(limit);
};

fileMetadataSchema.statics.findPendingScans = function (workplaceId?: mongoose.Types.ObjectId) {
  const query: any = {
    isScanned: false,
    scanResult: 'pending',
  };

  if (workplaceId) {
    query.workplaceId = workplaceId;
  }

  return this.find(query)
    .sort({ uploadedAt: 1 }) // Oldest first
    .limit(100);
};

fileMetadataSchema.statics.getStorageStats = async function (
  workplaceId: mongoose.Types.ObjectId
) {
  const stats = await this.aggregate([
    { $match: { workplaceId } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        imageCount: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^image\// } }, 1, 0],
          },
        },
        documentCount: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$mimeType', regex: /pdf|word|excel/ } }, 1, 0],
          },
        },
        audioCount: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^audio\// } }, 1, 0],
          },
        },
      },
    },
  ]);

  return stats[0] || {
    totalFiles: 0,
    totalSize: 0,
    imageCount: 0,
    documentCount: 0,
    audioCount: 0,
  };
};

export default mongoose.model<IFileMetadata>('ChatFileMetadata', fileMetadataSchema);
