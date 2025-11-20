/**
 * Patient Alerts Panel
 * Displays contextual alerts for a specific patient
 * Requirements: 4.1, 4.2
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  PersonOff as PersonOffIcon,
  Inventory as InventoryIcon,
  Visibility as VisibilityIcon,
  EventBusy as EventBusyIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { usePatientAlerts } from '../../hooks/useAlerts';
import { PatientAlert } from '../../types/alerts';

interface PatientAlertsPanelProps {
  patientId: string;
  patientName?: string;
  onDismissAlert?: (alertId: string, reason?: string) => void;
  onAlertAction?: (alert: PatientAlert) => void;
  maxAlerts?: number;
  showDismissed?: boolean;
}

const PatientAlertsPanel: React.FC<PatientAlertsPanelProps> = ({
  patientId,
  patientName,
  onDismissAlert,
  onAlertAction,
  maxAlerts = 10,
  showDismissed = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [dismissingAlerts, setDismissingAlerts] = useState<Set<string>>(new Set());

  const {
    data: alertsResponse,
    isLoading,
    isError,
    refetch,
  } = usePatientAlerts(patientId, {
    dismissed: showDismissed,
    limit: maxAlerts,
  });

  const alerts = alertsResponse?.data?.alerts || [];
  const summary = alertsResponse?.data?.summary;

  const handleDismissAlert = async (alertId: string, reason?: string) => {
    if (!onDismissAlert) return;

    setDismissingAlerts(prev => new Set(prev).add(alertId));
    
    try {
      await onDismissAlert(alertId, reason);
      await refetch();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    } finally {
      setDismissingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  const handleAlertAction = (alert: PatientAlert) => {
    if (onAlertAction) {
      onAlertAction(alert);
    } else if (alert.actionUrl) {
      window.open(alert.actionUrl, '_blank');
    }
  };

  const getAlertIcon = (type: PatientAlert['type']) => {
    switch (type) {
      case 'overdue_appointment':
        return <ScheduleIcon />;
      case 'missed_appointment':
        return <EventBusyIcon />;
      case 'abnormal_vitals':
        return <LocalHospitalIcon />;
      case 'low_adherence':
        return <MedicationIcon />;
      case 'pending_lab_review':
        return <AssignmentIcon />;
      case 'overdue_followup':
        return <AssignmentIcon />;
      case 'preventive_care_due':
        return <LocalHospitalIcon />;
      case 'patient_inactive':
        return <PersonOffIcon />;
      case 'low_stock':
        return <InventoryIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: PatientAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  const formatAlertType = (type: PatientAlert['type']) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={2}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading alerts...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Error Loading Alerts</AlertTitle>
            Failed to load patient alerts. Please try again.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              Patient Alerts
              {patientName && (
                <Typography variant="body2" color="text.secondary">
                  - {patientName}
                </Typography>
              )}
            </Typography>
          </Box>
          <Alert severity="success">
            <AlertTitle>No Active Alerts</AlertTitle>
            This patient has no active alerts at this time.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Patient Alerts
            {patientName && (
              <Typography variant="body2" color="text.secondary">
                - {patientName}
              </Typography>
            )}
            <Chip 
              label={alerts.length} 
              size="small" 
              color={alerts.some(a => a.severity === 'critical') ? 'error' : 'warning'} 
            />
          </Typography>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="small"
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {summary && (
          <Box mb={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.entries(summary.bySeverity).map(([severity, count]) => (
                <Chip
                  key={severity}
                  label={`${severity}: ${count}`}
                  size="small"
                  variant="outlined"
                  color={getSeverityColor(severity as PatientAlert['severity'])}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Collapse in={expanded}>
          <Stack spacing={2}>
            {alerts.map((alert, index) => (
              <React.Fragment key={alert.id}>
                <Alert
                  severity={getSeverityColor(alert.severity)}
                  icon={getAlertIcon(alert.type)}
                  action={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {alert.actionUrl && (
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => handleAlertAction(alert)}
                          startIcon={<VisibilityIcon />}
                        >
                          View
                        </Button>
                      )}
                      {onDismissAlert && !alert.dismissedAt && (
                        <Tooltip title="Dismiss alert">
                          <IconButton
                            color="inherit"
                            size="small"
                            onClick={() => handleDismissAlert(alert.id)}
                            disabled={dismissingAlerts.has(alert.id)}
                          >
                            {dismissingAlerts.has(alert.id) ? (
                              <CircularProgress size={16} />
                            ) : (
                              <CloseIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  }
                >
                  <AlertTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <span>{alert.title}</span>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={formatAlertType(alert.type)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={alert.severity.toUpperCase()}
                          size="small"
                          color={getSeverityColor(alert.severity)}
                        />
                      </Stack>
                    </Box>
                  </AlertTitle>
                  
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {alert.message}
                  </Typography>

                  {/* Additional alert data */}
                  {alert.data && Object.keys(alert.data).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Details:
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {alert.type === 'abnormal_vitals' && alert.data.bpSystolic && (
                          <Chip
                            label={`BP: ${alert.data.bpSystolic}/${alert.data.bpDiastolic}`}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 1, mb: 0.5 }}
                          />
                        )}
                        {alert.type === 'low_adherence' && alert.data.adherenceRate && (
                          <Chip
                            label={`Adherence: ${alert.data.adherenceRate.toFixed(1)}%`}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 1, mb: 0.5 }}
                          />
                        )}
                        {alert.type === 'overdue_followup' && alert.data.daysPastDue && (
                          <Chip
                            label={`${alert.data.daysPastDue} days overdue`}
                            size="small"
                            variant="outlined"
                            color="error"
                            sx={{ mr: 1, mb: 0.5 }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Alert metadata */}
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </Typography>
                    {alert.expiresAt && (
                      <Typography variant="caption" color="text.secondary">
                        Expires {format(new Date(alert.expiresAt), 'MMM dd, yyyy')}
                      </Typography>
                    )}
                  </Box>

                  {alert.dismissedAt && (
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={`Dismissed ${formatDistanceToNow(new Date(alert.dismissedAt), { addSuffix: true })}`}
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                      {alert.dismissReason && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          Reason: {alert.dismissReason}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Alert>
                
                {index < alerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default PatientAlertsPanel;