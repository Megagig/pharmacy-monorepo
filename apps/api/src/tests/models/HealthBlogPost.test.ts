import mongoose from 'mongoose';
import HealthBlogPost, { IHealthBlogPost } from '../../models/HealthBlogPost';
import User from '../../models/User';

// Extend the HealthBlogPost model interface to include static methods
interface IHealthBlogPostModel extends mongoose.Model<IHealthBlogPost> {
  findPublished(options?: any): Promise<IHealthBlogPost[]>;
  searchPosts(query: string, options?: any): Promise<IHealthBlogPost[]>;
  ensureUniqueSlug(baseSlug: string, excludeId?: mongoose.Types.ObjectId): Promise<string>;
}

describe('HealthBlogPost Model', () => {
  let testUser: any;

  beforeAll(async () => {
    // Create a test user for author
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Author',
      email: 'test.author@example.com',
      password: 'password123',
      role: 'super_admin',
      workplaceId: new mongoose.Types.ObjectId(),
      currentPlanId: new mongoose.Types.ObjectId(),
    });
  });

  beforeEach(async () => {
    await HealthBlogPost.deleteMany({});
  });

  describe('Model Validation', () => {
    const validBlogPostData = {
      title: 'Understanding Diabetes Management',
      excerpt: 'A comprehensive guide to managing diabetes through medication and lifestyle changes.',
      content: 'This is a detailed blog post about diabetes management. It covers various aspects of the condition including medication adherence, dietary considerations, and regular monitoring. The content is extensive enough to meet the minimum requirements.',
      featuredImage: {
        url: 'https://example.com/diabetes-image.jpg',
        alt: 'Diabetes management illustration',
        caption: 'Managing diabetes effectively',
      },
      category: 'chronic_diseases' as const,
      tags: ['diabetes', 'medication', 'health'],
      author: {
        id: new mongoose.Types.ObjectId(),
        name: 'Dr. Test Author',
        avatar: 'https://example.com/avatar.jpg',
      },
      seo: {
        metaTitle: 'Diabetes Management Guide',
        metaDescription: 'Learn how to effectively manage diabetes with our comprehensive guide.',
        keywords: ['diabetes', 'management', 'health'],
      },
      createdBy: new mongoose.Types.ObjectId(),
    };

    it('should create a valid blog post', async () => {
      const blogPost = new HealthBlogPost(validBlogPostData);
      const savedPost = await blogPost.save();

      expect(savedPost._id).toBeDefined();
      expect(savedPost.title).toBe(validBlogPostData.title);
      expect(savedPost.slug).toBeDefined();
      expect(savedPost.status).toBe('draft');
      expect(savedPost.readTime).toBeGreaterThan(0);
      expect(savedPost.viewCount).toBe(0);
      expect(savedPost.isFeatured).toBe(false);
    });

    it('should require title', async () => {
      const blogPostData = { ...validBlogPostData };
      delete (blogPostData as any).title;

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Blog post title is required');
    });

    it('should require excerpt', async () => {
      const blogPostData = { ...validBlogPostData };
      delete (blogPostData as any).excerpt;

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Blog post excerpt is required');
    });

    it('should require content', async () => {
      const blogPostData = { ...validBlogPostData };
      delete (blogPostData as any).content;

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Blog post content is required');
    });

    it('should require valid category', async () => {
      const blogPostData = { ...validBlogPostData, category: 'invalid_category' as any };

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow();
    });

    it('should validate featured image URL format', async () => {
      const blogPostData = {
        ...validBlogPostData,
        featuredImage: {
          ...validBlogPostData.featuredImage,
          url: 'invalid-url',
        },
      };

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Featured image must be a valid image URL');
    });

    it('should limit tags to 10', async () => {
      const blogPostData = {
        ...validBlogPostData,
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      };

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Cannot have more than 10 tags');
    });

    it('should limit SEO keywords to 15', async () => {
      const blogPostData = {
        ...validBlogPostData,
        seo: {
          ...validBlogPostData.seo,
          keywords: Array.from({ length: 16 }, (_, i) => `keyword${i}`),
        },
      };

      const blogPost = new HealthBlogPost(blogPostData);
      await expect(blogPost.save()).rejects.toThrow('Cannot have more than 15 SEO keywords');
    });

    it('should validate title length', async () => {
      const shortTitle = { ...validBlogPostData, title: 'Hi' };
      const longTitle = { ...validBlogPostData, title: 'A'.repeat(201) };

      await expect(new HealthBlogPost(shortTitle).save()).rejects.toThrow('Title must be at least 5 characters');
      await expect(new HealthBlogPost(longTitle).save()).rejects.toThrow('Title cannot exceed 200 characters');
    });

    it('should validate excerpt length', async () => {
      const shortExcerpt = { ...validBlogPostData, excerpt: 'Short' };
      const longExcerpt = { ...validBlogPostData, excerpt: 'A'.repeat(501) };

      await expect(new HealthBlogPost(shortExcerpt).save()).rejects.toThrow('Excerpt must be at least 20 characters');
      await expect(new HealthBlogPost(longExcerpt).save()).rejects.toThrow('Excerpt cannot exceed 500 characters');
    });

    it('should validate content length', async () => {
      const shortContent = { ...validBlogPostData, content: 'Short content' };

      await expect(new HealthBlogPost(shortContent).save()).rejects.toThrow('Content must be at least 100 characters');
    });
  });

  describe('Slug Generation', () => {
    it('should auto-generate slug from title', async () => {
      const blogPost = new HealthBlogPost({
        title: 'Understanding Diabetes Management',
        excerpt: 'A comprehensive guide to managing diabetes through medication and lifestyle changes.',
        content: 'This is a detailed blog post about diabetes management. It covers various aspects of the condition including medication adherence, dietary considerations, and regular monitoring. The content is extensive enough to meet the minimum requirements.',
        featuredImage: {
          url: 'https://example.com/diabetes-image.jpg',
          alt: 'Diabetes management illustration',
        },
        category: 'chronic_diseases',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Dr. Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedPost = await blogPost.save();
      expect(savedPost.slug).toBe('understanding-diabetes-management');
    });

    it('should handle special characters in title', async () => {
      const blogPost = new HealthBlogPost({
        title: 'COVID-19: What You Need to Know!',
        excerpt: 'Essential information about COVID-19 prevention and treatment.',
        content: 'This is a detailed blog post about COVID-19. It covers various aspects of the pandemic including prevention measures, treatment options, and vaccination information. The content is extensive enough to meet the minimum requirements.',
        featuredImage: {
          url: 'https://example.com/covid-image.jpg',
          alt: 'COVID-19 information',
        },
        category: 'preventive_care',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Dr. Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedPost = await blogPost.save();
      expect(savedPost.slug).toBe('covid-19-what-you-need-to-know');
    });

    it('should ensure unique slugs', async () => {
      const baseData = {
        title: 'Diabetes Management',
        excerpt: 'A comprehensive guide to managing diabetes through medication and lifestyle changes.',
        content: 'This is a detailed blog post about diabetes management. It covers various aspects of the condition including medication adherence, dietary considerations, and regular monitoring. The content is extensive enough to meet the minimum requirements.',
        featuredImage: {
          url: 'https://example.com/diabetes-image.jpg',
          alt: 'Diabetes management illustration',
        },
        category: 'chronic_diseases' as const,
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Dr. Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const post1 = await new HealthBlogPost(baseData).save();
      const post2 = await new HealthBlogPost(baseData).save();

      expect(post1.slug).toBe('diabetes-management');
      expect(post2.slug).toBe('diabetes-management-1');
    });
  });

  describe('Read Time Calculation', () => {
    it('should calculate read time based on content', async () => {
      const shortContent = 'A'.repeat(100); // ~100 words
      const longContent = 'word '.repeat(450); // ~450 words

      const shortPost = new HealthBlogPost({
        title: 'Short Post',
        excerpt: 'This is a short post for testing read time calculation.',
        content: shortContent,
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const longPost = new HealthBlogPost({
        title: 'Long Post',
        excerpt: 'This is a longer post for testing read time calculation.',
        content: longContent,
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedShortPost = await shortPost.save();
      const savedLongPost = await longPost.save();

      expect(savedShortPost.readTime).toBe(1); // Minimum 1 minute
      expect(savedLongPost.readTime).toBe(2); // ~450 words / 225 words per minute = 2 minutes
    });

    it('should handle HTML content in read time calculation', async () => {
      const htmlContent = '<p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>'.repeat(50);

      const blogPost = new HealthBlogPost({
        title: 'HTML Content Post',
        excerpt: 'This post contains HTML content for testing read time calculation.',
        content: htmlContent,
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedPost = await blogPost.save();
      expect(savedPost.readTime).toBeGreaterThan(0);
    });
  });

  describe('Status and Publishing', () => {
    it('should set publishedAt when status changes to published', async () => {
      const blogPost = new HealthBlogPost({
        title: 'Test Publication',
        excerpt: 'Testing the publication workflow and date setting.',
        content: 'This is a detailed blog post for testing the publication workflow. It covers the automatic setting of publication dates when the status changes to published.',
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedPost = await blogPost.save();
      expect(savedPost.publishedAt).toBeUndefined();

      savedPost.status = 'published';
      const publishedPost = await savedPost.save();
      expect(publishedPost.publishedAt).toBeDefined();
      expect(publishedPost.publishedAt).toBeInstanceOf(Date);
    });

    it('should clear publishedAt when status changes from published', async () => {
      const blogPost = new HealthBlogPost({
        title: 'Test Unpublication',
        excerpt: 'Testing the unpublication workflow and date clearing.',
        content: 'This is a detailed blog post for testing the unpublication workflow. It covers the automatic clearing of publication dates when the status changes from published.',
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        status: 'published',
        publishedAt: new Date(),
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const savedPost = await blogPost.save();
      expect(savedPost.publishedAt).toBeDefined();

      savedPost.status = 'draft';
      const draftPost = await savedPost.save();
      expect(draftPost.publishedAt).toBeUndefined();
    });
  });

  describe('Instance Methods', () => {
    let blogPost: IHealthBlogPost;

    beforeEach(async () => {
      blogPost = await HealthBlogPost.create({
        title: 'Test Blog Post',
        excerpt: 'This is a test blog post for method testing.',
        content: 'This is a detailed test blog post. It contains enough content to test various methods and functionality of the blog post model.',
        featuredImage: {
          url: 'https://example.com/image.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        tags: ['test', 'wellness'],
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });
    });

    it('should increment view count', async () => {
      const initialViewCount = blogPost.viewCount;
      await blogPost.incrementViewCount();

      expect(blogPost.viewCount).toBe(initialViewCount + 1);

      // Verify in database
      const updatedPost = await HealthBlogPost.findById(blogPost._id);
      expect(updatedPost?.viewCount).toBe(initialViewCount + 1);
    });

    it('should generate slug correctly', () => {
      const slug = blogPost.generateSlug();
      expect(slug).toBe('test-blog-post');
    });

    it('should calculate read time correctly', () => {
      const readTime = blogPost.calculateReadTime();
      expect(readTime).toBeGreaterThan(0);
      expect(typeof readTime).toBe('number');
    });

    it('should get related posts by category', async () => {
      // Create related posts in same category
      await HealthBlogPost.create({
        title: 'Related Wellness Post 1',
        excerpt: 'Another wellness post for testing related posts functionality.',
        content: 'This is another detailed wellness blog post. It should appear as a related post when querying for posts in the same category.',
        featuredImage: {
          url: 'https://example.com/image2.jpg',
          alt: 'Related image 1',
        },
        category: 'wellness',
        status: 'published',
        publishedAt: new Date(),
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      await HealthBlogPost.create({
        title: 'Related Wellness Post 2',
        excerpt: 'Yet another wellness post for testing related posts functionality.',
        content: 'This is yet another detailed wellness blog post. It should also appear as a related post when querying for posts in the same category.',
        featuredImage: {
          url: 'https://example.com/image3.jpg',
          alt: 'Related image 2',
        },
        category: 'wellness',
        status: 'published',
        publishedAt: new Date(),
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      // Publish the main post
      blogPost.status = 'published';
      blogPost.publishedAt = new Date();
      await blogPost.save();

      const relatedPosts = await blogPost.getRelatedPosts(2);
      expect(relatedPosts).toHaveLength(2);
      expect(relatedPosts.every((post: IHealthBlogPost) => post.category === 'wellness')).toBe(true);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test posts
      await HealthBlogPost.create([
        {
          title: 'Published Wellness Post',
          excerpt: 'A published wellness post for testing static methods.',
          content: 'This is a published wellness blog post. It should appear in queries for published posts and wellness category posts.',
          featuredImage: {
            url: 'https://example.com/wellness.jpg',
            alt: 'Wellness image',
          },
          category: 'wellness',
          status: 'published',
          publishedAt: new Date(),
          isFeatured: true,
          author: {
            id: new mongoose.Types.ObjectId(),
            name: 'Test Author',
          },
          createdBy: new mongoose.Types.ObjectId(),
        },
        {
          title: 'Published Nutrition Post',
          excerpt: 'A published nutrition post for testing static methods.',
          content: 'This is a published nutrition blog post. It should appear in queries for published posts and nutrition category posts.',
          featuredImage: {
            url: 'https://example.com/nutrition.jpg',
            alt: 'Nutrition image',
          },
          category: 'nutrition',
          status: 'published',
          publishedAt: new Date(),
          tags: ['nutrition', 'health'],
          author: {
            id: new mongoose.Types.ObjectId(),
            name: 'Test Author',
          },
          createdBy: new mongoose.Types.ObjectId(),
        },
        {
          title: 'Draft Post',
          excerpt: 'A draft post that should not appear in published queries.',
          content: 'This is a draft blog post. It should not appear in queries for published posts since it is still in draft status.',
          featuredImage: {
            url: 'https://example.com/draft.jpg',
            alt: 'Draft image',
          },
          category: 'wellness',
          status: 'draft',
          author: {
            id: new mongoose.Types.ObjectId(),
            name: 'Test Author',
          },
          createdBy: new mongoose.Types.ObjectId(),
        },
      ]);
    });

    it('should find published posts only', async () => {
      const publishedPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished();
      expect(publishedPosts).toHaveLength(2);
      expect(publishedPosts.every((post: IHealthBlogPost) => post.status === 'published')).toBe(true);
    });

    it('should filter by category', async () => {
      const wellnessPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished({ category: 'wellness' });
      expect(wellnessPosts).toHaveLength(1);
      expect(wellnessPosts[0].category).toBe('wellness');
    });

    it('should filter by featured status', async () => {
      const featuredPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished({ featured: true });
      expect(featuredPosts).toHaveLength(1);
      expect(featuredPosts[0].isFeatured).toBe(true);
    });

    it('should filter by tags', async () => {
      const taggedPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished({ tags: ['nutrition'] });
      expect(taggedPosts).toHaveLength(1);
      expect(taggedPosts[0].tags).toContain('nutrition');
    });

    it('should limit and skip results', async () => {
      const limitedPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished({ limit: 1 });
      expect(limitedPosts).toHaveLength(1);

      const skippedPosts = await (HealthBlogPost as IHealthBlogPostModel).findPublished({ skip: 1, limit: 1 });
      expect(skippedPosts).toHaveLength(1);
      expect(skippedPosts[0]._id).not.toEqual(limitedPosts[0]._id);
    });

    it('should search posts by text', async () => {
      const searchResults = await (HealthBlogPost as IHealthBlogPostModel).searchPosts('nutrition');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some((post: IHealthBlogPost) =>
        post.title.toLowerCase().includes('nutrition') ||
        post.tags.includes('nutrition')
      )).toBe(true);
    });

    it('should ensure unique slugs', async () => {
      const uniqueSlug1 = await (HealthBlogPost as IHealthBlogPostModel).ensureUniqueSlug('test-slug');
      expect(uniqueSlug1).toBe('test-slug');

      // Create a post with this slug
      await HealthBlogPost.create({
        title: 'Test Slug Post',
        slug: 'test-slug',
        excerpt: 'A post to test unique slug generation.',
        content: 'This post is created to test the unique slug generation functionality. It should prevent duplicate slugs.',
        featuredImage: {
          url: 'https://example.com/test.jpg',
          alt: 'Test image',
        },
        category: 'wellness',
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const uniqueSlug2 = await (HealthBlogPost as IHealthBlogPostModel).ensureUniqueSlug('test-slug');
      expect(uniqueSlug2).toBe('test-slug-1');
    });
  });

  describe('Virtuals', () => {
    let blogPost: IHealthBlogPost;

    beforeEach(async () => {
      blogPost = await HealthBlogPost.create({
        title: 'Virtual Test Post',
        excerpt: 'Testing virtual properties of the blog post model.',
        content: 'This is a test blog post for virtual properties. It contains enough content to test word count and other virtual properties.',
        featuredImage: {
          url: 'https://example.com/virtual.jpg',
          alt: 'Virtual test image',
        },
        category: 'wellness',
        status: 'published',
        publishedAt: new Date(),
        readTime: 3,
        author: {
          id: new mongoose.Types.ObjectId(),
          name: 'Test Author',
        },
        createdBy: new mongoose.Types.ObjectId(),
      });
    });

    it('should generate URL virtual', () => {
      expect(blogPost.get('url')).toBe(`/blog/${blogPost.slug}`);
    });

    it('should generate read time display virtual', () => {
      expect(blogPost.get('readTimeDisplay')).toBe('3 min read');
    });

    it('should check published status virtual', () => {
      expect(blogPost.get('isPublished')).toBe(true);

      blogPost.status = 'draft';
      expect(blogPost.get('isPublished')).toBe(false);
    });

    it('should calculate word count virtual', () => {
      const wordCount = blogPost.get('wordCount');
      expect(typeof wordCount).toBe('number');
      expect(wordCount).toBeGreaterThan(0);
    });
  });
});