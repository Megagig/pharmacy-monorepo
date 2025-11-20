/**
 * Service Worker Update Notification Component
 * Shows notifications for service worker updates and offline status
 */

import React, { useState, useEffect } from 'react';
import { Alert, Button, Snackbar, Box, Typography, IconButton } from '@mui/material';
import { Refresh, Close, CloudOff, CloudQueue } from '@mui/icons-material';
import { useServiceWorker } from '../utils/serviceWorkerRegistration';

interface ServiceWorkerUpdateNotificationProps {
  onUpdate?: () => void;
  onOfflineReady?: () => void;
}

const ServiceWorkerUpdateNotification: React.FC<ServiceWorkerUpdateNotificationProps> = ({
  onUpdate,
  onOfflineReady,
}) => {
  const {
    updateAvailable,
    isOffline,
    skipWaiting,
    registered,
  } = useServiceWorker();

  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [showOfflineNotification, setShowOfflineNotification] = useState(false);
  const [showOfflineReady, setShowOfflineReady] = useState(false);

  // Handle update available
  useEffect(() => {
    if (updateAvailable) {
      setShowUpdateNotification(true);
      onUpdate?.();
    }
  }, [updateAvailable, onUpdate]);

  // Handle offline status
  useEffect(() => {
    if (isOffline) {
      setShowOfflineNotification(true);
    } else {
      setShowOfflineNotification(false);
    }
  }, [isOffline]);

  // Handle offline ready (first time service worker is installed)
  useEffect(() => {
    if (registered && !updateAvailable && !isOffline) {
      setShowOfflineReady(true);
      onOfflineReady?.();
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowOfflineReady(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [registered, updateAvailable, isOffline, onOfflineReady]);

  const handleUpdate = () => {
    skipWaiting();
    setShowUpdateNotification(false);
  };

  const handleCloseUpdate = () => {
    setShowUpdateNotification(false);
  };

  const handleCloseOfflineReady = () => {
    setShowOfflineReady(false);
  };

  return (
    <>
      {/* Update Available Notification */}
      <Snackbar
        open={showUpdateNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 2 }}
      >
        <Alert
          severity="info"
          variant="filled"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                startIcon={<Refresh />}
                onClick={handleUpdate}
                sx={{ color: 'white' }}
              >
                Update
              </Button>
              <IconButton
                size="small"
                color="inherit"
                onClick={handleCloseUpdate}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <Typography variant="body2">
            A new version of PharmacyCopilot is available!
          </Typography>
        </Alert>
      </Snackbar>

      {/* Offline Status Notification */}
      <Snackbar
        open={showOfflineNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          icon={<CloudOff />}
        >
          <Typography variant="body2">
            You're offline. Some features may be limited.
          </Typography>
        </Alert>
      </Snackbar>

      {/* Offline Ready Notification */}
      <Snackbar
        open={showOfflineReady}
        autoHideDuration={5000}
        onClose={handleCloseOfflineReady}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="success"
          variant="filled"
          icon={<CloudQueue />}
          onClose={handleCloseOfflineReady}
        >
          <Typography variant="body2">
            PharmacyCopilot is now available offline!
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default ServiceWorkerUpdateNotification;