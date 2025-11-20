import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Breadcrumbs,
  Link,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  Help as HelpIcon,
  MenuBook as GuideIcon,
  School as TrainingIcon,
  Assignment as ReferenceIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MTRDocumentation from '../components/help/MTRDocumentation';
import {
  KeyboardShortcuts,
  StatusIndicators,
} from '../components/help/MTRContextualHelp';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`help-tabpanel-${index}`}
      aria-labelledby={`help-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `help-tab-${index}`,
    'aria-controls': `help-tabpanel-${index}`,
  };
}

const MTRHelp: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const quickStartGuides = [
    {
      title: 'First Time User',
      description: 'New to MTR? Start here for a complete introduction.',
      duration: '15 minutes',
      steps: ['System overview', 'Basic navigation', 'First MTR session'],
      color: 'primary' as const,
    },
    {
      title: 'Quick MTR Session',
      description: 'Fast-track guide for experienced users.',
      duration: '5 minutes',
      steps: [
        'Patient selection',
        'Key assessment points',
        'Documentation tips',
      ],
      color: 'secondary' as const,
    },
    {
      title: 'Advanced Features',
      description: 'Learn about advanced MTR capabilities.',
      duration: '20 minutes',
      steps: ['Custom templates', 'Bulk operations', 'Integration features'],
      color: 'success' as const,
    },
  ];

  const commonTasks = [
    { task: 'Start a new MTR session', shortcut: 'Ctrl + N', page: '/mtr' },
    { task: 'Search for patients', shortcut: 'Ctrl + F', page: '/patients' },
    { task: 'View MTR reports', shortcut: 'Ctrl + R', page: '/reports' },
    { task: 'Access help system', shortcut: 'Ctrl + ?', page: '/help' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('/dashboard');
          }}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Dashboard
        </Link>
        <Typography
          color="text.primary"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HelpIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          MTR Help & Documentation
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          MTR Help & Documentation
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Comprehensive guide to using the Medication Therapy Review system
          effectively
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<GuideIcon />}
            onClick={() => navigate('/mtr')}
          >
            Start MTR Session
          </Button>
          <Button
            variant="outlined"
            startIcon={<TrainingIcon />}
            onClick={() =>
              window.open('/docs/MTR_TRAINING_MATERIALS.md', '_blank')
            }
          >
            Training Materials
          </Button>
          <Button
            variant="outlined"
            startIcon={<ReferenceIcon />}
            onClick={() => window.open('/docs/MTR_USER_GUIDE.md', '_blank')}
          >
            Full User Guide
          </Button>
        </Box>
      </Box>

      {/* Quick Start Guides */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Quick Start Guides
          </Typography>
          <Grid container spacing={3}>
            {quickStartGuides.map((guide, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6" component="h3">
                        {guide.title}
                      </Typography>
                      <Chip
                        label={guide.duration}
                        color={guide.color}
                        size="sm"
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      paragraph
                    >
                      {guide.description}
                    </Typography>
                    <Typography variant="subtitle2" gutterBottom>
                      What you'll learn:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {guide.steps.map((step, stepIndex) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={stepIndex}
                        >
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* Common Tasks */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Common Tasks & Shortcuts
          </Typography>
          <Grid container spacing={2}>
            {commonTasks.map((item, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="body1" gutterBottom>
                      {item.task}
                    </Typography>
                    <Chip
                      label={item.shortcut}
                      variant="outlined"
                      size="sm"
                    />
                    <Box sx={{ mt: 1 }}>
                      <Button size="sm" onClick={() => navigate(item.page)}>
                        Go to Page
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* Tabbed Documentation */}
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="help documentation tabs"
          >
            <Tab label="Overview & Workflow" {...a11yProps(0)} />
            <Tab label="Best Practices" {...a11yProps(1)} />
            <Tab label="Troubleshooting" {...a11yProps(2)} />
            <Tab label="Reference" {...a11yProps(3)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <MTRDocumentation section="workflow" />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <MTRDocumentation section="best-practices" />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <MTRDocumentation section="troubleshooting" />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <KeyboardShortcuts />
              </Grid>
              <Grid item xs={12} md={6}>
                <StatusIndicators />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3 }}>
              <MTRDocumentation section="reference" />
            </Box>
          </Box>
        </TabPanel>
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Need additional help? Contact your system administrator or training
          coordinator.
        </Typography>
      </Box>
    </Container>
  );
};

export default MTRHelp;
