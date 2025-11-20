import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import communicationRoutes from '../../routes/communicationRoutes';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import Patient from '../../models/Patient';

// Mock the controller functions
jest.mock('../../controllers/communicationController', () => {
    const mockController = {
        getConversations: jest.fn((req, res) => res.json({
            success: true,
            data: [{ _id: 'test-id', title: 'Test Conversation' }],
            pagination: { limit: 50, offset: 0, total: 1 }
        })),
        createConversation: jest.fn((req, res) => res.status(201).json({
            success: true,
            data: { _id: 'new-id', title: req.body.title, type: req.body.type }
        })),
        getConversation: jest.fn((req, res) => res.json({
            success: true,
            data: { _id: req.params.id, title: 'Test Conversation' }
        })),
        updateConversation: jest.fn((req, res) => res.json({ success: true, data: {} })),
        addParticipant: jest.fn((req, res) => res.json({ success: true })),
        removeParticipant: jest.fn((req, res) => res.json({ success: true })),
        getMessages: jest.fn((req, res) => res.json({
            success: true,
            data: [{ _id: 'msg-id', content: { text: 'Test message' } }],
            pagination: { limit: 50, offset: 0, total: 1 }
        })),
        sendMessage: jest.fn((req, res) => res.status(201).json({
            success: true,
            data: { _id: 'new-msg-id', content: req.body.content }
        })),
        markMessageAsRead: jest.fn((req, res) => res.json({ success: true })),
        addReaction: jest.fn((req, res) => res.json({ success: true })),
        removeReaction: jest.fn((req, res) => res.json({ success: true })),
        editMessage: jest.fn((req, res) => res.json({ success: true, data: {} })),
        searchMessages: jest.fn((req, res) => res.json({ success: true, data: [] })),
        searchConversations: jest.fn((req, res) => res.json({ success: true, data: [] })),
        getPatientConversations: jest.fn((req, res) => res.json({ success: true, data: [] })),
        createPatientQuery: jest.fn((req, res) => res.status(201).json({
            success: true,
            data: { conversation: {}, initialMessage: {} }
        })),
        getAnalyticsSummary: jest.fn((req, res) => res.json({
            success: true,
            data: { conversations: {}, messages: {}, dateRange: {} }
        })),
        uploadFiles: jest.fn((req, res) => res.status(400).json({
            success: false,
            message: 'No files uploaded'
        })),
        getFile: jest.fn((req, res) => res.status(404).json({
            success: false,
            message: 'File not found'
        })),
        deleteFile: jest.fn((req, res) => res.json({ success: true })),
        getConversationFiles: jest.fn((req, res) => res.json({
            success: true,
            data: []
        })),
    };

    return {
        __esModule: true,
        default: mockController,
        communicationController: mockController,
    };
});

// Mock middleware
jest.mock('../../middlewares/auth', () => jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', workplaceId: 'test-workplace-id', role: 'pharmacist' };
    next();
}));

describe('Communication Routes', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let authToken: string;

    beforeAll(async () => {
        // Start in-memory MongoDB instance
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/communication', communicationRoutes);

        // Generate test auth token
        authToken = jwt.sign(
            {
                id: 'test-user-id',
                workplaceId: 'test-workplace-id',
                role: 'pharmacist',
            },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('Authentication and Authorization', () => {
        it('should reject requests without authentication token', async () => {
            const response = await request(app)
                .get('/api/communication/conversations')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Authentication');
        });

        it('should reject requests with invalid token', async () => {
            const response = await request(app)
                .get('/api/communication/conversations')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/conversations', () => {
        it('should return conversations list for authenticated user', async () => {
            const response = await request(app)
                .get('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/communication/conversations?status=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation');
        });

        it('should accept valid query parameters', async () => {
            const response = await request(app)
                .get('/api/communication/conversations?status=active&type=patient_query&limit=10')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.pagination).toBeDefined();
        });
    });

    describe('POST /api/communication/conversations', () => {
        const validConversationData = {
            title: 'New Test Conversation',
            type: 'group',
            participants: ['507f1f77bcf86cd799439011'],
            priority: 'normal',
            tags: ['test'],
        };

        it('should create conversation with valid data', async () => {
            const response = await request(app)
                .post('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validConversationData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(validConversationData.title);
            expect(response.body.data.type).toBe(validConversationData.type);
        });

        it('should validate required fields', async () => {
            const invalidData = { ...validConversationData, type: undefined };

            const response = await request(app)
                .post('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Validation');
        });

        it('should validate participant IDs', async () => {
            const invalidData = {
                ...validConversationData,
                participants: ['invalid-id'],
            };

            const response = await request(app)
                .post('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/conversations/:id', () => {
        it('should return conversation details for valid ID', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data._id).toBe('507f1f77bcf86cd799439011');
        });

        it('should reject invalid conversation ID', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/communication/conversations/:id/messages', () => {
        const validMessageData = {
            content: {
                text: 'Test message content',
                type: 'text',
            },
            priority: 'normal',
        };

        it('should send message with valid data', async () => {
            const response = await request(app)
                .post('/api/communication/conversations/507f1f77bcf86cd799439011/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validMessageData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.content.text).toBe(validMessageData.content.text);
        });

        it('should validate message content', async () => {
            const invalidData = { ...validMessageData, content: { ...validMessageData.content, text: undefined } };

            const response = await request(app)
                .post('/api/communication/conversations/507f1f77bcf86cd799439011/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate message type', async () => {
            const invalidData = {
                ...validMessageData,
                content: {
                    ...validMessageData.content,
                    type: 'invalid-type',
                },
            };

            const response = await request(app)
                .post('/api/communication/conversations/507f1f77bcf86cd799439011/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/conversations/:id/messages', () => {
        it('should return messages for conversation', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/507f1f77bcf86cd799439011/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/507f1f77bcf86cd799439011/messages?type=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/communication/conversations/507f1f77bcf86cd799439011/messages?limit=5&offset=0')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.limit).toBe(5);
        });
    });

    describe('PUT /api/communication/messages/:id/read', () => {
        it('should mark message as read', async () => {
            const response = await request(app)
                .put('/api/communication/messages/507f1f77bcf86cd799439011/read')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate message ID', async () => {
            const response = await request(app)
                .put('/api/communication/messages/invalid-id/read')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/search/messages', () => {
        it('should search messages with valid query', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=searchable')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should validate search query', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should support search filters', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=test&conversationId=507f1f77bcf86cd799439011&type=text')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/communication/patients/:patientId/queries', () => {
        const validQueryData = {
            title: 'Patient Question',
            message: 'I have a question about my medication',
            priority: 'normal',
            tags: ['medication-question'],
        };

        it('should create patient query with valid data', async () => {
            const response = await request(app)
                .post('/api/communication/patients/507f1f77bcf86cd799439011/queries')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validQueryData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.conversation).toBeDefined();
            expect(response.body.data.initialMessage).toBeDefined();
        });

        it('should validate patient ID', async () => {
            const response = await request(app)
                .post('/api/communication/patients/invalid-id/queries')
                .set('Authorization', `Bearer ${authToken}`)
                .send(validQueryData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate message content', async () => {
            const invalidData = { ...validQueryData, message: undefined };

            const response = await request(app)
                .post('/api/communication/patients/507f1f77bcf86cd799439011/queries')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/communication/analytics/summary', () => {
        it('should return analytics summary', async () => {
            const response = await request(app)
                .get('/api/communication/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.conversations).toBeDefined();
            expect(response.body.data.messages).toBeDefined();
        });

        it('should support date range filters', async () => {
            const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const dateTo = new Date().toISOString();

            const response = await request(app)
                .get(`/api/communication/analytics/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.dateRange).toBeDefined();
        });
    });

    describe('File Upload Endpoints', () => {
        describe('POST /api/communication/upload', () => {
            it('should handle file upload without files', async () => {
                const response = await request(app)
                    .post('/api/communication/upload')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toContain('No files uploaded');
            });

            it('should validate conversation ID if provided', async () => {
                const response = await request(app)
                    .post('/api/communication/upload')
                    .set('Authorization', `Bearer ${authToken}`)
                    .field('conversationId', 'invalid-id')
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/communication/files/:fileId', () => {
            it('should return 404 for non-existent file', async () => {
                const response = await request(app)
                    .get('/api/communication/files/non-existent-file.txt')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(404);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toContain('File not found');
            });
        });

        describe('GET /api/communication/conversations/:id/files', () => {
            it('should return files for conversation', async () => {
                const response = await request(app)
                    .get('/api/communication/conversations/507f1f77bcf86cd799439011/files')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should validate conversation access', async () => {
                const response = await request(app)
                    .get('/api/communication/conversations/invalid-id/files')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/communication/health')
                .expect(200);

            expect(response.body.status).toBe('OK');
            expect(response.body.module).toBe('communication-hub');
            expect(response.body.features).toBeDefined();
        });
    });

    describe('Message Reactions', () => {
        it('should add reaction to message', async () => {
            const response = await request(app)
                .post('/api/communication/messages/507f1f77bcf86cd799439011/reactions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ emoji: '👍' })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate emoji', async () => {
            const response = await request(app)
                .post('/api/communication/messages/507f1f77bcf86cd799439011/reactions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ emoji: '🚀' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should remove reaction from message', async () => {
            const response = await request(app)
                .delete('/api/communication/messages/507f1f77bcf86cd799439011/reactions/👍')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Participant Management', () => {
        it('should add participant to conversation', async () => {
            const response = await request(app)
                .post('/api/communication/conversations/507f1f77bcf86cd799439011/participants')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: '507f1f77bcf86cd799439012',
                    role: 'pharmacist',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate participant data', async () => {
            const response = await request(app)
                .post('/api/communication/conversations/507f1f77bcf86cd799439011/participants')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: 'invalid-id',
                    role: 'pharmacist',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should remove participant from conversation', async () => {
            const response = await request(app)
                .delete('/api/communication/conversations/507f1f77bcf86cd799439011/participants/507f1f77bcf86cd799439012')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // Mock a database error
            jest.spyOn(Conversation, 'find').mockRejectedValueOnce(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Failed to get conversations');

            // Restore the original method
            jest.restoreAllMocks();
        });

        it('should handle invalid JSON in request body', async () => {
            const response = await request(app)
                .post('/api/communication/conversations')
                .set('Authorization', `Bearer ${authToken}`)
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});