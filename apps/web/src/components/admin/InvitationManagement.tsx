import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  Email as EmailIcon,
  PersonAdd as InviteIcon,
  CheckCircle as AcceptedIcon,
  HourglassEmpty as PendingIcon,
  Cancel as RejectedIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Business as WorkspaceIcon,
  TrendingUp,
  Send as SendIcon,
  Block as BlockIcon,
  Groups as GeneralIcon,
} from '@mui/icons-material';
import { useUIStore } from '../../stores';
import { adminService } from '../../services/adminService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Invitation {
  _id: string;
  email: string;
  role: string;
  status: 'active' | 'used' | 'canceled' | 'expired';
  invitedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  usedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workspaceId: {
    _id: string;
    name: string;
  };
  code: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  metadata?: any;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`invitation-tabpanel-${index}`}
      aria-labelledby={`invitation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const InvitationManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; invitation: Invitation | null }>({
    open: false,
    invitation: null,
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterStatus]);

  // Fetch invitations data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invitations', page, rowsPerPage, searchTerm, filterStatus],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (searchTerm) params.search = searchTerm;
      if (filterStatus !== 'all') params.status = filterStatus;

      const response = await adminService.getInvitationManagement(params);
      return response.data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Cancel invitation mutation
  const cancelMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return adminService.cancelInvitation(invitationId, 'Canceled by admin');
    },
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Invitation canceled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setCancelDialog({ open: false, invitation: null });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.message || 'Failed to cancel invitation',
      });
    },
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCancelInvitation = (invitation: Invitation) => {
    setCancelDialog({ open: true, invitation });
  };

  const confirmCancelInvitation = () => {
    if (cancelDialog.invitation) {
      cancelMutation.mutate(cancelDialog.invitation._id);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'used':
        return 'success';
      case 'canceled':
        return 'error';
      case 'expired':
        return 'warning';
      case 'active':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'used':
        return <AcceptedIcon fontSize="small" />;
      case 'canceled':
        return <RejectedIcon fontSize="small" />;
      case 'expired':
        return <RejectedIcon fontSize="small" />;
      case 'active':
        return <PendingIcon fontSize="small" />;
      default:
        return <PendingIcon fontSize="small" />;
    }
  };

  // Calculate statistics
  const invitations = data?.invitations || [];
  const totalCount = data?.pagination?.totalItems || 0;
  
  const stats = {
    total: totalCount,
    active: invitations.filter((i: Invitation) => i.status === 'active').length,
    used: invitations.filter((i: Invitation) => i.status === 'used').length,
    canceled: invitations.filter((i: Invitation) => i.status === 'canceled').length,
    expired: invitations.filter((i: Invitation) => i.status === 'expired').length,
  };

  return (
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <InviteIcon sx={{ mr: 1, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="600">
            Invitation Management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.total}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Total Invitations
                  </Typography>
                </Box>
                <EmailIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.active}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Active
                  </Typography>
                </Box>
                <PendingIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.used}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Accepted
                  </Typography>
                </Box>
                <AcceptedIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.expired}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Expired
                  </Typography>
                </Box>
                <RejectedIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.canceled}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Canceled
                  </Typography>
                </Box>
                <BlockIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="invitation tabs"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
              },
            }}
          >
            <Tab
              icon={<WorkspaceIcon />}
              iconPosition="start"
              label="Workspace Invites"
              id="invitation-tab-0"
              aria-controls="invitation-tabpanel-0"
            />
            <Tab
              icon={<GeneralIcon />}
              iconPosition="start"
              label="General Invitations"
              id="invitation-tab-1"
              aria-controls="invitation-tabpanel-1"
            />
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status Filter"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="used">Accepted</MenuItem>
                  <MenuItem value="canceled">Canceled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* Tab Panel 0: Workspace Invites */}
        <TabPanel value={activeTab} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Workspace</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Invited By</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                        No invitations found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation: Invitation) => (
                    <TableRow key={invitation._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          {invitation.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<WorkspaceIcon />}
                          label={invitation.workspaceId.name}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={invitation.role} size="small" />
                      </TableCell>
                      <TableCell>
                        {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(invitation.status)}
                          label={invitation.status.toUpperCase()}
                          size="small"
                          color={getStatusColor(invitation.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        {invitation.status === 'active' && (
                          <Tooltip title="Cancel Invitation">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCancelInvitation(invitation)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TabPanel>

        {/* Tab Panel 1: General Invitations (All workspaces view) */}
        <TabPanel value={activeTab} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Workspace</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Invited By</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Used By</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                        No invitations found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation: Invitation) => (
                    <TableRow key={invitation._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          {invitation.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<WorkspaceIcon />}
                          label={invitation.workspaceId.name}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={invitation.role} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {invitation.invitedBy.firstName} {invitation.invitedBy.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {invitation.invitedBy.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(invitation.status)}
                          label={invitation.status.toUpperCase()}
                          size="small"
                          color={getStatusColor(invitation.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {invitation.usedBy ? (
                          <Box>
                            <Typography variant="body2">
                              {invitation.usedBy.firstName} {invitation.usedBy.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {invitation.usedAt && new Date(invitation.usedAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {invitation.status === 'active' && (
                          <Tooltip title="Cancel Invitation">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCancelInvitation(invitation)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TabPanel>
      </Card>

      {/* Cancel Invitation Dialog */}
      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, invitation: null })}>
        <DialogTitle>Cancel Invitation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel the invitation for {cancelDialog.invitation?.email}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, invitation: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmCancelInvitation}
            disabled={cancelMutation.isPending}
            startIcon={cancelMutation.isPending ? <CircularProgress size={16} /> : <BlockIcon />}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvitationManagement;
