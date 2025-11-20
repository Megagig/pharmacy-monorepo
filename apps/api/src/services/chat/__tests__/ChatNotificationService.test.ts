import { ChatNotificationService } from '../ChatNotificationService';
import User from '../../../models/User';
import { notificationService } from '../../notificationService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../models/User');
jest.mock('../../notificationService');
jest.mock('../../../utils/logger');

describe('ChatNotificationService', () => {
  let service: ChatNotificationService;
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockSenderId = new mongoose.Types.ObjectId().toString();
  const mockConversationId = new mongoose.Types.ObjectId().toString();
  const mockMessageId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    service = new ChatNotificationService();
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return default preferences when user not found', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const prefs = await service.getUserPreferences(mockUserId);

      expect(prefs).toEqual({
        newMessage: true,
        mentions: true,
        conversationInvites: true,
        urgentMessages: true,
        muteConversations: [],
        doNotDisturb: false,
      });
    });

    it('should merge user preferences with defaults', async () => {
      const mockUser = {
        get: jest.fn((key: string) => {
          if (key === 'chatPreferences') {
            return {
              muteConversations: ['conv1', 'conv2'],
              doNotDisturb: true,
            };
          }
          if (key === 'notificationPreferences') {
            return {
              newMessage: false,
              mentions: true,
            };
          }
          return {};
        }),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const prefs = await service.getUserPreferences(mockUserId);

      expect(prefs.newMessage).toBe(false);
      expect(prefs.mentions).toBe(true);
      expect(prefs.muteConversations).toEqual(['conv1', 'conv2']);
      expect(prefs.doNotDisturb).toBe(true);
    });
  });

  describe('sendNewMessageNotification', () => {
    it('should not send notification if user has disabled new message notifications', async () => {
      const mockUser = {
        get: jest.fn(() => ({ newMessage: false })),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await service.sendNewMessageNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should not send notification if conversation is muted', async () => {
      const mockUser = {
        get: jest.fn((key: string) => {
          if (key === 'chatPreferences') {
            return { muteConversations: [mockConversationId] };
          }
          return {};
        }),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await service.sendNewMessageNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should not send notification if user is in do not disturb mode', async () => {
      const mockUser = {
        get: jest.fn((key: string) => {
          if (key === 'chatPreferences') {
            return { doNotDisturb: true };
          }
          return {};
        }),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await service.sendNewMessageNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should send notification when all conditions are met', async () => {
      const mockUser = {
        get: jest.fn(() => ({})),
      };

      const mockSender = {
        _id: mockSenderId,
        firstName: 'John',
        lastName: 'Doe',
      };

      (User.findById as jest.Mock).mockImplementation((id) => {
        if (id === mockUserId) {
          return { select: jest.fn().mockResolvedValue(mockUser) };
        }
        if (id === mockSenderId) {
          return { select: jest.fn().mockResolvedValue(mockSender) };
        }
        return { select: jest.fn().mockResolvedValue(null) };
      });

      await service.sendNewMessageNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_message',
          title: 'New message from John Doe',
          content: 'Test message',
          priority: 'normal',
        })
      );
    });
  });

  describe('sendMentionNotification', () => {
    it('should not send notification if mentions are disabled', async () => {
      const mockUser = {
        get: jest.fn((key: string) => {
          if (key === 'notificationPreferences') {
            return { mentions: false };
          }
          return {};
        }),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await service.sendMentionNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should send notification with email enabled for mentions', async () => {
      const mockUser = {
        get: jest.fn(() => ({})),
      };

      const mockSender = {
        _id: mockSenderId,
        firstName: 'Jane',
        lastName: 'Smith',
      };

      (User.findById as jest.Mock).mockImplementation((id) => {
        if (id === mockUserId) {
          return { select: jest.fn().mockResolvedValue(mockUser) };
        }
        if (id === mockSenderId) {
          return { select: jest.fn().mockResolvedValue(mockSender) };
        }
        return { select: jest.fn().mockResolvedValue(null) };
      });

      await service.sendMentionNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'Test message',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mention',
          title: 'Jane Smith mentioned you',
          deliveryChannels: expect.objectContaining({
            email: true,
          }),
        })
      );
    });
  });

  describe('sendUrgentMessageNotification', () => {
    it('should send notification with SMS enabled for urgent messages', async () => {
      const mockUser = {
        get: jest.fn(() => ({})),
      };

      const mockSender = {
        _id: mockSenderId,
        firstName: 'Dr.',
        lastName: 'Emergency',
      };

      (User.findById as jest.Mock).mockImplementation((id) => {
        if (id === mockUserId) {
          return { select: jest.fn().mockResolvedValue(mockUser) };
        }
        if (id === mockSenderId) {
          return { select: jest.fn().mockResolvedValue(mockSender) };
        }
        return { select: jest.fn().mockResolvedValue(null) };
      });

      await service.sendUrgentMessageNotification(
        mockUserId,
        mockSenderId,
        mockConversationId,
        mockMessageId,
        'URGENT: Patient needs attention',
        mockWorkplaceId
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'urgent_message',
          priority: 'urgent',
          deliveryChannels: expect.objectContaining({
            sms: true,
            email: true,
          }),
        })
      );
    });
  });

  describe('muteConversation', () => {
    it('should add conversation to muted list', async () => {
      const mockUser = {
        get: jest.fn(() => ({ muteConversations: [] })),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.muteConversation(mockUserId, mockConversationId);

      expect(mockUser.set).toHaveBeenCalledWith(
        'chatPreferences',
        expect.objectContaining({
          muteConversations: [mockConversationId],
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('unmuteConversation', () => {
    it('should remove conversation from muted list', async () => {
      const mockUser = {
        get: jest.fn(() => ({ muteConversations: [mockConversationId, 'other'] })),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await service.unmuteConversation(mockUserId, mockConversationId);

      expect(mockUser.set).toHaveBeenCalledWith(
        'chatPreferences',
        expect.objectContaining({
          muteConversations: ['other'],
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
