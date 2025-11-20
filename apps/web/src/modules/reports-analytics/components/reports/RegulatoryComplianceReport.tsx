// Regulatory Compliance Reports Module Component
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Security,
  Gavel,
  Assignment,
  Timeline,
  CheckCircle,
  Warning,
  Error,
  Schedule,
  Person,
  Description,
  TrendingUp,
  TrendingDown,
  Assessment,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData } from '../../types/charts';
import { RegulatoryComplianceFilters } from '../../types/filters';
import { useCurrentFilters } from '../../stores/filtersStore';
import { ReportType } from '../../types/reports';

interface RegulatoryComplianceReportProps {
  filters: RegulatoryComplianceFilters;
  onFilterChange?: (filters: RegulatoryComplianceFilters) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const RegulatoryComplianceReport: React.FC<RegulatoryComplianceReportProps> = ({
  filters,
  onFilterChange,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data - in real implementation, this would come from API
  const mockData = useMemo(
    () => ({
      // KPI Cards Data
      kpiData: [
        {
          title: 'Overall Compliance Rate',
          value: 94.7,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 3.2,
            period: 'vs last quarter',
          },
          status: 'success' as const,
          target: { value: 95, label: '%' },
        },
        {
          title: 'Documentation Compliance',
          value: 96.8,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 2.1,
            period: 'improvement',
          },
          status: 'success' as const,
        },
        {
          title: 'Audit Trail Completeness',
          value: 98.5,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 1.8,
            period: 'vs target',
          },
          status: 'success' as const,
        },
        {
          title: 'Open Compliance Issues',
          value: 12,
          unit: 'issues',
          trend: {
            direction: 'down' as const,
            value: 25.0,
            period: 'reduction',
          },
          status: 'warning' as const,
        },
      ],

      // Compliance Issues List
      complianceIssues: [
        {
          id: 'CI-001',
          issue: 'Incomplete medication reconciliation documentation',
          severity: 'high' as const,
          status: 'in-progress' as const,
          dueDate: new Date('2024-02-15'),
          assignedTo: 'Dr. Sarah Johnson',
          category: 'Documentation',
        },
        {
          id: 'CI-002',
          issue: 'Missing patient consent forms',
          severity: 'medium' as const,
          status: 'open' as const,
          dueDate: new Date('2024-02-20'),
          assignedTo: 'Nurse Manager',
          category: 'Patient Safety',
        },
        {
          id: 'CI-003',
          issue: 'Delayed adverse event reporting',
          severity: 'critical' as const,
          status: 'resolved' as const,
          dueDate: new Date('2024-01-30'),
          assignedTo: 'Quality Assurance',
          category: 'Regulatory',
        },
        {
          id: 'CI-004',
          issue: 'Audit trail gaps in system access logs',
          severity: 'low' as const,
          status: 'open' as const,
          dueDate: new Date('2024-03-01'),
          assignedTo: 'IT Security',
          category: 'Data Security',
        },
      ],

      // Audit Trail Activities
      auditTrailActivities: [
        {
          timestamp: new Date('2024-01-15T10:30:00'),
          user: 'Dr. Michael Chen',
          activity: 'Patient record accessed',
          status: 'compliant' as const,
          details: 'Routine medication review',
        },
        {
          timestamp: new Date('2024-01-15T11:15:00'),
          user: 'Sarah Wilson, PharmD',
          activity: 'Medication list updated',
          status: 'compliant' as const,
          details: 'Added new prescription',
        },
        {
          timestamp: new Date('2024-01-15T14:22:00'),
          user: 'System Admin',
          activity: 'Compliance report generated',
          status: 'compliant' as const,
          details: 'Monthly regulatory report',
        },
        {
          timestamp: new Date('2024-01-15T16:45:00'),
          user: 'Dr. Lisa Park',
          activity: 'Patient consultation documented',
          status: 'pending' as const,
          details: 'Awaiting supervisor review',
        },
      ],
    }),
    []
  );

  // Simulate data loading
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [filters]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getSeverityColor = (
    severity: 'low' | 'medium' | 'high' | 'critical'
  ) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (
    status: 'open' | 'in-progress' | 'resolved' | 'compliant' | 'pending'
  ) => {
    switch (status) {
      case 'resolved':
      case 'compliant':
        return 'success';
      case 'in-progress':
        return 'info';
      case 'pending':
        return 'warning';
      case 'open':
        return 'error';
      default:
        return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Regulatory Compliance Data
        </Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Security sx={{ mr: 2, color: 'primary.main' }} />
          Regulatory Compliance Reports
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive compliance monitoring with audit trails, issue tracking,
          and regulatory reporting capabilities with predictive analytics.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {mockData.kpiData.map((kpi, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <ChartComponent
              data={{
                id: `kpi-${index}`,
                title: '',
                type: 'kpi-card',
                data: [kpi],
                config: {} as any,
              }}
              height={180}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>

      {/* Tabs for different views */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<Assessment />}
            label="Compliance Metrics"
            iconPosition="start"
          />
          <Tab icon={<Timeline />} label="Audit Trail" iconPosition="start" />
          <Tab
            icon={<Warning />}
            label="Issues Tracking"
            iconPosition="start"
          />
          <Tab
            icon={<TrendingUp />}
            label="Compliance Trends"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Compliance Metrics Overview
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography
                          variant="h4"
                          color="success.main"
                          gutterBottom
                        >
                          94.7%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Overall Compliance
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="info.main" gutterBottom>
                          96.8%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Documentation
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography
                          variant="h4"
                          color="primary.main"
                          gutterBottom
                        >
                          98.5%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Audit Trail
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography
                          variant="h4"
                          color="warning.main"
                          gutterBottom
                        >
                          12
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Open Issues
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Audit Trail Activities
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>User</TableCell>
                          <TableCell>Activity</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Details</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mockData.auditTrailActivities.map(
                          (activity, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {activity.timestamp.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center' }}
                                >
                                  <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                                    <Person />
                                  </Avatar>
                                  {activity.user}
                                </Box>
                              </TableCell>
                              <TableCell>{activity.activity}</TableCell>
                              <TableCell>
                                <Chip
                                  label={activity.status}
                                  color={getStatusColor(activity.status) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{activity.details}</TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Compliance Issues Tracking
                  </Typography>
                  <List>
                    {mockData.complianceIssues.map((issue, index) => (
                      <React.Fragment key={issue.id}>
                        <ListItem>
                          <ListItemIcon>
                            <Chip
                              label={issue.severity}
                              color={getSeverityColor(issue.severity) as any}
                              size="small"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Typography
                                  variant="body1"
                                  sx={{ fontWeight: 500 }}
                                >
                                  {issue.issue}
                                </Typography>
                                <Chip
                                  label={issue.status}
                                  color={getStatusColor(issue.status) as any}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  ID: {issue.id} | Category: {issue.category} |
                                  Assigned to: {issue.assignedTo} | Due:{' '}
                                  {issue.dueDate.toLocaleDateString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < mockData.complianceIssues.length - 1 && (
                          <Divider />
                        )}
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Compliance Trend Analysis
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="success.main"
                          gutterBottom
                        >
                          +3.9%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Overall Improvement
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h3" color="info.main" gutterBottom>
                          95.3%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Predicted Next Month
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="primary.main"
                          gutterBottom
                        >
                          98.1%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Audit Trail Score
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Compliance trends show consistent improvement across all
                    categories. Predictive analytics indicate continued positive
                    trajectory with documentation and regulatory reporting
                    showing the most significant gains.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default RegulatoryComplianceReport;
