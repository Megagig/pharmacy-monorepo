import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
    Grid,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Cancel as RejectIcon,
    Visibility as ViewIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import saasUserManagementService from '../../services/saasUserManagementService';
import StatusBadge from '../common/StatusBadge';
import BulkActionBar from '../common/BulkActionBar';
import ConfirmDialog from '../common/ConfirmDialog';
import StatsCard from '../common/StatsCard';

const UserApprovalQueue: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        action: 'approve' | 'reject' | null;
        userId?: string;
    }>({ open: false, action: null });
    const [rejectReason, setRejectReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadPendingUsers();
    }, []);

    const loadPendingUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await saasUserManagementService.getAllUsers(
                { status: 'pending' },
                { page: 1, limit: 100 }
            );
            setUsers(response.users || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load pending users');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: string) => {
        try {
            setLoading(true);
            await saasUserManagementService.approveUser(userId);
            setSuccess('User approved successfully');
            await loadPendingUsers();
            setSelectedIds(selectedIds.filter(id => id !== userId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to approve user');
        } finally {
            setLoading(false);
            setConfirmDialog({ open: false, action: null });
        }
    };

    const handleReject = async (userId: string, reason?: string) => {
        try {
            setLoading(true);
            await saasUserManagementService.rejectUser(userId, reason);
            setSuccess('User rejected successfully');
            await loadPendingUsers();
            setSelectedIds(selectedIds.filter(id => id !== userId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reject user');
        } finally {
            setLoading(false);
            setConfirmDialog({ open: false, action: null });
            setRejectReason('');
        }
    };

    const handleBulkApprove = async () => {
        try {
            setLoading(true);
            const result = await saasUserManagementService.bulkApproveUsers(selectedIds);
            setSuccess(`Approved ${result.processed} users successfully`);
            await loadPendingUsers();
            setSelectedIds([]);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to bulk approve users');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkReject = async () => {
        try {
            setLoading(true);
            const result = await saasUserManagementService.bulkRejectUsers(
                selectedIds,
                'Bulk rejection by admin'
            );
            setSuccess(`Rejected ${result.processed} users successfully`);
            await loadPendingUsers();
            setSelectedIds([]);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to bulk reject users');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedIds(users.map(user => user._id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (userId: string) => {
        setSelectedIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    User Approval Queue
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadPendingUsers}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatsCard
                        title="Pending Approvals"
                        value={users.length}
                        icon={<ApproveIcon />}
                        color="warning"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatsCard
                        title="Selected"
                        value={selectedIds.length}
                        icon={<CheckCircle />}
                        color="info"
                    />
                </Grid>
            </Grid>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            <Card>
                <CardContent>
                    {loading && users.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : users.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="h6" color="textSecondary">
                                No pending user approvals
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                All users have been processed
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length === users.length}
                                                onChange={handleSelectAll}
                                            />
                                        </TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Role</TableCell>
                                        <TableCell>Workspace</TableCell>
                                        <TableCell>Registered</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user._id} hover>
                                            <TableCell padding="checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(user._id)}
                                                    onChange={() => handleSelectOne(user._id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="subtitle2">
                                                    {user.firstName} {user.lastName}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <Chip label={user.role} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>{user.workspaceName || 'N/A'}</TableCell>
                                            <TableCell>
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={user.status} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Approve">
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() =>
                                                            setConfirmDialog({ open: true, action: 'approve', userId: user._id })
                                                        }
                                                    >
                                                        <ApproveIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Reject">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setConfirmDialog({ open: true, action: 'reject', userId: user._id })
                                                        }
                                                    >
                                                        <RejectIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            <BulkActionBar
                selectedCount={selectedIds.length}
                actions={[
                    {
                        label: 'Approve Selected',
                        icon: <ApproveIcon />,
                        onClick: handleBulkApprove,
                        color: 'success',
                    },
                    {
                        label: 'Reject Selected',
                        icon: <RejectIcon />,
                        onClick: handleBulkReject,
                        color: 'error',
                    },
                ]}
                onClearSelection={() => setSelectedIds([])}
            />

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.action === 'approve' ? 'Approve User' : 'Reject User'}
                message={
                    confirmDialog.action === 'approve'
                        ? 'Are you sure you want to approve this user?'
                        : 'Are you sure you want to reject this user? This action cannot be undone.'
                }
                confirmText={confirmDialog.action === 'approve' ? 'Approve' : 'Reject'}
                confirmColor={confirmDialog.action === 'approve' ? 'success' : 'error'}
                onConfirm={() => {
                    if (confirmDialog.userId) {
                        if (confirmDialog.action === 'approve') {
                            handleApprove(confirmDialog.userId);
                        } else {
                            handleReject(confirmDialog.userId, rejectReason);
                        }
                    }
                }}
                onCancel={() => setConfirmDialog({ open: false, action: null })}
                loading={loading}
            />
        </Box>
    );
};

export default UserApprovalQueue;
