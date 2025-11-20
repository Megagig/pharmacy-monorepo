import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Preview as PreviewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useExportsStore } from '../../stores/exportsStore';
import { ExportFormat, ExportConfig, ExportOptions } from '../../types/exports';
import {
  getDefaultExportOptions,
  validateExportConfig,
  estimateExportSize,
  generateExportFilename,
  getMimeType,
} from '../../utils/exportHelpers';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  reportType: string;
  reportData: any;
  filters: Record<string, any>;
}

const steps = ['Format Selection', 'Configuration', 'Preview & Export'];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  reportType,
  reportData,
  filters,
}) => {
  const { selectedExportFormat, setSelectedExportFormat, addExportJob } =
    useExportsStore();

  const [activeStep, setActiveStep] = useState(0);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(() =>
    getDefaultExportOptions(selectedExportFormat)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update options when format changes
  useEffect(() => {
    setExportOptions(getDefaultExportOptions(selectedExportFormat));
    setValidationErrors([]);
  }, [selectedExportFormat]);

  // Validate configuration
  useEffect(() => {
    const config: ExportConfig = {
      format: selectedExportFormat,
      options: exportOptions,
      metadata: {
        title: `${reportType} Report`,
        author: 'Current User', // TODO: Get from auth context
        organization: 'Pharmacy Care Platform',
        generatedAt: new Date(),
        reportType,
        filters,
        dataRange: {
          startDate: filters.dateRange?.startDate || new Date(),
          endDate: filters.dateRange?.endDate || new Date(),
        },
        version: '1.0',
      },
    };

    const validation = validateExportConfig(config);
    setValidationErrors(validation.errors);
  }, [selectedExportFormat, exportOptions, reportType, filters]);

  const handleFormatChange = (format: ExportFormat) => {
    setSelectedExportFormat(format);
  };

  const handleOptionChange = (key: keyof ExportOptions, value: any) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleExport = async () => {
    if (validationErrors.length > 0) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const config: ExportConfig = {
        format: selectedExportFormat,
        options: exportOptions,
        metadata: {
          title: `${reportType} Report`,
          author: 'Current User',
          organization: 'Pharmacy Care Platform',
          generatedAt: new Date(),
          reportType,
          filters,
          dataRange: {
            startDate: filters.dateRange?.startDate || new Date(),
            endDate: filters.dateRange?.endDate || new Date(),
          },
          version: '1.0',
        },
      };

      // Create export job
      const jobId = `export_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const exportJob = {
        id: jobId,
        reportType,
        filters,
        config,
        status: 'queued' as const,
        priority: 'normal' as const,
        progress: 0,
        createdBy: 'current-user', // TODO: Get from auth context
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      };

      addExportJob(exportJob);

      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsExporting(false);
            onClose();
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // TODO: Implement actual export API call

    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
    }
  };

  const renderFormatSelection = () => {
    const formats: {
      value: ExportFormat;
      label: string;
      description: string;
      icon: string;
    }[] = [
      {
        value: 'pdf',
        label: 'PDF Document',
        description: 'High-quality document with charts and formatting',
        icon: '📄',
      },
      {
        value: 'excel',
        label: 'Excel Workbook',
        description: 'Spreadsheet with multiple sheets and embedded charts',
        icon: '📊',
      },
      {
        value: 'csv',
        label: 'CSV File',
        description: 'Comma-separated values for data analysis',
        icon: '📋',
      },
      {
        value: 'png',
        label: 'PNG Image',
        description: 'High-resolution image of charts',
        icon: '🖼️',
      },
      {
        value: 'svg',
        label: 'SVG Vector',
        description: 'Scalable vector graphics',
        icon: '🎨',
      },
      {
        value: 'json',
        label: 'JSON Data',
        description: 'Raw data in JSON format',
        icon: '💾',
      },
    ];

    return (
      <Grid container spacing={2}>
        {formats.map((format) => (
          <Grid item xs={12} sm={6} key={format.value}>
            <Card
              variant={
                selectedExportFormat === format.value ? 'outlined' : 'elevation'
              }
              sx={{
                cursor: 'pointer',
                border: selectedExportFormat === format.value ? 2 : 1,
                borderColor:
                  selectedExportFormat === format.value
                    ? 'primary.main'
                    : 'divider',
                '&:hover': { elevation: 4 },
              }}
              onClick={() => handleFormatChange(format.value)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" component="span" mr={1}>
                    {format.icon}
                  </Typography>
                  <Typography variant="h6" component="div">
                    {format.label}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {format.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderConfiguration = () => {
    return (
      <Box>
        {/* PDF Options */}
        {selectedExportFormat === 'pdf' && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              PDF Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Page Size</InputLabel>
                  <Select
                    value={exportOptions.pageSize || 'A4'}
                    onChange={(e) =>
                      handleOptionChange('pageSize', e.target.value)
                    }
                  >
                    <MenuItem value="A4">A4</MenuItem>
                    <MenuItem value="A3">A3</MenuItem>
                    <MenuItem value="Letter">Letter</MenuItem>
                    <MenuItem value="Legal">Legal</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Orientation</InputLabel>
                  <Select
                    value={exportOptions.orientation || 'portrait'}
                    onChange={(e) =>
                      handleOptionChange('orientation', e.target.value)
                    }
                  >
                    <MenuItem value="portrait">Portrait</MenuItem>
                    <MenuItem value="landscape">Landscape</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={exportOptions.includeCharts !== false}
                      onChange={(e) =>
                        handleOptionChange('includeCharts', e.target.checked)
                      }
                    />
                  }
                  label="Include Charts"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* CSV Options */}
        {selectedExportFormat === 'csv' && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              CSV Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Delimiter"
                  value={exportOptions.delimiter || ','}
                  onChange={(e) =>
                    handleOptionChange('delimiter', e.target.value)
                  }
                  inputProps={{ maxLength: 1 }}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Encoding</InputLabel>
                  <Select
                    value={exportOptions.encoding || 'utf-8'}
                    onChange={(e) =>
                      handleOptionChange('encoding', e.target.value)
                    }
                  >
                    <MenuItem value="utf-8">UTF-8</MenuItem>
                    <MenuItem value="utf-16">UTF-16</MenuItem>
                    <MenuItem value="ascii">ASCII</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={exportOptions.includeHeaders !== false}
                      onChange={(e) =>
                        handleOptionChange('includeHeaders', e.target.checked)
                      }
                    />
                  }
                  label="Include Headers"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Image Options */}
        {(['png', 'svg'] as ExportFormat[]).includes(selectedExportFormat) && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Image Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Width (px)"
                  type="number"
                  value={exportOptions.width || 1200}
                  onChange={(e) =>
                    handleOptionChange('width', parseInt(e.target.value))
                  }
                  inputProps={{ min: 100, max: 5000 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Height (px)"
                  type="number"
                  value={exportOptions.height || 800}
                  onChange={(e) =>
                    handleOptionChange('height', parseInt(e.target.value))
                  }
                  inputProps={{ min: 100, max: 5000 }}
                />
              </Grid>
              {selectedExportFormat === 'png' && (
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="DPI"
                    type="number"
                    value={exportOptions.dpi || 150}
                    onChange={(e) =>
                      handleOptionChange('dpi', parseInt(e.target.value))
                    }
                    inputProps={{ min: 72, max: 300 }}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* General Options */}
        <Box>
          <Typography variant="h6" gutterBottom>
            General Options
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={exportOptions.includeMetadata !== false}
                onChange={(e) =>
                  handleOptionChange('includeMetadata', e.target.checked)
                }
              />
            }
            label="Include Metadata"
          />
          <FormControlLabel
            control={
              <Switch
                checked={exportOptions.includeFilters !== false}
                onChange={(e) =>
                  handleOptionChange('includeFilters', e.target.checked)
                }
              />
            }
            label="Include Applied Filters"
          />
          <FormControlLabel
            control={
              <Switch
                checked={exportOptions.includeTimestamp !== false}
                onChange={(e) =>
                  handleOptionChange('includeTimestamp', e.target.checked)
                }
              />
            }
            label="Include Timestamp"
          />
        </Box>
      </Box>
    );
  };

  const renderPreview = () => {
    const dataPoints = reportData?.summary?.totalRecords || 0;
    const chartCount = reportData?.charts?.length || 0;
    const sizeEstimate = estimateExportSize(
      selectedExportFormat,
      dataPoints,
      chartCount
    );
    const filename = generateExportFilename(reportType, selectedExportFormat);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Export Preview
        </Typography>

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Format
                </Typography>
                <Typography variant="body1">
                  {selectedExportFormat.toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Estimated Size
                </Typography>
                <Typography variant="body1">
                  {sizeEstimate.formatted}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Filename
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {filename}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Configuration Errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Box display="flex" flexWrap="wrap" gap={1}>
          {exportOptions.includeCharts && (
            <Chip label="Charts Included" color="primary" size="small" />
          )}
          {exportOptions.includeMetadata && (
            <Chip label="Metadata Included" color="primary" size="small" />
          )}
          {exportOptions.includeFilters && (
            <Chip label="Filters Included" color="primary" size="small" />
          )}
          {exportOptions.includeTimestamp && (
            <Chip label="Timestamp Included" color="primary" size="small" />
          )}
        </Box>
      </Box>
    );
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderFormatSelection();
      case 1:
        return renderConfiguration();
      case 2:
        return renderPreview();
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '600px' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <DownloadIcon sx={{ mr: 1 }} />
            Export Report
          </Box>
          <Button
            onClick={onClose}
            size="small"
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {isExporting && (
          <Box mb={3}>
            <Typography variant="body2" gutterBottom>
              Exporting report...
            </Typography>
            <LinearProgress
              variant="determinate"
              value={exportProgress}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {exportProgress}% complete
            </Typography>
          </Box>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>

        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isExporting}>
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={isExporting}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={isExporting || validationErrors.length > 0}
            startIcon={<DownloadIcon />}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
