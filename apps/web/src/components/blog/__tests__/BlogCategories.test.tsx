import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlogCategories from '../BlogCategories';
import * as useHealthBlogModule from '../../../hooks/useHealthBlog';

const theme = createTheme();

const mockCategoriesData = {
  data: [
    { category: 'wellness', count: 25 },
    { category: 'nutrition', count: 18 },
    { category: 'medication', count: 12 },
    { category: 'chronic_diseases', count: 8 },
    { category: 'preventive_care', count: 15 },
    { category: 'mental_health', count: 10 },
  ],
};

const renderWithProviders = (component: React.ReactElement, initialEntries = ['/blog']) => {
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
const mockUseCategories = jest.fn();
jest.mock('../../../hooks/useHealthBlog', () => ({
  useHealthBlog: {
    useCategories: () => mockUseCategories(),
  },
}));

describe('BlogCategories', () => {
  beforeEach(() => {
    mockUseCategories.mockReturnValue({
      data: mockCategoriesData,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders all categories with counts', async () => {
    renderWithProviders(<BlogCategories />);
    
    await waitFor(() => {
      expect(screen.getByText('All Articles (88)')).toBeInTheDocument();
      expect(screen.getByText('Wellness (25)')).toBeInTheDocument();
      expect(screen.getByText('Nutrition (18)')).toBeInTheDocument();
      expect(screen.getByText('Medication (12)')).toBeInTheDocument();
    });
  });

  it('renders categories without counts when showCounts is false', async () => {
    renderWithProviders(<BlogCategories showCounts={false} />);
    
    await waitFor(() => {
      expect(screen.getByText('All Articles')).toBeInTheDocument();
      expect(screen.getByText('Wellness')).toBeInTheDocument();
      expect(screen.queryByText('Wellness (25)')).not.toBeInTheDocument();
    });
  });

  it('renders vertical orientation correctly', async () => {
    renderWithProviders(<BlogCategories orientation="vertical" variant="buttons" />);
    
    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Diet, supplements, and nutritional guidance')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockUseCategories.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<BlogCategories />);
    
    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockUseCategories.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    renderWithProviders(<BlogCategories />);
    
    expect(screen.getByText('Failed to load categories')).toBeInTheDocument();
  });

  it('renders chip variant by default', async () => {
    renderWithProviders(<BlogCategories />);
    
    await waitFor(() => {
      const allArticlesChip = screen.getByText('All Articles (88)');
      expect(allArticlesChip.closest('.MuiChip-root')).toBeInTheDocument();
    });
  });

  it('renders button variant correctly', async () => {
    renderWithProviders(<BlogCategories variant="buttons" orientation="vertical" />);
    
    await waitFor(() => {
      expect(screen.getByText('General health and wellness tips')).toBeInTheDocument();
      expect(screen.getByText('Managing chronic health conditions')).toBeInTheDocument();
    });
  });

  it('calculates total count for "All Articles" correctly', async () => {
    renderWithProviders(<BlogCategories />);
    
    await waitFor(() => {
      // Total should be 25+18+12+8+15+10 = 88
      expect(screen.getByText('All Articles (88)')).toBeInTheDocument();
    });
  });

  it('handles empty categories data', async () => {
    mockUseCategories.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<BlogCategories />);
    
    await waitFor(() => {
      expect(screen.getByText('All Articles')).toBeInTheDocument();
      expect(screen.getByText('Wellness')).toBeInTheDocument();
    });
  });

  it('generates correct category URLs', async () => {
    renderWithProviders(<BlogCategories />);
    
    await waitFor(() => {
      const wellnessLink = screen.getByText('Wellness (25)').closest('a');
      expect(wellnessLink).toHaveAttribute('href', '/blog?category=wellness');
      
      const allArticlesLink = screen.getByText('All Articles (88)').closest('a');
      expect(allArticlesLink).toHaveAttribute('href', '/blog?');
    });
  });
});