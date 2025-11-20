import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PatientPortalWebSocketHandler, { PatientPortalSocket } from '../../websocket/patientPortalHandler';
import PatientUser from '../../models/PatientUser';
import Conversation from '../../models/Conversation';
import { PatientMessagingService } from '../../services/PatientMessagingService';

// Mock dependencies
jest.mock('../../models/PatientUser');
jest.mock('../../models/Conversation');
jest.mock('../../services/PatientMessagingService');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');

describe('PatientPortalWebSocketHandler', () => {
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockNamespace: any;
  let mockSocket: jest.Mocked<PatientPortalSocket>;
  let handler: PatientPortalWebSocketHandler;
  let mockPatientUserId: mongoose.Types.ObjectId;
  let mockWorkplaceId: mongoose.Types.ObjectId;
  let mockConversationId: mongoose.Types.ObjectId;

  beforeEach(() => {
    mockPatientUserId = new mongoose.Types.ObjectId();
    mockWorkplaceId = new mongoose.Types.ObjectId();
    mockConversationId = new mongoose.Types.ObjectId();

    // Mock Socket.IO namespace
    mockNamespace = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Mock Socket.IO server
    mockIo = {
      of: jest.fn().mockReturnValue(mockNamespace),
    } as any;

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      on: jest.fn(),
      disconnect: jest.fn(),
      patientUserId: mockPatientUserId,
      workplaceId: mockWorkplaceId,
      isAuthenticated: true,
      lastActivity: new Date(),
    } as any;

    handler = new PatientPortalWebSocketHandler(mockIo);

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize WebSocket handler and setup namespace', () => {
      // Create a new handler to test constructor
      const testHandler = new (PatientPortalWebSocketHandler as any)(mockIo);
      
      expect(mockIo.of).toHaveBeenCalledWith('/patient-portal');
      expect(mockNamespace.use).toHaveBeenCalled();
      expect(mockNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('authenticatePatientSocket', () => {
    const mockPatientUser = {
      _id: mockPatientUserId,
      workplaceId: mockWorkplaceId,
      status: 'active',
      firstName: 'John',
      lastName: 'Doe',
    };

    beforeEach(() => {
      (jwt.verify as jest.Mock).mockReturnValue({ patientUserId: mockPatientUserId.toString() });
      (PatientUser.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPatientUser),
      });
    });

    it('should authenticate valid patient socket', async () => {
      const result = await (handler as any).authenticatePatientSocket(mockSocket);

      expect(result).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(PatientUser.findOne).toHaveBeenCalledWith({
        _id: mockPatientUserId.toString(),
        status: 'active',
        isDeleted: false,
      });
      // The method should set these properties on the socket
      expect(mockSocket.isAuthenticated).toBe(true);
    });

    it('should reject socket without token', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = {};

      const result = await (handler as any).authenticatePatientSocket(mockSocket);

      expect(result).toBe(false);
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('should reject socket with invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await (handler as any).authenticatePatientSocket(mockSocket);

      expect(result).toBe(false);
    });

    it('should reject socket for inactive patient user', async () => {
      (PatientUser.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await (handler as any).authenticatePatientSocket(mockSocket);

      expect(result).toBe(false);
    });

    it('should handle token from authorization header', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = { authorization: 'Bearer valid-token' };

      const result = await (handler as any).authenticatePatientSocket(mockSocket);

      expect(result).toBe(true);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
    });
  });

  describe('handleJoinConversation', () => {
    const mockConversation = {
      _id: mockConversationId,
      workplaceId: mockWorkplaceId,
      participants: [{ userId: mockPatientUserId, role: 'patient' }],
    };

    beforeEach(() => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
    });

    it('should allow patient to join valid conversation', async () => {
      await (handler as any).handleJoinConversation(mockSocket, mockConversationId.toString());

      expect(Conversation.findOne).toHaveBeenCalledWith({
        _id: mockConversationId.toString(),
        workplaceId: mockWorkplaceId,
        'participants.userId': mockPatientUserId,
        'participants.leftAt': { $exists: false },
        isDeleted: false,
      });
      expect(mockSocket.join).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('conversation_joined', {
        conversationId: mockConversationId.toString(),
        success: true,
        timestamp: expect.any(Date),
      });
    });

    it('should reject access to invalid conversation', async () => {
      (Conversation.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        (handler as any).handleJoinConversation(mockSocket, mockConversationId.toString())
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('handleLeaveConversation', () => {
    it('should allow patient to leave conversation', () => {
      (handler as any).handleLeaveConversation(mockSocket, mockConversationId.toString());

      expect(mockSocket.leave).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('conversation_left', {
        conversationId: mockConversationId.toString(),
        success: true,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('handleTypingStart', () => {
    it('should handle typing start indicator', () => {
      const mockToEmit = jest.fn();
      (mockSocket.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      (handler as any).handleTypingStart(mockSocket, mockConversationId.toString());

      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockToEmit).toHaveBeenCalledWith('typing_start', {
        conversationId: mockConversationId.toString(),
        patientUserId: mockPatientUserId.toString(),
        timestamp: expect.any(Date),
      });
    });

    it('should track typing indicators', () => {
      (handler as any).handleTypingStart(mockSocket, mockConversationId.toString());

      const typingIndicators = handler.getTypingIndicators(mockConversationId.toString());
      expect(typingIndicators).toContain(mockPatientUserId.toString());
    });
  });

  describe('handleTypingStop', () => {
    it('should handle typing stop indicator', () => {
      const mockToEmit = jest.fn();
      (mockSocket.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      // First start typing
      (handler as any).handleTypingStart(mockSocket, mockConversationId.toString());
      
      // Then stop typing
      (handler as any).handleTypingStop(mockSocket, mockConversationId.toString());

      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockToEmit).toHaveBeenCalledWith('typing_stop', {
        conversationId: mockConversationId.toString(),
        patientUserId: mockPatientUserId.toString(),
        timestamp: expect.any(Date),
      });
    });

    it('should remove from typing indicators', () => {
      const mockToEmit = jest.fn();
      (mockSocket.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      // First start typing
      (handler as any).handleTypingStart(mockSocket, mockConversationId.toString());
      expect(handler.getTypingIndicators(mockConversationId.toString())).toContain(mockPatientUserId.toString());
      
      // Then stop typing
      (handler as any).handleTypingStop(mockSocket, mockConversationId.toString());
      expect(handler.getTypingIndicators(mockConversationId.toString())).not.toContain(mockPatientUserId.toString());
    });
  });

  describe('handlePatientMessage', () => {
    let mockMessage: any;
    let messageData: any;

    beforeEach(() => {
      mockMessage = {
        _id: new mongoose.Types.ObjectId(),
        content: { text: 'Hello' },
        senderId: mockPatientUserId,
        createdAt: new Date(),
      };

      messageData = {
        conversationId: mockConversationId.toString(),
        content: 'Hello',
        attachments: [],
      };

      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockResolvedValue(mockMessage);
    });

    it('should handle real-time message sending', async () => {
      await (handler as any).handlePatientMessage(mockSocket, messageData);

      expect(PatientMessagingService.prototype.sendMessage).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId,
        'Hello',
        []
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('message_sent', {
        messageId: mockMessage._id,
        conversationId: mockConversationId.toString(),
        timestamp: expect.any(Date),
      });
    });

    it('should handle message sending errors', async () => {
      const error = new Error('Message sending failed');
      (PatientMessagingService.prototype.sendMessage as jest.Mock).mockRejectedValue(error);

      await expect(
        (handler as any).handlePatientMessage(mockSocket, messageData)
      ).rejects.toThrow('Message sending failed');
    });
  });

  describe('handleMarkAsRead', () => {
    beforeEach(() => {
      (PatientMessagingService.prototype.markAsRead as jest.Mock).mockResolvedValue(undefined);
    });

    it('should handle marking conversation as read', async () => {
      await (handler as any).handleMarkAsRead(mockSocket, mockConversationId.toString());

      expect(PatientMessagingService.prototype.markAsRead).toHaveBeenCalledWith(
        mockConversationId,
        mockPatientUserId
      );
      expect(mockSocket.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('marked_as_read', {
        conversationId: mockConversationId.toString(),
        success: true,
        timestamp: expect.any(Date),
      });
    });

    it('should handle mark as read errors', async () => {
      const error = new Error('Mark as read failed');
      (PatientMessagingService.prototype.markAsRead as jest.Mock).mockRejectedValue(error);

      await expect(
        (handler as any).handleMarkAsRead(mockSocket, mockConversationId.toString())
      ).rejects.toThrow('Mark as read failed');
    });
  });

  describe('broadcastToConversation', () => {
    it('should broadcast message to conversation participants', () => {
      const testData = { message: 'Hello', timestamp: new Date() };
      
      handler.broadcastToConversation(mockConversationId.toString(), 'new_message', testData);

      expect(mockNamespace.to).toHaveBeenCalledWith(`conversation:${mockConversationId}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('new_message', testData);
    });
  });

  describe('sendNotificationToPatient', () => {
    it('should send notification to specific patient', () => {
      const notification = { type: 'new_message', message: 'You have a new message' };
      
      handler.sendNotificationToPatient(mockPatientUserId.toString(), notification);

      expect(mockNamespace.to).toHaveBeenCalledWith(`patient:${mockPatientUserId}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith('notification', notification);
    });
  });

  describe('online status management', () => {
    it('should track patient online status', () => {
      (handler as any).updatePatientOnlineStatus(
        mockPatientUserId.toString(),
        mockWorkplaceId.toString(),
        true
      );

      expect(handler.isPatientOnline(mockPatientUserId.toString())).toBe(true);
      expect(handler.getPatientLastSeen(mockPatientUserId.toString())).toBeInstanceOf(Date);
    });

    it('should get online patients for workspace', () => {
      (handler as any).updatePatientOnlineStatus(
        mockPatientUserId.toString(),
        mockWorkplaceId.toString(),
        true
      );

      const onlinePatients = handler.getOnlinePatientsForWorkspace(mockWorkplaceId.toString());
      expect(onlinePatients).toHaveLength(1);
      expect(onlinePatients[0].patientUserId).toBe(mockPatientUserId.toString());
      expect(onlinePatients[0].isOnline).toBe(true);
    });
  });

  describe('cleanupInactiveConnections', () => {
    it('should disconnect inactive sockets', () => {
      // Set up an inactive socket
      const inactiveSocket = {
        ...mockSocket,
        lastActivity: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
      };
      
      (handler as any).connectedPatients.set(mockPatientUserId.toString(), inactiveSocket);

      handler.cleanupInactiveConnections();

      expect(inactiveSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should not disconnect active sockets', () => {
      // Set up an active socket
      const activeSocket = {
        ...mockSocket,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };
      
      (handler as any).connectedPatients.set(mockPatientUserId.toString(), activeSocket);

      handler.cleanupInactiveConnections();

      expect(activeSocket.disconnect).not.toHaveBeenCalled();
    });
  });
});