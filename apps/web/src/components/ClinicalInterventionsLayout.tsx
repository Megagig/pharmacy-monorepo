import React from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  Typography,
  Breadcrumbs,
  Link,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Assessment as ReportsIcon,
} from '@mui/icons-material';
import List from '@mui/icons-material/List';
import Person from '@mui/icons-material/Person';
import History from '@mui/icons-material/History';
import Security from '@mui/icons-material/Security';
import { Link as RouterLink } from 'react-router-dom';

// Import components
import ClinicalInterventionDashboard from './ClinicalInterventionDashboard';
import ClinicalInterventionsList from './ClinicalInterventionsList';
import ClinicalInterventionForm from './ClinicalInterventionForm';
import ClinicalInterventionDetails from './ClinicalInterventionDetails';
import ScheduleInterventionFollowUp from './ScheduleInterventionFollowUp';
import PatientInterventions from './PatientInterventions';
import ClinicalInterventionReports from './ClinicalInterventionReports';
import ClinicalInterventionComplianceReport from './ClinicalInterventionComplianceReport';

const ClinicalInterventionsLayout: React.FC = () => {
  const location = useLocation();
  const theme = useTheme();

  // Get current tab based on pathname
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 0;
    if (path.includes('/create')) return 1;
    if (path.includes('/list')) return 2;
    if (path.includes('/patients')) return 3;
    if (path.includes('/reports')) return 4;
    if (path.includes('/audit')) return 5;
    if (path.includes('/compliance')) return 6;
    return 0; // Default to dashboard
  };

  const tabRoutes = [
    {
      label: 'Dashboard',
      path: '/pharmacy/clinical-interventions/dashboard',
      icon: <DashboardIcon />,
    },
    {
      label: 'Create New',
      path: '/pharmacy/clinical-interventions/create',
      icon: <AddIcon />,
    },
    {
      label: 'Manage All',
      path: '/pharmacy/clinical-interventions/list',
      icon: <List />,
    },
    {
      label: 'By Patient',
      path: '/pharmacy/clinical-interventions/patients',
      icon: <Person />,
    },
    {
      label: 'Reports',
      path: '/pharmacy/clinical-interventions/reports',
      icon: <ReportsIcon />,
    },
    {
      label: 'Compliance',
      path: '/pharmacy/clinical-interventions/compliance',
      icon: <Security />,
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/dashboard" color="inherit">
          Dashboard
        </Link>
        <Link
          component={RouterLink}
          to="/pharmacy/clinical-interventions"
          color="inherit"
        >
          Pharmacy
        </Link>
        <Typography color="text.primary">Clinical Interventions</Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Clinical Interventions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive clinical intervention management and workflow system
        </Typography>
      </Box>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={getCurrentTab()}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            },
          }}
        >
          {tabRoutes.map((tab) => (
            <Tab
              key={tab.path}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              component={RouterLink}
              to={tab.path}
              sx={{
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                  fontWeight: 600,
                },
              }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Route Content */}
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to="/pharmacy/clinical-interventions/dashboard" replace />
          }
        />
        <Route path="/dashboard" element={<ClinicalInterventionDashboard />} />
        <Route path="/create" element={<ClinicalInterventionForm />} />
        <Route path="/list" element={<ClinicalInterventionsList />} />
        <Route path="/edit/:id" element={<ClinicalInterventionForm />} />
        <Route path="/details/:id" element={<ClinicalInterventionDetails />} />
        <Route path="/:id/schedule-followup" element={<ScheduleInterventionFollowUp />} />
        <Route path="/patients" element={<PatientInterventions />} />
        <Route path="/patients/:patientId" element={<PatientInterventions />} />
        <Route path="/reports" element={<ClinicalInterventionReports />} />
        <Route
          path="/compliance"
          element={<ClinicalInterventionComplianceReport />}
        />

        <Route
          path="*"
          element={
            <Navigate to="/pharmacy/clinical-interventions/dashboard" replace />
          }
        />
      </Routes>
    </Container>
  );
};

// Wrapper component to pass interventionId from URL params


export default ClinicalInterventionsLayout;
