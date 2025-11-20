import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import BlogPostCard from '../BlogPostCard';
import { BlogPost } from '../../../hooks/useHealthBlog';

const theme = createTheme();

const mockPost: BlogPost = {
  _id: '1',
  title: 'Test Blog Post',
  slug: 'test-blog-post',
  excerpt: 'This is a test excerpt for the blog post.',
  content: '<p>This is the full content of the blog post.</p>',
  featuredImage: {
    url: 'https://example.com/image.jpg',
    alt: 'Test image',
  },
  category: 'wellness',
  tags: ['health', 'wellness'],
  author: {
    id: 'author1',
    name: 'Dr. John Doe',
    avatar: 'https://example.com/avatar.jpg',
  },
  status: 'published',
  publishedAt: '2024-01-15T10:00:00Z',
  readTime: 5,
  viewCount: 150,
  isFeatured: false,
  seo: {
    keywords: ['health', 'wellness'],
  },
  relatedPosts: [],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('BlogPostCard', () => {
  it('renders blog post card with default variant', () => {
    renderWithProviders(<BlogPostCard post={mockPost} />);
    
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.getByText('This is a test excerpt for the blog post.')).toBeInTheDocument();
    expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('WELLNESS')).toBeInTheDocument();
  });

  it('renders featured variant correctly', () => {
    renderWithProviders(<BlogPostCard post={{ ...mockPost, isFeatured: true }} variant="featured" />);
    
    expect(screen.getByText('FEATURED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
  });

  it('renders compact variant correctly', () => {
    renderWithProviders(<BlogPostCard post={mockPost} variant="compact" />);
    
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /read/i })).toBeInTheDocument();
  });

  it('hides elements based on props', () => {
    renderWithProviders(
      <BlogPostCard 
        post={mockPost} 
        showImage={false}
        showExcerpt={false}
        showAuthor={false}
        showStats={false}
      />
    );
    
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.queryByText('This is a test excerpt for the blog post.')).not.toBeInTheDocument();
    expect(screen.queryByText('Dr. John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('5 min')).not.toBeInTheDocument();
  });

  it('handles missing featured image gracefully', () => {
    const postWithoutImage = { ...mockPost, featuredImage: undefined };
    renderWithProviders(<BlogPostCard post={postWithoutImage} />);
    
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders correct category color', () => {
    renderWithProviders(<BlogPostCard post={{ ...mockPost, category: 'nutrition' }} />);
    
    const categoryChip = screen.getByText('NUTRITION');
    expect(categoryChip).toBeInTheDocument();
  });

  it('links to correct blog post URL', () => {
    renderWithProviders(<BlogPostCard post={mockPost} />);
    
    const readMoreButton = screen.getByRole('link', { name: /read more/i });
    expect(readMoreButton).toHaveAttribute('href', '/blog/test-blog-post');
  });

  it('displays formatted date correctly', () => {
    renderWithProviders(<BlogPostCard post={mockPost} />);
    
    expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
  });

  it('truncates long excerpts in compact variant', () => {
    const longExcerpt = 'This is a very long excerpt that should be truncated when displayed in compact variant because it exceeds the character limit.';
    const postWithLongExcerpt = { ...mockPost, excerpt: longExcerpt };
    
    renderWithProviders(<BlogPostCard post={postWithLongExcerpt} variant="compact" />);
    
    expect(screen.getByText(/This is a very long excerpt that should be truncated when displayed in compact variant because it exceeds the character limit\.\.\./)).toBeInTheDocument();
  });
});