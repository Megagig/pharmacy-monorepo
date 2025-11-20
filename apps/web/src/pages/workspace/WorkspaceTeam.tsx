/**
 * Workspace Team Management Page
 * Main page for managing workspace team members, invites, and audit logs
 * Accessible to pharmacist and pharmacy_outlet (workspace owner) users
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  GridLegacy as Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import MailIcon from '@mui/icons-material/Mail';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import { useRBAC } from '../../hooks/useRBAC';
import {
  useWorkspaceStats,
  useUpdateMemberRole,
  useSuspendMember,
  useActivateMember,
  useRemoveMember
} from '../../queries/useWorkspaceTeam';
import MemberList from '../../components/workspace/MemberList';
import MemberFilters from '../../components/workspace/MemberFilters';
import PendingApprovals from '../../components/workspace/PendingApprovals';
import PendingLicenseApprovals from '../../components/workspace/PendingLicenseApprovals';
import PendingPatientApprovals from '../../components/workspace/PendingPatientApprovals';
import InviteList from '../../components/workspace/InviteList';
import InviteGenerator from '../../components/workspace/InviteGenerator';
import AuditTrail from '../../components/workspace/AuditTrail';
import type { MemberFilters as MemberFiltersType, Member, WorkplaceRole } from '../../types/workspace';

// Tab panel component
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
      id={`workspace-team-tabpanel-${index}`}
      aria-labelledby={`workspace-team-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Stats card component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
  loading = false,
}) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h4" component="div">
                {value}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}.main`,
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const WorkspaceTeam: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { hasRole } = useRBAC();
  const [activeTab, setActiveTab] = useState(0);
  const [memberFilters, setMemberFilters] = useState<MemberFiltersType>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Fetch workspace statistics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useWorkspaceStats();

  // Mutation hooks for member actions
  const updateMemberRoleMutation = useUpdateMemberRole();
  const suspendMemberMutation = useSuspendMember();
  const activateMemberMutation = useActivateMember();
  const removeMemberMutation = useRemoveMember();

  // Dialog states
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'assignRole' | 'suspend' | 'remove' | null;
    member: Member | null;
  }>({ open: false, type: null, member: null });
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedRole, setSelectedRole] = useState<WorkplaceRole>('Staff');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  // Action handlers
  const handleAssignRole = (member: Member) => {
    if (member.status === 'pending') {
      // For pending members, we should approve them first
      setSnackbar({
        open: true,
        message: 'Please approve the member first before assigning roles',
        severity: 'warning',
      });
      return;
    }
    setSelectedRole(member.workplaceRole || 'Staff');
    setActionDialog({ open: true, type: 'assignRole', member });
  };

  const handleSuspendMember = (member: Member) => {
    if (member.status === 'pending') {
      // For pending members, we should show reject option
      setSnackbar({
        open: true,
        message: 'Use the Pending Approvals tab to approve or reject pending members',
        severity: 'info',
      });
      return;
    }
    setActionDialog({ open: true, type: 'suspend', member });
  };

  const handleActivateMember = (member: Member) => {
    if (member.status === 'pending') {
      // For pending members, this would be approval
      setSnackbar({
        open: true,
        message: 'Use the Pending Approvals tab to approve pending members',
        severity: 'info',
      });
      return;
    }

    activateMemberMutation.mutate(member._id, {
      onSuccess: () => {
        setSnackbar({
          open: true,
          message: `${member.firstName} ${member.lastName} has been activated successfully`,
          severity: 'success',
        });
      },
      onError: (error: any) => {
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Failed to activate member',
          severity: 'error',
        });
      },
    });
  };

  const handleRemoveMember = (member: Member) => {
    setActionDialog({ open: true, type: 'remove', member });
  };

  const handleConfirmAction = () => {
    if (!actionDialog.member) return;

    const member = actionDialog.member;

    switch (actionDialog.type) {
      case 'assignRole':
        if (!selectedRole) {
          setSnackbar({
            open: true,
            message: 'Please select a role',
            severity: 'warning',
          });
          return;
        }

        updateMemberRoleMutation.mutate(
          {
            memberId: member._id,
            data: { workplaceRole: selectedRole },
          },
          {
            onSuccess: () => {
              setSnackbar({
                open: true,
                message: `${member.firstName} ${member.lastName}'s role has been updated to ${selectedRole}`,
                severity: 'success',
              });
              setActionDialog({ open: false, type: null, member: null });
              setSelectedRole('Staff');
            },
            onError: (error: any) => {
              setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Failed to update member role',
                severity: 'error',
              });
            },
          }
        );
        return;

      case 'suspend':
        suspendMemberMutation.mutate(
          {
            memberId: member._id,
            data: { reason: suspendReason || 'No reason provided' },
          },
          {
            onSuccess: () => {
              setSnackbar({
                open: true,
                message: `${member.firstName} ${member.lastName} has been suspended`,
                severity: 'success',
              });
            },
            onError: (error: any) => {
              setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Failed to suspend member',
                severity: 'error',
              });
            },
          }
        );
        break;

      case 'remove':
        removeMemberMutation.mutate(
          { memberId: member._id },
          {
            onSuccess: () => {
              setSnackbar({
                open: true,
                message: `${member.firstName} ${member.lastName} has been removed from the workspace`,
                severity: 'success',
              });
            },
            onError: (error: any) => {
              setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Failed to remove member',
                severity: 'error',
              });
            },
          }
        );
        break;
    }

    setActionDialog({ open: false, type: null, member: null });
    setSuspendReason('');
  };

  const handleCloseActionDialog = () => {
    setActionDialog({ open: false, type: null, member: null });
    setSuspendReason('');
    setSelectedRole('Staff');
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Access control - pharmacists and pharmacy_outlet users can access
  if (!hasRole('pharmacist') && !hasRole('pharmacy_outlet')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Insufficient Role Permissions
          </Typography>
          <Typography variant="body1">
            This page requires pharmacy_outlet role(s). Your current role is {user?.role}.
          </Typography>
        </Alert>
      </Container>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem' } }}
            >
              <PeopleIcon sx={{ mr: 1, fontSize: 'inherit', verticalAlign: 'middle' }} />
              Team Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your workspace team members, invitations, and activity
            </Typography>
          </Box>

          <Chip
            icon={<PeopleIcon />}
            label="Workspace Owner"
            color="primary"
            variant="outlined"
          />
        </Box>

        {/* Stats Cards */}
        {statsError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load workspace statistics. Please try refreshing the page.
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Members"
              value={stats?.totalMembers || 0}
              icon={<PeopleIcon />}
              color="primary"
              loading={statsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Active Members"
              value={stats?.activeMembers || 0}
              icon={<PeopleIcon />}
              color="success"
              loading={statsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Pending Approvals"
              value={stats?.pendingApprovals || 0}
              icon={<HourglassEmptyIcon />}
              color="warning"
              loading={statsLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Active Invites"
              value={stats?.activeInvites || 0}
              icon={<MailIcon />}
              color="info"
              loading={statsLoading}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons="auto"
          aria-label="workspace team management tabs"
        >
          <Tab
            icon={<PeopleIcon />}
            label="Members"
            iconPosition="start"
            id="workspace-team-tab-0"
            aria-controls="workspace-team-tabpanel-0"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<HourglassEmptyIcon />}
            label="Pending Approvals"
            iconPosition="start"
            id="workspace-team-tab-1"
            aria-controls="workspace-team-tabpanel-1"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<VerifiedUserIcon />}
            label="License Approvals"
            iconPosition="start"
            id="workspace-team-tab-2"
            aria-controls="workspace-team-tabpanel-2"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<PeopleIcon />}
            label="Patient Approvals"
            iconPosition="start"
            id="workspace-team-tab-3"
            aria-controls="workspace-team-tabpanel-3"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<MailIcon />}
            label="Invite Links"
            iconPosition="start"
            id="workspace-team-tab-4"
            aria-controls="workspace-team-tabpanel-4"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<HistoryIcon />}
            label="Audit Trail"
            iconPosition="start"
            id="workspace-team-tab-5"
            aria-controls="workspace-team-tabpanel-5"
            sx={{ minHeight: 64 }}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <MemberFilters filters={memberFilters} onFiltersChange={setMemberFilters} />
        <MemberList
          filters={memberFilters}
          onAssignRole={handleAssignRole}
          onSuspend={handleSuspendMember}
          onActivate={handleActivateMember}
          onRemove={handleRemoveMember}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <PendingApprovals />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <PendingLicenseApprovals />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <PendingPatientApprovals />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Workspace Invites</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setInviteDialogOpen(true)}
          >
            Generate Invite Link
          </Button>
        </Box>
        <InviteList />
        <InviteGenerator
          open={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
          onSuccess={() => {
            // Invite list will auto-refresh via query invalidation
            setInviteDialogOpen(false);
          }}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <AuditTrail />
      </TabPanel>

      {/* Action Confirmation Dialogs */}
      <Dialog
        open={actionDialog.open}
        onClose={handleCloseActionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === 'assignRole' && 'Assign Role'}
          {actionDialog.type === 'suspend' && 'Suspend Member'}
          {actionDialog.type === 'remove' && 'Remove Member'}
        </DialogTitle>
        <DialogContent>
          {actionDialog.type === 'assignRole' && (
            <Box>
              <Typography gutterBottom>
                Assign a new role to {actionDialog.member?.firstName} {actionDialog.member?.lastName}:
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel id="role-select-label">Select Role</InputLabel>
                <Select
                  labelId="role-select-label"
                  id="role-select"
                  value={selectedRole}
                  label="Select Role"
                  onChange={(e) => setSelectedRole(e.target.value as WorkplaceRole)}
                >
                  <MenuItem value="Staff">Staff</MenuItem>
                  <MenuItem value="Pharmacist">Pharmacist</MenuItem>
                  <MenuItem value="Cashier">Cashier</MenuItem>
                  <MenuItem value="Technician">Technician</MenuItem>
                  <MenuItem value="Assistant">Assistant</MenuItem>
                  <MenuItem value="Owner">Owner</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
          {actionDialog.type === 'suspend' && (
            <Box>
              <Typography gutterBottom>
                Are you sure you want to suspend {actionDialog.member?.firstName} {actionDialog.member?.lastName}?
                They will no longer be able to access the workspace.
              </Typography>
              <TextField
                fullWidth
                label="Reason for suspension"
                multiline
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
          {actionDialog.type === 'remove' && (
            <Typography>
              Are you sure you want to permanently remove {actionDialog.member?.firstName} {actionDialog.member?.lastName}
              from the workspace? This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={actionDialog.type === 'remove' ? 'error' : 'primary'}
            disabled={
              updateMemberRoleMutation.isPending ||
              suspendMemberMutation.isPending ||
              removeMemberMutation.isPending
            }
          >
            {actionDialog.type === 'assignRole' && 'Assign'}
            {actionDialog.type === 'suspend' && 'Suspend'}
            {actionDialog.type === 'remove' && 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WorkspaceTeam;
