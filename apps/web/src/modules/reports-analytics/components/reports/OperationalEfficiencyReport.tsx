// Operational Efficiency Report Module Component
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
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Speed,
  TrendingUp,
  TrendingDown,
  Assessment,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
  Warning,
  CheckCircle,
  Schedule,
  Build,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData } from '../../types/charts';
import { OperationalEfficiencyFilters } from '../../types/filters';
import { useCurrentFilters } from '../../stores/filtersStore';
import { ReportType } from '../../types/reports';

interface OperationalEfficiencyReportProps {
  filters: OperationalEfficiencyFilters;
  onFilterChange?: (filters: OperationalEfficiencyFilters) => void;
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

const OperationalEfficiencyReport: React.FC<
  OperationalEfficiencyReportProps
> = ({ filters, onFilterChange }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data - in real implementation, this would come from API
  const mockData = useMemo(
    () => ({
      // KPI Cards Data
      kpiData: [
        {
          title: 'Overall Efficiency Score',
          value: 87.3,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 5.2,
            period: 'vs last month',
          },
          status: 'success' as const,
          target: { value: 85, label: '%' },
        },
        {
          title: 'Average Processing Time',
          value: 12.4,
          unit: 'minutes',
          trend: {
            direction: 'down' as const,
            value: 8.7,
            period: 'improvement',
          },
          status: 'success' as const,
        },
        {
          title: 'Resource Utilization',
          value: 78.9,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 3.1,
            period: 'vs target',
          },
          status: 'info' as const,
        },
        {
          title: 'Active Bottlenecks',
          value: 3,
          unit: 'processes',
          trend: {
            direction: 'down' as const,
            value: 40.0,
            period: 'reduction',
          },
          status: 'warning' as const,
        },
      ],

      // Workflow Metrics Data
      workflowMetricsData: {
        id: 'workflow-metrics',
        title: 'Workflow Metrics & Bottleneck Analysis',
        subtitle:
          'Processing times and bottleneck identification across key workflows',
        type: 'bar' as const,
        data: [
          {
            process: 'Patient Registration',
            'Average Time': 8.2,
            'Target Time': 10.0,
            'Bottleneck Score': 2.1,
            Efficiency: 85.3,
          },
          {
            process: 'Medication Review',
            'Average Time': 15.7,
            'Target Time': 12.0,
            'Bottleneck Score': 7.8,
            Efficiency: 76.4,
          },
          {
            process: 'Prescription Processing',
            'Average Time': 6.4,
            'Target Time': 8.0,
            'Bottleneck Score': 1.2,
            Efficiency: 92.1,
          },
          {
            process: 'Patient Consultation',
            'Average Time': 18.9,
            'Target Time': 20.0,
            'Bottleneck Score': 3.4,
            Efficiency: 89.7,
          },
          {
            process: 'Documentation',
            'Average Time': 11.3,
            'Target Time': 15.0,
            'Bottleneck Score': 2.8,
            Efficiency: 88.2,
          },
          {
            process: 'Quality Check',
            'Average Time': 9.1,
            'Target Time': 10.0,
            'Bottleneck Score': 4.5,
            Efficiency: 82.6,
          },
        ],
        config: {
          title: {
            text: 'Workflow Metrics & Bottleneck Analysis',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'process',
              type: 'category' as const,
              grid: false,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 11,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
            y: {
              label: 'minutes',
              type: 'number' as const,
              grid: true,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 12,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
          },
          series: [
            {
              name: 'Average Time',
              type: 'bar' as const,
              dataKey: 'Average Time',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 500,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Target Time',
              type: 'bar' as const,
              dataKey: 'Target Time',
              style: { color: '#10b981', fillOpacity: 0.6 },
              animations: {
                enabled: true,
                duration: 500,
                delay: 100,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: true,
            position: 'top' as const,
            alignment: 'center' as const,
            style: { fontSize: 12, fontWeight: 'normal', color: '#374151' },
          },
          tooltip: {
            enabled: true,
            shared: false,
            style: {
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: 12,
              color: '#374151',
              padding: 12,
            },
          },
          annotations: [],
          interactions: {
            hover: true,
            click: true,
            zoom: false,
            pan: false,
            brush: false,
            crossfilter: true,
          },
          theme: {
            name: 'corporate-light',
            colorPalette: ['#3b82f6', '#10b981'],
            gradients: [],
            typography: {
              fontFamily: 'Inter, sans-serif',
              fontSize: { small: 11, medium: 13, large: 16, xlarge: 20 },
              fontWeight: { light: 300, normal: 400, medium: 500, bold: 600 },
            },
            spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
            borderRadius: 8,
            shadows: {
              small: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              large: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
            mode: 'light' as const,
          },
          animations: {
            duration: 500,
            easing: 'ease-out' as const,
            stagger: true,
            entrance: 'slide' as const,
          },
          responsive: {
            breakpoints: { xs: 480, sm: 768, md: 1024, lg: 1280, xl: 1920 },
            rules: [],
          },
        },
      },

      // Resource Utilization Data
      resourceUtilizationData: {
        id: 'resource-utilization',
        title: 'Resource Utilization with Capacity Planning',
        subtitle: 'Current utilization vs capacity across different resources',
        type: 'gauge' as const,
        data: [
          {
            title: 'Staff Utilization',
            value: 78.9,
            min: 0,
            max: 100,
            unit: '%',
            target: 80,
            ranges: [
              { min: 0, max: 60, color: '#ef4444', label: 'Under-utilized' },
              { min: 60, max: 85, color: '#22c55e', label: 'Optimal' },
              { min: 85, max: 100, color: '#f59e0b', label: 'Over-utilized' },
            ],
          },
        ],
        config: {} as any,
      },

      // Performance Benchmarks
      performanceBenchmarksData: {
        id: 'performance-benchmarks',
        title: 'Performance Benchmarks Comparison',
        subtitle: 'Current performance vs targets and industry benchmarks',
        type: 'radar' as const,
        data: [
          {
            metric: 'Processing Speed',
            current: 87,
            target: 85,
            benchmark: 82,
          },
          {
            metric: 'Quality Score',
            current: 92,
            target: 90,
            benchmark: 88,
          },
          {
            metric: 'Customer Satisfaction',
            current: 89,
            target: 88,
            benchmark: 85,
          },
          {
            metric: 'Cost Efficiency',
            current: 84,
            target: 86,
            benchmark: 80,
          },
          {
            metric: 'Resource Utilization',
            current: 79,
            target: 80,
            benchmark: 75,
          },
          {
            metric: 'Error Rate',
            current: 95, // Inverted - higher is better (less errors)
            target: 94,
            benchmark: 90,
          },
        ],
        config: {
          title: {
            text: 'Performance Benchmarks Radar Chart',
            alignment: 'center' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'metric',
              type: 'category' as const,
              grid: true,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 12,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
            y: {
              label: 'score',
              type: 'number' as const,
              grid: true,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 12,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
          },
          series: [
            {
              name: 'Current Performance',
              type: 'radar' as const,
              dataKey: 'current',
              style: { color: '#3b82f6', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 800,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Target',
              type: 'radar' as const,
              dataKey: 'target',
              style: { color: '#10b981', fillOpacity: 0.2 },
              animations: {
                enabled: true,
                duration: 800,
                delay: 200,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Industry Benchmark',
              type: 'radar' as const,
              dataKey: 'benchmark',
              style: { color: '#f59e0b', fillOpacity: 0.2 },
              animations: {
                enabled: true,
                duration: 800,
                delay: 400,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: true,
            position: 'bottom' as const,
            alignment: 'center' as const,
            style: { fontSize: 12, fontWeight: 'normal', color: '#374151' },
          },
          tooltip: {
            enabled: true,
            shared: false,
            style: {
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: 12,
              color: '#374151',
              padding: 12,
            },
          },
          annotations: [],
          interactions: {
            hover: true,
            click: true,
            zoom: false,
            pan: false,
            brush: false,
            crossfilter: false,
          },
          theme: {
            name: 'corporate-light',
            colorPalette: ['#3b82f6', '#10b981', '#f59e0b'],
            gradients: [],
            typography: {
              fontFamily: 'Inter, sans-serif',
              fontSize: { small: 11, medium: 13, large: 16, xlarge: 20 },
              fontWeight: { light: 300, normal: 400, medium: 500, bold: 600 },
            },
            spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
            borderRadius: 8,
            shadows: {
              small: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              large: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
            mode: 'light' as const,
          },
          animations: {
            duration: 800,
            easing: 'ease-out' as const,
            stagger: true,
            entrance: 'scale' as const,
          },
          responsive: {
            breakpoints: { xs: 480, sm: 768, md: 1024, lg: 1280, xl: 1920 },
            rules: [],
          },
        },
      },

      // Real-time Efficiency Monitoring
      realTimeEfficiencyData: {
        id: 'real-time-efficiency',
        title: 'Real-time Efficiency Monitoring',
        subtitle: 'Live updating dashboard with current operational metrics',
        type: 'line' as const,
        data: [
          {
            time: '09:00',
            'Efficiency Score': 82.1,
            Throughput: 45,
            'Queue Length': 12,
            'Response Time': 8.2,
          },
          {
            time: '10:00',
            'Efficiency Score': 85.3,
            Throughput: 52,
            'Queue Length': 8,
            'Response Time': 7.1,
          },
          {
            time: '11:00',
            'Efficiency Score': 87.9,
            Throughput: 58,
            'Queue Length': 6,
            'Response Time': 6.8,
          },
          {
            time: '12:00',
            'Efficiency Score': 84.2,
            Throughput: 48,
            'Queue Length': 14,
            'Response Time': 9.3,
          },
          {
            time: '13:00',
            'Efficiency Score': 89.1,
            Throughput: 61,
            'Queue Length': 4,
            'Response Time': 5.9,
          },
          {
            time: '14:00',
            'Efficiency Score': 91.4,
            Throughput: 67,
            'Queue Length': 3,
            'Response Time': 5.2,
          },
        ],
        config: {
          title: {
            text: 'Real-time Efficiency Monitoring Dashboard',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'time',
              type: 'category' as const,
              grid: true,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 12,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
            y: {
              label: 'value',
              type: 'number' as const,
              grid: true,
              style: {
                lineColor: '#e5e7eb',
                tickColor: '#6b7280',
                labelStyle: {
                  fontSize: 12,
                  fontWeight: 'normal',
                  color: '#6b7280',
                },
                gridStyle: {
                  strokeDasharray: '3 3',
                  opacity: 0.5,
                  color: '#e5e7eb',
                },
              },
            },
          },
          series: [
            {
              name: 'Efficiency Score',
              type: 'line' as const,
              dataKey: 'Efficiency Score',
              style: { color: '#3b82f6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Throughput',
              type: 'line' as const,
              dataKey: 'Throughput',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
          ],
          legend: {
            enabled: true,
            position: 'top' as const,
            alignment: 'center' as const,
            style: { fontSize: 12, fontWeight: 'normal', color: '#374151' },
          },
          tooltip: {
            enabled: true,
            shared: true,
            style: {
              backgroundColor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: 12,
              color: '#374151',
              padding: 12,
            },
          },
          annotations: [],
          interactions: {
            hover: true,
            click: true,
            zoom: true,
            pan: true,
            brush: false,
            crossfilter: false,
          },
          theme: {
            name: 'corporate-light',
            colorPalette: ['#3b82f6', '#10b981'],
            gradients: [],
            typography: {
              fontFamily: 'Inter, sans-serif',
              fontSize: { small: 11, medium: 13, large: 16, xlarge: 20 },
              fontWeight: { light: 300, normal: 400, medium: 500, bold: 600 },
            },
            spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
            borderRadius: 8,
            shadows: {
              small: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              large: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
            mode: 'light' as const,
          },
          animations: {
            duration: 300,
            easing: 'ease-in-out' as const,
            stagger: true,
            entrance: 'fade' as const,
          },
          responsive: {
            breakpoints: { xs: 480, sm: 768, md: 1024, lg: 1280, xl: 1920 },
            rules: [],
          },
        },
      },

      // Process Improvement Recommendations
      processImprovements: [
        {
          process: 'Medication Review',
          currentTime: 15.7,
          targetTime: 12.0,
          recommendation:
            'Implement automated pre-screening to reduce review time',
          impact: 'high' as const,
          effort: 'medium' as const,
          estimatedSavings: '23.6%',
        },
        {
          process: 'Quality Check',
          currentTime: 9.1,
          targetTime: 10.0,
          recommendation: 'Optimize checklist order based on failure patterns',
          impact: 'medium' as const,
          effort: 'low' as const,
          estimatedSavings: '12.3%',
        },
        {
          process: 'Patient Consultation',
          currentTime: 18.9,
          targetTime: 20.0,
          recommendation:
            'Provide pre-consultation patient information summary',
          impact: 'medium' as const,
          effort: 'medium' as const,
          estimatedSavings: '8.7%',
        },
      ],

      // Resource Utilization Details
      resourceDetails: [
        {
          resource: 'Pharmacists',
          utilization: 82.4,
          capacity: 100,
          efficiency: 89.2,
          status: 'optimal' as const,
        },
        {
          resource: 'Pharmacy Technicians',
          utilization: 76.8,
          capacity: 100,
          efficiency: 85.7,
          status: 'under-utilized' as const,
        },
        {
          resource: 'Consultation Rooms',
          utilization: 91.3,
          capacity: 100,
          efficiency: 78.9,
          status: 'over-utilized' as const,
        },
        {
          resource: 'Equipment',
          utilization: 68.5,
          capacity: 100,
          efficiency: 92.1,
          status: 'under-utilized' as const,
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

  const getImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (
    status: 'optimal' | 'under-utilized' | 'over-utilized'
  ) => {
    switch (status) {
      case 'optimal':
        return 'success';
      case 'under-utilized':
        return 'info';
      case 'over-utilized':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Operational Efficiency Data
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
          <Speed sx={{ mr: 2, color: 'primary.main' }} />
          Operational Efficiency Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of workflow metrics, resource utilization,
          performance benchmarks, and real-time efficiency monitoring with
          actionable improvement recommendations.
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
            icon={<BarChart />}
            label="Workflow Metrics"
            iconPosition="start"
          />
          <Tab
            icon={<PieChart />}
            label="Resource Utilization"
            iconPosition="start"
          />
          <Tab
            icon={<Assessment />}
            label="Performance Benchmarks"
            iconPosition="start"
          />
          <Tab
            icon={<ShowChart />}
            label="Real-time Monitoring"
            iconPosition="start"
          />
          <Tab
            icon={<Build />}
            label="Improvement Recommendations"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.workflowMetricsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Workflow Analysis Insights
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Prescription Processing: Above Target"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Medication Review: Bottleneck Detected"
                      color="warning"
                      size="small"
                    />
                    <Chip
                      label="Patient Registration: Optimal"
                      color="success"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Medication review process shows the highest bottleneck score
                    and exceeds target time. Consider implementing automated
                    pre-screening to improve efficiency. Prescription processing
                    is performing well above targets.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <ChartComponent
                data={mockData.resourceUtilizationData}
                height={350}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 350 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Resource Utilization Details
                  </Typography>
                  <List dense>
                    {mockData.resourceDetails.map((resource, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <Chip
                              label={resource.status}
                              color={getStatusColor(resource.status) as any}
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
                                  {resource.resource}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="primary.main"
                                >
                                  {resource.utilization}%
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={resource.utilization}
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    mb: 1,
                                    backgroundColor: 'grey.200',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor:
                                        resource.status === 'optimal'
                                          ? '#22c55e'
                                          : resource.status === 'over-utilized'
                                          ? '#f59e0b'
                                          : '#3b82f6',
                                      borderRadius: 3,
                                    },
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Efficiency: {resource.efficiency}% | Capacity:{' '}
                                  {resource.capacity}%
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < mockData.resourceDetails.length - 1 && (
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

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.performanceBenchmarksData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Analysis Summary
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="success.main"
                          gutterBottom
                        >
                          5/6
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Metrics Above Target
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h3" color="info.main" gutterBottom>
                          87.2%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Average Performance
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
                          +7.1%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          vs Industry Benchmark
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Performance is strong across most metrics, with quality
                    score and customer satisfaction exceeding both targets and
                    industry benchmarks. Cost efficiency shows room for
                    improvement but remains competitive with industry standards.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.realTimeEfficiencyData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Real-time Performance Indicators
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'success.light',
                          color: 'success.contrastText',
                        }}
                      >
                        <Typography variant="h4" gutterBottom>
                          91.4%
                        </Typography>
                        <Typography variant="body2">
                          Current Efficiency
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'info.light',
                          color: 'info.contrastText',
                        }}
                      >
                        <Typography variant="h4" gutterBottom>
                          67
                        </Typography>
                        <Typography variant="body2">Throughput/Hour</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'warning.light',
                          color: 'warning.contrastText',
                        }}
                      >
                        <Typography variant="h4" gutterBottom>
                          3
                        </Typography>
                        <Typography variant="body2">Queue Length</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'primary.light',
                          color: 'primary.contrastText',
                        }}
                      >
                        <Typography variant="h4" gutterBottom>
                          5.2m
                        </Typography>
                        <Typography variant="body2">
                          Avg Response Time
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Process Improvement Recommendations
                  </Typography>
                  <List>
                    {mockData.processImprovements.map((improvement, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <Chip
                              label={`${improvement.impact} impact`}
                              color={getImpactColor(improvement.impact) as any}
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
                                  {improvement.process}
                                </Typography>
                                <Chip
                                  label={`${improvement.estimatedSavings} savings`}
                                  color="success"
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" gutterBottom>
                                  {improvement.recommendation}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Current: {improvement.currentTime}min |
                                  Target: {improvement.targetTime}min | Effort:{' '}
                                  {improvement.effort}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < mockData.processImprovements.length - 1 && (
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
      </Card>
    </Box>
  );
};

export default OperationalEfficiencyReport;
