import React from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Skeleton,
  CircularProgress,
  Collapse,
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OfflineIcon from '@mui/icons-material/WifiOff';
import ServerErrorIcon from '@mui/icons-material/CloudOff';
import PermissionIcon from '@mui/icons-material/Lock';
import NotFoundIcon from '@mui/icons-material/Search';

export interface ErrorDisplayProps {
  error?: Error | string | null;
  title?: string;
  message?: string;
  type?:
    | 'error'
    | 'warning'
    | 'info'
    | 'network'
    | 'permission'
    | 'notFound'
    | 'server';
  retry?: () => void;
  retryLabel?: string;
  showDetails?: boolean;
  onClose?: () => void;
}

/**
 * Enhanced error display component with different error types and retry functionality
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title,
  message,
  type = 'error',
  retry,
  retryLabel = 'Try Again',
  showDetails = false,
  onClose,
}) => {
  const [showDetailedError, setShowDetailedError] = React.useState(false);

  if (!error && !message) return null;

  const getErrorIcon = () => {
    switch (type) {
      case 'network':
        return <OfflineIcon />;
      case 'server':
        return <ServerErrorIcon />;
      case 'permission':
        return <PermissionIcon />;
      case 'notFound':
        return <NotFoundIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return <ErrorIcon />;
    }
  };

  const getErrorSeverity = () => {
    switch (type) {
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'error';
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'network':
        return 'Network Error';
      case 'server':
        return 'Server Error';
      case 'permission':
        return 'Access Denied';
      case 'notFound':
        return 'Not Found';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      default:
        return 'Error';
    }
  };

  const getDefaultMessage = () => {
    const errorMessage = typeof error === 'string' ? error : error?.message;

    if (message) return message;
    if (errorMessage) return errorMessage;

    switch (type) {
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'server':
        return 'The server is currently unavailable. Please try again later.';
      case 'permission':
        return 'You do not have permission to access this resource.';
      case 'notFound':
        return 'The requested resource could not be found.';
      default:
        return 'An unexpected error occurred.';
    }
  };

  const errorDetails =
    typeof error === 'object' && error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : null;

  return (
    <Alert
      severity={getErrorSeverity()}
      icon={getErrorIcon()}
      onClose={onClose}
      sx={{ mb: 2 }}
    >
      <AlertTitle>{title || getDefaultTitle()}</AlertTitle>

      <Typography variant="body2" sx={{ mb: showDetails || retry ? 2 : 0 }}>
        {getDefaultMessage()}
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center">
        {retry && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={retry}
          >
            {retryLabel}
          </Button>
        )}

        {showDetails && errorDetails && (
          <Button
            size="small"
            variant="text"
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transform: showDetailedError
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            }
            onClick={() => setShowDetailedError(!showDetailedError)}
          >
            Details
          </Button>
        )}
      </Stack>

      {showDetails && errorDetails && (
        <Collapse in={showDetailedError}>
          <Box
            sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1 }}
          >
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
              }}
            >
              {errorDetails.name}: {errorDetails.message}
              {errorDetails.stack && `\n\n${errorDetails.stack}`}
            </Typography>
          </Box>
        </Collapse>
      )}
    </Alert>
  );
};

/**
 * Network error component for offline/connection issues
 */
export const NetworkErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'type'>> = (
  props
) => <ErrorDisplay {...props} type="network" />;

/**
 * Permission error component for access denied scenarios
 */
export const PermissionErrorDisplay: React.FC<
  Omit<ErrorDisplayProps, 'type'>
> = (props) => <ErrorDisplay {...props} type="permission" />;

/**
 * Not found error component for missing resources
 */
export const NotFoundErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'type'>> = (
  props
) => <ErrorDisplay {...props} type="notFound" />;

/**
 * Server error component for backend issues
 */
export const ServerErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'type'>> = (
  props
) => <ErrorDisplay {...props} type="server" />;

export interface LoadingSkeletonProps {
  variant?: 'list' | 'card' | 'table' | 'form' | 'detail';
  count?: number;
  height?: number | string;
  animation?: 'pulse' | 'wave' | false;
}

/**
 * Versatile loading skeleton component for different UI patterns
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 1,
  height = 100,
  animation = 'wave',
}) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'list':
        return (
          <Stack spacing={2}>
            {Array.from({ length: count }).map((_, index) => (
              <Box
                key={index}
                sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
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
                    sx={{ fontSize: '1rem' }}
                    animation={animation}
                  />
                  <Skeleton
                    variant="text"
                    sx={{ fontSize: '0.875rem' }}
                    width="60%"
                    animation={animation}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        );

      case 'table':
        return (
          <Stack spacing={1}>
            <Skeleton variant="rectangular" height={56} animation={animation} />
            {Array.from({ length: count }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                height={52}
                animation={animation}
              />
            ))}
          </Stack>
        );

      case 'form':
        return (
          <Stack spacing={3}>
            {Array.from({ length: count }).map((_, index) => (
              <Box key={index}>
                <Skeleton
                  variant="text"
                  sx={{ fontSize: '0.875rem' }}
                  width="20%"
                  animation={animation}
                />
                <Skeleton
                  variant="rectangular"
                  height={56}
                  animation={animation}
                />
              </Box>
            ))}
          </Stack>
        );

      case 'detail':
        return (
          <Stack spacing={3}>
            <Skeleton
              variant="rectangular"
              height={200}
              animation={animation}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton
                variant="circular"
                width={64}
                height={64}
                animation={animation}
              />
              <Stack flex={1} spacing={1}>
                <Skeleton
                  variant="text"
                  sx={{ fontSize: '1.5rem' }}
                  width="40%"
                  animation={animation}
                />
                <Skeleton
                  variant="text"
                  sx={{ fontSize: '1rem' }}
                  width="60%"
                  animation={animation}
                />
                <Skeleton
                  variant="text"
                  sx={{ fontSize: '0.875rem' }}
                  width="80%"
                  animation={animation}
                />
              </Stack>
            </Box>
            {Array.from({ length: count }).map((_, index) => (
              <Box key={index}>
                <Skeleton
                  variant="text"
                  sx={{ fontSize: '1rem' }}
                  width="30%"
                  animation={animation}
                />
                <Skeleton
                  variant="rectangular"
                  height={80}
                  animation={animation}
                />
              </Box>
            ))}
          </Stack>
        );

      default: // 'card'
        return (
          <Stack spacing={2}>
            {Array.from({ length: count }).map((_, index) => (
              <Card key={index}>
                <CardContent>
                  <Skeleton
                    variant="text"
                    sx={{ fontSize: '1.2rem' }}
                    animation={animation}
                  />
                  <Skeleton
                    variant="text"
                    sx={{ fontSize: '1rem' }}
                    animation={animation}
                  />
                  <Skeleton
                    variant="rectangular"
                    height={typeof height === 'number' ? height : 100}
                    animation={animation}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            ))}
          </Stack>
        );
    }
  };

  return <Box>{renderSkeleton()}</Box>;
};

export interface LoadingStateProps {
  loading?: boolean;
  error?: Error | string | null;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  isEmpty?: boolean;
  retry?: () => void;
  errorProps?: Omit<ErrorDisplayProps, 'error'>;
  skeletonProps?: LoadingSkeletonProps;
}

/**
 * Comprehensive loading state wrapper component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  loading = false,
  error,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  isEmpty = false,
  retry,
  errorProps,
  skeletonProps,
}) => {
  if (loading) {
    return <>{loadingComponent || <LoadingSkeleton {...skeletonProps} />}</>;
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <ErrorDisplay
            error={error}
            retry={retry}
            showDetails={process.env.NODE_ENV === 'development'}
            {...errorProps}
          />
        )}
      </>
    );
  }

  if (isEmpty && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return <>{children}</>;
};

/**
 * Simple loading spinner component
 */
export const LoadingSpinner: React.FC<{
  size?: number;
  message?: string;
  fullPage?: boolean;
}> = ({ size = 40, message = 'Loading...', fullPage = false }) => {
  const content = (
    <Stack spacing={2} alignItems="center" justifyContent="center">
      <CircularProgress size={size} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Stack>
  );

  if (fullPage) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          width: '100%',
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      {content}
    </Box>
  );
};

export default ErrorDisplay;
