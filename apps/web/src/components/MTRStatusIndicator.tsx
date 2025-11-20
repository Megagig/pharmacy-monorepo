import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Assignment as MTRIcon,
  Schedule as ScheduledIcon,
  Warning as OverdueIcon,
  PlayArrow as ActiveIcon,
  Add as AddIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { usePatientMTRSummary } from '../queries/usePatientMTRIntegration';
import type { PatientMTRSummary } from '../services/patientMTRIntegrationService';

// ===============================
// MTR STATUS INDICATOR COMPONENT
// ===============================

interface MTRStatusIndicatorProps {
  patientId: string;
  variant?: 'chip' | 'detailed' | 'compact';
  showActions?: boolean;
  onStartMTR?: () => void;
  onViewMTR?: (mtrId: string) => void;
}

export const MTRStatusIndicator: React.FC<MTRStatusIndicatorProps> = ({
  patientId,
  variant = 'chip',
  showActions = false,
  onStartMTR,
  onViewMTR,
}) => {
  const navigate = useNavigate();

  const {
    data: mtrSummary,
    isLoading,
    isError,
    error,
  } = usePatientMTRSummary(patientId, !!patientId && patientId.length === 24);

  const handleStartMTR = () => {
    if (onStartMTR) {
      onStartMTR();
    } else {
      navigate(`/mtr/new?patientId=${patientId}`);
    }
  };

  const handleViewMTR = (mtrId: string) => {
    if (onViewMTR) {
      onViewMTR(mtrId);
    } else {
      navigate(`/mtr/${mtrId}`);
    }
  };

  const getStatusConfig = (status: PatientMTRSummary['mtrStatus']) => {
    switch (status) {
      case 'active':
        return {
          color: 'primary' as const,
          icon: <ActiveIcon />,
          label: 'Active MTR',
          description: 'MTR session in progress',
        };
      case 'overdue':
        return {
          color: 'error' as const,
          icon: <OverdueIcon />,
          label: 'Overdue MTR',
          description: 'MTR session is overdue',
        };
      case 'scheduled':
        return {
          color: 'info' as const,
          icon: <ScheduledIcon />,
          label: 'Scheduled MTR',
          description: 'MTR session scheduled',
        };
      case 'none':
      default:
        return {
          color: 'default' as const,
          icon: <MTRIcon />,
          label: 'No Active MTR',
          description: 'No active MTR sessions',
        };
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        {variant !== 'compact' && (
          <Typography variant="caption" color="text.secondary">
            Loading MTR status...
          </Typography>
        )}
      </Box>
    );
  }

  if (isError) {
    return (
      <Tooltip
        title={`Failed to load MTR status: ${
          error?.message || 'Unknown error'
        }`}
      >
        <Chip
          size="small"
          label="MTR Status Error"
          color="error"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  if (!mtrSummary) {
    return null;
  }

  const statusConfig = getStatusConfig(mtrSummary.mtrStatus);

  // Chip variant - simple status indicator
  if (variant === 'chip') {
    return (
      <Tooltip title={statusConfig.description}>
        <Chip
          size="small"
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          variant={mtrSummary.hasActiveMTR ? 'filled' : 'outlined'}
          onClick={
            mtrSummary.hasActiveMTR && mtrSummary.recentMTRs[0]
              ? () => handleViewMTR(mtrSummary.recentMTRs[0]._id)
              : undefined
          }
          sx={{
            cursor: mtrSummary.hasActiveMTR ? 'pointer' : 'default',
          }}
        />
      </Tooltip>
    );
  }

  // Compact variant - minimal display
  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={statusConfig.description}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: `${statusConfig.color}.main`,
            }}
          >
            {React.cloneElement(statusConfig.icon, { fontSize: 'small' })}
          </Box>
        </Tooltip>
        {showActions && (
          <Tooltip title={mtrSummary.hasActiveMTR ? 'View MTR' : 'Start MTR'}>
            <IconButton
              size="small"
              onClick={
                mtrSummary.hasActiveMTR && mtrSummary.recentMTRs[0]
                  ? () => handleViewMTR(mtrSummary.recentMTRs[0]._id)
                  : handleStartMTR
              }
            >
              {mtrSummary.hasActiveMTR ? <MTRIcon /> : <AddIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Detailed variant - comprehensive display
  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Stack spacing={2}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {statusConfig.icon}
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              MTR Status
            </Typography>
          </Box>
          <Chip
            size="small"
            label={statusConfig.label}
            color={statusConfig.color}
            variant={mtrSummary.hasActiveMTR ? 'filled' : 'outlined'}
          />
        </Box>

        {/* Statistics */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Sessions
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {mtrSummary.totalMTRSessions}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {mtrSummary.completedMTRSessions}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Active
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {mtrSummary.activeMTRSessions}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Last MTR
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {mtrSummary.lastMTRDate
                ? new Date(mtrSummary.lastMTRDate).toLocaleDateString()
                : 'Never'}
            </Typography>
          </Box>
        </Box>

        {/* Next scheduled MTR */}
        {mtrSummary.nextScheduledMTR && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              Next MTR scheduled for{' '}
              {new Date(mtrSummary.nextScheduledMTR).toLocaleDateString()}
            </Typography>
          </Alert>
        )}

        {/* Actions */}
        {showActions && (
          <Stack direction="row" spacing={1}>
            {mtrSummary.hasActiveMTR && mtrSummary.recentMTRs[0] ? (
              <Chip
                size="small"
                label="View Active MTR"
                color="primary"
                icon={<MTRIcon />}
                onClick={() => handleViewMTR(mtrSummary.recentMTRs[0]._id)}
                clickable
              />
            ) : (
              <Chip
                size="small"
                label="Start New MTR"
                color="primary"
                icon={<AddIcon />}
                onClick={handleStartMTR}
                clickable
              />
            )}

            {mtrSummary.totalMTRSessions > 0 && (
              <Chip
                size="small"
                label="View History"
                variant="outlined"
                icon={<MTRIcon />}
                onClick={() => navigate(`/patients/${patientId}/mtr-history`)}
                clickable
              />
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

// ===============================
// MTR QUICK ACTIONS COMPONENT
// ===============================

interface MTRQuickActionsProps {
  patientId: string;
  mtrSummary?: PatientMTRSummary;
  onStartMTR?: () => void;
  onViewMTR?: (mtrId: string) => void;
  onSyncData?: () => void;
}

export const MTRQuickActions: React.FC<MTRQuickActionsProps> = ({
  patientId,
  mtrSummary,
  onStartMTR,
  onViewMTR,
  onSyncData,
}) => {
  const navigate = useNavigate();

  const handleStartMTR = () => {
    if (onStartMTR) {
      onStartMTR();
    } else {
      navigate(`/mtr/new?patientId=${patientId}`);
    }
  };

  const handleViewMTR = (mtrId: string) => {
    if (onViewMTR) {
      onViewMTR(mtrId);
    } else {
      navigate(`/mtr/${mtrId}`);
    }
  };

  const handleSyncData = () => {
    if (onSyncData) {
      onSyncData();
    }
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {mtrSummary?.hasActiveMTR && mtrSummary.recentMTRs[0] ? (
        <>
          <Tooltip title="Continue active MTR session">
            <IconButton
              color="primary"
              onClick={() => handleViewMTR(mtrSummary.recentMTRs[0]._id)}
            >
              <ActiveIcon />
            </IconButton>
          </Tooltip>
          {onSyncData && (
            <Tooltip title="Sync patient data with MTR">
              <IconButton color="info" onClick={handleSyncData}>
                <SyncIcon />
              </IconButton>
            </Tooltip>
          )}
        </>
      ) : (
        <Tooltip title="Start new MTR session">
          <IconButton color="primary" onClick={handleStartMTR}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}

      {mtrSummary && mtrSummary.totalMTRSessions > 0 && (
        <Tooltip title="View MTR history">
          <IconButton
            color="default"
            onClick={() => navigate(`/patients/${patientId}/mtr-history`)}
          >
            <MTRIcon />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};

export default MTRStatusIndicator;
