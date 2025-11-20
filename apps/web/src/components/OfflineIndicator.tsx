import React, { useState, useEffect } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  CloudOff as CloudOffIcon,
  Cloud as CloudIcon,
  Sync as SyncIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { offlineStorage, offlineUtils } from '../utils/offlineStorage';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showDetails?: boolean;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingInterventions: number;
  lastSyncTime: Date | null;
  syncError: string | null;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top',
  showDetails = true,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingInterventions: 0,
    lastSyncTime: null,
    syncError: null,
  });

  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [storageStats, setStorageStats] = useState({
    offlineInterventions: 0,
    formDrafts: 0,
    cacheEntries: 0,
  });

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus((prev) => ({ ...prev, isOnline: true, syncError: null }));
      setShowOfflineAlert(false);

      // Trigger background sync when coming back online
      if (syncStatus.pendingInterventions > 0) {
        handleBackgroundSync();
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
  }, [syncStatus.pendingInterventions]);

  // Listen for service worker messages
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case 'INTERVENTION_SYNCED':
          setSyncStatus((prev) => ({
            ...prev,
            pendingInterventions: Math.max(0, prev.pendingInterventions - 1),
            lastSyncTime: new Date(),
            syncError: data.success ? null : 'Sync failed',
          }));
          break;

        case 'SYNC_STARTED':
          setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
          break;

        case 'SYNC_COMPLETED':
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            lastSyncTime: new Date(),
            syncError: data.error || null,
          }));
          break;

        default:
          break;
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'message',
        handleServiceWorkerMessage
      );
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener(
          'message',
          handleServiceWorkerMessage
        );
      }
    };
  }, []);

  // Load storage statistics
  useEffect(() => {
    const loadStorageStats = async () => {
      try {
        const stats = await offlineStorage.getStorageStats();
        setStorageStats(stats);
        setSyncStatus((prev) => ({
          ...prev,
          pendingInterventions: stats.offlineInterventions,
        }));
      } catch (error) {
        console.error('Failed to load storage stats:', error);
      }
    };

    loadStorageStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStorageStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBackgroundSync = async () => {
    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      await offlineUtils.requestBackgroundSync('intervention-sync');
    } catch (error) {
      console.error('Failed to trigger background sync:', error);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: 'Failed to start sync',
      }));
    }
  };

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

      // Get offline interventions and attempt to sync them
      const offlineInterventions =
        await offlineStorage.getOfflineInterventions();

      for (const intervention of offlineInterventions) {
        try {
          const response = await fetch('/api/clinical-interventions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: intervention.authToken,
            },
            body: JSON.stringify(intervention.data),
          });

          if (response.ok) {
            await offlineStorage.removeOfflineIntervention(intervention.id);
            setSyncStatus((prev) => ({
              ...prev,
              pendingInterventions: Math.max(0, prev.pendingInterventions - 1),
            }));
          }
        } catch (error) {
          console.error('Failed to sync intervention:', error);
        }
      }

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncError: null,
      }));
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: 'Manual sync failed',
      }));
    }
  };

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'error';
    if (syncStatus.isSyncing) return 'info';
    if (syncStatus.pendingInterventions > 0) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.isSyncing) return 'Syncing...';
    if (syncStatus.pendingInterventions > 0)
      return `${syncStatus.pendingInterventions} pending`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return <CloudOffIcon />;
    if (syncStatus.isSyncing) return <SyncIcon className="animate-spin" />;
    return <CloudIcon />;
  };

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
          <Typography variant="body2" fontWeight="medium">
            You're offline
          </Typography>
          <Typography variant="caption">
            Changes will sync when connection is restored
          </Typography>
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
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          color={getStatusColor()}
          size="small"
          onClick={
            showDetails
              ? () => setShowDetailsPanel(!showDetailsPanel)
              : undefined
          }
          sx={{
            cursor: showDetails ? 'pointer' : 'default',
            '& .animate-spin': {
              animation: 'spin 1s linear infinite',
            },
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        />
      </Box>

      {/* Details Panel */}
      {showDetails && (
        <Collapse in={showDetailsPanel}>
          <Box
            sx={{
              position: 'fixed',
              [position]: position === 'top' ? 60 : 60,
              right: 16,
              zIndex: 1299,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
              minWidth: 280,
              boxShadow: 3,
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Sync Status
            </Typography>

            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {syncStatus.isOnline ? (
                <CloudIcon color="success" />
              ) : (
                <CloudOffIcon color="error" />
              )}
              <Typography variant="body2">
                {syncStatus.isOnline ? 'Connected' : 'Disconnected'}
              </Typography>
            </Box>

            {/* Sync Progress */}
            {syncStatus.isSyncing && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Syncing interventions...
                </Typography>
                <LinearProgress size="small" sx={{ mt: 0.5 }} />
              </Box>
            )}

            {/* Pending Items */}
            {syncStatus.pendingInterventions > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="warning.main">
                  {syncStatus.pendingInterventions} intervention(s) pending sync
                </Typography>
              </Box>
            )}

            {/* Storage Stats */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Offline Storage:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption">
                  • {storageStats.offlineInterventions} interventions queued
                </Typography>
                <Typography variant="caption">
                  • {storageStats.formDrafts} form drafts saved
                </Typography>
                <Typography variant="caption">
                  • {storageStats.cacheEntries} cached items
                </Typography>
              </Box>
            </Box>

            {/* Last Sync Time */}
            {syncStatus.lastSyncTime && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                Last sync: {syncStatus.lastSyncTime.toLocaleTimeString()}
              </Typography>
            )}

            {/* Error Message */}
            {syncStatus.syncError && (
              <Alert severity="error" size="small" sx={{ mb: 1 }}>
                {syncStatus.syncError}
              </Alert>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleManualSync}
                disabled={!syncStatus.isOnline || syncStatus.isSyncing}
              >
                Sync Now
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<InfoIcon />}
                onClick={() => {
                  // Show offline help dialog

                }}
              >
                Help
              </Button>
            </Box>
          </Box>
        </Collapse>
      )}
    </>
  );
};

export default OfflineIndicator;
