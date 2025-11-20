import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { messageSearchService } from '../../services/messageSearchService';
import Message from '../../models/Message';
import Conversation from '../../models/Conversation';
import User from '../../models/User';
import { SearchHistory, SavedSearch } from '../../models/SearchHistory';

describe('MessageSearchService', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;
    let userId: mongoose.Types.ObjectId;
    let conversationId: mongoose.Types.ObjectId;
    let messageIds: mongoose.Types.ObjectId[] = [];

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test data
        workplaceId = new mongoose.Types.ObjectId();
        userId = new mongoose.Types.ObjectId();
        conversationId = new mongoose.Types.ObjectId();

        // Create test user
        await User.create({
            _id: userId,
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            role: 'pharmacist',
            workplaceId,
        });

        // Create test conversation
        await Conversation.create({
            _id: conversationId,
            title: 'Test Conversation',
            type: 'patient_query',
            participants: [{
                userId,
                role: 'pharmacist',
                joinedAt: new Date(),
                permissions: ['read_messages', 'send_messages'],
            }],
            workplaceId,
            createdBy: userId,
        });

        // Create test messages
        const messages = [
            {
                conversationId,
                senderId: userId,
                content: {
                    text: 'Patient needs medication review for diabetes management',
                    type: 'text',
                },
                priority: 'normal',
                workplaceId,
                createdBy: userId,
            },
            {
                conversationId,
                senderId: userId,
                content: {
                    text: 'Urgent: Patient experiencing side effects from new prescription',
                    type: 'text',
                },
                priority: 'urgent',
                workplaceId,
                createdBy: userId,
            },
            {
                conversationId,
                senderId: userId,
                content: {
                    text: 'Lab results show improved glucose levels',
                    type: 'clinical_note',
                },
                priority: 'normal',
                workplaceId,
                createdBy: userId,
            },
        ];

        for (const messageData of messages) {
            const message = await Message.create(messageData);
            messageIds.push(message._id);
        }
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear search history before each test
        await SearchHistory.deleteMany({});
        await SavedSearch.deleteMany({});
    });

    describe('searchMessages', () => {
        it('should search messages by text query', async () => {
            const { results, stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { query: 'medication' }
            );

            expect(results).toHaveLength(1);
            expect(results[0].message.content.text).toContain('medication');
            expect(stats.totalResults).toBe(1);
            expect(stats.searchTime).toBeGreaterThan(0);
        });

        it('should filter messages by priority', async () => {
            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { priority: 'urgent' }
            );

            expect(results).toHaveLength(1);
            expect(results[0].message.priority).toBe('urgent');
        });

        it('should filter messages by type', async () => {
            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { messageType: 'clinical_note' }
            );

            expect(results).toHaveLength(1);
            expect(results[0].message.content.type).toBe('clinical_note');
        });

        it('should filter messages by date range', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    dateFrom: yesterday,
                    dateTo: tomorrow
                }
            );

            expect(results.length).toBeGreaterThan(0);
        });

        it('should sort messages by relevance when query is provided', async () => {
            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    query: 'patient',
                    sortBy: 'relevance'
                }
            );

            expect(results.length).toBeGreaterThan(0);
            // Results should be sorted by score (relevance)
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score || 0);
            }
        });

        it('should sort messages by date', async () => {
            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    sortBy: 'date',
                    sortOrder: 'desc'
                }
            );

            expect(results.length).toBeGreaterThan(0);
            // Results should be sorted by date (newest first)
            for (let i = 1; i < results.length; i++) {
                const prevDate = new Date(results[i - 1].message.createdAt);
                const currDate = new Date(results[i].message.createdAt);
                expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
            }
        });

        it('should include faceted results', async () => {
            const { stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { query: 'patient' }
            );

            expect(stats.facets).toBeDefined();
            expect(stats.facets.messageTypes).toBeDefined();
            expect(stats.facets.senders).toBeDefined();
            expect(stats.facets.conversations).toBeDefined();
        });

        it('should highlight search terms in results', async () => {
            const { results } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { query: 'medication' }
            );

            expect(results.length).toBeGreaterThan(0);
            const resultWithHighlight = results.find(r => r.highlights?.content);
            expect(resultWithHighlight?.highlights?.content).toContain('<mark>');
        });

        it('should respect pagination', async () => {
            const { results: page1 } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    limit: 2,
                    offset: 0
                }
            );

            const { results: page2 } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    limit: 2,
                    offset: 2
                }
            );

            expect(page1.length).toBeLessThanOrEqual(2);
            expect(page2.length).toBeLessThanOrEqual(2);

            // Ensure different results (if there are enough messages)
            if (page1.length > 0 && page2.length > 0) {
                expect(page1[0].message._id).not.toBe(page2[0].message._id);
            }
        });
    });

    describe('searchConversations', () => {
        it('should search conversations by title', async () => {
            const { results } = await messageSearchService.searchConversations(
                workplaceId.toString(),
                userId.toString(),
                { query: 'Test' }
            );

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].title).toContain('Test');
        });

        it('should filter conversations by priority', async () => {
            // Update conversation priority
            await Conversation.findByIdAndUpdate(conversationId, { priority: 'high' });

            const { results } = await messageSearchService.searchConversations(
                workplaceId.toString(),
                userId.toString(),
                { priority: 'high' }
            );

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].priority).toBe('high');
        });
    });

    describe('getSearchSuggestions', () => {
        it('should return search suggestions', async () => {
            const suggestions = await messageSearchService.getSearchSuggestions(
                workplaceId.toString(),
                userId.toString()
            );

            expect(suggestions).toBeDefined();
            expect(suggestions.suggestions).toBeDefined();
            expect(suggestions.popularSearches).toBeDefined();
            expect(suggestions.recentSearches).toBeDefined();
        });

        it('should return query-based suggestions', async () => {
            const suggestions = await messageSearchService.getSearchSuggestions(
                workplaceId.toString(),
                userId.toString(),
                'med'
            );

            expect(suggestions.suggestions.length).toBeGreaterThan(0);
            expect(suggestions.suggestions.some(s => s.includes('med'))).toBe(true);
        });
    });

    describe('saveSearchHistory', () => {
        it('should save search history', async () => {
            await messageSearchService.saveSearchHistory(
                userId.toString(),
                'test query',
                { query: 'test query', priority: 'normal' },
                5
            );

            const history = await SearchHistory.findOne({ userId, query: 'test query' });
            expect(history).toBeTruthy();
            expect(history?.resultCount).toBe(5);
            expect(history?.searchType).toBe('message');
        });
    });

    describe('performance tests', () => {
        beforeAll(async () => {
            // Create more test data for performance testing
            const bulkMessages = [];
            for (let i = 0; i < 100; i++) {
                bulkMessages.push({
                    conversationId,
                    senderId: userId,
                    content: {
                        text: `Test message ${i} about medication and patient care`,
                        type: 'text',
                    },
                    priority: i % 3 === 0 ? 'urgent' : 'normal',
                    workplaceId,
                    createdBy: userId,
                });
            }
            await Message.insertMany(bulkMessages);
        });

        it('should perform search within acceptable time limits', async () => {
            const startTime = Date.now();

            const { results, stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { query: 'medication' }
            );

            const executionTime = Date.now() - startTime;

            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
            expect(results.length).toBeGreaterThan(0);
            expect(stats.searchTime).toBeLessThan(500); // Internal search time should be under 500ms
        });

        it('should handle large result sets efficiently', async () => {
            const { results, stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                {
                    query: 'message',
                    limit: 50
                }
            );

            expect(results.length).toBeLessThanOrEqual(50);
            expect(stats.totalResults).toBeGreaterThan(50);
            expect(stats.searchTime).toBeLessThan(1000);
        });
    });

    describe('error handling', () => {
        it('should handle invalid user ID gracefully', async () => {
            const invalidUserId = new mongoose.Types.ObjectId().toString();

            const { results, stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                invalidUserId,
                { query: 'test' }
            );

            expect(results).toHaveLength(0);
            expect(stats.totalResults).toBe(0);
        });

        it('should handle invalid workplace ID gracefully', async () => {
            const invalidWorkplaceId = new mongoose.Types.ObjectId().toString();

            const { results, stats } = await messageSearchService.searchMessages(
                invalidWorkplaceId,
                userId.toString(),
                { query: 'test' }
            );

            expect(results).toHaveLength(0);
            expect(stats.totalResults).toBe(0);
        });

        it('should handle empty search query gracefully', async () => {
            const { results, stats } = await messageSearchService.searchMessages(
                workplaceId.toString(),
                userId.toString(),
                { query: '' }
            );

            expect(results).toHaveLength(0);
            expect(stats.totalResults).toBe(0);
        });
    });
});