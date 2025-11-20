import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Group as GroupIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../../services/websocketService';
import type { BulkOperationResult } from '../../types/rbac';

interface BulkOperationStatus {
  id: string;
  type:
    | 'role_assignment'
    | 'role_revocation'
    | 'permission_update'
    | 'user_update';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  startTime: string;
  endTime?: string;
  errors: Array<{
    userId: string;
    userName?: string;
    error: string;
  }>;
  warnings: Array<{
    userId: string;
    userName?: string;
    message: string;
  }>;
  metadata?: {
    roleNames?: string[];
    permissions?: string[];
    userCount?: number;
  };
}

interface BulkOperationProgressProps {
  open: boolean;
  onClose: () => void;
  operationId?: string;
  initialData?: Partial<BulkOperationStatus>;
}

const BulkOperationProgress: React.FC<BulkOperationProgressProps> = ({
  open,
  onClose,
  operationId,
  initialData,
}) => {
  const { subscribe } = useWebSocket();
  const [operation, setOperation] = useState<BulkOperationStatus | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  // Initialize operation data
  useEffect(() => {
    if (initialData && open) {
      setOperation({
        id: operationId || `op-${Date.now()}`,
        type: 'role_assignment',
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
        },
        startTime: new Date().toISOString(),
        errors: [],
        warnings: [],
        ...initialData,
      });
    }
  }, [initialData, operationId, open]);

  // Subscribe to bulk operation updates
  useEffect(() => {
    if (!operationId) return;

    const unsubscribe = subscribe('bulk_operation', (message) => {
      const update = message.data;

      if (update.operationId === operationId) {
        setOperation((prev) => {
          if (!prev) return null;

          return {
            ...prev,
            status: update.status || prev.status,
            progress: {
              ...prev.progress,
              ...update.progress,
            },
            errors: update.errors || prev.errors,
            warnings: update.warnings || prev.warnings,
            endTime: update.endTime || prev.endTime,
          };
        });
      }
    });

    return unsubscribe;
  }, [operationId, subscribe]);

  const getOperationTypeLabel = (type: BulkOperationStatus['type']) => {
    switch (type) {
      case 'role_assignment':
        return 'Role Assignment';
      case 'role_revocation':
        return 'Role Revocation';
      case 'permission_update':
        return 'Permission Update';
      case 'user_update':
        return 'User Update';
      default:
        return 'Bulk Operation';
    }
  };

  const getOperationIcon = (type: BulkOperationStatus['type']) => {
    switch (type) {
      case 'role_assignment':
      case 'role_revocation':
        return <GroupIcon />;
      case 'permission_update':
        return <SecurityIcon />;
      case 'user_update':
        return <GroupIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusColor = (status: BulkOperationStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      case 'in_progress':
        return 'primary';
      default:
        return 'default';
    }
  };

  const calculateProgress = () => {
    if (!operation || operation.progress.total === 0) return 0;
    return (operation.progress.processed / operation.progress.total) * 100;
  };

  const getElapsedTime = () => {
    if (!operation) return '';

    const start = new Date(operation.startTime);
    const end = operation.endTime ? new Date(operation.endTime) : new Date();
    const elapsed = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    return `${Math.floor(elapsed / 3600)}h ${Math.floor(
      (elapsed % 3600) / 60
    )}m`;
  };

  const isOperationComplete = () => {
    return (
      operation?.status === 'completed' ||
      operation?.status === 'failed' ||
      operation?.status === 'cancelled'
    );
  };

  if (!operation) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={isOperationComplete() ? onClose : undefined}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={!isOperationComplete()}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getOperationIcon(operation.type)}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              {getOperationTypeLabel(operation.type)}
            </Typography>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
            >
              <Chip
                label={operation.status.replace('_', ' ')}
                color={getStatusColor(operation.status)}
                size="small"
                variant="outlined"
              />
              <Typography variant="caption" color="textSecondary">
                {getElapsedTime()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          {/* Progress Bar */}
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body2">
                Progress: {operation.progress.processed} /{' '}
                {operation.progress.total}
              </Typography>
              <Typography variant="body2">
                {Math.round(calculateProgress())}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={calculateProgress()}
              color={getStatusColor(operation.status)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Statistics */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Chip
              icon={<CheckCircleIcon />}
              label={`${operation.progress.successful} Successful`}
              color="success"
              variant="outlined"
            />
            {operation.progress.failed > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`${operation.progress.failed} Failed`}
                color="error"
                variant="outlined"
              />
            )}
            {operation.warnings.length > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${operation.warnings.length} Warnings`}
                color="warning"
                variant="outlined"
              />
            )}
          </Box>

          {/* Operation Details */}
          {operation.metadata && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Operation Details
              </Typography>
              {operation.metadata.roleNames && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Roles:
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      mt: 0.5,
                    }}
                  >
                    {operation.metadata.roleNames.map((roleName) => (
                      <Chip
                        key={roleName}
                        label={roleName}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {operation.metadata.permissions && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Permissions:
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      mt: 0.5,
                    }}
                  >
                    {operation.metadata.permissions.map((permission) => (
                      <Chip
                        key={permission}
                        label={permission}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {operation.metadata.userCount && (
                <Typography variant="caption" color="textSecondary">
                  Affected Users: {operation.metadata.userCount}
                </Typography>
              )}
            </Box>
          )}

          {/* Errors Section */}
          {operation.errors.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 1,
                }}
                onClick={() => setShowErrors(!showErrors)}
              >
                <IconButton size="small">
                  {showErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography variant="subtitle2" color="error">
                  Errors ({operation.errors.length})
                </Typography>
              </Box>
              <Collapse in={showErrors}>
                <Alert severity="error" sx={{ mb: 2 }}>
                  <List dense>
                    {operation.errors.map((error, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon>
                          <ErrorIcon color="error" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={error.userName || error.userId}
                          secondary={error.error}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              </Collapse>
            </Box>
          )}

          {/* Warnings Section */}
          {operation.warnings.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 1,
                }}
                onClick={() => setShowWarnings(!showWarnings)}
              >
                <IconButton size="small">
                  {showWarnings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography variant="subtitle2" color="warning.main">
                  Warnings ({operation.warnings.length})
                </Typography>
              </Box>
              <Collapse in={showWarnings}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <List dense>
                    {operation.warnings.map((warning, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon>
                          <WarningIcon color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={warning.userName || warning.userId}
                          secondary={warning.message}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              </Collapse>
            </Box>
          )}

          {/* Completion Message */}
          {isOperationComplete() && (
            <Alert
              severity={
                operation.status === 'completed'
                  ? 'success'
                  : operation.status === 'failed'
                  ? 'error'
                  : 'warning'
              }
            >
              {operation.status === 'completed' && (
                <>
                  Operation completed successfully!{' '}
                  {operation.progress.successful} out of{' '}
                  {operation.progress.total} items processed.
                  {operation.progress.failed > 0 &&
                    ` ${operation.progress.failed} items failed.`}
                </>
              )}
              {operation.status === 'failed' && (
                <>
                  Operation failed. {operation.progress.successful} out of{' '}
                  {operation.progress.total} items were processed successfully.
                </>
              )}
              {operation.status === 'cancelled' && (
                <>
                  Operation was cancelled. {operation.progress.successful} out
                  of {operation.progress.total} items were processed.
                </>
              )}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {!isOperationComplete() && (
          <Button
            onClick={() => {
              // TODO: Implement operation cancellation

            }}
            color="error"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={onClose}
          variant={isOperationComplete() ? 'contained' : 'outlined'}
          disabled={!isOperationComplete()}
        >
          {isOperationComplete() ? 'Close' : 'Running...'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkOperationProgress;
