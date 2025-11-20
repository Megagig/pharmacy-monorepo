import React from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Button,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Visibility as VisibilityIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { BlogPost } from '../../hooks/useHealthBlog';

interface BlogPostCardProps {
  post: BlogPost;
  variant?: 'default' | 'featured' | 'compact';
  showImage?: boolean;
  showExcerpt?: boolean;
  showAuthor?: boolean;
  showStats?: boolean;
  className?: string;
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({
  post,
  variant = 'default',
  showImage = true,
  showExcerpt = true,
  showAuthor = true,
  showStats = true,
  className,
}) => {
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

  const getCardHeight = () => {
    switch (variant) {
      case 'featured':
        return '100%';
      case 'compact':
        return 'auto';
      default:
        return '100%';
    }
  };

  const getImageHeight = () => {
    switch (variant) {
      case 'featured':
        return 200;
      case 'compact':
        return 120;
      default:
        return 160;
    }
  };

  return (
    <Card
      className={className}
      sx={{
        height: getCardHeight(),
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '&:hover': {
          transform: variant === 'featured' ? 'translateY(-8px)' : 'translateY(-4px)',
          boxShadow: variant === 'featured' 
            ? '0 12px 24px rgba(8, 145, 178, 0.15)' 
            : '0 8px 16px rgba(8, 145, 178, 0.1)',
        },
      }}
    >
      {/* Featured Image */}
      {showImage && post.featuredImage && (
        <Box
          component="img"
          src={post.featuredImage.url}
          alt={post.featuredImage.alt}
          sx={{
            width: '100%',
            height: getImageHeight(),
            objectFit: 'cover',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      <CardContent 
        sx={{ 
          flexGrow: 1, 
          p: variant === 'compact' ? 2 : 3,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Category Chip */}
        <Box sx={{ mb: variant === 'compact' ? 1 : 2 }}>
          <Chip
            label={post.category.replace('_', ' ').toUpperCase()}
            color={getCategoryColor(post.category)}
            size="small"
            sx={{ mb: variant === 'compact' ? 0.5 : 1 }}
          />
          {post.isFeatured && (
            <Chip
              label="FEATURED"
              color="secondary"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>

        {/* Title */}
        <Typography
          variant={variant === 'featured' ? 'h6' : variant === 'compact' ? 'subtitle1' : 'h6'}
          component="h3"
          sx={{ 
            fontWeight: 600, 
            mb: variant === 'compact' ? 1 : 2, 
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: variant === 'compact' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.title}
        </Typography>

        {/* Excerpt */}
        {showExcerpt && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ 
              mb: variant === 'compact' ? 2 : 3, 
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: variant === 'compact' ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {variant === 'compact' && post.excerpt.length > 100
              ? `${post.excerpt.substring(0, 100)}...`
              : post.excerpt
            }
          </Typography>
        )}

        {/* Author and Stats */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 'auto',
            mb: variant === 'compact' ? 1 : 2,
          }}
        >
          {/* Author */}
          {showAuthor && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{ 
                  width: variant === 'compact' ? 20 : 24, 
                  height: variant === 'compact' ? 20 : 24, 
                  fontSize: variant === 'compact' ? '0.7rem' : '0.75rem' 
                }}
                src={post.author.avatar}
              >
                {post.author.name.charAt(0)}
              </Avatar>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ fontSize: variant === 'compact' ? '0.7rem' : '0.75rem' }}
              >
                {post.author.name}
              </Typography>
            </Box>
          )}

          {/* Stats */}
          {showStats && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: variant === 'compact' ? 1 : 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon 
                  sx={{ 
                    fontSize: variant === 'compact' ? 14 : 16, 
                    color: 'text.secondary' 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ fontSize: variant === 'compact' ? '0.7rem' : '0.75rem' }}
                >
                  {post.readTime} min
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon 
                  sx={{ 
                    fontSize: variant === 'compact' ? 14 : 16, 
                    color: 'text.secondary' 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ fontSize: variant === 'compact' ? '0.7rem' : '0.75rem' }}
                >
                  {post.viewCount}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Published Date */}
        {variant !== 'compact' && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ mb: 2 }}
          >
            {formatDate(post.publishedAt)}
          </Typography>
        )}

        {/* Read More Button */}
        <Button
          component={Link}
          to={`/blog/${post.slug}`}
          variant={variant === 'featured' ? 'contained' : 'text'}
          endIcon={<ArrowForwardIcon />}
          sx={{ 
            mt: 'auto',
            alignSelf: 'flex-start',
            ...(variant === 'compact' && { p: 0, minWidth: 'auto' }),
          }}
        >
          {variant === 'compact' ? 'Read' : 'Read More'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default BlogPostCard;