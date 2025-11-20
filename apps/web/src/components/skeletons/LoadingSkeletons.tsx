import React from 'react';
import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';

// Dashboard skeleton
export const DashboardSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    {/* Header skeleton */}
    <Box sx={{ mb: 3 }}>
      <Skeleton variant="text" width="40%" height={40} />
      <Skeleton variant="text" width="60%" height={24} />
    </Box>
    
    {/* Stats cards skeleton */}
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {[1, 2, 3, 4].map((item) => (
        <Grid item xs={12} sm={6} md={3} key={item}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="80%" height={20} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
    
    {/* Chart skeleton */}
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Skeleton variant="text" width="30%" height={32} />
        <Skeleton variant="rectangular" width="100%" height={300} />
      </CardContent>
    </Card>
    
    {/* Table skeleton */}
    <Card>
      <CardContent>
        <Skeleton variant="text" width="25%" height={32} />
        {[1, 2, 3, 4, 5].map((row) => (
          <Box key={row} sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
            <Skeleton variant="text" width="20%" />
          </Box>
        ))}
      </CardContent>
    </Card>
  </Box>
);

// Patient list skeleton
export const PatientListSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    {/* Header with search */}
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton variant="text" width="30%" height={40} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="rectangular" width={200} height={40} />
        <Skeleton variant="rectangular" width={120} height={40} />
      </Box>
    </Box>
    
    {/* Patient cards */}
    <Grid container spacing={2}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Grid item xs={12} sm={6} md={4} key={item}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={50} height={50} />
                <Box sx={{ ml: 2, flex: 1 }}>
                  <Skeleton variant="text" width="80%" height={24} />
                  <Skeleton variant="text" width="60%" height={20} />
                </Box>
              </Box>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="70%" />
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Skeleton variant="rectangular" width={80} height={32} />
                <Skeleton variant="rectangular" width={80} height={32} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  </Box>
);

// Clinical notes skeleton
export const ClinicalNotesSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    {/* Header */}
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton variant="text" width="35%" height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
    </Box>
    
    {/* Filters */}
    <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
      <Skeleton variant="rectangular" width={200} height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
      <Skeleton variant="rectangular" width={120} height={40} />
    </Box>
    
    {/* Notes list */}
    {[1, 2, 3, 4, 5].map((item) => (
      <Card key={item} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
            <Skeleton variant="text" width="15%" height={20} />
          </Box>
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Skeleton variant="rectangular" width={60} height={24} />
            <Skeleton variant="rectangular" width={80} height={24} />
          </Box>
        </CardContent>
      </Card>
    ))}
  </Box>
);

// Form skeleton
export const FormSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width="40%" height={40} sx={{ mb: 3 }} />
    
    <Card>
      <CardContent>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} key={item}>
              <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={40} />
            </Grid>
          ))}
          <Grid item xs={12}>
            <Skeleton variant="text" width="20%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" width="100%" height={120} />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Skeleton variant="rectangular" width={100} height={40} />
          <Skeleton variant="rectangular" width={100} height={40} />
        </Box>
      </CardContent>
    </Card>
  </Box>
);

// Chart/Analytics skeleton
export const ChartSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton variant="text" width="35%" height={40} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="rectangular" width={120} height={40} />
        <Skeleton variant="rectangular" width={100} height={40} />
      </Box>
    </Box>
    
    {/* Chart cards */}
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="40%" height={32} />
            <Skeleton variant="rectangular" width="100%" height={400} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="rectangular" width="100%" height={200} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="50%" height={24} />
            {[1, 2, 3, 4].map((item) => (
              <Box key={item} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="20%" />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

// Generic page skeleton
export const PageSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="60%" height={24} sx={{ mb: 3 }} />
    
    <Card>
      <CardContent>
        <Skeleton variant="rectangular" width="100%" height={400} />
      </CardContent>
    </Card>
  </Box>
);