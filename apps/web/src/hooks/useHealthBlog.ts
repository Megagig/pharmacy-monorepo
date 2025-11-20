import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types for blog posts
export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: {
    url: string;
    alt: string;
    caption?: string;
  };
  category: 'nutrition' | 'wellness' | 'medication' | 'chronic_diseases' | 'preventive_care' | 'mental_health';
  tags: string[];
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: 'draft' | 'published' | 'archived';
  publishedAt: string;
  readTime: number;
  viewCount: number;
  isFeatured: boolean;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords: string[];
  };
  relatedPosts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostsResponse {
  posts: BlogPost[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface BlogSearchParams {
  limit?: number;
  skip?: number;
  category?: string;
  tag?: string;
  search?: string;
  cursor?: string;
}

// Health Blog Service
class HealthBlogService {
  private baseUrl = '/public/blog';

  /**
   * Base request method with error handling
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T; message: string }> {
    try {
      // Import the public API client (no authentication)
      const { default: publicApiClient } = await import('../services/publicApiClient');

      const response = await publicApiClient({
        url: url,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Health Blog API Request failed:', error);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'An error occurred'
      );
    }
  }

  /**
   * Get published blog posts with pagination and filtering
   */
  async getPublishedPosts(params: BlogSearchParams = {}): Promise<{ success: boolean; data: BlogPostsResponse; message: string }> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<BlogPostsResponse>(
      `${this.baseUrl}/posts?${searchParams.toString()}`
    );
  }

  /**
   * Get featured blog posts
   */
  async getFeaturedPosts(limit = 3): Promise<{ success: boolean; data: BlogPost[]; message: string }> {
    return this.makeRequest<BlogPost[]>(
      `${this.baseUrl}/featured?limit=${limit}`
    );
  }

  /**
   * Get a single blog post by slug
   */
  async getPostBySlug(slug: string): Promise<{ success: boolean; data: BlogPost; message: string }> {
    return this.makeRequest<BlogPost>(
      `${this.baseUrl}/posts/${slug}`
    );
  }

  /**
   * Get related posts for a specific post
   */
  async getRelatedPosts(slug: string, limit = 3): Promise<{ success: boolean; data: BlogPost[]; message: string }> {
    return this.makeRequest<BlogPost[]>(
      `${this.baseUrl}/posts/${slug}/related?limit=${limit}`
    );
  }

  /**
   * Search blog posts
   */
  async searchPosts(query: string, filters: Omit<BlogSearchParams, 'search'> = {}): Promise<{ success: boolean; data: BlogPostsResponse; message: string }> {
    const searchParams = new URLSearchParams({ search: query });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return this.makeRequest<BlogPostsResponse>(
      `${this.baseUrl}/search?${searchParams.toString()}`
    );
  }

  /**
   * Increment view count for a blog post
   */
  async incrementViewCount(slug: string): Promise<{ success: boolean; data: { viewCount: number }; message: string }> {
    return this.makeRequest<{ viewCount: number }>(
      `${this.baseUrl}/posts/${slug}/view`,
      { method: 'POST' }
    );
  }

  /**
   * Get blog categories
   */
  async getCategories(): Promise<{ success: boolean; data: Array<{ category: string; count: number }>; message: string }> {
    return this.makeRequest<Array<{ category: string; count: number }>>(
      `${this.baseUrl}/categories`
    );
  }

  /**
   * Get blog tags
   */
  async getTags(): Promise<{ success: boolean; data: Array<{ tag: string; count: number }>; message: string }> {
    return this.makeRequest<Array<{ tag: string; count: number }>>(
      `${this.baseUrl}/tags`
    );
  }
}

// Create service instance
const healthBlogService = new HealthBlogService();

// Query keys for consistent caching
export const healthBlogKeys = {
  all: ['health-blog'] as const,
  posts: (params: BlogSearchParams) => [...healthBlogKeys.all, 'posts', params] as const,
  featured: (limit: number) => [...healthBlogKeys.all, 'featured', limit] as const,
  post: (slug: string) => [...healthBlogKeys.all, 'post', slug] as const,
  related: (slug: string, limit: number) => [...healthBlogKeys.all, 'related', slug, limit] as const,
  search: (query: string, filters: Omit<BlogSearchParams, 'search'>) => [...healthBlogKeys.all, 'search', query, filters] as const,
  categories: () => [...healthBlogKeys.all, 'categories'] as const,
  tags: () => [...healthBlogKeys.all, 'tags'] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch published blog posts
 */
export const usePublishedPosts = (params: BlogSearchParams = {}, enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.posts(params),
    queryFn: () => healthBlogService.getPublishedPosts(params),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch featured blog posts
 */
export const useFeaturedPosts = (limit = 3, enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.featured(limit),
    queryFn: () => healthBlogService.getFeaturedPosts(limit),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - featured posts don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch latest blog posts (convenience hook)
 */
export const useLatestPosts = (params: BlogSearchParams = {}, enabled = true) => {
  const defaultParams = { limit: 9, ...params };
  return useQuery({
    queryKey: healthBlogKeys.posts(defaultParams),
    queryFn: () => healthBlogService.getPublishedPosts(defaultParams),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch a single blog post by slug
 */
export const usePostBySlug = (slug: string, enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.post(slug),
    queryFn: () => healthBlogService.getPostBySlug(slug),
    enabled: enabled && !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch related posts
 */
export const useRelatedPosts = (slug: string, limit = 3, enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.related(slug, limit),
    queryFn: () => healthBlogService.getRelatedPosts(slug, limit),
    enabled: enabled && !!slug,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

/**
 * Hook to search blog posts
 */
export const useSearchPosts = (query: string, filters: Omit<BlogSearchParams, 'search'> = {}, enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.search(query, filters),
    queryFn: () => healthBlogService.searchPosts(query, filters),
    enabled: enabled && !!query && query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch blog categories
 */
export const useCategories = (enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.categories(),
    queryFn: () => healthBlogService.getCategories(),
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
  });
};

/**
 * Hook to fetch blog tags
 */
export const useTags = (enabled = true) => {
  return useQuery({
    queryKey: healthBlogKeys.tags(),
    queryFn: () => healthBlogService.getTags(),
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - tags don't change often
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to increment view count
 */
export const useIncrementViewCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => healthBlogService.incrementViewCount(slug),

    onSuccess: (response, slug) => {
      // Update the post in cache with new view count
      queryClient.setQueryData(
        healthBlogKeys.post(slug),
        (oldData: any) => {
          if (oldData?.data) {
            return {
              ...oldData,
              data: {
                ...oldData.data,
                viewCount: response.data.viewCount,
              },
            };
          }
          return oldData;
        }
      );

      // Invalidate posts lists to reflect updated view count
      queryClient.invalidateQueries({
        queryKey: healthBlogKeys.posts({}),
        exact: false,
      });
    },

    onError: (error) => {
      console.error('Failed to increment view count:', error);
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to invalidate health blog queries
 */
export const useInvalidateHealthBlog = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: healthBlogKeys.all }),
    invalidatePosts: () => queryClient.invalidateQueries({ queryKey: healthBlogKeys.posts({}), exact: false }),
    invalidateFeatured: () => queryClient.invalidateQueries({ queryKey: healthBlogKeys.featured(3), exact: false }),
    invalidatePost: (slug: string) => queryClient.invalidateQueries({ queryKey: healthBlogKeys.post(slug) }),
    invalidateCategories: () => queryClient.invalidateQueries({ queryKey: healthBlogKeys.categories() }),
    invalidateTags: () => queryClient.invalidateQueries({ queryKey: healthBlogKeys.tags() }),
  };
};

// Export the hooks as a namespace for better organization
export const useHealthBlog = {
  usePublishedPosts,
  useFeaturedPosts,
  useLatestPosts,
  usePostBySlug,
  useRelatedPosts,
  useSearchPosts,
  useCategories,
  useTags,
  useIncrementViewCount,
  useInvalidateHealthBlog,
};

// Export the service for direct use if needed
export { healthBlogService };