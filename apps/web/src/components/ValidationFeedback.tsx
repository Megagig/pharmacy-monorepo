import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Stack,
  Card,
  CardContent,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lightbulb as LightbulbIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  useDebouncedValidation,
} from '../utils/clinicalInterventionValidation';

// Props interfaces
interface ValidationFeedbackProps {
  fieldName: string;
  value: any;
  formData?: any;
  showWarnings?: boolean;
  showSuggestions?: boolean;
  realTime?: boolean;
  debounceDelay?: number;
  compact?: boolean;
  severity?: 'error' | 'warning' | 'info' | 'success';
}

interface ValidationSummaryProps {
  validationResults: ValidationResult[];
  fieldNames: string[];
  showProgress?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

interface ValidationProgressProps {
  totalFields: number;
  validFields: number;
  showPercentage?: boolean;
  showLabels?: boolean;
}

// Individual field validation feedback
export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  fieldName,
  value,
  formData,
  showWarnings = true,
  showSuggestions = true,
  realTime = true,
  debounceDelay = 300,
  compact = false,
  severity,
}) => {
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  // Use debounced validation for real-time feedback
  const validationResult = realTime
    ? useDebouncedValidation(fieldName, value, formData, debounceDelay)
    : { isValid: true, errors: [], warnings: [] };

  // Don't render if no validation issues and field is valid
  if (validationResult.isValid && validationResult.warnings.length === 0) {
    return null;
  }

  const hasErrors = validationResult.errors.length > 0;
  const hasWarnings = validationResult.warnings.length > 0;

  // Determine alert severity
  const alertSeverity =
    severity || (hasErrors ? 'error' : hasWarnings ? 'warning' : 'info');

  // Get appropriate icon
  const getIcon = () => {
    switch (alertSeverity) {
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'success':
        return <CheckCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };

  if (compact) {
    return (
      <Box sx={{ mt: 0.5 }}>
        {hasErrors && (
          <Typography
            variant="caption"
            color="error"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <ErrorIcon fontSize="small" />
            {validationResult.errors[0].message}
          </Typography>
        )}
        {!hasErrors && hasWarnings && showWarnings && (
          <Typography
            variant="caption"
            color="warning.main"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <WarningIcon fontSize="small" />
            {validationResult.warnings[0].message}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Alert
        severity={alertSeverity}
        sx={{
          '& .MuiAlert-message': { width: '100%' },
          bgcolor: alpha(theme.palette[alertSeverity].main, 0.1),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ flex: 1 }}>
            {/* Primary error/warning message */}
            {hasErrors && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 'medium', mb: 0.5 }}
              >
                {validationResult.errors[0].message}
              </Typography>
            )}
            {!hasErrors && hasWarnings && showWarnings && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 'medium', mb: 0.5 }}
              >
                {validationResult.warnings[0].message}
              </Typography>
            )}

            {/* Additional errors/warnings */}
            {(validationResult.errors.length > 1 ||
              validationResult.warnings.length > 1) && (
              <Box>
                <IconButton
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  sx={{ p: 0, ml: -0.5 }}
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                    {showDetails ? 'Hide' : 'Show'} details
                  </Typography>
                </IconButton>

                <Collapse in={showDetails}>
                  <List dense sx={{ mt: 1 }}>
                    {/* Additional errors */}
                    {validationResult.errors.slice(1).map((error, index) => (
                      <ListItem key={`error-${index}`} sx={{ py: 0.25, pl: 0 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <ErrorIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={error.message}
                          primaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}

                    {/* Warnings */}
                    {showWarnings &&
                      validationResult.warnings.map((warning, index) => (
                        <ListItem
                          key={`warning-${index}`}
                          sx={{ py: 0.25, pl: 0 }}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <WarningIcon fontSize="small" color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary={warning.message}
                            secondary={
                              showSuggestions && warning.suggestion
                                ? warning.suggestion
                                : undefined
                            }
                            primaryTypographyProps={{ variant: 'caption' }}
                            secondaryTypographyProps={{
                              variant: 'caption',
                              color: 'text.secondary',
                            }}
                          />
                        </ListItem>
                      ))}
                  </List>
                </Collapse>
              </Box>
            )}

            {/* Suggestions for single items */}
            {showSuggestions &&
              validationResult.warnings.length === 1 &&
              validationResult.warnings[0].suggestion && (
                <Box
                  sx={{
                    mt: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <LightbulbIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {validationResult.warnings[0].suggestion}
                  </Typography>
                </Box>
              )}
          </Box>

          {/* Error codes as chips */}
          <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
            {validationResult.errors.map((error, index) => (
              <Tooltip
                key={`error-code-${index}`}
                title={`Error Code: ${error.code}`}
              >
                <Chip
                  label={error.code}
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              </Tooltip>
            ))}
            {validationResult.warnings.map((warning, index) => (
              <Tooltip
                key={`warning-code-${index}`}
                title={`Warning Code: ${warning.code}`}
              >
                <Chip
                  label={warning.code}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 20 }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>
      </Alert>
    </Box>
  );
};

// Validation progress indicator
export const ValidationProgress: React.FC<ValidationProgressProps> = ({
  totalFields,
  validFields,
  showPercentage = true,
  showLabels = true,
}) => {
  const percentage = totalFields > 0 ? (validFields / totalFields) * 100 : 0;
  const theme = useTheme();

  const getProgressColor = () => {
    if (percentage === 100) return 'success';
    if (percentage >= 75) return 'info';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      {showLabels && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Form Validation Progress
          </Typography>
          {showPercentage && (
            <Typography variant="body2" color="text.secondary">
              {Math.round(percentage)}%
            </Typography>
          )}
        </Box>
      )}

      <LinearProgress
        variant="determinate"
        value={percentage}
        color={getProgressColor()}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: alpha(theme.palette.grey[300], 0.3),
        }}
      />

      {showLabels && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {validFields} of {totalFields} fields valid
        </Typography>
      )}
    </Box>
  );
};

// Comprehensive validation summary
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validationResults,
  fieldNames,
  showProgress = true,
  showDetails = false,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(showDetails);

  // Calculate summary statistics
  const totalFields = validationResults.length;
  const validFields = validationResults.filter(
    (result) => result.isValid
  ).length;
  const totalErrors = validationResults.reduce(
    (sum, result) => sum + result.errors.length,
    0
  );
  const totalWarnings = validationResults.reduce(
    (sum, result) => sum + result.warnings.length,
    0
  );

  const hasErrors = totalErrors > 0;
  const hasWarnings = totalWarnings > 0;
  const isFormValid = validFields === totalFields && !hasErrors;

  if (compact && isFormValid) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          bgcolor: 'success.50',
          borderRadius: 1,
        }}
      >
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="body2" color="success.main">
          All fields are valid
        </Typography>
      </Box>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: compact ? 1 : 2 }}>
        {/* Progress indicator */}
        {showProgress && !compact && (
          <ValidationProgress
            totalFields={totalFields}
            validFields={validFields}
            showPercentage={true}
            showLabels={true}
          />
        )}

        {/* Summary statistics */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: compact ? 0 : 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleIcon
              color={isFormValid ? 'success' : 'disabled'}
              fontSize="small"
            />
            <Typography variant="body2">
              {validFields}/{totalFields} Valid
            </Typography>
          </Box>

          {hasErrors && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ErrorIcon color="error" fontSize="small" />
              <Typography variant="body2" color="error">
                {totalErrors} Error{totalErrors !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {hasWarnings && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon color="warning" fontSize="small" />
              <Typography variant="body2" color="warning.main">
                {totalWarnings} Warning{totalWarnings !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {!compact && (hasErrors || hasWarnings) && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ ml: 'auto' }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>

        {/* Detailed validation results */}
        {!compact && (
          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              {validationResults.map((result, index) => {
                const fieldName = fieldNames[index] || `Field ${index + 1}`;

                if (result.isValid && result.warnings.length === 0) {
                  return null;
                }

                return (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1, fontWeight: 'medium' }}
                    >
                      {fieldName}
                    </Typography>

                    {/* Field errors */}
                    {result.errors.map((error, errorIndex) => (
                      <Alert
                        key={`error-${errorIndex}`}
                        severity="error"
                        sx={{ mb: 1 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="body2">
                            {error.message}
                          </Typography>
                          <Chip
                            label={error.code}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        </Box>
                      </Alert>
                    ))}

                    {/* Field warnings */}
                    {result.warnings.map((warning, warningIndex) => (
                      <Alert
                        key={`warning-${warningIndex}`}
                        severity="warning"
                        sx={{ mb: 1 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <Box>
                            <Typography variant="body2">
                              {warning.message}
                            </Typography>
                            {warning.suggestion && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ mt: 0.5, display: 'block' }}
                              >
                                💡 {warning.suggestion}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={warning.code}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </Box>
                      </Alert>
                    ))}
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        )}

        {/* Security notice for sanitization */}
        {!compact && (hasErrors || hasWarnings) && (
          <Box
            sx={{
              mt: 2,
              p: 1,
              bgcolor: 'info.50',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <SecurityIcon color="info" fontSize="small" />
            <Typography variant="caption" color="info.main">
              All input is automatically sanitized for security
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default {
  ValidationFeedback,
  ValidationProgress,
  ValidationSummary,
};
