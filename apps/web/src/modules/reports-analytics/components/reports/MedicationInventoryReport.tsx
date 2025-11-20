// Medication Usage & Inventory Report Module Component
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
  LinearProgress,
} from '@mui/material';
import {
  Inventory,
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
  LocalPharmacy,
  AttachMoney,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData } from '../../types/charts';
import { MedicationInventoryFilters } from '../../types/filters';
import { useCurrentFilters } from '../../stores/filtersStore';
import { ReportType } from '../../types/reports';

interface MedicationInventoryReportProps {
  filters: MedicationInventoryFilters;
  onFilterChange?: (filters: MedicationInventoryFilters) => void;
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

const MedicationInventoryReport: React.FC<MedicationInventoryReportProps> = ({
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
          title: 'Inventory Turnover Rate',
          value: 8.4,
          unit: 'times/year',
          trend: {
            direction: 'up' as const,
            value: 12.3,
            period: 'vs last year',
          },
          status: 'success' as const,
          target: { value: 8, label: 'times/year' },
        },
        {
          title: 'Stock Optimization Score',
          value: 87.2,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 5.7,
            period: 'improvement',
          },
          status: 'success' as const,
        },
        {
          title: 'Expiration Waste Value',
          value: 2840,
          unit: '₦',
          trend: {
            direction: 'down' as const,
            value: 18.5,
            period: 'reduction',
          },
          status: 'success' as const,
        },
        {
          title: 'Items Expiring Soon',
          value: 23,
          unit: 'items',
          trend: {
            direction: 'down' as const,
            value: 30.4,
            period: 'vs last month',
          },
          status: 'warning' as const,
        },
      ],

      // Usage Patterns Analysis
      usagePatternsData: {
        id: 'usage-patterns',
        title: 'Medication Usage Pattern Analysis',
        subtitle: 'Usage trends and seasonality patterns for key medications',
        type: 'line' as const,
        data: [
          {
            month: 'Jan',
            Antibiotics: 245,
            'Pain Relievers': 189,
            'Diabetes Medications': 156,
            'Hypertension Drugs': 203,
            'Seasonal Trend': 220,
          },
          {
            month: 'Feb',
            Antibiotics: 267,
            'Pain Relievers': 198,
            'Diabetes Medications': 162,
            'Hypertension Drugs': 198,
            'Seasonal Trend': 225,
          },
          {
            month: 'Mar',
            Antibiotics: 289,
            'Pain Relievers': 176,
            'Diabetes Medications': 158,
            'Hypertension Drugs': 205,
            'Seasonal Trend': 210,
          },
          {
            month: 'Apr',
            Antibiotics: 234,
            'Pain Relievers': 165,
            'Diabetes Medications': 164,
            'Hypertension Drugs': 212,
            'Seasonal Trend': 195,
          },
          {
            month: 'May',
            Antibiotics: 198,
            'Pain Relievers': 154,
            'Diabetes Medications': 169,
            'Hypertension Drugs': 218,
            'Seasonal Trend': 185,
          },
          {
            month: 'Jun',
            Antibiotics: 176,
            'Pain Relievers': 142,
            'Diabetes Medications': 173,
            'Hypertension Drugs': 224,
            'Seasonal Trend': 180,
          },
        ],
        config: {
          title: {
            text: 'Medication Usage Pattern Analysis with Seasonal Trends',
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
              label: 'units',
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
              name: 'Antibiotics',
              type: 'line' as const,
              dataKey: 'Antibiotics',
              style: { color: '#3b82f6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Pain Relievers',
              type: 'line' as const,
              dataKey: 'Pain Relievers',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Diabetes Medications',
              type: 'line' as const,
              dataKey: 'Diabetes Medications',
              style: { color: '#f59e0b', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 200,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Hypertension Drugs',
              type: 'line' as const,
              dataKey: 'Hypertension Drugs',
              style: { color: '#8b5cf6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 300,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Seasonal Trend',
              type: 'line' as const,
              dataKey: 'Seasonal Trend',
              style: {
                color: '#ef4444',
                strokeWidth: 2,
                strokeDasharray: '5 5',
              },
              animations: {
                enabled: true,
                duration: 300,
                delay: 400,
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
            colorPalette: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#8b5cf6',
              '#ef4444',
            ],
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

      // Inventory Turnover Visualization
      inventoryTurnoverData: {
        id: 'inventory-turnover',
        title: 'Inventory Turnover Analysis',
        subtitle:
          'Fast vs slow-moving inventory with stock optimization recommendations',
        type: 'bar' as const,
        data: [
          {
            category: 'Fast Moving',
            'Turnover Rate': 12.4,
            'Stock Days': 29,
            'Optimization Score': 92,
            count: 45,
          },
          {
            category: 'Medium Moving',
            'Turnover Rate': 6.8,
            'Stock Days': 54,
            'Optimization Score': 78,
            count: 67,
          },
          {
            category: 'Slow Moving',
            'Turnover Rate': 2.3,
            'Stock Days': 159,
            'Optimization Score': 45,
            count: 23,
          },
          {
            category: 'Very Slow',
            'Turnover Rate': 0.8,
            'Stock Days': 456,
            'Optimization Score': 12,
            count: 8,
          },
        ],
        config: {
          title: {
            text: 'Inventory Turnover Analysis with Stock Optimization',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'category',
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
              label: 'turnover rate',
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
              name: 'Turnover Rate',
              type: 'bar' as const,
              dataKey: 'Turnover Rate',
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

      // Demand Forecasting Data
      demandForecastingData: [
        {
          medication: 'Metformin 500mg',
          currentStock: 450,
          predictedDemand: 380,
          recommendedOrder: 200,
          confidence: 92,
          trend: 'stable' as const,
          category: 'Diabetes',
        },
        {
          medication: 'Lisinopril 10mg',
          currentStock: 320,
          predictedDemand: 420,
          recommendedOrder: 300,
          confidence: 88,
          trend: 'increasing' as const,
          category: 'Hypertension',
        },
        {
          medication: 'Amoxicillin 250mg',
          currentStock: 180,
          predictedDemand: 290,
          recommendedOrder: 400,
          confidence: 85,
          trend: 'increasing' as const,
          category: 'Antibiotics',
        },
        {
          medication: 'Ibuprofen 400mg',
          currentStock: 520,
          predictedDemand: 340,
          recommendedOrder: 150,
          confidence: 90,
          trend: 'decreasing' as const,
          category: 'Pain Relief',
        },
        {
          medication: 'Omeprazole 20mg',
          currentStock: 280,
          predictedDemand: 310,
          recommendedOrder: 200,
          confidence: 87,
          trend: 'stable' as const,
          category: 'Gastric',
        },
      ],

      // Expiration Tracking Data
      expirationTrackingData: {
        title: 'Expiration Tracking Overview',
        value: 23,
        max: 100,
        unit: 'items',
        segments: [
          { value: 8, color: '#ef4444', label: 'Expires in 7 days' },
          { value: 15, color: '#f59e0b', label: 'Expires in 30 days' },
          { value: 32, color: '#eab308', label: 'Expires in 90 days' },
          { value: 45, color: '#22c55e', label: 'Long shelf life' },
        ],
        centerText: {
          primary: '23',
          secondary: 'Items Expiring Soon',
        },
      },

      // Cost Analysis Data
      costAnalysisData: {
        id: 'cost-analysis',
        title: 'Cost Analysis & Profitability Dashboard',
        subtitle: 'Inventory costs, waste reduction, and profitability metrics',
        type: 'area' as const,
        data: [
          {
            month: 'Jan',
            'Inventory Cost': 45000,
            'Waste Cost': 3200,
            'Profit Margin': 18500,
            'Cost Savings': 2100,
          },
          {
            month: 'Feb',
            'Inventory Cost': 47200,
            'Waste Cost': 2800,
            'Profit Margin': 19200,
            'Cost Savings': 2400,
          },
          {
            month: 'Mar',
            'Inventory Cost': 46800,
            'Waste Cost': 2600,
            'Profit Margin': 19800,
            'Cost Savings': 2600,
          },
          {
            month: 'Apr',
            'Inventory Cost': 48500,
            'Waste Cost': 2400,
            'Profit Margin': 20100,
            'Cost Savings': 2800,
          },
          {
            month: 'May',
            'Inventory Cost': 49200,
            'Waste Cost': 2200,
            'Profit Margin': 20800,
            'Cost Savings': 3000,
          },
          {
            month: 'Jun',
            'Inventory Cost': 50100,
            'Waste Cost': 2000,
            'Profit Margin': 21500,
            'Cost Savings': 3200,
          },
        ],
        config: {
          title: {
            text: 'Cost Analysis & Profitability Dashboard',
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
              label: 'amount (₦)',
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
              name: 'Profit Margin',
              type: 'area' as const,
              dataKey: 'Profit Margin',
              style: { color: '#10b981', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Cost Savings',
              type: 'area' as const,
              dataKey: 'Cost Savings',
              style: { color: '#3b82f6', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Waste Cost',
              type: 'area' as const,
              dataKey: 'Waste Cost',
              style: { color: '#ef4444', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
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
            colorPalette: ['#10b981', '#3b82f6', '#ef4444'],
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

  const getTrendColor = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing':
        return 'success';
      case 'decreasing':
        return 'error';
      case 'stable':
        return 'info';
      default:
        return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'success';
    if (confidence >= 80) return 'info';
    if (confidence >= 70) return 'warning';
    return 'error';
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Medication Inventory Data
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
          <Inventory sx={{ mr: 2, color: 'primary.main' }} />
          Medication Usage & Inventory Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of usage patterns, inventory turnover, demand
          forecasting, expiration tracking, and cost optimization with waste
          reduction metrics.
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
            icon={<ShowChart />}
            label="Usage Patterns"
            iconPosition="start"
          />
          <Tab
            icon={<BarChart />}
            label="Inventory Turnover"
            iconPosition="start"
          />
          <Tab
            icon={<Assessment />}
            label="Demand Forecasting"
            iconPosition="start"
          />
          <Tab
            icon={<Schedule />}
            label="Expiration Tracking"
            iconPosition="start"
          />
          <Tab
            icon={<AttachMoney />}
            label="Cost Analysis"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.usagePatternsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Usage Pattern Insights
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Antibiotics: Seasonal Peak"
                      color="warning"
                      size="small"
                    />
                    <Chip
                      label="Diabetes Meds: Stable Demand"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Pain Relievers: Declining Trend"
                      color="info"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Antibiotic usage shows strong seasonal patterns with peaks
                    in winter months. Diabetes medications maintain stable
                    demand throughout the year. Pain reliever usage is
                    declining, possibly due to alternative therapies.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.inventoryTurnoverData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Inventory Turnover Analysis
                  </Typography>
                  <Grid container spacing={2}>
                    {mockData.inventoryTurnoverData.data.map(
                      (item: any, index: number) => (
                        <Grid item xs={12} sm={6} md={3} key={index}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h6" gutterBottom>
                              {item.category}
                            </Typography>
                            <Typography
                              variant="h4"
                              color="primary.main"
                              gutterBottom
                            >
                              {item['Turnover Rate']}x
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              gutterBottom
                            >
                              {item.count} items
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={item['Optimization Score']}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: 'grey.200',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor:
                                    item['Optimization Score'] >= 80
                                      ? '#22c55e'
                                      : item['Optimization Score'] >= 60
                                      ? '#f59e0b'
                                      : '#ef4444',
                                  borderRadius: 3,
                                },
                              }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Optimization: {item['Optimization Score']}%
                            </Typography>
                          </Paper>
                        </Grid>
                      )
                    )}
                  </Grid>
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
                    Demand Forecasting with Seasonal Adjustments
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Medication</TableCell>
                          <TableCell align="right">Current Stock</TableCell>
                          <TableCell align="right">Predicted Demand</TableCell>
                          <TableCell align="right">Recommended Order</TableCell>
                          <TableCell align="center">Confidence</TableCell>
                          <TableCell align="center">Trend</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mockData.demandForecastingData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Box>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 500 }}
                                >
                                  {item.medication}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {item.category}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {item.currentStock}
                            </TableCell>
                            <TableCell align="right">
                              {item.predictedDemand}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  color:
                                    item.recommendedOrder > item.currentStock
                                      ? 'error.main'
                                      : 'success.main',
                                }}
                              >
                                {item.recommendedOrder}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${item.confidence}%`}
                                color={
                                  getConfidenceColor(item.confidence) as any
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={item.trend}
                                color={getTrendColor(item.trend) as any}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <ChartComponent
                data={{
                  id: 'expiration-tracking',
                  title: '',
                  type: 'progress-ring',
                  data: [mockData.expirationTrackingData],
                  config: {} as any,
                }}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Expiration Alert System
                  </Typography>

                  {mockData.expirationTrackingData.segments?.map(
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
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {segment.value} items
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(segment.value / 100) * 100}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'grey.200',
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
                      mt: 3,
                      p: 2,
                      backgroundColor: 'warning.light',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" color="warning.contrastText">
                      <strong>Action Required:</strong> 8 items expire within 7
                      days. Consider promotional pricing or alternative
                      distribution channels to minimize waste.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.costAnalysisData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cost Analysis Summary
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="success.main"
                          gutterBottom
                        >
                          ₦21,500
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Monthly Profit Margin
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="error.main"
                          gutterBottom
                        >
                          ₦2,000
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Waste Cost (37% reduction)
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h3" color="info.main" gutterBottom>
                          ₦3,200
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Cost Savings Achieved
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="primary.main"
                          gutterBottom
                        >
                          42.9%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Profit Margin Ratio
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Cost optimization efforts have resulted in significant waste
                    reduction and improved profit margins. Continued focus on
                    expiration management and demand forecasting accuracy will
                    further enhance profitability.
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

export default MedicationInventoryReport;
