import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Article as ArticleIcon,
  PlayCircle as VideoIcon,
  PictureAsPdf as PdfIcon,
  Star as StarIcon,
  TrendingUp as TrendingIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  slug: string;
  thumbnail?: string;
  category: string;
  mediaType: string;
  readingTime?: number;
  viewCount: number;
  rating: number;
  matchReason?: string;
  recommendationScore?: number;
}

interface RecommendationsCarouselProps {
  workspaceId: string;
  type?: 'personalized' | 'general';
  maxItems?: number;
  compact?: boolean;
}

const RecommendationsCarousel: React.FC<RecommendationsCarouselProps> = ({
  workspaceId,
  type = 'personalized',
  maxItems = 6,
  compact = false,
}) => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchRecommendations();
  }, [type]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        type === 'personalized'
          ? '/educational-resources/recommendations/personalized'
          : '/educational-resources/recommendations/general';
      
      const response = await apiClient.get(endpoint, {
        params: { limit: maxItems },
      });
      
      setRecommendations(response.data.data.recommendations || []);
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError('Unable to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : recommendations.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < recommendations.length - 1 ? prev + 1 : 0));
  };

  const handleResourceClick = (resource: Recommendation) => {
    navigate(`/patient-portal/${workspaceId}/education?resource=${resource.slug}`);
  };

  const handleViewAll = () => {
    navigate(`/patient-portal/${workspaceId}/education`, { state: { tab: 1 } }); // Tab 1 = Recommendations
  };

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'video':
        return <VideoIcon />;
      case 'pdf':
        return <PdfIcon />;
      default:
        return <ArticleIcon />;
    }
  };

  const getCategoryColor = (category: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default' => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default'> = {
      medication: 'primary',
      condition: 'secondary',
      wellness: 'success',
      nutrition: 'info',
      lifestyle: 'warning',
      prevention: 'error',
    };
    return colors[category] || 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <SchoolIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No recommendations available at this time
        </Typography>
      </Box>
    );
  }

  const itemsToShow = compact ? 1 : Math.min(3, recommendations.length);
  const visibleRecommendations = recommendations.slice(
    currentIndex,
    currentIndex + itemsToShow
  );

  // Handle wrap-around
  if (visibleRecommendations.length < itemsToShow) {
    visibleRecommendations.push(
      ...recommendations.slice(0, itemsToShow - visibleRecommendations.length)
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <TrendingIcon color="primary" />
          <Typography variant="h6">
            {type === 'personalized' ? 'Recommended for You' : 'Popular Resources'}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            size="small"
            onClick={handlePrevious}
            disabled={recommendations.length <= itemsToShow}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {currentIndex + 1} - {Math.min(currentIndex + itemsToShow, recommendations.length)} of{' '}
            {recommendations.length}
          </Typography>
          <IconButton
            size="small"
            onClick={handleNext}
            disabled={recommendations.length <= itemsToShow}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Carousel */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? '1fr'
            : { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        {visibleRecommendations.map((resource) => (
          <Card
            key={resource.id}
            sx={{
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
            }}
            onClick={() => handleResourceClick(resource)}
          >
            {/* Thumbnail */}
            {resource.thumbnail && !compact && (
              <Box
                sx={{
                  height: 140,
                  backgroundImage: `url(${resource.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    p: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {getMediaIcon(resource.mediaType)}
                </Box>
              </Box>
            )}

            <CardContent>
              {/* Category */}
              <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                <Chip
                  label={resource.category}
                  size="small"
                  color={getCategoryColor(resource.category)}
                  sx={{ textTransform: 'capitalize' }}
                />
                {resource.recommendationScore && resource.recommendationScore > 80 && (
                  <Chip label="Top Match" size="small" color="success" variant="outlined" />
                )}
              </Box>

              {/* Title */}
              <Typography
                variant={compact ? 'body1' : 'subtitle1'}
                fontWeight="600"
                gutterBottom
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  minHeight: compact ? '2.4em' : '3em',
                }}
              >
                {resource.title}
              </Typography>

              {/* Description */}
              {!compact && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    mb: 1,
                  }}
                >
                  {resource.description}
                </Typography>
              )}

              {/* Match Reason */}
              {resource.matchReason && (
                <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 1 }}>
                  {resource.matchReason}
                </Typography>
              )}

              {/* Footer - Rating and Views */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  <Typography variant="caption">{resource.rating.toFixed(1)}</Typography>
                </Box>
                {resource.readingTime && (
                  <Typography variant="caption" color="text.secondary">
                    {resource.readingTime} min read
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* View All Button */}
      <Box textAlign="center">
        <Button variant="outlined" size="small" onClick={handleViewAll}>
          View All Recommendations
        </Button>
      </Box>
    </Box>
  );
};

export default RecommendationsCarousel;
