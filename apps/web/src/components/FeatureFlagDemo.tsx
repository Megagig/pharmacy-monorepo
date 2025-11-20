import React from 'react';
import { Box, Typography, Paper, Chip, Alert } from '@mui/material';
import useFeatureFlags from '../hooks/useFeatureFlags';

interface FeatureFlagDemoProps {
  featureKey: string;
  title: string;
  description: string;
}

/**
 * Component to demonstrate feature flag usage
 */
const FeatureFlagDemo: React.FC<FeatureFlagDemoProps> = ({
  featureKey,
  title,
  description,
}) => {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();
  const enabled = isFeatureEnabled(featureKey);

  if (isLoading) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography>Loading feature flag status...</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        borderLeft: enabled ? '4px solid #4caf50' : '4px solid #f44336',
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography variant="h6">{title}</Typography>
        <Chip
          label={enabled ? 'Enabled' : 'Disabled'}
          color={enabled ? 'success' : 'error'}
          size="small"
        />
      </Box>

      <Typography variant="body2" color="textSecondary" gutterBottom>
        Feature key: <code>{featureKey}</code>
      </Typography>

      <Typography variant="body1" paragraph>
        {description}
      </Typography>

      {enabled ? (
        <Box mt={2}>
          <Alert severity="success">
            This feature is enabled for your subscription tier and role!
          </Alert>
        </Box>
      ) : (
        <Box mt={2}>
          <Alert severity="info">
            This feature is currently disabled. Contact your administrator or
            upgrade your subscription to access it.
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default FeatureFlagDemo;
