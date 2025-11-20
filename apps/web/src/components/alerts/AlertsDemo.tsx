/**
 * Alerts Demo Component
 * Demo component to test alert functionality
 */

import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { PatientAlertsPanel } from './index';
import { DashboardAlertsWidget } from './index';

const AlertsDemo: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Alerts System Demo
      </Typography>
      
      <Stack spacing={4}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Patient Alerts Panel
          </Typography>
          <PatientAlertsPanel 
            patientId="demo-patient-id"
            patientName="John Doe"
            maxAlerts={5}
          />
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom>
            Dashboard Alerts Widget
          </Typography>
          <DashboardAlertsWidget 
            maxAlerts={5}
            autoRefresh={false}
          />
        </Box>
      </Stack>
    </Box>
  );
};

export default AlertsDemo;