import React from 'react';
import { Box, Chip, Tooltip, IconButton } from '@mui/material';
import {
  Wifi,
  WifiOff,
  Sync,
  Error as ErrorIcon,
  Refresh,
} from '@mui/icons-material';
import { useSocketConnection } from '../../hooks/useSocket';
import {
  socketService,
  ConnectionStatus as ConnectionStatusType,
} from '../../services/socketService';

interface ConnectionStatusProps {
  showDetails?: boolean;
  size?: 'small' | 'medium';
  variant?: 'chip' | 'icon' | 'full';
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  size = 'small',
  variant = 'chip',
}) => {
  const { connectionStatus, isConnected, connectionInfo } =
    useSocketConnection();

  const getStatusConfig = (status: ConnectionStatusType) => {
    switch (status) {
      case 'connected':
        return {
          color: 'success' as const,
          icon: <Wifi fontSize={size} />,
          label: 'Connected',
          tooltip: 'Real-time messaging is active',
        };
      case 'connecting':
        return {
          color: 'warning' as const,
          icon: <Sync fontSize={size} className="animate-spin" />,
          label: 'Connecting',
          tooltip: 'Establishing connection...',
        };
      case 'reconnecting':
        return {
          color: 'warning' as const,
          icon: <Sync fontSize={size} className="animate-spin" />,
          label: 'Reconnecting',
          tooltip: 'Attempting to reconnect...',
        };
      case 'disconnected':
        return {
          color: 'default' as const,
          icon: <WifiOff fontSize={size} />,
          label: 'Disconnected',
          tooltip: 'Real-time messaging is offline',
        };
      case 'error':
        return {
          color: 'error' as const,
          icon: <ErrorIcon fontSize={size} />,
          label: 'Error',
          tooltip: 'Connection error occurred',
        };
      default:
        return {
          color: 'default' as const,
          icon: <WifiOff fontSize={size} />,
          label: 'Unknown',
          tooltip: 'Connection status unknown',
        };
    }
  };

  const statusConfig = getStatusConfig(connectionStatus);

  const handleReconnect = () => {
    socketService.forceReconnect();
  };

  if (variant === 'icon') {
    return (
      <Tooltip title={statusConfig.tooltip}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color:
              statusConfig.color === 'success'
                ? 'success.main'
                : statusConfig.color === 'warning'
                ? 'warning.main'
                : statusConfig.color === 'error'
                ? 'error.main'
                : 'text.secondary',
          }}
        >
          {statusConfig.icon}
        </Box>
      </Tooltip>
    );
  }

  if (variant === 'chip') {
    return (
      <Tooltip title={statusConfig.tooltip}>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size={size}
          variant={isConnected ? 'filled' : 'outlined'}
        />
      </Tooltip>
    );
  }

  // Full variant with details
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color:
            statusConfig.color === 'success'
              ? 'success.main'
              : statusConfig.color === 'warning'
              ? 'warning.main'
              : statusConfig.color === 'error'
              ? 'error.main'
              : 'text.secondary',
        }}
      >
        {statusConfig.icon}
      </Box>

      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
          {statusConfig.label}
        </Box>

        {showDetails && (
          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {connectionInfo.socketId && (
              <div>Socket ID: {connectionInfo.socketId.slice(0, 8)}...</div>
            )}
            {connectionInfo.reconnectAttempts > 0 && (
              <div>Reconnect attempts: {connectionInfo.reconnectAttempts}</div>
            )}
            {connectionInfo.joinedConversations.length > 0 && (
              <div>
                Active conversations:{' '}
                {connectionInfo.joinedConversations.length}
              </div>
            )}
          </Box>
        )}
      </Box>

      {!isConnected && (
        <Tooltip title="Retry connection">
          <IconButton size="small" onClick={handleReconnect} sx={{ ml: 1 }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default ConnectionStatus;
