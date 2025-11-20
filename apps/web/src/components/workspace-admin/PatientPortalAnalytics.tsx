/**
 * PatientPortalAnalytics Component
 * Analytics dashboard for patient portal usage and engagement
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import MessageIcon from '@mui/icons-material/Message';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { usePatientPortalAdmin } from '../../hooks/usePatientPortalAdmin';

// Tab panel component
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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Metric card component
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  color = '#0088FE',
  loading = false,
}) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={80} height={32} />
            ) : (
              <Typography variant="h4" component="div">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </Typography>
            )}
            {change !== undefined && !loading && (
              <Typography
                variant="caption"
                color={change >= 0 ? 'success.main' : 'error.main'}
                sx={{ display: 'flex', alignItems: 'center', mt: 1 }}
              >
                <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                {change >= 0 ? '+' : ''}{change}% from last month
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

interface PatientPortalAnalyticsProps {
  workspaceId?: string; // Optional workspace ID for super admin override
}

const PatientPortalAnalytics: React.FC<PatientPortalAnalyticsProps> = ({ workspaceId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch analytics data
  const {
    data: analytics,
    isLoading,
    error,
  } = usePatientPortalAdmin(workspaceId).usePortalAnalytics({ timeRange });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load analytics data
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Time Range Selector */}
      <Box 
        sx={{ 
          mb: 4, 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" fontWeight={600} gutterBottom>
            Portal Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive insights into patient portal usage and performance
          </Typography>
        </Box>
        <FormControl 
          size="small" 
          sx={{ 
            minWidth: { xs: '100%', sm: 200 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            }
          }}
        >
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={handleTimeRangeChange}
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
            <MenuItem value="1y">Last year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Users"
            value={analytics?.metrics?.activeUsers || 0}
            change={analytics?.metrics?.activeUsersChange}
            icon={<PeopleIcon />}
            color="#0088FE"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Sessions"
            value={analytics?.metrics?.totalSessions || 0}
            change={analytics?.metrics?.totalSessionsChange}
            icon={<TrendingUpIcon />}
            color="#00C49F"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Messages Sent"
            value={analytics?.metrics?.messagesSent || 0}
            change={analytics?.metrics?.messagesSentChange}
            icon={<MessageIcon />}
            color="#FFBB28"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Refill Requests"
            value={analytics?.metrics?.refillRequests || 0}
            change={analytics?.metrics?.refillRequestsChange}
            icon={<LocalPharmacyIcon />}
            color="#FF8042"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Paper 
        sx={{ 
          mb: 3,
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="analytics tabs"
          sx={{
            '& .MuiTab-root': {
              minHeight: 64,
              fontSize: { xs: '0.875rem', sm: '0.9375rem' },
              fontWeight: 500,
              textTransform: 'none',
              px: { xs: 2, sm: 3 },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab label="Usage Trends" />
          <Tab label="User Engagement" />
          <Tab label="Feature Usage" />
          <Tab label="Performance" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        {/* Usage Trends - Redesigned for full width and responsiveness */}
        <Grid container spacing={3}>
          {/* Daily Active Users - Full Width Chart */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Daily Active Users
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track user engagement trends over time
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={analytics?.charts?.dailyActiveUsers || []}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#0088FE" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                    />
                    <Area
                      type="monotone"
                      dataKey="users"
                      stroke="#0088FE"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorUsers)"
                      dot={{ fill: '#0088FE', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* User Status Distribution - Responsive Layout */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  User Status Distribution
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Breakdown of user account statuses
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="circular" height={300} sx={{ mx: 'auto' }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.charts?.userStatusDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius="80%"
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(analytics?.charts?.userStatusDistribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Session Growth - New Chart */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Weekly Sessions Growth
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total sessions per week
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.charts?.dailyActiveUsers || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#666" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#666" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Bar 
                      dataKey="users" 
                      fill="#00C49F" 
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* User Engagement - Redesigned for full width and responsiveness */}
        <Grid container spacing={3}>
          {/* Session Duration Trends - Full Width */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Session Duration Trends
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average time users spend in the portal per session
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={analytics?.charts?.sessionDuration || []}>
                    <defs>
                      <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                    />
                    <Area
                      type="monotone"
                      dataKey="avgDuration"
                      name="Avg Duration (min)"
                      stroke="#00C49F"
                      strokeWidth={3}
                      fill="url(#colorDuration)"
                      fillOpacity={1}
                      dot={{ fill: '#00C49F', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Page Views by Section - Responsive Layout */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Page Views by Section
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Most visited sections in the patient portal
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart 
                    data={analytics?.charts?.pageViews || []}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#666" />
                    <YAxis 
                      type="category" 
                      dataKey="page" 
                      tick={{ fontSize: 12 }} 
                      stroke="#666"
                      width={120}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Bar 
                      dataKey="views" 
                      fill="#FFBB28"
                      radius={[0, 8, 8, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Engagement Rate Over Time - New Chart */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Daily Engagement Rate
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Percentage of active users engaging daily
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={analytics?.charts?.sessionDuration || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="avgDuration"
                      name="Engagement Rate"
                      stroke="#8884D8"
                      strokeWidth={3}
                      dot={{ fill: '#8884D8', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {/* Feature Usage - Redesigned for full width and responsiveness */}
        <Grid container spacing={3}>
          {/* Feature Usage Over Time - Full Width */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Feature Usage Over Time
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track how patients use different features in the portal
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={analytics?.charts?.featureUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Usage Count', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="appointments" 
                      name="Appointments"
                      stroke="#0088FE" 
                      strokeWidth={3}
                      dot={{ fill: '#0088FE', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="messages" 
                      name="Messages"
                      stroke="#00C49F" 
                      strokeWidth={3}
                      dot={{ fill: '#00C49F', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="refills" 
                      name="Refill Requests"
                      stroke="#FFBB28" 
                      strokeWidth={3}
                      dot={{ fill: '#FFBB28', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="healthRecords" 
                      name="Health Records"
                      stroke="#FF8042" 
                      strokeWidth={3}
                      dot={{ fill: '#FF8042', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Most Used Features - Pie Chart */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Most Used Features
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Distribution of feature usage across the portal
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="circular" height={350} sx={{ mx: 'auto' }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={analytics?.charts?.featurePopularity || []}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius="75%"
                      fill="#8884d8"
                      dataKey="usage"
                    >
                      {(analytics?.charts?.featurePopularity || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Feature Comparison - Bar Chart */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Feature Comparison
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Compare usage across different features
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={analytics?.charts?.featurePopularity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11 }}
                      stroke="#666"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Usage Count', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Bar 
                      dataKey="usage" 
                      fill="#8884D8"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    >
                      {(analytics?.charts?.featurePopularity || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {/* Performance - Redesigned for full width and responsiveness */}
        <Grid container spacing={3}>
          {/* Response Times - Full Width */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Response Times
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average response time for portal operations over time
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={analytics?.charts?.responseTime || []}>
                    <defs>
                      <linearGradient id="colorResponseTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884D8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884D8" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                    />
                    <Area
                      type="monotone"
                      dataKey="avgResponseTime"
                      name="Avg Response Time (ms)"
                      stroke="#8884D8"
                      strokeWidth={3}
                      fill="url(#colorResponseTime)"
                      fillOpacity={1}
                      dot={{ fill: '#8884D8', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Error Rates by Endpoint - Responsive Layout */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Error Rates by Endpoint
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Percentage of failed requests per endpoint
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart 
                    data={analytics?.charts?.errorRates || []}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: 12 }} 
                      stroke="#666"
                      label={{ value: 'Error Rate (%)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="endpoint" 
                      tick={{ fontSize: 11 }} 
                      stroke="#666"
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Bar 
                      dataKey="errorRate" 
                      name="Error Rate"
                      fill="#FF8042"
                      radius={[0, 8, 8, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* System Uptime & Reliability */}
          <Grid item xs={12} md={6}>
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3, md: 4 },
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  System Performance Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall system health and performance indicators
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={analytics?.charts?.responseTime || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#666"
                      label={{ value: 'Performance Score', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                      }}
                    />
                    <Legend iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="avgResponseTime"
                      name="Performance Score"
                      stroke="#00C49F"
                      strokeWidth={3}
                      dot={{ fill: '#00C49F', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default PatientPortalAnalytics;