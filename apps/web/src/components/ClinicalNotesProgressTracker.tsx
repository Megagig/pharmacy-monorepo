import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
  IconButton,
  Button,
  Chip,
  Stack,
  Alert,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as RetryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CloudUpload as UploadIcon,
  Save as SaveIcon,
  Sync as SyncIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// Progress tracking types
export type OperationType =
  | 'upload'
  | 'save'
  | 'delete'
  | 'sync'
  | 'search'
  | 'validation'
  | 'export'
  | 'import';

export type OperationStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProgressOperation {
  id: string;
  type: OperationType;
  title: string;
  description?: string;
  progress: number;
  status: OperationStatus;
  startTime: Date;
  endTime?: Date;
  error?: string;
  canCancel?: boolean;
  canPause?: boolean;
  canRetry?: boolean;
  metadata?: Record<string, any>;
}

interface ClinicalNotesProgressTrackerProps {
  operations: ProgressOperation[];
  onCancel?: (operationId: string) => void;
  onPause?: (operationId: string) => void;
  onResume?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  onClear?: (operationId: string) => void;
  maxVisible?: number;
  showCompleted?: boolean;
  compact?: boolean;
}

interface ProgressItemProps {
  operation: ProgressOperation;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onClear?: () => void;
  compact?: boolean;
}

interface ProgressSummaryProps {
  operations: ProgressOperation[];
  onClearAll?: () => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
}

// Individual progress item component
const ProgressItem: React.FC<ProgressItemProps> = ({
  operation,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onClear,
  compact = false,
}) => {
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    switch (operation.status) {
      case 'completed':
        return theme.palette.success.main;
      case 'failed':
        return theme.palette.error.main;
      case 'cancelled':
        return theme.palette.warning.main;
      case 'paused':
        return theme.palette.info.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getStatusIcon = () => {
    switch (operation.status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'cancelled':
        return <WarningIcon color="warning" />;
      case 'paused':
        return <PauseIcon color="info" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const getTypeIcon = () => {
    switch (operation.type) {
      case 'upload':
        return <UploadIcon />;
      case 'save':
        return <SaveIcon />;
      case 'sync':
        return <SyncIcon />;
      case 'delete':
        return <DeleteIcon />;
      default:
        return <SaveIcon />;
    }
  };

  const getDuration = () => {
    const start = operation.startTime;
    const end = operation.endTime || new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);

    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      return `${Math.round(duration / 60)}m ${duration % 60}s`;
    } else {
      return `${Math.round(duration / 3600)}h ${Math.round(
        (duration % 3600) / 60
      )}m`;
    }
  };

  const getEstimatedTimeRemaining = () => {
    if (operation.status !== 'running' || operation.progress === 0) {
      return null;
    }

    const elapsed = new Date().getTime() - operation.startTime.getTime();
    const rate = operation.progress / elapsed;
    const remaining = (100 - operation.progress) / rate;

    const seconds = Math.round(remaining / 1000);

    if (seconds < 60) {
      return `${seconds}s remaining`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m remaining`;
    } else {
      return `${Math.round(seconds / 3600)}h remaining`;
    }
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        {getStatusIcon()}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {operation.title}
          </Typography>
          {operation.status === 'running' && (
            <LinearProgress
              variant="determinate"
              value={operation.progress}
              sx={{ mt: 0.5, height: 4 }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {operation.status === 'running'
            ? `${Math.round(operation.progress)}%`
            : operation.status}
        </Typography>
        {(operation.canCancel || operation.canPause || operation.canRetry) && (
          <IconButton size="small" onClick={onCancel}>
            <CancelIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Card sx={{ mb: 1, border: `1px solid ${getStatusColor()}` }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {getTypeIcon()}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" noWrap>
                {operation.title}
              </Typography>
              <Chip
                label={operation.status}
                size="small"
                sx={{
                  backgroundColor: getStatusColor(),
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            </Box>

            {operation.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {operation.description}
              </Typography>
            )}

            {/* Progress Bar */}
            {operation.status === 'running' && (
              <Box sx={{ mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption">
                    {Math.round(operation.progress)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getEstimatedTimeRemaining()}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={operation.progress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            )}

            {/* Status Information */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              {getStatusIcon()}
              <Typography variant="caption" color="text.secondary">
                Duration: {getDuration()}
              </Typography>
              {operation.metadata?.fileSize && (
                <Typography variant="caption" color="text.secondary">
                  Size: {formatFileSize(operation.metadata.fileSize)}
                </Typography>
              )}
            </Box>

            {/* Error Message */}
            {operation.error && (
              <Alert severity="error" size="small" sx={{ mt: 1 }}>
                {operation.error}
              </Alert>
            )}

            {/* Details Toggle */}
            {operation.metadata &&
              Object.keys(operation.metadata).length > 0 && (
                <Button
                  size="small"
                  startIcon={
                    showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />
                  }
                  onClick={() => setShowDetails(!showDetails)}
                  sx={{ mt: 1 }}
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              )}

            {/* Detailed Information */}
            <Collapse in={showDetails}>
              <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {JSON.stringify(operation.metadata, null, 2)}
                </Typography>
              </Box>
            </Collapse>
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={0.5}>
            {operation.status === 'running' && operation.canPause && (
              <Tooltip title="Pause">
                <IconButton size="small" onClick={onPause}>
                  <PauseIcon />
                </IconButton>
              </Tooltip>
            )}

            {operation.status === 'paused' && (
              <Tooltip title="Resume">
                <IconButton size="small" onClick={onResume}>
                  <PlayIcon />
                </IconButton>
              </Tooltip>
            )}

            {operation.status === 'failed' && operation.canRetry && (
              <Tooltip title="Retry">
                <IconButton size="small" onClick={onRetry}>
                  <RetryIcon />
                </IconButton>
              </Tooltip>
            )}

            {(operation.status === 'running' ||
              operation.status === 'paused') &&
              operation.canCancel && (
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={onCancel}>
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              )}

            {(operation.status === 'completed' ||
              operation.status === 'failed' ||
              operation.status === 'cancelled') && (
              <Tooltip title="Clear">
                <IconButton size="small" onClick={onClear}>
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

// Progress summary component
const ProgressSummary: React.FC<ProgressSummaryProps> = ({
  operations,
  onClearAll,
  onPauseAll,
  onResumeAll,
}) => {
  const runningOps = operations.filter((op) => op.status === 'running');
  const completedOps = operations.filter((op) => op.status === 'completed');
  const failedOps = operations.filter((op) => op.status === 'failed');
  const pausedOps = operations.filter((op) => op.status === 'paused');

  const totalProgress =
    operations.length > 0
      ? operations.reduce((sum, op) => sum + op.progress, 0) / operations.length
      : 0;

  return (
    <Card sx={{ mb: 2, bgcolor: 'primary.50' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">Operations Summary</Typography>
          <Stack direction="row" spacing={1}>
            {runningOps.length > 0 && onPauseAll && (
              <Button
                size="small"
                startIcon={<PauseIcon />}
                onClick={onPauseAll}
              >
                Pause All
              </Button>
            )}
            {pausedOps.length > 0 && onResumeAll && (
              <Button
                size="small"
                startIcon={<PlayIcon />}
                onClick={onResumeAll}
              >
                Resume All
              </Button>
            )}
            {onClearAll && (
              <Button
                size="small"
                startIcon={<CancelIcon />}
                onClick={onClearAll}
              >
                Clear All
              </Button>
            )}
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip
            label={`${runningOps.length} Running`}
            color="primary"
            size="small"
          />
          <Chip
            label={`${completedOps.length} Completed`}
            color="success"
            size="small"
          />
          <Chip
            label={`${failedOps.length} Failed`}
            color="error"
            size="small"
          />
          <Chip
            label={`${pausedOps.length} Paused`}
            color="info"
            size="small"
          />
        </Box>

        {runningOps.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Overall Progress: {Math.round(totalProgress)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={totalProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Main progress tracker component
const ClinicalNotesProgressTracker: React.FC<
  ClinicalNotesProgressTrackerProps
> = ({
  operations,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onClear,
  maxVisible = 5,
  showCompleted = true,
  compact = false,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [showSummary, setShowSummary] = useState(true);

  // Filter operations
  const filteredOperations = showCompleted
    ? operations
    : operations.filter((op) => op.status !== 'completed');

  const visibleOperations = showAll
    ? filteredOperations
    : filteredOperations.slice(0, maxVisible);

  const hasMoreOperations = filteredOperations.length > maxVisible;

  // Handle bulk actions
  const handleClearAll = useCallback(() => {
    operations.forEach((op) => {
      if (
        op.status === 'completed' ||
        op.status === 'failed' ||
        op.status === 'cancelled'
      ) {
        onClear?.(op.id);
      }
    });
  }, [operations, onClear]);

  const handlePauseAll = useCallback(() => {
    operations.forEach((op) => {
      if (op.status === 'running' && op.canPause) {
        onPause?.(op.id);
      }
    });
  }, [operations, onPause]);

  const handleResumeAll = useCallback(() => {
    operations.forEach((op) => {
      if (op.status === 'paused') {
        onResume?.(op.id);
      }
    });
  }, [operations, onResume]);

  if (operations.length === 0) {
    return null;
  }

  return (
    <Box>
      {/* Summary */}
      {showSummary && !compact && (
        <ProgressSummary
          operations={operations}
          onClearAll={handleClearAll}
          onPauseAll={handlePauseAll}
          onResumeAll={handleResumeAll}
        />
      )}

      {/* Operations List */}
      <Box>
        {visibleOperations.map((operation) => (
          <ProgressItem
            key={operation.id}
            operation={operation}
            onCancel={() => onCancel?.(operation.id)}
            onPause={() => onPause?.(operation.id)}
            onResume={() => onResume?.(operation.id)}
            onRetry={() => onRetry?.(operation.id)}
            onClear={() => onClear?.(operation.id)}
            compact={compact}
          />
        ))}

        {/* Show More/Less Button */}
        {hasMoreOperations && (
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowAll(!showAll)}
            sx={{ mt: 1 }}
          >
            {showAll
              ? 'Show Less'
              : `Show ${
                  filteredOperations.length - maxVisible
                } More Operations`}
          </Button>
        )}
      </Box>
    </Box>
  );
};

// Utility function to format file sizes
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ClinicalNotesProgressTracker;
export { ProgressItem, ProgressSummary };
