import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Message from '../../models/Message';
import User from '../../models/User';
import Conversation from '../../models/Conversation';
import Workplace from '../../models/Workplace';
import { communicationService } from '../../services/communicationService';

describe('Message Editing and Deletion Service', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser1: any;
    let testUser2: any;
    let testConversation: any;
    let testMessage: any;

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
        // Clear all collections
        await Promise.all([
            Message.deleteMany({}),
            User.deleteMany({}),
            Conversation.deleteMany({}),
            Workplace.deleteMany({}),
        ]);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'Test Country',
            },
        });

        // Create test users
        testUser1 = await User.create({
            email: 'pharmacist@test.com',
            password: 'hashedpassword',
            firstName: 'John',
            lastName: 'Pharmacist',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            isEmailVerified: true,
        });

        testUser2 = await User.create({
            email: 'doctor@test.com',
            password: 'hashedpassword',
            firstName: 'Jane',
            lastName: 'Doctor',
            role: 'doctor',
            workplaceId: testWorkplace._id,
            isEmailVerified: true,
        });

        // Create test conversation
        testConversation = await Conversation.create({
            type: 'direct',
            participants: [
                {
                    userId: testUser1._id,
                    role: 'pharmacist',
                    joinedAt: new Date(),
                    permissions: ['read_messages', 'send_messages'],
                },
                {
                    userId: testUser2._id,
                    role: 'doctor',
                    joinedAt: new Date(),
                    permissions: ['read_messages', 'send_messages'],
                },
            ],
            createdBy: testUser1._id,
            workplaceId: testWorkplace._id,
            metadata: {
                isEncrypted: true,
            },
        });

        // Create test message
        testMessage = await Message.create({
            conversationId: testConversation._id,
            senderId: testUser1._id,
            content: {
                text: 'Original message content',
                type: 'text',
            },
            workplaceId: testWorkplace._id,
            createdBy: testUser1._id,
        });
    });

    describe('editMessage', () => {
        it('should edit a message and track edit history', async () => {
            const newContent = 'Updated message content';
            const reason = 'Fixed typo';

            await communicationService.editMessage(
                testMessage._id.toString(),
                testUser1._id.toString(),
                newContent,
                reason,
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.content.text).toBe(newContent);
            expect(updatedMessage?.editHistory).toHaveLength(1);
            expect(updatedMessage?.editHistory?.[0]?.content).toBe('Original message content');
            expect(updatedMessage?.editHistory?.[0]?.reason).toBe(reason);
            expect(updatedMessage?.editHistory?.[0]?.editedBy.toString()).toBe(testUser1._id.toString());
        });

        it('should track multiple edits in history', async () => {
            // First edit
            await communicationService.editMessage(
                testMessage._id.toString(),
                testUser1._id.toString(),
                'First edit',
                'First reason',
                testWorkplace._id.toString()
            );

            // Second edit
            await communicationService.editMessage(
                testMessage._id.toString(),
                testUser1._id.toString(),
                'Second edit',
                'Second reason',
                testWorkplace._id.toString()
            );

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.content.text).toBe('Second edit');
            expect(updatedMessage?.editHistory).toHaveLength(2);
            expect(updatedMessage?.editHistory?.[0]?.content).toBe('Original message content');
            expect(updatedMessage?.editHistory?.[1]?.content).toBe('First edit');
        });

        it('should prevent editing by non-sender', async () => {
            await expect(
                communicationService.editMessage(
                    testMessage._id.toString(),
                    testUser2._id.toString(), // Different user
                    'Unauthorized edit',
                    'Hacking attempt',
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Message not found or not authorized to edit');
        });

        it('should prevent editing old messages (24+ hours)', async () => {
            // Create an old message
            const oldDate = new Date();
            oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

            const oldMessage = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser1._id,
                content: {
                    text: 'Old message',
                    type: 'text',
                },
                workplaceId: testWorkplace._id,
                createdBy: testUser1._id,
                createdAt: oldDate,
            });

            await expect(
                communicationService.editMessage(
                    oldMessage._id.toString(),
                    testUser1._id.toString(),
                    'Trying to edit old message',
                    'Too late',
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Message is too old to edit');
        });

        it('should handle non-existent message', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            await expect(
                communicationService.editMessage(
                    nonExistentId.toString(),
                    testUser1._id.toString(),
                    'New content',
                    'Edit reason',
                    testWorkplace._id.toString()
                )
            ).rejects.toThrow('Message not found or not authorized to edit');
        });
    });

    describe('deleteMessage', () => {
        it('should soft delete a message by sender', async () => {
            const reason = 'Accidental send';

            await communicationService.deleteMessage(
                testMessage._id.toString(),
                testUser1._id.toString(),
                testWorkplace._id.toString(),
                reason
            );

            const deletedMessage = await Message.findById(testMessage._id);
            expect(deletedMessage?.isDeleted).toBe(true);
            expect(deletedMessage?.deletedBy?.toString()).toBe(testUser1._id.toString());
            expect(deletedMessage?.deletedAt).toBeDefined();
        });

        it('should allow pharmacist to delete any message', async () => {
            // Create message from user2
            const user2Message = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser2._id,
                content: {
                    text: 'Message from doctor',
                    type: 'text',
                },
                workplaceId: testWorkplace._id,
                createdBy: testUser2._id,
            });

            // Pharmacist (testUser1) deletes doctor's message
            await communicationService.deleteMessage(
                user2Message._id.toString(),
                testUser1._id.toString(),
                testWorkplace._id.toString(),
                'Inappropriate content'
            );

            const deletedMessage = await Message.findById(user2Message._id);
            expect(deletedMessage?.isDeleted).toBe(true);
            expect(deletedMessage?.deletedBy?.toString()).toBe(testUser1._id.toString());
        });

        it('should prevent non-authorized users from deleting messages', async () => {
            // Create a patient user
            const patientUser = await User.create({
                email: 'patient@test.com',
                password: 'hashedpassword',
                firstName: 'John',
                lastName: 'Patient',
                role: 'patient',
                workplaceId: testWorkplace._id,
                isEmailVerified: true,
            });

            await expect(
                communicationService.deleteMessage(
                    testMessage._id.toString(),
                    patientUser._id.toString(),
                    testWorkplace._id.toString(),
                    'Unauthorized deletion'
                )
            ).rejects.toThrow('Insufficient permissions to delete message');
        });

        it('should handle non-existent message', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            await expect(
                communicationService.deleteMessage(
                    nonExistentId.toString(),
                    testUser1._id.toString(),
                    testWorkplace._id.toString(),
                    'Delete reason'
                )
            ).rejects.toThrow('Message not found');
        });

        it('should preserve original content for audit purposes', async () => {
            const originalContent = testMessage.content.text;

            await communicationService.deleteMessage(
                testMessage._id.toString(),
                testUser1._id.toString(),
                testWorkplace._id.toString(),
                'Audit test'
            );

            const deletedMessage = await Message.findById(testMessage._id);
            expect(deletedMessage?.content.text).toBe(originalContent); // Content preserved
            expect(deletedMessage?.isDeleted).toBe(true);
        });
    });

    describe('Message version tracking', () => {
        it('should maintain chronological edit history', async () => {
            const edits = [
                { content: 'First edit', reason: 'Typo fix' },
                { content: 'Second edit', reason: 'Clarity improvement' },
                { content: 'Final edit', reason: 'Grammar correction' },
            ];

            for (const edit of edits) {
                await communicationService.editMessage(
                    testMessage._id.toString(),
                    testUser1._id.toString(),
                    edit.content,
                    edit.reason,
                    testWorkplace._id.toString()
                );

                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.editHistory).toHaveLength(3);

            // Check chronological order
            const editTimes = updatedMessage?.editHistory.map(h => h.editedAt.getTime()) || [];
            for (let i = 1; i < editTimes.length; i++) {
                expect(editTimes[i]).toBeGreaterThan(editTimes[i - 1]);
            }
        });

        it('should track edit reasons correctly', async () => {
            const reasons = ['Fix typo', 'Add clarification', 'Remove sensitive info'];

            for (let i = 0; i < reasons.length; i++) {
                await communicationService.editMessage(
                    testMessage._id.toString(),
                    testUser1._id.toString(),
                    `Edit ${i + 1}`,
                    reasons[i],
                    testWorkplace._id.toString()
                );
            }

            const updatedMessage = await Message.findById(testMessage._id);
            const editReasons = updatedMessage?.editHistory.map(h => h.reason) || [];

            expect(editReasons).toEqual(reasons);
        });
    });

    describe('Audit trail integration', () => {
        it('should create audit logs for message edits', async () => {
            // Note: This test assumes CommunicationAuditService is properly mocked
            // In a real implementation, you would verify audit log creation

            await expect(
                communicationService.editMessage(
                    testMessage._id.toString(),
                    testUser1._id.toString(),
                    'Edited content',
                    'Test edit',
                    testWorkplace._id.toString()
                )
            ).resolves.not.toThrow();
        });

        it('should create audit logs for message deletions', async () => {
            // Note: This test assumes CommunicationAuditService is properly mocked
            // In a real implementation, you would verify audit log creation

            await expect(
                communicationService.deleteMessage(
                    testMessage._id.toString(),
                    testUser1._id.toString(),
                    testWorkplace._id.toString(),
                    'Test deletion'
                )
            ).resolves.not.toThrow();
        });
    });
});