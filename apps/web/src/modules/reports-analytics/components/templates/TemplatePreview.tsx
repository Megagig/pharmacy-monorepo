// Template Preview Component - Real-time template preview with live updates
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Toolbar,
  AppBar,
  Dialog,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Skeleton,
  Alert,
  Chip,
  Stack,
  Divider,
  Tooltip,
  CircularProgress,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
} from '@mui/material';
import {
  Close,
  Refresh,
  Fullscreen,
  FullscreenExit,
  ZoomIn,
  ZoomOut,
  Devices,
  Phone,
  Tablet,
  Computer,
  Tv,
  Visibility,
  VisibilityOff,
  Settings,
  BugReport,
  Speed,
  Accessibility,
  Print,
  Share,
  Download,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { ReportTemplate, RenderedSection } from '../../types/templates';
import { ReportFilters } from '../../types/filters';
import { ReportData } from '../../types/reports';
import { ChartComponent } from '../shared/ChartComponent';
import {
  templateRenderingEngine,
  RenderContext,
  RenderResult,
  RenderedChart,
  RenderedTable,
  RenderedKPI,
  RenderedMetric,
} from '../../services/templateRenderingService';
import {
  templateValidationService,
  ValidationResult,
} from '../../services/templateValidationService';
import { useReportsStore } from '../../stores/reportsStore';
import { useFiltersStore } from '../../stores/filtersStore';

interface TemplatePreviewProps {
  template: ReportTemplate;
  open: boolean;
  onClose: () => void;
  data?: ReportData;
  filters?: ReportFilters;
  variables?: Record<string, any>;
  onSave?: (template: ReportTemplate) => void;
  onExport?: (format: 'pdf' | 'png' | 'html') => void;
}

type PreviewMode = 'desktop' | 'tablet' | 'mobile' | 'fullscreen';
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BREAKPOINT_WIDTHS = {
  xs: 360,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
};

const PREVIEW_MODE_BREAKPOINTS: Record<PreviewMode, Breakpoint> = {
  mobile: 'xs',
  tablet: 'sm',
  desktop: 'lg',
  fullscreen: 'xl',
};

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  open,
  onClose,
  data,
  filters,
  variables = {},
  onSave,
  onExport,
}) => {
  const theme = useTheme();
  const { sampleData } = useReportsStore();
  const { currentFilters } = useFiltersStore();

  // Preview state
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Rendering state
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Auto-refresh timer
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Memoized render context
  const renderContext = useMemo<RenderContext>(
    () => ({
      template,
      data: data || sampleData,
      filters: filters || currentFilters,
      userPermissions: ['view', 'export'], // TODO: Get from auth context
      userRoles: ['user'], // TODO: Get from auth context
      variables,
      theme: theme.palette.mode,
      responsive: true,
      breakpoint: PREVIEW_MODE_BREAKPOINTS[previewMode],
    }),
    [
      template,
      data,
      sampleData,
      filters,
      currentFilters,
      variables,
      theme.palette.mode,
      previewMode,
    ]
  );

  // Render template
  const renderTemplate = useCallback(async () => {
    setIsRendering(true);
    setRenderError(null);

    try {
      const result = await templateRenderingEngine.render(renderContext);
      setRenderResult(result);

      if (result.errors.length > 0) {
        setRenderError(
          `Rendering errors: ${result.errors.map((e) => e.message).join(', ')}`
        );
      }
    } catch (error) {
      setRenderError(`Failed to render template: ${error.message}`);
      setRenderResult(null);
    } finally {
      setIsRendering(false);
    }
  }, [renderContext]);

  // Validate template
  const validateTemplate = useCallback(async () => {
    try {
      const result = await templateValidationService.validate({
        template,
        availableCharts: Object.keys(renderContext.data.charts || {}),
        availableTables: Object.keys(renderContext.data.tables || {}),
        availableFilters: [],
        userPermissions: renderContext.userPermissions,
        userRoles: renderContext.userRoles,
      });
      setValidationResult(result);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }, [template, renderContext]);

  // Initial render and validation
  useEffect(() => {
    if (open) {
      renderTemplate();
      validateTemplate();
    }
  }, [open, renderTemplate, validateTemplate]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && open) {
      const timer = setInterval(() => {
        renderTemplate();
      }, refreshInterval);
      setRefreshTimer(timer);
      return () => clearInterval(timer);
    } else if (refreshTimer) {
      clearInterval(refreshTimer);
      setRefreshTimer(null);
    }
  }, [autoRefresh, open, refreshInterval, renderTemplate]);

  // Handle preview mode change
  const handlePreviewModeChange = useCallback((mode: PreviewMode) => {
    setPreviewMode(mode);
    if (mode === 'fullscreen') {
      setIsFullscreen(true);
    } else {
      setIsFullscreen(false);
    }
  }, []);

  // Handle zoom change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(25, Math.min(200, newZoom)));
  }, []);

  // Handle export
  const handleExport = useCallback(
    (format: 'pdf' | 'png' | 'html') => {
      onExport?.(format);
    },
    [onExport]
  );

  // Get preview width based on mode
  const getPreviewWidth = useCallback(() => {
    const baseWidth = BREAKPOINT_WIDTHS[PREVIEW_MODE_BREAKPOINTS[previewMode]];
    return (baseWidth * zoom) / 100;
  }, [previewMode, zoom]);

  // Render section content
  const renderSectionContent = useCallback(
    (section: RenderedSection) => {
      switch (section.type) {
        case 'header':
          return (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {section.content.logo && (
                <img
                  src={section.content.logo}
                  alt="Logo"
                  style={{ maxHeight: 60, marginBottom: 16 }}
                />
              )}
              {section.content.title && (
                <Typography variant="h4" gutterBottom>
                  {section.content.title}
                </Typography>
              )}
              {section.content.subtitle && (
                <Typography variant="subtitle1" color="text.secondary">
                  {section.content.subtitle}
                </Typography>
              )}
              {section.content.metadata && (
                <Box sx={{ mt: 2 }}>
                  {Object.entries(section.content.metadata).map(
                    ([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    )
                  )}
                </Box>
              )}
            </Box>
          );

        case 'summary':
          return (
            <Box>
              {section.content.kpis && section.content.kpis.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {section.content.kpis.map((kpi: RenderedKPI) => (
                    <Grid item xs={12} sm={6} md={3} key={kpi.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {kpi.title}
                          </Typography>
                          <Typography variant="h4" color={kpi.color}>
                            {kpi.value} {kpi.unit}
                          </Typography>
                          {kpi.trend && (
                            <Typography
                              variant="body2"
                              color={kpi.trend.color}
                              sx={{ mt: 1 }}
                            >
                              {kpi.trend.direction === 'up'
                                ? '↑'
                                : kpi.trend.direction === 'down'
                                ? '↓'
                                : '→'}
                              {kpi.trend.value}% {kpi.trend.period}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {section.content.metrics &&
                section.content.metrics.length > 0 && (
                  <Grid container spacing={2}>
                    {section.content.metrics.map((metric: RenderedMetric) => (
                      <Grid item xs={12} sm={6} md={4} key={metric.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="body2" color="text.secondary">
                              {metric.label}
                            </Typography>
                            <Typography variant="h6">
                              {metric.value} {metric.unit}
                            </Typography>
                            {metric.trend && (
                              <Typography
                                variant="caption"
                                color={metric.trend.color}
                              >
                                {metric.trend.direction === 'up'
                                  ? '↑'
                                  : metric.trend.direction === 'down'
                                  ? '↓'
                                  : '→'}
                                {metric.trend.value}%
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
            </Box>
          );

        case 'charts':
          return (
            <Box>
              {section.content.charts && section.content.charts.length > 0 ? (
                <Grid container spacing={2}>
                  {section.content.charts.map((chart: RenderedChart) => (
                    <Grid
                      item
                      xs={12}
                      md={section.content.arrangement === 'grid' ? 6 : 12}
                      key={chart.id}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {chart.title}
                          </Typography>
                          {chart.subtitle && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              gutterBottom
                            >
                              {chart.subtitle}
                            </Typography>
                          )}
                          {chart.loading ? (
                            <Skeleton variant="rectangular" height={300} />
                          ) : chart.error ? (
                            <Alert severity="error">{chart.error}</Alert>
                          ) : chart.isEmpty ? (
                            <Alert severity="info">No data available</Alert>
                          ) : (
                            <ChartComponent
                              type={chart.type as any}
                              data={chart.data}
                              config={chart.config}
                              theme={{
                                name: 'default',
                                colorPalette: [
                                  '#1976d2',
                                  '#dc004e',
                                  '#9c27b0',
                                  '#673ab7',
                                  '#3f51b5',
                                ],
                                gradients: [],
                                typography: {
                                  fontFamily: theme.typography.fontFamily,
                                  fontSize: {
                                    small: 12,
                                    medium: 14,
                                    large: 16,
                                    xlarge: 18,
                                  },
                                  fontWeight: {
                                    light: 300,
                                    normal: 400,
                                    medium: 500,
                                    bold: 700,
                                  },
                                },
                                spacing: {
                                  xs: 4,
                                  sm: 8,
                                  md: 16,
                                  lg: 24,
                                  xl: 32,
                                },
                                borderRadius: 4,
                                shadows: {
                                  small: '0 1px 3px rgba(0,0,0,0.12)',
                                  medium: '0 4px 6px rgba(0,0,0,0.12)',
                                  large: '0 10px 20px rgba(0,0,0,0.12)',
                                },
                                mode: theme.palette.mode,
                              }}
                              animations={{
                                duration: 300,
                                easing: 'ease-in-out',
                                stagger: false,
                                entrance: 'fade',
                              }}
                              responsive
                            />
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">No charts configured</Alert>
              )}
            </Box>
          );

        case 'tables':
          return (
            <Box>
              {section.content.tables && section.content.tables.length > 0 ? (
                <Stack spacing={2}>
                  {section.content.tables.map((table: RenderedTable) => (
                    <Card key={table.id}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {table.title}
                        </Typography>
                        {table.loading ? (
                          <Skeleton variant="rectangular" height={200} />
                        ) : table.error ? (
                          <Alert severity="error">{table.error}</Alert>
                        ) : table.isEmpty ? (
                          <Alert severity="info">No data available</Alert>
                        ) : (
                          <Box sx={{ overflow: 'auto' }}>
                            {/* Simple table rendering - in real implementation, use a proper table component */}
                            <Typography variant="body2">
                              Table: {table.data.length} rows,{' '}
                              {table.columns.length} columns
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">No tables configured</Alert>
              )}
            </Box>
          );

        case 'text':
          return (
            <Box>
              {section.content.html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: section.content.html }}
                />
              ) : (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {section.content.text || 'No text content'}
                </Typography>
              )}
            </Box>
          );

        case 'spacer':
          return <Box sx={{ height: 32 }} />;

        case 'footer':
          return (
            <Box
              sx={{
                textAlign: 'center',
                py: 2,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {section.content.text ||
                  `Generated on ${new Date().toLocaleString()}`}
              </Typography>
            </Box>
          );

        default:
          return (
            <Alert severity="warning">
              Unknown section type: {section.type}
            </Alert>
          );
      }
    },
    [theme]
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isFullscreen}
      PaperProps={{
        sx: {
          width: isFullscreen ? '100%' : '90vw',
          height: isFullscreen ? '100%' : '90vh',
          maxWidth: 'none',
          maxHeight: 'none',
        },
      }}
    >
      {/* Toolbar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Preview: {template.name}
          </Typography>

          {/* Preview mode controls */}
          <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
            <Tooltip title="Mobile">
              <IconButton
                onClick={() => handlePreviewModeChange('mobile')}
                color={previewMode === 'mobile' ? 'primary' : 'default'}
              >
                <Phone />
              </IconButton>
            </Tooltip>
            <Tooltip title="Tablet">
              <IconButton
                onClick={() => handlePreviewModeChange('tablet')}
                color={previewMode === 'tablet' ? 'primary' : 'default'}
              >
                <Tablet />
              </IconButton>
            </Tooltip>
            <Tooltip title="Desktop">
              <IconButton
                onClick={() => handlePreviewModeChange('desktop')}
                color={previewMode === 'desktop' ? 'primary' : 'default'}
              >
                <Computer />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton
                onClick={() => handlePreviewModeChange('fullscreen')}
                color={previewMode === 'fullscreen' ? 'primary' : 'default'}
              >
                <Tv />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Zoom controls */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
            <IconButton onClick={() => handleZoomChange(zoom - 25)}>
              <ZoomOut />
            </IconButton>
            <Typography
              variant="body2"
              sx={{ minWidth: 50, textAlign: 'center' }}
            >
              {zoom}%
            </Typography>
            <IconButton onClick={() => handleZoomChange(zoom + 25)}>
              <ZoomIn />
            </IconButton>
          </Stack>

          {/* Action buttons */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={renderTemplate} disabled={isRendering}>
                <Refresh />
              </IconButton>
            </Tooltip>

            <Tooltip title="Validation">
              <IconButton
                onClick={() => setShowValidation(!showValidation)}
                color={
                  validationResult && !validationResult.isValid
                    ? 'error'
                    : 'default'
                }
              >
                <BugReport />
              </IconButton>
            </Tooltip>

            <Tooltip title="Performance">
              <IconButton onClick={() => setShowPerformance(!showPerformance)}>
                <Speed />
              </IconButton>
            </Tooltip>

            {onExport && (
              <Tooltip title="Export">
                <IconButton onClick={() => handleExport('pdf')}>
                  <Download />
                </IconButton>
              </Tooltip>
            )}

            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Main preview area */}
          <Box
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              backgroundColor: 'grey.50',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              p: 2,
            }}
          >
            <Paper
              sx={{
                width: getPreviewWidth(),
                minHeight: '100%',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'all 0.3s ease',
              }}
            >
              {isRendering ? (
                <Box sx={{ p: 4 }}>
                  <LinearProgress sx={{ mb: 2 }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                  >
                    Rendering template...
                  </Typography>
                </Box>
              ) : renderError ? (
                <Box sx={{ p: 4 }}>
                  <Alert severity="error">{renderError}</Alert>
                </Box>
              ) : renderResult ? (
                <Box sx={{ p: 2 }}>
                  {renderResult.sections.map((section) => (
                    <Box
                      key={section.id}
                      sx={{
                        mb: 2,
                        p: section.layout.padding
                          ? {
                              pt: section.layout.padding.top / 8,
                              pr: section.layout.padding.right / 8,
                              pb: section.layout.padding.bottom / 8,
                              pl: section.layout.padding.left / 8,
                            }
                          : 2,
                        backgroundColor: section.layout.background,
                        border: section.layout.border
                          ? `${section.layout.border.width}px ${section.layout.border.style} ${section.layout.border.color}`
                          : 'none',
                        borderRadius: section.layout.border?.radius || 0,
                      }}
                    >
                      {renderSectionContent(section)}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ p: 4 }}>
                  <Alert severity="info">No preview available</Alert>
                </Box>
              )}
            </Paper>
          </Box>

          {/* Side panels */}
          {(showValidation || showPerformance) && (
            <Box sx={{ width: 300, borderLeft: 1, borderColor: 'divider' }}>
              {showValidation && validationResult && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Validation Results
                  </Typography>

                  <Stack spacing={1}>
                    <Chip
                      label={validationResult.isValid ? 'Valid' : 'Invalid'}
                      color={validationResult.isValid ? 'success' : 'error'}
                      size="small"
                    />

                    {validationResult.errors.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="error">
                          Errors ({validationResult.errors.length})
                        </Typography>
                        {validationResult.errors
                          .slice(0, 5)
                          .map((error, index) => (
                            <Alert key={index} severity="error" sx={{ mt: 1 }}>
                              <Typography variant="caption">
                                {error.field}: {error.message}
                              </Typography>
                            </Alert>
                          ))}
                      </Box>
                    )}

                    {validationResult.warnings.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="warning.main">
                          Warnings ({validationResult.warnings.length})
                        </Typography>
                        {validationResult.warnings
                          .slice(0, 3)
                          .map((warning, index) => (
                            <Alert
                              key={index}
                              severity="warning"
                              sx={{ mt: 1 }}
                            >
                              <Typography variant="caption">
                                {warning.field}: {warning.message}
                              </Typography>
                            </Alert>
                          ))}
                      </Box>
                    )}

                    {validationResult.suggestions.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="info.main">
                          Suggestions ({validationResult.suggestions.length})
                        </Typography>
                        {validationResult.suggestions
                          .slice(0, 3)
                          .map((suggestion, index) => (
                            <Alert key={index} severity="info" sx={{ mt: 1 }}>
                              <Typography variant="caption">
                                {suggestion.message}
                              </Typography>
                            </Alert>
                          ))}
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {showPerformance && renderResult && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>

                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Render Time
                      </Typography>
                      <Typography variant="h6">
                        {renderResult.performance.totalRenderTime.toFixed(2)}ms
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Sections Rendered
                      </Typography>
                      <Typography variant="h6">
                        {renderResult.metadata.sectionsRendered}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Charts Rendered
                      </Typography>
                      <Typography variant="h6">
                        {renderResult.metadata.chartsRendered}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Data Processing Time
                      </Typography>
                      <Typography variant="h6">
                        {renderResult.performance.dataProcessingTime.toFixed(2)}
                        ms
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Validation Time
                      </Typography>
                      <Typography variant="h6">
                        {renderResult.performance.validationTime.toFixed(2)}ms
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Settings panel */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />

          {autoRefresh && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Interval</InputLabel>
              <Select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                label="Interval"
              >
                <MenuItem value={1000}>1 second</MenuItem>
                <MenuItem value={5000}>5 seconds</MenuItem>
                <MenuItem value={10000}>10 seconds</MenuItem>
                <MenuItem value={30000}>30 seconds</MenuItem>
              </Select>
            </FormControl>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {renderResult && (
            <Typography variant="caption" color="text.secondary">
              Last updated:{' '}
              {renderResult.metadata.renderedAt.toLocaleTimeString()}
            </Typography>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
};
