import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import notificationRoutes from '../../routes/notificationRoutes';
import Notification from '../../models/Notification';
import User from '../../models/User';
import { notificationService } from '../../services/notificationService';

// Mock the notification service
jest.mock('../../services/notificationService');
jest.mock('../../utils/logger');

const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;

describe('NotificationController', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let testUserId: mongoose.Types.ObjectId;
    let testWorkplaceId: mongoose.Types.ObjectId;
    let authToken: string;

    beforeAll(async () => {
        // Setup in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Setup Express app
        app = express();
        app.use(express.json());

        // Mock authentication middleware
        app.use((req: any, res, next) => {
            req.user = {
                _id: testUserId.toString(),
                workplaceId: testWorkplaceId.toString(),
                role: 'pharmacist',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
            };
            next();
        });

        app.use('/api/notifications', notificationRoutes);

        // Create test IDs
        testUserId = new mongoose.Types.ObjectId();
        testWorkplaceId = new mongoose.Types.ObjectId();
        authToken = 'mock-jwt-token';
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await Notification.deleteMany({});
        await User.deleteMany({});

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('POST /api/notifications', () => {
        it('should create a notification successfully', async () => {
            const mockNotification = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                type: 'new_message',
                title: 'Test Notification',
                content: 'Test content',
                data: {},
                priority: 'normal',
                status: 'unread',
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
                createdAt: new Date(),
            };

            mockNotificationService.createNotification.mockResolvedValue(mockNotification as any);

            const response = await request(app)
                .post('/api/notifications')
                .send({
                    userId: testUserId.toString(),
                    type: 'new_message',
                    title: 'Test Notification',
                    content: 'Test content',
                    data: {},
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Test Notification');
            expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
                userId: testUserId,
                type: 'new_message',
                title: 'Test Notification',
                content: 'Test content',
                data: {},
                priority: 'normal',
                deliveryChannels: undefined,
                scheduledFor: undefined,
                expiresAt: undefined,
                groupKey: undefined,
                workplaceId: testWorkplaceId,
                createdBy: testUserId,
            });
        });

        it('should return 400 for invalid user ID', async () => {
            const response = await request(app)
                .post('/api/notifications')
                .send({
                    userId: 'invalid-id',
                    type: 'new_message',
                    title: 'Test Notification',
                    content: 'Test content',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid user ID');
        });

        it('should return 400 for missing required fields', async () => {
            const response = await request(app)
                .post('/api/notifications')
                .send({
                    userId: testUserId.toString(),
                    // Missing type, title, content
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Missing required fields');
        });
    });

    describe('GET /api/notifications', () => {
        it('should get user notifications successfully', async () => {
            const mockResult = {
                notifications: [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'new_message',
                        title: 'Test Notification',
                        content: 'Test content',
                        priority: 'normal',
                        status: 'unread',
                        createdAt: new Date(),
                    },
                ],
                total: 1,
                unreadCount: 1,
            };

            mockNotificationService.getUserNotifications.mockResolvedValue(mockResult as any);

            const response = await request(app)
                .get('/api/notifications')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.notifications).toHaveLength(1);
            expect(response.body.data.total).toBe(1);
            expect(response.body.data.unreadCount).toBe(1);
            expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
                testUserId.toString(),
                testWorkplaceId.toString(),
                expect.objectContaining({
                    limit: 50,
                    offset: 0,
                })
            );
        });

        it('should apply query filters', async () => {
            mockNotificationService.getUserNotifications.mockResolvedValue({
                notifications: [],
                total: 0,
                unreadCount: 0,
            } as any);

            await request(app)
                .get('/api/notifications')
                .query({
                    type: 'new_message',
                    status: 'unread',
                    priority: 'high',
                    limit: '10',
                    offset: '5',
                })
                .expect(200);

            expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
                testUserId.toString(),
                testWorkplaceId.toString(),
                expect.objectContaining({
                    type: 'new_message',
                    status: 'unread',
                    priority: 'high',
                    limit: 10,
                    offset: 5,
                })
            );
        });
    });

    describe('PATCH /api/notifications/:notificationId/read', () => {
        it('should mark notification as read successfully', async () => {
            const notificationId = new mongoose.Types.ObjectId().toString();
            mockNotificationService.markAsRead.mockResolvedValue();

            const response = await request(app)
                .patch(`/api/notifications/${notificationId}/read`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
                notificationId,
                testUserId.toString()
            );
        });

        it('should return 400 for invalid notification ID', async () => {
            const response = await request(app)
                .patch('/api/notifications/invalid-id/read')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid notification ID');
        });
    });

    describe('PATCH /api/notifications/mark-multiple-read', () => {
        it('should mark multiple notifications as read', async () => {
            const notificationIds = [
                new mongoose.Types.ObjectId().toString(),
                new mongoose.Types.ObjectId().toString(),
            ];

            // Mock the database update
            jest.spyOn(Notification, 'updateMany').mockResolvedValue({
                acknowledged: true,
                modifiedCount: 2,
                upsertedId: null,
                upsertedCount: 0,
                matchedCount: 2,
            } as any);

            const response = await request(app)
                .patch('/api/notifications/mark-multiple-read')
                .send({ notificationIds })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.markedCount).toBe(2);
        });

        it('should return 400 for invalid notification IDs array', async () => {
            const response = await request(app)
                .patch('/api/notifications/mark-multiple-read')
                .send({ notificationIds: 'not-an-array' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid notification IDs array');
        });
    });

    describe('PATCH /api/notifications/:notificationId/dismiss', () => {
        it('should dismiss notification successfully', async () => {
            const notificationId = new mongoose.Types.ObjectId();
            const mockNotification = {
                _id: notificationId,
                userId: testUserId,
                status: 'unread',
                markAsDismissed: jest.fn(),
                save: jest.fn().mockResolvedValue(true),
            };

            jest.spyOn(Notification, 'findOne').mockResolvedValue(mockNotification as any);

            const response = await request(app)
                .patch(`/api/notifications/${notificationId.toString()}/dismiss`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockNotification.markAsDismissed).toHaveBeenCalled();
            expect(mockNotification.save).toHaveBeenCalled();
        });

        it('should return 404 for non-existent notification', async () => {
            const notificationId = new mongoose.Types.ObjectId();
            jest.spyOn(Notification, 'findOne').mockResolvedValue(null);

            const response = await request(app)
                .patch(`/api/notifications/${notificationId.toString()}/dismiss`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Notification not found');
        });
    });

    describe('GET /api/notifications/unread-count', () => {
        it('should get unread count successfully', async () => {
            // Mock countDocuments instead of non-existent getUnreadCountByUser
            jest.spyOn(Notification, 'countDocuments').mockResolvedValue(5);

            const response = await request(app)
                .get('/api/notifications/unread-count')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.unreadCount).toBe(5);
        });
    });

    describe('GET /api/notifications/preferences', () => {
        it('should get notification preferences successfully', async () => {
            const mockPreferences = {
                inApp: true,
                email: true,
                sms: false,
                newMessage: true,
                mentions: true,
            };

            mockNotificationService.getNotificationPreferences.mockResolvedValue(mockPreferences as any);

            const response = await request(app)
                .get('/api/notifications/preferences')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockPreferences);
        });
    });

    describe('PUT /api/notifications/preferences', () => {
        it('should update notification preferences successfully', async () => {
            const preferences = {
                email: false,
                sms: true,
                newMessage: false,
            };

            mockNotificationService.updateNotificationPreferences.mockResolvedValue();

            const response = await request(app)
                .put('/api/notifications/preferences')
                .send(preferences)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockNotificationService.updateNotificationPreferences).toHaveBeenCalledWith(
                testUserId.toString(),
                preferences
            );
        });
    });

    describe('POST /api/notifications/conversation', () => {
        it('should create conversation notification successfully', async () => {
            const conversationId = new mongoose.Types.ObjectId().toString();
            const recipientIds = [new mongoose.Types.ObjectId().toString()];
            const mockNotifications = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'new_message',
                    title: 'New message',
                    content: 'Test content',
                },
            ];

            mockNotificationService.createConversationNotification.mockResolvedValue(mockNotifications as any);

            const response = await request(app)
                .post('/api/notifications/conversation')
                .send({
                    type: 'new_message',
                    conversationId,
                    recipientIds,
                    messageId: new mongoose.Types.ObjectId().toString(),
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(mockNotificationService.createConversationNotification).toHaveBeenCalledWith(
                'new_message',
                conversationId,
                testUserId.toString(),
                recipientIds,
                expect.any(String),
                undefined
            );
        });

        it('should return 400 for missing required fields', async () => {
            const response = await request(app)
                .post('/api/notifications/conversation')
                .send({
                    type: 'new_message',
                    // Missing conversationId and recipientIds
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Missing required fields');
        });
    });

    describe('POST /api/notifications/patient-query', () => {
        it('should create patient query notification successfully', async () => {
            const patientId = new mongoose.Types.ObjectId().toString();
            const conversationId = new mongoose.Types.ObjectId().toString();
            const recipientIds = [new mongoose.Types.ObjectId().toString()];
            const mockNotifications = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'patient_query',
                    title: 'New patient query',
                    content: 'Patient has a question',
                },
            ];

            mockNotificationService.createPatientQueryNotification.mockResolvedValue(mockNotifications as any);

            const response = await request(app)
                .post('/api/notifications/patient-query')
                .send({
                    patientId,
                    conversationId,
                    messageContent: 'I have a question about my medication',
                    recipientIds,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(mockNotificationService.createPatientQueryNotification).toHaveBeenCalledWith(
                patientId,
                conversationId,
                'I have a question about my medication',
                recipientIds
            );
        });
    });

    describe('GET /api/notifications/statistics', () => {
        it('should get notification statistics successfully', async () => {
            const mockStats = [
                {
                    _id: { type: 'new_message', status: 'read', priority: 'normal' },
                    count: 10,
                    avgDeliveryTime: 5000,
                },
            ];

            // Mock aggregate instead of non-existent getNotificationStats
            jest.spyOn(Notification, 'aggregate').mockResolvedValue(mockStats as any);

            const response = await request(app)
                .get('/api/notifications/statistics')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockStats);
        });
    });

    describe('POST /api/notifications/test', () => {
        it('should send test notification successfully', async () => {
            const mockNotification = {
                _id: new mongoose.Types.ObjectId(),
                type: 'system_notification',
                title: 'Test Notification',
                content: 'This is a test notification',
            };

            mockNotificationService.createNotification.mockResolvedValue(mockNotification as any);

            const response = await request(app)
                .post('/api/notifications/test')
                .send({
                    type: 'system_notification',
                    channels: ['inApp', 'email'],
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'system_notification',
                    title: 'Test Notification',
                    deliveryChannels: {
                        inApp: true,
                        email: true,
                        sms: false,
                        push: false,
                    },
                })
            );
        });
    });

    describe('POST /api/notifications/archive-old', () => {
        it('should archive old notifications successfully', async () => {
            jest.spyOn(Notification, 'updateMany').mockResolvedValue({
                acknowledged: true,
                modifiedCount: 15,
                upsertedId: null,
                upsertedCount: 0,
                matchedCount: 15,
            } as any);

            const response = await request(app)
                .post('/api/notifications/archive-old')
                .send({ daysOld: 60 })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.archivedCount).toBe(15);
        });
    });

    describe('Error handling', () => {
        it('should handle service errors gracefully', async () => {
            mockNotificationService.createNotification.mockRejectedValue(new Error('Service error'));

            const response = await request(app)
                .post('/api/notifications')
                .send({
                    userId: testUserId.toString(),
                    type: 'new_message',
                    title: 'Test Notification',
                    content: 'Test content',
                })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Failed to create notification');
        });

        it('should handle database errors gracefully', async () => {
            jest.spyOn(Notification, 'countDocuments').mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/notifications/unread-count')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Failed to get unread count');
        });
    });
});