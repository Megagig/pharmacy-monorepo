import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Validation types
export type ValidationSeverity = 'error' | 'warning' | 'info' | 'success';

export interface ValidationRule {
  id: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  validator: (value: any, formData?: any) => boolean;
  autoFix?: (value: any) => any;
  dependencies?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  infos: ValidationMessage[];
}

export interface ValidationMessage {
  id: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  canAutoFix?: boolean;
}

interface ValidationFeedbackProps {
  validationResult: ValidationResult;
  onAutoFix?: (fieldId: string) => void;
  onDismiss?: (messageId: string) => void;
  showDetails?: boolean;
  compact?: boolean;
}

interface FieldValidationProps {
  field: string;
  value: any;
  rules: ValidationRule[];
  formData?: any;
  showInline?: boolean;
  onValidationChange?: (field: string, result: ValidationResult) => void;
}

interface RealTimeValidatorProps {
  formData: any;
  rules: ValidationRule[];
  onValidationChange: (result: ValidationResult) => void;
  debounceMs?: number;
}

// Predefined validation rules for clinical notes
export const CLINICAL_NOTE_VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'patient_required',
    field: 'patient',
    message: 'Patient selection is required',
    severity: 'error',
    validator: (value) => !!value && !!value._id,
  },
  {
    id: 'title_required',
    field: 'title',
    message: 'Note title is required',
    severity: 'error',
    validator: (value) => !!value && value.trim().length >= 3,
  },
  {
    id: 'title_length',
    field: 'title',
    message: 'Title should be between 3 and 100 characters',
    severity: 'warning',
    validator: (value) => !value || (value.length >= 3 && value.length <= 100),
  },
  {
    id: 'type_required',
    field: 'type',
    message: 'Note type is required',
    severity: 'error',
    validator: (value) => !!value,
  },
  {
    id: 'content_required',
    field: 'content',
    message:
      'At least one content section (Subjective, Objective, Assessment, or Plan) is required',
    severity: 'error',
    validator: (value) => {
      if (!value) return false;
      return !!(
        value.subjective?.trim() ||
        value.objective?.trim() ||
        value.assessment?.trim() ||
        value.plan?.trim()
      );
    },
  },
  {
    id: 'subjective_length',
    field: 'content.subjective',
    message:
      'Subjective section is quite long. Consider breaking it into smaller sections.',
    severity: 'info',
    validator: (value) => !value || value.length <= 1000,
  },
  {
    id: 'followup_date_required',
    field: 'followUpDate',
    message: 'Follow-up date is required when follow-up is marked as needed',
    severity: 'error',
    validator: (value, formData) => {
      if (!formData?.followUpRequired) return true;
      return !!value;
    },
    dependencies: ['followUpRequired'],
  },
  {
    id: 'followup_date_future',
    field: 'followUpDate',
    message: 'Follow-up date should be in the future',
    severity: 'warning',
    validator: (value) => {
      if (!value) return true;
      return new Date(value) > new Date();
    },
  },
  {
    id: 'medications_format',
    field: 'medications',
    message: 'Invalid medication format detected',
    severity: 'warning',
    validator: (value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.every((med) => typeof med === 'string' || (med && med._id));
    },
  },
  {
    id: 'vital_signs_range',
    field: 'vitalSigns',
    message: 'Some vital signs appear to be outside normal ranges',
    severity: 'warning',
    validator: (value) => {
      if (!value) return true;

      const { bloodPressure, heartRate, temperature } = value;

      // Basic range checks
      if (bloodPressure) {
        const { systolic, diastolic } = bloodPressure;
        if (systolic && (systolic < 70 || systolic > 200)) return false;
        if (diastolic && (diastolic < 40 || diastolic > 120)) return false;
      }

      if (heartRate && (heartRate < 40 || heartRate > 150)) return false;
      if (temperature && (temperature < 35 || temperature > 42)) return false;

      return true;
    },
  },
  {
    id: 'attachments_size',
    field: 'attachments',
    message: 'Some attachments are very large and may take time to upload',
    severity: 'info',
    validator: (value) => {
      if (!value || !Array.isArray(value)) return true;
      const maxSize = 10 * 1024 * 1024; // 10MB
      return value.every((file) => !file.size || file.size <= maxSize);
    },
  },
];

// Validation engine
export class ClinicalNoteValidator {
  private rules: ValidationRule[];

  constructor(rules: ValidationRule[] = CLINICAL_NOTE_VALIDATION_RULES) {
    this.rules = rules;
  }

  validateField(field: string, value: any, formData?: any): ValidationResult {
    const fieldRules = this.rules.filter((rule) => rule.field === field);
    const messages: ValidationMessage[] = [];

    for (const rule of fieldRules) {
      // Check dependencies
      if (rule.dependencies) {
        const dependenciesMet = rule.dependencies.every((dep) => {
          const depValue = this.getNestedValue(formData, dep);
          return depValue !== undefined && depValue !== null;
        });

        if (!dependenciesMet) continue;
      }

      const isValid = rule.validator(value, formData);

      if (!isValid) {
        messages.push({
          id: rule.id,
          field: rule.field,
          message: rule.message,
          severity: rule.severity,
          canAutoFix: !!rule.autoFix,
        });
      }
    }

    return this.categorizeMessages(messages);
  }

  validateForm(formData: any): ValidationResult {
    const allMessages: ValidationMessage[] = [];
    const processedFields = new Set<string>();

    for (const rule of this.rules) {
      if (processedFields.has(rule.field)) continue;

      const value = this.getNestedValue(formData, rule.field);
      const fieldResult = this.validateField(rule.field, value, formData);

      allMessages.push(
        ...fieldResult.errors,
        ...fieldResult.warnings,
        ...fieldResult.infos
      );
      processedFields.add(rule.field);
    }

    return this.categorizeMessages(allMessages);
  }

  autoFix(field: string, value: any): any {
    const rule = this.rules.find((r) => r.field === field && r.autoFix);
    return rule ? rule.autoFix!(value) : value;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private categorizeMessages(messages: ValidationMessage[]): ValidationResult {
    const errors = messages.filter((m) => m.severity === 'error');
    const warnings = messages.filter((m) => m.severity === 'warning');
    const infos = messages.filter((m) => m.severity === 'info');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      infos,
    };
  }
}

// Validation feedback component
export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  validationResult,
  onAutoFix,
  onDismiss,
  showDetails = true,
  compact = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const renderMessages = (
    messages: ValidationMessage[],
    severity: ValidationSeverity
  ) => {
    if (messages.length === 0) return null;

    const getSeverityIcon = () => {
      switch (severity) {
        case 'error':
          return <ErrorIcon color="error" />;
        case 'warning':
          return <WarningIcon color="warning" />;
        case 'info':
          return <InfoIcon color="info" />;
        case 'success':
          return <CheckCircleIcon color="success" />;
      }
    };

    const getSeverityColor = () => {
      switch (severity) {
        case 'error':
          return 'error';
        case 'warning':
          return 'warning';
        case 'info':
          return 'info';
        case 'success':
          return 'success';
        default:
          return 'info';
      }
    };

    if (compact) {
      return (
        <Alert severity={getSeverityColor()} sx={{ mb: 1 }}>
          <Typography variant="body2">
            {messages.length} {severity}(s) found
          </Typography>
        </Alert>
      );
    }

    const sectionKey = `${severity}-section`;
    const isExpanded = expandedSections.has(sectionKey);

    return (
      <Alert
        severity={getSeverityColor()}
        sx={{ mb: 2 }}
        action={
          showDetails && messages.length > 1 ? (
            <IconButton size="small" onClick={() => toggleSection(sectionKey)}>
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : undefined
        }
      >
        <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getSeverityIcon()}
          {severity.charAt(0).toUpperCase() + severity.slice(1)}s
          <Chip label={messages.length} size="small" />
        </AlertTitle>

        {messages.length === 1 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2">{messages[0].message}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {messages[0].canAutoFix && onAutoFix && (
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => onAutoFix(messages[0].field)}
                >
                  Fix
                </Button>
              )}
              {onDismiss && (
                <IconButton
                  size="small"
                  onClick={() => onDismiss(messages[0].id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        ) : (
          <Collapse in={isExpanded || messages.length <= 3}>
            <List dense>
              {messages.map((message) => (
                <ListItem
                  key={message.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    py: 0.5,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {getSeverityIcon()}
                  </ListItemIcon>
                  <ListItemText
                    primary={message.message}
                    secondary={`Field: ${message.field}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                    {message.canAutoFix && onAutoFix && (
                      <Tooltip title="Auto-fix this issue">
                        <IconButton
                          size="small"
                          onClick={() => onAutoFix(message.field)}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onDismiss && (
                      <Tooltip title="Dismiss this message">
                        <IconButton
                          size="small"
                          onClick={() => onDismiss(message.id)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          </Collapse>
        )}
      </Alert>
    );
  };

  const { errors, warnings, infos } = validationResult;

  if (errors.length === 0 && warnings.length === 0 && infos.length === 0) {
    return null;
  }

  return (
    <Box>
      {renderMessages(errors, 'error')}
      {renderMessages(warnings, 'warning')}
      {renderMessages(infos, 'info')}
    </Box>
  );
};

// Field-level validation component
export const FieldValidation: React.FC<FieldValidationProps> = ({
  field,
  value,
  rules,
  formData,
  showInline = true,
  onValidationChange,
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    infos: [],
  });

  const validator = new ClinicalNoteValidator(rules);

  useEffect(() => {
    const result = validator.validateField(field, value, formData);
    setValidationResult(result);

    if (onValidationChange) {
      onValidationChange(field, result);
    }
  }, [field, value, formData, rules]);

  if (!showInline || validationResult.isValid) {
    return null;
  }

  const allMessages = [
    ...validationResult.errors,
    ...validationResult.warnings,
    ...validationResult.infos,
  ];

  return (
    <Box sx={{ mt: 0.5 }}>
      {allMessages.map((message) => (
        <FormHelperText
          key={message.id}
          error={message.severity === 'error'}
          sx={{
            color: message.severity === 'warning' ? 'warning.main' : undefined,
          }}
        >
          {message.message}
        </FormHelperText>
      ))}
    </Box>
  );
};

// Real-time validation hook
export const useRealTimeValidation = (
  formData: any,
  rules: ValidationRule[] = CLINICAL_NOTE_VALIDATION_RULES,
  debounceMs: number = 300
) => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    infos: [],
  });

  const validator = new ClinicalNoteValidator(rules);

  const validateForm = useCallback(() => {
    const result = validator.validateForm(formData);
    setValidationResult(result);
  }, [formData, validator]);

  useEffect(() => {
    const timeoutId = setTimeout(validateForm, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [validateForm, debounceMs]);

  const validateField = useCallback(
    (field: string, value: any) => {
      return validator.validateField(field, value, formData);
    },
    [formData, validator]
  );

  const autoFix = useCallback(
    (field: string, value: any) => {
      return validator.autoFix(field, value);
    },
    [validator]
  );

  return {
    validationResult,
    validateField,
    autoFix,
    isValid: validationResult.isValid,
    hasErrors: validationResult.errors.length > 0,
    hasWarnings: validationResult.warnings.length > 0,
  };
};

// Validation input adornment component
export const ValidationInputAdornment: React.FC<{
  validationResult: ValidationResult;
  position?: 'start' | 'end';
}> = ({ validationResult, position = 'end' }) => {
  const { errors, warnings } = validationResult;

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <InputAdornment position={position}>
        <CheckCircleIcon color="success" fontSize="small" />
      </InputAdornment>
    );
  }

  const icon =
    errors.length > 0 ? (
      <ErrorIcon color="error" fontSize="small" />
    ) : (
      <WarningIcon color="warning" fontSize="small" />
    );

  const tooltip =
    errors.length > 0
      ? `${errors.length} error(s)`
      : `${warnings.length} warning(s)`;

  return (
    <InputAdornment position={position}>
      <Tooltip title={tooltip}>{icon}</Tooltip>
    </InputAdornment>
  );
};

export default {
  ValidationFeedback,
  FieldValidation,
  ValidationInputAdornment,
  ClinicalNoteValidator,
  useRealTimeValidation,
  CLINICAL_NOTE_VALIDATION_RULES,
};
