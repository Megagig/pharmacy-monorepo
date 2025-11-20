import React, { useState } from 'react';
import {
  Typography,
  Box,
  Card,
  Button,
  Tabs,
  Tab,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Medication as MedicationIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
// PageHeader is not found in the project
import LoadingSpinner from '../components/LoadingSpinner';
import { useSubscriptionStatus } from '../hooks/useSubscription';
// Import the modern components
import ModernSystemAnalytics from '../components/medications/ModernSystemAnalytics';
import ModernMedicationSettings from '../components/medications/ModernMedicationSettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`medications-tabpanel-${index}`}
      aria-labelledby={`medications-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const Medications = () => {
  // Theme not currently used
  const [tabValue, setTabValue] = useState(0);
  const { isActive, loading } = useSubscriptionStatus();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Implementation for premium users will go here
  if (!isActive) {
    return (
      <Box sx={{ p: 3 }}>
        <Helmet>
          <title>Medications | PharmacyCopilot</title>
        </Helmet>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 600, mb: 1 }}
            >
              Medications
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage patient medications, interactions, and adherence tracking
            </Typography>
          </Box>
        </Box>

        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Box
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'secondary.light',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <MedicationIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              Premium Feature
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}
            >
              Advanced medication tracking, drug interaction checking, adherence
              monitoring, and prescription management features require a premium
              subscription.
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Button variant="contained" component={Link} to="/subscriptions">
                Upgrade Now
              </Button>
              <Button variant="outlined" component={Link} to="/dashboard">
                Back to Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // For subscribed users, show the full medication management interface
  return (
    <Box sx={{ p: 3 }}>
      <Helmet>
        <title>Medication Management | PharmacyCopilot</title>
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Medication Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage patient medications, interactions, and adherence tracking
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          component={Link}
          to="/patients?for=medications"
        >
          Select Patient
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="medication management tabs"
          >
            <Tab label="Dashboard" id="medications-tab-0" />
            <Tab label="Analytics" id="medications-tab-1" />
            <Tab label="Settings" id="medications-tab-2" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 4,
              color: 'white',
              p: 4,
            }}
          >
            <Box
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <MedicationIcon sx={{ fontSize: 60 }} />
            </Box>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
              Medication Dashboard
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, opacity: 0.9, maxWidth: 600 }}>
              Welcome to the comprehensive medication management system. Select a patient to view their detailed medication dashboard or explore system-wide analytics.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/patients?for=medications"
                startIcon={<AddIcon />}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                  },
                }}
              >
                Select Patient
              </Button>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/medications/dashboard"
                sx={{
                  borderColor: 'rgba(255,255,255,0.5)',
                  color: 'white',
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                View System Dashboard
              </Button>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ModernSystemAnalytics patientId="system" />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <ModernMedicationSettings patientId="system" />
        </TabPanel>
      </Card>
    </Box>
  );
};

export default Medications;
