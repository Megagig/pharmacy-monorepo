import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    IconButton,
    Avatar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Alert,
    Snackbar,
    CircularProgress,
    Tooltip,
    Badge,
    Menu,
} from '@mui/material';
import {
    Search as SearchIcon,
    Person as PersonIcon,
    Security as SecurityIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import {
    getWorkspaceTeamMembers,
    getWorkspaceRoles,
    assignRoleToTeamMember,
    revokeRoleFromTeamMember,
    getTeamMemberPermissions,
} from '../../services/rbacService';
import type { Role } from '../../types/rbac';

interface TeamMember {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    workplaceRole?: string;
    assignedRoles?: Role[];
    status: string;
}

interface TeamMemberAssignmentProps {
    workspaceId?: string;
}

const TeamMemberAssignment: React.FC<TeamMemberAssignmentProps> = ({ workspaceId }) => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dialog states
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [assignmentReason, setAssignmentReason] = useState('');

    // Permission view dialog
    const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
    const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

    // Menu states
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuMember, setMenuMember] = useState<TeamMember | null>(null);

    // Notification
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'warning' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'info',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [membersResponse, rolesResponse] = await Promise.all([
                getWorkspaceTeamMembers(),
                getWorkspaceRoles({ limit: 100 }),
            ]);

            if (membersResponse.success) {
                setMembers(membersResponse.data.teamMembers || []);
            }

            if (rolesResponse.success) {
                setRoles(rolesResponse.data.roles || []);
            }
        } catch (error) {
            console.error('Error loading team members:', error);
            showSnackbar('Failed to load team members', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleAssignRole = (member: TeamMember) => {
        setSelectedMember(member);
        setSelectedRoleId('');
        setAssignmentReason('');
        setAssignDialogOpen(true);
    };

    const handleConfirmAssignment = async () => {
        if (!selectedMember || !selectedRoleId) return;

        try {
            const response = await assignRoleToTeamMember(
                selectedMember._id,
                selectedRoleId,
                assignmentReason
            );

            if (response.success) {
                showSnackbar('Role assigned successfully', 'success');
                await loadData();
                setAssignDialogOpen(false);
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            showSnackbar('Failed to assign role', 'error');
        }
    };

    const handleRevokeRole = async (member: TeamMember, roleId: string) => {
        if (!window.confirm(`Are you sure you want to revoke this role from ${member.firstName} ${member.lastName}?`)) {
            return;
        }

        try {
            const response = await revokeRoleFromTeamMember(member._id, roleId);

            if (response.success) {
                showSnackbar('Role revoked successfully', 'success');
                await loadData();
            }
        } catch (error) {
            console.error('Error revoking role:', error);
            showSnackbar('Failed to revoke role', 'error');
        }
    };

    const handleViewPermissions = async (member: TeamMember) => {
        try {
            const response = await getTeamMemberPermissions(member._id);

            if (response.success) {
                setMemberPermissions(response.data.permissions || []);
                setSelectedMember(member);
                setPermissionsDialogOpen(true);
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
            showSnackbar('Failed to load permissions', 'error');
        }
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, member: TeamMember) => {
        setAnchorEl(event.currentTarget);
        setMenuMember(member);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setMenuMember(null);
    };

    const filteredMembers = members.filter((member) =>
        `${member.firstName} ${member.lastName} ${member.email}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    const paginatedMembers = filteredMembers.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    Team Member Role Assignment
                </Typography>
            </Box>

            {/* Search */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search team members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            {/* Team Members Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Member</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>System Role</TableCell>
                            <TableCell>Assigned Roles</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedMembers.map((member) => (
                            <TableRow key={member._id} hover>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                                            {member.firstName.charAt(0)}
                                            {member.lastName.charAt(0)}
                                        </Avatar>
                                        <Typography>
                                            {member.firstName} {member.lastName}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell>{member.email}</TableCell>
                                <TableCell>
                                    <Chip label={member.role} size="small" color="default" />
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {member.assignedRoles && member.assignedRoles.length > 0 ? (
                                            member.assignedRoles.map((role: any) => (
                                                <Chip
                                                    key={role._id}
                                                    label={role.displayName}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    onDelete={() => handleRevokeRole(member, role._id)}
                                                />
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No roles assigned
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={member.status}
                                        size="small"
                                        color={member.status === 'active' ? 'success' : 'default'}
                                        icon={member.status === 'active' ? <CheckCircleIcon /> : <CancelIcon />}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton onClick={(e) => handleMenuOpen(e, member)} size="small">
                                        <MoreVertIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <TablePagination
                    component="div"
                    count={filteredMembers.length}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </TableContainer>

            {/* Action Menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem
                    onClick={() => {
                        if (menuMember) handleAssignRole(menuMember);
                        handleMenuClose();
                    }}
                >
                    <SecurityIcon sx={{ mr: 1 }} fontSize="small" />
                    Assign Role
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuMember) handleViewPermissions(menuMember);
                        handleMenuClose();
                    }}
                >
                    <InfoIcon sx={{ mr: 1 }} fontSize="small" />
                    View Permissions
                </MenuItem>
            </Menu>

            {/* Assign Role Dialog */}
            <Dialog
                open={assignDialogOpen}
                onClose={() => setAssignDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Assign Role to Team Member</DialogTitle>
                <DialogContent>
                    {selectedMember && (
                        <>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Assigning role to: <strong>{selectedMember.firstName} {selectedMember.lastName}</strong>
                            </Alert>

                            <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
                                <InputLabel>Select Role</InputLabel>
                                <Select
                                    value={selectedRoleId}
                                    onChange={(e) => setSelectedRoleId(e.target.value)}
                                    label="Select Role"
                                >
                                    {roles.map((role) => (
                                        <MenuItem key={role._id} value={role._id}>
                                            {role.displayName}
                                            {role.isSystemRole && (
                                                <Chip label="System" size="small" sx={{ ml: 1 }} />
                                            )}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth
                                label="Reason (Optional)"
                                value={assignmentReason}
                                onChange={(e) => setAssignmentReason(e.target.value)}
                                multiline
                                rows={3}
                                placeholder="Why are you assigning this role?"
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleConfirmAssignment}
                        variant="contained"
                        disabled={!selectedRoleId}
                    >
                        Assign Role
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Permissions View Dialog */}
            <Dialog
                open={permissionsDialogOpen}
                onClose={() => setPermissionsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Effective Permissions: {selectedMember?.firstName} {selectedMember?.lastName}
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        This member has <strong>{memberPermissions.length}</strong> permissions from their assigned roles
                    </Alert>
                    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {memberPermissions.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {memberPermissions.map((permission) => (
                                    <Chip key={permission} label={permission} size="small" variant="outlined" />
                                ))}
                            </Box>
                        ) : (
                            <Typography color="text.secondary">No permissions assigned</Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPermissionsDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default TeamMemberAssignment;
