import mongoose from 'mongoose';
import { KnowledgeBaseService } from '../../services/KnowledgeBaseService';
import { KnowledgeBaseArticle } from '../../models/KnowledgeBaseArticle';
import { RedisCacheService } from '../../services/RedisCacheService';

// Mock dependencies
jest.mock('../../models/KnowledgeBaseArticle');
jest.mock('../../services/RedisCacheService');

describe('KnowledgeBaseService', () => {
  let knowledgeBaseService: KnowledgeBaseService;
  let mockCacheService: jest.Mocked<RedisCacheService>;

  const mockAuthor = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com'
  };

  const mockArticleData = {
    title: 'How to Reset Your Password',
    content: 'This article explains how to reset your password...',
    excerpt: 'Learn how to reset your password in a few simple steps',
    category: 'Account Management',
    subcategory: 'Password',
    tags: ['password', 'reset', 'account'],
    authorId: mockAuthor._id.toString(),
    status: 'published' as const,
    isPublic: true
  };

  const mockArticle = {
    _id: new mongoose.Types.ObjectId(),
    title: mockArticleData.title,
    slug: 'how-to-reset-your-password',
    content: mockArticleData.content,
    excerpt: mockArticleData.excerpt,
    category: mockArticleData.category,
    subcategory: mockArticleData.subcategory,
    tags: mockArticleData.tags,
    authorId: mockAuthor._id,
    authorName: `${mockAuthor.firstName} ${mockAuthor.lastName}`,
    status: mockArticleData.status,
    isPublic: mockArticleData.isPublic,
    version: 1,
    viewCount: 0,
    helpfulVotes: 0,
    notHelpfulVotes: 0,
    searchKeywords: [],
    relatedArticles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
    incrementViewCount: jest.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn().mockResolvedValue(true)
    } as any;
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);

    knowledgeBaseService = KnowledgeBaseService.getInstance();
  });

  describe('createArticle', () => {
    beforeEach(() => {
      (KnowledgeBaseArticle.findOne as jest.Mock).mockResolvedValue(null);
      (KnowledgeBaseArticle as any).mockImplementation(() => mockArticle);
      
      // Mock mongoose model for User lookup
      const mockUserModel = {
        findById: jest.fn().mockResolvedValue(mockAuthor)
      };
      (mongoose.model as jest.Mock).mockReturnValue(mockUserModel);
    });

    it('should create an article successfully', async () => {
      const result = await knowledgeBaseService.createArticle(mockArticleData);

      expect(KnowledgeBaseArticle.findOne).toHaveBeenCalledWith({ 
        slug: 'how-to-reset-your-password' 
      });
      expect(KnowledgeBaseArticle).toHaveBeenCalledWith(expect.objectContaining({
        title: mockArticleData.title,
        slug: 'how-to-reset-your-password',
        content: mockArticleData.content,
        excerpt: mockArticleData.excerpt,
        category: mockArticleData.category,
        authorId: mockArticleData.authorId,
        authorName: `${mockAuthor.firstName} ${mockAuthor.lastName}`
      }));
      expect(mockArticle.save).toHaveBeenCalled();
      expect(result).toEqual(mockArticle);
    });

    it('should throw error if article with same slug exists', async () => {
      (KnowledgeBaseArticle.findOne as jest.Mock).mockResolvedValue(mockArticle);

      await expect(knowledgeBaseService.createArticle(mockArticleData))
        .rejects.toThrow('Failed to create knowledge base article');
    });

    it('should throw error if author not found', async () => {
      const mockUserModel = {
        findById: jest.fn().mockResolvedValue(null)
      };
      (mongoose.model as jest.Mock).mockReturnValue(mockUserModel);

      await expect(knowledgeBaseService.createArticle(mockArticleData))
        .rejects.toThrow('Failed to create knowledge base article');
    });

    it('should clear cache after article creation', async () => {
      await knowledgeBaseService.createArticle(mockArticleData);

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('kb:*');
    });
  });

  describe('getArticles', () => {
    const mockFilters = {
      status: ['published'],
      category: 'Account Management',
      isPublic: true
    };

    const mockPagination = {
      page: 1,
      limit: 20,
      sortBy: 'publishedAt',
      sortOrder: 'desc' as const
    };

    const mockArticles = [mockArticle];
    const mockTotalCount = 1;

    beforeEach(() => {
      (KnowledgeBaseArticle.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockArticles)
      });
      (KnowledgeBaseArticle.countDocuments as jest.Mock).mockResolvedValue(mockTotalCount);
    });

    it('should return articles with pagination', async () => {
      const result = await knowledgeBaseService.getArticles(mockFilters, mockPagination);

      expect(result).toEqual({
        articles: mockArticles,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: mockTotalCount,
          hasNext: false,
          hasPrev: false
        }
      });
    });

    it('should use cache when available', async () => {
      const cachedResult = { articles: mockArticles, pagination: {} };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await knowledgeBaseService.getArticles(mockFilters, mockPagination);

      expect(result).toEqual(cachedResult);
      expect(KnowledgeBaseArticle.find).not.toHaveBeenCalled();
    });

    it('should cache the result', async () => {
      await knowledgeBaseService.getArticles(mockFilters, mockPagination);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { ttl: 600 }
      );
    });
  });

  describe('getArticle', () => {
    const articleId = mockArticle._id.toString();
    const articleSlug = mockArticle.slug;

    beforeEach(() => {
      (KnowledgeBaseArticle.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockArticle)
      });
    });

    it('should get article by ID', async () => {
      const result = await knowledgeBaseService.getArticle(articleId);

      expect(KnowledgeBaseArticle.findOne).toHaveBeenCalledWith({ _id: articleId });
      expect(result).toEqual(mockArticle);
    });

    it('should get article by slug', async () => {
      const result = await knowledgeBaseService.getArticle(articleSlug);

      expect(KnowledgeBaseArticle.findOne).toHaveBeenCalledWith({ slug: articleSlug });
      expect(result).toEqual(mockArticle);
    });

    it('should increment view count when requested', async () => {
      await knowledgeBaseService.getArticle(articleId, true);

      expect(mockArticle.incrementViewCount).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should use cache when not incrementing view', async () => {
      mockCacheService.get.mockResolvedValue(mockArticle);

      const result = await knowledgeBaseService.getArticle(articleId, false);

      expect(result).toEqual(mockArticle);
      expect(KnowledgeBaseArticle.findOne).not.toHaveBeenCalled();
    });

    it('should cache the result when not incrementing view', async () => {
      await knowledgeBaseService.getArticle(articleId, false);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        mockArticle,
        { ttl: 600 }
      );
    });
  });

  describe('updateArticle', () => {
    const articleId = mockArticle._id.toString();
    const updatedById = new mongoose.Types.ObjectId().toString();
    const updates = {
      title: 'Updated Title',
      content: 'Updated content',
      status: 'published' as const
    };

    beforeEach(() => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(mockArticle);
      (KnowledgeBaseArticle.findOne as jest.Mock).mockResolvedValue(null);
    });

    it('should update article successfully', async () => {
      const result = await knowledgeBaseService.updateArticle(articleId, updates, updatedById);

      expect(KnowledgeBaseArticle.findById).toHaveBeenCalledWith(articleId);
      expect(Object.assign).toHaveBeenCalledWith(mockArticle, updates);
      expect(mockArticle.lastEditedBy).toEqual(new mongoose.Types.ObjectId(updatedById));
      expect(mockArticle.lastEditedAt).toBeInstanceOf(Date);
      expect(mockArticle.save).toHaveBeenCalled();
      expect(result).toEqual(mockArticle);
    });

    it('should throw error if article not found', async () => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(null);

      await expect(knowledgeBaseService.updateArticle(articleId, updates, updatedById))
        .rejects.toThrow('Failed to update article');
    });

    it('should check for slug conflicts when updating slug', async () => {
      const updatesWithSlug = { ...updates, slug: 'new-slug' };
      
      await knowledgeBaseService.updateArticle(articleId, updatesWithSlug, updatedById);

      expect(KnowledgeBaseArticle.findOne).toHaveBeenCalledWith({
        slug: 'new-slug',
        _id: { $ne: articleId }
      });
    });

    it('should throw error if slug already exists', async () => {
      const updatesWithSlug = { ...updates, slug: 'existing-slug' };
      (KnowledgeBaseArticle.findOne as jest.Mock).mockResolvedValue(mockArticle);

      await expect(knowledgeBaseService.updateArticle(articleId, updatesWithSlug, updatedById))
        .rejects.toThrow('Failed to update article');
    });

    it('should clear cache after update', async () => {
      await knowledgeBaseService.updateArticle(articleId, updates, updatedById);

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('kb:*');
    });
  });

  describe('deleteArticle', () => {
    const articleId = mockArticle._id.toString();
    const deletedById = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(mockArticle);
      (KnowledgeBaseArticle.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      (KnowledgeBaseArticle.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 0 });
    });

    it('should delete article successfully', async () => {
      await knowledgeBaseService.deleteArticle(articleId, deletedById);

      expect(KnowledgeBaseArticle.findById).toHaveBeenCalledWith(articleId);
      expect(KnowledgeBaseArticle.deleteOne).toHaveBeenCalledWith({ _id: articleId });
      expect(KnowledgeBaseArticle.updateMany).toHaveBeenCalledWith(
        { relatedArticles: articleId },
        { $pull: { relatedArticles: articleId } }
      );
    });

    it('should throw error if article not found', async () => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(null);

      await expect(knowledgeBaseService.deleteArticle(articleId, deletedById))
        .rejects.toThrow('Failed to delete article');
    });

    it('should clear cache after deletion', async () => {
      await knowledgeBaseService.deleteArticle(articleId, deletedById);

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('kb:*');
    });
  });

  describe('searchArticles', () => {
    const searchQuery = 'password reset';
    const mockSearchResults = [mockArticle];
    const mockTotalCount = 1;

    beforeEach(() => {
      (KnowledgeBaseArticle.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockSearchResults)
      });
      (KnowledgeBaseArticle.countDocuments as jest.Mock).mockResolvedValue(mockTotalCount);
    });

    it('should search articles successfully', async () => {
      const result = await knowledgeBaseService.searchArticles(searchQuery);

      expect(KnowledgeBaseArticle.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: searchQuery },
          status: 'published',
          isPublic: true
        }),
        { score: { $meta: 'textScore' } }
      );
      expect(result).toEqual({
        articles: mockSearchResults,
        totalCount: mockTotalCount,
        searchTime: expect.any(Number),
        suggestions: []
      });
    });

    it('should include filters in search query', async () => {
      const filters = { category: 'Account Management' };
      
      await knowledgeBaseService.searchArticles(searchQuery, filters);

      expect(KnowledgeBaseArticle.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: searchQuery },
          status: 'published',
          isPublic: true,
          category: 'Account Management'
        }),
        { score: { $meta: 'textScore' } }
      );
    });

    it('should apply pagination', async () => {
      const pagination = { page: 2, limit: 5 };
      
      await knowledgeBaseService.searchArticles(searchQuery, {}, pagination);

      const mockFind = KnowledgeBaseArticle.find as jest.Mock;
      const chainedMethods = mockFind.mock.results[0].value;
      expect(chainedMethods.skip).toHaveBeenCalledWith(5); // (page - 1) * limit
      expect(chainedMethods.limit).toHaveBeenCalledWith(5);
    });

    it('should return search time', async () => {
      const result = await knowledgeBaseService.searchArticles(searchQuery);

      expect(result.searchTime).toBeGreaterThan(0);
    });
  });

  describe('getCategories', () => {
    const mockCategories = [
      {
        category: 'Account Management',
        subcategories: ['Password', 'Profile'],
        count: 5
      },
      {
        category: 'Technical Support',
        subcategories: ['Troubleshooting'],
        count: 3
      }
    ];

    beforeEach(() => {
      (KnowledgeBaseArticle.aggregate as jest.Mock).mockResolvedValue(mockCategories);
    });

    it('should return categories with subcategories and counts', async () => {
      const result = await knowledgeBaseService.getCategories();

      expect(KnowledgeBaseArticle.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockCategories);

      const result = await knowledgeBaseService.getCategories();

      expect(result).toEqual(mockCategories);
      expect(KnowledgeBaseArticle.aggregate).not.toHaveBeenCalled();
    });

    it('should cache the result', async () => {
      await knowledgeBaseService.getCategories();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'kb:categories',
        mockCategories,
        { ttl: 3600 }
      );
    });
  });

  describe('getPopularTags', () => {
    const mockTags = [
      { tag: 'password', count: 10 },
      { tag: 'account', count: 8 },
      { tag: 'troubleshooting', count: 6 }
    ];

    beforeEach(() => {
      (KnowledgeBaseArticle.aggregate as jest.Mock).mockResolvedValue(mockTags);
    });

    it('should return popular tags with counts', async () => {
      const result = await knowledgeBaseService.getPopularTags(20);

      expect(KnowledgeBaseArticle.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockTags);
    });

    it('should use default limit when not specified', async () => {
      await knowledgeBaseService.getPopularTags();

      const aggregatePipeline = (KnowledgeBaseArticle.aggregate as jest.Mock).mock.calls[0][0];
      const limitStage = aggregatePipeline.find((stage: any) => stage.$limit);
      expect(limitStage.$limit).toBe(20);
    });

    it('should use cache when available', async () => {
      mockCacheService.get.mockResolvedValue(mockTags);

      const result = await knowledgeBaseService.getPopularTags();

      expect(result).toEqual(mockTags);
      expect(KnowledgeBaseArticle.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('voteOnArticle', () => {
    const articleId = mockArticle._id.toString();

    beforeEach(() => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(mockArticle);
    });

    it('should increment helpful votes', async () => {
      const result = await knowledgeBaseService.voteOnArticle(articleId, true);

      expect(mockArticle.helpfulVotes).toBe(1);
      expect(mockArticle.save).toHaveBeenCalled();
      expect(result).toEqual(mockArticle);
    });

    it('should increment not helpful votes', async () => {
      const result = await knowledgeBaseService.voteOnArticle(articleId, false);

      expect(mockArticle.notHelpfulVotes).toBe(1);
      expect(mockArticle.save).toHaveBeenCalled();
      expect(result).toEqual(mockArticle);
    });

    it('should throw error if article not found', async () => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(null);

      await expect(knowledgeBaseService.voteOnArticle(articleId, true))
        .rejects.toThrow('Failed to vote on article');
    });

    it('should clear cache after voting', async () => {
      await knowledgeBaseService.voteOnArticle(articleId, true);

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('kb:*');
    });
  });

  describe('getRelatedArticles', () => {
    const articleId = mockArticle._id.toString();
    const mockRelatedArticles = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Related Article 1',
        slug: 'related-article-1',
        excerpt: 'This is a related article',
        category: 'Account Management'
      }
    ];

    beforeEach(() => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(mockArticle);
      (KnowledgeBaseArticle.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockRelatedArticles)
      });
    });

    it('should return related articles', async () => {
      const result = await knowledgeBaseService.getRelatedArticles(articleId, 5);

      expect(KnowledgeBaseArticle.findById).toHaveBeenCalledWith(articleId);
      expect(KnowledgeBaseArticle.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $ne: articleId },
          status: 'published',
          isPublic: true,
          $or: [
            { category: mockArticle.category },
            { tags: { $in: mockArticle.tags } },
            { searchKeywords: { $in: mockArticle.searchKeywords } }
          ]
        })
      );
      expect(result).toEqual(mockRelatedArticles);
    });

    it('should throw error if article not found', async () => {
      (KnowledgeBaseArticle.findById as jest.Mock).mockResolvedValue(null);

      await expect(knowledgeBaseService.getRelatedArticles(articleId))
        .rejects.toThrow('Failed to fetch related articles');
    });

    it('should use default limit when not specified', async () => {
      await knowledgeBaseService.getRelatedArticles(articleId);

      const mockFind = KnowledgeBaseArticle.find as jest.Mock;
      const chainedMethods = mockFind.mock.results[0].value;
      expect(chainedMethods.limit).toHaveBeenCalledWith(5);
    });
  });
});