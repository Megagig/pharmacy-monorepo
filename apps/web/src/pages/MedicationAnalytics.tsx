/**
 * Medication Analytics Page
 * System-wide medication analytics dashboard
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import SystemWideAnalytics from '../components/medications/SystemWideAnalytics';

const MedicationAnalytics: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/medications');
  };

  return (
    <Box>
      <SystemWideAnalytics onBack={handleBack} />
    </Box>
  );
};

export default MedicationAnalytics;

