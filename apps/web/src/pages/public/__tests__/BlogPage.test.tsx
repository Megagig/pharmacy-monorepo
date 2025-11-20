import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlogPage from '../BlogPage';

const theme = createTheme();

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
        isFeatured: false,
        seo: { keywords: [] },
        relatedPosts: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
    ],
    totalCount: 1,
    hasMore: false,
  },
};

const mockCategoriesData = {
  data: [
    { category: 'wellness', count: 10 },
    { category: 'nutrition', count: 8 },
  ],
};

const mockTagsData = {
  data: [
    { tag: 'health', count: 25 },
    { tag: 'wellness', count: 18 },
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
const mockUsePublishedPosts = jest.fn();
const mockUseCategories = jest.fn();
const mockUseTags = jest.fn();

jest.mock('../../../hooks/useHealthBlog', () => ({
  useHealthBlog: {
    usePublishedPosts: (...args: any[]) => mockUsePublishedPosts(...args),
    useCategories: () => mockUseCategories(),
    useTags: () => mockUseTags(),
  },
}));

// Mock the blog components
jest.mock('../../../components/blog/BlogPostCard', () => {
  return function MockBlogPostCard({ post }: any) {
    return <div data-testid="blog-post-card">{post.title}</div>;
  };
});

jest.mock('../../../components/blog/BlogCategories', () => {
  return function MockBlogCategories() {
    return <div data-testid="blog-categories">Categories</div>;
  };
});

jest.mock('../../../components/blog/BlogSearch', () => {
  return function MockBlogSearch({ onSearch }: any) {
    return (
      <div data-testid="blog-search">
        <input 
          placeholder="Search..." 
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
    );
  };
});

jest.mock('../../../components/Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer">Footer</div>;
  };
});

jest.mock('../../../components/common/ThemeToggle', () => {
  return function MockThemeToggle() {
    return <div data-testid="theme-toggle">Theme Toggle</div>;
  };
});

describe('BlogPage', () => {
  beforeEach(() => {
    mockUsePublishedPosts.mockReturnValue({
      data: mockPostsData,
      isLoading: false,
      error: null,
    });

    mockUseCategories.mockReturnValue({
      data: mockCategoriesData,
      isLoading: false,
      error: null,
    });

    mockUseTags.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders blog page with header', () => {
    renderWithProviders(<BlogPage />);
    
    expect(screen.getByText('PharmaCare Health Blog')).toBeInTheDocument();
    expect(screen.getByText('Health Blog')).toBeInTheDocument();
    expect(screen.getByText('Discover expert health advice, tips, and insights from our pharmacists.')).toBeInTheDocument();
  });

  it('renders navigation elements', () => {
    renderWithProviders(<BlogPage />);
    
    expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders sidebar components', () => {
    renderWithProviders(<BlogPage />);
    
    expect(screen.getByTestId('blog-search')).toBeInTheDocument();
    expect(screen.getByTestId('blog-categories')).toBeInTheDocument();
  });

  it('displays blog posts', async () => {
    renderWithProviders(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('blog-post-card')).toBeInTheDocument();
      expect(screen.getByText('Test Blog Post 1')).toBeInTheDocument();
    });
  });

  it('shows results count', async () => {
    renderWithProviders(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 1 articles')).toBeInTheDocument();
    });
  });

  it('renders footer', () => {
    renderWithProviders(<BlogPage />);
    
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUsePublishedPosts.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<BlogPage />);
    
    // Should show skeleton loaders
    expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockUsePublishedPosts.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    renderWithProviders(<BlogPage />);
    
    expect(screen.getByText('Failed to load blog posts. Please try again later.')).toBeInTheDocument();
  });

  it('shows empty state when no posts', () => {
    mockUsePublishedPosts.mockReturnValue({
      data: { data: { posts: [], totalCount: 0, hasMore: false } },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogPage />);
    
    expect(screen.getByText('No articles found')).toBeInTheDocument();
    expect(screen.getByText('Check back soon for new health articles and tips.')).toBeInTheDocument();
  });
});