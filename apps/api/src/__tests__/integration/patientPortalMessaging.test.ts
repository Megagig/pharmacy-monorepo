import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import PatientUser from '../../models/PatientUser';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { createPatientPortalIntegration } from '../../integrations/patientPortalIntegration';

// Mock dependencies
jest.mock('../../models/PatientUser');
jest.mock('../../models/Conversation');
jest.mock('../../models/Message');
jest.mock('../../services/NotificationService');
jest.mock('../../utils/logger');

describe('Patient Portal Messaging Integration', () => {
  let app: express.Application;
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let integration: any;
  let port: number;

  let mockPatientUserId: mongoose.Types.ObjectId;
  let mockWorkplaceId: mongoose.Types.ObjectId;
  let mockConversationId: mongoose.Types.ObjectId;
  let validToken: string;

  beforeAll(async () => {
    // Setup test server
    app = express();
    app.use(express.json());
    
    httpServer = new HttpServer(app);
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket'],
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });

    // Initialize patient portal integration
    integration = await createPatientPortalIntegration(app, httpServer, io);
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    httpServer.close();
  });

  beforeEach(() => {
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

    jest.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('WebSocket Authentication', () => {
    it('should authenticate patient with valid token', (done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });
    });

    it('should reject connection without token', (done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });
    });
  });

  describe('Real-time Messaging', () => {
    beforeEach((done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should receive connection confirmation', (done) => {
      clientSocket.on('connected', (data) => {
        expect(data.success).toBe(true);
        expect(data.patientUserId).toBe(mockPatientUserId.toString());
        expect(data.workplaceId).toBe(mockWorkplaceId.toString());
        done();
      });
    });

    it('should join conversation successfully', (done) => {
      const mockConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        participants: [{ userId: mockPatientUserId, role: 'patient' }],
        isDeleted: false,
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);

      clientSocket.emit('join_conversation', {
        conversationId: mockConversationId.toString(),
      });

      clientSocket.on('conversation_joined', (data) => {
        expect(data.success).toBe(true);
        expect(data.conversationId).toBe(mockConversationId.toString());
        done();
      });

      clientSocket.on('error', done);
    });

    it('should handle typing indicators', (done) => {
      const mockConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        participants: [{ userId: mockPatientUserId, role: 'patient' }],
        isDeleted: false,
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);

      // First join the conversation
      clientSocket.emit('join_conversation', {
        conversationId: mockConversationId.toString(),
      });

      clientSocket.on('conversation_joined', () => {
        // Start typing
        clientSocket.emit('typing_start', {
          conversationId: mockConversationId.toString(),
        });

        // Stop typing after a short delay
        setTimeout(() => {
          clientSocket.emit('typing_stop', {
            conversationId: mockConversationId.toString(),
          });
          done();
        }, 100);
      });
    });

    it('should handle real-time message sending', (done) => {
      const mockConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        participants: [
          {
            userId: mockPatientUserId,
            role: 'patient',
            permissions: ['read_messages', 'send_messages'],
          },
        ],
        metadata: { isEncrypted: true },
        updateLastMessage: jest.fn(),
        incrementUnreadCount: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        isDeleted: false,
      };

      const mockMessage = {
        _id: new mongoose.Types.ObjectId(),
        conversationId: mockConversationId,
        senderId: mockPatientUserId,
        content: { text: 'Hello from WebSocket' },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          senderId: { firstName: 'John', lastName: 'Doe', role: 'patient' },
        }),
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (Message as any).mockImplementation(() => mockMessage);

      // First join the conversation
      clientSocket.emit('join_conversation', {
        conversationId: mockConversationId.toString(),
      });

      clientSocket.on('conversation_joined', () => {
        // Send a message
        clientSocket.emit('send_message', {
          conversationId: mockConversationId.toString(),
          content: 'Hello from WebSocket',
        });
      });

      clientSocket.on('message_sent', (data) => {
        expect(data.messageId).toBeDefined();
        expect(data.conversationId).toBe(mockConversationId.toString());
        done();
      });

      clientSocket.on('message_error', done);
    });

    it('should handle mark as read', (done) => {
      const mockConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        participants: [{ userId: mockPatientUserId, role: 'patient' }],
        markAsRead: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        isDeleted: false,
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);

      clientSocket.emit('mark_as_read', {
        conversationId: mockConversationId.toString(),
      });

      clientSocket.on('marked_as_read', (data) => {
        expect(data.success).toBe(true);
        expect(data.conversationId).toBe(mockConversationId.toString());
        done();
      });

      clientSocket.on('error', done);
    });

    it('should handle ping/pong for connection health', (done) => {
      clientSocket.emit('ping');

      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should handle conversation not found error', (done) => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(null);

      clientSocket.emit('join_conversation', {
        conversationId: mockConversationId.toString(),
      });

      clientSocket.on('error', (data) => {
        expect(data.type).toBe('join_conversation_error');
        expect(data.message).toBe('Conversation not found or access denied');
        done();
      });
    });

    it('should handle message sending errors', (done) => {
      const mockConversation = {
        _id: mockConversationId,
        workplaceId: mockWorkplaceId,
        participants: [
          {
            userId: mockPatientUserId,
            role: 'patient',
            permissions: ['read_messages'], // No send permission
          },
        ],
        isDeleted: false,
      };

      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);

      clientSocket.emit('send_message', {
        conversationId: mockConversationId.toString(),
        content: 'This should fail',
      });

      clientSocket.on('message_error', (data) => {
        expect(data.error).toBeDefined();
        expect(data.conversationId).toBe(mockConversationId.toString());
        done();
      });
    });
  });

  describe('Connection Management', () => {
    it('should track online status', (done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        const webSocketIntegration = integration.getWebSocketIntegration();
        const isOnline = webSocketIntegration.isPatientOnline(mockPatientUserId.toString());
        expect(isOnline).toBe(true);
        done();
      });
    });

    it('should handle disconnection gracefully', (done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        // Give some time for cleanup
        setTimeout(() => {
          const webSocketIntegration = integration.getWebSocketIntegration();
          const isOnline = webSocketIntegration.isPatientOnline(mockPatientUserId.toString());
          expect(isOnline).toBe(false);
          done();
        }, 100);
      });
    });
  });

  describe('System Notifications', () => {
    beforeEach((done) => {
      clientSocket = Client(`http://localhost:${port}/patient-portal`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should receive system notifications', (done) => {
      const notification = {
        type: 'system_update',
        title: 'System Update',
        message: 'The system will be updated tonight',
        priority: 'normal',
      };

      clientSocket.on('system_notification', (data) => {
        expect(data.notification).toEqual(notification);
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Broadcast system notification
      integration.broadcastSystemNotification(mockWorkplaceId.toString(), notification);
    });

    it('should receive maintenance mode notifications', (done) => {
      clientSocket.on('maintenance_mode', (data) => {
        expect(data.enabled).toBe(true);
        expect(data.message).toBeDefined();
        done();
      });

      // Enable maintenance mode
      integration.enableMaintenanceMode(mockWorkplaceId.toString());
    });
  });
});