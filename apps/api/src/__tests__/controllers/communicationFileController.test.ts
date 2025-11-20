import { Request, Response } from 'express';
import { CommunicationFileController } from '../../controllers/communicationFileController';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import Conversation, { IConversation } from '../../models/Conversation';
import Message, { IMessage } from '../../models/Message';
import { AuditLog } from '../../models/AuditLog';
import { FileUploadService } from '../../services/fileUploadService';
import { v2 as cloudinary } from 'cloudinary';

// Mock dependencies
jest.mock('../../models/Conversation');
jest.mock('../../models/Message');
jest.mock('../../models/AuditLog');
jest.mock('../../services/fileUploadService');
jest.mock('cloudinary');

interface AuthenticatedRequest extends Request {
    user?: {
        _id: string;
        role: string;
        workplaceId: string;
    };
    file?: Express.Multer.File;
}

describe('CommunicationFileController', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockReq = {
            user: {
                _id: 'user-123',
                role: 'pharmacist',
                workplaceId: 'workplace-123',
            },
            body: {},
            params: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-user-agent'),
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('uploadFile', () => {
        beforeEach(() => {
            mockReq.body = { conversationId: 'conv-123' };
            mockReq.file = {
                originalname: 'test-file.pdf',
                mimetype: 'application/pdf',
                size: 1024,
                path: '/tmp/test-file',
            } as Express.Multer.File;
        });

        it('should upload file successfully', async () => {
            // Mock conversation exists and user has access
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            // Mock file processing success
            (FileUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
                success: true,
                fileData: {
                    fileName: 'processed-file.pdf',
                    originalName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    url: 'http://example.com/file.pdf',
                    uploadedAt: new Date(),
                },
            });

            // Mock Cloudinary upload
            (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
                public_id: 'file-123',
                url: 'http://example.com/file.pdf',
                secure_url: 'https://example.com/file.pdf',
            });

            // Mock file deletion
            (FileUploadService.deleteFile as jest.Mock).mockResolvedValue(undefined);

            // Mock audit log creation
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'File uploaded successfully',
                file: expect.objectContaining({
                    id: 'file-123',
                    originalName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                }),
            });
        });

        it('should return 401 if user is not authenticated', async () => {
            mockReq.user = undefined;

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should return 400 if no conversation ID provided', async () => {
            mockReq.body = {};

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Conversation ID is required' });
        });

        it('should return 400 if no file uploaded', async () => {
            mockReq.file = undefined;

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
        });

        it('should return 403 if user does not have access to conversation', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue(null);

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied to this conversation' });
        });

        it('should return 400 if file processing fails', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (FileUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
                success: false,
                error: 'File type not allowed',
            });

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'File type not allowed' });
        });

        it('should handle Cloudinary upload errors', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (FileUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
                success: true,
                fileData: {
                    fileName: 'processed-file.pdf',
                    originalName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    url: 'http://example.com/file.pdf',
                    uploadedAt: new Date(),
                },
            });

            (cloudinary.uploader.upload as jest.Mock).mockRejectedValue(new Error('Cloudinary error'));

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'File upload failed',
                message: 'Cloudinary error',
            });
        });

        it('should clean up local file after successful upload', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (FileUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
                success: true,
                fileData: {
                    fileName: 'processed-file.pdf',
                    originalName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    url: 'http://example.com/file.pdf',
                    uploadedAt: new Date(),
                },
            });

            (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
                public_id: 'file-123',
                url: 'http://example.com/file.pdf',
                secure_url: 'https://example.com/file.pdf',
            });

            (FileUploadService.deleteFile as jest.Mock).mockResolvedValue(undefined);
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(FileUploadService.deleteFile).toHaveBeenCalledWith('/tmp/test-file');
        });

        it('should create audit log entry', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (FileUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
                success: true,
                fileData: {
                    fileName: 'processed-file.pdf',
                    originalName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    url: 'http://example.com/file.pdf',
                    uploadedAt: new Date(),
                },
            });

            (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
                public_id: 'file-123',
                url: 'http://example.com/file.pdf',
                secure_url: 'https://example.com/file.pdf',
            });

            (FileUploadService.deleteFile as jest.Mock).mockResolvedValue(undefined);
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.uploadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(AuditLog.create).toHaveBeenCalledWith({
                action: 'file_uploaded',
                userId: 'user-123',
                targetId: 'conv-123',
                targetType: 'conversation',
                details: expect.objectContaining({
                    conversationId: 'conv-123',
                    fileName: 'test-file.pdf',
                    fileSize: 1024,
                    mimeType: 'application/pdf',
                    publicId: 'file-123',
                }),
                ipAddress: '127.0.0.1',
                userAgent: 'test-user-agent',
                workplaceId: 'workplace-123',
                timestamp: expect.any(Date),
            });
        });
    });

    describe('downloadFile', () => {
        beforeEach(() => {
            mockReq.params = { fileId: 'file-123' };
        });

        it('should generate download URL successfully', async () => {
            // Mock message with file attachment
            (Message.findOne as jest.Mock).mockResolvedValue({
                _id: 'msg-123',
                conversationId: 'conv-123',
                content: {
                    attachments: [
                        {
                            fileId: 'file-123',
                            fileName: 'test-file.pdf',
                            mimeType: 'application/pdf',
                            fileSize: 1024,
                        },
                    ],
                },
            });

            // Mock conversation access
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            // Mock Cloudinary URL generation
            (cloudinary.url as jest.Mock).mockReturnValue('https://example.com/secure-download-url');

            // Mock audit log creation
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                downloadUrl: 'https://example.com/secure-download-url',
                fileName: 'test-file.pdf',
                mimeType: 'application/pdf',
                size: 1024,
            });
        });

        it('should return 401 if user is not authenticated', async () => {
            mockReq.user = undefined;

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should return 404 if file not found', async () => {
            (Message.findOne as jest.Mock).mockResolvedValue(null);

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'File not found' });
        });

        it('should return 403 if user does not have access to conversation', async () => {
            (Message.findOne as jest.Mock).mockResolvedValue({
                _id: 'msg-123',
                conversationId: 'conv-123',
                content: {
                    attachments: [{ fileId: 'file-123', fileName: 'test-file.pdf' }],
                },
            });

            (Conversation.findOne as jest.Mock).mockResolvedValue(null);

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied to this file' });
        });

        it('should return 404 if file attachment not found in message', async () => {
            (Message.findOne as jest.Mock).mockResolvedValue({
                _id: 'msg-123',
                conversationId: 'conv-123',
                content: {
                    attachments: [{ fileId: 'different-file', fileName: 'other-file.pdf' }],
                },
            });

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'File attachment not found' });
        });

        it('should create audit log entry for download', async () => {
            (Message.findOne as jest.Mock).mockResolvedValue({
                _id: 'msg-123',
                conversationId: 'conv-123',
                content: {
                    attachments: [
                        {
                            fileId: 'file-123',
                            fileName: 'test-file.pdf',
                            mimeType: 'application/pdf',
                            fileSize: 1024,
                        },
                    ],
                },
            });

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (cloudinary.url as jest.Mock).mockReturnValue('https://example.com/secure-download-url');
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.downloadFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(AuditLog.create).toHaveBeenCalledWith({
                action: 'file_downloaded',
                userId: 'user-123',
                targetId: 'msg-123',
                targetType: 'message',
                details: expect.objectContaining({
                    conversationId: 'conv-123',
                    messageId: 'msg-123',
                    fileName: 'test-file.pdf',
                    fileId: 'file-123',
                }),
                ipAddress: '127.0.0.1',
                userAgent: 'test-user-agent',
                workplaceId: 'workplace-123',
                timestamp: expect.any(Date),
            });
        });
    });

    describe('deleteFile', () => {
        beforeEach(() => {
            mockReq.params = { fileId: 'file-123' };
        });

        it('should delete file successfully', async () => {
            // Mock message with file attachment
            const mockMessage = {
                _id: 'msg-123',
                conversationId: 'conv-123',
                senderId: 'user-123',
                content: {
                    attachments: [
                        {
                            fileId: 'file-123',
                            fileName: 'test-file.pdf',
                        },
                    ],
                },
                save: jest.fn().mockResolvedValue(true),
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            // Mock conversation access
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            // Mock Cloudinary deletion
            (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

            // Mock audit log creation
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.deleteFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('file-123', { resource_type: 'auto' });
            expect(mockMessage.save).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'File deleted successfully',
            });
        });

        it('should return 403 if user is not the file owner and not admin', async () => {
            (Message.findOne as jest.Mock).mockResolvedValue({
                _id: 'msg-123',
                conversationId: 'conv-123',
                senderId: 'different-user',
                content: {
                    attachments: [{ fileId: 'file-123', fileName: 'test-file.pdf' }],
                },
            });

            await CommunicationFileController.deleteFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied. Only file owner or admin can delete files',
            });
        });

        it('should allow admin to delete any file', async () => {
            mockReq.user!.role = 'admin';

            const mockMessage = {
                _id: 'msg-123',
                conversationId: 'conv-123',
                senderId: 'different-user',
                content: {
                    attachments: [
                        {
                            fileId: 'file-123',
                            fileName: 'test-file.pdf',
                        },
                    ],
                },
                save: jest.fn().mockResolvedValue(true),
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.deleteFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'File deleted successfully',
            });
        });

        it('should remove attachment from message attachments array', async () => {
            const mockMessage = {
                _id: 'msg-123',
                conversationId: 'conv-123',
                senderId: 'user-123',
                content: {
                    attachments: [
                        { fileId: 'file-123', fileName: 'test-file.pdf' },
                        { fileId: 'file-456', fileName: 'other-file.pdf' },
                    ],
                },
                save: jest.fn().mockResolvedValue(true),
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
            (AuditLog.create as jest.Mock).mockResolvedValue({});

            await CommunicationFileController.deleteFile(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockMessage.content.attachments).toHaveLength(1);
            expect(mockMessage.content.attachments[0].fileId).toBe('file-456');
        });
    });

    describe('getFileMetadata', () => {
        beforeEach(() => {
            mockReq.params = { fileId: 'file-123' };
        });

        it('should return file metadata successfully', async () => {
            const mockSender = {
                _id: 'sender-123',
                firstName: 'John',
                lastName: 'Doe',
                role: 'pharmacist',
            };

            (Message.findOne as jest.Mock).mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'msg-123',
                    conversationId: 'conv-123',
                    senderId: mockSender,
                    createdAt: '2023-01-01T00:00:00Z',
                    content: {
                        attachments: [
                            {
                                fileId: 'file-123',
                                fileName: 'test-file.pdf',
                                mimeType: 'application/pdf',
                                fileSize: 1024,
                            },
                        ],
                    },
                }),
            });

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            await CommunicationFileController.getFileMetadata(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                file: {
                    id: 'file-123',
                    fileName: 'test-file.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    uploadedAt: '2023-01-01T00:00:00Z',
                    uploadedBy: mockSender,
                    conversationId: 'conv-123',
                    messageId: 'msg-123',
                },
            });
        });
    });

    describe('listConversationFiles', () => {
        beforeEach(() => {
            mockReq.params = { conversationId: 'conv-123' };
            mockReq.query = {};
        });

        it('should list conversation files successfully', async () => {
            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            const mockMessages = [
                {
                    _id: 'msg-123',
                    createdAt: '2023-01-01T00:00:00Z',
                    senderId: { _id: 'sender-123', firstName: 'John', lastName: 'Doe', role: 'pharmacist' },
                    content: {
                        attachments: [
                            {
                                fileId: 'file-123',
                                fileName: 'test-file.pdf',
                                mimeType: 'application/pdf',
                                fileSize: 1024,
                                secureUrl: 'https://example.com/file-123',
                            },
                        ],
                    },
                },
            ];

            (Message.find as jest.Mock).mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockMessages),
            });

            (Message.countDocuments as jest.Mock).mockResolvedValue(1);

            await CommunicationFileController.listConversationFiles(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                files: [
                    {
                        id: 'file-123',
                        fileName: 'test-file.pdf',
                        mimeType: 'application/pdf',
                        size: 1024,
                        secureUrl: 'https://example.com/file-123',
                        uploadedAt: '2023-01-01T00:00:00Z',
                        uploadedBy: mockMessages[0].senderId,
                        messageId: 'msg-123',
                    },
                ],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    pages: 1,
                },
            });
        });

        it('should filter files by type when specified', async () => {
            mockReq.query = { fileType: 'image' };

            (Conversation.findOne as jest.Mock).mockResolvedValue({
                _id: 'conv-123',
                workplaceId: 'workplace-123',
                participants: [{ userId: 'user-123' }],
            });

            (Message.find as jest.Mock).mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });

            (Message.countDocuments as jest.Mock).mockResolvedValue(0);

            await CommunicationFileController.listConversationFiles(mockReq as AuthenticatedRequest, mockRes as Response);

            expect(Message.find).toHaveBeenCalledWith({
                conversationId: 'conv-123',
                'content.attachments': { $exists: true, $ne: [] },
                'content.attachments.mimeType': new RegExp('image', 'i'),
            });
        });
    });
});