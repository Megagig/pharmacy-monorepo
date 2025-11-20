import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlogManagement from '../BlogManagement';

const theme = createTheme();

const mockAnalyticsData = {
  data: {
    totalPosts: 25,
    totalViews: 15000,
    avgViewsPerPost: 600,
    publishedThisMonth: 5,
    topCategories: [
      { category: 'wellness', count: 10, views: 6000 },
      { category: 'nutrition', count: 8, views: 4800 },
    ],
    recentActivity: [],
  },
};

const mockPostsData = {
  data: {
    posts: [
      {
        _id: '1',
        title: 'Test Blog Post 1',
        slug: 'test-blog-post-1',
        excerpt: 'This is a test excerpt.',
        content: '<p>Content</p>',
        category: 'wellness',
        tags: ['health'],
        author: { id: '1', name: 'Dr. John Doe', avatar: '' },
        status: 'published',
        publishedAt: '2024-01-15T10:00:00Z',
        readTime: 5,
        viewCount: 150,
        isFeatured: true,
        seo: { keywords: [] },
        relatedPosts: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        _id: '2',
        title: 'Test Blog Post 2',
        slug: 'test-blog-post-2',
        excerpt: 'Another test excerpt.',
        content: '<p>More content</p>',
        category: 'nutrition',
        tags: ['diet'],
        author: { id: '2', name: 'Dr. Jane Smith', avatar: '' },
        status: 'draft',
        publishedAt: '2024-01-16T10:00:00Z',
        readTime: 3,
        viewCount: 75,
        isFeatured: false,
        seo: { keywords: [] },
        relatedPosts: [],
        createdAt: '2024-01-16T10:00:00Z',
        updatedAt: '2024-01-16T10:00:00Z',
      },
    ],
    totalCount: 2,
    hasMore: false,
  },
};

const mockCategoriesData = {
  data: [
    { category: 'wellness', count: 10 },
    { category: 'nutrition', count: 8 },
  ],
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock the hooks
const mockUseAdminPosts = jest.fn();
const mockUseBlogAnalytics = jest.fn();
const mockUseCategories = jest.fn();
const mockUseDeletePost = jest.fn();
const mockUseUpdatePostStatus = jest.fn();

jest.mock('../../../hooks/useHealthBlogAdmin', () => ({
  useHealthBlogAdmin: {
    useAdminPosts: (...args: any[]) => mockUseAdminPosts(...args),
    useBlogAnalytics: () => mockUseBlogAnalytics(),
    useDeletePost: () => mockUseDeletePost(),
    useUpdatePostStatus: () => mockUseUpdatePostStatus(),
  },
}));

jest.mock('../../../hooks/useHealthBlog', () => ({
  useHealthBlog: {
    useCategories: () => mockUseCategories(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('BlogManagement', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockUseAdminPosts.mockReturnValue({
      data: mockPostsData,
      isLoading: false,
      error: null,
    });

    mockUseBlogAnalytics.mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
    });

    mockUseCategories.mockReturnValue({
      data: mockCategoriesData,
    });

    mockUseDeletePost.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    mockUseUpdatePostStatus.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders blog management page with header', () => {
    renderWithProviders(<BlogManagement />);
    
    expect(screen.getByText('Blog Management')).toBeInTheDocument();
    expect(screen.getByText('Manage health blog posts, monitor analytics, and engage with your audience')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create new post/i })).toBeInTheDocument();
  });

  it('displays analytics cards', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // Total Posts
      expect(screen.getByText('15,000')).toBeInTheDocument(); // Total Views
      expect(screen.getByText('600')).toBeInTheDocument(); // Avg Views/Post
      expect(screen.getByText('5')).toBeInTheDocument(); // Published This Month
    });
  });

  it('displays blog posts in table', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Blog Post 1')).toBeInTheDocument();
      expect(screen.getByText('Test Blog Post 2')).toBeInTheDocument();
      expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows featured badge for featured posts', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });
  });

  it('displays correct status chips', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });

  it('handles search input', async () => {
    renderWithProviders(<BlogManagement />);
    
    const searchInput = screen.getByPlaceholderText('Search posts...');
    await user.type(searchInput, 'test query');
    
    expect(searchInput).toHaveValue('test query');
  });

  it('handles status filter change', async () => {
    renderWithProviders(<BlogManagement />);
    
    const statusSelect = screen.getByLabelText('Status');
    await user.click(statusSelect);
    
    const publishedOption = screen.getByText('Published');
    await user.click(publishedOption);
    
    // Should trigger a new query with the filter
    expect(mockUseAdminPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
      }),
      true
    );
  });

  it('handles category filter change', async () => {
    renderWithProviders(<BlogManagement />);
    
    const categorySelect = screen.getByLabelText('Category');
    await user.click(categorySelect);
    
    const wellnessOption = screen.getByText('WELLNESS (10)');
    await user.click(wellnessOption);
    
    expect(mockUseAdminPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'wellness',
      }),
      true
    );
  });

  it('clears filters when clear button is clicked', async () => {
    renderWithProviders(<BlogManagement />);
    
    // Set some filters first
    const searchInput = screen.getByPlaceholderText('Search posts...');
    await user.type(searchInput, 'test');
    
    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);
    
    expect(searchInput).toHaveValue('');
  });

  it('opens action menu when more button is clicked', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      const moreButtons = screen.getAllByLabelText(/more/i);
      expect(moreButtons).toHaveLength(2);
    });
    
    const firstMoreButton = screen.getAllByLabelText(/more/i)[0];
    await user.click(firstMoreButton);
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('navigates to edit page when edit is clicked', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      const moreButtons = screen.getAllByLabelText(/more/i);
      expect(moreButtons).toHaveLength(2);
    });
    
    const firstMoreButton = screen.getAllByLabelText(/more/i)[0];
    await user.click(firstMoreButton);
    
    const editButton = screen.getByText('Edit');
    await user.click(editButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/blog/edit/1');
  });

  it('opens delete confirmation dialog', async () => {
    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      const moreButtons = screen.getAllByLabelText(/more/i);
      expect(moreButtons).toHaveLength(2);
    });
    
    const firstMoreButton = screen.getAllByLabelText(/more/i)[0];
    await user.click(firstMoreButton);
    
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);
    
    expect(screen.getByText('Delete Blog Post')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete "Test Blog Post 1"? This action cannot be undone.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseAdminPosts.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<BlogManagement />);
    
    // Should show skeleton loaders
    expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockUseAdminPosts.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    renderWithProviders(<BlogManagement />);
    
    expect(screen.getByText('Failed to load blog posts. Please try again.')).toBeInTheDocument();
  });

  it('shows empty state when no posts', () => {
    mockUseAdminPosts.mockReturnValue({
      data: { data: { posts: [], totalCount: 0, hasMore: false } },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogManagement />);
    
    expect(screen.getByText('No blog posts found')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const mockPostsWithPagination = {
      data: {
        ...mockPostsData.data,
        totalCount: 25, // More than 10 to show pagination
      },
    };

    mockUseAdminPosts.mockReturnValue({
      data: mockPostsWithPagination,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogManagement />);
    
    await waitFor(() => {
      // Should show pagination with 3 pages (25 posts / 10 per page = 3 pages)
      expect(screen.getByLabelText('Go to page 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to page 3')).toBeInTheDocument();
    });
  });
});