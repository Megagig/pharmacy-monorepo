// Pharmacist Intervention Tracking Report Component
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
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Rating,
} from '@mui/material';
import {
  Person,
  TrendingUp,
  Assessment,
  Timeline,
  Star,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData, KPICardData } from '../../types/charts';
import { PharmacistInterventionFilters } from '../../types/filters';

interface PharmacistInterventionReportProps {
  filters: PharmacistInterventionFilters;
  onFilterChange?: (filters: PharmacistInterventionFilters) => void;
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

const PharmacistInterventionReport: React.FC<
  PharmacistInterventionReportProps
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
          title: 'Total Interventions',
          value: 1247,
          unit: '',
          trend: {
            direction: 'up' as const,
            value: 18.5,
            period: 'vs last month',
          },
          status: 'success' as const,
          sparkline: [
            { name: 'Week 1', value: 280 },
            { name: 'Week 2', value: 310 },
            { name: 'Week 3', value: 325 },
            { name: 'Week 4', value: 332 },
          ],
        },
        {
          title: 'Acceptance Rate',
          value: 89.3,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 4.2,
            period: 'vs last month',
          },
          status: 'success' as const,
          target: { value: 85, label: 'Target' },
        },
        {
          title: 'Average Response Time',
          value: 2.4,
          unit: 'hours',
          trend: {
            direction: 'down' as const,
            value: 12.8,
            period: 'improvement',
          },
          status: 'success' as const,
        },
        {
          title: 'Quality Score',
          value: 4.7,
          unit: '/5.0',
          trend: {
            direction: 'up' as const,
            value: 6.1,
            period: 'vs last quarter',
          },
          status: 'info' as const,
        },
      ],

      // Intervention Metrics Over Time
      interventionMetricsData: {
        id: 'intervention-metrics',
        title: 'Intervention Metrics Over Time',
        subtitle: 'Monthly intervention volume and acceptance rates',
        type: 'line' as const,
        data: [
          {
            month: 'Jan',
            interventions: 980,
            acceptanceRate: 85.2,
            responseTime: 3.1,
          },
          {
            month: 'Feb',
            interventions: 1050,
            acceptanceRate: 86.8,
            responseTime: 2.9,
          },
          {
            month: 'Mar',
            interventions: 1120,
            acceptanceRate: 87.5,
            responseTime: 2.7,
          },
          {
            month: 'Apr',
            interventions: 1180,
            acceptanceRate: 88.1,
            responseTime: 2.6,
          },
          {
            month: 'May',
            interventions: 1220,
            acceptanceRate: 88.9,
            responseTime: 2.5,
          },
          {
            month: 'Jun',
            interventions: 1247,
            acceptanceRate: 89.3,
            responseTime: 2.4,
          },
        ],
        config: {
          title: {
            text: 'Intervention Metrics Over Time',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'month',
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
              label: 'interventions',
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
            y2: {
              label: 'acceptanceRate',
              type: 'number' as const,
              grid: false,
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
              name: 'Interventions',
              type: 'line' as const,
              dataKey: 'interventions',
              style: { color: '#3b82f6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
              yAxisId: 'left',
            },
            {
              name: 'Acceptance Rate (%)',
              type: 'line' as const,
              dataKey: 'acceptanceRate',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
              yAxisId: 'right',
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

      // Intervention Types Effectiveness
      interventionTypesData: {
        id: 'intervention-types',
        title: 'Intervention Types Effectiveness',
        subtitle: 'Success rates by intervention category',
        type: 'bar' as const,
        data: [
          {
            type: 'Medication Review',
            count: 342,
            successRate: 92.1,
            avgTime: 1.8,
          },
          {
            type: 'Drug Interaction Alert',
            count: 289,
            successRate: 95.5,
            avgTime: 0.5,
          },
          {
            type: 'Dosage Adjustment',
            count: 234,
            successRate: 88.7,
            avgTime: 2.1,
          },
          {
            type: 'Alternative Therapy',
            count: 198,
            successRate: 85.3,
            avgTime: 3.2,
          },
          {
            type: 'Patient Education',
            count: 184,
            successRate: 91.8,
            avgTime: 2.8,
          },
        ],
        config: {
          title: {
            text: 'Intervention Types Effectiveness',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'type',
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
              label: 'count',
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
              name: 'Intervention Count',
              type: 'bar' as const,
              dataKey: 'count',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 500,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: false,
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
            colorPalette: ['#3b82f6'],
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

      // Time-based Analysis
      timeAnalysisData: {
        id: 'time-analysis',
        title: 'Intervention Timeline Analysis',
        subtitle: 'Response times and resolution patterns throughout the day',
        type: 'area' as const,
        data: [
          { hour: '6 AM', interventions: 12, avgResponseTime: 1.2 },
          { hour: '8 AM', interventions: 45, avgResponseTime: 1.8 },
          { hour: '10 AM', interventions: 78, avgResponseTime: 2.1 },
          { hour: '12 PM', interventions: 95, avgResponseTime: 2.8 },
          { hour: '2 PM', interventions: 89, avgResponseTime: 2.5 },
          { hour: '4 PM', interventions: 67, avgResponseTime: 2.2 },
          { hour: '6 PM', interventions: 34, avgResponseTime: 1.9 },
          { hour: '8 PM', interventions: 18, avgResponseTime: 1.5 },
        ],
        config: {
          title: {
            text: 'Intervention Timeline Analysis',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'hour',
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
              label: 'interventions',
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
              name: 'Interventions',
              type: 'area' as const,
              dataKey: 'interventions',
              style: { color: '#8b5cf6', fillOpacity: 0.3, strokeWidth: 2 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: false,
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
            zoom: true,
            pan: true,
            brush: false,
            crossfilter: false,
          },
          theme: {
            name: 'corporate-light',
            colorPalette: ['#8b5cf6'],
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
            duration: 600,
            easing: 'ease-out' as const,
            stagger: true,
            entrance: 'fade' as const,
          },
          responsive: {
            breakpoints: { xs: 480, sm: 768, md: 1024, lg: 1280, xl: 1920 },
            rules: [],
          },
        },
      },

      // Top Performing Pharmacists
      topPharmacists: [
        {
          id: 1,
          name: 'Dr. Sarah Johnson',
          interventions: 156,
          acceptanceRate: 94.2,
          avgResponseTime: 1.8,
          qualityScore: 4.9,
          specialties: ['Cardiology', 'Diabetes'],
        },
        {
          id: 2,
          name: 'Dr. Michael Chen',
          interventions: 142,
          acceptanceRate: 91.8,
          avgResponseTime: 2.1,
          qualityScore: 4.7,
          specialties: ['Oncology', 'Pain Management'],
        },
        {
          id: 3,
          name: 'Dr. Emily Rodriguez',
          interventions: 138,
          acceptanceRate: 93.5,
          avgResponseTime: 1.9,
          qualityScore: 4.8,
          specialties: ['Pediatrics', 'Immunology'],
        },
        {
          id: 4,
          name: 'Dr. James Wilson',
          interventions: 134,
          acceptanceRate: 89.7,
          avgResponseTime: 2.3,
          qualityScore: 4.6,
          specialties: ['Psychiatry', 'Neurology'],
        },
        {
          id: 5,
          name: 'Dr. Lisa Thompson',
          interventions: 129,
          acceptanceRate: 92.1,
          avgResponseTime: 2.0,
          qualityScore: 4.7,
          specialties: ['Geriatrics', 'Endocrinology'],
        },
      ],

      // Performance Comparison
      performanceComparisonData: {
        id: 'performance-comparison',
        title: 'Pharmacist Performance Comparison',
        subtitle: 'Quality scores and intervention metrics by pharmacist',
        type: 'scatter' as const,
        data: [
          {
            pharmacist: 'Dr. Sarah Johnson',
            interventions: 156,
            qualityScore: 4.9,
            acceptanceRate: 94.2,
          },
          {
            pharmacist: 'Dr. Michael Chen',
            interventions: 142,
            qualityScore: 4.7,
            acceptanceRate: 91.8,
          },
          {
            pharmacist: 'Dr. Emily Rodriguez',
            interventions: 138,
            qualityScore: 4.8,
            acceptanceRate: 93.5,
          },
          {
            pharmacist: 'Dr. James Wilson',
            interventions: 134,
            qualityScore: 4.6,
            acceptanceRate: 89.7,
          },
          {
            pharmacist: 'Dr. Lisa Thompson',
            interventions: 129,
            qualityScore: 4.7,
            acceptanceRate: 92.1,
          },
          {
            pharmacist: 'Dr. Robert Davis',
            interventions: 125,
            qualityScore: 4.5,
            acceptanceRate: 88.9,
          },
          {
            pharmacist: 'Dr. Maria Garcia',
            interventions: 121,
            qualityScore: 4.6,
            acceptanceRate: 90.3,
          },
          {
            pharmacist: 'Dr. David Lee',
            interventions: 118,
            qualityScore: 4.4,
            acceptanceRate: 87.5,
          },
        ],
        config: {
          title: {
            text: 'Pharmacist Performance Comparison',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'interventions',
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
            y: {
              label: 'qualityScore',
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
              name: 'Pharmacists',
              type: 'scatter' as const,
              dataKey: 'qualityScore',
              style: { color: '#f59e0b' },
              animations: {
                enabled: true,
                duration: 800,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: false,
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
            zoom: true,
            pan: true,
            brush: false,
            crossfilter: false,
          },
          theme: {
            name: 'corporate-light',
            colorPalette: ['#f59e0b'],
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

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Pharmacist Intervention Data
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
          <Person sx={{ mr: 2, color: 'primary.main' }} />
          Pharmacist Intervention Tracking
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of pharmacist interventions, acceptance rates,
          and performance metrics.
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
            icon={<TrendingUp />}
            label="Intervention Metrics"
            iconPosition="start"
          />
          <Tab
            icon={<Assessment />}
            label="Intervention Types"
            iconPosition="start"
          />
          <Tab icon={<Timeline />} label="Time Analysis" iconPosition="start" />
          <Tab
            icon={<Star />}
            label="Performance Ranking"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.interventionMetricsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Intervention Insights
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Acceptance Rate: Above Target"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Response Time: Improving"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Volume: Increasing Trend"
                      color="info"
                      size="small"
                    />
                    <Chip
                      label="Quality: Excellent"
                      color="success"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Pharmacist interventions show consistent improvement across
                    all key metrics. The acceptance rate has exceeded targets,
                    and response times continue to decrease while maintaining
                    high quality standards.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <ChartComponent
                data={mockData.interventionTypesData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Intervention Type Analysis
                  </Typography>

                  {mockData.interventionTypesData.data.map((item, index) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 2,
                        pb: 2,
                        borderBottom:
                          index < mockData.interventionTypesData.data.length - 1
                            ? 1
                            : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium">
                          {item.type}
                        </Typography>
                        <Chip
                          label={`${item.successRate}%`}
                          color={
                            item.successRate > 90
                              ? 'success'
                              : item.successRate > 85
                              ? 'warning'
                              : 'error'
                          }
                          size="small"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {item.count} interventions • Avg: {item.avgTime}h
                        response
                      </Typography>
                    </Box>
                  ))}

                  <Alert severity="info" size="small" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      Drug interaction alerts show the highest success rate due
                      to their critical nature and immediate clinical relevance.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.timeAnalysisData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Peak Hours Analysis
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          backgroundColor: 'primary.light',
                          borderRadius: 2,
                          color: 'primary.contrastText',
                        }}
                      >
                        <Schedule sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h6">12 PM</Typography>
                        <Typography variant="caption">Peak Hour</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          backgroundColor: 'success.light',
                          borderRadius: 2,
                          color: 'success.contrastText',
                        }}
                      >
                        <CheckCircle sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h6">95 Int.</Typography>
                        <Typography variant="caption">Max Volume</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          backgroundColor: 'warning.light',
                          borderRadius: 2,
                          color: 'warning.contrastText',
                        }}
                      >
                        <TrendingUp sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h6">2.8h</Typography>
                        <Typography variant="caption">Peak Response</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          backgroundColor: 'info.light',
                          borderRadius: 2,
                          color: 'info.contrastText',
                        }}
                      >
                        <Timeline sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="h6">1.2h</Typography>
                        <Typography variant="caption">Best Response</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <ChartComponent
                data={mockData.performanceComparisonData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Performers
                  </Typography>

                  <List dense>
                    {mockData.topPharmacists
                      .slice(0, 5)
                      .map((pharmacist, index) => (
                        <React.Fragment key={pharmacist.id}>
                          <ListItem sx={{ px: 0 }}>
                            <ListItemAvatar>
                              <Avatar
                                sx={{
                                  bgcolor:
                                    index === 0
                                      ? 'gold'
                                      : index === 1
                                      ? 'silver'
                                      : index === 2
                                      ? '#cd7f32'
                                      : 'primary.main',
                                }}
                              >
                                {index + 1}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {pharmacist.name}
                                  </Typography>
                                  <Rating
                                    value={pharmacist.qualityScore}
                                    max={5}
                                    size="small"
                                    readOnly
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {pharmacist.interventions} interventions •{' '}
                                    {pharmacist.acceptanceRate}% acceptance
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    {pharmacist.specialties.map((specialty) => (
                                      <Chip
                                        key={specialty}
                                        label={specialty}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              }
                            />
                          </ListItem>
                          {index < mockData.topPharmacists.length - 1 && (
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

export default PharmacistInterventionReport;
