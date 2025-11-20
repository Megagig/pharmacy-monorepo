import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Grid,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Autocomplete,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useExportsStore } from '../../stores/exportsStore';
import {
  ReportSchedule,
  ScheduleFrequency,
  ScheduleRecipient,
  ExportFormat,
  ExportConfig,
} from '../../types/exports';
import { getDefaultExportOptions } from '../../utils/exportHelpers';

interface ReportSchedulerProps {
  open: boolean;
  onClose: () => void;
  reportType: string;
  filters: Record<string, any>;
  initialSchedule?: ReportSchedule;
}

const steps = [
  'Basic Settings',
  'Schedule Configuration',
  'Recipients & Delivery',
];

const frequencyOptions: {
  value: ScheduleFrequency;
  label: string;
  description: string;
}[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'Every day at specified time',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'Every week on selected days',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Every month on specified date',
  },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', description: 'Once per year' },
  { value: 'custom', label: 'Custom', description: 'Custom interval' },
];

const daysOfWeek = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export const ReportScheduler: React.FC<ReportSchedulerProps> = ({
  open,
  onClose,
  reportType,
  filters,
  initialSchedule,
}) => {
  const { addSchedule, updateSchedule } = useExportsStore();

  const [activeStep, setActiveStep] = useState(0);
  const [scheduleName, setScheduleName] = useState(initialSchedule?.name || '');
  const [scheduleDescription, setScheduleDescription] = useState(
    initialSchedule?.description || ''
  );
  const [frequency, setFrequency] = useState<ScheduleFrequency>(
    initialSchedule?.schedule.frequency || 'weekly'
  );
  const [selectedTime, setSelectedTime] = useState<Date>(
    initialSchedule?.schedule.time
      ? new Date(`2000-01-01T${initialSchedule.schedule.time}`)
      : new Date()
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initialSchedule?.schedule.daysOfWeek || [1]
  ); // Default to Monday
  const [dayOfMonth, setDayOfMonth] = useState(
    initialSchedule?.schedule.dayOfMonth || 1
  );
  const [customInterval, setCustomInterval] = useState(
    initialSchedule?.schedule.interval || 1
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialSchedule?.schedule.endDate || null
  );
  const [maxRuns, setMaxRuns] = useState<number | null>(
    initialSchedule?.schedule.maxRuns || null
  );
  const [timezone, setTimezone] = useState(
    initialSchedule?.schedule.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    initialSchedule?.exportConfig.format || 'pdf'
  );
  const [recipients, setRecipients] = useState<ScheduleRecipient[]>(
    initialSchedule?.recipients || []
  );
  const [isActive, setIsActive] = useState(initialSchedule?.isActive ?? true);
  const [errors, setErrors] = useState<string[]>([]);

  // Email suggestions (in real app, this would come from API)
  const emailSuggestions = [
    'admin@pharmacy.com',
    'reports@pharmacy.com',
    'manager@pharmacy.com',
  ];

  const validateSchedule = (): string[] => {
    const validationErrors: string[] = [];

    if (!scheduleName.trim()) {
      validationErrors.push('Schedule name is required');
    }

    if (frequency === 'weekly' && selectedDays.length === 0) {
      validationErrors.push(
        'At least one day must be selected for weekly schedule'
      );
    }

    if (frequency === 'monthly' && (dayOfMonth < 1 || dayOfMonth > 31)) {
      validationErrors.push('Day of month must be between 1 and 31');
    }

    if (frequency === 'custom' && customInterval < 1) {
      validationErrors.push('Custom interval must be at least 1');
    }

    if (recipients.length === 0) {
      validationErrors.push('At least one recipient is required');
    }

    recipients.forEach((recipient, index) => {
      if (!recipient.address.trim()) {
        validationErrors.push(`Recipient ${index + 1} address is required`);
      }
      if (recipient.type === 'email' && !isValidEmail(recipient.address)) {
        validationErrors.push(
          `Recipient ${index + 1} has invalid email format`
        );
      }
    });

    return validationErrors;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  useEffect(() => {
    setErrors(validateSchedule());
  }, [
    scheduleName,
    frequency,
    selectedDays,
    dayOfMonth,
    customInterval,
    recipients,
  ]);

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

  const handleAddRecipient = () => {
    setRecipients((prev) => [
      ...prev,
      {
        type: 'email',
        address: '',
        name: '',
        options: {
          subject: `${reportType
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())} Report`,
          body: 'Please find the attached report.',
        },
      },
    ]);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRecipientChange = (
    index: number,
    field: keyof ScheduleRecipient,
    value: any
  ) => {
    setRecipients((prev) =>
      prev.map((recipient, i) =>
        i === index ? { ...recipient, [field]: value } : recipient
      )
    );
  };

  const handleRecipientOptionChange = (
    index: number,
    option: string,
    value: any
  ) => {
    setRecipients((prev) =>
      prev.map((recipient, i) =>
        i === index
          ? {
              ...recipient,
              options: { ...recipient.options, [option]: value },
            }
          : recipient
      )
    );
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const calculateNextRun = (): Date => {
    const now = new Date();
    const time = selectedTime;
    const nextRun = new Date();

    nextRun.setHours(time.getHours(), time.getMinutes(), 0, 0);

    switch (frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        const currentDay = now.getDay();
        const nextDay =
          selectedDays.find((day) => day > currentDay) || selectedDays[0];
        const daysUntilNext =
          nextDay > currentDay
            ? nextDay - currentDay
            : 7 - currentDay + nextDay;
        nextRun.setDate(nextRun.getDate() + daysUntilNext);
        if (nextDay === currentDay && nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;

      case 'monthly':
        nextRun.setDate(dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;

      case 'quarterly':
        const currentMonth = now.getMonth();
        const nextQuarter = Math.ceil((currentMonth + 1) / 3) * 3;
        nextRun.setMonth(nextQuarter, dayOfMonth);
        if (nextRun <= now) {
          nextRun.setMonth(nextQuarter + 3, dayOfMonth);
        }
        break;

      case 'yearly':
        nextRun.setMonth(0, dayOfMonth); // January
        if (nextRun <= now) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        break;

      case 'custom':
        nextRun.setDate(nextRun.getDate() + customInterval);
        break;
    }

    return nextRun;
  };

  const handleSave = () => {
    const validationErrors = validateSchedule();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const exportConfig: ExportConfig = {
      format: exportFormat,
      options: getDefaultExportOptions(exportFormat),
      metadata: {
        title: `${reportType} Report`,
        author: 'System', // TODO: Get from auth context
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

    const schedule: ReportSchedule = {
      id:
        initialSchedule?.id ||
        `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: scheduleName,
      description: scheduleDescription,
      reportType,
      filters,
      exportConfig,
      schedule: {
        frequency,
        interval: frequency === 'custom' ? customInterval : undefined,
        daysOfWeek: frequency === 'weekly' ? selectedDays : undefined,
        dayOfMonth: ['monthly', 'quarterly', 'yearly'].includes(frequency)
          ? dayOfMonth
          : undefined,
        time: `${selectedTime
          .getHours()
          .toString()
          .padStart(2, '0')}:${selectedTime
          .getMinutes()
          .toString()
          .padStart(2, '0')}`,
        timezone,
        endDate,
        maxRuns,
      },
      recipients,
      isActive,
      nextRun: calculateNextRun(),
      lastRun: initialSchedule?.lastRun,
      runCount: initialSchedule?.runCount || 0,
      successCount: initialSchedule?.successCount || 0,
      failureCount: initialSchedule?.failureCount || 0,
      createdBy: 'current-user', // TODO: Get from auth context
      workspaceId: 'current-workspace', // TODO: Get from context
      createdAt: initialSchedule?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (initialSchedule) {
      updateSchedule(initialSchedule.id, schedule);
    } else {
      addSchedule(schedule);
    }

    onClose();
  };

  const renderBasicSettings = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Schedule Name"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            placeholder="e.g., Weekly Patient Outcomes Report"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={scheduleDescription}
            onChange={(e) => setScheduleDescription(e.target.value)}
            placeholder="Optional description of this scheduled report"
            multiline
            rows={2}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            >
              <MenuItem value="pdf">PDF Document</MenuItem>
              <MenuItem value="excel">Excel Workbook</MenuItem>
              <MenuItem value="csv">CSV File</MenuItem>
              <MenuItem value="json">JSON Data</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            }
            label="Active Schedule"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderScheduleConfiguration = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Frequency
          </Typography>
          <Grid container spacing={2}>
            {frequencyOptions.map((option) => (
              <Grid item xs={12} sm={6} md={4} key={option.value}>
                <Card
                  variant={
                    frequency === option.value ? 'outlined' : 'elevation'
                  }
                  sx={{
                    cursor: 'pointer',
                    border: frequency === option.value ? 2 : 1,
                    borderColor:
                      frequency === option.value ? 'primary.main' : 'divider',
                  }}
                  onClick={() => setFrequency(option.value)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {option.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
        </Grid>

        {/* Time Selection */}
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
              label="Time"
              value={selectedTime}
              onChange={(newValue) => newValue && setSelectedTime(newValue)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Timezone</InputLabel>
            <Select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <MenuItem value="UTC">UTC</MenuItem>
              <MenuItem value="America/New_York">Eastern Time</MenuItem>
              <MenuItem value="America/Chicago">Central Time</MenuItem>
              <MenuItem value="America/Denver">Mountain Time</MenuItem>
              <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
              <MenuItem value="Africa/Lagos">West Africa Time</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Weekly Days Selection */}
        {frequency === 'weekly' && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Days of Week
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {daysOfWeek.map((day) => (
                <Chip
                  key={day.value}
                  label={day.short}
                  clickable
                  color={
                    selectedDays.includes(day.value) ? 'primary' : 'default'
                  }
                  onClick={() => handleDayToggle(day.value)}
                />
              ))}
            </Box>
          </Grid>
        )}

        {/* Monthly/Quarterly/Yearly Day Selection */}
        {['monthly', 'quarterly', 'yearly'].includes(frequency) && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Day of Month"
              type="number"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
              inputProps={{ min: 1, max: 31 }}
            />
          </Grid>
        )}

        {/* Custom Interval */}
        {frequency === 'custom' && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Interval (days)"
              type="number"
              value={customInterval}
              onChange={(e) => setCustomInterval(parseInt(e.target.value))}
              inputProps={{ min: 1 }}
            />
          </Grid>
        )}

        {/* End Conditions */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            End Conditions (Optional)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Runs"
                type="number"
                value={maxRuns || ''}
                onChange={(e) =>
                  setMaxRuns(e.target.value ? parseInt(e.target.value) : null)
                }
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Next Run Preview */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Next run:</strong> {calculateNextRun().toLocaleString()}
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );

  const renderRecipientsDelivery = () => (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
        <Typography variant="h6">Recipients</Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddRecipient}
          variant="outlined"
          size="small"
        >
          Add Recipient
        </Button>
      </Box>

      {recipients.map((recipient, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="between"
              mb={2}
            >
              <Typography variant="subtitle1">Recipient {index + 1}</Typography>
              <IconButton
                onClick={() => handleRemoveRecipient(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={recipient.type}
                    onChange={(e) =>
                      handleRecipientChange(index, 'type', e.target.value)
                    }
                  >
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="webhook">Webhook</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={recipient.name || ''}
                  onChange={(e) =>
                    handleRecipientChange(index, 'name', e.target.value)
                  }
                  placeholder="Optional display name"
                />
              </Grid>
              <Grid item xs={12}>
                {recipient.type === 'email' ? (
                  <Autocomplete
                    freeSolo
                    options={emailSuggestions}
                    value={recipient.address}
                    onChange={(_, newValue) =>
                      handleRecipientChange(index, 'address', newValue || '')
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Email Address"
                        placeholder="user@example.com"
                        required
                      />
                    )}
                  />
                ) : (
                  <TextField
                    fullWidth
                    label="Webhook URL"
                    value={recipient.address}
                    onChange={(e) =>
                      handleRecipientChange(index, 'address', e.target.value)
                    }
                    placeholder="https://example.com/webhook"
                    required
                  />
                )}
              </Grid>

              {recipient.type === 'email' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Subject"
                      value={recipient.options?.subject || ''}
                      onChange={(e) =>
                        handleRecipientOptionChange(
                          index,
                          'subject',
                          e.target.value
                        )
                      }
                      placeholder="Email subject line"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Message"
                      value={recipient.options?.body || ''}
                      onChange={(e) =>
                        handleRecipientOptionChange(
                          index,
                          'body',
                          e.target.value
                        )
                      }
                      placeholder="Email message body"
                      multiline
                      rows={3}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>
      ))}

      {recipients.length === 0 && (
        <Alert severity="warning">
          No recipients configured. Add at least one recipient to receive
          scheduled reports.
        </Alert>
      )}
    </Box>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicSettings();
      case 1:
        return renderScheduleConfiguration();
      case 2:
        return renderRecipientsDelivery();
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
        <Box display="flex" alignItems="center" justifyContent="between">
          <Box display="flex" alignItems="center">
            <ScheduleIcon sx={{ mr: 1 }} />
            {initialSchedule ? 'Edit Schedule' : 'Schedule Report'}
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

        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Please fix the following errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>

        {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}

        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained">
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={errors.length > 0}
            startIcon={<ScheduleIcon />}
          >
            {initialSchedule ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
