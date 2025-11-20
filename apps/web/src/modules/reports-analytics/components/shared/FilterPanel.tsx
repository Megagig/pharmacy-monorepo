// Dynamic Filter Panel Component
import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  IconButton,
  Collapse,
  Divider,
  Autocomplete,
  Slider,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Alert,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  FilterDefinition,
  FilterGroup,
  ReportFilters,
  DatePreset,
} from '../../types/filters';
import { ReportType } from '../../types/reports';
import { useFiltersStore } from '../../stores/filtersStore';
import {
  createDateRangeFromPreset,
  getDateRangeLabel,
} from '../../utils/filterHelpers';

interface FilterPanelProps {
  reportType: ReportType;
  filterGroups: FilterGroup[];
  onFiltersChange: (filters: ReportFilters) => void;
  onApplyFilters: () => void;
  className?: string;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  reportType,
  filterGroups,
  onFiltersChange,
  onApplyFilters,
  className,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [showPresetDialog, setShowPresetDialog] = useState(false);

  const {
    getFilters,
    updateFilter,
    resetFilters,
    getValidationErrors,
    validateCurrentFilters,
    getPresetsForReport,
    applyPreset,
    savePreset,
  } = useFiltersStore();

  const currentFilters = getFilters(reportType);
  const validationErrors = getValidationErrors(reportType);
  const presets = getPresetsForReport(reportType);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  // Handle filter value changes
  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      updateFilter(reportType, key, value);
      onFiltersChange(getFilters(reportType));
    },
    [reportType, updateFilter, onFiltersChange, getFilters]
  );

  // Handle date preset changes
  const handleDatePresetChange = useCallback(
    (preset: DatePreset) => {
      const dateRange = createDateRangeFromPreset(preset);
      handleFilterChange('dateRange', dateRange);
    },
    [handleFilterChange]
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    resetFilters(reportType);
    onFiltersChange(getFilters(reportType));
  }, [reportType, resetFilters, onFiltersChange, getFilters]);

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    if (validateCurrentFilters(reportType)) {
      onApplyFilters();
    }
  }, [reportType, validateCurrentFilters, onApplyFilters]);

  // Render individual filter based on type
  const renderFilter = (filter: FilterDefinition) => {
    const value = (currentFilters as any)[filter.key];
    const error = validationErrors[filter.key];

    const commonProps = {
      fullWidth: true,
      size: 'small' as const,
      error: !!error,
      helperText: error || filter.helpText,
    };

    switch (filter.type) {
      case 'text':
        return (
          <TextField
            {...commonProps}
            label={filter.label}
            value={value || ''}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            placeholder={filter.placeholder}
          />
        );

      case 'number':
        return (
          <TextField
            {...commonProps}
            label={filter.label}
            type="number"
            value={value || ''}
            onChange={(e) =>
              handleFilterChange(filter.key, Number(e.target.value))
            }
            placeholder={filter.placeholder}
          />
        );

      case 'select':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{filter.label}</InputLabel>
            <Select
              value={value || ''}
              label={filter.label}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            >
              {filter.options?.map((option) => (
                <MenuItem key={String(option.value)} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{filter.label}</InputLabel>
            <Select
              multiple
              value={value || []}
              label={filter.label}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((val) => {
                    const option = filter.options?.find(
                      (opt) => opt.value === val
                    );
                    return (
                      <Chip
                        key={val}
                        label={option?.label || val}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {filter.options?.map((option) => (
                <MenuItem key={String(option.value)} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'autocomplete':
        return (
          <Autocomplete
            {...commonProps}
            options={filter.options || []}
            getOptionLabel={(option) => option.label}
            value={filter.options?.find((opt) => opt.value === value) || null}
            onChange={(_, newValue) =>
              handleFilterChange(filter.key, newValue?.value)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={filter.label}
                placeholder={filter.placeholder}
                error={!!error}
                helperText={error || filter.helpText}
              />
            )}
          />
        );

      case 'date':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={filter.label}
              value={value || null}
              onChange={(newValue) => handleFilterChange(filter.key, newValue)}
              slotProps={{
                textField: {
                  ...commonProps,
                  placeholder: filter.placeholder,
                },
              }}
            />
          </LocalizationProvider>
        );

      case 'daterange':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {filter.label}
            </Typography>

            {/* Date Presets */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Quick Select:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {(['7d', '30d', '90d', '6months', '1year'] as DatePreset[]).map(
                  (preset) => (
                    <Chip
                      key={preset}
                      label={getDateRangeLabel(preset)}
                      size="small"
                      variant={value?.preset === preset ? 'filled' : 'outlined'}
                      onClick={() => handleDatePresetChange(preset)}
                      color={value?.preset === preset ? 'primary' : 'default'}
                    />
                  )
                )}
              </Box>
            </Box>

            {/* Custom Date Range */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={value?.startDate || null}
                  onChange={(newValue) =>
                    handleFilterChange(filter.key, {
                      ...value,
                      startDate: newValue,
                      preset: 'custom',
                    })
                  }
                  slotProps={{
                    textField: { size: 'small', fullWidth: true },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={value?.endDate || null}
                  onChange={(newValue) =>
                    handleFilterChange(filter.key, {
                      ...value,
                      endDate: newValue,
                      preset: 'custom',
                    })
                  }
                  slotProps={{
                    textField: { size: 'small', fullWidth: true },
                  }}
                />
              </Box>
            </LocalizationProvider>
          </Box>
        );

      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={value || false}
                onChange={(e) =>
                  handleFilterChange(filter.key, e.target.checked)
                }
              />
            }
            label={filter.label}
          />
        );

      case 'radio':
        return (
          <FormControl component="fieldset" {...commonProps}>
            <Typography variant="subtitle2" gutterBottom>
              {filter.label}
            </Typography>
            <RadioGroup
              value={value || ''}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            >
              {filter.options?.map((option) => (
                <FormControlLabel
                  key={String(option.value)}
                  value={option.value}
                  control={<Radio size="small" />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </FormControl>
        );

      case 'slider':
        const min =
          filter.validation?.find((v) => v.type === 'min')?.value || 0;
        const max =
          filter.validation?.find((v) => v.type === 'max')?.value || 100;

        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {filter.label}: {value || min}
            </Typography>
            <Slider
              value={value || min}
              min={min}
              max={max}
              onChange={(_, newValue) =>
                handleFilterChange(filter.key, newValue)
              }
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        );

      default:
        return (
          <Alert severity="warning" size="small">
            Filter type "{filter.type}" not implemented
          </Alert>
        );
    }
  };

  return (
    <Paper sx={{ p: 2 }} className={className}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Filters</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            <RefreshIcon />
          </IconButton>
          <IconButton size="small" title="Clear All">
            <ClearIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Presets */}
      {presets.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Saved Presets
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {presets.map((preset) => (
              <Chip
                key={preset.id}
                label={preset.name}
                size="small"
                variant="outlined"
                onClick={() => applyPreset(reportType, preset.id)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Filter Groups */}
      {filterGroups.map((group, groupIndex) => (
        <Box key={group.id} sx={{ mb: 2 }}>
          {/* Group Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: group.collapsible ? 'pointer' : 'default',
              py: 1,
            }}
            onClick={
              group.collapsible ? () => toggleGroup(group.id) : undefined
            }
          >
            <Typography variant="subtitle1" color="primary">
              {group.label}
            </Typography>
            {group.collapsible && (
              <IconButton size="small">
                {expandedGroups[group.id] ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            )}
          </Box>

          {group.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {group.description}
            </Typography>
          )}

          {/* Group Filters */}
          <Collapse
            in={!group.collapsible || expandedGroups[group.id] !== false}
            timeout="auto"
            unmountOnExit
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pl: group.collapsible ? 2 : 0,
              }}
            >
              {group.filters.map((filter) => (
                <Box key={filter.key}>{renderFilter(filter)}</Box>
              ))}
            </Box>
          </Collapse>

          {groupIndex < filterGroups.length - 1 && <Divider sx={{ mt: 2 }} />}
        </Box>
      ))}

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 3,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<SaveIcon />}
          onClick={() => setShowPresetDialog(true)}
        >
          Save Preset
        </Button>

        <Button
          variant="contained"
          size="small"
          onClick={handleApplyFilters}
          disabled={Object.keys(validationErrors).length > 0}
        >
          Apply Filters
        </Button>
      </Box>
    </Paper>
  );
};

export default FilterPanel;
