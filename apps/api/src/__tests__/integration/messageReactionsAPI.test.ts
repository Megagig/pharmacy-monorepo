import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { generateAccessToken } from '../../utils/token';

describe('Message Reactions API Integration Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser1: any;
    let testUser2: any;
    let testConversation: any;
    let testMessage: any;
    let authToken1: string;
    let authToken2: string;

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
            User.deleteMany({}),
            Workplace.deleteMany({}),
            Conversation.deleteMany({}),
            Message.deleteMany({}),
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

        // Generate auth tokens
        authToken1 = generateAccessToken(testUser1._id.toString());
        authToken2 = generateAccessToken(testUser2._id.toString());

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
                text: 'Test message for reactions',
                type: 'text',
            },
            workplaceId: testWorkplace._id,
            createdBy: testUser1._id,
        });
    });

    describe('POST /api/communication/messages/:id/reactions', () => {
        it('should add a reaction to a message', async () => {
            const response = await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Reaction added successfully');

            // Verify in database
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
            expect(updatedMessage?.reactions?.[0]?.emoji).toBe('👍');
            expect(updatedMessage?.reactions?.[0]?.userId.toString()).toBe(testUser2._id.toString());
        });

        it('should validate healthcare-specific emojis', async () => {
            const validEmojis = ['👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔', '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊'];

            for (const emoji of validEmojis) {
                await request(app)
                    .post(`/api/communication/messages/${testMessage._id}/reactions`)
                    .set('Authorization', `Bearer ${authToken2}`)
                    .send({ emoji })
                    .expect(200);
            }
        });

        it('should reject invalid emojis', async () => {
            const response = await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '🍕' }) // Not in healthcare emoji list
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should require authentication', async () => {
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .send({ emoji: '👍' })
                .expect(401);
        });

        it('should validate message ID format', async () => {
            await request(app)
                .post('/api/communication/messages/invalid-id/reactions')
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(400);
        });

        it('should handle non-existent message', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/communication/messages/${nonExistentId}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to add reaction');
        });

        it('should prevent duplicate reactions from same user', async () => {
            // Add reaction first time
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(200);

            // Add same reaction again
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(200);

            // Should still have only one reaction
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
        });
    });

    describe('DELETE /api/communication/messages/:id/reactions/:emoji', () => {
        beforeEach(async () => {
            // Add a reaction to remove
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' })
                .expect(200);
        });

        it('should remove a reaction from a message', async () => {
            const response = await request(app)
                .delete(`/api/communication/messages/${testMessage._id}/reactions/${encodeURIComponent('👍')}`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Reaction removed successfully');

            // Verify in database
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(0);
        });

        it('should handle removing non-existent reaction', async () => {
            const response = await request(app)
                .delete(`/api/communication/messages/${testMessage._id}/reactions/${encodeURIComponent('❤️')}`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Original reaction should still be there
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(1);
        });

        it('should require authentication', async () => {
            await request(app)
                .delete(`/api/communication/messages/${testMessage._id}/reactions/${encodeURIComponent('👍')}`)
                .expect(401);
        });

        it('should handle URL encoding of emojis', async () => {
            // Test with various emojis that need encoding
            const emojis = ['👍', '❤️', '🩺', '⚠️'];

            for (const emoji of emojis) {
                // Add reaction
                await request(app)
                    .post(`/api/communication/messages/${testMessage._id}/reactions`)
                    .set('Authorization', `Bearer ${authToken2}`)
                    .send({ emoji })
                    .expect(200);

                // Remove reaction with proper encoding
                await request(app)
                    .delete(`/api/communication/messages/${testMessage._id}/reactions/${encodeURIComponent(emoji)}`)
                    .set('Authorization', `Bearer ${authToken2}`)
                    .expect(200);
            }
        });
    });

    describe('PUT /api/communication/messages/:id/read', () => {
        it('should mark a message as read', async () => {
            const response = await request(app)
                .put(`/api/communication/messages/${testMessage._id}/read`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message marked as read');

            // Verify in database
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.readBy).toHaveLength(1);
            expect(updatedMessage?.readBy?.[0]?.userId.toString()).toBe(testUser2._id.toString());
            expect(updatedMessage?.status).toBe('read');
        });

        it('should not duplicate read receipts', async () => {
            // Mark as read twice
            await request(app)
                .put(`/api/communication/messages/${testMessage._id}/read`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);

            await request(app)
                .put(`/api/communication/messages/${testMessage._id}/read`)
                .set('Authorization', `Bearer ${authToken2}`)
                .expect(200);

            // Should still have only one read receipt
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.readBy).toHaveLength(1);
        });

        it('should require authentication', async () => {
            await request(app)
                .put(`/api/communication/messages/${testMessage._id}/read`)
                .expect(401);
        });
    });

    describe('PUT /api/communication/messages/:id', () => {
        it('should edit a message by the sender', async () => {
            const newContent = 'Updated message content';
            const reason = 'Fixed typo';

            const response = await request(app)
                .put(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${authToken1}`) // Original sender
                .send({ content: newContent, reason })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message edited successfully');
            expect(response.body.data.content.text).toBe(newContent);

            // Verify edit history
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.editHistory).toHaveLength(1);
            expect(updatedMessage?.editHistory?.[0]?.content).toBe('Test message for reactions');
            expect(updatedMessage?.editHistory?.[0]?.reason).toBe(reason);
        });

        it('should prevent editing by non-sender', async () => {
            const response = await request(app)
                .put(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${authToken2}`) // Different user
                .send({ content: 'Unauthorized edit', reason: 'Hacking' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to edit message');
        });

        it('should validate content length', async () => {
            const longContent = 'a'.repeat(10001); // Exceeds 10000 char limit

            await request(app)
                .put(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ content: longContent })
                .expect(400);
        });

        it('should require content', async () => {
            await request(app)
                .put(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ reason: 'No content provided' })
                .expect(400);
        });
    });

    describe('DELETE /api/communication/messages/:id', () => {
        it('should delete a message by the sender', async () => {
            const reason = 'Accidental send';

            const response = await request(app)
                .delete(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ reason })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Message deleted successfully');

            // Verify soft deletion
            const deletedMessage = await Message.findById(testMessage._id);
            expect(deletedMessage?.isDeleted).toBe(true);
            expect(deletedMessage?.deletedBy?.toString()).toBe(testUser1._id.toString());
            expect(deletedMessage?.content.text).toBe('Test message for reactions'); // Content preserved
        });

        it('should allow pharmacist to delete any message', async () => {
            // Create message from doctor
            const doctorMessage = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser2._id,
                content: {
                    text: 'Message from doctor',
                    type: 'text',
                },
                workplaceId: testWorkplace._id,
                createdBy: testUser2._id,
            });

            const response = await request(app)
                .delete(`/api/communication/messages/${doctorMessage._id}`)
                .set('Authorization', `Bearer ${authToken1}`) // Pharmacist
                .send({ reason: 'Inappropriate content' })
                .expect(200);

            expect(response.body.success).toBe(true);

            const deletedMessage = await Message.findById(doctorMessage._id);
            expect(deletedMessage?.isDeleted).toBe(true);
            expect(deletedMessage?.deletedBy?.toString()).toBe(testUser1._id.toString());
        });

        it('should prevent unauthorized deletion', async () => {
            // Create patient user
            const patientUser = await User.create({
                email: 'patient@test.com',
                password: 'hashedpassword',
                firstName: 'John',
                lastName: 'Patient',
                role: 'patient',
                workplaceId: testWorkplace._id,
                isEmailVerified: true,
            });

            const patientToken = generateAccessToken(patientUser._id.toString());

            const response = await request(app)
                .delete(`/api/communication/messages/${testMessage._id}`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ reason: 'Unauthorized' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to delete message');
        });
    });

    describe('POST /api/communication/messages/statuses', () => {
        let message2: any;

        beforeEach(async () => {
            message2 = await Message.create({
                conversationId: testConversation._id,
                senderId: testUser2._id,
                content: {
                    text: 'Second test message',
                    type: 'text',
                },
                workplaceId: testWorkplace._id,
                createdBy: testUser2._id,
            });

            // Add some reactions and read receipts
            await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({ emoji: '👍' });

            await request(app)
                .put(`/api/communication/messages/${message2._id}/read`)
                .set('Authorization', `Bearer ${authToken1}`);
        });

        it('should return statuses for multiple messages', async () => {
            const messageIds = [testMessage._id.toString(), message2._id.toString()];

            const response = await request(app)
                .post('/api/communication/messages/statuses')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ messageIds })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Object.keys(response.body.data)).toHaveLength(2);

            // Check reaction data
            expect(response.body.data[testMessage._id.toString()].reactions).toHaveLength(1);
            expect(response.body.data[testMessage._id.toString()].reactions[0].emoji).toBe('👍');

            // Check read receipt data
            expect(response.body.data[message2._id.toString()].readBy).toHaveLength(1);
        });

        it('should validate message IDs array', async () => {
            await request(app)
                .post('/api/communication/messages/statuses')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ messageIds: 'not-an-array' })
                .expect(400);
        });

        it('should handle empty message IDs array', async () => {
            await request(app)
                .post('/api/communication/messages/statuses')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ messageIds: [] })
                .expect(400);
        });

        it('should validate message ID format', async () => {
            await request(app)
                .post('/api/communication/messages/statuses')
                .set('Authorization', `Bearer ${authToken1}`)
                .send({ messageIds: ['invalid-id'] })
                .expect(400);
        });
    });

    describe('Rate Limiting and Security', () => {
        it('should handle concurrent reaction requests', async () => {
            const promises = [];
            const emojis = ['👍', '❤️', '😊', '🩺', '💊'];

            // Send multiple concurrent requests
            for (const emoji of emojis) {
                promises.push(
                    request(app)
                        .post(`/api/communication/messages/${testMessage._id}/reactions`)
                        .set('Authorization', `Bearer ${authToken2}`)
                        .send({ emoji })
                );
            }

            const responses = await Promise.all(promises);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Verify all reactions were added
            const updatedMessage = await Message.findById(testMessage._id);
            expect(updatedMessage?.reactions).toHaveLength(5);
        });

        it('should sanitize input data', async () => {
            // Test with potentially malicious input
            const response = await request(app)
                .post(`/api/communication/messages/${testMessage._id}/reactions`)
                .set('Authorization', `Bearer ${authToken2}`)
                .send({
                    emoji: '👍',
                    maliciousField: '<script>alert("xss")</script>'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});