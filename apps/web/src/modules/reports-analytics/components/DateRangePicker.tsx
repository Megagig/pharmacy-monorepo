import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Stack,
  Chip,
  IconButton,
  Popover,
  TextField,
  useTheme,
  useMediaQuery,
  Fade,
  Divider,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  DateRange as DateRangeIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: theme.shadows[4],
}));

const PresetButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: theme.shadows[2],
  },
  '&.active': {
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    color: theme.palette.primary.contrastText,
    boxShadow: theme.shadows[3],
  },
}));

const CustomDateField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2),
    background: alpha(theme.palette.background.paper, 0.8),
    '&:hover': {
      background: theme.palette.background.paper,
    },
    '&.Mui-focused': {
      background: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
    },
  },
}));

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (dateRange: DateRange) => void;
  onApply?: (dateRange: DateRange) => void;
  disabled?: boolean;
  showPresets?: boolean;
  showCustomRange?: boolean;
  maxRange?: number; // Maximum days allowed
  compact?: boolean;
}

const DATE_PRESETS = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'wtd', label: 'Week to date', type: 'week' },
  { key: 'mtd', label: 'Month to date', type: 'month' },
  { key: 'ytd', label: 'Year to date', type: 'year' },
  { key: '1y', label: 'Last year', days: 365 },
  { key: 'custom', label: 'Custom range', type: 'custom' },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  onApply,
  disabled = false,
  showPresets = true,
  showCustomRange = true,
  maxRange = 1095, // 3 years default
  compact = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date>(value.startDate);
  const [tempEndDate, setTempEndDate] = useState<Date>(value.endDate);
  const [selectedPreset, setSelectedPreset] = useState<string>(value.preset || '30d');

  const handlePresetClick = useCallback((preset: typeof DATE_PRESETS[0]) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (preset.type) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      case 'custom':
        setSelectedPreset('custom');
        return;
      default:
        startDate = subDays(now, preset.days || 30);
    }

    const newRange: DateRange = {
      startDate,
      endDate,
      preset: preset.key,
    };

    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setSelectedPreset(preset.key);
    onChange(newRange);

    if (onApply && preset.key !== 'custom') {
      onApply(newRange);
    }
  }, [onChange, onApply]);

  const handleCustomDateChange = useCallback((field: 'start' | 'end', date: Date | null) => {
    if (!date) return;

    if (field === 'start') {
      setTempStartDate(date);
      if (date > tempEndDate) {
        setTempEndDate(date);
      }
    } else {
      setTempEndDate(date);
      if (date < tempStartDate) {
        setTempStartDate(date);
      }
    }

    setSelectedPreset('custom');
  }, [tempStartDate, tempEndDate]);

  const handleApplyCustomRange = useCallback(() => {
    const daysDiff = Math.ceil((tempEndDate.getTime() - tempStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > maxRange) {
      // Could show an error message here
      return;
    }

    const newRange: DateRange = {
      startDate: tempStartDate,
      endDate: tempEndDate,
      preset: 'custom',
    };

    onChange(newRange);
    if (onApply) {
      onApply(newRange);
    }
    setAnchorEl(null);
  }, [tempStartDate, tempEndDate, maxRange, onChange, onApply]);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
    // Reset temp dates to current values
    setTempStartDate(value.startDate);
    setTempEndDate(value.endDate);
  };

  const formatDateRange = () => {
    const preset = DATE_PRESETS.find(p => p.key === selectedPreset);
    if (preset && preset.key !== 'custom') {
      return preset.label;
    }
    return `${format(value.startDate, 'MMM dd')} - ${format(value.endDate, 'MMM dd, yyyy')}`;
  };

  const open = Boolean(anchorEl);

  if (compact) {
    return (
      <Box>
        <Button
          variant="outlined"
          startIcon={<DateRangeIcon />}
          onClick={handlePopoverOpen}
          disabled={disabled}
          sx={{
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 500,
            minWidth: 200,
          }}
        >
          {formatDateRange()}
        </Button>
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handlePopoverClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 3, minWidth: 320 }}>
            <DateRangePickerContent />
          </Box>
        </Popover>
      </Box>
    );
  }

  function DateRangePickerContent() {
    return (
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight="600">
            Select Date Range
          </Typography>
          {compact && (
            <IconButton size="small" onClick={handlePopoverClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Stack>

        {/* Presets */}
        {showPresets && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Quick Select
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {DATE_PRESETS.filter(p => p.key !== 'custom').map((preset) => (
                <PresetButton
                  key={preset.key}
                  size="small"
                  variant={selectedPreset === preset.key ? "contained" : "outlined"}
                  className={selectedPreset === preset.key ? "active" : ""}
                  onClick={() => handlePresetClick(preset)}
                  disabled={disabled}
                >
                  {preset.label}
                </PresetButton>
              ))}
            </Stack>
          </Box>
        )}

        {/* Custom Date Range */}
        {showCustomRange && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Custom Range
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack direction={isMobile ? "column" : "row"} spacing={2}>
                <DatePicker
                  label="Start Date"
                  value={tempStartDate}
                  onChange={(date) => handleCustomDateChange('start', date)}
                  disabled={disabled}
                  enableAccessibleFieldDOMStructure={false}
                  slots={{
                    textField: CustomDateField,
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={tempEndDate}
                  onChange={(date) => handleCustomDateChange('end', date)}
                  disabled={disabled}
                  minDate={tempStartDate}
                  enableAccessibleFieldDOMStructure={false}
                  slots={{
                    textField: CustomDateField,
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
              </Stack>
            </LocalizationProvider>

            {selectedPreset === 'custom' && (
              <Stack direction="row" spacing={2} sx={{ mt: 2 }} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={handlePopoverClose}
                  disabled={disabled}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleApplyCustomRange}
                  disabled={disabled}
                  startIcon={<CalendarIcon />}
                >
                  Apply Range
                </Button>
              </Stack>
            )}
          </Box>
        )}

        {/* Current Selection Info */}
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TimeIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="body2" fontWeight="500">
                Selected Range
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(value.startDate, 'MMM dd, yyyy')} - {format(value.endDate, 'MMM dd, yyyy')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.ceil((value.endDate.getTime() - value.startDate.getTime()) / (1000 * 60 * 60 * 24))} days
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    );
  }

  return (
    <StyledPaper elevation={0}>
      <DateRangePickerContent />
    </StyledPaper>
  );
};

export default DateRangePicker;