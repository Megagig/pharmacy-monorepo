import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Stack,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Grid,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  LocalHospital as LocalHospitalIcon,
  Science as ScienceIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { LabOrder } from '../types';
import { useLabStore } from '../store/labStore';

interface LabOrderStatusProps {
  order: LabOrder;
  onStatusChange?: (orderId: string, newStatus: LabOrder['status']) => void;
  onOrderUpdate?: (order: LabOrder) => void;
  showActions?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG = {
  ordered: {
    color: 'info' as const,
    icon: ScheduleIcon,
    label: 'Ordered',
    description: 'Order has been placed',
    progress: 25,
  },
  collected: {
    color: 'warning' as const,
    icon: LocalHospitalIcon,
    label: 'Collected',
    description: 'Specimen collected',
    progress: 50,
  },
  processing: {
    color: 'secondary' as const,
    icon: ScienceIcon,
    label: 'Processing',
    description: 'Lab is processing',
    progress: 75,
  },
  completed: {
    color: 'success' as const,
    icon: CheckCircleIcon,
    label: 'Completed',
    description: 'Results available',
    progress: 100,
  },
  cancelled: {
    color: 'error' as const,
    icon: CancelIcon,
    label: 'Cancelled',
    description: 'Order cancelled',
    progress: 0,
  },
};

const PRIORITY_CONFIG = {
  stat: { color: 'error' as const, label: 'STAT', urgency: 'Immediate' },
  urgent: { color: 'warning' as const, label: 'Urgent', urgency: '2-4 hours' },
  routine: { color: 'success' as const, label: 'Routine', urgency: 'Standard' },
};

const STATUS_STEPS = [
  {
    key: 'ordered',
    label: 'Order Placed',
    description: 'Lab order created and submitted',
  },
  {
    key: 'collected',
    label: 'Specimen Collected',
    description: 'Patient specimen obtained',
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Laboratory analysis in progress',
  },
  {
    key: 'completed',
    label: 'Results Available',
    description: 'Test results ready for review',
  },
];

const LabOrderStatus: React.FC<LabOrderStatusProps> = ({
  order,
  onStatusChange,
  onOrderUpdate,
  showActions = true,
  compact = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LabOrder['status']>(
    order.status
  );
  const [statusNote, setStatusNote] = useState('');

  const { updateOrderStatus, cancelOrder, loading, errors } = useLabStore();

  const currentStatusConfig = STATUS_CONFIG[order.status];
  const isMenuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusUpdate = async () => {
    if (selectedStatus !== order.status) {
      const success = await updateOrderStatus(order._id, selectedStatus);
      if (success) {
        onStatusChange?.(order._id, selectedStatus);
        setShowStatusDialog(false);
        setStatusNote('');
      }
    } else {
      setShowStatusDialog(false);
    }
  };

  const handleCancelOrder = async () => {
    const success = await cancelOrder(order._id);
    if (success) {
      onStatusChange?.(order._id, 'cancelled');
    }
    handleMenuClose();
  };

  const getActiveStep = () => {
    if (order.status === 'cancelled') return -1;
    return STATUS_STEPS.findIndex((step) => step.key === order.status);
  };

  const getTimeSinceOrder = () => {
    const orderDate = new Date(order.orderDate);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
    );

    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getExpectedTime = () => {
    if (order.expectedDate) {
      const expected = new Date(order.expectedDate);
      const now = new Date();

      if (expected < now) {
        return { text: 'Overdue', color: 'error' as const };
      } else {
        const diffHours = Math.floor(
          (expected.getTime() - now.getTime()) / (1000 * 60 * 60)
        );
        if (diffHours < 24) {
          return {
            text: `Expected in ${diffHours}h`,
            color: 'warning' as const,
          };
        } else {
          const diffDays = Math.floor(diffHours / 24);
          return { text: `Expected in ${diffDays}d`, color: 'info' as const };
        }
      }
    }
    return null;
  };

  const hasUrgentTests = order.tests.some(
    (test) => test.priority === 'stat' || test.priority === 'urgent'
  );
  const expectedTime = getExpectedTime();

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          icon={React.createElement(currentStatusConfig.icon, {
            sx: { fontSize: 16 },
          })}
          label={currentStatusConfig.label}
          color={currentStatusConfig.color}
          size="small"
          variant="outlined"
        />

        {hasUrgentTests && (
          <Chip label="URGENT" color="error" size="small" variant="filled" />
        )}

        <Typography variant="caption" color="text.secondary">
          {getTimeSinceOrder()}
        </Typography>

        {showActions && (
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              mb: 3,
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Lab Order #{order._id.slice(-6)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ordered {getTimeSinceOrder()} • {order.tests.length} test(s)
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={React.createElement(currentStatusConfig.icon, {
                  sx: { fontSize: 16 },
                })}
                label={currentStatusConfig.label}
                color={currentStatusConfig.color}
                variant="outlined"
              />

              {showActions && (
                <IconButton onClick={handleMenuOpen}>
                  <MoreVertIcon />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Progress Bar */}
          {order.status !== 'cancelled' && (
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentStatusConfig.progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={currentStatusConfig.progress}
                color={currentStatusConfig.color}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                {currentStatusConfig.description}
              </Typography>
            </Box>
          )}

          {/* Test Details */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Ordered Tests
            </Typography>
            <Grid container spacing={2}>
              {order.tests.map((test, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {test.name}
                      </Typography>
                      <Chip
                        label={PRIORITY_CONFIG[test.priority].label}
                        color={PRIORITY_CONFIG[test.priority].color}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Code: {test.code}
                      {test.loincCode && ` • LOINC: ${test.loincCode}`}
                    </Typography>
                    {test.indication && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        Indication: {test.indication}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Timeline */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Order Timeline
            </Typography>
            <Stepper activeStep={getActiveStep()} orientation="vertical">
              {STATUS_STEPS.map((step, index) => (
                <Step key={step.key}>
                  <StepLabel>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="caption" color="text.secondary">
                      {step.description}
                    </Typography>
                    {step.key === order.status && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}
                      >
                        Current Status
                      </Typography>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>

          {/* Alerts and Warnings */}
          <Stack spacing={2}>
            {hasUrgentTests && (
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2">
                  This order contains urgent or STAT tests that require priority
                  processing.
                </Typography>
              </Alert>
            )}

            {expectedTime && (
              <Alert severity={expectedTime.color}>
                <Typography variant="body2">
                  {expectedTime.text}
                  {expectedTime.color === 'error' &&
                    ' - Consider following up with the laboratory.'}
                </Typography>
              </Alert>
            )}

            {order.status === 'cancelled' && (
              <Alert severity="error">
                <Typography variant="body2">
                  This order has been cancelled and will not be processed.
                </Typography>
              </Alert>
            )}
          </Stack>

          {/* External References */}
          {(order.externalOrderId || order.fhirReference) && (
            <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                External References:
              </Typography>
              {order.externalOrderId && (
                <Typography variant="caption">
                  External ID: {order.externalOrderId}
                </Typography>
              )}
              {order.fhirReference && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  FHIR Reference: {order.fhirReference}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            setShowStatusDialog(true);
            handleMenuClose();
          }}
        >
          <EditIcon sx={{ mr: 1 }} />
          Update Status
        </MenuItem>
        <MenuItem
          onClick={() => {
            /* Handle refresh */ handleMenuClose();
          }}
        >
          <RefreshIcon sx={{ mr: 1 }} />
          Refresh Status
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            /* Handle print */ handleMenuClose();
          }}
        >
          <PrintIcon sx={{ mr: 1 }} />
          Print Order
        </MenuItem>
        <MenuItem
          onClick={() => {
            /* Handle export */ handleMenuClose();
          }}
        >
          <DownloadIcon sx={{ mr: 1 }} />
          Export FHIR
        </MenuItem>
        <Divider />
        {order.status !== 'cancelled' && order.status !== 'completed' && (
          <MenuItem onClick={handleCancelOrder} sx={{ color: 'error.main' }}>
            <CancelIcon sx={{ mr: 1 }} />
            Cancel Order
          </MenuItem>
        )}
      </Menu>

      {/* Status Update Dialog */}
      <Dialog
        open={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Order Status</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Current Status: <strong>{currentStatusConfig.label}</strong>
            </Typography>

            <Stack spacing={2}>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                if (status === 'cancelled') return null;

                const Icon = config.icon;
                return (
                  <Paper
                    key={status}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: selectedStatus === status ? 2 : 1,
                      borderColor:
                        selectedStatus === status ? 'primary.main' : 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() =>
                      setSelectedStatus(status as LabOrder['status'])
                    }
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Icon sx={{ mr: 2, color: `${config.color}.main` }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {config.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {config.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>

          <TextField
            fullWidth
            label="Status Update Note (Optional)"
            placeholder="Add a note about this status change..."
            multiline
            rows={3}
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />

          {errors.updateOrder && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.updateOrder}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStatusDialog(false)}>Cancel</Button>
          <Button
            onClick={handleStatusUpdate}
            variant="contained"
            disabled={loading.updateOrder}
          >
            {loading.updateOrder ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LabOrderStatus;
