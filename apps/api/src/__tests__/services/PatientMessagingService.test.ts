import mongoose from 'mongoose';
import { PatientMessagingService } from '../../services/PatientMessagingService';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import PatientUser from '../../models/PatientUser';
import User from '../../models/User';
import { notificationService } from '../../services/notificationService';
import { PatientPortalUploadService } from '../../middlewares/upload';

// Mock dependencies
jest.mock('../../models/Conversation');
jest.mock('../../models/Message');
jest.mock('../../models/PatientUser');
jest.mock('../../models/User');
jest.mock('../../services/notificationService');
jest.mock('../../middlewares/upload');
jest.mock('../../utils/logger');

describe('PatientMessagingService', () => {
  let service: PatientMessagingService;
  let mockPatientUserId: mongoose.Types.ObjectId;
  let mockPharmacistId: mongoose.Types.ObjectId;
  let mockWorkplaceId: mongoose.Types.ObjectId;
  let mockConversationId: mongoose.Types.ObjectId;

  beforeEach(() => {
    service = new PatientMessagingService();
    mockPatientUserId = new mongoose.Types.ObjectId();
    mockPharmacistId = new mongoose.Types.ObjectId();
    mockWorkplaceId = new mongoose.Types.ObjectId();
    mockConversationId = new mongoose.Types.ObjectId();

    jest.clearAllMocks();
  });

  describe('getOrCreateConversation', () => {
    const mockPatientUser = {
      _id: mockPatientUserId,
      workplaceId: mockWorkplaceId,
      status: 'active',
      firstName: 'John',
      lastName: 'Doe',
      patientId: new mongoose.Types.ObjectId(),
    };

    const mockPharmacist = {
      _id: mockPharmacistId,
      workplaceId: mockWorkplaceId,
      role: 'pharmacist',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    beforeEach(() => {
      (PatientUser.findOne as jest.Mock).mockResolvedValue(mockPatientUser);
      (User.findOne as jest.Mock).mockResolvedValue(mockPharmacist);
    });

    it('should return existing conversation if found', async () => {
      const mockExistingConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        type: 'patient_query',
        participants: [
          { userId: mockPatientUserId, role: 'patient' },
          { userId: mockPharmacistId, role: 'pharmacist' },
        ],
        populate: jest.fn().mockResolvedValue(this),
      };

      (Conversation.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockExistingConversation),
      });

      const result = await service.getOrCreateConversation(
        mockPatientUserId,
        mockPharmacistId,
        mockWorkplaceId
      );

      expect(result).toBe(mockExistingConversation);
      expect(Conversation.findOne).toHaveBeenCalledWith({
        workplaceId: mockWorkplaceId,
        type: 'patient_query',
        'participants.userId': { $all: [mockPatientUserId, mockPharmacistId] },
        'participants.leftAt': { $exists: false },
        status: { $in: ['active', 'resolved'] },
        isDeleted: false,
      });
    });

    it('should create new conversation if none exists', async () => {
      (Conversation.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const mockNewConversation = {
        _id: mockConversationId,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(this),
      };

      (Conversation as any).mockImplementation(() => mockNewConversation);

      const result = await service.getOrCreateConversation(
        mockPatientUserId,
        mockPharmacistId,
        mockWorkplaceId
      );

      expect(result).toBe(mockNewConversation);
      expect(mockNewConversation.save).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        userId: mockPharmacistId,
        type: 'patient_query',
        title: 'New Patient Message',
        content: `${mockPatientUser.firstName} ${mockPatientUser.lastName} has started a conversation`,
        data: {
          conversationId: mockConversationId,
          patientId: mockPatientUser.patientId,
          senderId: mockPatientUserId,
        },
        workplaceId: mockWorkplaceId,
        createdBy: mockPatientUserId,
      });
    });

    it('should throw error if patient user not found', async () => {
      (PatientUser.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getOrCreateConversation(mockPatientUserId, mockPharmacistId, mockWorkplaceId)
      ).rejects.toThrow('Patient user not found or not active');
    });

    it('should throw error if pharmacist not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getOrCreateConversation(mockPatientUserId, mockPharmacistId, mockWorkplaceId)
      ).rejects.toThrow('Pharmacist not found');
    });
  });

  describe('sendMessage', () => {
    const mockConversation = {
      _id: mockConversationId,
      workplaceId: mockWorkplaceId,
      participants: [
        {
          userId: { toString: () => mockPatientUserId.toString() },
          role: 'patient',
          permissions: ['read_messages', 'send_messages'],
        },
      ],
      metadata: { isEncrypted: true },
      updateLastMessage: jest.fn(),
      incrementUnreadCount: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
    };

    const mockMessage = {
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue({
        senderId: { firstName: 'John', lastName: 'Doe', role: 'patient' },
      }),
    };

    beforeEach(() => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (Message as any).mockImplementation(() => mockMessage);
    });

    it('should send message successfully', async () => {
      const content = 'Hello, I have a question about my medication';

      const result = await service.sendMessage(
        mockConversationId,
        mockPatientUserId,
        content
      );

      expect(result).toBe(mockMessage);
      expect(mockMessage.save).toHaveBeenCalled();
      expect(mockConversation.updateLastMessage).toHaveBeenCalledWith(mockMessage._id);
      expect(mockConversation.incrementUnreadCount).toHaveBeenCalledWith(mockPatientUserId);
      expect(mockConversation.save).toHaveBeenCalled();
    });

    it('should send message with attachments', async () => {
      const content = 'Please see attached prescription';
      const attachments = [
        {
          fileName: 'prescription.pdf',
          originalName: 'prescription.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: 'http://example.com/prescription.pdf',
          uploadedAt: new Date(),
          category: 'patientAttachments',
        },
      ];

      const result = await service.sendMessage(
        mockConversationId,
        mockPatientUserId,
        content,
        attachments
      );

      expect(result).toBe(mockMessage);
      expect(Message).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'prescription.pdf',
                originalName: 'prescription.pdf',
              }),
            ]),
          }),
        })
      );
    });

    it('should throw error if conversation not found', async () => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.sendMessage(mockConversationId, mockPatientUserId, 'Hello')
      ).rejects.toThrow('Conversation not found or access denied');
    });

    it('should throw error if content is empty', async () => {
      await expect(
        service.sendMessage(mockConversationId, mockPatientUserId, '')
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('should throw error if content exceeds maximum length', async () => {
      const longContent = 'a'.repeat(5001);

      await expect(
        service.sendMessage(mockConversationId, mockPatientUserId, longContent)
      ).rejects.toThrow('Message content exceeds maximum length of 5000 characters');
    });

    it('should throw error if sender lacks permissions', async () => {
      const mockConversationNoPermission = {
        ...mockConversation,
        participants: [
          {
            userId: mockPatientUserId,
            role: 'patient',
            permissions: ['read_messages'], // No send_messages permission
          },
        ],
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversationNoPermission);

      await expect(
        service.sendMessage(mockConversationId, mockPatientUserId, 'Hello')
      ).rejects.toThrow('Insufficient permissions to send messages');
    });
  });

  describe('getMessages', () => {
    const mockConversation = {
      _id: mockConversationId,
      participants: [{ userId: mockPatientUserId, role: 'patient' }],
    };

    const mockMessages = [
      {
        _id: new mongoose.Types.ObjectId(),
        content: { text: 'Hello' },
        senderId: mockPatientUserId,
        createdAt: new Date(),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        content: { text: 'Hi there' },
        senderId: mockPharmacistId,
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (Message.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockMessages),
      });
    });

    it('should retrieve messages successfully', async () => {
      const result = await service.getMessages(mockConversationId, mockPatientUserId);

      expect(result).toEqual(mockMessages.reverse());
      expect(Message.find).toHaveBeenCalledWith({
        conversationId: mockConversationId,
        isDeleted: false,
      });
    });

    it('should apply limit and skip parameters', async () => {
      const limit = 25;
      const skip = 10;

      await service.getMessages(mockConversationId, mockPatientUserId, limit, skip);

      expect(Message.find().limit).toHaveBeenCalledWith(25);
      expect(Message.find().skip).toHaveBeenCalledWith(10);
    });

    it('should cap limit at 100 messages', async () => {
      await service.getMessages(mockConversationId, mockPatientUserId, 200);

      expect(Message.find().limit).toHaveBeenCalledWith(100);
    });

    it('should throw error if conversation not found', async () => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getMessages(mockConversationId, mockPatientUserId)
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('markAsRead', () => {
    const mockConversation = {
      _id: mockConversationId,
      participants: [{ userId: mockPatientUserId, role: 'patient' }],
      markAsRead: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
    });

    it('should mark conversation as read', async () => {
      await service.markAsRead(mockConversationId, mockPatientUserId);

      expect(mockConversation.markAsRead).toHaveBeenCalledWith(mockPatientUserId);
      expect(mockConversation.save).toHaveBeenCalled();
    });

    it('should throw error if conversation not found', async () => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsRead(mockConversationId, mockPatientUserId)
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('getPatientConversations', () => {
    const mockPatientUser = {
      _id: mockPatientUserId,
      workplaceId: mockWorkplaceId,
      status: 'active',
    };

    const mockConversations = [
      {
        _id: mockConversationId,
        title: 'Patient Query',
        lastMessageAt: new Date(),
      },
    ];

    beforeEach(() => {
      (PatientUser.findOne as jest.Mock).mockResolvedValue(mockPatientUser);
      (Conversation.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockConversations),
      });
    });

    it('should retrieve patient conversations', async () => {
      const result = await service.getPatientConversations(mockPatientUserId, mockWorkplaceId);

      expect(result).toEqual(mockConversations);
      expect(Conversation.find).toHaveBeenCalledWith({
        workplaceId: mockWorkplaceId,
        'participants.userId': mockPatientUserId,
        'participants.leftAt': { $exists: false },
        status: { $ne: 'closed' },
        isDeleted: false,
      });
    });

    it('should throw error if patient user not found', async () => {
      (PatientUser.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getPatientConversations(mockPatientUserId, mockWorkplaceId)
      ).rejects.toThrow('Patient user not found or not active');
    });
  });

  describe('validateAttachment', () => {
    it('should validate valid file', async () => {
      const mockFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
      } as Express.Multer.File;

      const result = await service.validateAttachment(mockFile);

      expect(result).toBe(true);
    });

    it('should reject file exceeding size limit', async () => {
      const mockFile = {
        originalname: 'large-file.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
      } as Express.Multer.File;

      await expect(service.validateAttachment(mockFile)).rejects.toThrow(
        'File size exceeds 10MB limit'
      );
    });

    it('should reject unsupported file type', async () => {
      const mockFile = {
        originalname: 'script.exe',
        mimetype: 'application/x-executable',
        size: 1024,
      } as Express.Multer.File;

      await expect(service.validateAttachment(mockFile)).rejects.toThrow(
        'File type application/x-executable is not allowed'
      );
    });

    it('should reject file with invalid characters in name', async () => {
      const mockFile = {
        originalname: '../../../etc/passwd.txt',
        mimetype: 'text/plain',
        size: 1024,
      } as Express.Multer.File;

      await expect(service.validateAttachment(mockFile)).rejects.toThrow(
        'Invalid characters in filename'
      );
    });
  });

  describe('uploadAttachment', () => {
    const mockFile = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    const mockUploadResult = {
      success: true,
      fileData: {
        fileName: 'patient-attachments-123-document.pdf',
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: 'http://example.com/uploads/document.pdf',
        uploadedAt: new Date(),
        category: 'patientAttachments',
      },
    };

    beforeEach(() => {
      (PatientPortalUploadService.processUploadedFile as jest.Mock).mockResolvedValue(
        mockUploadResult
      );
    });

    it('should upload attachment successfully', async () => {
      const result = await service.uploadAttachment(mockFile, mockConversationId);

      expect(result).toEqual(mockUploadResult.fileData);
      expect(PatientPortalUploadService.processUploadedFile).toHaveBeenCalledWith(
        mockFile,
        'patientAttachments'
      );
    });

    it('should throw error if upload fails', async () => {
      (PatientPortalUploadService.processUploadedFile as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Upload failed',
      });

      await expect(
        service.uploadAttachment(mockFile, mockConversationId)
      ).rejects.toThrow('Upload failed');
    });
  });
});