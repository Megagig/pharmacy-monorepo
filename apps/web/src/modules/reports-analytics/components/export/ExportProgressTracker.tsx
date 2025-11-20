import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useExportsStore } from '../../stores/exportsStore';
import { ExportJob, ExportResult } from '../../types/exports';
import { getExportProgressMessage } from '../../utils/exportHelpers';

interface ExportProgressTrackerProps {
  showCompleted?: boolean;
  maxItems?: number;
}

export const ExportProgressTracker: React.FC<ExportProgressTrackerProps> = ({
  showCompleted = true,
  maxItems = 10,
}) => {
  const {
    exportJobs,
    exportResults,
    getActiveExportJobs,
    getCompletedExportJobs,
    updateExportJob,
    removeExportJob,
    removeExportResult,
  } = useExportsStore();

  const [expanded, setExpanded] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const activeJobs = getActiveExportJobs();
  const completedJobs = showCompleted
    ? getCompletedExportJobs().slice(0, maxItems)
    : [];

  const handleCancelExport = (jobId: string) => {
    updateExportJob(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  };

  const handleRetryExport = (jobId: string) => {
    const job = exportJobs[jobId];
    if (job && job.retryCount < job.maxRetries) {
      updateExportJob(jobId, {
        status: 'queued',
        progress: 0,
        retryCount: job.retryCount + 1,
        error: undefined,
      });
    }
  };

  const handleDeleteJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedJobId) {
      removeExportJob(selectedJobId);
      const result = Object.values(exportResults).find(
        (r) => r.id === selectedJobId
      );
      if (result) {
        removeExportResult(selectedJobId);
      }
    }
    setDeleteDialogOpen(false);
    setSelectedJobId(null);
  };

  const handleDownload = (result: ExportResult) => {
    if (result.downloadUrl) {
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
      case 'cancelled':
        return <ErrorIcon color="error" />;
      case 'processing':
      case 'queued':
        return <ScheduleIcon color="primary" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      case 'processing':
        return 'primary';
      case 'queued':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = end.getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (activeJobs.length === 0 && completedJobs.length === 0) {
    return null;
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Typography variant="h6" component="div">
              Export Progress
            </Typography>
            <IconButton onClick={() => setExpanded(!expanded)} size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={expanded}>
            {/* Active Jobs */}
            {activeJobs.length > 0 && (
              <Box mb={2}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                >
                  Active Exports ({activeJobs.length})
                </Typography>
                <List dense>
                  {activeJobs.map((job) => (
                    <ListItem key={job.id} divider>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(job.status)}
                            <Typography variant="body2">
                              {job.reportType
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Typography>
                            <Chip
                              label={job.config.format.toUpperCase()}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {getExportProgressMessage(
                                job.progress,
                                job.config.format
                              )}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={job.progress}
                              sx={{ mt: 0.5, mb: 0.5 }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Started {formatDuration(job.createdAt)} ago
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleCancelExport(job.id)}
                          size="small"
                          color="error"
                        >
                          <CancelIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Completed Jobs */}
            {completedJobs.length > 0 && (
              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                >
                  Recent Exports
                </Typography>
                <List dense>
                  {completedJobs.map((job) => {
                    const result = exportResults[job.id];
                    return (
                      <ListItem key={job.id} divider>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              {getStatusIcon(job.status)}
                              <Typography variant="body2">
                                {job.reportType
                                  .replace(/-/g, ' ')
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Typography>
                              <Chip
                                label={job.config.format.toUpperCase()}
                                size="small"
                                color={getStatusColor(job.status)}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              {job.status === 'completed' && result && (
                                <Typography variant="caption" display="block">
                                  {result.filename} (
                                  {result.fileSize
                                    ? `${Math.round(result.fileSize / 1024)} KB`
                                    : 'Unknown size'}
                                  )
                                </Typography>
                              )}
                              {job.status === 'failed' && job.error && (
                                <Typography
                                  variant="caption"
                                  color="error"
                                  display="block"
                                >
                                  Error: {job.error}
                                </Typography>
                              )}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {job.status === 'completed'
                                  ? 'Completed'
                                  : 'Failed'}{' '}
                                {formatDuration(job.createdAt, job.completedAt)}{' '}
                                ago
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" gap={0.5}>
                            {job.status === 'completed' &&
                              result?.downloadUrl && (
                                <IconButton
                                  edge="end"
                                  onClick={() => handleDownload(result)}
                                  size="small"
                                  color="primary"
                                >
                                  <DownloadIcon />
                                </IconButton>
                              )}
                            {job.status === 'failed' &&
                              job.retryCount < job.maxRetries && (
                                <IconButton
                                  edge="end"
                                  onClick={() => handleRetryExport(job.id)}
                                  size="small"
                                  color="primary"
                                >
                                  <RefreshIcon />
                                </IconButton>
                              )}
                            <IconButton
                              edge="end"
                              onClick={() => handleDeleteJob(job.id)}
                              size="small"
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Export</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this export? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
