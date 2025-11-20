import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ChatService } from '../ChatService';
import { ChatConversation } from '../../../models/chat';
import User from '../../../models/User';
import Patient from '../../../models/Patient';
import { notificationService } from '../../notificationService';

// Mock notification service
jest.mock('../../notificationService', () => ({
  notificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
  },
}));

describe('ChatService - Conversation Management', () => {
  let mongoServer: MongoMemoryServer;
  let chatService: ChatService;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let doctorId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let patient: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    chatService = new ChatService();
    workplaceId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();

    // Create test users
    await User.create([
      {
        _id: pharmacistId,
        firstName: 'John',
        lastName: 'Pharmacist',
        email: 'pharmacist@test.com',
        password: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
      },
      {
        _id: doctorId,
        firstName: 'Jane',
        lastName: 'Doctor',
        email: 'doctor@test.com',
        password: 'hashedpassword',
        role: 'doctor',
        workplaceId,
      },
    ]);

    // Create test patient
    patient = await Patient.create({
      _id: patientId,
      firstName: 'Test',
      lastName: 'Patient',
      mrn: 'MRN123',
      workplaceId,
    });

    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ChatConversation.deleteMany({});
    await User.deleteMany({});
    await Patient.deleteMany({});
  });

  describe('createConversation', () => {
    it('should create a direct conversation', async () => {
      const data = {
        type: 'direct' as const,
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
          { userId: doctorId.toString(), role: 'doctor' as const },
        ],
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      const conversation = await chatService.createConversation(data);

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toHaveLength(2);
      expect(conversation.status).toBe('active');
      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    });

    it('should create a group conversation', async () => {
      const userId3 = new mongoose.Types.ObjectId();
      await User.create({
        _id: userId3,
        firstName: 'Third',
        lastName: 'User',
        email: 'user3@test.com',
        password: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
      });

      const data = {
        type: 'group' as const,
        title: 'Team Discussion',
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
          { userId: doctorId.toString(), role: 'doctor' as const },
          { userId: userId3.toString(), role: 'pharmacist' as const },
        ],
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      const conversation = await chatService.createConversation(data);

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe('group');
      expect(conversation.title).toBe('Team Discussion');
      expect(conversation.participants).toHaveLength(3);
    });

    it('should create a patient query conversation', async () => {
      const data = {
        type: 'patient_query' as const,
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
        ],
        patientId: patientId.toString(),
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      const conversation = await chatService.createConversation(data);

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe('patient_query');
      expect(conversation.patientId?.toString()).toBe(patientId.toString());
    });

    it('should add creator to participants if not included', async () => {
      const data = {
        type: 'direct' as const,
        participants: [
          { userId: doctorId.toString(), role: 'doctor' as const },
        ],
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      const conversation = await chatService.createConversation(data);

      expect(conversation.participants).toHaveLength(2);
      expect(
        conversation.participants.some(p => p.userId.toString() === pharmacistId.toString())
      ).toBe(true);
    });

    it('should throw error for direct conversation with wrong participant count', async () => {
      const data = {
        type: 'direct' as const,
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
        ],
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      await expect(chatService.createConversation(data)).rejects.toThrow(
        'Direct conversations must have exactly 2 participants'
      );
    });

    it('should throw error if participant not found', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();

      const data = {
        type: 'direct' as const,
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
          { userId: fakeUserId.toString(), role: 'doctor' as const },
        ],
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      await expect(chatService.createConversation(data)).rejects.toThrow(
        'Some participants not found or not in the same workplace'
      );
    });

    it('should throw error if patient not found for patient_query', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();

      const data = {
        type: 'patient_query' as const,
        participants: [
          { userId: pharmacistId.toString(), role: 'pharmacist' as const },
        ],
        patientId: fakePatientId.toString(),
        createdBy: pharmacistId.toString(),
        workplaceId: workplaceId.toString(),
      };

      await expect(chatService.createConversation(data)).rejects.toThrow(
        'Patient not found or not in the same workplace'
      );
    });
  });

  describe('getConversations', () => {
    beforeEach(async () => {
      // Create test conversations
      await ChatConversation.create([
        {
          type: 'direct',
          participants: [
            { userId: pharmacistId, role: 'pharmacist' },
            { userId: doctorId, role: 'doctor' },
          ],
          workplaceId,
          status: 'active',
        },
        {
          type: 'group',
          title: 'Team Chat',
          participants: [
            { userId: pharmacistId, role: 'pharmacist' },
            { userId: doctorId, role: 'doctor' },
          ],
          workplaceId,
          status: 'active',
        },
        {
          type: 'patient_query',
          participants: [{ userId: pharmacistId, role: 'pharmacist' }],
          patientId,
          workplaceId,
          status: 'archived',
        },
      ]);
    });

    it('should get all active conversations for user', async () => {
      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(conversations).toHaveLength(2); // Excludes archived by default
    });

    it('should filter by type', async () => {
      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString(),
        { type: 'direct' }
      );

      expect(conversations).toHaveLength(1);
      expect(conversations[0].type).toBe('direct');
    });

    it('should filter by status', async () => {
      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString(),
        { status: 'archived' }
      );

      expect(conversations).toHaveLength(1);
      expect(conversations[0].status).toBe('archived');
    });

    it('should filter by patientId', async () => {
      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString(),
        { patientId: patientId.toString() }
      );

      expect(conversations).toHaveLength(1);
      expect(conversations[0].patientId?.toString()).toBe(patientId.toString());
    });

    it('should respect limit and offset', async () => {
      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString(),
        { limit: 1, offset: 0 }
      );

      expect(conversations).toHaveLength(1);
    });

    it('should sort pinned conversations first', async () => {
      // Pin one conversation
      const conv = await ChatConversation.findOne({ type: 'direct' });
      if (conv) {
        conv.isPinned = true;
        await conv.save();
      }

      const conversations = await chatService.getConversations(
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(conversations[0].isPinned).toBe(true);
    });
  });

  describe('getConversation', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should get conversation by ID', async () => {
      const conversation = await chatService.getConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(conversation).toBeDefined();
      expect(conversation?._id.toString()).toBe(conversationId.toString());
    });

    it('should return null for non-participant', async () => {
      const otherUserId = new mongoose.Types.ObjectId();

      const conversation = await chatService.getConversation(
        conversationId.toString(),
        otherUserId.toString(),
        workplaceId.toString()
      );

      expect(conversation).toBeNull();
    });

    it('should return null for non-existent conversation', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const conversation = await chatService.getConversation(
        fakeId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(conversation).toBeNull();
    });
  });

  describe('updateConversation', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'group',
        title: 'Original Title',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should update conversation title', async () => {
      const updated = await chatService.updateConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        { title: 'New Title' }
      );

      expect(updated?.title).toBe('New Title');
    });

    it('should update conversation status', async () => {
      const updated = await chatService.updateConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        { status: 'resolved' }
      );

      expect(updated?.status).toBe('resolved');
    });

    it('should update isPinned', async () => {
      const updated = await chatService.updateConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        { isPinned: true }
      );

      expect(updated?.isPinned).toBe(true);
    });

    it('should throw error for insufficient permissions', async () => {
      // Create patient user
      const patientUserId = new mongoose.Types.ObjectId();
      await User.create({
        _id: patientUserId,
        firstName: 'Patient',
        lastName: 'User',
        email: 'patient@test.com',
        password: 'hashedpassword',
        role: 'patient',
        workplaceId,
      });

      // Add patient to conversation
      const conv = await ChatConversation.findById(conversationId);
      conv?.addParticipant(patientUserId, 'patient');
      await conv?.save();

      await expect(
        chatService.updateConversation(
          conversationId.toString(),
          patientUserId.toString(),
          workplaceId.toString(),
          { title: 'Hacked Title' }
        )
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('pinConversation', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should pin conversation', async () => {
      const updated = await chatService.pinConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(updated?.isPinned).toBe(true);
    });
  });

  describe('archiveConversation', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should archive conversation', async () => {
      const updated = await chatService.archiveConversation(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(updated?.status).toBe('archived');
    });
  });

  describe('addParticipant', () => {
    let conversationId: mongoose.Types.ObjectId;
    let newUserId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'group',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      newUserId = new mongoose.Types.ObjectId();
      await User.create({
        _id: newUserId,
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@test.com',
        password: 'hashedpassword',
        role: 'pharmacist',
        workplaceId,
      });
    });

    it('should add participant to conversation', async () => {
      await chatService.addParticipant(
        conversationId.toString(),
        newUserId.toString(),
        'pharmacist',
        pharmacistId.toString(),
        workplaceId.toString()
      );

      const conversation = await ChatConversation.findById(conversationId);
      expect(conversation?.participants).toHaveLength(3);
      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it('should throw error for insufficient permissions', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      await User.create({
        _id: patientUserId,
        firstName: 'Patient',
        lastName: 'User',
        email: 'patient@test.com',
        password: 'hashedpassword',
        role: 'patient',
        workplaceId,
      });

      const conv = await ChatConversation.findById(conversationId);
      conv?.addParticipant(patientUserId, 'patient');
      await conv?.save();

      await expect(
        chatService.addParticipant(
          conversationId.toString(),
          newUserId.toString(),
          'pharmacist',
          patientUserId.toString(),
          workplaceId.toString()
        )
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('removeParticipant', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'group',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should remove participant from conversation', async () => {
      await chatService.removeParticipant(
        conversationId.toString(),
        doctorId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      const conversation = await ChatConversation.findById(conversationId);
      const activeParticipants = conversation?.participants.filter(p => !p.leftAt);
      expect(activeParticipants).toHaveLength(1);
    });

    it('should allow user to remove themselves', async () => {
      await chatService.removeParticipant(
        conversationId.toString(),
        doctorId.toString(),
        doctorId.toString(),
        workplaceId.toString()
      );

      const conversation = await ChatConversation.findById(conversationId);
      const activeParticipants = conversation?.participants.filter(p => !p.leftAt);
      expect(activeParticipants).toHaveLength(1);
    });
  });

  describe('markConversationAsRead', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      // Set some unread count
      conv.unreadCounts.set(pharmacistId.toString(), 5);
      await conv.save();
    });

    it('should mark conversation as read', async () => {
      await chatService.markConversationAsRead(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      const conversation = await ChatConversation.findById(conversationId);
      expect(conversation?.unreadCounts.get(pharmacistId.toString())).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(async () => {
      // Create conversations with unread counts
      const conv1 = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conv1.unreadCounts.set(pharmacistId.toString(), 3);
      await conv1.save();

      const conv2 = await ChatConversation.create({
        type: 'group',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conv2.unreadCounts.set(pharmacistId.toString(), 5);
      await conv2.save();
    });

    it('should get total unread count for user', async () => {
      const unreadCount = await chatService.getUnreadCount(
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(unreadCount).toBe(8);
    });
  });
});

  // ==================== MESSAGE OPERATIONS TESTS ====================

  describe('sendMessage', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;
    });

    it('should send a text message', async () => {
      const data = {
        conversationId: conversationId.toString(),
        senderId: pharmacistId.toString(),
        content: {
          text: 'Hello, this is a test message',
          type: 'text' as const,
        },
        workplaceId: workplaceId.toString(),
      };

      const message = await chatService.sendMessage(data);

      expect(message).toBeDefined();
      expect(message.content.text).toBe('Hello, this is a test message');
      expect(message.content.type).toBe('text');
      expect(message.senderId.toString()).toBe(pharmacistId.toString());
    });

    it('should send a message with mentions', async () => {
      const data = {
        conversationId: conversationId.toString(),
        senderId: pharmacistId.toString(),
        content: {
          text: 'Hello @doctor',
          type: 'text' as const,
        },
        mentions: [doctorId.toString()],
        workplaceId: workplaceId.toString(),
      };

      const message = await chatService.sendMessage(data);

      expect(message.mentions).toHaveLength(1);
      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it('should send a threaded reply', async () => {
      // Create parent message
      const parentMessage = await ChatMessage.create({
        conversationId,
        senderId: doctorId,
        content: { text: 'Parent message', type: 'text' },
        workplaceId,
      });

      const data = {
        conversationId: conversationId.toString(),
        senderId: pharmacistId.toString(),
        content: {
          text: 'Reply to parent',
          type: 'text' as const,
        },
        parentMessageId: parentMessage._id.toString(),
        workplaceId: workplaceId.toString(),
      };

      const message = await chatService.sendMessage(data);

      expect(message.parentMessageId?.toString()).toBe(parentMessage._id.toString());
    });

    it('should throw error if conversation not found', async () => {
      const fakeConvId = new mongoose.Types.ObjectId();

      const data = {
        conversationId: fakeConvId.toString(),
        senderId: pharmacistId.toString(),
        content: {
          text: 'Test',
          type: 'text' as const,
        },
        workplaceId: workplaceId.toString(),
      };

      await expect(chatService.sendMessage(data)).rejects.toThrow(
        'Conversation not found or access denied'
      );
    });

    it('should throw error if parent message not found', async () => {
      const fakeMessageId = new mongoose.Types.ObjectId();

      const data = {
        conversationId: conversationId.toString(),
        senderId: pharmacistId.toString(),
        content: {
          text: 'Reply',
          type: 'text' as const,
        },
        parentMessageId: fakeMessageId.toString(),
        workplaceId: workplaceId.toString(),
      };

      await expect(chatService.sendMessage(data)).rejects.toThrow(
        'Parent message not found'
      );
    });
  });

  describe('getMessages', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      // Create test messages
      await ChatMessage.create([
        {
          conversationId,
          senderId: pharmacistId,
          content: { text: 'Message 1', type: 'text' },
          workplaceId,
          createdAt: new Date('2025-01-01'),
        },
        {
          conversationId,
          senderId: doctorId,
          content: { text: 'Message 2', type: 'text' },
          workplaceId,
          createdAt: new Date('2025-01-02'),
        },
        {
          conversationId,
          senderId: pharmacistId,
          content: { text: 'Deleted message', type: 'text' },
          workplaceId,
          isDeleted: true,
          createdAt: new Date('2025-01-03'),
        },
      ]);
    });

    it('should get messages for conversation', async () => {
      const messages = await chatService.getMessages(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      expect(messages).toHaveLength(2); // Excludes deleted
    });

    it('should respect pagination', async () => {
      const messages = await chatService.getMessages(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        { limit: 1 }
      );

      expect(messages).toHaveLength(1);
    });

    it('should filter by before date', async () => {
      const messages = await chatService.getMessages(
        conversationId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        { before: new Date('2025-01-02') }
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].content.text).toBe('Message 1');
    });

    it('should throw error if user not participant', async () => {
      const otherUserId = new mongoose.Types.ObjectId();

      await expect(
        chatService.getMessages(
          conversationId.toString(),
          otherUserId.toString(),
          workplaceId.toString()
        )
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('editMessage', () => {
    let conversationId: mongoose.Types.ObjectId;
    let messageId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      const message = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Original message', type: 'text' },
        workplaceId,
      });
      messageId = message._id;
    });

    it('should edit message content', async () => {
      const edited = await chatService.editMessage(
        messageId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        'Updated message'
      );

      expect(edited.content.text).toBe('Updated message');
      expect(edited.isEdited).toBe(true);
      expect(edited.editedAt).toBeDefined();
    });

    it('should throw error if not message owner', async () => {
      await expect(
        chatService.editMessage(
          messageId.toString(),
          doctorId.toString(),
          workplaceId.toString(),
          'Hacked message'
        )
      ).rejects.toThrow('Message not found or not authorized to edit');
    });

    it('should throw error if editing after 15 minutes', async () => {
      // Create old message
      const oldMessage = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Old message', type: 'text' },
        workplaceId,
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      });

      await expect(
        chatService.editMessage(
          oldMessage._id.toString(),
          pharmacistId.toString(),
          workplaceId.toString(),
          'New content'
        )
      ).rejects.toThrow('Cannot edit message after 15 minutes');
    });
  });

  describe('deleteMessage', () => {
    let conversationId: mongoose.Types.ObjectId;
    let messageId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      const message = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Message to delete', type: 'text' },
        workplaceId,
      });
      messageId = message._id;
    });

    it('should delete own message', async () => {
      await chatService.deleteMessage(
        messageId.toString(),
        pharmacistId.toString(),
        workplaceId.toString()
      );

      const message = await ChatMessage.findById(messageId);
      expect(message?.isDeleted).toBe(true);
      expect(message?.content.text).toBe('This message was deleted');
    });

    it('should allow admin to delete any message', async () => {
      const adminId = new mongoose.Types.ObjectId();
      await User.create({
        _id: adminId,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@test.com',
        password: 'hashedpassword',
        role: 'admin',
        workplaceId,
      });

      const conv = await ChatConversation.findById(conversationId);
      conv?.addParticipant(adminId, 'admin');
      await conv?.save();

      await chatService.deleteMessage(
        messageId.toString(),
        adminId.toString(),
        workplaceId.toString()
      );

      const message = await ChatMessage.findById(messageId);
      expect(message?.isDeleted).toBe(true);
    });

    it('should throw error if not authorized', async () => {
      await expect(
        chatService.deleteMessage(
          messageId.toString(),
          doctorId.toString(),
          workplaceId.toString()
        )
      ).rejects.toThrow('Not authorized to delete this message');
    });
  });

  // ==================== REACTIONS AND READ RECEIPTS TESTS ====================

  describe('addReaction', () => {
    let conversationId: mongoose.Types.ObjectId;
    let messageId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      const message = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Test message', type: 'text' },
        workplaceId,
      });
      messageId = message._id;
    });

    it('should add reaction to message', async () => {
      const message = await chatService.addReaction(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString(),
        '👍'
      );

      expect(message.reactions).toHaveLength(1);
      expect(message.reactions[0].emoji).toBe('👍');
      expect(message.reactions[0].userIds).toHaveLength(1);
    });

    it('should add multiple users to same emoji', async () => {
      await chatService.addReaction(
        messageId.toString(),
        pharmacistId.toString(),
        workplaceId.toString(),
        '👍'
      );

      const message = await chatService.addReaction(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString(),
        '👍'
      );

      expect(message.reactions).toHaveLength(1);
      expect(message.reactions[0].userIds).toHaveLength(2);
    });

    it('should throw error if user not participant', async () => {
      const otherUserId = new mongoose.Types.ObjectId();

      await expect(
        chatService.addReaction(
          messageId.toString(),
          otherUserId.toString(),
          workplaceId.toString(),
          '👍'
        )
      ).rejects.toThrow('Not authorized to react to this message');
    });
  });

  describe('removeReaction', () => {
    let conversationId: mongoose.Types.ObjectId;
    let messageId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      const message = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Test message', type: 'text' },
        workplaceId,
      });
      messageId = message._id;

      // Add reaction
      await chatService.addReaction(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString(),
        '👍'
      );
    });

    it('should remove reaction from message', async () => {
      const message = await chatService.removeReaction(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString(),
        '👍'
      );

      expect(message.reactions).toHaveLength(0);
    });
  });

  describe('markMessageAsRead', () => {
    let conversationId: mongoose.Types.ObjectId;
    let messageId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      const message = await ChatMessage.create({
        conversationId,
        senderId: pharmacistId,
        content: { text: 'Test message', type: 'text' },
        workplaceId,
      });
      messageId = message._id;
    });

    it('should mark message as read', async () => {
      await chatService.markMessageAsRead(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString()
      );

      const message = await ChatMessage.findById(messageId);
      expect(message?.readBy).toHaveLength(1);
      expect(message?.readBy[0].userId.toString()).toBe(doctorId.toString());
    });

    it('should update conversation unread count', async () => {
      await chatService.markMessageAsRead(
        messageId.toString(),
        doctorId.toString(),
        workplaceId.toString()
      );

      const conversation = await ChatConversation.findById(conversationId);
      expect(conversation?.unreadCounts.get(doctorId.toString())).toBe(0);
    });
  });

  describe('markConversationMessagesAsRead', () => {
    let conversationId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const conv = await ChatConversation.create({
        type: 'direct',
        participants: [
          { userId: pharmacistId, role: 'pharmacist' },
          { userId: doctorId, role: 'doctor' },
        ],
        workplaceId,
      });
      conversationId = conv._id;

      // Create multiple messages
      await ChatMessage.create([
        {
          conversationId,
          senderId: pharmacistId,
          content: { text: 'Message 1', type: 'text' },
          workplaceId,
        },
        {
          conversationId,
          senderId: pharmacistId,
          content: { text: 'Message 2', type: 'text' },
          workplaceId,
        },
      ]);
    });

    it('should mark all messages as read', async () => {
      await chatService.markConversationMessagesAsRead(
        conversationId.toString(),
        doctorId.toString(),
        workplaceId.toString()
      );

      const messages = await ChatMessage.find({ conversationId });
      expect(messages.every(m => m.isReadBy(doctorId))).toBe(true);
    });
  });
