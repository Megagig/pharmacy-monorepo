import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ChatMessage, { IMessage } from '../Message';
import ChatConversation from '../Conversation';

describe('ChatMessage Model', () => {
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
    await ChatMessage.deleteMany({});
    await ChatConversation.deleteMany({});
  });

  describe('Model Creation', () => {
    it('should create a valid text message', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'Hello, this is a test message',
          type: 'text',
        },
        workplaceId,
      });

      const savedMessage = await message.save();

      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.content.text).toBe('Hello, this is a test message');
      expect(savedMessage.content.type).toBe('text');
      expect(savedMessage.status).toBe('sent');
      expect(savedMessage.isEdited).toBe(false);
      expect(savedMessage.isDeleted).toBe(false);
    });

    it('should fail validation without required fields', async () => {
      const message = new ChatMessage({});

      await expect(message.save()).rejects.toThrow();
    });

    it('should fail validation for text message without text content', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          type: 'text',
        },
        workplaceId,
      });

      await expect(message.save()).rejects.toThrow('Text content is required');
    });

    it('should create a system message', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'User joined the conversation',
          type: 'system',
        },
        workplaceId,
      });

      const savedMessage = await message.save();

      expect(savedMessage.content.type).toBe('system');
      expect(savedMessage.content.text).toBe('User joined the conversation');
    });

    it('should create a message with mentions', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const mentionedUserId = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'Hello @user, how are you?',
          type: 'text',
        },
        mentions: [mentionedUserId],
        workplaceId,
      });

      const savedMessage = await message.save();

      expect(savedMessage.mentions).toHaveLength(1);
      expect(savedMessage.mentions[0]).toEqual(mentionedUserId);
    });
  });

  describe('Instance Methods', () => {
    let message: IMessage;
    let workplaceId: mongoose.Types.ObjectId;
    let conversationId: mongoose.Types.ObjectId;
    let senderId: mongoose.Types.ObjectId;
    let userId1: mongoose.Types.ObjectId;
    let userId2: mongoose.Types.ObjectId;

    beforeEach(async () => {
      workplaceId = new mongoose.Types.ObjectId();
      conversationId = new mongoose.Types.ObjectId();
      senderId = new mongoose.Types.ObjectId();
      userId1 = new mongoose.Types.ObjectId();
      userId2 = new mongoose.Types.ObjectId();

      message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'Test message',
          type: 'text',
        },
        workplaceId,
      });

      await message.save();
    });

    describe('addReaction', () => {
      it('should add a new reaction', () => {
        message.addReaction(userId1, '👍');

        expect(message.reactions).toHaveLength(1);
        expect(message.reactions[0].emoji).toBe('👍');
        expect(message.reactions[0].userIds).toHaveLength(1);
        expect(message.reactions[0].userIds[0]).toEqual(userId1);
      });

      it('should add multiple users to same emoji', () => {
        message.addReaction(userId1, '👍');
        message.addReaction(userId2, '👍');

        expect(message.reactions).toHaveLength(1);
        expect(message.reactions[0].userIds).toHaveLength(2);
      });

      it('should not duplicate user reaction for same emoji', () => {
        message.addReaction(userId1, '👍');
        message.addReaction(userId1, '👍');

        expect(message.reactions).toHaveLength(1);
        expect(message.reactions[0].userIds).toHaveLength(1);
      });

      it('should allow user to react with different emojis', () => {
        message.addReaction(userId1, '👍');
        message.addReaction(userId1, '❤️');

        expect(message.reactions).toHaveLength(2);
      });
    });

    describe('removeReaction', () => {
      beforeEach(() => {
        message.addReaction(userId1, '👍');
        message.addReaction(userId2, '👍');
      });

      it('should remove user from reaction', () => {
        message.removeReaction(userId1, '👍');

        expect(message.reactions[0].userIds).toHaveLength(1);
        expect(message.reactions[0].userIds[0]).toEqual(userId2);
      });

      it('should remove reaction when no users left', () => {
        message.removeReaction(userId1, '👍');
        message.removeReaction(userId2, '👍');

        expect(message.reactions).toHaveLength(0);
      });

      it('should do nothing if user has not reacted', () => {
        const userId3 = new mongoose.Types.ObjectId();
        message.removeReaction(userId3, '👍');

        expect(message.reactions[0].userIds).toHaveLength(2);
      });
    });

    describe('markAsRead', () => {
      it('should mark message as read by user', () => {
        message.markAsRead(userId1);

        expect(message.readBy).toHaveLength(1);
        expect(message.readBy[0].userId).toEqual(userId1);
        expect(message.readBy[0].readAt).toBeDefined();
      });

      it('should update status from sent to delivered', () => {
        message.status = 'sent';
        message.markAsRead(userId1);

        expect(message.status).toBe('delivered');
      });

      it('should update status from delivered to read', () => {
        message.status = 'delivered';
        message.markAsRead(userId1);

        expect(message.status).toBe('read');
      });

      it('should not duplicate read receipts', () => {
        message.markAsRead(userId1);
        message.markAsRead(userId1);

        expect(message.readBy).toHaveLength(1);
      });
    });

    describe('isReadBy', () => {
      it('should return true if user has read message', () => {
        message.markAsRead(userId1);

        expect(message.isReadBy(userId1)).toBe(true);
      });

      it('should return false if user has not read message', () => {
        expect(message.isReadBy(userId1)).toBe(false);
      });
    });

    describe('edit', () => {
      it('should edit message content', () => {
        const newContent = 'Updated message content';
        message.edit(newContent);

        expect(message.content.text).toBe(newContent);
        expect(message.isEdited).toBe(true);
        expect(message.editedAt).toBeDefined();
      });

      it('should throw error if editing after 15 minutes', async () => {
        // Create message with old timestamp
        const oldMessage = new ChatMessage({
          conversationId,
          senderId,
          content: {
            text: 'Old message',
            type: 'text',
          },
          workplaceId,
          createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        });

        await oldMessage.save();

        expect(() => {
          oldMessage.edit('New content');
        }).toThrow('Cannot edit message after 15 minutes');
      });

      it('should throw error if editing deleted message', () => {
        message.softDelete();

        expect(() => {
          message.edit('New content');
        }).toThrow('Cannot edit deleted message');
      });
    });

    describe('softDelete', () => {
      it('should soft delete message', () => {
        message.softDelete();

        expect(message.isDeleted).toBe(true);
        expect(message.deletedAt).toBeDefined();
        expect(message.content.text).toBe('This message was deleted');
      });
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate readCount correctly', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'Test message',
          type: 'text',
        },
        workplaceId,
      });

      await message.save();

      message.markAsRead(userId1);
      message.markAsRead(userId2);

      expect(message.readCount).toBe(2);
    });

    it('should calculate totalReactions correctly', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const conversationId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();

      const message = new ChatMessage({
        conversationId,
        senderId,
        content: {
          text: 'Test message',
          type: 'text',
        },
        workplaceId,
      });

      await message.save();

      message.addReaction(userId1, '👍');
      message.addReaction(userId2, '👍');
      message.addReaction(userId1, '❤️');

      expect(message.totalReactions).toBe(3);
    });
  });

  describe('Static Methods', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let conversationId: mongoose.Types.ObjectId;
    let senderId1: mongoose.Types.ObjectId;
    let senderId2: mongoose.Types.ObjectId;

    beforeEach(async () => {
      workplaceId = new mongoose.Types.ObjectId();
      conversationId = new mongoose.Types.ObjectId();
      senderId1 = new mongoose.Types.ObjectId();
      senderId2 = new mongoose.Types.ObjectId();

      // Create test messages
      await ChatMessage.create([
        {
          conversationId,
          senderId: senderId1,
          content: { text: 'First message', type: 'text' },
          workplaceId,
          createdAt: new Date('2025-01-01'),
        },
        {
          conversationId,
          senderId: senderId2,
          content: { text: 'Second message', type: 'text' },
          workplaceId,
          createdAt: new Date('2025-01-02'),
        },
        {
          conversationId,
          senderId: senderId1,
          content: { text: 'Deleted message', type: 'text' },
          workplaceId,
          isDeleted: true,
          createdAt: new Date('2025-01-03'),
        },
      ]);
    });

    describe('findByConversation', () => {
      it('should find messages for a conversation', async () => {
        const messages = await (ChatMessage as any).findByConversation(conversationId);

        expect(messages).toHaveLength(2); // Excludes deleted
      });

      it('should respect limit parameter', async () => {
        const messages = await (ChatMessage as any).findByConversation(conversationId, {
          limit: 1,
        });

        expect(messages).toHaveLength(1);
      });

      it('should filter by before date', async () => {
        const messages = await (ChatMessage as any).findByConversation(conversationId, {
          before: new Date('2025-01-02'),
        });

        expect(messages).toHaveLength(1);
        expect(messages[0].content.text).toBe('First message');
      });

      it('should filter by after date', async () => {
        const messages = await (ChatMessage as any).findByConversation(conversationId, {
          after: new Date('2025-01-01'),
        });

        expect(messages).toHaveLength(1);
        expect(messages[0].content.text).toBe('Second message');
      });
    });

    describe('searchMessages', () => {
      it('should search messages by text', async () => {
        const messages = await (ChatMessage as any).searchMessages(
          workplaceId,
          'First'
        );

        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].content.text).toContain('First');
      });

      it('should filter by conversationId', async () => {
        const otherConversationId = new mongoose.Types.ObjectId();
        await ChatMessage.create({
          conversationId: otherConversationId,
          senderId: senderId1,
          content: { text: 'Other conversation message', type: 'text' },
          workplaceId,
        });

        const messages = await (ChatMessage as any).searchMessages(
          workplaceId,
          'message',
          { conversationId }
        );

        expect(messages.every((m: IMessage) => 
          m.conversationId.toString() === conversationId.toString()
        )).toBe(true);
      });

      it('should filter by senderId', async () => {
        const messages = await (ChatMessage as any).searchMessages(
          workplaceId,
          'message',
          { senderId: senderId1 }
        );

        expect(messages.every((m: IMessage) => 
          m.senderId.toString() === senderId1.toString()
        )).toBe(true);
      });
    });

    describe('findThreadMessages', () => {
      it('should find messages in a thread', async () => {
        const threadId = new mongoose.Types.ObjectId();

        await ChatMessage.create([
          {
            conversationId,
            senderId: senderId1,
            content: { text: 'Thread reply 1', type: 'text' },
            threadId,
            workplaceId,
          },
          {
            conversationId,
            senderId: senderId2,
            content: { text: 'Thread reply 2', type: 'text' },
            threadId,
            workplaceId,
          },
        ]);

        const messages = await (ChatMessage as any).findThreadMessages(threadId);

        expect(messages).toHaveLength(2);
      });

      it('should sort thread messages chronologically', async () => {
        const threadId = new mongoose.Types.ObjectId();

        await ChatMessage.create([
          {
            conversationId,
            senderId: senderId1,
            content: { text: 'Reply 2', type: 'text' },
            threadId,
            workplaceId,
            createdAt: new Date('2025-01-02'),
          },
          {
            conversationId,
            senderId: senderId2,
            content: { text: 'Reply 1', type: 'text' },
            threadId,
            workplaceId,
            createdAt: new Date('2025-01-01'),
          },
        ]);

        const messages = await (ChatMessage as any).findThreadMessages(threadId);

        expect(messages[0].content.text).toBe('Reply 1');
        expect(messages[1].content.text).toBe('Reply 2');
      });
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes defined', () => {
      const indexes = ChatMessage.schema.indexes();
      
      expect(indexes).toBeDefined();
      expect(indexes.length).toBeGreaterThan(0);
      
      // Check for key compound indexes
      const hasConversationDateIndex = indexes.some(
        (index: any) => index[0].conversationId && index[0].createdAt
      );
      
      expect(hasConversationDateIndex).toBe(true);
    });
  });
});
