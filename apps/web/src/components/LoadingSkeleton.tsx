import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

interface LoadingSkeletonProps {
  type?: 'search' | 'details' | 'list';
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'details' }) => {
  if (type === 'search') {
    return (
      <Box className="w-full">
        <Skeleton variant="rounded" height={56} className="mb-4" />
        <Paper elevation={2} className="p-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} variant="rounded" height={60} className="mb-2" />
          ))}
        </Paper>
      </Box>
    );
  }

  if (type === 'list') {
    return (
      <Paper elevation={2} className="p-4">
        {[1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} variant="rounded" height={80} className="mb-3" />
        ))}
      </Paper>
    );
  }

  // Default details skeleton
  return (
    <Paper elevation={2} className="p-4">
      <Skeleton variant="rounded" height={40} className="mb-4" />
      <Skeleton variant="rounded" height={20} width="60%" className="mb-6" />
      <Skeleton variant="rounded" height={200} className="mb-4" />
      <Skeleton variant="rounded" height={150} className="mb-4" />
      <Skeleton variant="rounded" height={100} />
    </Paper>
  );
};

export default LoadingSkeleton;