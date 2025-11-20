import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ChatFileMetadata, { IFileMetadata } from '../FileMetadata';

describe('ChatFileMetadata Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await ChatFileMetadata.deleteMany({});
  });

  describe('Model Creation', () => {
    it('should create valid file metadata', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const fileMetadata = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'prescription.pdf',
        fileSize: 1024 * 500, // 500KB
        mimeType: 'application/pdf',
        s3Key: 'chat-files/test/prescription.pdf',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      const saved = await fileMetadata.save();

      expect(saved._id).toBeDefined();
      expect(saved.fileName).toBe('prescription.pdf');
      expect(saved.isScanned).toBe(false);
      expect(saved.scanResult).toBe('pending');
    });

    it('should fail validation without required fields', async () => {
      const fileMetadata = new ChatFileMetadata({});

      await expect(fileMetadata.save()).rejects.toThrow();
    });

    it('should fail validation with invalid mime type', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const fileMetadata = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'malicious.exe',
        fileSize: 1024,
        mimeType: 'application/x-msdownload',
        s3Key: 'test-key',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await expect(fileMetadata.save()).rejects.toThrow('File type not allowed');
    });

    it('should fail validation with file size exceeding 10MB', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const fileMetadata = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'large-file.pdf',
        fileSize: 11 * 1024 * 1024, // 11MB
        mimeType: 'application/pdf',
        s3Key: 'test-key',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await expect(fileMetadata.save()).rejects.toThrow();
    });

    it('should generate S3 key if not provided', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const fileMetadata = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await fileMetadata.save();

      expect(fileMetadata.s3Key).toBeDefined();
      expect(fileMetadata.s3Key).toContain('chat-files');
      expect(fileMetadata.s3Key).toContain(workplaceId.toString());
    });
  });

  describe('Instance Methods', () => {
    let fileMetadata: IFileMetadata;

    beforeEach(async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      fileMetadata = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'test-key',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await fileMetadata.save();
    });

    describe('markAsScanned', () => {
      it('should mark file as scanned with clean result', () => {
        fileMetadata.markAsScanned('clean');

        expect(fileMetadata.isScanned).toBe(true);
        expect(fileMetadata.scanResult).toBe('clean');
      });

      it('should mark file as scanned with infected result', () => {
        fileMetadata.markAsScanned('infected');

        expect(fileMetadata.isScanned).toBe(true);
        expect(fileMetadata.scanResult).toBe('infected');
      });
    });

    describe('getDownloadUrl', () => {
      it('should return download URL', () => {
        const url = fileMetadata.getDownloadUrl();

        expect(url).toContain(fileMetadata.s3Bucket);
        expect(url).toContain(fileMetadata.s3Key);
      });
    });
  });

  describe('Virtual Properties', () => {
    it('should determine file type correctly', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const imageFile = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        s3Key: 'test-key-1',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await imageFile.save();
      expect(imageFile.fileType).toBe('image');
      expect(imageFile.isImage).toBe(true);

      const pdfFile = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'test-key-2',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await pdfFile.save();
      expect(pdfFile.fileType).toBe('pdf');
      expect(pdfFile.isImage).toBe(false);
    });

    it('should format file size correctly', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const file = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'test.pdf',
        fileSize: 1024 * 500, // 500KB
        mimeType: 'application/pdf',
        s3Key: 'test-key',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await file.save();
      expect(file.fileSizeFormatted).toContain('KB');
    });

    it('should determine if file is safe', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      const file = new ChatFileMetadata({
        conversationId,
        messageId,
        uploadedBy,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'test-key',
        s3Bucket: 'test-bucket',
        workplaceId,
      });

      await file.save();

      expect(file.isSafe).toBe(false);

      file.markAsScanned('clean');
      expect(file.isSafe).toBe(true);

      file.markAsScanned('infected');
      expect(file.isSafe).toBe(false);
    });
  });

  describe('Static Methods', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let conversationId: mongoose.Types.ObjectId;
    let userId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      workplaceId = new mongoose.Types.ObjectId();
      conversationId = new mongoose.Types.ObjectId();
      userId = new mongoose.Types.ObjectId();

      // Create test files
      await ChatFileMetadata.create([
        {
          conversationId,
          messageId: new mongoose.Types.ObjectId(),
          uploadedBy: userId,
          fileName: 'image1.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          s3Key: 'key-1',
          s3Bucket: 'bucket',
          workplaceId,
          isScanned: true,
          scanResult: 'clean',
        },
        {
          conversationId,
          messageId: new mongoose.Types.ObjectId(),
          uploadedBy: userId,
          fileName: 'document.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          s3Key: 'key-2',
          s3Bucket: 'bucket',
          workplaceId,
          isScanned: true,
          scanResult: 'clean',
        },
        {
          conversationId,
          messageId: new mongoose.Types.ObjectId(),
          uploadedBy: userId,
          fileName: 'pending.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          s3Key: 'key-3',
          s3Bucket: 'bucket',
          workplaceId,
          isScanned: false,
          scanResult: 'pending',
        },
      ]);
    });

    describe('findByConversation', () => {
      it('should find files for a conversation', async () => {
        const files = await (ChatFileMetadata as any).findByConversation(conversationId);

        expect(files).toHaveLength(2); // Excludes pending scan
      });

      it('should filter by mime type', async () => {
        const files = await (ChatFileMetadata as any).findByConversation(conversationId, {
          mimeType: 'image/jpeg',
        });

        expect(files).toHaveLength(1);
        expect(files[0].mimeType).toBe('image/jpeg');
      });
    });

    describe('findByUser', () => {
      it('should find files uploaded by user', async () => {
        const files = await (ChatFileMetadata as any).findByUser(userId, workplaceId);

        expect(files).toHaveLength(2); // Excludes pending scan
      });
    });

    describe('findPendingScans', () => {
      it('should find files pending scan', async () => {
        const files = await (ChatFileMetadata as any).findPendingScans();

        expect(files).toHaveLength(1);
        expect(files[0].scanResult).toBe('pending');
      });

      it('should filter by workplace', async () => {
        const files = await (ChatFileMetadata as any).findPendingScans(workplaceId);

        expect(files).toHaveLength(1);
      });
    });

    describe('getStorageStats', () => {
      it('should calculate storage statistics', async () => {
        const stats = await (ChatFileMetadata as any).getStorageStats(workplaceId);

        expect(stats.totalFiles).toBe(3);
        expect(stats.totalSize).toBe(1024 + 2048 + 1024);
        expect(stats.imageCount).toBe(1);
        expect(stats.documentCount).toBe(2);
      });
    });
  });
});
