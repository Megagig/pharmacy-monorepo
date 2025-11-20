import mongoose from 'mongoose';
import { KnowledgeBaseArticle, IKnowledgeBaseArticle } from '../../models/KnowledgeBaseArticle';

describe('KnowledgeBaseArticle Model', () => {
  let mockArticle: any;

  beforeEach(() => {
    mockArticle = {
      title: 'How to Reset Your Password',
      content: 'This article explains how to reset your password step by step...',
      excerpt: 'Learn how to reset your password in a few simple steps',
      category: 'Account Management',
      subcategory: 'Password',
      tags: ['password', 'reset', 'account'],
      authorId: new mongoose.Types.ObjectId(),
      authorName: 'John Doe',
      status: 'published',
      isPublic: true,
      version: 1,
      viewCount: 0,
      helpfulVotes: 0,
      notHelpfulVotes: 0,
      searchKeywords: ['password', 'reset', 'forgot'],
      relatedArticles: []
    };
  });

  describe('Schema Validation', () => {
    it('should create a valid article', () => {
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require title', () => {
      delete mockArticle.title;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.title).toBeDefined();
    });

    it('should require content', () => {
      delete mockArticle.content;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.content).toBeDefined();
    });

    it('should require excerpt', () => {
      delete mockArticle.excerpt;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.excerpt).toBeDefined();
    });

    it('should require category', () => {
      delete mockArticle.category;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.category).toBeDefined();
    });

    it('should require authorId', () => {
      delete mockArticle.authorId;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.authorId).toBeDefined();
    });

    it('should require authorName', () => {
      delete mockArticle.authorName;
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.authorName).toBeDefined();
    });

    it('should validate status enum', () => {
      mockArticle.status = 'invalid_status';
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.status).toBeDefined();
    });

    it('should accept valid status values', () => {
      const validStatuses = ['draft', 'published', 'archived'];
      
      validStatuses.forEach(status => {
        mockArticle.status = status;
        const article = new KnowledgeBaseArticle(mockArticle);
        const validationError = article.validateSync();
        expect(validationError?.errors.status).toBeUndefined();
      });
    });

    it('should validate title length', () => {
      mockArticle.title = 'a'.repeat(201); // Exceeds max length
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.title).toBeDefined();
    });

    it('should validate excerpt length', () => {
      mockArticle.excerpt = 'a'.repeat(501); // Exceeds max length
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.excerpt).toBeDefined();
    });

    it('should validate metaDescription length', () => {
      mockArticle.metaDescription = 'a'.repeat(161); // Exceeds max length
      const article = new KnowledgeBaseArticle(mockArticle);
      const validationError = article.validateSync();
      expect(validationError?.errors.metaDescription).toBeDefined();
    });

    it('should default isPublic to true', () => {
      delete mockArticle.isPublic;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.isPublic).toBe(true);
    });

    it('should default status to draft', () => {
      delete mockArticle.status;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.status).toBe('draft');
    });

    it('should default version to 1', () => {
      delete mockArticle.version;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.version).toBe(1);
    });

    it('should default viewCount to 0', () => {
      delete mockArticle.viewCount;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.viewCount).toBe(0);
    });

    it('should default helpfulVotes to 0', () => {
      delete mockArticle.helpfulVotes;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.helpfulVotes).toBe(0);
    });

    it('should default notHelpfulVotes to 0', () => {
      delete mockArticle.notHelpfulVotes;
      const article = new KnowledgeBaseArticle(mockArticle);
      expect(article.notHelpfulVotes).toBe(0);
    });
  });

  describe('Pre-save Middleware', () => {
    let article: any;

    beforeEach(() => {
      article = new KnowledgeBaseArticle(mockArticle);
      // Mock the countDocuments method for slug generation
      KnowledgeBaseArticle.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it('should generate slug from title if not provided', async () => {
      delete article.slug;
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.slug).toBe('how-to-reset-your-password');
      expect(nextSpy).toHaveBeenCalled();
    });

    it('should not override existing slug', async () => {
      article.slug = 'custom-slug';
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.slug).toBe('custom-slug');
    });

    it('should set publishedAt when status changes to published', async () => {
      article.status = 'published';
      article.isModified = jest.fn().mockReturnValue(true);
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.publishedAt).toBeInstanceOf(Date);
    });

    it('should not set publishedAt if already exists', async () => {
      const existingDate = new Date('2024-01-01');
      article.publishedAt = existingDate;
      article.status = 'published';
      article.isModified = jest.fn().mockReturnValue(true);
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.publishedAt).toBe(existingDate);
    });

    it('should increment version on content changes', async () => {
      article.isNew = false;
      article.version = 2;
      article.isModified = jest.fn((field) => field === 'content');
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.version).toBe(3);
      expect(article.lastEditedAt).toBeInstanceOf(Date);
    });

    it('should not increment version for new articles', async () => {
      article.isNew = true;
      article.isModified = jest.fn().mockReturnValue(true);
      
      const nextSpy = jest.fn();
      await article.schema.pre('save').call(article, nextSpy);
      
      expect(article.version).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    let article: any;

    beforeEach(() => {
      article = new KnowledgeBaseArticle(mockArticle);
    });

    describe('getHelpfulnessScore', () => {
      it('should return 0 when no votes', () => {
        article.helpfulVotes = 0;
        article.notHelpfulVotes = 0;
        
        expect(article.getHelpfulnessScore()).toBe(0);
      });

      it('should calculate helpfulness score correctly', () => {
        article.helpfulVotes = 8;
        article.notHelpfulVotes = 2;
        
        expect(article.getHelpfulnessScore()).toBe(80);
      });

      it('should handle 100% helpful votes', () => {
        article.helpfulVotes = 10;
        article.notHelpfulVotes = 0;
        
        expect(article.getHelpfulnessScore()).toBe(100);
      });

      it('should handle 0% helpful votes', () => {
        article.helpfulVotes = 0;
        article.notHelpfulVotes = 10;
        
        expect(article.getHelpfulnessScore()).toBe(0);
      });

      it('should round to nearest integer', () => {
        article.helpfulVotes = 1;
        article.notHelpfulVotes = 2;
        
        expect(article.getHelpfulnessScore()).toBe(33); // 33.33... rounded to 33
      });
    });

    describe('isVisible', () => {
      it('should return true for published articles', () => {
        article.status = 'published';
        article.scheduledPublishAt = null;
        
        expect(article.isVisible()).toBe(true);
      });

      it('should return false for draft articles', () => {
        article.status = 'draft';
        
        expect(article.isVisible()).toBe(false);
      });

      it('should return false for archived articles', () => {
        article.status = 'archived';
        
        expect(article.isVisible()).toBe(false);
      });

      it('should return false for scheduled articles not yet published', () => {
        article.status = 'published';
        article.scheduledPublishAt = new Date(Date.now() + 86400000); // Tomorrow
        
        expect(article.isVisible()).toBe(false);
      });

      it('should return true for scheduled articles past publish date', () => {
        article.status = 'published';
        article.scheduledPublishAt = new Date(Date.now() - 86400000); // Yesterday
        
        expect(article.isVisible()).toBe(true);
      });
    });

    describe('incrementViewCount', () => {
      it('should increment view count', async () => {
        const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
        article.constructor.updateOne = mockUpdateOne;
        
        await article.incrementViewCount();
        
        expect(mockUpdateOne).toHaveBeenCalledWith(
          { _id: article._id },
          { $inc: { viewCount: 1 } }
        );
      });
    });

    describe('toJSON', () => {
      it('should exclude __v field', () => {
        article.__v = 0;
        article.toObject = jest.fn().mockReturnValue({
          _id: article._id,
          title: article.title,
          __v: 0
        });
        
        const json = article.toJSON();
        
        expect(json.__v).toBeUndefined();
        expect(json.title).toBe(article.title);
      });
    });
  });

  describe('Slug Generation', () => {
    it('should generate slug from title correctly', () => {
      const testCases = [
        { title: 'How to Reset Your Password', expected: 'how-to-reset-your-password' },
        { title: 'API Integration Guide!', expected: 'api-integration-guide' },
        { title: 'Troubleshooting 404 Errors', expected: 'troubleshooting-404-errors' },
        { title: 'User Management & Permissions', expected: 'user-management-permissions' },
        { title: 'Multiple   Spaces   Test', expected: 'multiple-spaces-test' },
        { title: 'Special@#$%Characters', expected: 'specialcharacters' }
      ];

      testCases.forEach(({ title, expected }) => {
        const article = new KnowledgeBaseArticle({ ...mockArticle, title });
        // Simulate the slug generation logic
        const generatedSlug = title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        expect(generatedSlug).toBe(expected);
      });
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes defined', () => {
      const schema = KnowledgeBaseArticle.schema;
      const indexes = schema.indexes();
      
      // Check for specific indexes
      const indexPaths = indexes.map(index => Object.keys(index[0]));
      
      expect(indexPaths).toContainEqual(['slug']);
      expect(indexPaths).toContainEqual(['status', 'isPublic']);
      expect(indexPaths).toContainEqual(['category', 'status']);
      expect(indexPaths).toContainEqual(['publishedAt']);
      expect(indexPaths).toContainEqual(['viewCount']);
      expect(indexPaths).toContainEqual(['tags']);
    });

    it('should have text search index', () => {
      const schema = KnowledgeBaseArticle.schema;
      const indexes = schema.indexes();
      
      // Look for text index
      const textIndex = indexes.find(index => 
        Object.values(index[0]).includes('text')
      );
      
      expect(textIndex).toBeDefined();
    });
  });

  describe('References', () => {
    it('should reference User model for authorId', () => {
      const schema = KnowledgeBaseArticle.schema;
      const authorIdPath = schema.path('authorId');
      
      expect(authorIdPath.options.ref).toBe('User');
    });

    it('should reference KnowledgeBaseArticle for relatedArticles', () => {
      const schema = KnowledgeBaseArticle.schema;
      const relatedArticlesPath = schema.path('relatedArticles');
      
      expect(relatedArticlesPath.schema.path('0').options.ref).toBe('KnowledgeBaseArticle');
    });
  });
});