// Reusable Chart Component with Beautiful Styling
import React, { useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
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
  ReferenceLine,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
  Treemap,
} from 'recharts';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Skeleton,
  Card,
  CardContent,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Target,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  ChartType,
  ChartData,
  ChartConfig,
  DataPoint,
  KPICardData,
  ProgressRingData,
  GaugeData,
} from '../../types/charts';
import {
  useCurrentTheme,
  useAnimationsEnabled,
} from '../../stores/chartsStore';
import { formatTooltipValue } from '../../utils/dataFormatters';
import { generateAccessibilityAttributes } from '../../utils/chartHelpers';
import ChartErrorBoundary from './ChartErrorBoundary';

interface ChartComponentProps {
  data: ChartData;
  height?: number;
  loading?: boolean;
  error?: string;
  onDataPointClick?: (data: DataPoint) => void;
  onHover?: (data: DataPoint | null) => void;
  className?: string;
}

const ChartComponent: React.FC<ChartComponentProps> = ({
  data,
  height = 400,
  loading = false,
  error,
  onDataPointClick,
  onHover,
  className,
}) => {
  const muiTheme = useTheme();
  const chartTheme = useCurrentTheme();
  const animationsEnabled = useAnimationsEnabled();

  // Memoize chart configuration
  const chartConfig = useMemo(() => data.config, [data.config]);

  // Enhanced custom tooltip component with rich formatting
  const CustomTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload || !payload.length) return null;

      return (
        <Paper
          sx={{
            p: 2,
            boxShadow: chartTheme.shadows.large,
            backgroundColor: muiTheme.palette.background.paper,
            border: `1px solid ${muiTheme.palette.divider}`,
            borderRadius: chartTheme.borderRadius / 2,
            backdropFilter: 'blur(8px)',
            background: `linear-gradient(135deg, ${muiTheme.palette.background.paper}95, ${muiTheme.palette.background.paper}85)`,
            minWidth: 200,
            animation: animationsEnabled ? 'fadeIn 0.2s ease-in-out' : 'none',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(-4px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {label && (
            <Typography
              variant="subtitle2"
              color="text.primary"
              gutterBottom
              sx={{
                fontWeight: 600,
                borderBottom: `1px solid ${muiTheme.palette.divider}`,
                pb: 1,
                mb: 1,
              }}
            >
              {label}
            </Typography>
          )}

          {payload.map((entry: any, index: number) => {
            const [formattedValue, name] = formatTooltipValue(
              entry.value,
              entry.dataKey,
              entry.payload
            );

            return (
              <Box
                key={`tooltip-${index}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: index > 0 ? 1 : 0,
                  py: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: entry.color,
                      mr: 1.5,
                      flexShrink: 0,
                      boxShadow: `0 0 0 2px ${entry.color}20`,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {name}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: entry.color,
                    ml: 2,
                  }}
                >
                  {formattedValue}
                </Typography>
              </Box>
            );
          })}

          {/* Add trend indicator if available */}
          {payload[0]?.payload?.trend && (
            <Box
              sx={{
                mt: 1.5,
                pt: 1,
                borderTop: `1px solid ${muiTheme.palette.divider}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {payload[0].payload.trend > 0 ? (
                  <TrendingUp
                    sx={{ color: 'success.main', fontSize: 16, mr: 0.5 }}
                  />
                ) : payload[0].payload.trend < 0 ? (
                  <TrendingDown
                    sx={{ color: 'error.main', fontSize: 16, mr: 0.5 }}
                  />
                ) : (
                  <TrendingFlat
                    sx={{ color: 'text.secondary', fontSize: 16, mr: 0.5 }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {Math.abs(payload[0].payload.trend)}% vs previous
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      );
    },
    [chartTheme, muiTheme, animationsEnabled]
  );

  // Handle data point clicks
  const handleDataPointClick = useCallback(
    (data: any) => {
      if (onDataPointClick) {
        onDataPointClick(data);
      }
    },
    [onDataPointClick]
  );

  // Handle hover events with enhanced interactions
  const handleMouseEnter = useCallback(
    (data: any, event?: React.MouseEvent) => {
      if (onHover) {
        onHover(data);
      }

      // Add hover effects for interactive charts
      if (event?.currentTarget) {
        const element = event.currentTarget as SVGElement;
        element.style.filter = 'brightness(1.1)';
        element.style.transform = 'scale(1.02)';
        element.style.transition = 'all 0.2s ease-in-out';
      }
    },
    [onHover]
  );

  const handleMouseLeave = useCallback(
    (event?: React.MouseEvent) => {
      if (onHover) {
        onHover(null);
      }

      // Remove hover effects
      if (event?.currentTarget) {
        const element = event.currentTarget as SVGElement;
        element.style.filter = 'none';
        element.style.transform = 'scale(1)';
      }
    },
    [onHover]
  );

  // Enhanced click handler with drill-down support
  const handleEnhancedClick = useCallback(
    (data: any, event?: React.MouseEvent) => {
      handleDataPointClick(data);

      // Add click animation
      if (event?.currentTarget) {
        const element = event.currentTarget as SVGElement;
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
          element.style.transform = 'scale(1)';
        }, 150);
      }
    },
    [handleDataPointClick]
  );

  // Render KPI Card
  const renderKPICard = () => {
    const kpiData = data.data[0] as any as KPICardData;
    if (!kpiData) return null;

    const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
      switch (direction) {
        case 'up':
          return <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />;
        case 'down':
          return <TrendingDown sx={{ color: 'error.main', fontSize: 20 }} />;
        default:
          return (
            <TrendingFlat sx={{ color: 'text.secondary', fontSize: 20 }} />
          );
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'success':
          return 'success';
        case 'warning':
          return 'warning';
        case 'error':
          return 'error';
        default:
          return 'info';
      }
    };

    return (
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${chartTheme.colorPalette[0]}15, ${chartTheme.colorPalette[1]}15)`,
          border: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        <CardContent
          sx={{
            p: 3,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ fontSize: 14, fontWeight: 500 }}
            >
              {kpiData.title}
            </Typography>
            <Chip
              label={kpiData.status}
              color={getStatusColor(kpiData.status) as any}
              size="small"
              variant="outlined"
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: 32,
                fontWeight: 700,
                color: chartTheme.colorPalette[0],
                mb: 1,
              }}
            >
              {typeof kpiData.value === 'number'
                ? kpiData.value.toLocaleString()
                : kpiData.value}
              {kpiData.unit && (
                <Typography
                  component="span"
                  variant="h5"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {kpiData.unit}
                </Typography>
              )}
            </Typography>

            {kpiData.trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getTrendIcon(kpiData.trend.direction)}
                <Typography
                  variant="body2"
                  sx={{
                    ml: 1,
                    color:
                      kpiData.trend.direction === 'up'
                        ? 'success.main'
                        : kpiData.trend.direction === 'down'
                        ? 'error.main'
                        : 'text.secondary',
                    fontWeight: 500,
                  }}
                >
                  {kpiData.trend.value}% {kpiData.trend.period}
                </Typography>
              </Box>
            )}

            {kpiData.target && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto' }}>
                <Target sx={{ color: 'text.secondary', fontSize: 16, mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Target: {kpiData.target.value} {kpiData.target.label}
                </Typography>
              </Box>
            )}
          </Box>

          {kpiData.sparkline && kpiData.sparkline.length > 0 && (
            <Box sx={{ mt: 2, height: 40 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpiData.sparkline}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chartTheme.colorPalette[0]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={animationsEnabled}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render Progress Ring
  const renderProgressRing = () => {
    const progressData = data.data[0] as any as ProgressRingData;
    if (!progressData) return null;

    const percentage = (progressData.value / progressData.max) * 100;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = `${
      (percentage / 100) * circumference
    } ${circumference}`;

    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 3, textAlign: 'center' }}
          >
            {progressData.title}
          </Typography>

          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
            <svg
              width="120"
              height="120"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="45"
                stroke={muiTheme.palette.divider}
                strokeWidth="8"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r="45"
                stroke={chartTheme.colorPalette[0]}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                style={{
                  transition: animationsEnabled
                    ? 'stroke-dasharray 0.5s ease-in-out'
                    : 'none',
                }}
              />
            </svg>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: chartTheme.colorPalette[0] }}
              >
                {progressData.centerText?.primary ||
                  `${Math.round(percentage)}%`}
              </Typography>
              {progressData.centerText?.secondary && (
                <Typography variant="body2" color="text.secondary">
                  {progressData.centerText.secondary}
                </Typography>
              )}
            </Box>
          </Box>

          <Typography variant="body1" sx={{ textAlign: 'center' }}>
            {progressData.value.toLocaleString()} /{' '}
            {progressData.max.toLocaleString()}
            {progressData.unit && ` ${progressData.unit}`}
          </Typography>

          {progressData.segments && (
            <Box sx={{ mt: 2, width: '100%' }}>
              {progressData.segments.map((segment, index) => (
                <Box
                  key={index}
                  sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: segment.color,
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {segment.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {segment.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render Gauge Chart
  const renderGaugeChart = () => {
    const gaugeData = data.data[0] as unknown as GaugeData;
    if (!gaugeData) return null;

    const percentage =
      ((gaugeData.value - gaugeData.min) / (gaugeData.max - gaugeData.min)) *
      100;
    const angle = (percentage / 100) * 180; // Half circle

    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
          }}
        >
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 3, textAlign: 'center' }}
          >
            {gaugeData.title}
          </Typography>

          <Box sx={{ position: 'relative', mb: 3 }}>
            <svg width="200" height="120" viewBox="0 0 200 120">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                stroke={muiTheme.palette.divider}
                strokeWidth="12"
                fill="transparent"
                strokeLinecap="round"
              />

              {/* Range segments */}
              {gaugeData.ranges.map((range, index) => {
                const startAngle =
                  ((range.min - gaugeData.min) /
                    (gaugeData.max - gaugeData.min)) *
                  180;
                const endAngle =
                  ((range.max - gaugeData.min) /
                    (gaugeData.max - gaugeData.min)) *
                  180;
                const startX =
                  100 + 80 * Math.cos((Math.PI * (180 - startAngle)) / 180);
                const startY =
                  100 - 80 * Math.sin((Math.PI * (180 - startAngle)) / 180);
                const endX =
                  100 + 80 * Math.cos((Math.PI * (180 - endAngle)) / 180);
                const endY =
                  100 - 80 * Math.sin((Math.PI * (180 - endAngle)) / 180);

                return (
                  <path
                    key={index}
                    d={`M ${startX} ${startY} A 80 80 0 0 1 ${endX} ${endY}`}
                    stroke={range.color}
                    strokeWidth="12"
                    fill="transparent"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Needle */}
              <g transform={`rotate(${angle - 90} 100 100)`}>
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="30"
                  stroke={muiTheme.palette.text.primary}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="6"
                  fill={muiTheme.palette.text.primary}
                />
              </g>
            </svg>

            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: chartTheme.colorPalette[0] }}
              >
                {gaugeData.value.toLocaleString()}
              </Typography>
              {gaugeData.unit && (
                <Typography variant="body2" color="text.secondary">
                  {gaugeData.unit}
                </Typography>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              mt: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {gaugeData.min}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {gaugeData.max}
            </Typography>
          </Box>

          {gaugeData.target && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Target: {gaugeData.target}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: data.data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    const animationProps = animationsEnabled
      ? {
          animationBegin: 0,
          animationDuration: chartConfig.animations?.duration || 300,
          animationEasing: chartConfig.animations?.easing || 'ease-in-out',
        }
      : { isAnimationActive: false };

    switch (data.type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={muiTheme.palette.divider}
              opacity={0.5}
            />
            <XAxis
              dataKey={chartConfig.axes?.x?.label || 'name'}
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <YAxis
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <Tooltip content={<CustomTooltip />} />
            {chartConfig.legend?.enabled && <Legend />}

            {chartConfig.series.map((series, index) => (
              <Line
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                stroke={
                  series.style.color ||
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
                strokeWidth={series.style.strokeWidth || 2}
                dot={{
                  fill:
                    series.style.color ||
                    chartTheme.colorPalette[
                      index % chartTheme.colorPalette.length
                    ],
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 8,
                  stroke:
                    series.style.color ||
                    chartTheme.colorPalette[
                      index % chartTheme.colorPalette.length
                    ],
                  strokeWidth: 3,
                  fill: muiTheme.palette.background.paper,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                }}
                onClick={handleEnhancedClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...animationProps}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={muiTheme.palette.divider}
              opacity={0.5}
            />
            <XAxis
              dataKey={chartConfig.axes?.x?.label || 'name'}
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <YAxis
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <Tooltip content={<CustomTooltip />} />
            {chartConfig.legend?.enabled && <Legend />}

            {chartConfig.series.map((series, index) => (
              <Area
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                stroke={
                  series.style.color ||
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
                fill={
                  series.style.color ||
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
                fillOpacity={series.style.fillOpacity || 0.3}
                strokeWidth={series.style.strokeWidth || 2}
                dot={{
                  fill:
                    series.style.color ||
                    chartTheme.colorPalette[
                      index % chartTheme.colorPalette.length
                    ],
                  strokeWidth: 2,
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                  stroke:
                    series.style.color ||
                    chartTheme.colorPalette[
                      index % chartTheme.colorPalette.length
                    ],
                  strokeWidth: 2,
                  fill: muiTheme.palette.background.paper,
                }}
                onClick={handleEnhancedClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...animationProps}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={muiTheme.palette.divider}
              opacity={0.5}
            />
            <XAxis
              dataKey={chartConfig.axes?.x?.label || 'name'}
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <YAxis
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <Tooltip content={<CustomTooltip />} />
            {chartConfig.legend?.enabled && <Legend />}

            {chartConfig.series.map((series, index) => (
              <Bar
                key={series.dataKey}
                dataKey={series.dataKey}
                name={series.name}
                fill={
                  series.style.color ||
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
                radius={[4, 4, 0, 0]}
                onClick={handleEnhancedClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...animationProps}
              />
            ))}
          </BarChart>
        );

      case 'pie':
      case 'donut':
        return (
          <PieChart {...commonProps}>
            <Tooltip content={<CustomTooltip />} />
            {chartConfig.legend?.enabled && <Legend />}

            <Pie
              data={data.data}
              dataKey={chartConfig.series[0]?.dataKey || 'value'}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={Math.min(height * 0.3, 120)}
              innerRadius={
                data.type === 'donut' ? Math.min(height * 0.15, 60) : 0
              }
              paddingAngle={2}
              onClick={handleEnhancedClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              {...animationProps}
            >
              {data.data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    chartTheme.colorPalette[
                      index % chartTheme.colorPalette.length
                    ]
                  }
                />
              ))}
            </Pie>
          </PieChart>
        );

      case 'scatter':
      case 'bubble':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={muiTheme.palette.divider}
              opacity={0.5}
            />
            <XAxis
              dataKey={chartConfig.axes?.x?.label || 'x'}
              type="number"
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <YAxis
              dataKey={chartConfig.axes?.y?.label || 'y'}
              type="number"
              stroke={muiTheme.palette.text.secondary}
              fontSize={chartTheme.typography.fontSize.small}
            />
            <Tooltip content={<CustomTooltip />} />
            {chartConfig.legend?.enabled && <Legend />}

            {chartConfig.series.map((series, index) => (
              <Scatter
                key={series.dataKey}
                name={series.name}
                data={data.data}
                fill={
                  series.style.color ||
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
                onClick={handleEnhancedClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...animationProps}
              />
            ))}
          </ScatterChart>
        );

      case 'gauge':
        return renderGaugeChart();

      case 'progress-ring':
        return renderProgressRing();

      case 'kpi-card':
        return renderKPICard();

      case 'treemap':
        return (
          <Treemap
            {...commonProps}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke={muiTheme.palette.divider}
            fill={chartTheme.colorPalette[0]}
            onClick={handleEnhancedClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...animationProps}
          >
            {data.data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  chartTheme.colorPalette[
                    index % chartTheme.colorPalette.length
                  ]
                }
              />
            ))}
          </Treemap>
        );

      default:
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography color="text.secondary">
              Chart type "{data.type}" not yet implemented
            </Typography>
          </Box>
        );
    }
  };

  // Enhanced loading state with beautiful skeleton screens
  if (loading) {
    return (
      <Paper
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
        }}
        className={className}
      >
        {/* Title skeleton */}
        <Box sx={{ mb: 2 }}>
          <Skeleton
            variant="text"
            width="60%"
            height={28}
            animation="wave"
            sx={{ borderRadius: 1 }}
          />
          <Skeleton
            variant="text"
            width="40%"
            height={20}
            animation="wave"
            sx={{ borderRadius: 1, mt: 0.5 }}
          />
        </Box>

        {/* Chart skeleton based on type */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {data.type === 'pie' || data.type === 'donut' ? (
            // Circular chart skeleton
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Skeleton
                variant="circular"
                width={Math.min(height * 0.6, 200)}
                height={Math.min(height * 0.6, 200)}
                animation="wave"
              />
            </Box>
          ) : data.type === 'kpi-card' ? (
            // KPI card skeleton
            <Box sx={{ p: 2 }}>
              <Skeleton
                variant="rectangular"
                width="100%"
                height={60}
                animation="wave"
                sx={{ borderRadius: 2, mb: 2 }}
              />
              <Skeleton
                variant="text"
                width="80%"
                height={40}
                animation="wave"
                sx={{ borderRadius: 1, mb: 1 }}
              />
              <Skeleton
                variant="text"
                width="60%"
                height={24}
                animation="wave"
                sx={{ borderRadius: 1 }}
              />
            </Box>
          ) : data.type === 'progress-ring' || data.type === 'gauge' ? (
            // Gauge/progress skeleton
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Skeleton
                variant="circular"
                width={120}
                height={120}
                animation="wave"
                sx={{ mb: 2 }}
              />
              <Skeleton
                variant="text"
                width="40%"
                height={24}
                animation="wave"
                sx={{ borderRadius: 1 }}
              />
            </Box>
          ) : (
            // Bar/line chart skeleton
            <Box
              sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              {/* Chart area skeleton */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'end',
                  gap: 1,
                  mb: 2,
                }}
              >
                {[...Array(8)].map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="rectangular"
                    width="100%"
                    height={`${Math.random() * 60 + 20}%`}
                    animation="wave"
                    sx={{
                      borderRadius: '4px 4px 0 0',
                      animationDelay: `${index * 0.1}s`,
                    }}
                  />
                ))}
              </Box>

              {/* X-axis labels skeleton */}
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}
              >
                {[...Array(4)].map((_, index) => (
                  <Skeleton
                    key={index}
                    variant="text"
                    width={40}
                    height={16}
                    animation="wave"
                    sx={{ borderRadius: 1 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Loading overlay with progress */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: `${muiTheme.palette.background.paper}90`,
              backdropFilter: 'blur(4px)',
              borderRadius: 2,
              p: 2,
              minWidth: 120,
            }}
          >
            <CircularProgress
              size={32}
              sx={{
                mb: 1,
                color: chartTheme.colorPalette[0],
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', fontWeight: 500 }}
            >
              Loading chart...
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  // Enhanced error state with graceful fallbacks and retry mechanisms
  if (error) {
    const handleRetry = () => {
      // Trigger a retry by calling the parent component's refresh function
      window.location.reload(); // Fallback - in real implementation, this would be a prop
    };

    return (
      <Paper
        sx={{
          height,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${muiTheme.palette.error.light}08, ${muiTheme.palette.error.main}05)`,
          border: `1px solid ${muiTheme.palette.error.light}30`,
        }}
        className={className}
      >
        <Alert
          severity="error"
          sx={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: 'transparent',
            border: 'none',
            '& .MuiAlert-icon': {
              fontSize: 32,
            },
          }}
          action={
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Typography
                component="button"
                variant="body2"
                onClick={handleRetry}
                sx={{
                  background: 'none',
                  border: `1px solid ${muiTheme.palette.error.main}`,
                  borderRadius: 1,
                  px: 2,
                  py: 0.5,
                  color: muiTheme.palette.error.main,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: muiTheme.palette.error.main,
                    color: muiTheme.palette.error.contrastText,
                  },
                }}
              >
                Retry
              </Typography>
            </Box>
          }
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: muiTheme.palette.error.main }}
          >
            Unable to Load Chart
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error}
          </Typography>

          {/* Error details for debugging */}
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: `${muiTheme.palette.error.main}10`,
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              <strong>Chart Type:</strong> {data.type}
              <br />
              <strong>Data Points:</strong> {data.data?.length || 0}
              <br />
              <strong>Timestamp:</strong> {new Date().toLocaleTimeString()}
            </Typography>
          </Box>

          {/* Accessibility message */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 2,
              fontStyle: 'italic',
              textAlign: 'center',
              display: 'block',
            }}
            role="status"
            aria-live="polite"
          >
            Chart data could not be displayed. Please try refreshing or contact
            support if the issue persists.
          </Typography>
        </Alert>
      </Paper>
    );
  }

  // Enhanced empty data state
  if (!data.data || data.data.length === 0) {
    return (
      <Paper
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          background: `linear-gradient(135deg, ${chartTheme.colorPalette[0]}08, ${chartTheme.colorPalette[1]}05)`,
          border: `1px dashed ${muiTheme.palette.divider}`,
        }}
        className={className}
      >
        {/* Empty state illustration */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: `${chartTheme.colorPalette[0]}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: `${chartTheme.colorPalette[0]}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: 24,
                color: chartTheme.colorPalette[0],
                opacity: 0.7,
              }}
            >
              📊
            </Typography>
          </Box>
        </Box>

        <Typography
          variant="h6"
          color="text.primary"
          gutterBottom
          sx={{ fontWeight: 500 }}
        >
          No Data Available
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}
        >
          There is no data to display for this chart. Try adjusting your filters
          or check back later when data becomes available.
        </Typography>

        {/* Helpful suggestions */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Suggestions:</strong>
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              • Check your date range and filters
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              • Ensure data sources are connected
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              • Contact support if this persists
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  // Main chart render with error boundary
  return (
    <ChartErrorBoundary
      onError={(error, errorInfo) => {
        // Log to monitoring service in production
        console.error('Chart rendering error:', error, errorInfo);
      }}
    >
      <Paper
        sx={{
          height,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
        className={className}
        {...generateAccessibilityAttributes(data.title, data.type, data.data)}
      >
        {/* Chart Title */}
        {data.title && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontSize: chartTheme.typography.fontSize.large,
                fontWeight: chartTheme.typography.fontWeight.medium,
                color: muiTheme.palette.text.primary,
              }}
            >
              {data.title}
            </Typography>
            {data.subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {data.subtitle}
              </Typography>
            )}
          </Box>
        )}

        {/* Chart Container */}
        <Box
          sx={{ flex: 1, minHeight: 0 }}
          role="img"
          aria-label={`${data.title} - ${data.type} chart with ${data.data.length} data points`}
          tabIndex={0}
          onKeyDown={(e) => {
            // Add keyboard navigation support
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // Focus on first interactive element or provide data summary

            }
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>

          {/* Screen reader data summary */}
          <Box
            sx={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
            aria-live="polite"
            role="status"
          >
            Chart showing {data.data.length} data points.
            {data.data.length > 0 && (
              <>
                First value:{' '}
                {data.data[0][chartConfig.series[0]?.dataKey || 'value']}. Last
                value:{' '}
                {
                  data.data[data.data.length - 1][
                    chartConfig.series[0]?.dataKey || 'value'
                  ]
                }
                .
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </ChartErrorBoundary>
  );
};

export default ChartComponent;
