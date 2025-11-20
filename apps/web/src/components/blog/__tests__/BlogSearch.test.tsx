import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlogSearch from '../BlogSearch';

const theme = createTheme();

const mockSearchResults = {
  data: {
    posts: [
      {
        _id: '1',
        title: 'Test Article 1',
        slug: 'test-article-1',
        excerpt: 'This is a test excerpt for article 1.',
        content: '<p>Content</p>',
        category: 'wellness',
        tags: ['health'],
        author: { id: '1', name: 'Author 1' },
        status: 'published',
        publishedAt: '2024-01-15T10:00:00Z',
        readTime: 5,
        viewCount: 100,
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

const mockTagsData = {
  data: [
    { tag: 'health', count: 25 },
    { tag: 'wellness', count: 18 },
    { tag: 'nutrition', count: 12 },
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

// Mock the useHealthBlog hook
const mockUseSearchPosts = jest.fn();
const mockUseTags = jest.fn();
const mockUseDebounce = jest.fn();

jest.mock('../../../hooks/useHealthBlog', () => ({
  useHealthBlog: {
    useSearchPosts: (...args: any[]) => mockUseSearchPosts(...args),
    useTags: () => mockUseTags(),
  },
}));

jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: string, delay: number) => mockUseDebounce(value, delay),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('BlogSearch', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockUseSearchPosts.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    
    mockUseTags.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
    });
    
    mockUseDebounce.mockImplementation((value) => value);
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    renderWithProviders(<BlogSearch />);
    
    expect(screen.getByPlaceholderText('Search health articles...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    renderWithProviders(<BlogSearch placeholder="Custom placeholder" />);
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('shows search icon', () => {
    renderWithProviders(<BlogSearch />);
    
    expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
  });

  it('shows clear button when there is text', async () => {
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'test query');
    
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...') as HTMLInputElement;
    await user.type(input, 'test query');
    
    const clearButton = screen.getByLabelText('Clear search');
    await user.click(clearButton);
    
    expect(input.value).toBe('');
  });

  it('opens dropdown when input is focused', async () => {
    mockUseTags.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.click(input);
    
    expect(screen.getByText('Popular Topics')).toBeInTheDocument();
  });

  it('shows search results when typing', async () => {
    mockUseSearchPosts.mockReturnValue({
      data: mockSearchResults,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByText('Search Results')).toBeInTheDocument();
      expect(screen.getByText('Test Article 1')).toBeInTheDocument();
    });
  });

  it('shows loading state during search', async () => {
    mockUseSearchPosts.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('shows no results message', async () => {
    mockUseSearchPosts.mockReturnValue({
      data: { data: { posts: [], totalCount: 0, hasMore: false } },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'nonexistent');
    
    await waitFor(() => {
      expect(screen.getByText('No articles found for "nonexistent"')).toBeInTheDocument();
    });
  });

  it('shows popular tags', async () => {
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.click(input);
    
    await waitFor(() => {
      expect(screen.getByText('health (25)')).toBeInTheDocument();
      expect(screen.getByText('wellness (18)')).toBeInTheDocument();
      expect(screen.getByText('nutrition (12)')).toBeInTheDocument();
    });
  });

  it('shows recent searches from localStorage', async () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(['previous search', 'another search']));
    
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.click(input);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
      expect(screen.getByText('previous search')).toBeInTheDocument();
      expect(screen.getByText('another search')).toBeInTheDocument();
    });
  });

  it('calls onSearch callback when search is submitted', async () => {
    const mockOnSearch = jest.fn();
    renderWithProviders(<BlogSearch onSearch={mockOnSearch} />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'test query');
    
    fireEvent.submit(input.closest('form')!);
    
    expect(mockOnSearch).toHaveBeenCalledWith('test query');
  });

  it('saves search to recent searches', async () => {
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.type(input, 'test query');
    
    fireEvent.submit(input.closest('form')!);
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'blog-recent-searches',
      JSON.stringify(['test query'])
    );
  });

  it('closes dropdown when backdrop is clicked', async () => {
    renderWithProviders(<BlogSearch />);
    
    const input = screen.getByPlaceholderText('Search health articles...');
    await user.click(input);
    
    // Dropdown should be open
    expect(screen.getByText('Popular Topics')).toBeInTheDocument();
    
    // Click backdrop (this is a bit tricky to test, but we can simulate it)
    const backdrop = document.querySelector('[style*="position: fixed"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    
    await waitFor(() => {
      expect(screen.queryByText('Popular Topics')).not.toBeInTheDocument();
    });
  });

  it('handles disabled suggestions and recent searches', () => {
    renderWithProviders(
      <BlogSearch showSuggestions={false} showRecentSearches={false} />
    );
    
    const input = screen.getByPlaceholderText('Search health articles...');
    fireEvent.focus(input);
    
    expect(screen.getByText('Start typing to search articles...')).toBeInTheDocument();
  });
});