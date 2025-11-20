import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  LocalPharmacy as MedicationIcon,
  FitnessCenter as WellnessIcon,
  Restaurant as NutritionIcon,
  Favorite as ChronicIcon,
  Security as PreventiveIcon,
  Psychology as MentalHealthIcon,
  Category as AllIcon,
} from '@mui/icons-material';
import { useHealthBlog } from '../../hooks/useHealthBlog';

interface BlogCategoriesProps {
  orientation?: 'horizontal' | 'vertical';
  showCounts?: boolean;
  variant?: 'chips' | 'buttons';
  className?: string;
}

const BlogCategories: React.FC<BlogCategoriesProps> = ({
  orientation = 'horizontal',
  showCounts = true,
  variant = 'chips',
  className,
}) => {
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get('category');

  const { data: categoriesResponse, isLoading, error } = useHealthBlog.useCategories();
  const categories = categoriesResponse?.data || [];

  // Category metadata with icons and colors
  const categoryMeta = {
    all: {
      label: 'All Articles',
      icon: AllIcon,
      color: 'default' as const,
      description: 'Browse all health articles',
    },
    nutrition: {
      label: 'Nutrition',
      icon: NutritionIcon,
      color: 'success' as const,
      description: 'Diet, supplements, and nutritional guidance',
    },
    wellness: {
      label: 'Wellness',
      icon: WellnessIcon,
      color: 'primary' as const,
      description: 'General health and wellness tips',
    },
    medication: {
      label: 'Medication',
      icon: MedicationIcon,
      color: 'info' as const,
      description: 'Medication management and safety',
    },
    chronic_diseases: {
      label: 'Chronic Diseases',
      icon: ChronicIcon,
      color: 'warning' as const,
      description: 'Managing chronic health conditions',
    },
    preventive_care: {
      label: 'Preventive Care',
      icon: PreventiveIcon,
      color: 'secondary' as const,
      description: 'Prevention and early detection',
    },
    mental_health: {
      label: 'Mental Health',
      icon: MentalHealthIcon,
      color: 'error' as const,
      description: 'Mental health and emotional wellbeing',
    },
  };

  const getCategoryCount = (category: string) => {
    if (category === 'all') {
      return categories.reduce((total, cat) => total + cat.count, 0);
    }
    return categories.find(cat => cat.category === category)?.count || 0;
  };

  const buildCategoryUrl = (category: string) => {
    const params = new URLSearchParams(searchParams);
    if (category === 'all') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    return `/blog?${params.toString()}`;
  };

  if (isLoading) {
    return (
      <Box 
        className={className}
        sx={{ 
          display: 'flex', 
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          flexWrap: orientation === 'horizontal' ? 'wrap' : 'nowrap',
          gap: 1,
        }}
      >
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width={orientation === 'vertical' ? '100%' : 120}
            height={32}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load categories
      </Alert>
    );
  }

  const allCategories = ['all', ...Object.keys(categoryMeta).filter(key => key !== 'all')];

  return (
    <Box className={className}>
      {orientation === 'vertical' && (
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Categories
        </Typography>
      )}
      
      <Box
        sx={{
          display: 'flex',
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          flexWrap: orientation === 'horizontal' ? 'wrap' : 'nowrap',
          gap: orientation === 'vertical' ? 1 : 1,
        }}
      >
        {allCategories.map((categoryKey) => {
          const meta = categoryMeta[categoryKey as keyof typeof categoryMeta];
          const count = getCategoryCount(categoryKey);
          const isActive = currentCategory === categoryKey || (categoryKey === 'all' && !currentCategory);
          const IconComponent = meta.icon;

          if (variant === 'chips') {
            return (
              <Chip
                key={categoryKey}
                component={Link}
                to={buildCategoryUrl(categoryKey)}
                icon={<IconComponent />}
                label={
                  showCounts && count > 0 
                    ? `${meta.label} (${count})`
                    : meta.label
                }
                color={isActive ? meta.color : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                clickable
                sx={{
                  '&:hover': {
                    backgroundColor: isActive 
                      ? undefined 
                      : `${meta.color === 'default' ? 'primary' : meta.color}.light`,
                  },
                  ...(orientation === 'vertical' && {
                    justifyContent: 'flex-start',
                    width: '100%',
                  }),
                }}
              />
            );
          }

          // Button variant for vertical orientation
          return (
            <Box
              key={categoryKey}
              component={Link}
              to={buildCategoryUrl(categoryKey)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1,
                textDecoration: 'none',
                color: 'inherit',
                backgroundColor: isActive ? `${meta.color}.light` : 'transparent',
                border: '1px solid',
                borderColor: isActive ? `${meta.color}.main` : 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: `${meta.color === 'default' ? 'primary' : meta.color}.light`,
                  borderColor: `${meta.color === 'default' ? 'primary' : meta.color}.main`,
                },
              }}
            >
              <IconComponent 
                sx={{ 
                  color: isActive ? `${meta.color}.main` : 'text.secondary',
                  fontSize: 20,
                }} 
              />
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ 
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? `${meta.color}.main` : 'text.primary',
                  }}
                >
                  {meta.label}
                </Typography>
                {orientation === 'vertical' && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.2 }}
                  >
                    {meta.description}
                  </Typography>
                )}
              </Box>
              {showCounts && count > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    backgroundColor: isActive ? `${meta.color}.main` : 'grey.200',
                    color: isActive ? 'white' : 'text.secondary',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontWeight: 600,
                    minWidth: 24,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default BlogCategories;