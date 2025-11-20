// Patient Outcome Analytics Report Component
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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assessment,
  LocalHospital,
  Psychology,
  Medication,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData, KPICardData, ProgressRingData } from '../../types/charts';
import { PatientOutcomeFilters } from '../../types/filters';
import { useCurrentFilters } from '../../stores/filtersStore';
import { ReportType } from '../../types/reports';

interface PatientOutcomeReportProps {
  filters: PatientOutcomeFilters;
  onFilterChange?: (filters: PatientOutcomeFilters) => void;
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

const PatientOutcomeReport: React.FC<PatientOutcomeReportProps> = ({
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
          title: 'Overall Improvement Rate',
          value: 78.5,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 12.3,
            period: 'vs last month',
          },
          status: 'success' as const,
          sparkline: [
            { name: 'Week 1', value: 65 },
            { name: 'Week 2', value: 70 },
            { name: 'Week 3', value: 75 },
            { name: 'Week 4', value: 78.5 },
          ],
        },
        {
          title: 'Clinical Parameter Improvement',
          value: 82.1,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 8.7,
            period: 'vs last month',
          },
          status: 'success' as const,
        },
        {
          title: 'Quality of Life Score',
          value: 7.8,
          unit: '/10',
          trend: {
            direction: 'up' as const,
            value: 5.2,
            period: 'vs baseline',
          },
          status: 'info' as const,
        },
        {
          title: 'Adverse Events Reduction',
          value: 34.2,
          unit: '%',
          trend: {
            direction: 'down' as const,
            value: 15.8,
            period: 'reduction',
          },
          status: 'success' as const,
        },
      ],

      // Therapy Effectiveness Over Time
      therapyEffectivenessData: {
        id: 'therapy-effectiveness',
        title: 'Therapy Effectiveness Over Time',
        subtitle: 'Clinical parameter improvements by therapy type',
        type: 'line' as const,
        data: [
          {
            month: 'Jan',
            'Medication Therapy': 65,
            'Behavioral Therapy': 58,
            'Combined Therapy': 72,
          },
          {
            month: 'Feb',
            'Medication Therapy': 68,
            'Behavioral Therapy': 62,
            'Combined Therapy': 75,
          },
          {
            month: 'Mar',
            'Medication Therapy': 72,
            'Behavioral Therapy': 65,
            'Combined Therapy': 78,
          },
          {
            month: 'Apr',
            'Medication Therapy': 75,
            'Behavioral Therapy': 68,
            'Combined Therapy': 82,
          },
          {
            month: 'May',
            'Medication Therapy': 78,
            'Behavioral Therapy': 71,
            'Combined Therapy': 85,
          },
          {
            month: 'Jun',
            'Medication Therapy': 82,
            'Behavioral Therapy': 74,
            'Combined Therapy': 88,
          },
        ],
        config: {
          title: {
            text: 'Therapy Effectiveness Over Time',
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
              name: 'Medication Therapy',
              type: 'line' as const,
              dataKey: 'Medication Therapy',
              style: { color: '#3b82f6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Behavioral Therapy',
              type: 'line' as const,
              dataKey: 'Behavioral Therapy',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Combined Therapy',
              type: 'line' as const,
              dataKey: 'Combined Therapy',
              style: { color: '#f59e0b', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 200,
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

      // Clinical Parameters Improvement
      clinicalParametersData: {
        id: 'clinical-parameters',
        title: 'Clinical Parameters Improvement',
        subtitle: 'Percentage improvement by parameter type',
        type: 'bar' as const,
        data: [
          {
            parameter: 'Blood Pressure',
            improvement: 85,
            target: 80,
            baseline: 45,
          },
          {
            parameter: 'Cholesterol',
            improvement: 78,
            target: 75,
            baseline: 42,
          },
          {
            parameter: 'Blood Sugar',
            improvement: 82,
            target: 85,
            baseline: 38,
          },
          {
            parameter: 'Weight Management',
            improvement: 71,
            target: 70,
            baseline: 35,
          },
          {
            parameter: 'Pain Levels',
            improvement: 89,
            target: 80,
            baseline: 52,
          },
          {
            parameter: 'Sleep Quality',
            improvement: 76,
            target: 75,
            baseline: 41,
          },
        ],
        config: {
          title: {
            text: 'Clinical Parameters Improvement',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'parameter',
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
              label: 'improvement',
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
              name: 'Current Improvement',
              type: 'bar' as const,
              dataKey: 'improvement',
              style: { color: '#10b981' },
              animations: {
                enabled: true,
                duration: 500,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Target',
              type: 'bar' as const,
              dataKey: 'target',
              style: { color: '#f59e0b', fillOpacity: 0.6 },
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
            colorPalette: ['#10b981', '#f59e0b'],
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

      // Adverse Events Reduction
      adverseEventsData: {
        id: 'adverse-events',
        title: 'Adverse Events Reduction',
        subtitle: 'Reduction in adverse events by severity',
        type: 'donut' as const,
        data: [
          { name: 'Mild Events', value: 45, reduction: 25 },
          { name: 'Moderate Events', value: 30, reduction: 35 },
          { name: 'Severe Events', value: 20, reduction: 45 },
          { name: 'Critical Events', value: 5, reduction: 60 },
        ],
        config: {
          title: {
            text: 'Adverse Events Reduction',
            alignment: 'center' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'name',
              type: 'category' as const,
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
            y: {
              label: 'value',
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
              name: 'Events',
              type: 'pie' as const,
              dataKey: 'value',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 800,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
          ],
          legend: {
            enabled: true,
            position: 'right' as const,
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
            colorPalette: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
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

      // Quality of Life Progress
      qualityOfLifeData: {
        title: 'Quality of Life Progress',
        value: 78,
        max: 100,
        unit: '%',
        segments: [
          { value: 25, color: '#ef4444', label: 'Physical Health' },
          { value: 20, color: '#f59e0b', label: 'Mental Health' },
          { value: 18, color: '#10b981', label: 'Social Function' },
          { value: 15, color: '#3b82f6', label: 'Daily Activities' },
        ],
        centerText: {
          primary: '78%',
          secondary: 'Overall Score',
        },
      },

      // Therapy Comparison Data
      therapyComparisonData: {
        id: 'therapy-comparison',
        title: 'Therapy Type Effectiveness Comparison',
        subtitle: 'Success rates by therapy type and patient demographics',
        type: 'bar' as const,
        data: [
          {
            therapy: 'Medication Only',
            'Age 18-35': 72,
            'Age 36-55': 68,
            'Age 56+': 65,
          },
          {
            therapy: 'Behavioral Only',
            'Age 18-35': 65,
            'Age 36-55': 70,
            'Age 56+': 68,
          },
          {
            therapy: 'Combined Therapy',
            'Age 18-35': 85,
            'Age 36-55': 82,
            'Age 56+': 78,
          },
          {
            therapy: 'Digital Health',
            'Age 18-35': 78,
            'Age 36-55': 65,
            'Age 56+': 52,
          },
        ],
        config: {
          title: {
            text: 'Therapy Type Effectiveness Comparison',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'therapy',
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
              name: 'Age 18-35',
              type: 'bar' as const,
              dataKey: 'Age 18-35',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 600,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Age 36-55',
              type: 'bar' as const,
              dataKey: 'Age 36-55',
              style: { color: '#10b981' },
              animations: {
                enabled: true,
                duration: 600,
                delay: 100,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Age 56+',
              type: 'bar' as const,
              dataKey: 'Age 56+',
              style: { color: '#f59e0b' },
              animations: {
                enabled: true,
                duration: 600,
                delay: 200,
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
            duration: 600,
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
          Error Loading Patient Outcome Data
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
          <Assessment sx={{ mr: 2, color: 'primary.main' }} />
          Patient Outcome Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of patient therapy outcomes, clinical
          improvements, and quality of life metrics.
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
            label="Therapy Effectiveness"
            iconPosition="start"
          />
          <Tab
            icon={<LocalHospital />}
            label="Clinical Parameters"
            iconPosition="start"
          />
          <Tab
            icon={<Psychology />}
            label="Quality of Life"
            iconPosition="start"
          />
          <Tab
            icon={<Medication />}
            label="Adverse Events"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.therapyEffectivenessData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.therapyComparisonData}
                height={350}
                loading={loading}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.clinicalParametersData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Clinical Parameter Insights
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Blood Pressure: Above Target"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Pain Levels: Excellent Progress"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Blood Sugar: Near Target"
                      color="warning"
                      size="small"
                    />
                    <Chip
                      label="Weight: Below Target"
                      color="error"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Most clinical parameters are showing positive improvement
                    trends. Pain management interventions are particularly
                    effective, while weight management may require additional
                    support strategies.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <ChartComponent
                data={{
                  id: 'quality-of-life',
                  title: '',
                  type: 'progress-ring',
                  data: [mockData.qualityOfLifeData],
                  config: {} as any,
                }}
                height={350}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 350 }}>
                <CardContent
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Quality of Life Breakdown
                  </Typography>

                  {mockData.qualityOfLifeData.segments?.map(
                    (segment, index) => (
                      <Box key={index} sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2">
                            {segment.label}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {segment.value}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={segment.value}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: `${segment.color}20`,
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: segment.color,
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>
                    )
                  )}

                  <Box
                    sx={{
                      mt: 'auto',
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Quality of life scores are based on validated
                      patient-reported outcome measures (PROMs) and show
                      significant improvement across all domains.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <ChartComponent
                data={mockData.adverseEventsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Safety Improvements
                  </Typography>

                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Overall Reduction in Adverse Events
                    </Typography>
                    <Typography variant="h4" color="success.main" gutterBottom>
                      34.2%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Compared to baseline period
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Key Safety Metrics:
                    </Typography>
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2">Critical Events</Typography>
                        <Chip label="-60%" color="success" size="small" />
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2">Severe Events</Typography>
                        <Chip label="-45%" color="success" size="small" />
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2">Moderate Events</Typography>
                        <Chip label="-35%" color="success" size="small" />
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2">Mild Events</Typography>
                        <Chip label="-25%" color="success" size="small" />
                      </Box>
                    </Box>
                  </Box>

                  <Alert severity="info" size="small">
                    <Typography variant="caption">
                      Proactive intervention strategies have significantly
                      reduced the incidence of severe adverse events.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default PatientOutcomeReport;
