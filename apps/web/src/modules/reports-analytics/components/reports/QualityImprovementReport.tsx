// Quality Improvement Dashboard Report Component
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
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  CheckCircle,
  Warning,
  Error,
  Schedule,
  Assignment,
  CalendarToday,
  BarChart,
} from '@mui/icons-material';
import ChartComponent from '../shared/ChartComponent';
import { ChartData } from '../../types/charts';
import { QualityImprovementFilters } from '../../types/filters';
import { useCurrentFilters } from '../../stores/filtersStore';
import { ReportType } from '../../types/reports';

interface QualityImprovementReportProps {
  filters: QualityImprovementFilters;
  onFilterChange?: (filters: QualityImprovementFilters) => void;
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

const QualityImprovementReport: React.FC<QualityImprovementReportProps> = ({
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
          title: 'Average Completion Time',
          value: 4.2,
          unit: 'hours',
          trend: {
            direction: 'down' as const,
            value: 18.5,
            period: 'vs target',
          },
          status: 'success' as const,
          target: { value: 6, label: 'hours' },
        },
        {
          title: 'Follow-up Compliance Rate',
          value: 87.3,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 12.1,
            period: 'vs last month',
          },
          status: 'success' as const,
        },
        {
          title: 'Documentation Quality Score',
          value: 92.5,
          unit: '%',
          trend: {
            direction: 'up' as const,
            value: 8.3,
            period: 'improvement',
          },
          status: 'success' as const,
        },
        {
          title: 'Critical Issues Resolved',
          value: 156,
          unit: 'issues',
          trend: {
            direction: 'up' as const,
            value: 23.7,
            period: 'this month',
          },
          status: 'info' as const,
        },
      ],

      // Completion Time Analysis
      completionTimeData: {
        id: 'completion-time-analysis',
        title: 'Completion Time Analysis',
        subtitle:
          'Average completion times by process type with statistical control limits',
        type: 'line' as const,
        data: [
          {
            week: 'Week 1',
            'Medication Review': 3.8,
            'Patient Consultation': 2.1,
            Documentation: 1.5,
            'Follow-up': 2.8,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
          {
            week: 'Week 2',
            'Medication Review': 4.2,
            'Patient Consultation': 2.3,
            Documentation: 1.7,
            'Follow-up': 3.1,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
          {
            week: 'Week 3',
            'Medication Review': 3.9,
            'Patient Consultation': 2.0,
            Documentation: 1.4,
            'Follow-up': 2.9,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
          {
            week: 'Week 4',
            'Medication Review': 4.1,
            'Patient Consultation': 2.2,
            Documentation: 1.6,
            'Follow-up': 3.0,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
          {
            week: 'Week 5',
            'Medication Review': 3.7,
            'Patient Consultation': 1.9,
            Documentation: 1.3,
            'Follow-up': 2.7,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
          {
            week: 'Week 6',
            'Medication Review': 4.0,
            'Patient Consultation': 2.1,
            Documentation: 1.5,
            'Follow-up': 2.8,
            'Upper Control Limit': 6.0,
            'Lower Control Limit': 1.0,
            Target: 4.0,
          },
        ],
        config: {
          title: {
            text: 'Completion Time Analysis - Statistical Process Control',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'week',
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
              label: 'hours',
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
              name: 'Medication Review',
              type: 'line' as const,
              dataKey: 'Medication Review',
              style: { color: '#3b82f6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Patient Consultation',
              type: 'line' as const,
              dataKey: 'Patient Consultation',
              style: { color: '#10b981', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Documentation',
              type: 'line' as const,
              dataKey: 'Documentation',
              style: { color: '#f59e0b', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 200,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Follow-up',
              type: 'line' as const,
              dataKey: 'Follow-up',
              style: { color: '#8b5cf6', strokeWidth: 3 },
              animations: {
                enabled: true,
                duration: 300,
                delay: 300,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Upper Control Limit',
              type: 'line' as const,
              dataKey: 'Upper Control Limit',
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
            {
              name: 'Target',
              type: 'line' as const,
              dataKey: 'Target',
              style: {
                color: '#6b7280',
                strokeWidth: 2,
                strokeDasharray: '3 3',
              },
              animations: {
                enabled: true,
                duration: 300,
                delay: 500,
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
              '#6b7280',
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

      // Problem Identification Patterns Heatmap
      problemPatternsData: {
        id: 'problem-patterns-heatmap',
        title: 'Problem Identification Patterns',
        subtitle:
          'Frequency heatmap of identified issues by category and severity',
        type: 'heatmap' as const,
        data: [
          {
            category: 'Medication Errors',
            severity: 'Critical',
            frequency: 12,
            color: '#ef4444',
          },
          {
            category: 'Medication Errors',
            severity: 'High',
            frequency: 28,
            color: '#f97316',
          },
          {
            category: 'Medication Errors',
            severity: 'Medium',
            frequency: 45,
            color: '#eab308',
          },
          {
            category: 'Medication Errors',
            severity: 'Low',
            frequency: 67,
            color: '#22c55e',
          },
          {
            category: 'Documentation Issues',
            severity: 'Critical',
            frequency: 8,
            color: '#ef4444',
          },
          {
            category: 'Documentation Issues',
            severity: 'High',
            frequency: 34,
            color: '#f97316',
          },
          {
            category: 'Documentation Issues',
            severity: 'Medium',
            frequency: 52,
            color: '#eab308',
          },
          {
            category: 'Documentation Issues',
            severity: 'Low',
            frequency: 89,
            color: '#22c55e',
          },
          {
            category: 'Process Delays',
            severity: 'Critical',
            frequency: 5,
            color: '#ef4444',
          },
          {
            category: 'Process Delays',
            severity: 'High',
            frequency: 19,
            color: '#f97316',
          },
          {
            category: 'Process Delays',
            severity: 'Medium',
            frequency: 38,
            color: '#eab308',
          },
          {
            category: 'Process Delays',
            severity: 'Low',
            frequency: 71,
            color: '#22c55e',
          },
          {
            category: 'Communication Gaps',
            severity: 'Critical',
            frequency: 3,
            color: '#ef4444',
          },
          {
            category: 'Communication Gaps',
            severity: 'High',
            frequency: 15,
            color: '#f97316',
          },
          {
            category: 'Communication Gaps',
            severity: 'Medium',
            frequency: 29,
            color: '#eab308',
          },
          {
            category: 'Communication Gaps',
            severity: 'Low',
            frequency: 43,
            color: '#22c55e',
          },
        ],
        config: {
          title: {
            text: 'Problem Identification Patterns - Heatmap Analysis',
            alignment: 'left' as const,
            style: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
          },
          axes: {
            x: {
              label: 'severity',
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
          },
          series: [
            {
              name: 'Frequency',
              type: 'heatmap' as const,
              dataKey: 'frequency',
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
            colorPalette: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
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

      // Follow-up Compliance Calendar Heatmap
      followUpComplianceData: {
        title: 'Follow-up Compliance Tracking',
        value: 87,
        max: 100,
        unit: '%',
        segments: [
          { value: 45, color: '#22c55e', label: 'On Time' },
          { value: 25, color: '#eab308', label: 'Delayed' },
          { value: 17, color: '#f97316', label: 'Overdue' },
          { value: 13, color: '#ef4444', label: 'Missed' },
        ],
        centerText: {
          primary: '87%',
          secondary: 'Compliance Rate',
        },
      },

      // Documentation Quality Metrics
      documentationQualityData: {
        id: 'documentation-quality',
        title: 'Documentation Quality Metrics',
        subtitle:
          'Quality scores by documentation type with progress indicators',
        type: 'bar' as const,
        data: [
          {
            type: 'Patient Records',
            current: 94,
            target: 95,
            baseline: 78,
            improvement: 16,
          },
          {
            type: 'Medication Lists',
            current: 91,
            target: 93,
            baseline: 82,
            improvement: 9,
          },
          {
            type: 'Care Plans',
            current: 89,
            target: 90,
            baseline: 75,
            improvement: 14,
          },
          {
            type: 'Progress Notes',
            current: 96,
            target: 95,
            baseline: 85,
            improvement: 11,
          },
          {
            type: 'Discharge Summaries',
            current: 88,
            target: 92,
            baseline: 73,
            improvement: 15,
          },
          {
            type: 'Consent Forms',
            current: 97,
            target: 98,
            baseline: 89,
            improvement: 8,
          },
        ],
        config: {
          title: {
            text: 'Documentation Quality Metrics with Progress Indicators',
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
              name: 'Current Score',
              type: 'bar' as const,
              dataKey: 'current',
              style: { color: '#10b981' },
              animations: {
                enabled: true,
                duration: 500,
                delay: 0,
                easing: 'ease-out' as const,
              },
            },
            {
              name: 'Target Score',
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
            {
              name: 'Baseline',
              type: 'bar' as const,
              dataKey: 'baseline',
              style: { color: '#6b7280', fillOpacity: 0.4 },
              animations: {
                enabled: true,
                duration: 500,
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
            colorPalette: ['#10b981', '#f59e0b', '#6b7280'],
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

      // Quality Trend Analysis
      qualityTrendData: {
        id: 'quality-trend-analysis',
        title: 'Quality Trend Analysis',
        subtitle:
          'Statistical process control chart for overall quality metrics',
        type: 'area' as const,
        data: [
          {
            month: 'Jan',
            'Overall Quality Score': 82.5,
            'Process Capability': 85.2,
            'Customer Satisfaction': 79.8,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
          {
            month: 'Feb',
            'Overall Quality Score': 84.1,
            'Process Capability': 86.8,
            'Customer Satisfaction': 81.4,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
          {
            month: 'Mar',
            'Overall Quality Score': 86.3,
            'Process Capability': 88.1,
            'Customer Satisfaction': 83.7,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
          {
            month: 'Apr',
            'Overall Quality Score': 88.7,
            'Process Capability': 89.5,
            'Customer Satisfaction': 85.9,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
          {
            month: 'May',
            'Overall Quality Score': 90.2,
            'Process Capability': 91.3,
            'Customer Satisfaction': 87.1,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
          {
            month: 'Jun',
            'Overall Quality Score': 92.5,
            'Process Capability': 93.1,
            'Customer Satisfaction': 89.8,
            'Upper Control Limit': 95.0,
            'Lower Control Limit': 75.0,
            Target: 90.0,
          },
        ],
        config: {
          title: {
            text: 'Quality Trend Analysis - Statistical Process Control',
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
              name: 'Overall Quality Score',
              type: 'area' as const,
              dataKey: 'Overall Quality Score',
              style: { color: '#3b82f6', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 0,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Process Capability',
              type: 'area' as const,
              dataKey: 'Process Capability',
              style: { color: '#10b981', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 100,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Customer Satisfaction',
              type: 'area' as const,
              dataKey: 'Customer Satisfaction',
              style: { color: '#f59e0b', fillOpacity: 0.3 },
              animations: {
                enabled: true,
                duration: 600,
                delay: 200,
                easing: 'ease-in-out' as const,
              },
            },
            {
              name: 'Target',
              type: 'line' as const,
              dataKey: 'Target',
              style: {
                color: '#6b7280',
                strokeWidth: 2,
                strokeDasharray: '3 3',
              },
              animations: {
                enabled: true,
                duration: 600,
                delay: 300,
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
            colorPalette: ['#3b82f6', '#10b981', '#f59e0b', '#6b7280'],
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

      // Problem patterns list
      problemPatterns: [
        {
          pattern: 'Medication Reconciliation Delays',
          frequency: 45,
          severity: 'high' as const,
          trend: 'decreasing' as const,
          impact: 'Patient safety risk',
        },
        {
          pattern: 'Incomplete Documentation',
          frequency: 38,
          severity: 'medium' as const,
          trend: 'stable' as const,
          impact: 'Compliance issues',
        },
        {
          pattern: 'Communication Gaps',
          frequency: 29,
          severity: 'medium' as const,
          trend: 'increasing' as const,
          impact: 'Care coordination',
        },
        {
          pattern: 'Process Bottlenecks',
          frequency: 22,
          severity: 'low' as const,
          trend: 'decreasing' as const,
          impact: 'Efficiency reduction',
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
        return '#ef4444';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#eab308';
      case 'low':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  };

  const getTrendIcon = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp sx={{ color: 'error.main', fontSize: 16 }} />;
      case 'decreasing':
        return <TrendingDown sx={{ color: 'success.main', fontSize: 16 }} />;
      default:
        return <TrendingFlat sx={{ color: 'text.secondary', fontSize: 16 }} />;
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading Quality Improvement Data
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
          <Timeline sx={{ mr: 2, color: 'primary.main' }} />
          Quality Improvement Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive analysis of completion times, problem patterns,
          follow-up compliance, documentation quality, and quality trends with
          statistical process control.
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
            icon={<Schedule />}
            label="Completion Times"
            iconPosition="start"
          />
          <Tab
            icon={<Warning />}
            label="Problem Patterns"
            iconPosition="start"
          />
          <Tab
            icon={<CalendarToday />}
            label="Follow-up Compliance"
            iconPosition="start"
          />
          <Tab
            icon={<Assignment />}
            label="Documentation Quality"
            iconPosition="start"
          />
          <Tab
            icon={<BarChart />}
            label="Quality Trends"
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.completionTimeData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Completion Time Insights
                  </Typography>
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                  >
                    <Chip
                      label="Medication Review: Within Control"
                      color="success"
                      size="small"
                    />
                    <Chip
                      label="Documentation: Improving"
                      color="info"
                      size="small"
                    />
                    <Chip
                      label="Follow-up: On Target"
                      color="success"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    All processes are operating within statistical control
                    limits. Medication review times show consistent improvement,
                    while documentation processes are trending toward target
                    completion times.
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
                data={mockData.problemPatternsData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: 400 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Problem Pattern Analysis
                  </Typography>
                  <List dense>
                    {mockData.problemPatterns.map((pattern, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: getSeverityColor(
                                  pattern.severity
                                ),
                              }}
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
                                  variant="body2"
                                  sx={{ fontWeight: 500 }}
                                >
                                  {pattern.pattern}
                                </Typography>
                                {getTrendIcon(pattern.trend)}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Frequency: {pattern.frequency} | Impact:{' '}
                                  {pattern.impact}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < mockData.problemPatterns.length - 1 && (
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
            <Grid item xs={12} md={6}>
              <ChartComponent
                data={{
                  id: 'follow-up-compliance',
                  title: '',
                  type: 'progress-ring',
                  data: [mockData.followUpComplianceData],
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
                    Follow-up Compliance Breakdown
                  </Typography>

                  {mockData.followUpComplianceData.segments?.map(
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
                            {segment.value}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={segment.value}
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
                      backgroundColor: 'grey.50',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      <strong>Key Insights:</strong> Follow-up compliance has
                      improved by 12.1% this month. Focus areas include reducing
                      overdue appointments and implementing automated reminder
                      systems.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.documentationQualityData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Documentation Quality Analysis
                  </Typography>
                  <Grid container spacing={2}>
                    {mockData.documentationQualityData.data.map(
                      (item: unknown, index: number) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {item.type}
                            </Typography>
                            <Typography
                              variant="h4"
                              color="primary.main"
                              gutterBottom
                            >
                              {item.current}%
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 1,
                              }}
                            >
                              {item.current >= item.target ? (
                                <CheckCircle
                                  sx={{
                                    color: 'success.main',
                                    fontSize: 16,
                                    mr: 0.5,
                                  }}
                                />
                              ) : (
                                <Error
                                  sx={{
                                    color: 'warning.main',
                                    fontSize: 16,
                                    mr: 0.5,
                                  }}
                                />
                              )}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Target: {item.target}%
                              </Typography>
                            </Box>
                            <Chip
                              label={`+${item.improvement}% improvement`}
                              color="success"
                              size="small"
                              variant="outlined"
                            />
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

        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <ChartComponent
                data={mockData.qualityTrendData}
                height={400}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quality Trend Insights
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography
                          variant="h3"
                          color="success.main"
                          gutterBottom
                        >
                          +10.0%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Overall Quality Improvement
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h3" color="info.main" gutterBottom>
                          93.1%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Process Capability Score
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
                          89.8%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Customer Satisfaction
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Quality metrics show consistent upward trends with all
                    measures approaching or exceeding target values. The
                    statistical process control chart indicates stable,
                    improving processes with no special cause variations
                    detected.
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

export default QualityImprovementReport;
