/**
 * Enhanced Upload Middleware Unit Tests
 * Tests file upload validation, security scanning, and processing
 * Requirements: 1.5, 2.6, 8.2, 8.5
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import {
  PatientPortalUploadService,
  createBlogImageUpload,
  createPatientAttachmentUpload,
  createPatientAvatarUpload,
  createMedicalDocumentUpload,
  processUploadedFiles,
  UploadedFileData,
} from '../../middlewares/upload';

// Mock dependencies
jest.mock('fs');
jest.mock('../../utils/logger');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Patient Portal Upload Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      file: undefined,
      files: undefined,
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();

    jest.clearAllMocks();

    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation();
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({
      size: 1024,
      mtime: new Date(),
    } as fs.Stats);
  });

  describe('PatientPortalUploadService', () => {
    describe('initializeUploadDirectories', () => {
      it('should create upload directories if they do not exist', () => {
        // Arrange
        mockFs.existsSync.mockReturnValue(false);

        // Act
        PatientPortalUploadService.initializeUploadDirectories();

        // Assert
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads/blog/images'),
          { recursive: true }
        );
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads/patient/attachments'),
          { recursive: true }
        );
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads/patient/avatars'),
          { recursive: true }
        );
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads/patient/medical'),
          { recursive: true }
        );
      });

      it('should not create directories if they already exist', () => {
        // Arrange
        mockFs.existsSync.mockReturnValue(true);

        // Act
        PatientPortalUploadService.initializeUploadDirectories();

        // Assert
        expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      });
    });

    describe('validateFile', () => {
      const createMockFile = (overrides = {}): Express.Multer.File => ({
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        destination: '/tmp',
        filename: 'test.jpg',
        path: '/tmp/test.jpg',
        buffer: Buffer.from(''),
        stream: {} as any,
        ...overrides,
      });

      it('should validate valid blog image file', () => {
        // Arrange
        const file = createMockFile({
          originalname: 'blog-image.jpg',
          mimetype: 'image/jpeg',
          size: 2 * 1024 * 1024, // 2MB
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.blogImages
        );

        // Assert
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject file exceeding size limit', () => {
        // Arrange
        const file = createMockFile({
          size: 10 * 1024 * 1024, // 10MB (exceeds 5MB limit for blog images)
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.blogImages
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('File size exceeds maximum limit');
      });

      it('should reject invalid MIME type', () => {
        // Arrange
        const file = createMockFile({
          mimetype: 'application/x-executable',
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.blogImages
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('File type application/x-executable is not allowed');
      });

      it('should reject dangerous file extensions', () => {
        // Arrange
        const file = createMockFile({
          originalname: 'malicious.exe',
          mimetype: 'application/octet-stream',
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.patientAttachments
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('File extension .exe is not allowed for security reasons');
      });

      it('should reject files with invalid characters in filename', () => {
        // Arrange
        const file = createMockFile({
          originalname: '../../../etc/passwd',
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.blogImages
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid characters in filename');
      });

      it('should reject empty files', () => {
        // Arrange
        const file = createMockFile({
          size: 0,
        });

        // Act
        const result = (PatientPortalUploadService as any).validateFile(
          file,
          (PatientPortalUploadService as any).UPLOAD_CONFIGS.blogImages
        );

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Empty files are not allowed');
      });
    });

    describe('scanFileContent', () => {
      beforeEach(() => {
        // Mock file operations
        mockFs.openSync.mockReturnValue(3 as any);
        mockFs.readSync.mockReturnValue(512);
        mockFs.closeSync.mockImplementation();
      });

      it('should pass safe files', async () => {
        // Arrange
        const safeBuffer = Buffer.from('This is a safe text file content');
        mockFs.readSync.mockImplementation((fd, buffer) => {
          safeBuffer.copy(buffer as Buffer);
          return safeBuffer.length;
        });

        // Act
        const result = await (PatientPortalUploadService as any).scanFileContent('/path/to/safe.txt', true);

        // Assert
        expect(result.isSafe).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should detect executable signatures', async () => {
        // Arrange
        const executableBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // PE executable signature
        mockFs.readSync.mockImplementation((fd, buffer) => {
          executableBuffer.copy(buffer as Buffer);
          return executableBuffer.length;
        });

        // Act
        const result = await (PatientPortalUploadService as any).scanFileContent('/path/to/malware.exe', true);

        // Assert
        expect(result.isSafe).toBe(false);
        expect(result.error).toContain('executable content');
      });

      it('should detect script content', async () => {
        // Arrange
        const scriptBuffer = Buffer.from('<script>alert("xss")</script>');
        mockFs.readSync.mockImplementation((fd, buffer) => {
          scriptBuffer.copy(buffer as Buffer);
          return scriptBuffer.length;
        });

        // Act
        const result = await (PatientPortalUploadService as any).scanFileContent('/path/to/script.html', true);

        // Assert
        expect(result.isSafe).toBe(false);
        expect(result.error).toContain('malicious script content');
      });

      it('should skip scanning when disabled', async () => {
        // Act
        const result = await (PatientPortalUploadService as any).scanFileContent('/path/to/file.txt', false);

        // Assert
        expect(result.isSafe).toBe(true);
        expect(mockFs.openSync).not.toHaveBeenCalled();
      });

      it('should handle file read errors', async () => {
        // Arrange
        mockFs.openSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        // Act
        const result = await (PatientPortalUploadService as any).scanFileContent('/path/to/nonexistent.txt', true);

        // Assert
        expect(result.isSafe).toBe(false);
        expect(result.error).toContain('Unable to scan file content');
      });
    });

    describe('processUploadedFile', () => {
      const createMockFile = (overrides = {}): Express.Multer.File => ({
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024 * 1024,
        destination: '/tmp',
        filename: 'blog-images-123456789-abcdef-test.jpg',
        path: '/tmp/blog-images-123456789-abcdef-test.jpg',
        buffer: Buffer.from(''),
        stream: {} as any,
        ...overrides,
      });

      it('should process valid file successfully', async () => {
        // Arrange
        const file = createMockFile();
        
        // Mock successful scanning
        jest.spyOn(PatientPortalUploadService as any, 'scanFileContent')
          .mockResolvedValue({ isSafe: true });

        // Act
        const result = await PatientPortalUploadService.processUploadedFile(file, 'blogImages');

        // Assert
        expect(result.success).toBe(true);
        expect(result.fileData).toBeDefined();
        expect(result.fileData!.fileName).toBe(file.filename);
        expect(result.fileData!.originalName).toBe(file.originalname);
        expect(result.fileData!.category).toBe('blogImages');
        expect(result.fileData!.securityScan).toBeDefined();
        expect(result.fileData!.securityScan!.safe).toBe(true);
      });

      it('should reject unsafe file and delete it', async () => {
        // Arrange
        const file = createMockFile();
        
        // Mock failed scanning
        jest.spyOn(PatientPortalUploadService as any, 'scanFileContent')
          .mockResolvedValue({ isSafe: false, error: 'Malicious content detected' });
        
        jest.spyOn(PatientPortalUploadService, 'deleteFile')
          .mockResolvedValue();

        // Act
        const result = await PatientPortalUploadService.processUploadedFile(file, 'blogImages');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Malicious content detected');
        expect(PatientPortalUploadService.deleteFile).toHaveBeenCalledWith(file.path);
      });

      it('should handle unknown category', async () => {
        // Arrange
        const file = createMockFile();

        // Act
        const result = await PatientPortalUploadService.processUploadedFile(file, 'unknownCategory');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown upload category');
      });

      it('should clean up file on processing error', async () => {
        // Arrange
        const file = createMockFile();
        
        // Mock scanning to throw error
        jest.spyOn(PatientPortalUploadService as any, 'scanFileContent')
          .mockRejectedValue(new Error('Scanning failed'));
        
        jest.spyOn(PatientPortalUploadService, 'deleteFile')
          .mockResolvedValue();

        mockFs.existsSync.mockReturnValue(true);

        // Act
        const result = await PatientPortalUploadService.processUploadedFile(file, 'blogImages');

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to process uploaded file');
        expect(PatientPortalUploadService.deleteFile).toHaveBeenCalledWith(file.path);
      });
    });

    describe('file management methods', () => {
      it('should generate correct file URL', () => {
        // Arrange
        const filename = 'test-image.jpg';
        const category = 'blogImages';
        process.env.BASE_URL = 'https://example.com';

        // Act
        const url = PatientPortalUploadService.getFileUrl(filename, category);

        // Assert
        expect(url).toBe('https://example.com/uploads/blog/images/test-image.jpg');
      });

      it('should check file existence', () => {
        // Arrange
        mockFs.existsSync.mockReturnValue(true);

        // Act
        const exists = PatientPortalUploadService.fileExists('test.jpg', 'blogImages');

        // Assert
        expect(exists).toBe(true);
        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads/blog/images/test.jpg')
        );
      });

      it('should return file path', () => {
        // Act
        const filePath = PatientPortalUploadService.getFilePath('test.jpg', 'blogImages');

        // Assert
        expect(filePath).toContain('uploads/blog/images/test.jpg');
      });

      it('should return null for invalid category', () => {
        // Act
        const filePath = PatientPortalUploadService.getFilePath('test.jpg', 'invalidCategory');

        // Assert
        expect(filePath).toBeNull();
      });

      it('should get file stats', () => {
        // Arrange
        const mockStats = { size: 1024, mtime: new Date() } as fs.Stats;
        mockFs.statSync.mockReturnValue(mockStats);

        // Act
        const stats = PatientPortalUploadService.getFileStats('test.jpg', 'blogImages');

        // Assert
        expect(stats).toBe(mockStats);
      });

      it('should return null for non-existent file stats', () => {
        // Arrange
        mockFs.statSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        // Act
        const stats = PatientPortalUploadService.getFileStats('nonexistent.jpg', 'blogImages');

        // Assert
        expect(stats).toBeNull();
      });
    });

    describe('cleanup methods', () => {
      it('should clean up old files', async () => {
        // Arrange
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 40); // 40 days old

        mockFs.readdirSync.mockReturnValue(['old-file.jpg', 'new-file.jpg'] as any);
        mockFs.statSync
          .mockReturnValueOnce({ mtime: oldDate } as fs.Stats) // Old file
          .mockReturnValueOnce({ mtime: new Date() } as fs.Stats); // New file

        jest.spyOn(PatientPortalUploadService, 'deleteFile')
          .mockResolvedValue();

        // Act
        const deletedCount = await PatientPortalUploadService.cleanupOldFiles('blogImages', 30);

        // Assert
        expect(deletedCount).toBe(1);
        expect(PatientPortalUploadService.deleteFile).toHaveBeenCalledTimes(1);
      });

      it('should get upload statistics', () => {
        // Arrange
        mockFs.readdirSync.mockReturnValue(['file1.jpg', 'file2.pdf'] as any);
        mockFs.statSync
          .mockReturnValueOnce({ size: 1024 } as fs.Stats)
          .mockReturnValueOnce({ size: 2048 } as fs.Stats);

        // Act
        const stats = PatientPortalUploadService.getUploadStats('patientAttachments');

        // Assert
        expect(stats.fileCount).toBe(2);
        expect(stats.size).toBe(3072);
      });
    });
  });

  describe('Upload middleware factories', () => {
    it('should create blog image upload middleware', () => {
      // Act
      const middleware = createBlogImageUpload();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware.single).toBe('function');
      expect(typeof middleware.array).toBe('function');
    });

    it('should create patient attachment upload middleware', () => {
      // Act
      const middleware = createPatientAttachmentUpload();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware.single).toBe('function');
      expect(typeof middleware.array).toBe('function');
    });

    it('should create patient avatar upload middleware', () => {
      // Act
      const middleware = createPatientAvatarUpload();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware.single).toBe('function');
    });

    it('should create medical document upload middleware', () => {
      // Act
      const middleware = createMedicalDocumentUpload();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware.single).toBe('function');
      expect(typeof middleware.array).toBe('function');
    });
  });

  describe('processUploadedFiles middleware', () => {
    it('should process single uploaded file', async () => {
      // Arrange
      const mockFile: Express.Multer.File = {
        fieldname: 'image',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test.jpg',
        path: '/tmp/test.jpg',
        buffer: Buffer.from(''),
        stream: {} as any,
      };

      const mockFileData: UploadedFileData = {
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: 'http://localhost:5000/uploads/blog/images/test.jpg',
        uploadedAt: new Date(),
        category: 'blogImages',
      };

      req.file = mockFile;

      jest.spyOn(PatientPortalUploadService, 'processUploadedFile')
        .mockResolvedValue({ success: true, fileData: mockFileData });

      const middleware = processUploadedFiles('blogImages');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.uploadedFiles).toEqual([mockFileData]);
      expect(req.uploadErrors).toEqual([]);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should process multiple uploaded files', async () => {
      // Arrange
      const mockFiles: Express.Multer.File[] = [
        {
          fieldname: 'files',
          originalname: 'test1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024,
          destination: '/tmp',
          filename: 'test1.jpg',
          path: '/tmp/test1.jpg',
          buffer: Buffer.from(''),
          stream: {} as any,
        },
        {
          fieldname: 'files',
          originalname: 'test2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 2048,
          destination: '/tmp',
          filename: 'test2.jpg',
          path: '/tmp/test2.jpg',
          buffer: Buffer.from(''),
          stream: {} as any,
        },
      ];

      req.files = mockFiles;

      jest.spyOn(PatientPortalUploadService, 'processUploadedFile')
        .mockResolvedValueOnce({ success: true, fileData: {} as UploadedFileData })
        .mockResolvedValueOnce({ success: true, fileData: {} as UploadedFileData });

      const middleware = processUploadedFiles('patientAttachments');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.uploadedFiles).toHaveLength(2);
      expect(next).toHaveBeenCalled();
    });

    it('should handle file processing errors', async () => {
      // Arrange
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malicious.exe',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: 1024,
        destination: '/tmp',
        filename: 'malicious.exe',
        path: '/tmp/malicious.exe',
        buffer: Buffer.from(''),
        stream: {} as any,
      };

      req.file = mockFile;

      jest.spyOn(PatientPortalUploadService, 'processUploadedFile')
        .mockResolvedValue({ success: false, error: 'Malicious file detected' });

      const middleware = processUploadedFiles('patientAttachments');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.uploadedFiles).toEqual([]);
      expect(req.uploadErrors).toEqual(['Malicious file detected']);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File upload failed',
        errors: ['Malicious file detected'],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should continue with partial success', async () => {
      // Arrange
      const mockFiles: Express.Multer.File[] = [
        {
          fieldname: 'files',
          originalname: 'good.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024,
          destination: '/tmp',
          filename: 'good.jpg',
          path: '/tmp/good.jpg',
          buffer: Buffer.from(''),
          stream: {} as any,
        },
        {
          fieldname: 'files',
          originalname: 'bad.exe',
          encoding: '7bit',
          mimetype: 'application/octet-stream',
          size: 2048,
          destination: '/tmp',
          filename: 'bad.exe',
          path: '/tmp/bad.exe',
          buffer: Buffer.from(''),
          stream: {} as any,
        },
      ];

      req.files = mockFiles;

      jest.spyOn(PatientPortalUploadService, 'processUploadedFile')
        .mockResolvedValueOnce({ success: true, fileData: {} as UploadedFileData })
        .mockResolvedValueOnce({ success: false, error: 'Invalid file type' });

      const middleware = processUploadedFiles('patientAttachments');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.uploadedFiles).toHaveLength(1);
      expect(req.uploadErrors).toEqual(['Invalid file type']);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed when no files are uploaded', async () => {
      // Arrange
      const middleware = processUploadedFiles('blogImages');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test.jpg',
        path: '/tmp/test.jpg',
        buffer: Buffer.from(''),
        stream: {} as any,
      };

      req.file = mockFile;

      jest.spyOn(PatientPortalUploadService, 'processUploadedFile')
        .mockRejectedValue(new Error('Processing failed'));

      const middleware = processUploadedFiles('blogImages');

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File upload processing failed',
        error: 'Processing failed',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});