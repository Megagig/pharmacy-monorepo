import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
    getUserSuggestions,
    searchMessagesByMentions,
    getMentionStats,
    getMentionedUsers,
} from '../../controllers/mentionController';
import User from '../../models/User';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/Conversation');
jest.mock('../../models/Message');

const MockUser = User as jest.Mocked<typeof User>;
const MockConversation = Conversation as jest.Mocked<typeof Conversation>;
const MockMessage = Message as jest.Mocked<typeof Message>;

describe('MentionController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });

        req = {
            params: {
                conversationId: 'conv123',
                workplaceId: new mongoose.Types.ObjectId().toString()
            },
            query: {},
            user: {
                _id: new mongoose.Types.ObjectId(),
                workplaceId: new mongoose.Types.ObjectId(),
            } as any,
        };

        res = {
            json: mockJson,
            status: mockStatus,
        };

        jest.clearAllMocks();
    });

    describe('getUserSuggestions', () => {
        it('should return user suggestions for mentions', async () => {
            const mockConversation = {
                _id: 'conv123',
                type: 'group',
                participants: [{ userId: req.user!._id }],
            };

            const mockUsers = [
                {
                    _id: 'user1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    role: 'doctor',
                },
                {
                    _id: 'user2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane@example.com',
                    role: 'pharmacist',
                },
            ];

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockUser.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        sort: jest.fn().mockResolvedValue(mockUsers),
                    }),
                }),
            } as any);

            req.query = { query: 'john', limit: '10' };

            await getUserSuggestions(req as any, res as Response);

            expect(MockConversation.findOne).toHaveBeenCalledWith({
                _id: 'conv123',
                workplaceId: req.params.workplaceId,
                'participants.userId': req.user!._id,
            });

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        _id: 'user1',
                        displayName: 'John Doe',
                        subtitle: 'doctor • john@example.com',
                    }),
                ]),
            });
        });

        it('should return 404 if conversation not found', async () => {
            MockConversation.findOne.mockResolvedValue(null);

            await getUserSuggestions(req as any, res as Response);

            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                message: 'Conversation not found or access denied',
            });
        });

        it('should handle search query filtering', async () => {
            const mockConversation = {
                _id: 'conv123',
                type: 'group',
                participants: [{ userId: req.user!._id }],
            };

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockUser.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        sort: jest.fn().mockResolvedValue([]),
                    }),
                }),
            } as any);

            req.query = { query: 'sarah' };

            await getUserSuggestions(req as any, res as Response);

            expect(MockUser.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    $or: [
                        { firstName: expect.any(RegExp) },
                        { lastName: expect.any(RegExp) },
                        { email: expect.any(RegExp) },
                    ],
                })
            );
        });
    });

    describe('searchMessagesByMentions', () => {
        it('should return messages with mentions', async () => {
            const mockConversation = {
                _id: 'conv123',
                participants: [{ userId: req.user!._id }],
            };

            const mockMessages = [
                {
                    _id: 'msg1',
                    conversationId: 'conv123',
                    senderId: {
                        _id: 'user1',
                        firstName: 'John',
                        lastName: 'Doe',
                        role: 'doctor',
                    },
                    content: { text: 'Hello @[Jane Smith](user2)', type: 'text' },
                    mentions: [{ _id: 'user2', firstName: 'Jane', lastName: 'Smith' }],
                    priority: 'normal',
                    createdAt: new Date(),
                },
            ];

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockMessage.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockMessages),
            } as any);
            MockMessage.countDocuments.mockResolvedValue(1);

            await searchMessagesByMentions(req as any, res as Response);

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    messages: expect.arrayContaining([
                        expect.objectContaining({
                            _id: 'msg1',
                            content: { text: 'Hello @[Jane Smith](user2)', type: 'text' },
                        }),
                    ]),
                    pagination: {
                        page: 1,
                        limit: 50,
                        total: 1,
                        pages: 1,
                    },
                },
            });
        });

        it('should filter by specific user when userId provided', async () => {
            const mockConversation = {
                _id: 'conv123',
                participants: [{ userId: req.user!._id }],
            };

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockMessage.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            } as any);
            MockMessage.countDocuments.mockResolvedValue(0);

            req.query = { userId: 'user2' };

            await searchMessagesByMentions(req as any, res as Response);

            expect(MockMessage.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    mentions: 'user2',
                })
            );
        });
    });

    describe('getMentionStats', () => {
        it('should return mention statistics', async () => {
            const mockConversation = {
                _id: 'conv123',
                participants: [{ userId: req.user!._id }],
            };

            const mockAggregationResult = [
                {
                    _id: 'user1',
                    count: 5,
                    userName: 'John Doe',
                },
            ];

            const mockRecentMentions = [
                {
                    _id: 'msg1',
                    senderId: { _id: 'user1' },
                    mentions: [{ _id: 'user2' }],
                    createdAt: new Date(),
                },
            ];

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockMessage.countDocuments.mockResolvedValue(10);
            MockMessage.aggregate.mockResolvedValue(mockAggregationResult);
            MockMessage.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue(mockRecentMentions),
            } as any);

            await getMentionStats(req as any, res as Response);

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    totalMentions: 10,
                    mentionsByUser: { user1: 5 },
                    recentMentions: expect.arrayContaining([
                        expect.objectContaining({
                            messageId: 'msg1',
                            senderId: 'user1',
                        }),
                    ]),
                },
            });
        });
    });

    describe('getMentionedUsers', () => {
        it('should return users mentioned in conversation', async () => {
            const mockConversation = {
                _id: 'conv123',
                participants: [{ userId: req.user!._id }],
            };

            const mockMentionedUserIds = ['user1', 'user2'];
            const mockUsers = [
                {
                    _id: 'user1',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: 'doctor',
                    email: 'john@example.com',
                },
            ];

            MockConversation.findOne.mockResolvedValue(mockConversation as any);
            MockMessage.distinct.mockResolvedValue(mockMentionedUserIds);
            MockUser.find.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUsers),
            } as any);

            await getMentionedUsers(req as any, res as Response);

            expect(MockMessage.distinct).toHaveBeenCalledWith('mentions', {
                conversationId: 'conv123',
                mentions: { $exists: true, $ne: [] },
                isDeleted: false,
            });

            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    users: expect.arrayContaining([
                        expect.objectContaining({
                            _id: 'user1',
                            firstName: 'John',
                            lastName: 'Doe',
                        }),
                    ]),
                },
            });
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', async () => {
            MockConversation.findOne.mockRejectedValue(new Error('Database error'));

            await getUserSuggestions(req as any, res as Response);

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to get user suggestions',
                error: expect.any(String),
            });
        });

        it('should return 400 if workplaceId is missing', async () => {
            req.params.workplaceId = undefined;

            await getUserSuggestions(req as any, res as Response);

            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                success: false,
                message: 'Workplace context required',
            });
        });
    });
});