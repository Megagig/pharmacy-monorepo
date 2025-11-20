import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  AlertTitle,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Button,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Card,
  CardContent,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CloudOff as CloudOffIcon,
  Cloud as CloudIcon,
  Sync as SyncIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface ClinicalNotesOfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showDetails?: boolean;
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

interface OfflineData {
  pendingNotes: number;
  draftNotes: number;
  queuedUploads: number;
  lastSyncTime: Date | null;
  totalOfflineSize: number;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress: number;
  syncError: string | null;
  offlineData: OfflineData;
}

const ClinicalNotesOfflineIndicator: React.FC<
  ClinicalNotesOfflineIndicatorProps
> = ({ position = 'top', showDetails = true, onSyncComplete, onSyncError }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    syncProgress: 0,
    syncError: null,
    offlineData: {
      pendingNotes: 0,
      draftNotes: 0,
      queuedUploads: 0,
      lastSyncTime: null,
      totalOfflineSize: 0,
    },
  });

  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus((prev) => ({
        ...prev,
        isOnline: true,
        syncError: null,
      }));
      setShowOfflineAlert(false);

      // Auto-sync when coming back online if there's pending data
      if (
        syncStatus.offlineData.pendingNotes > 0 ||
        syncStatus.offlineData.queuedUploads > 0
      ) {
        handleAutoSync();
      }
    };

    const handleOffline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: false }));
      setShowOfflineAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus.offlineData]);

  // Load offline data statistics
  useEffect(() => {
    const loadOfflineStats = async () => {
      try {
        // In a real implementation, this would query IndexedDB or localStorage
        const offlineData: OfflineData = {
          pendingNotes: parseInt(
            localStorage.getItem('clinical-notes-pending') || '0'
          ),
          draftNotes: parseInt(
            localStorage.getItem('clinical-notes-drafts') || '0'
          ),
          queuedUploads: parseInt(
            localStorage.getItem('clinical-notes-uploads') || '0'
          ),
          lastSyncTime: localStorage.getItem('clinical-notes-last-sync')
            ? new Date(localStorage.getItem('clinical-notes-last-sync')!)
            : null,
          totalOfflineSize: parseInt(
            localStorage.getItem('clinical-notes-size') || '0'
          ),
        };

        setSyncStatus((prev) => ({ ...prev, offlineData }));
      } catch (error) {
        console.error('Failed to load offline stats:', error);
      }
    };

    loadOfflineStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(loadOfflineStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when coming back online
  const handleAutoSync = useCallback(async () => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) return;

    try {
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: true,
        syncProgress: 0,
        syncError: null,
      }));

      // Simulate sync progress
      const totalItems =
        syncStatus.offlineData.pendingNotes +
        syncStatus.offlineData.queuedUploads;
      let completed = 0;

      // Sync pending notes
      for (let i = 0; i < syncStatus.offlineData.pendingNotes; i++) {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        completed++;
        setSyncStatus((prev) => ({
          ...prev,
          syncProgress: Math.round((completed / totalItems) * 100),
        }));
      }

      // Sync queued uploads
      for (let i = 0; i < syncStatus.offlineData.queuedUploads; i++) {
        // Simulate upload delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        completed++;
        setSyncStatus((prev) => ({
          ...prev,
          syncProgress: Math.round((completed / totalItems) * 100),
        }));
      }

      // Update offline data after successful sync
      const updatedOfflineData: OfflineData = {
        ...syncStatus.offlineData,
        pendingNotes: 0,
        queuedUploads: 0,
        lastSyncTime: new Date(),
      };

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        syncProgress: 100,
        offlineData: updatedOfflineData,
      }));

      // Update localStorage
      localStorage.setItem('clinical-notes-pending', '0');
      localStorage.setItem('clinical-notes-uploads', '0');
      localStorage.setItem(
        'clinical-notes-last-sync',
        new Date().toISOString()
      );

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Sync failed';
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
      }));

      if (onSyncError && error instanceof Error) {
        onSyncError(error);
      }
    }
  }, [
    syncStatus.isOnline,
    syncStatus.isSyncing,
    syncStatus.offlineData,
    onSyncComplete,
    onSyncError,
  ]);

  // Manual sync
  const handleManualSync = useCallback(async () => {
    setShowSyncDialog(true);
    await handleAutoSync();
    setTimeout(() => setShowSyncDialog(false), 1000);
  }, [handleAutoSync]);

  // Get status configuration
  const getStatusConfig = () => {
    if (!syncStatus.isOnline) {
      return {
        color: 'error' as const,
        icon: <CloudOffIcon />,
        message: 'Offline',
        description: 'Working offline - changes will sync when connected',
      };
    }

    if (syncStatus.isSyncing) {
      return {
        color: 'info' as const,
        icon: <SyncIcon sx={{ animation: 'spin 1s linear infinite' }} />,
        message: 'Syncing...',
        description: `Syncing clinical notes (${syncStatus.syncProgress}%)`,
      };
    }

    if (syncStatus.syncError) {
      return {
        color: 'error' as const,
        icon: <ErrorIcon />,
        message: 'Sync Error',
        description: syncStatus.syncError,
      };
    }

    const hasPendingData =
      syncStatus.offlineData.pendingNotes > 0 ||
      syncStatus.offlineData.queuedUploads > 0;

    if (hasPendingData) {
      return {
        color: 'warning' as const,
        icon: <WarningIcon />,
        message: 'Pending Sync',
        description: `${
          syncStatus.offlineData.pendingNotes +
          syncStatus.offlineData.queuedUploads
        } items pending`,
      };
    }

    return {
      color: 'success' as const,
      icon: <CheckCircleIcon />,
      message: 'Synced',
      description: 'All clinical notes are up to date',
    };
  };

  const statusConfig = getStatusConfig();
  const hasPendingData =
    syncStatus.offlineData.pendingNotes > 0 ||
    syncStatus.offlineData.queuedUploads > 0 ||
    syncStatus.offlineData.draftNotes > 0;

  return (
    <>
      {/* Offline Alert Snackbar */}
      <Snackbar
        open={showOfflineAlert}
        anchorOrigin={{ vertical: position, horizontal: 'center' }}
        autoHideDuration={null}
      >
        <Alert
          severity="warning"
          icon={<CloudOffIcon />}
          action={
            showDetails && (
              <IconButton
                size="small"
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                sx={{ color: 'inherit' }}
              >
                {showDetailsPanel ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )
          }
        >
          <AlertTitle>Working Offline</AlertTitle>
          <Typography variant="body2">
            Clinical notes will be saved locally and synced when connection is
            restored
          </Typography>
          {hasPendingData && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              {syncStatus.offlineData.pendingNotes +
                syncStatus.offlineData.queuedUploads}{' '}
              items pending sync
            </Typography>
          )}
        </Alert>
      </Snackbar>

      {/* Status Indicator */}
      <Box
        sx={{
          position: 'fixed',
          [position]: 16,
          right: 16,
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Tooltip title={statusConfig.description}>
          <Chip
            icon={statusConfig.icon}
            label={statusConfig.message}
            color={statusConfig.color}
            size="small"
            onClick={
              showDetails
                ? () => setShowDetailsPanel(!showDetailsPanel)
                : undefined
            }
            sx={{
              cursor: showDetails ? 'pointer' : 'default',
              '& .MuiChip-icon': {
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              },
            }}
          />
        </Tooltip>

        {hasPendingData && (
          <Chip
            label={
              syncStatus.offlineData.pendingNotes +
              syncStatus.offlineData.queuedUploads
            }
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>

      {/* Details Panel */}
      {showDetails && (
        <Collapse in={showDetailsPanel}>
          <Card
            sx={{
              position: 'fixed',
              [position]: position === 'top' ? 60 : 60,
              right: 16,
              zIndex: 1299,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: 3,
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Clinical Notes Sync Status
              </Typography>

              {/* Connection Status */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
              >
                {statusConfig.icon}
                <Typography variant="body2" fontWeight="medium">
                  {statusConfig.message}
                </Typography>
              </Box>

              {/* Sync Progress */}
              {syncStatus.isSyncing && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    gutterBottom
                  >
                    Syncing clinical notes...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={syncStatus.syncProgress}
                    sx={{ mt: 0.5, mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {syncStatus.syncProgress}% complete
                  </Typography>
                </Box>
              )}

              {/* Offline Data Summary */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Offline Data:
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0.25, px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ScheduleIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${syncStatus.offlineData.pendingNotes} pending notes`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>

                  <ListItem sx={{ py: 0.25, px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <StorageIcon fontSize="small" color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${syncStatus.offlineData.draftNotes} draft notes`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>

                  <ListItem sx={{ py: 0.25, px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CloudIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${syncStatus.offlineData.queuedUploads} queued uploads`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </List>
              </Box>

              {/* Last Sync Time */}
              {syncStatus.offlineData.lastSyncTime && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 2, display: 'block' }}
                >
                  Last sync:{' '}
                  {syncStatus.offlineData.lastSyncTime.toLocaleString()}
                </Typography>
              )}

              {/* Error Message */}
              {syncStatus.syncError && (
                <Alert severity="error" size="small" sx={{ mb: 2 }}>
                  {syncStatus.syncError}
                </Alert>
              )}

              {/* Actions */}
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={handleManualSync}
                  disabled={!syncStatus.isOnline || syncStatus.isSyncing}
                >
                  Sync Now
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<InfoIcon />}
                  onClick={() => {
                    // Show help dialog or navigate to help page

                  }}
                >
                  Help
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Collapse>
      )}

      {/* Sync Progress Dialog */}
      <Dialog
        open={showSyncDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>Syncing Clinical Notes</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Syncing your offline clinical notes and uploads...
            </Typography>

            <LinearProgress
              variant="determinate"
              value={syncStatus.syncProgress}
              sx={{ mt: 2, mb: 1 }}
            />

            <Typography variant="caption" color="text.secondary">
              {syncStatus.syncProgress}% complete
            </Typography>

            {syncStatus.syncProgress === 100 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                Sync completed successfully!
              </Alert>
            )}
          </Box>
        </DialogContent>

        {syncStatus.syncProgress === 100 && (
          <DialogActions>
            <Button onClick={() => setShowSyncDialog(false)}>Close</Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
};

export default ClinicalNotesOfflineIndicator;
