import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import patientMessagingRoutes from '../../routes/patientMessaging.routes';
import PatientUser from '../../models/PatientUser';
import { PatientMessagingService } from '../../services/PatientMessagingService';
import patientMessagingController from '../../controllers/patientMessagingController';

// Mock dependencies
jest.mock('../../models/PatientUser');
jest.mock('../../services/PatientMessagingService');
jest.mock('../../controllers/patientMessagingController');
jest.mock('../../utils/logger');

describe('Patient Messaging Routes', () => {
  let app: express.Application;
  let mockPatientUserId: mongoose.Types.ObjectId;
  let mockWorkplaceId: mongoose.Types.ObjectId;
  let mockConversationId: mongoose.Types.ObjectId;
  let validToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/patient-portal/messaging', patientMessagingRoutes);

    mockPatientUserId = new mongoose.Types.ObjectId();
    mockWorkplaceId = new mongoose.Types.ObjectId();
    mockConversationId = new mongoose.Types.ObjectId();

    // Create valid JWT token
    validToken = jwt.sign(
      { patientUserId: mockPatientUserId.toString() },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Mock PatientUser.findOne for authentication
    (PatientUser.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: mockPatientUserId,
        workplaceId: mockWorkplaceId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        status: 'active',
        isDeleted: false,
      }),
    });

    // Mock PatientUser.updateOne for activity tracking
    (PatientUser.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });

    // Mock controller methods
    (patientMessagingController.getOrCreateConversation as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { conversation: {} } });
    });
    (patientMessagingController.getConversations as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { conversations: [], count: 0 } });
    });
    (patientMessagingController.getConversationDetails as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { conversation: {} } });
    });
    (patientMessagingController.getMessages as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { messages: [], count: 0, pagination: {} } });
    });
    (patientMessagingController.sendMessage as jest.Mock) = jest.fn((req, res) => {
      res.status(201).json({ success: true, data: { message: {} } });
    });
    (patientMessagingController.markAsRead as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, message: 'Conversation marked as read' });
    });
    (patientMessagingController.getUnreadCount as jest.Mock) = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { totalUnreadCount: 0, conversationUnreadCounts: {} } });
    });
    (patientMessagingController.uploadAttachment as jest.Mock) = jest.fn((req, res) => {
      res.status(201).json({ success: true, data: { attachment: {} } });
    });

    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const response = await request(app).get('/api/patient-portal/messaging/conversations');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_MISSING');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject requests for suspended accounts', async () => {
      (PatientUser.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: mockPatientUserId,
          workplaceId: mockWorkplaceId,
          status: 'suspended',
          isDeleted: false,
        }),
      });

      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('should reject requests for pending accounts', async () => {
      (PatientUser.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: mockPatientUserId,
          workplaceId: mockWorkplaceId,
          status: 'pending',
          isDeleted: false,
        }),
      });

      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ACCOUNT_PENDING');
    });
  });

  describe('POST /conversations', () => {
    const mockConversation = {
      _id: mockConversationId,
      title: 'Patient Query - John Doe',
      type: 'patient_query',
    };

    beforeEach(() => {
      (PatientMessagingService.prototype.getOrCreateConversation as jest.Mock).mockResolvedValue(
        mockConversation
      );
    });

    it('should create or get conversation successfully', async () => {
      const pharmacistId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ pharmacistId: pharmacistId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toEqual(mockConversation);
    });

    it('should validate pharmacist ID', async () => {
      const response = await request(app)
        .post('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ pharmacistId: 'invalid-id' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require pharmacist ID', async () => {
      const response = await request(app)
        .post('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /conversations', () => {
    const mockConversations = [
      {
        _id: mockConversationId,
        title: 'Patient Query',
        lastMessageAt: new Date(),
      },
    ];

    beforeEach(() => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        mockConversations
      );
    });

    it('should get patient conversations successfully', async () => {
      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toEqual(mockConversations);
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('GET /conversations/:conversationId', () => {
    const mockConversations = [
      {
        _id: mockConversationId,
        title: 'Patient Query',
        lastMessageAt: new Date(),
      },
    ];

    beforeEach(() => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue(
        mockConversations
      );
    });

    it('should get conversation details successfully', async () => {
      const response = await request(app)
        .get(`/api/patient-portal/messaging/conversations/${mockConversationId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toEqual(mockConversations[0]);
    });

    it('should validate conversation ID', async () => {
      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations/invalid-id')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /conversations/:conversationId/messages', () => {
    const mockMessages = [
      {
        _id: new mongoose.Types.ObjectId(),
        content: { text: 'Hello' },
        senderId: mockPatientUserId,
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      (PatientMessagingService.prototype.getMessages as jest.Mock).mockResolvedValue(mockMessages);
    });

    it('should get messages successfully', async () => {
      const response = await request(app)
        .get(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual(mockMessages);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .query({ limit: '25', skip: '10' })
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(25);
      expect(response.body.data.pagination.skip).toBe(10);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .query({ limit: '200', skip: '-1' })
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /conversations/:conversationId/messages', () => {
    const mockMessage = {
      _id: new mongoose.Types.ObjectId(),
      content: { text: 'Hello, I have a question' },
      senderId: mockPatientUserId,
      createdAt: new Date(),
    };

    beforeEach(() => {
      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockResolvedValue(mockMessage);
    });

    it('should send message successfully', async () => {
      const response = await request(app)
        .post(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Hello, I have a question' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toEqual(mockMessage);
    });

    it('should validate message content', async () => {
      const response = await request(app)
        .post(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate message content length', async () => {
      const longContent = 'a'.repeat(5001);

      const response = await request(app)
        .post(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: longContent });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require message content', async () => {
      const response = await request(app)
        .post(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /conversations/:conversationId/read', () => {
    beforeEach(() => {
      (PatientMessagingService.prototype.markAsRead as jest.Mock).mockResolvedValue(undefined);
    });

    it('should mark conversation as read successfully', async () => {
      const response = await request(app)
        .put(`/api/patient-portal/messaging/conversations/${mockConversationId}/read`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Conversation marked as read');
    });

    it('should validate conversation ID', async () => {
      const response = await request(app)
        .put('/api/patient-portal/messaging/conversations/invalid-id/read')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /unread-count', () => {
    let mockUnreadData: any;

    beforeEach(() => {
      mockUnreadData = {
        totalUnreadCount: 5,
        conversationUnreadCounts: {
          [mockConversationId.toString()]: 3,
        },
      };
    });

    beforeEach(() => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockResolvedValue([
        {
          _id: mockConversationId,
          unreadCount: new Map([[mockPatientUserId.toString(), 3]]),
        },
      ]);
    });

    it('should get unread count successfully', async () => {
      const response = await request(app)
        .get('/api/patient-portal/messaging/unread-count')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUnreadCount).toBeDefined();
      expect(response.body.data.conversationUnreadCounts).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to message sending', async () => {
      const mockMessage = {
        _id: new mongoose.Types.ObjectId(),
        content: { text: 'Hello' },
        senderId: mockPatientUserId,
        createdAt: new Date(),
      };

      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockResolvedValue(mockMessage);

      // Send multiple requests rapidly
      const requests = Array(52).fill(null).map(() =>
        request(app)
          .post(`/api/patient-portal/messaging/conversations/${mockConversationId}/messages`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({ content: 'Hello' })
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      (PatientMessagingService.prototype.getPatientConversations as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/patient-portal/messaging/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ pharmacistId: 'not-a-valid-id' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});