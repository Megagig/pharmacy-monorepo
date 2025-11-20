import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Stack,
  Alert,
  Divider,
  Collapse,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { LabResultViewerProps, LabResult } from '../types';
import { useLabStore } from '../store/labStore';

interface GroupedResults {
  [testCode: string]: {
    testName: string;
    results: LabResult[];
    latestResult: LabResult;
    trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
    abnormalCount: number;
  };
}

const INTERPRETATION_CONFIG = {
  normal: { color: 'success', icon: CheckCircleIcon, label: 'Normal' },
  low: { color: 'warning', icon: WarningIcon, label: 'Low' },
  high: { color: 'warning', icon: WarningIcon, label: 'High' },
  critical: { color: 'error', icon: ErrorIcon, label: 'Critical' },
  abnormal: { color: 'warning', icon: WarningIcon, label: 'Abnormal' },
} as const;

const TREND_CONFIG = {
  improving: { color: 'success', icon: TrendingUpIcon, label: 'Improving' },
  stable: { color: 'info', icon: TrendingFlatIcon, label: 'Stable' },
  worsening: { color: 'error', icon: TrendingDownIcon, label: 'Worsening' },
  insufficient_data: {
    color: 'default',
    icon: TrendingFlatIcon,
    label: 'Insufficient Data',
  },
} as const;

const LabResultViewer: React.FC<LabResultViewerProps> = ({
  results,
  showTrends = true,
  onResultClick,
}) => {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [selectedTestForTrend, setSelectedTestForTrend] = useState<
    string | null
  >(null);

  const { getTrendData, fetchTrends, loading } = useLabStore();

  // Group results by test code
  const groupedResults: GroupedResults = useMemo(() => {
    const grouped: GroupedResults = {};

    results.forEach((result) => {
      const key = result.testCode;

      if (!grouped[key]) {
        grouped[key] = {
          testName: result.testName,
          results: [],
          latestResult: result,
          trend: 'insufficient_data',
          abnormalCount: 0,
        };
      }

      grouped[key].results.push(result);

      // Update latest result if this one is more recent
      if (
        new Date(result.performedAt) >
        new Date(grouped[key].latestResult.performedAt)
      ) {
        grouped[key].latestResult = result;
      }
    });

    // Calculate trends and abnormal counts for each test
    Object.keys(grouped).forEach((testCode) => {
      const group = grouped[testCode];

      // Sort results by date
      group.results.sort(
        (a, b) =>
          new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
      );

      // Count abnormal results
      group.abnormalCount = group.results.filter(
        (r) => r.interpretation !== 'normal'
      ).length;

      // Calculate trend (simplified)
      if (group.results.length >= 2) {
        const recent = group.results.slice(-3); // Last 3 results
        const abnormalRecent = recent.filter(
          (r) => r.interpretation !== 'normal'
        ).length;
        const totalRecent = recent.length;

        if (abnormalRecent === 0) {
          group.trend = 'improving';
        } else if (abnormalRecent === totalRecent) {
          group.trend = 'worsening';
        } else {
          group.trend = 'stable';
        }
      }
    });

    return grouped;
  }, [results]);

  const handleToggleExpand = (testCode: string) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testCode)) {
      newExpanded.delete(testCode);
    } else {
      newExpanded.add(testCode);
    }
    setExpandedTests(newExpanded);
  };

  const handleShowTrend = async (testCode: string, patientId: string) => {
    setSelectedTestForTrend(testCode);
    await fetchTrends(patientId, testCode);
  };

  const formatValue = (result: LabResult) => {
    let formattedValue = result.value;
    if (result.unit) {
      formattedValue += ` ${result.unit}`;
    }
    return formattedValue;
  };

  const formatReferenceRange = (result: LabResult) => {
    const { referenceRange } = result;
    if (referenceRange.text) {
      return referenceRange.text;
    }
    if (referenceRange.low !== undefined && referenceRange.high !== undefined) {
      return `${referenceRange.low} - ${referenceRange.high}${result.unit ? ` ${result.unit}` : ''}`;
    }
    if (referenceRange.low !== undefined) {
      return `> ${referenceRange.low}${result.unit ? ` ${result.unit}` : ''}`;
    }
    if (referenceRange.high !== undefined) {
      return `< ${referenceRange.high}${result.unit ? ` ${result.unit}` : ''}`;
    }
    return 'Not specified';
  };

  const getInterpretationChip = (interpretation: string) => {
    const config =
      INTERPRETATION_CONFIG[
        interpretation as keyof typeof INTERPRETATION_CONFIG
      ];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Chip
        icon={<Icon sx={{ fontSize: 16 }} />}
        label={config.label}
        size="small"
        color={config.color}
        variant="outlined"
      />
    );
  };

  const getTrendChip = (trend: string) => {
    const config = TREND_CONFIG[trend as keyof typeof TREND_CONFIG];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Chip
        icon={<Icon sx={{ fontSize: 16 }} />}
        label={config.label}
        size="small"
        color={config.color}
        variant="outlined"
      />
    );
  };

  const renderTrendChart = (testCode: string, patientId: string) => {
    const trendData = getTrendData(patientId, testCode);

    if (!trendData || trendData.results.length < 2) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Insufficient data for trend analysis. At least 2 results are needed.
        </Alert>
      );
    }

    const chartData = trendData.results.map((result, index) => ({
      date: new Date(result.performedAt).toLocaleDateString(),
      value: result.numericValue || 0,
      interpretation: result.interpretation,
      originalValue: result.value,
    }));

    return (
      <Box sx={{ mt: 2, height: 300 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          Trend Analysis - {trendData.testName}
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip
              formatter={(value, name, props) => [
                `${props.payload.originalValue} ${trendData.unit || ''}`,
                'Value',
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {trendData.referenceRange.low && (
              <ReferenceLine
                y={trendData.referenceRange.low}
                stroke="orange"
                strokeDasharray="5 5"
                label="Low"
              />
            )}
            {trendData.referenceRange.high && (
              <ReferenceLine
                y={trendData.referenceRange.high}
                stroke="orange"
                strokeDasharray="5 5"
                label="High"
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2196f3"
              strokeWidth={2}
              dot={{ fill: '#2196f3', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Latest Value
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {trendData.summary.latestValue} {trendData.unit}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Interpretation
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {getInterpretationChip(trendData.summary.latestInterpretation)}
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Abnormal Results
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {trendData.summary.abnormalCount} /{' '}
                {trendData.summary.totalCount}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Trend
              </Typography>
              <Box sx={{ mt: 0.5 }}>{getTrendChip(trendData.trend)}</Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  };

  if (results.length === 0) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            No lab results available for this patient.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
            Laboratory Results ({results.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and analyze laboratory test results with trend analysis
          </Typography>
        </Box>

        {/* Summary Statistics */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  color="primary.main"
                  sx={{ fontWeight: 600 }}
                >
                  {Object.keys(groupedResults).length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Different Tests
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  color="error.main"
                  sx={{ fontWeight: 600 }}
                >
                  {
                    results.filter((r) => r.interpretation === 'critical')
                      .length
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Critical Results
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  color="warning.main"
                  sx={{ fontWeight: 600 }}
                >
                  {results.filter((r) => r.interpretation !== 'normal').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Abnormal Results
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  color="success.main"
                  sx={{ fontWeight: 600 }}
                >
                  {results.filter((r) => r.interpretation === 'normal').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Normal Results
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Grouped Results */}
        <Stack spacing={2}>
          {Object.entries(groupedResults).map(([testCode, group]) => (
            <Card key={testCode} variant="outlined">
              <CardContent sx={{ pb: 2 }}>
                {/* Test Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {group.testName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Code: {testCode} • {group.results.length} result(s)
                      {group.abnormalCount > 0 &&
                        ` • ${group.abnormalCount} abnormal`}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Latest Result */}
                    <Box sx={{ textAlign: 'right', mr: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatValue(group.latestResult)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(
                          group.latestResult.performedAt
                        ).toLocaleDateString()}
                      </Typography>
                    </Box>

                    {/* Interpretation */}
                    {getInterpretationChip(group.latestResult.interpretation)}

                    {/* Trend */}
                    {showTrends &&
                      group.results.length > 1 &&
                      getTrendChip(group.trend)}

                    {/* Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {showTrends && group.results.length > 1 && (
                        <Tooltip title="Show trend analysis">
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleShowTrend(
                                testCode,
                                group.latestResult.patientId
                              )
                            }
                            disabled={loading.fetchTrends}
                          >
                            <TrendingUpIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      <Tooltip
                        title={
                          expandedTests.has(testCode)
                            ? 'Hide details'
                            : 'Show details'
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleToggleExpand(testCode)}
                        >
                          {expandedTests.has(testCode) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>

                {/* Expanded Details */}
                <Collapse in={expandedTests.has(testCode)}>
                  <Box sx={{ mt: 2 }}>
                    {/* Results Table */}
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Reference Range</TableCell>
                            <TableCell>Interpretation</TableCell>
                            <TableCell>Flags</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.results.map((result) => (
                            <TableRow key={result._id} hover>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(
                                    result.performedAt
                                  ).toLocaleDateString()}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {new Date(
                                    result.performedAt
                                  ).toLocaleTimeString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {formatValue(result)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatReferenceRange(result)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {getInterpretationChip(result.interpretation)}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5}>
                                  {result.flags.map((flag) => (
                                    <Chip
                                      key={flag}
                                      label={flag}
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {onResultClick && (
                                  <Tooltip title="View details">
                                    <IconButton
                                      size="small"
                                      onClick={() => onResultClick(result)}
                                    >
                                      <VisibilityIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Trend Chart */}
                    {showTrends && selectedTestForTrend === testCode && (
                      <>
                        {loading.fetchTrends && (
                          <Box sx={{ mt: 2 }}>
                            <LinearProgress />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 1, display: 'block' }}
                            >
                              Loading trend data...
                            </Typography>
                          </Box>
                        )}
                        {!loading.fetchTrends &&
                          renderTrendChart(
                            testCode,
                            group.latestResult.patientId
                          )}
                      </>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {/* Critical Results Alert */}
        {results.some((r) => r.interpretation === 'critical') && (
          <Alert severity="error" sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Critical Results Detected
            </Typography>
            <Typography variant="body2">
              {results.filter((r) => r.interpretation === 'critical').length}{' '}
              result(s) require immediate clinical attention.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default LabResultViewer;
