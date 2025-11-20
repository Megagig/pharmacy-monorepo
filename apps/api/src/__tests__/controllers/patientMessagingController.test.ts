import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { PatientMessagingController } from '../../controllers/patientMessagingController';
import { PatientMessagingService } from '../../services/PatientMessagingService';

// Mock dependencies
jest.mock('../../services/PatientMessagingService');
jest.mock('../../utils/logger');

describe('PatientMessagingController', () => {
  let app: express.Application;
  let controller: PatientMessagingController;
  let mockPatientUserId: mongoose.Types.ObjectId;
  let mockPharmacistId: mongoose.Types.ObjectId;
  let mockWorkplaceId: mongoose.Types.ObjectId;
  let mockConversationId: mongoose.Types.ObjectId;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    controller = new PatientMessagingController();
    mockPatientUserId = new mongoose.Types.ObjectId();
    mockPharmacistId = new mongoose.Types.ObjectId();
    mockWorkplaceId = new mongoose.Types.ObjectId();
    mockConversationId = new mongoose.Types.ObjectId();

    // Mock patient authentication middleware
    app.use((req: any, res, next) => {
      req.patientUser = {
        _id: mockPatientUserId,
        workplaceId: mockWorkplaceId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        status: 'active',
      };
      next();
    });

    // Setup routes
    app.post('/conversations', controller.getOrCreateConversation.bind(controller));
    app.get('/conversations', controller.getConversations.bind(controller));
    app.get('/conversations/:conversationId', controller.getConversationDetails.bind(controller));
    app.get('/conversations/:conversationId/messages', controller.getMessages.bind(controller));
    app.post('/conversations/:conversationId/messages', controller.sendMessage.bind(controller));
    app.post('/conversations/:conversationId/attachments', controller.uploadAttachment.bind(controller));
    app.put('/conversations/:conversationId/read', controller.markAsRead.bind(controller));
    app.get('/unread-count', controller.getUnreadCount.bind(controller));

    jest.clearAllMocks();
  });

  describe('POST /conversations', () => {
    const mockConversation = {
      _id: mockConversationId,
      title: 'Patient Query - John Doe',
      type: 'patient_query',
      participants: [
        { userId: mockPatientUserId, role: 'patient' },
        { userId: mockPharmacistId, role: 'pharmacist' },
      ],
    };

    beforeEach(() => {
      (PatientMessagingService.prototype.getOrCreateConversation as jest.Mock).mockResolvedValue(
        mockConversation
      );
    });

    it('should create or get conversation successfully', async () => {
      const response = await request(app)
        .post('/conversations')
        .send({ pharmacistId: mockPharmacistId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toEqual(mockConversation);
      expect(PatientMessagingService.prototype.getOrCreateConversation).toHaveBeenCalledWith(
        mockPatientUserId,
        mockPharmacistId,
        mockWorkplaceId
      );
    });

    it('should return 400 for invalid pharmacist ID', async () => {
      const response = await request(app)
        .post('/conversations')
        .send({ pharmacistId: 'invalid-id' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid pharmacist ID is required');
    });

    it('should return 400 for missing pharmacist ID', async () => {
      const response = await request(app)
        .post('/conversations')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Valid pharmacist ID is required');
    });

    it('should return 404 when pharmacist not found', async () => {
      (PatientMessagingService.prototype.getOrCreateConversation as jest.Mock).mockRejectedValue(
        new Error('Pharmacist not found')
      );

      const response = await request(app)
        .post('/conversations')
        .send({ pharmacistId: mockPharmacistId.toString() });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Pharmacist not found');
    });
  });

  describe('GET /conversations', () => {
    let mockConversations: any[];

    beforeEach(() => {
      mockConversations = [
        {
          _id: mockConversationId.toString(),
          title: 'Patient Query',
          lastMessageAt: new Date().toISOString(),
        },
      ];
    });

    beforeEach(() => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        mockConversations
      );
    });

    it('should get patient conversations successfully', async () => {
      const response = await request(app).get('/conversations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toEqual(mockConversations);
      expect(response.body.data.count).toBe(1);
      expect(PatientMessagingService.prototype.getPatientConversations).toHaveBeenCalledWith(
        mockPatientUserId,
        mockWorkplaceId
      );
    });

    it('should return 404 when patient not found', async () => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockRejectedValue(
        new Error('Patient user not found or not active')
      );

      const response = await request(app).get('/conversations');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Patient user not found or not active');
    });
  });

  describe('GET /conversations/:conversationId/messages', () => {
    let mockMessages: any[];

    beforeEach(() => {
      mockMessages = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          content: { text: 'Hello' },
          senderId: mockPatientUserId.toString(),
          createdAt: new Date().toISOString(),
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          content: { text: 'Hi there' },
          senderId: mockPharmacistId.toString(),
          createdAt: new Date().toISOString(),
        },
      ];
    });

    beforeEach(() => {
      (PatientMessagingService.prototype.getMessages as jest.Mock).mockResolvedValue(mockMessages);
    });

    it('should get messages successfully', async () => {
      const response = await request(app).get(`/conversations/${mockConversationId}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual(mockMessages);
      expect(response.body.data.count).toBe(2);
      expect(PatientMessagingService.prototype.getMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId,
        50,
        0
      );
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get(`/conversations/${mockConversationId}/messages`)
        .query({ limit: '25', skip: '10' });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(25);
      expect(response.body.data.pagination.skip).toBe(10);
      expect(PatientMessagingService.prototype.getMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId,
        25,
        10
      );
    });

    it('should cap limit at 100', async () => {
      const response = await request(app)
        .get(`/conversations/${mockConversationId}/messages`)
        .query({ limit: '200' });

      expect(response.status).toBe(200);
      expect(PatientMessagingService.prototype.getMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId,
        100,
        0
      );
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app).get('/conversations/invalid-id/messages');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid conversation ID');
    });

    it('should return 404 when conversation not found', async () => {
      (PatientMessagingService.prototype.getMessages as jest.Mock).mockRejectedValue(
        new Error('Conversation not found or access denied')
      );

      const response = await request(app).get(`/conversations/${mockConversationId}/messages`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found or access denied');
    });
  });

  describe('POST /conversations/:conversationId/messages', () => {
    let mockMessage: any;

    beforeEach(() => {
      mockMessage = {
        _id: new mongoose.Types.ObjectId().toString(),
        content: { text: 'Hello, I have a question' },
        senderId: mockPatientUserId.toString(),
        createdAt: new Date().toISOString(),
      };
    });

    beforeEach(() => {
      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockResolvedValue(mockMessage);
    });

    it('should send message successfully', async () => {
      const response = await request(app)
        .post(`/conversations/${mockConversationId}/messages`)
        .send({ content: 'Hello, I have a question' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toEqual(mockMessage);
      expect(PatientMessagingService.prototype.sendMessage).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId,
        'Hello, I have a question',
        []
      );
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app)
        .post('/conversations/invalid-id/messages')
        .send({ content: 'Hello' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid conversation ID');
    });

    it('should return 400 for empty content', async () => {
      const response = await request(app)
        .post(`/conversations/${mockConversationId}/messages`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Message content is required');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .post(`/conversations/${mockConversationId}/messages`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Message content is required');
    });

    it('should return 404 when conversation not found', async () => {
      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Conversation not found or access denied')
      );

      const response = await request(app)
        .post(`/conversations/${mockConversationId}/messages`)
        .send({ content: 'Hello' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found or access denied');
    });

    it('should return 400 for insufficient permissions', async () => {
      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Insufficient permissions to send messages')
      );

      const response = await request(app)
        .post(`/conversations/${mockConversationId}/messages`)
        .send({ content: 'Hello' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions to send messages');
    });
  });

  describe('PUT /conversations/:conversationId/read', () => {
    beforeEach(() => {
      (PatientMessagingService.prototype.markAsRead as jest.Mock).mockResolvedValue(undefined);
    });

    it('should mark conversation as read successfully', async () => {
      const response = await request(app).put(`/conversations/${mockConversationId}/read`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Conversation marked as read');
      expect(PatientMessagingService.prototype.markAsRead).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId
      );
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app).put('/conversations/invalid-id/read');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid conversation ID');
    });

    it('should return 404 when conversation not found', async () => {
      (PatientMessagingService.prototype.markAsRead as jest.Mock).mockRejectedValue(
        new Error('Conversation not found or access denied')
      );

      const response = await request(app).put(`/conversations/${mockConversationId}/read`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found or access denied');
    });
  });

  describe('GET /conversations/:conversationId', () => {
    let mockConversations: any[];

    beforeEach(() => {
      mockConversations = [
        {
          _id: { toString: () => mockConversationId.toString() },
          title: 'Patient Query',
          lastMessageAt: new Date().toISOString(),
        },
      ];
    });

    beforeEach(() => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        mockConversations
      );
    });

    it('should get conversation details successfully', async () => {
      const response = await request(app).get(`/conversations/${mockConversationId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation.title).toBe('Patient Query');
      expect(response.body.data.conversation.lastMessageAt).toBeDefined();
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app).get('/conversations/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid conversation ID');
    });

    it('should return 404 when conversation not found', async () => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get(`/conversations/${mockConversationId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found or access denied');
    });
  });

  describe('GET /unread-count', () => {
    let mockConversations: any[];

    beforeEach(() => {
      mockConversations = [
        {
          _id: mockConversationId,
          title: 'Patient Query',
          unreadCount: new Map([[mockPatientUserId.toString(), 3]]),
        },
      ];
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        mockConversations
      );
    });

    it('should get unread count successfully', async () => {
      const response = await request(app).get('/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUnreadCount).toBe(3);
      expect(response.body.data.conversationUnreadCounts[mockConversationId.toString()]).toBe(3);
    });

    it('should handle conversations with no unread messages', async () => {
      const conversationsWithNoUnread = [
        {
          _id: mockConversationId,
          title: 'Patient Query',
          unreadCount: new Map(),
        },
      ];

      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        conversationsWithNoUnread
      );

      const response = await request(app).get('/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUnreadCount).toBe(0);
      expect(response.body.data.conversationUnreadCounts[mockConversationId.toString()]).toBe(0);
    });
  });

  describe('POST /conversations/:conversationId/attachments', () => {
    const mockAttachment = {
      fileName: 'document.pdf',
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: 'http://example.com/document.pdf',
      uploadedAt: new Date(),
      category: 'patientAttachments',
    };

    beforeEach(() => {
      (PatientMessagingService.prototype.uploadAttachment as jest.Mock).mockResolvedValue(
        mockAttachment
      );
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app).post('/conversations/invalid-id/attachments');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid conversation ID');
    });

    it('should return 400 when no file uploaded', async () => {
      const response = await request(app).post(`/conversations/${mockConversationId}/attachments`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No file uploaded');
    });
  });
});