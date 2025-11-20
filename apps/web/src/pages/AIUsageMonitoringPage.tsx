import React from 'react';
import { Box, Typography } from '@mui/material';
import AIUsageMonitoring from '../components/admin/AIUsageMonitoring';

const AIUsageMonitoringPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        AI Model Usage Monitoring
      </Typography>
      <AIUsageMonitoring />
    </Box>
  );
};

export default AIUsageMonitoringPage;