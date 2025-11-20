import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Stack,
  Chip,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalHospital as LocalHospitalIcon,
  Phone as PhoneIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import type { DiagnosticResult } from '../types';

interface RedFlagAlertsProps {
  redFlags: DiagnosticResult['redFlags'];
  showActions?: boolean;
  onActionClick?: (
    flag: DiagnosticResult['redFlags'][0],
    action: string
  ) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    color: 'error' as const,
    icon: ErrorIcon,
    label: 'Critical',
    bgColor: 'error.light',
    textColor: 'error.contrastText',
    description: 'Immediate medical attention required',
  },
  high: {
    color: 'error' as const,
    icon: ErrorIcon,
    label: 'High Risk',
    bgColor: 'error.light',
    textColor: 'error.contrastText',
    description: 'Urgent medical evaluation needed',
  },
  medium: {
    color: 'warning' as const,
    icon: WarningIcon,
    label: 'Medium Risk',
    bgColor: 'warning.light',
    textColor: 'warning.contrastText',
    description: 'Medical attention recommended',
  },
  low: {
    color: 'info' as const,
    icon: InfoIcon,
    label: 'Low Risk',
    bgColor: 'info.light',
    textColor: 'info.contrastText',
    description: 'Monitor and follow up as needed',
  },
};

const ACTION_ICONS = {
  'immediate referral': LocalHospitalIcon,
  'call physician': PhoneIcon,
  'schedule follow-up': ScheduleIcon,
  'document findings': AssignmentIcon,
  'monitor closely': VisibilityIcon,
};

const RedFlagAlerts: React.FC<RedFlagAlertsProps> = ({
  redFlags,
  showActions = true,
  onActionClick,
}) => {
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set());
  const [hiddenFlags, setHiddenFlags] = useState<Set<number>>(new Set());

  const handleToggleExpand = (index: number) => {
    const newExpanded = new Set(expandedFlags);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFlags(newExpanded);
  };

  const handleToggleHide = (index: number) => {
    const newHidden = new Set(hiddenFlags);
    if (newHidden.has(index)) {
      newHidden.delete(index);
    } else {
      newHidden.add(index);
    }
    setHiddenFlags(newHidden);
  };

  const getSeverityConfig = (severity: string) => {
    return (
      SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ||
      SEVERITY_CONFIG.medium
    );
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    const iconKey = Object.keys(ACTION_ICONS).find((key) =>
      actionLower.includes(key)
    );
    return iconKey
      ? ACTION_ICONS[iconKey as keyof typeof ACTION_ICONS]
      : AssignmentIcon;
  };

  const sortedFlags = [...redFlags].sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return (
      (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
      (severityOrder[a.severity as keyof typeof severityOrder] || 0)
    );
  });

  const visibleFlags = sortedFlags.filter(
    (_, index) => !hiddenFlags.has(index)
  );
  const criticalCount = redFlags.filter(
    (flag) => flag.severity === 'critical'
  ).length;
  const highCount = redFlags.filter((flag) => flag.severity === 'high').length;

  if (redFlags.length === 0) {
    return null;
  }

  return (
    <Box>
      {/* Header with Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center' }}
        >
          <ErrorIcon sx={{ mr: 1, color: 'error.main' }} />
          Clinical Red Flags ({redFlags.length})
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {criticalCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${criticalCount} Critical`}
              color="error"
              variant="filled"
              size="small"
            />
          )}
          {highCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${highCount} High Risk`}
              color="error"
              variant="outlined"
              size="small"
            />
          )}
          <Chip
            label={`${redFlags.length} Total Flags`}
            variant="outlined"
            size="small"
          />
        </Box>

        {(criticalCount > 0 || highCount > 0) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Immediate Attention Required</AlertTitle>
            <Typography variant="body2">
              {criticalCount > 0 &&
                `${criticalCount} critical finding(s) detected. `}
              {highCount > 0 &&
                `${highCount} high-risk condition(s) identified. `}
              Review all red flags and take appropriate action immediately.
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Red Flag List */}
      <Stack spacing={2}>
        {visibleFlags.map((flag, index) => {
          const config = getSeverityConfig(flag.severity);
          const Icon = config.icon;
          const ActionIcon = getActionIcon(flag.action);
          const isExpanded = expandedFlags.has(index);

          return (
            <Paper
              key={index}
              elevation={flag.severity === 'critical' ? 3 : 1}
              sx={{
                border: flag.severity === 'critical' ? 2 : 1,
                borderColor: `${config.color}.main`,
                borderRadius: 2,
              }}
            >
              {/* Flag Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: config.bgColor,
                  color: config.textColor,
                  borderRadius: '8px 8px 0 0',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon sx={{ fontSize: 24 }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {flag.flag}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {config.description}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={config.label}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        color: 'inherit',
                        fontWeight: 600,
                      }}
                    />

                    <Tooltip
                      title={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleToggleExpand(index)}
                        sx={{ color: 'inherit' }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip
                      title={hiddenFlags.has(index) ? 'Show flag' : 'Hide flag'}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleToggleHide(index)}
                        sx={{ color: 'inherit' }}
                      >
                        {hiddenFlags.has(index) ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>

              {/* Flag Details */}
              <Collapse in={isExpanded}>
                <Box sx={{ p: 2 }}>
                  {/* Recommended Action */}
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ActionIcon sx={{ mr: 1, fontSize: 18 }} />
                      Recommended Action
                    </Typography>
                    <Alert severity={config.color} variant="outlined">
                      <Typography variant="body2">{flag.action}</Typography>
                    </Alert>
                  </Box>

                  {/* Action Buttons */}
                  {showActions && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {flag.severity === 'critical' && (
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          startIcon={<LocalHospitalIcon />}
                          onClick={() =>
                            onActionClick?.(flag, 'emergency_referral')
                          }
                        >
                          Emergency Referral
                        </Button>
                      )}

                      {(flag.severity === 'critical' ||
                        flag.severity === 'high') && (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<PhoneIcon />}
                          onClick={() =>
                            onActionClick?.(flag, 'call_physician')
                          }
                        >
                          Call Physician
                        </Button>
                      )}

                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<AssignmentIcon />}
                        onClick={() => onActionClick?.(flag, 'document')}
                      >
                        Document
                      </Button>

                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<ScheduleIcon />}
                        onClick={() =>
                          onActionClick?.(flag, 'schedule_followup')
                        }
                      >
                        Schedule Follow-up
                      </Button>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>

      {/* Hidden Flags Summary */}
      {hiddenFlags.size > 0 && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" variant="outlined">
            <Typography variant="body2">
              {hiddenFlags.size} flag(s) hidden. Click the visibility icon to
              show them again.
            </Typography>
            <Button
              size="small"
              onClick={() => setHiddenFlags(new Set())}
              sx={{ mt: 1 }}
            >
              Show All Flags
            </Button>
          </Alert>
        </Box>
      )}

      {/* Emergency Contact Information */}
      {(criticalCount > 0 || highCount > 0) && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="error">
            <AlertTitle>Emergency Protocols</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              For critical findings, ensure immediate medical evaluation:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <PhoneIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Emergency Services: 911"
                  secondary="For life-threatening conditions"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <LocalHospitalIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Nearest Emergency Department"
                  secondary="For urgent medical evaluation"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PhoneIcon color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary="On-call Physician"
                  secondary="For immediate consultation"
                />
              </ListItem>
            </List>
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default RedFlagAlerts;
