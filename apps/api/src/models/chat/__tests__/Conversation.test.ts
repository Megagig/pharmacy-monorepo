import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ChatConversation, { IConversation } from '../Conversation';

describe('ChatConversation Model', () => {
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
    await ChatConversation.deleteMany({});
  });

  describe('Model Creation', () => {
    it('should create a valid conversation with required fields', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();

      const conversation = new ChatConversation({
        type: 'direct',
        participants: [
          { userId: userId1, role: 'pharmacist' },
          { userId: userId2, role: 'patient' },
        ],
        workplaceId,
      });

      const savedConversation = await conversation.save();

      expect(savedConversation._id).toBeDefined();
      expect(savedConversation.type).toBe('direct');
      expect(savedConversation.participants).toHaveLength(2);
      expect(savedConversation.status).toBe('active');
      expect(savedConversation.isPinned).toBe(false);
      expect(savedConversation.title).toBe('Direct Message');
    });

    it('should fail validation without required fields', async () => {
      const conversation = new ChatConversation({});

      await expect(conversation.save()).rejects.toThrow();
    });

    it('should fail validation with invalid conversation type', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const conversation = new ChatConversation({
        type: 'invalid_type',
        participants: [{ userId, role: 'pharmacist' }],
        workplaceId,
      });

      await expect(conversation.save()).rejects.toThrow();
    });

    it('should fail validation with too many participants', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const participants = Array.from({ length: 51 }, () => ({
        userId: new mongoose.Types.ObjectId(),
        role: 'pharmacist',
      }));

      const conversation = new ChatConversation({
        type: 'group',
        participants,
        workplaceId,
      });

      await expect(conversation.save()).rejects.toThrow();
    });

    it('should require patientId for patient_query type', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const conversation = new ChatConversation({
        type: 'patient_query',
        participants: [{ userId, role: 'pharmacist' }],
        workplaceId,
      });

      await expect(conversation.save()).rejects.toThrow('Patient ID is required');
    });

    it('should require prescriptionId for prescription_discussion type', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const patientId = new mongoose.Types.ObjectId();

      const conversation = new ChatConversation({
        type: 'prescription_discussion',
        participants: [{ userId, role: 'pharmacist' }],
        patientId,
        workplaceId,
      });

      await expect(conversation.save()).rejects.toThrow('Prescription ID is required');
    });
  });

  describe('Instance Methods', () => {
    let conversation: IConversation;
    let workplaceId: mongoose.Types.ObjectId;
    let userId1: mongoose.Types.ObjectId;
    let userId2: mongoose.Types.ObjectId;
    let userId3: mongoose.Types.ObjectId;

    beforeEach(async () => {
      workplaceId = new mongoose.Types.ObjectId();
      userId1 = new mongoose.Types.ObjectId();
      userId2 = new mongoose.Types.ObjectId();
      userId3 = new mongoose.Types.ObjectId();

      conversation = new ChatConversation({
        type: 'group',
        title: 'Test Group',
        participants: [
          { userId: userId1, role: 'pharmacist' },
          { userId: userId2, role: 'doctor' },
        ],
        workplaceId,
      });

      await conversation.save();
    });

    describe('addParticipant', () => {
      it('should add a new participant', () => {
        conversation.addParticipant(userId3, 'patient');

        expect(conversation.participants).toHaveLength(3);
        expect(conversation.participants[2].userId).toEqual(userId3);
        expect(conversation.participants[2].role).toBe('patient');
        expect(conversation.unreadCounts.get(userId3.toString())).toBe(0);
      });

      it('should throw error when adding existing participant', () => {
        expect(() => {
          conversation.addParticipant(userId1, 'pharmacist');
        }).toThrow('User is already a participant');
      });
    });

    describe('removeParticipant', () => {
      it('should mark participant as left', () => {
        conversation.removeParticipant(userId1);

        const participant = conversation.participants.find(
          p => p.userId.toString() === userId1.toString()
        );

        expect(participant?.leftAt).toBeDefined();
        expect(conversation.unreadCounts.has(userId1.toString())).toBe(false);
      });

      it('should throw error when removing non-existent participant', () => {
        expect(() => {
          conversation.removeParticipant(userId3);
        }).toThrow('User is not an active participant');
      });
    });

    describe('updateLastMessage', () => {
      it('should update last message info', () => {
        const messageText = 'Hello, this is a test message';
        conversation.updateLastMessage(messageText, userId1);

        expect(conversation.lastMessage).toBeDefined();
        expect(conversation.lastMessage?.text).toBe(messageText);
        expect(conversation.lastMessage?.senderId).toEqual(userId1);
        expect(conversation.lastMessage?.timestamp).toBeDefined();
      });

      it('should truncate long messages to 500 characters', () => {
        const longMessage = 'a'.repeat(600);
        conversation.updateLastMessage(longMessage, userId1);

        expect(conversation.lastMessage?.text).toHaveLength(500);
      });
    });

    describe('incrementUnreadCount', () => {
      it('should increment unread count for all participants except sender', () => {
        conversation.incrementUnreadCount(userId1);

        expect(conversation.unreadCounts.get(userId1.toString())).toBe(0);
        expect(conversation.unreadCounts.get(userId2.toString())).toBe(1);
      });

      it('should increment unread count for all participants when no exclusion', () => {
        conversation.incrementUnreadCount();

        expect(conversation.unreadCounts.get(userId1.toString())).toBe(1);
        expect(conversation.unreadCounts.get(userId2.toString())).toBe(1);
      });

      it('should not increment for participants who have left', () => {
        conversation.removeParticipant(userId2);
        conversation.incrementUnreadCount(userId1);

        expect(conversation.unreadCounts.has(userId2.toString())).toBe(false);
      });
    });

    describe('markAsRead', () => {
      it('should reset unread count to zero', () => {
        conversation.unreadCounts.set(userId1.toString(), 5);
        conversation.markAsRead(userId1);

        expect(conversation.unreadCounts.get(userId1.toString())).toBe(0);
      });
    });

    describe('hasParticipant', () => {
      it('should return true for active participant', () => {
        expect(conversation.hasParticipant(userId1)).toBe(true);
      });

      it('should return false for non-participant', () => {
        expect(conversation.hasParticipant(userId3)).toBe(false);
      });

      it('should return false for participant who has left', () => {
        conversation.removeParticipant(userId1);
        expect(conversation.hasParticipant(userId1)).toBe(false);
      });
    });

    describe('getParticipantRole', () => {
      it('should return role for active participant', () => {
        expect(conversation.getParticipantRole(userId1)).toBe('pharmacist');
      });

      it('should return null for non-participant', () => {
        expect(conversation.getParticipantRole(userId3)).toBeNull();
      });

      it('should return null for participant who has left', () => {
        conversation.removeParticipant(userId1);
        expect(conversation.getParticipantRole(userId1)).toBeNull();
      });
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate activeParticipants correctly', async () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      const userId3 = new mongoose.Types.ObjectId();

      const conversation = new ChatConversation({
        type: 'group',
        participants: [
          { userId: userId1, role: 'pharmacist' },
          { userId: userId2, role: 'doctor' },
          { userId: userId3, role: 'patient', leftAt: new Date() },
        ],
        workplaceId,
      });

      await conversation.save();

      expect(conversation.activeParticipants).toHaveLength(2);
      expect(conversation.participantCount).toBe(2);
    });
  });

  describe('Static Methods', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let userId1: mongoose.Types.ObjectId;
    let userId2: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      workplaceId = new mongoose.Types.ObjectId();
      userId1 = new mongoose.Types.ObjectId();
      userId2 = new mongoose.Types.ObjectId();
      patientId = new mongoose.Types.ObjectId();

      // Create test conversations
      await ChatConversation.create([
        {
          type: 'direct',
          participants: [
            { userId: userId1, role: 'pharmacist' },
            { userId: userId2, role: 'patient' },
          ],
          workplaceId,
          status: 'active',
        },
        {
          type: 'patient_query',
          participants: [{ userId: userId1, role: 'pharmacist' }],
          patientId,
          workplaceId,
          status: 'active',
        },
        {
          type: 'group',
          participants: [{ userId: userId2, role: 'doctor' }],
          workplaceId,
          status: 'archived',
        },
      ]);
    });

    describe('findByParticipant', () => {
      it('should find conversations for a participant', async () => {
        const conversations = await (ChatConversation as any).findByParticipant(
          userId1,
          workplaceId
        );

        expect(conversations).toHaveLength(2);
      });

      it('should filter by status', async () => {
        const conversations = await (ChatConversation as any).findByParticipant(
          userId1,
          workplaceId,
          { status: 'active' }
        );

        expect(conversations).toHaveLength(2);
        expect(conversations.every((c: IConversation) => c.status === 'active')).toBe(true);
      });

      it('should filter by type', async () => {
        const conversations = await (ChatConversation as any).findByParticipant(
          userId1,
          workplaceId,
          { type: 'patient_query' }
        );

        expect(conversations).toHaveLength(1);
        expect(conversations[0].type).toBe('patient_query');
      });
    });

    describe('findByPatient', () => {
      it('should find conversations for a patient', async () => {
        const conversations = await (ChatConversation as any).findByPatient(
          patientId,
          workplaceId
        );

        expect(conversations).toHaveLength(1);
        expect(conversations[0].patientId.toString()).toBe(patientId.toString());
      });

      it('should exclude archived conversations', async () => {
        await ChatConversation.create({
          type: 'patient_query',
          participants: [{ userId: userId1, role: 'pharmacist' }],
          patientId,
          workplaceId,
          status: 'archived',
        });

        const conversations = await (ChatConversation as any).findByPatient(
          patientId,
          workplaceId
        );

        expect(conversations).toHaveLength(1);
        expect(conversations.every((c: IConversation) => c.status !== 'archived')).toBe(true);
      });
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes defined', () => {
      const indexes = ChatConversation.schema.indexes();
      
      expect(indexes).toBeDefined();
      expect(indexes.length).toBeGreaterThan(0);
      
      // Check for key compound indexes
      const hasWorkplaceParticipantIndex = indexes.some(
        (index: any) => 
          index[0].workplaceId && 
          index[0]['participants.userId'] && 
          index[0].updatedAt
      );
      
      expect(hasWorkplaceParticipantIndex).toBe(true);
    });
  });
});
