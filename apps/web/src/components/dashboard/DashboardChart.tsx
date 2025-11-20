import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { motion } from 'framer-motion';

interface ChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

interface DashboardChartProps {
  title: string;
  data: ChartData[];
  type: 'bar' | 'pie' | 'line' | 'area';
  height?: number;
  colors?: string[];
  loading?: boolean;
  subtitle?: string;
  showLegend?: boolean;
  interactive?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onFullscreen?: () => void;
}

const DashboardChart: React.FC<DashboardChartProps> = ({
  title,
  data,
  type,
  height = 350,
  colors,
  loading = false,
  subtitle,
  showLegend = false,
  interactive = true,
  onRefresh,
  onExport,
  onFullscreen,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hoveredData, setHoveredData] = useState<any>(null);

  // Default colors based on theme
  const defaultColors = colors || [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {label}
          </Typography>
          {payload.map((entry: unknown, index: number) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (loading) {
      return (
        <Skeleton variant="rectangular" width="100%" height={height - 100} />
      );
    }

    if (!data || data.length === 0) {
      return (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          height={height - 100}
          flexDirection="column"
        >
          <Typography variant="body2" color="text.secondary" align="center">
            No data available
          </Typography>
          {onRefresh && (
            <IconButton onClick={onRefresh} sx={{ mt: 1 }}>
              <RefreshIcon />
            </IconButton>
          )}
        </Box>
      );
    }

    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height - 100}>
            <BarChart {...commonProps}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={alpha(theme.palette.text.secondary, 0.2)}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
                tickLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
                tickLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Bar
                dataKey="value"
                fill={defaultColors[0]}
                radius={[4, 4, 0, 0]}
                onMouseEnter={(data) => setHoveredData(data)}
                onMouseLeave={() => setHoveredData(null)}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height - 100}>
            <LineChart {...commonProps}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={alpha(theme.palette.text.secondary, 0.2)}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={{ stroke: alpha(theme.palette.text.secondary, 0.3) }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Line
                type="monotone"
                dataKey="value"
                stroke={defaultColors[0]}
                strokeWidth={3}
                dot={{
                  fill: defaultColors[0],
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  stroke: defaultColors[0],
                  strokeWidth: 2,
                  fill: theme.palette.background.paper,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height - 100}>
            <AreaChart {...commonProps}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={alpha(theme.palette.text.secondary, 0.2)}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Area
                type="monotone"
                dataKey="value"
                stroke={defaultColors[0]}
                fill={alpha(defaultColors[0], 0.3)}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height - 100}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={Math.min((height - 100) * 0.3, 100)}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={(data) => setHoveredData(data)}
                onMouseLeave={() => setHoveredData(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.color || defaultColors[index % defaultColors.length]
                    }
                  />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          height: height,
          width: '100%',
          position: 'relative',
          '&:hover .chart-actions': {
            opacity: 1,
          },
        }}
      >
        <CardContent
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 3,
          }}
        >
          {/* Header */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>

            {/* Actions */}
            {interactive && (
              <Box
                className="chart-actions"
                sx={{ opacity: 0, transition: 'opacity 0.2s' }}
              >
                <Tooltip title="More options">
                  <IconButton size="small" onClick={handleMenuClick}>
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>

          {/* Chart Container */}
          <Box
            sx={{
              flexGrow: 1,
              width: '100%',
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {renderChart()}
          </Box>

          {/* Hovered Data Display */}
          {hoveredData && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                p: 1,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption">
                {hoveredData.name}: {hoveredData.value}
              </Typography>
            </Box>
          )}
        </CardContent>

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {onRefresh && (
            <MenuItem
              onClick={() => {
                onRefresh();
                handleMenuClose();
              }}
            >
              <RefreshIcon sx={{ mr: 1 }} fontSize="small" />
              Refresh
            </MenuItem>
          )}
          {onExport && (
            <MenuItem
              onClick={() => {
                onExport();
                handleMenuClose();
              }}
            >
              <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
              Export
            </MenuItem>
          )}
          {onFullscreen && (
            <MenuItem
              onClick={() => {
                onFullscreen();
                handleMenuClose();
              }}
            >
              <FullscreenIcon sx={{ mr: 1 }} fontSize="small" />
              Fullscreen
            </MenuItem>
          )}
        </Menu>
      </Card>
    </motion.div>
  );
};

export default DashboardChart;
