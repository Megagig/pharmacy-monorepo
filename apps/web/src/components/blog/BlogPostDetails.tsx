import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  Button,
  IconButton,
  Skeleton,
  Alert,
} from '@mui/material';
import SEOHead from '../common/SEOHead';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LinkIcon from '@mui/icons-material/Link';
import { useHealthBlog, BlogPost } from '../../hooks/useHealthBlog';
import BlogPostCard from './BlogPostCard';

interface BlogPostDetailsProps {
  slug?: string;
}

const BlogPostDetails: React.FC<BlogPostDetailsProps> = ({ slug: propSlug }) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = propSlug || paramSlug;

  const {
    data: postResponse,
    isLoading,
    error
  } = useHealthBlog.usePostBySlug(slug || '');

  const {
    data: relatedPostsResponse,
    isLoading: relatedLoading
  } = useHealthBlog.useRelatedPosts(
    slug || '',
    3,
    !!slug && !!postResponse?.data
  );

  const incrementViewCount = useHealthBlog.useIncrementViewCount();

  const post = postResponse?.data;
  const relatedPosts = relatedPostsResponse?.data || [];

  // Debug logging
  useEffect(() => {

  }, [slug, isLoading, error, postResponse, post, relatedPosts.length]);

  // Increment view count when post loads (only once per slug)
  useEffect(() => {
    if (slug) {
      incrementViewCount.mutate(slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' } = {
      nutrition: 'success',
      wellness: 'primary',
      medication: 'info',
      chronic_diseases: 'warning',
      preventive_care: 'secondary',
      mental_health: 'error',
    };
    return colors[category] || 'primary';
  };

  const sharePost = (platform: 'facebook' | 'twitter' | 'linkedin' | 'copy') => {
    const url = window.location.href;
    const title = post?.title || '';
    const description = post?.excerpt || '';

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => {
          // You could show a toast notification here

        });
        break;
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 2 }} />
        <Skeleton variant="text" sx={{ fontSize: '1rem', mb: 1 }} />
        <Skeleton variant="text" sx={{ fontSize: '1rem', mb: 3 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} />
          </Box>
        </Box>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} variant="text" sx={{ fontSize: '1rem', mb: 1 }} />
        ))}
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : 'Blog post not found'}
        </Alert>
        <Button
          component={Link}
          to="/blog"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Blog
        </Button>
      </Container>
    );
  }

  return (
    <>
      {/* SEO Head */}
      {post && (
        <SEOHead
          title={post.seo.metaTitle || post.title}
          description={post.seo.metaDescription || post.excerpt}
          keywords={post.seo.keywords}
          image={post.featuredImage?.url}
          url={window.location.href}
          type="article"
          publishedTime={post.publishedAt}
          modifiedTime={post.updatedAt}
          author={post.author.name}
          section={post.category.replace('_', ' ')}
          tags={post.tags}
        />
      )}

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Back Button */}
        <Button
          component={Link}
          to="/blog"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 3 }}
        >
          Back to Blog
        </Button>

        {/* Featured Image */}
        {post.featuredImage && (
          <Box
            component="img"
            src={post.featuredImage.url}
            alt={post.featuredImage.alt}
            sx={{
              width: '100%',
              height: 400,
              objectFit: 'cover',
              borderRadius: 2,
              mb: 3,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Category and Featured Badge */}
        <Box sx={{ mb: 2 }}>
          <Chip
            label={post.category.replace('_', ' ').toUpperCase()}
            color={getCategoryColor(post.category)}
            sx={{ mr: 1 }}
          />
          {post.isFeatured && (
            <Chip
              label="FEATURED"
              color="secondary"
            />
          )}
        </Box>

        {/* Title */}
        <Typography
          variant="h3"
          component="h1"
          sx={{ fontWeight: 700, mb: 3, lineHeight: 1.2 }}
        >
          {post.title}
        </Typography>

        {/* Meta Information */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{ width: 40, height: 40 }}
              src={post.author.avatar}
            >
              {post.author.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {post.author.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDate(post.publishedAt)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {post.readTime} min read
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {post.viewCount} views
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Content */}
        <Box
          sx={{
            '& p': { mb: 2, lineHeight: 1.7 },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              fontWeight: 600,
              mt: 3,
              mb: 2,
              color: 'text.primary',
            },
            '& ul, & ol': { mb: 2, pl: 3 },
            '& li': { mb: 1 },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              pl: 2,
              py: 1,
              my: 2,
              bgcolor: 'grey.50',
              fontStyle: 'italic',
            },
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 1,
              my: 2,
            },
            '& code': {
              bgcolor: 'grey.100',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.875rem',
            },
            '& pre': {
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              my: 2,
            },
          }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <Box sx={{ mt: 4, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {post.tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  variant="outlined"
                  size="small"
                  component={Link}
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  clickable
                />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Share Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Share this article
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={() => sharePost('facebook')}
              sx={{ color: '#1877F2' }}
              aria-label="Share on Facebook"
            >
              <FacebookIcon />
            </IconButton>
            <IconButton
              onClick={() => sharePost('twitter')}
              sx={{ color: '#1DA1F2' }}
              aria-label="Share on Twitter"
            >
              <TwitterIcon />
            </IconButton>
            <IconButton
              onClick={() => sharePost('linkedin')}
              sx={{ color: '#0A66C2' }}
              aria-label="Share on LinkedIn"
            >
              <LinkedInIcon />
            </IconButton>
            <IconButton
              onClick={() => sharePost('copy')}
              sx={{ color: 'text.secondary' }}
              aria-label="Copy link"
            >
              <LinkIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Related Posts */}
        {!relatedLoading && relatedPosts.length > 0 && (
          <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
              Related Articles
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {relatedPosts.map((relatedPost: BlogPost) => (
                <Box
                  key={relatedPost._id}
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      md: '1 1 calc(33.333% - 16px)',
                    },
                  }}
                >
                  <BlogPostCard
                    post={relatedPost}
                    variant="compact"
                    showExcerpt={false}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </>
  );
};

export default BlogPostDetails;