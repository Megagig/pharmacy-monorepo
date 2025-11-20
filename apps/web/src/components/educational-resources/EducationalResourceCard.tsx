import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Rating,
  IconButton,
} from '@mui/material';
import {
  Article as ArticleIcon,
  PlayCircle as VideoIcon,
  PictureAsPdf as PdfIcon,
  Headphones as AudioIcon,
  TouchApp as InteractiveIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

interface EducationalResourceCardProps {
  resource: {
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
  };
  compact?: boolean;
  onClick?: () => void;
}

const EducationalResourceCard: React.FC<EducationalResourceCardProps> = ({
  resource,
  compact = false,
  onClick,
}) => {
  const navigate = useNavigate();

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'video':
        return <VideoIcon fontSize="small" />;
      case 'pdf':
        return <PdfIcon fontSize="small" />;
      case 'audio':
        return <AudioIcon fontSize="small" />;
      case 'interactive':
        return <InteractiveIcon fontSize="small" />;
      default:
        return <ArticleIcon fontSize="small" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, "primary" | "secondary" | "success" | "error" | "info" | "warning"> = {
      medication: 'primary',
      condition: 'secondary',
      wellness: 'success',
      nutrition: 'info',
      lifestyle: 'warning',
      prevention: 'error',
      faq: 'default' as any,
    };
    return colors[category] || 'default';
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Navigate to education page with resource detail
      navigate(`/patient-portal/${resource.id}/education?resource=${resource.slug}`);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={handleClick}
    >
      {resource.thumbnail && !compact && (
        <CardMedia
          component="img"
          height={compact ? '120' : '160'}
          image={resource.thumbnail}
          alt={resource.title}
          sx={{ objectFit: 'cover' }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, pb: compact ? 2 : 3 }}>
        {/* Category and Media Type */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Chip
            label={resource.category}
            size="small"
            color={getCategoryColor(resource.category)}
            sx={{ textTransform: 'capitalize' }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
            {getMediaIcon(resource.mediaType)}
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant={compact ? 'body1' : 'h6'}
          component="h3"
          gutterBottom
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.3,
            minHeight: compact ? '2.6em' : '3.6em',
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
              mb: 2,
            }}
          >
            {resource.description}
          </Typography>
        )}

        {/* Footer - Rating and Views */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: compact ? 1 : 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating value={resource.rating} readOnly size="small" precision={0.1} />
            {!compact && (
              <Typography variant="caption" color="text.secondary">
                ({resource.rating.toFixed(1)})
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ViewIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {resource.viewCount}
            </Typography>
          </Box>
        </Box>

        {/* Reading Time */}
        {resource.readingTime && !compact && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {resource.readingTime} min read
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default EducationalResourceCard;
