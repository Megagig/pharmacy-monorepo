import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BlogPost, BlogPostsResponse, healthBlogKeys } from './useHealthBlog';

// Admin-specific types
export interface AdminBlogPost extends BlogPost {
  // Admin posts might have additional fields
}

export interface BlogAnalytics {
  totalPosts: number;
  totalViews: number;
  avgViewsPerPost: number;
  publishedThisMonth: number;
  topCategories: Array<{
    category: string;
    count: number;
    views: number;
  }>;
  recentActivity: Array<{
    action: 'created' | 'updated' | 'published' | 'viewed';
    postTitle: string;
    timestamp: string;
    count?: number;
  }>;
}

export interface AdminBlogSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'draft' | 'published' | 'archived';
  category?: string;
  author?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'viewCount' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePostData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  status: 'draft' | 'published' | 'archived';
  featuredImage?: {
    url: string;
    alt: string;
    caption?: string;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords: string[];
  };
  readTime: number;
}

export interface UpdatePostData extends Partial<CreatePostData> {
  // All fields are optional for updates
}

// Health Blog Admin Service
class HealthBlogAdminService {
  private baseUrl = '/super-admin/blog';

  /**
   * Base request method with error handling and auth
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T; message: string }> {
    try {
      // Import the configured API client
      const { default: apiClient } = await import('../services/apiClient');

      const response = await apiClient({
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
      console.error('Health Blog Admin API Request failed:', error);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'An error occurred'
      );
    }
  }

  /**
   * Get all blog posts for admin (including drafts)
   */
  async getAdminPosts(params: AdminBlogSearchParams = {}): Promise<{ success: boolean; data: BlogPostsResponse; message: string }> {
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
   * Get a single blog post for admin
   */
  async getAdminPost(id: string): Promise<{ success: boolean; data: AdminBlogPost; message: string }> {
    return this.makeRequest<AdminBlogPost>(
      `${this.baseUrl}/posts/${id}`
    );
  }

  /**
   * Create a new blog post
   */
  async createPost(data: CreatePostData): Promise<{ success: boolean; data: AdminBlogPost; message: string }> {
    return this.makeRequest<AdminBlogPost>(
      `${this.baseUrl}/posts`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update an existing blog post
   */
  async updatePost(id: string, data: UpdatePostData): Promise<{ success: boolean; data: AdminBlogPost; message: string }> {
    return this.makeRequest<AdminBlogPost>(
      `${this.baseUrl}/posts/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete a blog post
   */
  async deletePost(id: string): Promise<{ success: boolean; data: { deleted: boolean }; message: string }> {
    return this.makeRequest<{ deleted: boolean }>(
      `${this.baseUrl}/posts/${id}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Update post status
   */
  async updatePostStatus(id: string, status: 'draft' | 'published' | 'archived'): Promise<{ success: boolean; data: AdminBlogPost; message: string }> {
    return this.makeRequest<AdminBlogPost>(
      `${this.baseUrl}/posts/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  }

  /**
   * Upload image for blog post
   */
  async uploadImage(formData: FormData): Promise<{ success: boolean; data: { url: string; alt: string; caption?: string }; message: string }> {
    try {
      const { default: apiClient } = await import('../services/apiClient');

      const response = await apiClient({
        url: `${this.baseUrl}/upload/image`,
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Image upload failed:', error);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Image upload failed'
      );
    }
  }

  /**
   * Get blog analytics
   */
  async getBlogAnalytics(): Promise<{ success: boolean; data: BlogAnalytics; message: string }> {
    return this.makeRequest<BlogAnalytics>(
      `${this.baseUrl}/analytics`
    );
  }

  /**
   * Bulk update posts
   */
  async bulkUpdatePosts(
    postIds: string[],
    updates: Partial<Pick<AdminBlogPost, 'status' | 'category' | 'isFeatured'>>
  ): Promise<{ success: boolean; data: { updated: number }; message: string }> {
    return this.makeRequest<{ updated: number }>(
      `${this.baseUrl}/posts/bulk`,
      {
        method: 'PATCH',
        body: JSON.stringify({ postIds, updates }),
      }
    );
  }
}

// Create service instance
const healthBlogAdminService = new HealthBlogAdminService();

// Query keys for admin blog queries
export const adminBlogKeys = {
  all: ['admin-blog'] as const,
  posts: (params: AdminBlogSearchParams) => [...adminBlogKeys.all, 'posts', params] as const,
  post: (id: string) => [...adminBlogKeys.all, 'post', id] as const,
  analytics: () => [...adminBlogKeys.all, 'analytics'] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch admin blog posts
 */
export const useAdminPosts = (params: AdminBlogSearchParams = {}, enabled = true) => {
  return useQuery({
    queryKey: adminBlogKeys.posts(params),
    queryFn: () => healthBlogAdminService.getAdminPosts(params),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch a single admin blog post
 */
export const useAdminPost = (id: string, enabled = true) => {
  return useQuery({
    queryKey: adminBlogKeys.post(id),
    queryFn: () => healthBlogAdminService.getAdminPost(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch blog analytics
 */
export const useBlogAnalytics = (enabled = true) => {
  return useQuery({
    queryKey: adminBlogKeys.analytics(),
    queryFn: () => healthBlogAdminService.getBlogAnalytics(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to create a new blog post
 */
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostData) => healthBlogAdminService.createPost(data),

    onSuccess: () => {
      // Invalidate admin posts queries
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.posts({}) });
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.analytics() });

      // Invalidate public blog queries too
      queryClient.invalidateQueries({ queryKey: healthBlogKeys.all });
    },

    onError: (error) => {
      console.error('Failed to create post:', error);
    },
  });
};

/**
 * Hook to update a blog post
 */
export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePostData }) =>
      healthBlogAdminService.updatePost(id, data),

    onSuccess: (response, { id }) => {
      // Update the specific post in cache
      queryClient.setQueryData(
        adminBlogKeys.post(id),
        { success: true, data: response.data, message: response.message }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.posts({}) });
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.analytics() });
      queryClient.invalidateQueries({ queryKey: healthBlogKeys.all });
    },

    onError: (error) => {
      console.error('Failed to update post:', error);
    },
  });
};

/**
 * Hook to delete a blog post
 */
export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => healthBlogAdminService.deletePost(id),

    onSuccess: (_, id) => {
      // Remove the post from cache
      queryClient.removeQueries({ queryKey: adminBlogKeys.post(id) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.posts({}) });
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.analytics() });
      queryClient.invalidateQueries({ queryKey: healthBlogKeys.all });
    },

    onError: (error) => {
      console.error('Failed to delete post:', error);
    },
  });
};

/**
 * Hook to update post status
 */
export const useUpdatePostStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, status }: { postId: string; status: 'draft' | 'published' | 'archived' }) =>
      healthBlogAdminService.updatePostStatus(postId, status),

    onSuccess: (response, { postId }) => {
      // Update the specific post in cache
      queryClient.setQueryData(
        adminBlogKeys.post(postId),
        { success: true, data: response.data, message: response.message }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.posts({}) });
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.analytics() });
      queryClient.invalidateQueries({ queryKey: healthBlogKeys.all });
    },

    onError: (error) => {
      console.error('Failed to update post status:', error);
    },
  });
};

/**
 * Hook to upload image
 */
export const useUploadImage = () => {
  return useMutation({
    mutationFn: (formData: FormData) => healthBlogAdminService.uploadImage(formData),

    onError: (error) => {
      console.error('Failed to upload image:', error);
    },
  });
};

/**
 * Hook to bulk update posts
 */
export const useBulkUpdatePosts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postIds,
      updates
    }: {
      postIds: string[];
      updates: Partial<Pick<AdminBlogPost, 'status' | 'category' | 'isFeatured'>>
    }) => healthBlogAdminService.bulkUpdatePosts(postIds, updates),

    onSuccess: () => {
      // Invalidate all admin queries
      queryClient.invalidateQueries({ queryKey: adminBlogKeys.all });
      queryClient.invalidateQueries({ queryKey: healthBlogKeys.all });
    },

    onError: (error) => {
      console.error('Failed to bulk update posts:', error);
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to invalidate admin blog queries
 */
export const useInvalidateAdminBlog = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: adminBlogKeys.all }),
    invalidatePosts: () => queryClient.invalidateQueries({ queryKey: adminBlogKeys.posts({}), exact: false }),
    invalidatePost: (id: string) => queryClient.invalidateQueries({ queryKey: adminBlogKeys.post(id) }),
    invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: adminBlogKeys.analytics() }),
  };
};

// Export the hooks as a namespace for better organization
export const useHealthBlogAdmin = {
  useAdminPosts,
  useAdminPost,
  useBlogAnalytics,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  useUpdatePostStatus,
  useUploadImage,
  useBulkUpdatePosts,
  useInvalidateAdminBlog,
};

// Export the service for direct use if needed
export { healthBlogAdminService };