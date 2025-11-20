import mongoose from 'mongoose';
import { ChatMessage } from '../../../models/chat';
import { chatService } from '../../../services/chat';
import User from '../../../models/User';
import { ChatConversation } from '../../../models/chat';

describe('Message Flagging', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;
  let testReporterId: mongoose.Types.ObjectId;
  let testConversationId: mongoose.Types.ObjectId;
  let testMessageId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Setup test data
    testWorkplaceId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
    testReporterId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    // Create test conversation
    const conversation = new ChatConversation({
      type: 'group',
      title: 'Test Conversation',
      participants: [
        { userId: testUserId, role: 'pharmacist', joinedAt: new Date() },
        { userId: testReporterId, role: 'doctor', joinedAt: new Date() },
      ],
      workplaceId: testWorkplaceId,
    });
    await conversation.save();
    testConversationId = conversation._id;

    // Create test message
    const message = new ChatMessage({
      conversationId: testConversationId,
      senderId: testUserId,
      content: {
        text: 'Test message content',
        type: 'text',
      },
      workplaceId: testWorkplaceId,
    });
    await message.save();
    testMessageId = message._id;
  });

  afterEach(async () => {
    // Clean up test data
    await ChatMessage.deleteMany({ workplaceId: testWorkplaceId });
    await ChatConversation.deleteMany({ workplaceId: testWorkplaceId });
  });

  describe('addFlag method', () => {
    it('should add a flag to a message', async () => {
      const message = await ChatMessage.findById(testMessageId);
      expect(message).toBeTruthy();

      message!.addFlag(testReporterId, 'inappropriate', 'This message is inappropriate');
      await message!.save();

      const updatedMessage = await ChatMessage.findById(testMessageId);
      expect(updatedMessage!.isFlagged).toBe(true);
      expect(updatedMessage!.flags).toHaveLength(1);
      expect(updatedMessage!.flags[0].reason).toBe('inappropriate');
      expect(updatedMessage!.flags[0].description).toBe('This message is inappropriate');
      expect(updatedMessage!.flags[0].status).toBe('pending');
    });

    it('should not allow duplicate flags from same user', async () => {
      const message = await ChatMessage.findById(testMessageId);
      
      message!.addFlag(testReporterId, 'spam');
      await message!.save();

      // Try to flag again
      const updatedMessage = await ChatMessage.findById(testMessageId);
      expect(() => {
        updatedMessage!.addFlag(testReporterId, 'harassment');
      }).toThrow('You have already flagged this message');
    });

    it('should reject invalid flag reasons', async () => {
      const message = await ChatMessage.findById(testMessageId);
      
      expect(() => {
        message!.addFlag(testReporterId, 'invalid_reason');
      }).toThrow('Invalid flag reason');
    });
  });

  describe('dismissFlag method', () => {
    it('should dismiss a flag', async () => {
      const message = await ChatMessage.findById(testMessageId);
      message!.addFlag(testReporterId, 'spam');
      await message!.save();

      const flaggedMessage = await ChatMessage.findById(testMessageId);
      const flagId = flaggedMessage!.flags[0]._id.toString();

      const adminId = new mongoose.Types.ObjectId();
      flaggedMessage!.dismissFlag(flagId, adminId, 'Not spam');
      await flaggedMessage!.save();

      const updatedMessage = await ChatMessage.findById(testMessageId);
      expect(updatedMessage!.flags[0].status).toBe('dismissed');
      expect(updatedMessage!.flags[0].reviewedBy?.toString()).toBe(adminId.toString());
      expect(updatedMessage!.flags[0].reviewNotes).toBe('Not spam');
      expect(updatedMessage!.isFlagged).toBe(false);
    });

    it('should not dismiss already reviewed flag', async () => {
      const message = await ChatMessage.findById(testMessageId);
      message!.addFlag(testReporterId, 'spam');
      await message!.save();

      const flaggedMessage = await ChatMessage.findById(testMessageId);
      const flagId = flaggedMessage!.flags[0]._id.toString();

      const adminId = new mongoose.Types.ObjectId();
      flaggedMessage!.dismissFlag(flagId, adminId);
      await flaggedMessage!.save();

      // Try to dismiss again
      const updatedMessage = await ChatMessage.findById(testMessageId);
      expect(() => {
        updatedMessage!.dismissFlag(flagId, adminId);
      }).toThrow('Flag has already been reviewed');
    });
  });

  describe('reportMessage service method', () => {
    it('should report a message successfully', async () => {
      // Mock User.find for admin notification
      jest.spyOn(User, 'find').mockResolvedValue([
        { _id: new mongoose.Types.ObjectId() } as any,
      ]);

      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: testReporterId,
        firstName: 'Test',
        lastName: 'Reporter',
      } as any);

      const reportedMessage = await chatService.reportMessage(
        testMessageId.toString(),
        testReporterId.toString(),
        testWorkplaceId.toString(),
        'harassment',
        'This is harassment'
      );

      expect(reportedMessage.isFlagged).toBe(true);
      expect(reportedMessage.flags).toHaveLength(1);
      expect(reportedMessage.flags[0].reason).toBe('harassment');
    });
  });

  describe('getModerationQueue service method', () => {
    it('should retrieve flagged messages', async () => {
      // Create multiple flagged messages
      const message1 = await ChatMessage.findById(testMessageId);
      message1!.addFlag(testReporterId, 'spam');
      await message1!.save();

      const message2 = new ChatMessage({
        conversationId: testConversationId,
        senderId: testUserId,
        content: { text: 'Another message', type: 'text' },
        workplaceId: testWorkplaceId,
      });
      message2.addFlag(testReporterId, 'inappropriate');
      await message2.save();

      const queue = await chatService.getModerationQueue(testWorkplaceId.toString());

      expect(queue).toHaveLength(2);
      expect(queue.every(msg => msg.isFlagged)).toBe(true);
    });

    it('should filter by status', async () => {
      const message = await ChatMessage.findById(testMessageId);
      message!.addFlag(testReporterId, 'spam');
      await message!.save();

      const flaggedMessage = await ChatMessage.findById(testMessageId);
      const flagId = flaggedMessage!.flags[0]._id.toString();
      flaggedMessage!.dismissFlag(flagId, new mongoose.Types.ObjectId());
      await flaggedMessage!.save();

      const pendingQueue = await chatService.getModerationQueue(testWorkplaceId.toString(), {
        status: 'pending',
      });

      const dismissedQueue = await chatService.getModerationQueue(testWorkplaceId.toString(), {
        status: 'dismissed',
      });

      expect(pendingQueue).toHaveLength(0);
      expect(dismissedQueue).toHaveLength(1);
    });
  });
});
