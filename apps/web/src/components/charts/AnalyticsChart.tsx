import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
} from 'recharts';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';

// Type definitions
export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface ChartSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  unit?: string;
}

interface AnalyticsChartProps {
  type: ChartType;
  data: ChartDataPoint[];
  series: ChartSeriesConfig[];
  xAxisDataKey: string;
  height?: number;
  loading?: boolean;
  error?: boolean;
  emptyMessage?: string;
  title?: string;
  colors?: string[];
  currencySymbol?: string;
}

// Default colors
const DEFAULT_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
];

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  type,
  data,
  series,
  xAxisDataKey,
  height = 300,
  loading = false,
  error = false,
  emptyMessage = 'No data available',
  title,
  colors = DEFAULT_COLORS,
  currencySymbol = '₦',
}) => {
  // Handle loading state
  if (loading) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 1,
        }}
      >
        <CircularProgress size={40} />
        <Typography sx={{ ml: 2 }} variant="body2" color="text.secondary">
          Loading chart data...
        </Typography>
      </Box>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 1,
          p: 3,
        }}
      >
        <Typography variant="body1" color="error" sx={{ mb: 1 }}>
          Error loading chart data
        </Typography>
      </Box>
    );
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 1,
          p: 3,
        }}
      >
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      name: string;
      color: string;
      dataKey: string;
      payload: Record<string, unknown>;
    }>;
    label?: string;
  }

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          sx={{
            p: 2,
            boxShadow: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #f0f0f0',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          {payload.map((entry) => (
            <Box
              key={`item-${entry.dataKey}`}
              sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                  mr: 1,
                }}
              />
              <Typography variant="body2">
                {entry.name}:{' '}
                {entry.dataKey.includes('cost') ||
                entry.name.toLowerCase().includes('cost')
                  ? `${currencySymbol}${entry.value.toLocaleString()}`
                  : entry.value}
                {((entry.payload as Record<string, unknown>)?.unit as string) ||
                  ''}
              </Typography>
            </Box>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Render different chart types
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((s, index) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color || colors[index % colors.length]}
                activeDot={{ r: 8 }}
                unit={s.unit || ''}
              />
            ))}
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisDataKey} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((s, index) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={s.color || colors[index % colors.length]}
                unit={s.unit || ''}
              />
            ))}
          </BarChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((s) => (
              <Pie
                key={s.dataKey}
                data={data}
                dataKey={s.dataKey}
                nameKey={xAxisDataKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(props) => {
                  const { name } = props;
                  return name;
                }}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={colors[idx % colors.length]}
                  />
                ))}
              </Pie>
            ))}
          </PieChart>
        );
      default:
        return <Typography>Unsupported chart type</Typography>;
    }
  };

  return (
    <Box sx={{ width: '100%', height }}>
      {title && (
        <Typography variant="h6" component="h3" gutterBottom sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={title ? height - 40 : height}>
        {renderChart()}
      </ResponsiveContainer>
    </Box>
  );
};

export default AnalyticsChart;
