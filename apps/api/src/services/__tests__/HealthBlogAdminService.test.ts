/**
 * Unit tests for HealthBlogAdminService
 * Tests Super Admin blog management functionality
 */

import mongoose from 'mongoose';
import HealthBlogPost, { IHealthBlogPost } from '../../models/HealthBlogPost';
import User, { IUser } from '../../models/User';
import HealthBlogAdminService from '../HealthBlogAdminService';
import { createNotFoundError, createValidationError, createBusinessRuleError } from '../../utils/responseHelpers';

// Extend the HealthBlogPost type to include static methods for testing
declare module '../../models/HealthBlogPost' {
  namespace HealthBlogPost {
    function ensureUniqueSlug(baseSlug: string, excludeId?: mongoose.Types.ObjectId): Promise<string>;
  }
}
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
  createBusinessRuleError: jest.fn((message: string) => new Error(message)),
}));

// Mock HealthBlogPost
jest.mock('../../models/HealthBlogPost', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  
  const mockHealthBlogPost: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new (require('mongoose')).Types.ObjectId(),
    save: mockSave,
  }));
  
  mockHealthBlogPost.ensureUniqueSlug = jest.fn();
  mockHealthBlogPost.findOne = jest.fn();
  mockHealthBlogPost.updateOne = jest.fn();
  mockHealthBlogPost.find = jest.fn();
  mockHealthBlogPost.countDocuments = jest.fn();
  mockHealthBlogPost.aggregate = jest.fn();
  
  return {
    __esModule: true,
    default: mockHealthBlogPost,
  };
});

describe('HealthBlogAdminService', () => {
  // Mock data
  const mockSuperAdmin: Partial<IUser> = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@example.com',
    role: 'super_admin',
    avatar: 'https://example.com/avatar.jpg',
  };

  const mockRegularUser: Partial<IUser> = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Regular',
    lastName: 'User',
    email: 'user@example.com',
    role: 'pharmacist',
  };

  const mockPost: Partial<IHealthBlogPost> = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    excerpt: 'This is a test blog post excerpt with sufficient length',
    content: '<p>This is the full content of the test blog post with <strong>HTML</strong> tags and sufficient length for validation.</p>',
    featuredImage: {
      url: 'https://example.com/image.jpg',
      alt: 'Test image',
      caption: 'Test caption',
    },
    category: 'nutrition',
    tags: ['health', 'nutrition', 'wellness'],
    author: {
      id: mockSuperAdmin._id!,
      name: 'Super Admin',
      avatar: 'https://example.com/avatar.jpg',
    },
    status: 'draft',
    readTime: 5,
    viewCount: 0,
    isFeatured: false,
    seo: {
      metaTitle: 'Test Blog Post - Health Tips',
      metaDescription: 'Learn about health and nutrition in this comprehensive guide',
      keywords: ['health', 'nutrition', 'wellness'],
    },
    relatedPosts: [],
    isDeleted: false,
    createdBy: mockSuperAdmin._id!,
  };

  const mockCreatePostData = {
    title: 'New Blog Post',
    excerpt: 'This is a new blog post excerpt with sufficient length',
    content: '<p>This is the full content of the new blog post with sufficient length for validation.</p>',
    featuredImage: {
      url: 'https://example.com/new-image.jpg',
      alt: 'New image',
      caption: 'New caption',
    },
    category: 'wellness' as const,
    tags: ['wellness', 'health'],
    isFeatured: true,
    publishImmediately: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a new blog post for Super Admin', async () => {
      // Mock User.findById
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      // Mock HealthBlogPost.ensureUniqueSlug
      (HealthBlogPost as any).ensureUniqueSlug.mockResolvedValue('new-blog-post');

      const result = await HealthBlogAdminService.createPost(mockCreatePostData, mockSuperAdmin._id!);

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect((HealthBlogPost as any).ensureUniqueSlug).toHaveBeenCalled();
      expect(result.title).toBe(mockCreatePostData.title);
    });

    it('should throw error for non-existent user', async () => {
      const mockError = new Error('User not found: ' + mockSuperAdmin._id!.toString());
      (createNotFoundError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(null);
      User.findById = mockFindById;

      await expect(
        HealthBlogAdminService.createPost(mockCreatePostData, mockSuperAdmin._id!)
      ).rejects.toThrow('User not found: ' + mockSuperAdmin._id!.toString());

      expect(createNotFoundError).toHaveBeenCalledWith('User', mockSuperAdmin._id!.toString());
    });

    it('should throw error for non-Super Admin user', async () => {
      const mockError = new Error('Only Super Admins can create blog posts');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockRegularUser);
      User.findById = mockFindById;

      await expect(
        HealthBlogAdminService.createPost(mockCreatePostData, mockRegularUser._id!)
      ).rejects.toThrow('Only Super Admins can create blog posts');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Only Super Admins can create blog posts');
    });

    it('should publish immediately when publishImmediately is true', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      (HealthBlogPost as any).ensureUniqueSlug.mockResolvedValue('new-blog-post');

      const postDataWithPublish = { ...mockCreatePostData, publishImmediately: true };
      const result = await HealthBlogAdminService.createPost(postDataWithPublish, mockSuperAdmin._id!);

      expect(result.status).toBe('published');
      expect(result.publishedAt).toBeDefined();
    });
  });

  describe('updatePost', () => {
    it('should update blog post for Super Admin', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockPostToUpdate = {
        ...mockPost,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (HealthBlogPost as any).findOne.mockResolvedValue(mockPostToUpdate);
      (HealthBlogPost as any).ensureUniqueSlug.mockResolvedValue('updated-blog-post');

      const updateData = {
        title: 'Updated Blog Post',
        excerpt: 'Updated excerpt with sufficient length',
      };

      const result = await HealthBlogAdminService.updatePost(
        mockPost._id!,
        updateData,
        mockSuperAdmin._id!
      );

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect((HealthBlogPost as any).findOne).toHaveBeenCalledWith({
        _id: mockPost._id,
        isDeleted: false,
      });
      expect(result.title).toBe(updateData.title);
    });

    it('should throw error for non-Super Admin user', async () => {
      const mockError = new Error('Only Super Admins can update blog posts');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockRegularUser);
      User.findById = mockFindById;

      await expect(
        HealthBlogAdminService.updatePost(mockPost._id!, {}, mockRegularUser._id!)
      ).rejects.toThrow('Only Super Admins can update blog posts');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Only Super Admins can update blog posts');
    });

    it('should throw error for non-existent post', async () => {
      const mockError = new Error('Blog post not found: ' + mockPost._id!.toString());
      (createNotFoundError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockFindOne = jest.fn().mockResolvedValue(null);
      HealthBlogPost.findOne = mockFindOne;

      await expect(
        HealthBlogAdminService.updatePost(mockPost._id!, {}, mockSuperAdmin._id!)
      ).rejects.toThrow('Blog post not found: ' + mockPost._id!.toString());

      expect(createNotFoundError).toHaveBeenCalledWith('Blog post', mockPost._id!.toString());
    });
  });

  describe('deletePost', () => {
    it('should soft delete blog post for Super Admin', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockUpdateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
      HealthBlogPost.updateOne = mockUpdateOne;

      await HealthBlogAdminService.deletePost(mockPost._id!, mockSuperAdmin._id!);

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: mockPost._id,
          isDeleted: false,
        },
        {
          isDeleted: true,
          updatedBy: mockSuperAdmin._id,
        }
      );
    });

    it('should throw error for non-Super Admin user', async () => {
      const mockError = new Error('Only Super Admins can delete blog posts');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockRegularUser);
      User.findById = mockFindById;

      await expect(
        HealthBlogAdminService.deletePost(mockPost._id!, mockRegularUser._id!)
      ).rejects.toThrow('Only Super Admins can delete blog posts');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Only Super Admins can delete blog posts');
    });

    it('should throw error for non-existent post', async () => {
      const mockError = new Error('Blog post not found: ' + mockPost._id!.toString());
      (createNotFoundError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockUpdateOne = jest.fn().mockResolvedValue({ matchedCount: 0 });
      HealthBlogPost.updateOne = mockUpdateOne;

      await expect(
        HealthBlogAdminService.deletePost(mockPost._id!, mockSuperAdmin._id!)
      ).rejects.toThrow('Blog post not found: ' + mockPost._id!.toString());

      expect(createNotFoundError).toHaveBeenCalledWith('Blog post', mockPost._id!.toString());
    });
  });

  describe('publishPost', () => {
    it('should publish blog post for Super Admin', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockPostToPublish = {
        ...mockPost,
        status: 'draft',
        save: mockSave,
      };
      const mockFindOne = jest.fn().mockResolvedValue(mockPostToPublish);
      HealthBlogPost.findOne = mockFindOne;

      const result = await HealthBlogAdminService.publishPost(mockPost._id!, mockSuperAdmin._id!);

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: mockPost._id,
        isDeleted: false,
      });
      expect(mockPostToPublish.status).toBe('published');
      expect(mockPostToPublish.publishedAt).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw error for already published post', async () => {
      const mockError = new Error('Blog post is already published');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockPostAlreadyPublished = {
        ...mockPost,
        status: 'published',
      };
      const mockFindOne = jest.fn().mockResolvedValue(mockPostAlreadyPublished);
      HealthBlogPost.findOne = mockFindOne;

      await expect(
        HealthBlogAdminService.publishPost(mockPost._id!, mockSuperAdmin._id!)
      ).rejects.toThrow('Blog post is already published');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Blog post is already published');
    });
  });

  describe('unpublishPost', () => {
    it('should unpublish blog post for Super Admin', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockPublishedPost = {
        ...mockPost,
        status: 'published',
        publishedAt: new Date(),
        save: mockSave,
      };
      const mockFindOne = jest.fn().mockResolvedValue(mockPublishedPost);
      HealthBlogPost.findOne = mockFindOne;

      const result = await HealthBlogAdminService.unpublishPost(mockPost._id!, mockSuperAdmin._id!);

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect(mockPublishedPost.status).toBe('draft');
      expect(mockPublishedPost.publishedAt).toBeUndefined();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw error for non-published post', async () => {
      const mockError = new Error('Only published posts can be unpublished');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const mockDraftPost = {
        ...mockPost,
        status: 'draft',
      };
      const mockFindOne = jest.fn().mockResolvedValue(mockDraftPost);
      HealthBlogPost.findOne = mockFindOne;

      await expect(
        HealthBlogAdminService.unpublishPost(mockPost._id!, mockSuperAdmin._id!)
      ).rejects.toThrow('Only published posts can be unpublished');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Only published posts can be unpublished');
    });
  });

  describe('getAllPosts', () => {
    it('should return paginated posts with filters', async () => {
      const mockPosts = [mockPost, { ...mockPost, _id: new mongoose.Types.ObjectId() }];
      
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockPosts);
      const mockCountDocuments = jest.fn().mockResolvedValue(2);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
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

      HealthBlogPost.countDocuments = mockCountDocuments;

      const result = await HealthBlogAdminService.getAllPosts(
        { status: 'draft' },
        { page: 1, limit: 10 }
      );

      expect(mockFind).toHaveBeenCalledWith({
        isDeleted: false,
        status: 'draft',
      });
      expect(result.posts).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply search filter', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([]);
      const mockCountDocuments = jest.fn().mockResolvedValue(0);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
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

      HealthBlogPost.countDocuments = mockCountDocuments;

      await HealthBlogAdminService.getAllPosts({ search: 'nutrition' });

      expect(mockFind).toHaveBeenCalledWith({
        isDeleted: false,
        $text: { $search: 'nutrition' },
      });
    });

    it('should limit posts per page to maximum of 100', async () => {
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([]);
      const mockCountDocuments = jest.fn().mockResolvedValue(0);

      HealthBlogPost.find = mockFind;
      mockFind.mockReturnValue({
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

      HealthBlogPost.countDocuments = mockCountDocuments;

      await HealthBlogAdminService.getAllPosts({}, { limit: 200 });

      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });

  describe('uploadFeaturedImage', () => {
    const mockFile = {
      originalname: 'test-image.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('should upload image for Super Admin', async () => {
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const result = await HealthBlogAdminService.uploadFeaturedImage(mockFile, mockSuperAdmin._id!);

      expect(mockFindById).toHaveBeenCalledWith(mockSuperAdmin._id);
      expect(result.url).toContain('blog-images');
      expect(result.publicId).toContain('blog-images');
      expect(result.format).toBe('jpg');
      expect(result.size).toBe(mockFile.size);
    });

    it('should throw error for non-Super Admin user', async () => {
      const mockError = new Error('Only Super Admins can upload blog images');
      (createBusinessRuleError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockRegularUser);
      User.findById = mockFindById;

      await expect(
        HealthBlogAdminService.uploadFeaturedImage(mockFile, mockRegularUser._id!)
      ).rejects.toThrow('Only Super Admins can upload blog images');

      expect(createBusinessRuleError).toHaveBeenCalledWith('Only Super Admins can upload blog images');
    });

    it('should throw error for invalid file type', async () => {
      const mockError = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
      (createValidationError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const invalidFile = { ...mockFile, mimetype: 'application/pdf' };

      await expect(
        HealthBlogAdminService.uploadFeaturedImage(invalidFile, mockSuperAdmin._id!)
      ).rejects.toThrow('Invalid file type. Only JPEG, PNG, and WebP images are allowed');

      expect(createValidationError).toHaveBeenCalledWith('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
    });

    it('should throw error for file too large', async () => {
      const mockError = new Error('File size too large. Maximum size is 5MB');
      (createValidationError as jest.Mock).mockReturnValue(mockError);
      
      const mockFindById = jest.fn().mockResolvedValue(mockSuperAdmin);
      User.findById = mockFindById;

      const largeFile = { ...mockFile, size: 6 * 1024 * 1024 }; // 6MB

      await expect(
        HealthBlogAdminService.uploadFeaturedImage(largeFile, mockSuperAdmin._id!)
      ).rejects.toThrow('File size too large. Maximum size is 5MB');

      expect(createValidationError).toHaveBeenCalledWith('File size too large. Maximum size is 5MB');
    });
  });

  describe('getBlogAnalytics', () => {
    it('should return comprehensive blog analytics', async () => {
      // Mock all the aggregation queries
      const mockCountDocuments = jest.fn()
        .mockResolvedValueOnce(10) // totalPosts
        .mockResolvedValueOnce(7)  // publishedPosts
        .mockResolvedValueOnce(2)  // draftPosts
        .mockResolvedValueOnce(1); // archivedPosts

      const mockAggregate = jest.fn()
        .mockResolvedValueOnce([{ totalViews: 1000 }]) // views aggregation
        .mockResolvedValueOnce([{ averageReadTime: 5.5 }]) // read time aggregation
        .mockResolvedValueOnce([{ category: 'nutrition', count: 5, totalViews: 500 }]) // category stats
        .mockResolvedValueOnce([{ year: 2024, month: 'Jan', postsPublished: 3, totalViews: 300 }]); // publishing trends

      const mockFind = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([
        { title: 'Top Post', slug: 'top-post', viewCount: 100, publishedAt: new Date() }
      ]);

      HealthBlogPost.countDocuments = mockCountDocuments;
      HealthBlogPost.aggregate = mockAggregate;
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

      // Mock the recent activity query
      const mockFindForActivity = jest.fn().mockReturnThis();
      const mockSelectForActivity = jest.fn().mockReturnThis();
      const mockSortForActivity = jest.fn().mockReturnThis();
      const mockLimitForActivity = jest.fn().mockReturnThis();
      const mockLeanForActivity = jest.fn().mockReturnThis();
      const mockThenForActivity = jest.fn().mockResolvedValue([
        {
          action: 'published',
          postTitle: 'Recent Post',
          postSlug: 'recent-post',
          authorName: 'Super Admin',
          timestamp: new Date(),
        }
      ]);

      // Override the find method for the second call (recent activity)
      let findCallCount = 0;
      HealthBlogPost.find = jest.fn().mockImplementation(() => {
        findCallCount++;
        if (findCallCount === 1) {
          // First call for top posts
          return {
            select: mockSelect,
          };
        } else {
          // Second call for recent activity
          return {
            select: mockSelectForActivity,
          };
        }
      });

      mockSelectForActivity.mockReturnValue({
        sort: mockSortForActivity,
      });
      mockSortForActivity.mockReturnValue({
        limit: mockLimitForActivity,
      });
      mockLimitForActivity.mockReturnValue({
        lean: mockLeanForActivity,
      });
      mockLeanForActivity.mockReturnValue({
        then: mockThenForActivity,
      });

      const result = await HealthBlogAdminService.getBlogAnalytics();

      expect(result.overview.totalPosts).toBe(10);
      expect(result.overview.publishedPosts).toBe(7);
      expect(result.overview.totalViews).toBe(1000);
      expect(result.overview.averageReadTime).toBe(6); // Rounded from 5.5
      expect(result.topPosts).toHaveLength(1);
      expect(result.categoryStats).toHaveLength(1);
      expect(result.publishingTrends).toHaveLength(1);
      expect(result.recentActivity).toHaveLength(1);
    });
  });
});