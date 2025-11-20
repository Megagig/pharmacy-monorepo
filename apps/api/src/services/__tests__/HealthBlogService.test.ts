/**
 * Unit tests for HealthBlogService
 * Tests public API functionality for blog posts
 */

import mongoose from 'mongoose';
import HealthBlogPost, { IHealthBlogPost } from '../../models/HealthBlogPost';
import HealthBlogService from '../HealthBlogService';
import { createValidationError, createNotFoundError } from '../../utils/responseHelpers';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

// Mock the response helpers
jest.mock('../../utils/responseHelpers', () => ({
  createValidationError: jest.fn((message: string) => new Error(message)),
  createNotFoundError: jest.fn((resource: string, id: string) => new Error(`${resource} not found: ${id}`)),
}));

describe('HealthBlogService', () => {
  // Mock data
  const mockPost: Partial<IHealthBlogPost> = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    excerpt: 'This is a test blog post excerpt',
    content: '<p>This is the full content of the test blog post with <strong>HTML</strong> tags.</p>',
    featuredImage: {
      url: 'https://example.com/image.jpg',
      alt: 'Test image',
      caption: 'Test caption',
    },
    category: 'nutrition',
    tags: ['health', 'nutrition', 'wellness'],
    author: {
      id: new mongoose.Types.ObjectId(),
      name: 'Dr. Test Author',
      avatar: 'https://example.com/avatar.jpg',
    },
    status: 'published',
    publishedAt: new Date('2024-01-15'),
    readTime: 5,
    viewCount: 100,
    isFeatured: true,
    seo: {
      metaTitle: 'Test Blog Post - Health Tips',
      metaDescription: 'Learn about health and nutrition in this comprehensive guide',
      keywords: ['health', 'nutrition', 'wellness'],
    },
    relatedPosts: [],
    isDeleted: false,
  };

  const mockPosts = [
    { ...mockPost, _id: new mongoose.Types.ObjectId(), slug: 'post-1' },
    { ...mockPost, _id: new mongoose.Types.ObjectId(), slug: 'post-2', isFeatured: false },
    { ...mockPost, _id: new mongoose.Types.ObjectId(), slug: 'post-3', category: 'wellness' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublishedPosts', () => {
    it('should return published posts with pagination', async () => {
      // Mock Mongoose methods
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockPosts);
      const mockCountDocuments = jest.fn().mockResolvedValue(3);
      const mockAggregate = jest.fn().mockResolvedValue([
        { category: 'nutrition', count: 2 },
        { category: 'wellness', count: 1 },
      ]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        skip: mockSkip,
      });
      mockSkip.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });
      mockLean.mockReturnValue({
        exec: mockExec,
      });

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;

      const result = await HealthBlogService.getPublishedPosts();

      expect(mockFind).toHaveBeenCalledWith({
        status: 'published',
        isDeleted: false,
      });
      expect(result.posts).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.filters.categories).toHaveLength(2);
    });

    it('should apply category filter', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue([mockPosts[0]]);
      const mockCountDocuments = jest.fn().mockResolvedValue(1);
      const mockAggregate = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        skip: mockSkip,
      });
      mockSkip.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });
      mockLean.mockReturnValue({
        exec: mockExec,
      });

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;

      await HealthBlogService.getPublishedPosts({ category: 'nutrition' });

      expect(mockFind).toHaveBeenCalledWith({
        status: 'published',
        isDeleted: false,
        category: 'nutrition',
      });
    });

    it('should apply search filter', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue([mockPosts[0]]);
      const mockCountDocuments = jest.fn().mockResolvedValue(1);
      const mockAggregate = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        skip: mockSkip,
      });
      mockSkip.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });
      mockLean.mockReturnValue({
        exec: mockExec,
      });

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;

      await HealthBlogService.getPublishedPosts({ search: 'nutrition' });

      expect(mockFind).toHaveBeenCalledWith({
        status: 'published',
        isDeleted: false,
        $text: { $search: 'nutrition' },
      });
    });

    it('should limit posts per page to maximum of 50', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockCountDocuments = jest.fn().mockResolvedValue(0);
      const mockAggregate = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        skip: mockSkip,
      });
      mockSkip.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });
      mockLean.mockReturnValue({
        exec: mockExec,
      });

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;

      await HealthBlogService.getPublishedPosts({}, { limit: 100 });

      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });

  describe('getPostBySlug', () => {
    it('should return post by slug', async () => {
      const mockFindOne = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockPost);

      HealthBlogPost.findOne = mockFindOne;
      mockFindOne.mockReturnValue({
        lean: mockLean,
      });

      // Mock the getRelatedPostsByPost method
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLeanRelated = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLeanRelated,
      });

      const result = await HealthBlogService.getPostBySlug('test-blog-post');

      expect(mockFindOne).toHaveBeenCalledWith({
        slug: 'test-blog-post',
        status: 'published',
        isDeleted: false,
      });
      expect(result).toBeTruthy();
      expect(result?.title).toBe('Test Blog Post');
      expect(result?.url).toBe('/blog/test-blog-post');
      expect(result?.wordCount).toBeGreaterThan(0);
    });

    it('should return null for non-existent slug', async () => {
      const mockFindOne = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(null);

      HealthBlogPost.findOne = mockFindOne;
      mockFindOne.mockReturnValue({
        lean: mockLean,
      });

      const result = await HealthBlogService.getPostBySlug('non-existent-slug');

      expect(result).toBeNull();
    });

    it('should throw validation error for invalid slug', async () => {
      const mockError = new Error('Valid slug is required');
      (createValidationError as jest.Mock).mockReturnValue(mockError);
      
      await expect(HealthBlogService.getPostBySlug('')).rejects.toThrow('Valid slug is required');
      expect(createValidationError).toHaveBeenCalledWith('Valid slug is required');
    });
  });

  describe('getFeaturedPosts', () => {
    it('should return featured posts', async () => {
      const featuredPosts = [mockPosts[0]]; // Only first post is featured
      
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(featuredPosts);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });

      const result = await HealthBlogService.getFeaturedPosts(3);

      expect(mockFind).toHaveBeenCalledWith({
        status: 'published',
        isFeatured: true,
        isDeleted: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(3);
      expect(result).toHaveLength(1);
      expect(result[0].isFeatured).toBe(true);
    });

    it('should limit featured posts to maximum of 10', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });

      await HealthBlogService.getFeaturedPosts(20);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe('getRelatedPosts', () => {
    it('should return related posts for existing post', async () => {
      const mockFindOne = jest.fn().mockResolvedValue(mockPost);
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([mockPosts[1]]);

      HealthBlogPost.findOne = mockFindOne;
      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });

      const result = await HealthBlogService.getRelatedPosts(mockPost._id!, 3);

      expect(mockFindOne).toHaveBeenCalledWith({
        _id: mockPost._id,
        status: 'published',
        isDeleted: false,
      });
      expect(result).toHaveLength(1);
    });

    it('should throw error for non-existent post', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const mockError = new Error(`Blog post not found: ${nonExistentId.toString()}`);
      (createNotFoundError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindOne = jest.fn().mockResolvedValue(null);
      HealthBlogPost.findOne = mockFindOne;

      await expect(HealthBlogService.getRelatedPosts(nonExistentId, 3)).rejects.toThrow(`Blog post not found: ${nonExistentId.toString()}`);
      expect(createNotFoundError).toHaveBeenCalledWith('Blog post', nonExistentId.toString());
    });
  });

  describe('searchPosts', () => {
    it('should search posts with valid query', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue([mockPosts[0]]);
      const mockCountDocuments = jest.fn().mockResolvedValue(1);
      const mockAggregate = jest.fn().mockResolvedValue([]);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        skip: mockSkip,
      });
      mockSkip.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });
      mockLean.mockReturnValue({
        exec: mockExec,
      });

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;

      const result = await HealthBlogService.searchPosts('nutrition health');

      expect(result.posts).toHaveLength(1);
    });

    it('should throw validation error for short search query', async () => {
      const mockError = new Error('Search query must be at least 2 characters long');
      (createValidationError as jest.Mock).mockReturnValue(mockError);
      
      await expect(HealthBlogService.searchPosts('a')).rejects.toThrow('Search query must be at least 2 characters long');
      expect(createValidationError).toHaveBeenCalledWith('Search query must be at least 2 characters long');
    });

    it('should throw validation error for empty search query', async () => {
      const mockError = new Error('Search query must be at least 2 characters long');
      (createValidationError as jest.Mock).mockReturnValue(mockError);
      
      await expect(HealthBlogService.searchPosts('')).rejects.toThrow('Search query must be at least 2 characters long');
      expect(createValidationError).toHaveBeenCalledWith('Search query must be at least 2 characters long');
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count for existing post', async () => {
      const mockUpdateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
      HealthBlogPost.updateOne = mockUpdateOne;

      const postId = new mongoose.Types.ObjectId();
      await HealthBlogService.incrementViewCount(postId);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: postId,
          status: 'published',
          isDeleted: false,
        },
        {
          $inc: { viewCount: 1 },
        }
      );
    });

    it('should not throw error for non-existent post', async () => {
      const mockUpdateOne = jest.fn().mockResolvedValue({ matchedCount: 0 });
      HealthBlogPost.updateOne = mockUpdateOne;

      const postId = new mongoose.Types.ObjectId();
      
      // Should not throw error
      await expect(HealthBlogService.incrementViewCount(postId)).resolves.toBeUndefined();
    });
  });

  describe('getCategories', () => {
    it('should return categories with labels', async () => {
      const mockAggregate = jest.fn().mockResolvedValue([
        { category: 'nutrition', count: 5 },
        { category: 'wellness', count: 3 },
      ]);

      HealthBlogPost.aggregate = mockAggregate;

      const result = await HealthBlogService.getCategories();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        category: 'nutrition',
        count: 5,
        label: 'Nutrition & Diet',
      });
      expect(result[1]).toEqual({
        category: 'wellness',
        count: 3,
        label: 'Wellness & Lifestyle',
      });
    });
  });

  describe('getPopularPosts', () => {
    it('should return posts sorted by view count', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockPosts);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });

      const result = await HealthBlogService.getPopularPosts(5);

      expect(mockSort).toHaveBeenCalledWith({ viewCount: -1, publishedAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(3);
    });
  });

  describe('getRecentPosts', () => {
    it('should return posts sorted by published date', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockPosts);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        sort: mockSort,
      });
      mockSort.mockReturnValue({
        limit: mockLimit,
      });
      mockLimit.mockReturnValue({
        lean: mockLean,
      });

      const result = await HealthBlogService.getRecentPosts(6);

      expect(mockSort).toHaveBeenCalledWith({ publishedAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(6);
      expect(result).toHaveLength(3);
    });
  });
});