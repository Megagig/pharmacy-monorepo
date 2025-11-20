import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { SearchHistory, SavedSearch } from '../../models/SearchHistory';
import { generateToken } from '../../utils/token';

describe('Search API Endpoints', () => {
    let mongoServer: MongoMemoryServer;
    let authToken: string;
    let userId: mongoose.Types.ObjectId;
    let workplaceId: mongoose.Types.ObjectId;
    let conversationId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test data
        workplaceId = new mongoose.Types.ObjectId();
        userId = new mongoose.Types.ObjectId();
        conversationId = new mongoose.Types.ObjectId();

        // Create test user
        const user = await User.create({
            _id: userId,
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId,
        });

        authToken = generateToken(user._id.toString(), workplaceId.toString());

        // Create test conversation
        await Conversation.create({
            _id: conversationId,
            title: 'Patient Medication Review',
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
        await Message.create([
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
                    text: 'Urgent: Patient experiencing side effects from prescription',
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
                    text: 'Lab results attached for review',
                    type: 'file',
                    attachments: [{
                        fileId: 'file123',
                        fileName: 'lab_results.pdf',
                        fileSize: 1024,
                        mimeType: 'application/pdf',
                        secureUrl: 'https://example.com/file123',
                        uploadedAt: new Date(),
                    }],
                },
                priority: 'normal',
                workplaceId,
                createdBy: userId,
            },
        ]);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear search history and saved searches before each test
        await SearchHistory.deleteMany({});
        await SavedSearch.deleteMany({});
    });

    describe('GET /api/communication/search/messages', () => {
        it('should search messages successfully', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=medication')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.stats).toBeDefined();
            expect(response.body.stats.totalResults).toBeGreaterThan(0);
            expect(response.body.stats.searchTime).toBeGreaterThan(0);
        });

        it('should filter messages by priority', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=patient&priority=urgent')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);

            if (response.body.data.length > 0) {
                expect(response.body.data[0].message.priority).toBe('urgent');
            }
        });

        it('should filter messages by type', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=results&type=file')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);

            if (response.body.data.length > 0) {
                expect(response.body.data[0].message.content.type).toBe('file');
            }
        });

        it('should filter messages by date range', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const response = await request(app)
                .get(`/api/communication/search/messages?q=patient&dateFrom=${yesterday.toISOString()}&dateTo=${tomorrow.toISOString()}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=patient&limit=1&offset=0')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeLessThanOrEqual(1);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.limit).toBe(1);
            expect(response.body.pagination.offset).toBe(0);
        });

        it('should sort messages by relevance', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages?q=patient&sortBy=relevance&sortOrder=desc')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);

            // Check that results are sorted by score (relevance)
            for (let i = 1; i < response.body.data.length; i++) {
                const prevScore = response.body.data[i - 1].score || 0;
                const currScore = response.body.data[i].score || 0;
                expect(prevScore).toBeGreaterThanOrEqual(currScore);
            }
        });

        it('should create search history entry', async () => {
            await request(app)
                .get('/api/communication/search/messages?q=medication')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const searchHistory = await SearchHistory.findOne({
                userId,
                query: 'medication',
                searchType: 'message'
            });

            expect(searchHistory).toBeTruthy();
            expect(searchHistory?.resultCount).toBeGreaterThanOrEqual(0);
            expect(searchHistory?.executionTime).toBeGreaterThan(0);
        });

        it('should return validation error for missing query', async () => {
            const response = await request(app)
                .get('/api/communication/search/messages')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation errors');
        });

        it('should return 401 for unauthenticated request', async () => {
            await request(app)
                .get('/api/communication/search/messages?q=medication')
                .expect(401);
        });
    });

    describe('GET /api/communication/search/conversations', () => {
        it('should search conversations successfully', async () => {
            const response = await request(app)
                .get('/api/communication/search/conversations?q=medication')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.stats).toBeDefined();
        });

        it('should filter conversations by priority', async () => {
            // Update conversation priority
            await Conversation.findByIdAndUpdate(conversationId, { priority: 'high' });

            const response = await request(app)
                .get('/api/communication/search/conversations?q=patient&priority=high')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);

            if (response.body.data.length > 0) {
                expect(response.body.data[0].priority).toBe('high');
            }
        });
    });

    describe('GET /api/communication/search/suggestions', () => {
        it('should return search suggestions', async () => {
            const response = await request(app)
                .get('/api/communication/search/suggestions')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.suggestions).toBeInstanceOf(Array);
            expect(response.body.data.popularSearches).toBeInstanceOf(Array);
            expect(response.body.data.recentSearches).toBeInstanceOf(Array);
        });

        it('should return query-based suggestions', async () => {
            const response = await request(app)
                .get('/api/communication/search/suggestions?q=med')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.suggestions).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/communication/search/history', () => {
        beforeEach(async () => {
            // Create some search history
            await SearchHistory.create([
                {
                    userId,
                    workplaceId,
                    query: 'medication review',
                    filters: { priority: 'normal' },
                    resultCount: 5,
                    searchType: 'message',
                    executionTime: 45,
                },
                {
                    userId,
                    workplaceId,
                    query: 'patient consultation',
                    filters: {},
                    resultCount: 3,
                    searchType: 'conversation',
                    executionTime: 32,
                },
            ]);
        });

        it('should return user search history', async () => {
            const response = await request(app)
                .get('/api/communication/search/history')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should filter history by search type', async () => {
            const response = await request(app)
                .get('/api/communication/search/history?type=message')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);

            response.body.data.forEach((item: any) => {
                expect(item.searchType).toBe('message');
            });
        });

        it('should limit history results', async () => {
            const response = await request(app)
                .get('/api/communication/search/history?limit=1')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeLessThanOrEqual(1);
        });
    });

    describe('GET /api/communication/search/popular', () => {
        beforeEach(async () => {
            // Create popular searches
            await SearchHistory.create([
                {
                    userId,
                    workplaceId,
                    query: 'medication',
                    filters: {},
                    resultCount: 10,
                    searchType: 'message',
                    executionTime: 45,
                },
                {
                    userId: new mongoose.Types.ObjectId(),
                    workplaceId,
                    query: 'medication',
                    filters: {},
                    resultCount: 8,
                    searchType: 'message',
                    executionTime: 52,
                },
                {
                    userId,
                    workplaceId,
                    query: 'prescription',
                    filters: {},
                    resultCount: 5,
                    searchType: 'message',
                    executionTime: 38,
                },
            ]);
        });

        it('should return popular searches', async () => {
            const response = await request(app)
                .get('/api/communication/search/popular')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);

            // Should be sorted by count
            for (let i = 1; i < response.body.data.length; i++) {
                expect(response.body.data[i - 1].count).toBeGreaterThanOrEqual(response.body.data[i].count);
            }
        });
    });

    describe('POST /api/communication/search/save', () => {
        it('should save a search successfully', async () => {
            const searchData = {
                name: 'Urgent Medication Issues',
                description: 'Search for urgent medication-related messages',
                query: 'medication',
                filters: { priority: 'urgent' },
                searchType: 'message',
                isPublic: false,
            };

            const response = await request(app)
                .post('/api/communication/search/save')
                .set('Authorization', `Bearer ${authToken}`)
                .send(searchData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.name).toBe(searchData.name);
            expect(response.body.data.query).toBe(searchData.query);

            // Verify in database
            const savedSearch = await SavedSearch.findById(response.body.data._id);
            expect(savedSearch).toBeTruthy();
            expect(savedSearch?.name).toBe(searchData.name);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/communication/search/save')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation errors');
        });
    });

    describe('GET /api/communication/search/saved', () => {
        beforeEach(async () => {
            // Create saved searches
            await SavedSearch.create([
                {
                    userId,
                    workplaceId,
                    name: 'My Medication Search',
                    query: 'medication',
                    filters: { priority: 'urgent' },
                    searchType: 'message',
                    isPublic: false,
                    useCount: 5,
                },
                {
                    userId: new mongoose.Types.ObjectId(),
                    workplaceId,
                    name: 'Public Patient Search',
                    query: 'patient',
                    filters: {},
                    searchType: 'message',
                    isPublic: true,
                    useCount: 10,
                },
            ]);
        });

        it('should return user saved searches', async () => {
            const response = await request(app)
                .get('/api/communication/search/saved')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should include public searches when requested', async () => {
            const response = await request(app)
                .get('/api/communication/search/saved?includePublic=true')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.userSearches).toBeInstanceOf(Array);
            expect(response.body.data.publicSearches).toBeInstanceOf(Array);
        });
    });

    describe('POST /api/communication/search/saved/:searchId/use', () => {
        let savedSearchId: string;

        beforeEach(async () => {
            const savedSearch = await SavedSearch.create({
                userId,
                workplaceId,
                name: 'Test Search',
                query: 'test',
                filters: {},
                searchType: 'message',
                isPublic: false,
                useCount: 0,
            });
            savedSearchId = savedSearch._id.toString();
        });

        it('should increment use count for saved search', async () => {
            const response = await request(app)
                .post(`/api/communication/search/saved/${savedSearchId}/use`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.useCount).toBe(1);
            expect(response.body.data.lastUsed).toBeDefined();

            // Verify in database
            const updatedSearch = await SavedSearch.findById(savedSearchId);
            expect(updatedSearch?.useCount).toBe(1);
            expect(updatedSearch?.lastUsed).toBeDefined();
        });

        it('should return 404 for non-existent search', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .post(`/api/communication/search/saved/${fakeId}/use`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Saved search not found');
        });
    });

    describe('DELETE /api/communication/search/saved/:searchId', () => {
        let savedSearchId: string;

        beforeEach(async () => {
            const savedSearch = await SavedSearch.create({
                userId,
                workplaceId,
                name: 'Test Search',
                query: 'test',
                filters: {},
                searchType: 'message',
                isPublic: false,
                useCount: 0,
            });
            savedSearchId = savedSearch._id.toString();
        });

        it('should delete saved search successfully', async () => {
            const response = await request(app)
                .delete(`/api/communication/search/saved/${savedSearchId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Saved search deleted successfully');

            // Verify deletion in database
            const deletedSearch = await SavedSearch.findById(savedSearchId);
            expect(deletedSearch).toBeNull();
        });

        it('should return 404 for non-existent search', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .delete(`/api/communication/search/saved/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Saved search not found or access denied');
        });
    });
});