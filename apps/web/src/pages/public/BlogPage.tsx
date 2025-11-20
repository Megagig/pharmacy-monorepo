import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Pagination,
  Alert,
  Skeleton,
  AppBar,
  Toolbar,
  Button,
} from '@mui/material';
import { Link } from 'react-router-dom';
import SEOHead from '../../components/common/SEOHead';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useHealthBlog } from '../../hooks/useHealthBlog';
import BlogPostCard from '../../components/blog/BlogPostCard';
import BlogCategories from '../../components/blog/BlogCategories';
import BlogSearch from '../../components/blog/BlogSearch';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/common/ThemeToggle';

const BlogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const tag = searchParams.get('tag') || '';

  // Fetch blog posts based on current filters
  const {
    data: postsResponse,
    isLoading,
    error
  } = useHealthBlog.usePublishedPosts({
    skip: (page - 1) * 12,
    limit: 12,
    search: search || undefined,
    category: category || undefined,
    tag: tag || undefined,
  });

  const posts = postsResponse?.data?.posts || [];
  const totalCount = postsResponse?.data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 12);

  // Debug logging
  React.useEffect(() => {

  }, [isLoading, error, postsResponse, posts.length, totalCount]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('search', query);
    } else {
      params.delete('search');
    }
    setSearchParams(params);
    setPage(1);
  };

  const getPageTitle = () => {
    if (search) return `Search results for "${search}"`;
    if (category) return `${category.replace('_', ' ').toUpperCase()} Articles`;
    if (tag) return `Articles tagged with "${tag}"`;
    return 'Health Blog';
  };

  const getPageDescription = () => {
    if (search) return `Found ${totalCount} articles matching your search.`;
    if (category) return `Explore our ${category.replace('_', ' ')} articles and tips.`;
    if (tag) return `Articles related to ${tag}.`;
    return 'Discover expert health advice, tips, and insights from our pharmacists.';
  };

  const getSEOData = () => {
    const baseTitle = 'Health Blog';
    const baseDescription = 'Discover expert health advice, tips, and insights from our pharmacists.';

    if (search) {
      return {
        title: `Search: ${search} - ${baseTitle}`,
        description: `Search results for "${search}". ${baseDescription}`,
        keywords: ['search', search, 'health articles', 'pharmacy', 'healthcare'],
      };
    }

    if (category) {
      const categoryName = category.replace('_', ' ');
      return {
        title: `${categoryName.toUpperCase()} Articles - ${baseTitle}`,
        description: `Explore our ${categoryName} articles and health tips. ${baseDescription}`,
        keywords: [category, categoryName, 'health', 'pharmacy', 'healthcare'],
      };
    }

    if (tag) {
      return {
        title: `${tag} Articles - ${baseTitle}`,
        description: `Articles tagged with "${tag}". ${baseDescription}`,
        keywords: [tag, 'health articles', 'pharmacy', 'healthcare'],
      };
    }

    return {
      title: baseTitle,
      description: baseDescription,
      keywords: ['health blog', 'pharmacy', 'healthcare', 'health tips', 'medical advice'],
    };
  };

  const seoData = getSEOData();

  return (
    <>
      {/* SEO Head */}
      <SEOHead
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        url={window.location.href}
        type="website"
      />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Navigation */}
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ py: 1 }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'primary.main',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <LocalPharmacyIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                PharmaCare Health Blog
              </Typography>
            </Box>

            {/* Navigation Links */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button component={Link} to="/" startIcon={<ArrowBackIcon />}>
                Back to Home
              </Button>
              <ThemeToggle size="sm" variant="button" />
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Sidebar */}
            <Box sx={{ width: { xs: '100%', md: '25%' }, flexShrink: 0 }}>
              <Box sx={{ position: { md: 'sticky' }, top: 24 }}>
                {/* Search */}
                <Box sx={{ mb: 3 }}>
                  <BlogSearch onSearch={handleSearch} />
                </Box>

                {/* Categories */}
                <BlogCategories
                  orientation="vertical"
                  variant="buttons"
                  showCounts={true}
                />
              </Box>
            </Box>

            {/* Main Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Header */}
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h3"
                  component="h1"
                  sx={{ fontWeight: 600, mb: 2 }}
                >
                  {getPageTitle()}
                </Typography>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {getPageDescription()}
                </Typography>

                {/* Active Filters */}
                {(search || category || tag) && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {search && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete('search');
                          setSearchParams(params);
                        }}
                      >
                        Search: {search} ×
                      </Button>
                    )}
                    {category && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete('category');
                          setSearchParams(params);
                        }}
                      >
                        Category: {category.replace('_', ' ')} ×
                      </Button>
                    )}
                    {tag && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          params.delete('tag');
                          setSearchParams(params);
                        }}
                      >
                        Tag: {tag} ×
                      </Button>
                    )}
                  </Box>
                )}

                {/* Results Count */}
                {!isLoading && (
                  <Typography variant="body2" color="text.secondary">
                    {totalCount === 0
                      ? 'No articles found'
                      : `Showing ${posts.length} of ${totalCount} articles`
                    }
                  </Typography>
                )}
              </Box>

              {/* Error State */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  Failed to load blog posts. Please try again later.
                </Alert>
              )}

              {/* Loading State */}
              {isLoading && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Box
                      key={index}
                      sx={{
                        flex: {
                          xs: '1 1 100%',
                          sm: '1 1 calc(50% - 12px)',
                          lg: '1 1 calc(33.333% - 16px)',
                        },
                      }}
                    >
                      <Box>
                        <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
                        <Skeleton variant="text" sx={{ fontSize: '1.5rem', mb: 1 }} />
                        <Skeleton variant="text" sx={{ mb: 1 }} />
                        <Skeleton variant="text" sx={{ width: '60%' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Posts Grid */}
              {!isLoading && posts.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {posts.map((post) => (
                      <Box
                        key={post._id}
                        sx={{
                          flex: {
                            xs: '1 1 100%',
                            sm: '1 1 calc(50% - 12px)',
                            lg: '1 1 calc(33.333% - 16px)',
                          },
                        }}
                      >
                        <BlogPostCard
                          post={post}
                          variant="default"
                          showImage={true}
                          showExcerpt={true}
                          showAuthor={true}
                          showStats={true}
                        />
                      </Box>
                    ))}
                  </Box>                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                      />
                    </Box>
                  )}
                </>
              )}

              {/* Empty State */}
              {!isLoading && posts.length === 0 && !error && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h5" sx={{ mb: 2, color: 'text.secondary' }}>
                    No articles found
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {search || category || tag
                      ? 'Try adjusting your search criteria or browse all articles.'
                      : 'Check back soon for new health articles and tips.'
                    }
                  </Typography>
                  {(search || category || tag) && (
                    <Button
                      variant="contained"
                      onClick={() => {
                        setSearchParams(new URLSearchParams());
                        setPage(1);
                      }}
                    >
                      View All Articles
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Container>

        <Footer />
      </Box>
    </>
  );
};

export default BlogPage;