/**
 * Offline indicator component for showing connection status
 * and sync progress
 */

import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Typography,
  Zoom,
} from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import { syncService } from '../../services/syncService';
import { useResponsive } from '../../hooks/useResponsive';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showDetails?: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top',
  showDetails = false,
}) => {
  const { isMobile } = useResponsive();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    isOnline: true,
    syncInProgress: false,
    queueLength: 0,
  });
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [showSyncSnackbar, setShowSyncSnackbar] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync events
    const unsubscribe = syncService.onSync((result) => {
      setLastSyncResult(result);
      setShowSyncSnackbar(true);
      updateSyncStatus();
    });

    // Initial sync status
    updateSyncStatus();

    // Update sync status periodically
    const interval = setInterval(updateSyncStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      await syncService.forcSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  if (isOnline && syncStatus.queueLength === 0 && !showDetails) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'error';
    if (syncStatus.syncInProgress) return 'info';
    if (syncStatus.queueLength > 0) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline - Changes will sync when connected';
    if (syncStatus.syncInProgress) return 'Syncing changes...';
    if (syncStatus.queueLength > 0)
      return `${syncStatus.queueLength} changes pending sync`;
    return 'All changes synced';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <CloudOffIcon />;
    if (syncStatus.syncInProgress) return <CircularProgress size={20} />;
    if (syncStatus.queueLength > 0) return <SyncIcon />;
    return <CloudDoneIcon />;
  };

  return (
    <>
      <Zoom in={true}>
        <Paper
          elevation={2}
          sx={{
            position: 'fixed',
            [position]: isMobile ? 8 : 16,
            left: isMobile ? 8 : 16,
            right: isMobile ? 8 : 'auto',
            zIndex: 1300,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Alert
            severity={getStatusColor()}
            icon={getStatusIcon()}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isOnline && syncStatus.queueLength > 0 && (
                  <IconButton
                    size="small"
                    onClick={handleManualSync}
                    disabled={syncStatus.syncInProgress}
                    color="inherit"
                  >
                    <RefreshIcon />
                  </IconButton>
                )}
                {showDetails && (
                  <IconButton
                    size="small"
                    onClick={() => setShowSyncDetails(!showSyncDetails)}
                    color="inherit"
                  >
                    {showSyncDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )}
              </Box>
            }
            sx={{
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {getStatusText()}
            </Typography>

            <Collapse in={showSyncDetails}>
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Connection Status
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={isOnline ? 'Online' : 'Offline'}
                    color={isOnline ? 'success' : 'error'}
                    variant="outlined"
                  />
                  {syncStatus.queueLength > 0 && (
                    <Chip
                      size="small"
                      label={`${syncStatus.queueLength} pending`}
                      color="warning"
                      variant="outlined"
                    />
                  )}
                  {syncStatus.syncInProgress && (
                    <Chip
                      size="small"
                      label="Syncing"
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Box>

                {lastSyncResult && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      Last Sync Result
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {lastSyncResult?.synced || 0} synced,{' '}
                      {lastSyncResult?.failed || 0} failed
                    </Typography>
                    {lastSyncResult?.errors &&
                      lastSyncResult.errors.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="error.main">
                            Errors:
                          </Typography>
                          {lastSyncResult?.errors
                            ?.slice(0, 3)
                            .map((error: string, index: number) => (
                              <Typography
                                key={index}
                                variant="caption"
                                sx={{ display: 'block', color: 'error.main' }}
                              >
                                • {error}
                              </Typography>
                            ))}
                          {lastSyncResult?.errors &&
                            lastSyncResult.errors.length > 3 && (
                              <Typography variant="caption" color="error.main">
                                ... and {lastSyncResult.errors.length - 3} more
                              </Typography>
                            )}
                        </Box>
                      )}
                  </Box>
                )}

                {isOnline && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    onClick={handleManualSync}
                    disabled={syncStatus.syncInProgress}
                    sx={{ mt: 1 }}
                  >
                    Sync Now
                  </Button>
                )}
              </Box>
            </Collapse>
          </Alert>

          {syncStatus.syncInProgress && (
            <LinearProgress
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
              }}
            />
          )}
        </Paper>
      </Zoom>

      {/* Sync result snackbar */}
      <Snackbar
        open={showSyncSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSyncSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSyncSnackbar(false)}
          severity={lastSyncResult?.success ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {lastSyncResult?.success
            ? `Sync completed: ${lastSyncResult?.synced || 0} items synced`
            : `Sync failed: ${lastSyncResult?.failed || 0} errors`}
        </Alert>
      </Snackbar>
    </>
  );
};

export default OfflineIndicator;
