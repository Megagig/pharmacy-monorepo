import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Chip,
    IconButton,
    Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceTeamService } from '../../services/workspaceTeamService';
import type { PendingLicense } from '../../types/workspace';

const PendingLicenseApprovals: React.FC = () => {
    const [approvalDialog, setApprovalDialog] = useState<{
        open: boolean;
        type: 'approve' | 'reject' | null;
        member: PendingLicense | null;
    }>({ open: false, type: null, member: null });
    const [reason, setReason] = useState('');

    const queryClient = useQueryClient();

    // Fetch pending license approvals
    const {
        data: pendingLicenses,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['workspace', 'licenses', 'pending'],
        queryFn: async (): Promise<PendingLicense[]> => {
            return await workspaceTeamService.getPendingLicenseApprovals();
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    // Approve license mutation
    const approveLicenseMutation = useMutation({
        mutationFn: (memberId: string) =>
            workspaceTeamService.approveMemberLicense(memberId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspace', 'licenses', 'pending'] });
            queryClient.invalidateQueries({ queryKey: ['workspace', 'team', 'members'] });
            setApprovalDialog({ open: false, type: null, member: null });
            setReason('');
        },
    });

    // Reject license mutation
    const rejectLicenseMutation = useMutation({
        mutationFn: ({ memberId, reason }: { memberId: string; reason: string }) =>
            workspaceTeamService.rejectMemberLicense(memberId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspace', 'licenses', 'pending'] });
            queryClient.invalidateQueries({ queryKey: ['workspace', 'team', 'members'] });
            setApprovalDialog({ open: false, type: null, member: null });
            setReason('');
        },
    });

    const handleApprove = (member: PendingLicense) => {
        setApprovalDialog({ open: true, type: 'approve', member });
        setReason('Valid license document and credentials verified');
    };

    const handleReject = (member: PendingLicense) => {
        setApprovalDialog({ open: true, type: 'reject', member });
        setReason('');
    };

    const handleConfirm = () => {
        if (!approvalDialog.member) return;

        if (approvalDialog.type === 'approve') {
            approveLicenseMutation.mutate(approvalDialog.member._id);
        } else if (approvalDialog.type === 'reject') {
            if (!reason.trim()) {
                return; // Reason is required for rejection
            }
            rejectLicenseMutation.mutate({
                memberId: approvalDialog.member._id,
                reason: reason.trim(),
            });
        }
    };

    const handleCloseDialog = () => {
        setApprovalDialog({ open: false, type: null, member: null });
        setReason('');
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <CircularProgress />
                <Typography variant="body1" sx={{ ml: 2 }}>
                    Loading pending license approvals...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                Failed to load pending license approvals. Please try again.
            </Alert>
        );
    }

    const licenses = pendingLicenses || [];

    if (licenses.length === 0) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Pending License Approvals
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    All pharmacist licenses have been reviewed. New license submissions will appear here.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                    License Approvals ({licenses.length} pending)
                </Typography>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Member</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>License Number</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Submitted</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {licenses.map((license: PendingLicense) => (
                            <TableRow key={license._id} hover>
                                <TableCell>
                                    <Box>
                                        <Typography variant="body2" fontWeight="medium">
                                            {license.firstName} {license.lastName}
                                        </Typography>
                                        <Chip
                                            label={license.licenseStatus}
                                            size="small"
                                            color="warning"
                                            sx={{ mt: 0.5 }}
                                        />
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{license.email}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontFamily="monospace">
                                        {license.licenseNumber}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={license.workplaceRole}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        {new Date(license.updatedAt).toLocaleDateString()}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        <Tooltip title="Approve License">
                                            <IconButton
                                                color="success"
                                                onClick={() => handleApprove(license)}
                                                disabled={approveLicenseMutation.isPending || rejectLicenseMutation.isPending}
                                            >
                                                <CheckCircleIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Reject License">
                                            <IconButton
                                                color="error"
                                                onClick={() => handleReject(license)}
                                                disabled={approveLicenseMutation.isPending || rejectLicenseMutation.isPending}
                                            >
                                                <CancelIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Approval/Rejection Dialog */}
            <Dialog
                open={approvalDialog.open}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {approvalDialog.type === 'approve' ? 'Approve License' : 'Reject License'}
                </DialogTitle>
                <DialogContent>
                    {approvalDialog.member && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body1" gutterBottom>
                                <strong>Member:</strong> {approvalDialog.member.firstName} {approvalDialog.member.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                <strong>Email:</strong> {approvalDialog.member.email}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                <strong>License:</strong> {approvalDialog.member.licenseNumber}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                <strong>Role:</strong> {approvalDialog.member.workplaceRole}
                            </Typography>
                        </Box>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label={approvalDialog.type === 'approve' ? 'Approval Note (Optional)' : 'Rejection Reason'}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required={approvalDialog.type === 'reject'}
                        placeholder={
                            approvalDialog.type === 'approve'
                                ? 'Add any notes about the approval...'
                                : 'Please provide a reason for rejecting this license...'
                        }
                        error={approvalDialog.type === 'reject' && !reason.trim()}
                        helperText={
                            approvalDialog.type === 'reject' && !reason.trim()
                                ? 'Rejection reason is required'
                                : ''
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={approveLicenseMutation.isPending || rejectLicenseMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant="contained"
                        color={approvalDialog.type === 'approve' ? 'success' : 'error'}
                        disabled={
                            approveLicenseMutation.isPending ||
                            rejectLicenseMutation.isPending ||
                            (approvalDialog.type === 'reject' && !reason.trim())
                        }
                    >
                        {approveLicenseMutation.isPending || rejectLicenseMutation.isPending ? (
                            <CircularProgress size={20} />
                        ) : approvalDialog.type === 'approve' ? (
                            'Approve License'
                        ) : (
                            'Reject License'
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PendingLicenseApprovals;