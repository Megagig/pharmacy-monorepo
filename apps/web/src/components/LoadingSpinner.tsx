import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 40,
  fullScreen = false
}) => {
  const containerStyle = fullScreen
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 9999,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column' as const,
        padding: 2,
      };

  return (
    <Box sx={containerStyle}>
      <CircularProgress size={size} />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2 }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;