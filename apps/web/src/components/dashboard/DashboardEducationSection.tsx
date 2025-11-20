import React from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import { School as EducationIcon } from '@mui/icons-material';
import EducationalResourceCard from '../educational-resources/EducationalResourceCard';

interface DashboardEducationSectionProps {
  resources: Array<{
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
  }>;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}

const DashboardEducationSection: React.FC<DashboardEducationSectionProps> = ({
  resources,
  loading = false,
  error = null,
  compact = false,
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          px: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
        }}
      >
        <EducationIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No educational resources available at this time.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Check back later for health education materials.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={compact ? 2 : 3}>
      {resources.map((resource) => (
        <Grid item xs={12} sm={compact ? 12 : 6} md={compact ? 6 : 4} key={resource.id}>
          <EducationalResourceCard resource={resource} compact={compact} />
        </Grid>
      ))}
    </Grid>
  );
};

export default DashboardEducationSection;
