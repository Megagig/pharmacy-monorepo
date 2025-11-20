// Patient Demographics & Segmentation Report Component
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
} from '@mui/material';
import {
  People,
  LocationOn,
  Timeline,
  Assessment,
  TrendingUp,
  Map,
  BarChart,
  PieChart,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData, KPICardData } from '../../types/charts';
import { PatientDemographicsFilters } from '../../types/filters';
import { PatientDemographicsData } from '../../types/reports';
import { useCurrentFilters } from '../../stores/filtersStore';

interface PatientDemographicsReportProps {
  filters: PatientDemographicsFilters;
  onFilterChange?: (filters: PatientDemographicsFilters) => void;
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

const PatientDemographicsReport: React.FC<PatientDemographicsReportProps> = ({
  filters,
  onFilterChange,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState('age');
  const [showGeographicHeatmap, setShowGeographicHeatmap] = useState(true);

  // Mock data - in real implementation, this would come from API
  const mockData = useMemo(
    () => ({
      // KPI Cards Data
      kpiData: [
        {
          title: 'Total Patients',
          value: 12847,
          unit: 'patients',
          trend: {
            direction: 'up' as const,
            value: 8.3,
            period: 'vs last quarter',
          },
          status: 'info' as const,
          sparkline: [
            { name: 'Q1', value: 11200 },
            { name: 'Q2', value: 11800 },
            { name: 'Q3', value: 12300 },
            { name: 'Q4', value: 12847 },
          ],
        },
        {
          title: 'Active Segments',
          value: 8,
          unit: 'segments',
          trend: {
            direction: 'stable' as const,
            value: 0,
            period: 'no change',
          },
          status: 'success' as const,
        },
        {
          title: 'Geographic Coverage',
          value: 15,
          unit: 'regions',
          trend: {
            direction: 'up' as const,
            value: 2,
            period: 'new regions',
          },
          status: 'info' as const,
        },
        {
          title: 'Service Utilization',
          value: 78.5,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 5.2,
            period: 'vs last month',
          },
          status: 'success' as const,
        },
      ],

      // Age Distribution
      ageDistributionData: {
        id: 'age-distribution',
        title: 'Patient Age Distribution',
        subtitle: 'Population analysis by age groups',
        type: 'bar' as const,
        data: [
          { ageGroup: '18-25', count: 1847, percentage: 14.4, utilization: 65 },
          { ageGroup: '26-35', count: 2156, percentage: 16.8, utilization: 72 },
          { ageGroup: '36-45', count: 2834, percentage: 22.1, utilization: 78 },
          { ageGroup: '46-55', count: 2945, percentage: 22.9, utilization: 82 },
          { ageGroup: '56-65', count: 2187, percentage: 17.0, utilization: 85 },
          { ageGroup: '66+', count: 878, percentage: 6.8, utilization: 88 },
        ],
        config: {
          title: {
            text: 'Patient Age Distribution',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'ageGroup',
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
              name: 'Patient Count',
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

      // Geographic Patterns
      geographicPatternsData: {
        id: 'geographic-patterns',
        title: 'Geographic Distribution & Service Utilization',
        subtitle: 'Patient distribution and service usage by location',
        type: 'heatmap' as const,
        data: [
          {
            location: 'Downtown',
            patientCount: 2847,
            serviceUtilization: 85,
            density: 'high',
          },
          {
            location: 'Suburbs North',
            patientCount: 1956,
            serviceUtilization: 72,
            density: 'medium',
          },
          {
            location: 'Suburbs South',
            patientCount: 2134,
            serviceUtilization: 78,
            density: 'medium',
          },
          {
            location: 'East District',
            patientCount: 1678,
            serviceUtilization: 68,
            density: 'medium',
          },
          {
            location: 'West District',
            patientCount: 1834,
            serviceUtilization: 74,
            density: 'medium',
          },
          {
            location: 'Industrial Area',
            patientCount: 892,
            serviceUtilization: 62,
            density: 'low',
          },
          {
            location: 'University Area',
            patientCount: 1506,
            serviceUtilization: 88,
            density: 'high',
          },
        ],
        config: {
          title: {
            text: 'Geographic Distribution & Service Utilization',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'location',
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
              label: 'serviceUtilization',
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
              name: 'Patient Count',
              type: 'bar' as const,
              dataKey: 'patientCount',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 600,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Service Utilization',
              type: 'line' as const,
              dataKey: 'serviceUtilization',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 100,
                easing: 'ease-out' as const,
              },
              yAxisId: 'right' as const,
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

      // Patient Journey Analytics
      patientJourneyData: {
        id: 'patient-journey',
        title: 'Patient Journey Analytics',
        subtitle: 'Funnel analysis of patient progression through care stages',
        type: 'funnel' as const,
        data: [
          {
            stage: 'Initial Contact',
            patients: 15847,
            conversionRate: 100,
            averageDuration: 0,
          },
          {
            stage: 'Assessment',
            patients: 14256,
            conversionRate: 89.9,
            averageDuration: 2.3,
          },
          {
            stage: 'Treatment Plan',
            patients: 13124,
            conversionRate: 92.1,
            averageDuration: 5.7,
          },
          {
            stage: 'Active Treatment',
            patients: 12847,
            conversionRate: 97.9,
            averageDuration: 45.2,
          },
          {
            stage: 'Follow-up',
            patients: 11934,
            conversionRate: 92.9,
            averageDuration: 12.8,
          },
          {
            stage: 'Completion',
            patients: 10567,
            conversionRate: 88.5,
            averageDuration: 8.4,
          },
        ],
        config: {
          title: {
            text: 'Patient Journey Analytics',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'stage',
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
              label: 'patients',
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
              name: 'Patient Count',
              type: 'bar' as const,
              dataKey: 'patients',
              style: { color: '#3b82f6' },
              animations: {
                enabled: true,
                duration: 700,
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
            duration: 700,
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

      // Service Utilization Analysis
      serviceUtilizationData: {
        id: 'service-utilization',
        title: 'Service Utilization Analysis',
        subtitle: 'Usage patterns and satisfaction by service type',
        type: 'radar' as const,
        data: [
          {
            service: 'Medication Therapy Management',
            utilization: 85,
            satisfaction: 4.2,
            frequency: 78,
          },
          {
            service: 'Clinical Consultations',
            utilization: 72,
            satisfaction: 4.5,
            frequency: 65,
          },
          {
            service: 'Health Screenings',
            utilization: 68,
            satisfaction: 4.1,
            frequency: 45,
          },
          {
            service: 'Immunizations',
            utilization: 92,
            satisfaction: 4.7,
            frequency: 35,
          },
          {
            service: 'Chronic Care Management',
            utilization: 78,
            satisfaction: 4.3,
            frequency: 88,
          },
          {
            service: 'Patient Education',
            utilization: 65,
            satisfaction: 4.0,
            frequency: 52,
          },
        ],
        config: {
          title: {
            text: 'Service Utilization Analysis',
            alignment: 'center' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'service',
              type: 'category' as const,
              grid: true,
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
              name: 'Utilization Rate',
              type: 'radar' as const,
              dataKey: 'utilization',
              style: { color: '#3b82f6', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 800,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Satisfaction Score',
              type: 'radar' as const,
              dataKey: 'satisfaction',
              style: { color: '#10b981', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 800,
                delay: 100,
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
    [selectedSegment]
  );

  // Simulate data loading
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [filters, selectedSegment]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Patient Demographics Data
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
          <People sx={{ mr: 2, color: 'primary.main' }} />
          Patient Demographics & Segmentation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of patient population, geographic patterns,
          journey analytics, and service utilization with targeted
          recommendations.
        </Typography>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Segmentation</InputLabel>
                <Select
                  value={selectedSegment}
                  label="Segmentation"
                  onChange={(e) => setSelectedSegment(e.target.value)}
                >
                  <MenuItem value="age">Age Groups</MenuItem>
                  <MenuItem value="gender">Gender</MenuItem>
                  <MenuItem value="condition">Medical Conditions</MenuItem>
                  <MenuItem value="geography">Geographic</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showGeographicHeatmap}
                    onChange={(e) => setShowGeographicHeatmap(e.target.checked)}
                  />
                }
                label="Geographic Heatmap"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Assessment />}
                fullWidth
                onClick={() => {
                  // Trigger segmentation analysis
                  setLoading(true);
                  setTimeout(() => setLoading(false), 1500);
                }}
              >
                Analyze Segments
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Map />}
                fullWidth
                onClick={() => {
                  // Export geographic data

                }}
              >
                Export Map Data
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
            label="Population Analysis"
            iconPosition="start"
          />
          <Tab
            icon={<LocationOn />}
            label="Geographic Patterns"
            iconPosition="start"
          />
          <Tab
            icon={<Timeline />}
            label="Patient Journey"
            iconPosition="start"
          />
          <Tab
            icon={<PieChart />}
            label="Service Utilization"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.ageDistributionData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Population Insights
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: 'primary.light',
                        }}
                      >
                        <Typography variant="h6" color="primary.contrastText">
                          46-55 Years
                        </Typography>
                        <Typography
                          variant="body2"
                          color="primary.contrastText"
                        >
                          Largest Segment (22.9%)
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: 'success.light',
                        }}
                      >
                        <Typography variant="h6" color="success.contrastText">
                          66+ Years
                        </Typography>
                        <Typography
                          variant="body2"
                          color="success.contrastText"
                        >
                          Highest Utilization (88%)
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: 'warning.light',
                        }}
                      >
                        <Typography variant="h6" color="warning.contrastText">
                          18-25 Years
                        </Typography>
                        <Typography
                          variant="body2"
                          color="warning.contrastText"
                        >
                          Growth Opportunity (65%)
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: 'info.light',
                        }}
                      >
                        <Typography variant="h6" color="info.contrastText">
                          36-55 Years
                        </Typography>
                        <Typography variant="body2" color="info.contrastText">
                          Core Demographics (45%)
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
              <ChartComponent
                data={mockData.geographicPatternsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Geographic Analysis
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Downtown: High Density"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="University Area: High Utilization"
                      color="info"
                      size="small"
                    />
                    <Chip
                      label="Industrial Area: Underserved"
                      color="warning"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Geographic analysis reveals concentration in urban areas
                    with opportunities for expansion in underserved regions.
                    University area shows highest service utilization rates
                    despite moderate patient density.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.patientJourneyData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Journey Analytics Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'success.main',
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          color="success.main"
                          gutterBottom
                        >
                          Overall Completion Rate
                        </Typography>
                        <Typography variant="h5" color="success.main">
                          66.7%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          From initial contact to completion
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'warning.main',
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          color="warning.main"
                          gutterBottom
                        >
                          Highest Drop-off
                        </Typography>
                        <Typography variant="h5" color="warning.main">
                          Assessment
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          10.1% drop-off rate
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'info.main',
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          color="info.main"
                          gutterBottom
                        >
                          Average Duration
                        </Typography>
                        <Typography variant="h5" color="info.main">
                          74.4 days
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Complete patient journey
                        </Typography>
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
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.serviceUtilizationData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Service Utilization Insights
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      {
                        service: 'Immunizations',
                        utilization: 92,
                        satisfaction: 4.7,
                        status: 'success',
                      },
                      {
                        service: 'MTM',
                        utilization: 85,
                        satisfaction: 4.2,
                        status: 'success',
                      },
                      {
                        service: 'Patient Education',
                        utilization: 65,
                        satisfaction: 4.0,
                        status: 'warning',
                      },
                    ].map((item, index) => (
                      <Grid item xs={12} md={4} key={index}>
                        <Box
                          sx={{
                            p: 2,
                            border: 1,
                            borderColor: `${item.status}.main`,
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="subtitle1" gutterBottom>
                            {item.service}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Utilization: {item.utilization}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Satisfaction: {item.satisfaction}/5.0
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>

      {/* Targeted Recommendations */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Targeted Recommendations
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography
                  variant="subtitle1"
                  color="info.contrastText"
                  gutterBottom
                >
                  Young Adult Engagement
                </Typography>
                <Typography variant="body2" color="info.contrastText">
                  Implement digital health initiatives and flexible scheduling
                  to improve engagement in the 18-25 age group (currently 65%
                  utilization).
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography
                  variant="subtitle1"
                  color="warning.contrastText"
                  gutterBottom
                >
                  Geographic Expansion
                </Typography>
                <Typography variant="body2" color="warning.contrastText">
                  Consider satellite services in Industrial Area to address the
                  62% utilization rate and improve accessibility.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography
                  variant="subtitle1"
                  color="success.contrastText"
                  gutterBottom
                >
                  Patient Education Enhancement
                </Typography>
                <Typography variant="body2" color="success.contrastText">
                  Boost patient education services through interactive programs
                  to increase the current 65% utilization rate.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                <Typography
                  variant="subtitle1"
                  color="primary.contrastText"
                  gutterBottom
                >
                  Journey Optimization
                </Typography>
                <Typography variant="body2" color="primary.contrastText">
                  Streamline the assessment process to reduce the 10.1% drop-off
                  rate and improve overall completion rates.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientDemographicsReport;
