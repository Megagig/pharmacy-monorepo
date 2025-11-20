/**
 * RefillRequestManagement Component
 * Manages medication refill requests from patients
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Avatar,
  Chip,
  Typography,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Badge,

} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';

import { format } from 'date-fns';
import { usePatientPortalAdmin } from '../../hooks/usePatientPortalAdmin';
import RefillRequestActionsMenu from './RefillRequestActionsMenu';

interface RefillRequest {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  medication: {
    id: string;
    name: string;
    strength: string;
    form: string;
  };
  requestedQuantity: number;
  currentRefillsRemaining: number;
  patientNotes?: string;
  urgency: 'routine' | 'urgent';
  status: 'pending' | 'approved' | 'denied' | 'completed';
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: {
    id: string;
    name: string;
  };
  denialReason?: string;
  estimatedPickupDate?: Date;
  assignedTo?: {
    id: string;
    name: string;
  };
}

interface RefillRequestManagementProps {
  onShowSnackbar: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
  workspaceId?: string; // Optional workspace ID for super admin override
}

type SortField = 'requestedAt' | 'urgency' | 'status' | 'patientName' | 'medicationName';
type SortDirection = 'asc' | 'desc';

/**
 * Get color for request status badge
 */
const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'denied':
      return 'error';
    case 'completed':
      return 'info';
    default:
      return 'default';
  }
};

/**
 * Get color for urgency badge
 */
const getUrgencyColor = (urgency: string): 'error' | 'warning' | 'default' => {
  switch (urgency) {
    case 'urgent':
      return 'error';
    case 'routine':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Format date for display
 */
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Get initials from name for avatar
 */
const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.charAt(0) || '?';
  const last = lastName?.charAt(0) || '?';
  return `${first}${last}`.toUpperCase();
};

/**
 * Loading skeleton for table rows
 */
const TableRowSkeleton: React.FC = () => (
  <TableRow>
    <TableCell>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={180} />
        </Box>
      </Box>
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={150} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={60} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={80} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell>
      <Skeleton variant="circular" width={32} height={32} />
    </TableCell>
  </TableRow>
);

const RefillRequestManagement: React.FC<RefillRequestManagementProps> = ({ onShowSnackbar, workspaceId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [sortField, setSortField] = useState<SortField>('requestedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);

  // Dialog states
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'deny' | 'assign' | null;
    request: RefillRequest | null;
  }>({ open: false, type: null, request: null });
  const [denialReason, setDenialReason] = useState('');
  const [assignedPharmacist, setAssignedPharmacist] = useState('');
  const [estimatedPickupDate, setEstimatedPickupDate] = useState('');

  // Get filter based on active tab
  const getStatusFilter = () => {
    switch (activeTab) {
      case 0: return undefined; // All requests
      case 1: return 'pending'; // Pending requests
      case 2: return 'approved'; // Approved requests
      case 3: return 'denied'; // Denied requests
      case 4: return 'completed'; // Completed requests
      default: return undefined;
    }
  };

  // Fetch refill requests data
  const {
    data,
    isLoading,
    error,
  } = usePatientPortalAdmin(workspaceId).useRefillRequests({
    status: getStatusFilter(),
    page: pagination.page,
    limit: pagination.limit,
  });

  // Fetch pharmacists for assignment
  const { data: pharmacists } = usePatientPortalAdmin(workspaceId).usePharmacists();

  // Mutation hooks
  const { mutate: approveRequest, isPending: isApproving } = usePatientPortalAdmin(workspaceId).useApproveRefillRequest();
  const { mutate: denyRequest, isPending: isDenying } = usePatientPortalAdmin(workspaceId).useDenyRefillRequest();
  const { mutate: assignRequest, isPending: isAssigning } = usePatientPortalAdmin(workspaceId).useAssignRefillRequest();

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Handle page change
   */
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPagination({ ...pagination, page: newPage + 1 });
  };

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPagination({
      page: 1,
      limit: parseInt(event.target.value, 10),
    });
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setPagination({ page: 1, limit: 20 }); // Reset pagination
  };

  /**
   * Handle request action menu click
   */
  const handleActionClick = (event: React.MouseEvent<HTMLElement>, request: RefillRequest) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedRequest(request);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRequest(null);
  };

  /**
   * Handle request actions
   */
  const handleApproveRequest = (request: RefillRequest) => {
    setActionDialog({ open: true, type: 'approve', request });
  };

  const handleDenyRequest = (request: RefillRequest) => {
    setActionDialog({ open: true, type: 'deny', request });
  };

  const handleAssignRequest = (request: RefillRequest) => {
    setActionDialog({ open: true, type: 'assign', request });
  };

  /**
   * Handle confirm action
   */
  const handleConfirmAction = () => {
    if (!actionDialog.request) return;

    const request = actionDialog.request;

    switch (actionDialog.type) {
      case 'approve':
        approveRequest({
          requestId: request.id,
          estimatedPickupDate: estimatedPickupDate || undefined,
        }, {
          onSuccess: () => {
            onShowSnackbar(`Refill request for ${request.medication.name} has been approved`, 'success');
            setActionDialog({ open: false, type: null, request: null });
            setEstimatedPickupDate('');
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to approve refill request', 'error');
          },
        });
        break;

      case 'deny':
        denyRequest({
          requestId: request.id,
          reason: denialReason || 'No reason provided',
        }, {
          onSuccess: () => {
            onShowSnackbar(`Refill request for ${request.medication.name} has been denied`, 'success');
            setActionDialog({ open: false, type: null, request: null });
            setDenialReason('');
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to deny refill request', 'error');
          },
        });
        break;

      case 'assign':
        assignRequest({
          requestId: request.id,
          pharmacistId: assignedPharmacist,
        }, {
          onSuccess: () => {
            onShowSnackbar(`Refill request has been assigned successfully`, 'success');
            setActionDialog({ open: false, type: null, request: null });
            setAssignedPharmacist('');
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to assign refill request', 'error');
          },
        });
        break;
    }
  };

  /**
   * Handle close action dialog
   */
  const handleCloseActionDialog = () => {
    setActionDialog({ open: false, type: null, request: null });
    setDenialReason('');
    setAssignedPharmacist('');
    setEstimatedPickupDate('');
  };

  // Sort requests locally (client-side sorting)
  const sortedRequests = React.useMemo(() => {
    if (!data?.requests) return [];

    return [...data.requests].sort((a, b) => {
      let aValue: string | number | Date = a[sortField];
      let bValue: string | number | Date = b[sortField];

      // Handle special fields
      if (sortField === 'patientName') {
        aValue = `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`.toLowerCase();
        bValue = `${b.patient?.firstName || ''} ${b.patient?.lastName || ''}`.toLowerCase();
      } else if (sortField === 'medicationName') {
        aValue = (a.medication?.name || '').toLowerCase();
        bValue = (b.medication?.name || '').toLowerCase();
      } else if (sortField === 'requestedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle string fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [data?.requests, sortField, sortDirection]);

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load refill requests
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Status Filter Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="refill request status tabs"
        >
          <Tab
            label="All Requests"
            icon={<Badge badgeContent={data?.counts?.total || 0} color="primary"><LocalPharmacyIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Pending"
            icon={<Badge badgeContent={data?.counts?.pending || 0} color="warning"><HourglassEmptyIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Approved"
            icon={<Badge badgeContent={data?.counts?.approved || 0} color="success"><CheckCircleIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Denied"
            icon={<Badge badgeContent={data?.counts?.denied || 0} color="error"><CancelIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Completed"
            icon={<Badge badgeContent={data?.counts?.completed || 0} color="info"><CheckCircleIcon /></Badge>}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Requests Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'patientName'}
                  direction={sortDirection}
                  onClick={() => handleSort('patientName')}
                >
                  Patient
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'medicationName'}
                  direction={sortDirection}
                  onClick={() => handleSort('medicationName')}
                >
                  Medication
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'urgency'}
                  direction={sortDirection}
                  onClick={() => handleSort('urgency')}
                >
                  Urgency
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortDirection}
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'requestedAt'}
                  direction={sortDirection}
                  onClick={() => handleSort('requestedAt')}
                >
                  Requested
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              <>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </>
            ) : sortedRequests.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No refill requests found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activeTab === 1 ? 'No pending refill requests at this time.' : 'No requests match the current filter.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              // Actual data
              sortedRequests.map((request) => (
                <TableRow
                  key={request.id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                  }}
                >
                  {/* Patient Info */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: 'primary.main',
                          fontSize: '0.875rem',
                        }}
                      >
                        {getInitials(request.patient?.firstName || '', request.patient?.lastName || '')}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {request.patient?.firstName || 'Unknown'} {request.patient?.lastName || 'Patient'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.patient?.email || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Medication Info */}
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {request.medication?.name || 'Unknown Medication'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {request.medication?.strength || 'N/A'} {request.medication?.form || ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Qty: {request.requestedQuantity || 0} | Refills: {request.currentRefillsRemaining || 0}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Urgency */}
                  <TableCell>
                    <Chip
                      label={request.urgency || 'routine'}
                      color={getUrgencyColor(request.urgency || 'routine')}
                      size="small"
                      variant={(request.urgency || 'routine') === 'urgent' ? 'filled' : 'outlined'}
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={request.status || 'pending'}
                      color={getStatusColor(request.status || 'pending')}
                      size="small"
                    />
                  </TableCell>

                  {/* Requested Date */}
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(request.requestedAt)}
                    </Typography>
                    {request.processedAt && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Processed: {formatDate(request.processedAt)}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Tooltip title="More actions">
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionClick(e, request)}
                        aria-label={`Actions for ${request.medication.name} refill request`}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data?.pagination && (
        <TablePagination
          component="div"
          count={data.pagination.total}
          page={pagination.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}

      {/* Request Actions Menu */}
      {selectedRequest && (
        <RefillRequestActionsMenu
          request={selectedRequest}
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          onApprove={handleApproveRequest}
          onDeny={handleDenyRequest}
          onAssign={handleAssignRequest}
        />
      )}

      {/* Action Confirmation Dialogs */}
      <Dialog
        open={actionDialog.open}
        onClose={handleCloseActionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === 'approve' && 'Approve Refill Request'}
          {actionDialog.type === 'deny' && 'Deny Refill Request'}
          {actionDialog.type === 'assign' && 'Assign Refill Request'}
        </DialogTitle>
        <DialogContent>
          {actionDialog.type === 'approve' && (
            <Box>
              <Typography gutterBottom>
                Approve refill request for {actionDialog.request?.medication.name}?
              </Typography>
              <TextField
                fullWidth
                label="Estimated pickup date (optional)"
                type="date"
                value={estimatedPickupDate}
                onChange={(e) => setEstimatedPickupDate(e.target.value)}
                sx={{ mt: 2 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
          {actionDialog.type === 'deny' && (
            <Box>
              <Typography gutterBottom>
                Deny refill request for {actionDialog.request?.medication.name}?
              </Typography>
              <TextField
                fullWidth
                label="Reason for denial"
                multiline
                rows={3}
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                sx={{ mt: 2 }}
                required
              />
            </Box>
          )}
          {actionDialog.type === 'assign' && (
            <Box>
              <Typography gutterBottom>
                Assign refill request for {actionDialog.request?.medication.name} to a pharmacist:
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select Pharmacist</InputLabel>
                <Select
                  value={assignedPharmacist}
                  label="Select Pharmacist"
                  onChange={(e) => setAssignedPharmacist(e.target.value)}
                >
                  {pharmacists?.map((pharmacist: any) => (
                    <MenuItem key={pharmacist.id} value={pharmacist.id}>
                      {pharmacist.firstName} {pharmacist.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={actionDialog.type === 'deny' ? 'error' : 'primary'}
            disabled={
              isApproving || isDenying || isAssigning ||
              (actionDialog.type === 'deny' && !denialReason.trim()) ||
              (actionDialog.type === 'assign' && !assignedPharmacist)
            }
          >
            {actionDialog.type === 'approve' && 'Approve'}
            {actionDialog.type === 'deny' && 'Deny'}
            {actionDialog.type === 'assign' && 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RefillRequestManagement;