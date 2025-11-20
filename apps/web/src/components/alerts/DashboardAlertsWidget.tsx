/**
 * Dashboard Alerts Widget
 * Displays aggregated alerts on the dashboard
 * Requirements: 4.5
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Divider,
  Badge,
  Tooltip,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  PriorityHigh as PriorityHighIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { useDashboardAlerts } from '../../hooks/useAlerts';
import { DashboardAlert } from '../../types/alerts';

interface DashboardAlertsWidgetProps {
  userId?: string;
  assignedToMe?: boolean;
  onDismissAlert?: (alertId: string, reason?: string) => void;
  onAlertAction?: (alert: DashboardAlert) => void;
  maxAlerts?: number;
  showDismissed?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

const DashboardAlertsWidget: React.FC<DashboardAlertsWidgetProps> = ({
  userId,
  assignedToMe = false,
  onDismissAlert,
  onAlertAction,
  maxAlerts = 5,
  showDismissed = false,
  autoRefresh = true,
  refreshInterval = 300, // 5 minutes
}) => {
  const [expanded, setExpanded] = useState(true);
  const [dismissingAlerts, setDismissingAlerts] = useState<Set<string>>(new Set());

  const {
    data: alertsResponse,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useDashboardAlerts({
    assignedToMe,
    dismissed: showDismissed,
    limit: maxAlerts,
  }, {
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
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

  const handleAlertAction = (alert: DashboardAlert) => {
    if (onAlertAction) {
      onAlertAction(alert);
    } else if (alert.actionUrl) {
      window.open(alert.actionUrl, '_blank');
    }
  };

  const getAlertIcon = (type: DashboardAlert['type']) => {
    switch (type) {
      case 'appointments_today':
        return <ScheduleIcon />;
      case 'overdue_followups':
        return <AssignmentIcon />;
      case 'high_priority_tasks':
        return <PriorityHighIcon />;
      case 'capacity_warning':
        return <TrendingUpIcon />;
      case 'system_notification':
        return <NotificationsIcon />;
      case 'inventory_alert':
        return <InventoryIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: DashboardAlert['severity']) => {
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

  const formatAlertType = (type: DashboardAlert['type']) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTotalCriticalAlerts = () => {
    return alerts.filter(alert => alert.severity === 'critical' && !alert.dismissedAt).length;
  };

  if (isError) {
    return (
      <Card>
        <CardHeader
          title="Dashboard Alerts"
          avatar={<ErrorIcon color="error" />}
        />
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Error Loading Alerts</AlertTitle>
            Failed to load dashboard alerts. Please try again.
            <Button onClick={() => refetch()} sx={{ mt: 1 }}>
              Retry
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Badge badgeContent={getTotalCriticalAlerts()} color="error">
              <DashboardIcon color="primary" />
            </Badge>
            Dashboard Alerts
            {assignedToMe && (
              <Chip label="My Alerts" size="small" color="primary" variant="outlined" />
            )}
          </Box>
        }
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh alerts">
              <IconButton
                onClick={() => refetch()}
                disabled={isRefetching}
                size="small"
              >
                {isRefetching ? (
                  <CircularProgress size={16} />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        }
      />

      <CardContent>
        {/* Summary Statistics */}
        {summary && (
          <Box mb={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {summary.total}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Alerts
                  </Typography>
                </Box>
              </Grid>
              {Object.entries(summary.bySeverity).map(([severity, count]) => (
                <Grid item xs={12} sm={6} md={3} key={severity}>
                  <Box textAlign="center">
                    <Typography 
                      variant="h4" 
                      color={getSeverityColor(severity as DashboardAlert['severity']) + '.main'}
                    >
                      {count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Collapse in={expanded}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Loading alerts...
              </Typography>
            </Box>
          ) : alerts.length === 0 ? (
            <Alert severity="success">
              <AlertTitle>No Active Alerts</AlertTitle>
              {assignedToMe 
                ? "You have no active alerts at this time." 
                : "There are no active alerts for your workspace."}
            </Alert>
          ) : (
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
                          {alert.count && (
                            <Chip
                              label={`${alert.count} items`}
                              size="small"
                              color="primary"
                            />
                          )}
                        </Stack>
                      </Box>
                    </AlertTitle>
                    
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {alert.message}
                    </Typography>

                    {/* Alert metadata */}
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </Typography>
                      {alert.expiresAt && (
                        <Typography variant="caption" color="text.secondary">
                          Expires {format(new Date(alert.expiresAt), 'MMM dd')}
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
                      </Box>
                    )}
                  </Alert>
                  
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Stack>
          )}
        </Collapse>

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Auto-refreshing every {Math.floor(refreshInterval / 60)} minutes
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardAlertsWidget;