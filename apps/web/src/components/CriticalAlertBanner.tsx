import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Snackbar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  LocalHospital as HospitalIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Types for critical alerts
interface CriticalAlert {
  id: string;
  type:
    | 'critical_result'
    | 'red_flag_detected'
    | 'urgent_referral_needed'
    | 'drug_interaction';
  severity: 'critical' | 'major' | 'moderate';
  orderId: string;
  patientId: string;
  patientName: string;
  patientMRN?: string;
  message: string;
  details: any;
  requiresImmediate: boolean;
  timestamp: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  aiInterpretation?: any;
}

interface NotificationPreferences {
  criticalAlerts: boolean;
  resultNotifications: boolean;
  orderReminders: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface CriticalAlertBannerProps {
  alerts: CriticalAlert[];
  onAlertAcknowledge: (alertId: string) => void;
  onAlertDismiss: (alertId: string) => void;
  onViewOrder: (orderId: string) => void;
  onScheduleReferral?: (alert: CriticalAlert) => void;
  onCreateCarePlan?: (alert: CriticalAlert) => void;
  onUpdatePreferences?: (preferences: Partial<NotificationPreferences>) => void;
  currentPreferences?: NotificationPreferences;
  className?: string;
}

const CriticalAlertBanner: React.FC<CriticalAlertBannerProps> = ({
  alerts,
  onAlertAcknowledge,
  onAlertDismiss,
  onViewOrder,
  onScheduleReferral,
  onCreateCarePlan,
  onUpdatePreferences,
  currentPreferences,
  className,
}) => {
  // State management
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set()
  );
  const [preferencesDialog, setPreferencesDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Filter out dismissed alerts and sort by severity and timestamp
  const visibleAlerts = alerts
    .filter((alert) => !dismissedAlerts.has(alert.id) && !alert.acknowledged)
    .sort((a, b) => {
      // Sort by severity first (critical > major > moderate)
      const severityOrder = { critical: 3, major: 2, moderate: 1 };
      const severityDiff =
        severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by timestamp (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // Auto-expand critical alerts
  useEffect(() => {
    const criticalAlerts = visibleAlerts
      .filter((alert) => alert.severity === 'critical')
      .map((alert) => alert.id);

    if (criticalAlerts.length > 0) {
      setExpandedAlerts((prev) => new Set([...prev, ...criticalAlerts]));
    }
  }, [visibleAlerts]);

  // Helper functions
  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'major':
        return 'error';
      case 'moderate':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon />;
      case 'major':
        return <WarningIcon />;
      case 'moderate':
        return <WarningIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const getAlertTypeLabel = (type: string): string => {
    switch (type) {
      case 'critical_result':
        return 'Critical Result';
      case 'red_flag_detected':
        return 'Red Flag Detected';
      case 'urgent_referral_needed':
        return 'Urgent Referral';
      case 'drug_interaction':
        return 'Drug Interaction';
      default:
        return type.replace('_', ' ').toUpperCase();
    }
  };

  const handleToggleExpand = (alertId: string) => {
    setExpandedAlerts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const handleAcknowledge = useCallback(
    (alert: CriticalAlert) => {
      onAlertAcknowledge(alert.id);
      setSnackbar({
        open: true,
        message: `Alert acknowledged for ${alert.patientName}`,
        severity: 'success',
      });
    },
    [onAlertAcknowledge]
  );

  const handleDismiss = useCallback(
    (alert: CriticalAlert) => {
      setDismissedAlerts((prev) => new Set([...prev, alert.id]));
      onAlertDismiss(alert.id);
      setSnackbar({
        open: true,
        message: `Alert dismissed for ${alert.patientName}`,
        severity: 'info',
      });
    },
    [onAlertDismiss]
  );

  const handleViewOrder = useCallback(
    (orderId: string) => {
      onViewOrder(orderId);
    },
    [onViewOrder]
  );

  const handleScheduleReferral = useCallback(
    (alert: CriticalAlert) => {
      onScheduleReferral?.(alert);
      setSnackbar({
        open: true,
        message: 'Referral scheduling initiated',
        severity: 'info',
      });
    },
    [onScheduleReferral]
  );

  const handleCreateCarePlan = useCallback(
    (alert: CriticalAlert) => {
      onCreateCarePlan?.(alert);
      setSnackbar({
        open: true,
        message: 'Care plan creation initiated',
        severity: 'info',
      });
    },
    [onCreateCarePlan]
  );

  // Don't render if no visible alerts
  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <Box className={className} sx={{ mb: 2 }}>
      {visibleAlerts.map((alert) => (
        <Paper
          key={alert.id}
          elevation={3}
          sx={{
            mb: 1,
            border:
              alert.severity === 'critical'
                ? '2px solid #dc2626'
                : '1px solid #e5e7eb',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Alert
            severity={getSeverityColor(alert.severity)}
            icon={getSeverityIcon(alert.severity)}
            action={
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton
                  size="small"
                  onClick={() => handleToggleExpand(alert.id)}
                  color="inherit"
                >
                  {expandedAlerts.has(alert.id) ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDismiss(alert)}
                  color="inherit"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            }
            sx={{
              '& .MuiAlert-message': { width: '100%' },
              backgroundColor:
                alert.severity === 'critical' ? '#fef2f2' : undefined,
            }}
          >
            <AlertTitle>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h6" component="span">
                  {alert.severity === 'critical' ? '🚨' : '⚠️'}{' '}
                  {getAlertTypeLabel(alert.type)}
                </Typography>
                <Chip
                  label={alert.severity.toUpperCase()}
                  color={getSeverityColor(alert.severity)}
                  size="small"
                />
                {alert.requiresImmediate && (
                  <Chip
                    label="IMMEDIATE ACTION REQUIRED"
                    color="error"
                    size="small"
                    variant="filled"
                  />
                )}
              </Box>
            </AlertTitle>

            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Patient:</strong> {alert.patientName}
                {alert.patientMRN && ` (MRN: ${alert.patientMRN})`}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Order:</strong> {alert.orderId}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {alert.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm')}
              </Typography>
            </Box>

            <Collapse in={expandedAlerts.has(alert.id)}>
              <Box
                sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.12)' }}
              >
                {/* Alert Details */}
                {alert.details && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Details:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {typeof alert.details === 'string'
                        ? alert.details
                        : JSON.stringify(alert.details, null, 2)}
                    </Typography>
                  </Box>
                )}

                {/* AI Interpretation Summary */}
                {alert.aiInterpretation && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      AI Interpretation Summary:
                    </Typography>
                    <List dense>
                      {alert.aiInterpretation.aiAnalysis?.confidenceScore && (
                        <ListItem>
                          <ListItemText
                            primary={`Confidence Score: ${alert.aiInterpretation.aiAnalysis.confidenceScore}%`}
                          />
                        </ListItem>
                      )}
                      {alert.aiInterpretation.aiAnalysis?.redFlags?.length >
                        0 && (
                        <ListItem>
                          <ListItemIcon>
                            <WarningIcon color="error" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${alert.aiInterpretation.aiAnalysis.redFlags.length} Red Flags Detected`}
                            secondary={alert.aiInterpretation.aiAnalysis.redFlags
                              .slice(0, 2)
                              .map((flag: any) => flag.flag)
                              .join(', ')}
                          />
                        </ListItem>
                      )}
                      {alert.aiInterpretation.aiAnalysis?.referralRecommendation
                        ?.recommended && (
                        <ListItem>
                          <ListItemIcon>
                            <HospitalIcon color="info" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`Referral to ${alert.aiInterpretation.aiAnalysis.referralRecommendation.specialty}`}
                            secondary={`Urgency: ${alert.aiInterpretation.aiAnalysis.referralRecommendation.urgency}`}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}

                {/* Action Buttons */}
                <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleViewOrder(alert.orderId)}
                    startIcon={<AssignmentIcon />}
                  >
                    View Order
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleAcknowledge(alert)}
                    color="success"
                  >
                    Acknowledge
                  </Button>

                  {alert.type === 'urgent_referral_needed' &&
                    onScheduleReferral && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleScheduleReferral(alert)}
                        startIcon={<ScheduleIcon />}
                        color="warning"
                      >
                        Schedule Referral
                      </Button>
                    )}

                  {onCreateCarePlan && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleCreateCarePlan(alert)}
                      startIcon={<AssignmentIcon />}
                    >
                      Create Care Plan
                    </Button>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Alert>
        </Paper>
      ))}

      {/* Notification Preferences Button */}
      {onUpdatePreferences && (
        <Box display="flex" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={<NotificationsIcon />}
            onClick={() => setPreferencesDialog(true)}
            variant="text"
          >
            Notification Settings
          </Button>
        </Box>
      )}

      {/* Notification Preferences Dialog */}
      <NotificationPreferencesDialog
        open={preferencesDialog}
        onClose={() => setPreferencesDialog(false)}
        preferences={currentPreferences}
        onSave={(preferences) => {
          onUpdatePreferences?.(preferences);
          setPreferencesDialog(false);
          setSnackbar({
            open: true,
            message: 'Notification preferences updated',
            severity: 'success',
          });
        }}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Notification Preferences Dialog Component
interface NotificationPreferencesDialogProps {
  open: boolean;
  onClose: () => void;
  preferences?: NotificationPreferences;
  onSave: (preferences: NotificationPreferences) => void;
}

const NotificationPreferencesDialog: React.FC<
  NotificationPreferencesDialogProps
> = ({ open, onClose, preferences, onSave }) => {
  const [localPreferences, setLocalPreferences] =
    useState<NotificationPreferences>({
      criticalAlerts: true,
      resultNotifications: true,
      orderReminders: true,
      email: true,
      sms: false,
      push: false,
      ...preferences,
    });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences({ ...localPreferences, ...preferences });
    }
  }, [preferences]);

  const handleSave = () => {
    onSave(localPreferences);
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <NotificationsIcon />
          Notification Preferences
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" gutterBottom>
            Alert Types
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.criticalAlerts}
                onChange={() => handleToggle('criticalAlerts')}
              />
            }
            label="Critical Alerts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.resultNotifications}
                onChange={() => handleToggle('resultNotifications')}
              />
            }
            label="Result Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.orderReminders}
                onChange={() => handleToggle('orderReminders')}
              />
            }
            label="Order Reminders"
          />

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Delivery Channels
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.email}
                onChange={() => handleToggle('email')}
              />
            }
            label="Email Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.sms}
                onChange={() => handleToggle('sms')}
              />
            }
            label="SMS Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={localPreferences.push}
                onChange={() => handleToggle('push')}
                disabled
              />
            }
            label="Push Notifications (Coming Soon)"
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Note: Critical alerts will always be delivered via email regardless
            of preferences. SMS notifications require a valid phone number in
            your profile.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Preferences
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CriticalAlertBanner;
