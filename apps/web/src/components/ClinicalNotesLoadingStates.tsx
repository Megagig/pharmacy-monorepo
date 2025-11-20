import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Stack,
  Chip,
  Alert,
  Button,
  Grid,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CloudSync as SyncIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

// Loading state types
export type LoadingStateType =
  | 'initial'
  | 'loading'
  | 'refreshing'
  | 'saving'
  | 'deleting'
  | 'uploading'
  | 'syncing'
  | 'searching'
  | 'filtering';

export type LoadingSize = 'small' | 'medium' | 'large';
export type LoadingVariant = 'circular' | 'linear' | 'skeleton' | 'overlay';

interface BaseLoadingProps {
  message?: string;
  size?: LoadingSize;
  variant?: LoadingVariant;
  fullScreen?: boolean;
  overlay?: boolean;
}

interface LoadingStateProps extends BaseLoadingProps {
  type: LoadingStateType;
  progress?: number;
  details?: string;
  onCancel?: () => void;
  showProgress?: boolean;
}

interface SkeletonLoadingProps {
  variant: 'table' | 'card' | 'form' | 'list' | 'dashboard';
  count?: number;
  animation?: 'pulse' | 'wave' | false;
}

interface ProgressIndicatorProps {
  value: number;
  label?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: LoadingSize;
  showPercentage?: boolean;
}

interface SyncStatusProps {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'offline';
  lastSyncTime?: Date;
  pendingCount?: number;
  onRetry?: () => void;
}

// Main loading state component
export const ClinicalNotesLoadingState: React.FC<LoadingStateProps> = ({
  type,
  message,
  size = 'medium',
  variant = 'circular',
  progress,
  details,
  onCancel,
  showProgress = false,
  fullScreen = false,
  overlay = false,
}) => {
  const theme = useTheme();

  const getLoadingMessage = () => {
    if (message) return message;

    switch (type) {
      case 'initial':
        return 'Loading clinical notes...';
      case 'loading':
        return 'Loading...';
      case 'refreshing':
        return 'Refreshing data...';
      case 'saving':
        return 'Saving note...';
      case 'deleting':
        return 'Deleting note...';
      case 'uploading':
        return 'Uploading files...';
      case 'syncing':
        return 'Syncing data...';
      case 'searching':
        return 'Searching notes...';
      case 'filtering':
        return 'Applying filters...';
      default:
        return 'Processing...';
    }
  };

  const getLoadingIcon = () => {
    const iconSize = size === 'small' ? 20 : size === 'medium' ? 32 : 48;

    switch (type) {
      case 'syncing':
        return (
          <SyncIcon
            sx={{ fontSize: iconSize, animation: 'spin 1s linear infinite' }}
          />
        );
      default:
        return <CircularProgress size={iconSize} />;
    }
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    p: size === 'small' ? 2 : size === 'medium' ? 3 : 4,
    ...(fullScreen && {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: alpha(theme.palette.background.default, 0.9),
      zIndex: 9999,
    }),
    ...(overlay && {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: alpha(theme.palette.background.paper, 0.8),
      zIndex: 1000,
    }),
  };

  if (variant === 'linear') {
    return (
      <Box sx={containerStyle}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {getLoadingMessage()}
        </Typography>
        <LinearProgress
          sx={{ width: '100%', maxWidth: 300 }}
          variant={
            showProgress && progress !== undefined
              ? 'determinate'
              : 'indeterminate'
          }
          value={progress}
        />
        {showProgress && progress !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        )}
        {details && (
          <Typography variant="caption" color="text.secondary">
            {details}
          </Typography>
        )}
        {onCancel && (
          <Button size="small" onClick={onCancel} sx={{ mt: 1 }}>
            Cancel
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={containerStyle}>
      {getLoadingIcon()}
      <Typography
        variant={size === 'small' ? 'body2' : 'body1'}
        color="text.secondary"
        textAlign="center"
      >
        {getLoadingMessage()}
      </Typography>
      {details && (
        <Typography variant="caption" color="text.secondary" textAlign="center">
          {details}
        </Typography>
      )}
      {showProgress && progress !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {Math.round(progress)}% complete
        </Typography>
      )}
      {onCancel && (
        <Button size="small" onClick={onCancel} sx={{ mt: 1 }}>
          Cancel
        </Button>
      )}
    </Box>
  );
};

// Skeleton loading component
export const ClinicalNotesSkeletonLoader: React.FC<SkeletonLoadingProps> = ({
  variant,
  count = 3,
  animation = 'wave',
}) => {
  const renderTableSkeleton = () => (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Skeleton
          variant="rectangular"
          width={200}
          height={40}
          animation={animation}
        />
        <Skeleton
          variant="rectangular"
          width={120}
          height={40}
          animation={animation}
        />
        <Skeleton
          variant="rectangular"
          width={100}
          height={40}
          animation={animation}
        />
      </Box>

      {/* Rows */}
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <Skeleton
            variant="rectangular"
            width="30%"
            height={48}
            animation={animation}
          />
          <Skeleton
            variant="rectangular"
            width="25%"
            height={48}
            animation={animation}
          />
          <Skeleton
            variant="rectangular"
            width="20%"
            height={48}
            animation={animation}
          />
          <Skeleton
            variant="rectangular"
            width="15%"
            height={48}
            animation={animation}
          />
          <Skeleton
            variant="rectangular"
            width="10%"
            height={48}
            animation={animation}
          />
        </Box>
      ))}
    </Box>
  );

  const renderCardSkeleton = () => (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <Card>
            <CardContent>
              <Skeleton
                variant="text"
                width="60%"
                height={24}
                animation={animation}
              />
              <Skeleton
                variant="text"
                width="40%"
                height={20}
                animation={animation}
              />
              <Skeleton
                variant="rectangular"
                width="100%"
                height={60}
                animation={animation}
                sx={{ my: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton
                  variant="rectangular"
                  width={60}
                  height={24}
                  animation={animation}
                />
                <Skeleton
                  variant="rectangular"
                  width={80}
                  height={24}
                  animation={animation}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderFormSkeleton = () => (
    <Box sx={{ maxWidth: 600 }}>
      <Skeleton
        variant="text"
        width="40%"
        height={32}
        animation={animation}
        sx={{ mb: 2 }}
      />

      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          <Skeleton
            variant="text"
            width="30%"
            height={20}
            animation={animation}
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={56}
            animation={animation}
          />
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Skeleton
          variant="rectangular"
          width={100}
          height={36}
          animation={animation}
        />
        <Skeleton
          variant="rectangular"
          width={80}
          height={36}
          animation={animation}
        />
      </Box>
    </Box>
  );

  const renderListSkeleton = () => (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
        >
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            animation={animation}
          />
          <Box sx={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="70%"
              height={20}
              animation={animation}
            />
            <Skeleton
              variant="text"
              width="50%"
              height={16}
              animation={animation}
            />
          </Box>
          <Skeleton
            variant="rectangular"
            width={60}
            height={24}
            animation={animation}
          />
        </Box>
      ))}
    </Box>
  );

  const renderDashboardSkeleton = () => (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Skeleton
          variant="text"
          width={200}
          height={32}
          animation={animation}
        />
        <Skeleton
          variant="rectangular"
          width={120}
          height={36}
          animation={animation}
        />
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Skeleton
                  variant="text"
                  width="60%"
                  height={20}
                  animation={animation}
                />
                <Skeleton
                  variant="text"
                  width="40%"
                  height={32}
                  animation={animation}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main Content */}
      {renderTableSkeleton()}
    </Box>
  );

  switch (variant) {
    case 'table':
      return renderTableSkeleton();
    case 'card':
      return renderCardSkeleton();
    case 'form':
      return renderFormSkeleton();
    case 'list':
      return renderListSkeleton();
    case 'dashboard':
      return renderDashboardSkeleton();
    default:
      return renderTableSkeleton();
  }
};

// Progress indicator component
export const ClinicalNotesProgressIndicator: React.FC<
  ProgressIndicatorProps
> = ({
  value,
  label,
  color = 'primary',
  size = 'medium',
  showPercentage = true,
}) => {
  const circularSize = size === 'small' ? 32 : size === 'medium' ? 48 : 64;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={value}
          size={circularSize}
          color={color}
          thickness={4}
        />
        {showPercentage && (
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant={size === 'small' ? 'caption' : 'body2'}
              component="div"
              color="text.secondary"
              fontWeight="medium"
            >
              {Math.round(value)}%
            </Typography>
          </Box>
        )}
      </Box>
      {label && (
        <Typography
          variant={size === 'small' ? 'caption' : 'body2'}
          color="text.secondary"
          textAlign="center"
        >
          {label}
        </Typography>
      )}
    </Box>
  );
};

// Sync status component
export const ClinicalNotesSyncStatus: React.FC<SyncStatusProps> = ({
  status,
  lastSyncTime,
  pendingCount = 0,
  onRetry,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          color: 'info' as const,
          icon: <SyncIcon sx={{ animation: 'spin 1s linear infinite' }} />,
          message: 'Syncing...',
          severity: 'info' as const,
        };
      case 'success':
        return {
          color: 'success' as const,
          icon: <CheckCircleIcon />,
          message: 'Synced',
          severity: 'success' as const,
        };
      case 'error':
        return {
          color: 'error' as const,
          icon: <ErrorIcon />,
          message: 'Sync failed',
          severity: 'error' as const,
        };
      case 'offline':
        return {
          color: 'warning' as const,
          icon: <WarningIcon />,
          message: 'Offline',
          severity: 'warning' as const,
        };
      default:
        return {
          color: 'default' as const,
          icon: <CheckCircleIcon />,
          message: 'Ready',
          severity: 'info' as const,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Alert
      severity={config.severity}
      icon={config.icon}
      sx={{ mb: 2 }}
      action={
        status === 'error' && onRetry ? (
          <Button size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {config.message}
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} pending`}
              size="small"
              color={config.color}
              sx={{ ml: 1 }}
            />
          )}
        </Typography>

        {lastSyncTime && status !== 'syncing' && (
          <Typography variant="caption" color="text.secondary">
            Last sync: {lastSyncTime.toLocaleString()}
          </Typography>
        )}

        {status === 'offline' && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            Changes will sync when connection is restored
          </Typography>
        )}
      </Box>
    </Alert>
  );
};

// Utility component for wrapping content with loading overlay
export const LoadingOverlay: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  type?: LoadingStateType;
}> = ({ loading, children, message, type = 'loading' }) => {
  return (
    <Box sx={{ position: 'relative' }}>
      {children}
      {loading && (
        <ClinicalNotesLoadingState
          type={type}
          message={message}
          overlay
          size="medium"
        />
      )}
    </Box>
  );
};

// CSS for animations
const globalStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject global styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = globalStyles;
  document.head.appendChild(styleSheet);
}

export default {
  ClinicalNotesLoadingState,
  ClinicalNotesSkeletonLoader,
  ClinicalNotesProgressIndicator,
  ClinicalNotesSyncStatus,
  LoadingOverlay,
};
