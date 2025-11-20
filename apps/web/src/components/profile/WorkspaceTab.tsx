import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
} from '@mui/material';
import {
    Business as BusinessIcon,
    People as PeopleIcon,
    Settings as SettingsIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    VerifiedUser as VerifiedIcon,
    AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useRBAC } from '../../hooks/useRBAC';
import { apiClient } from '../../services/apiClient';
import { format } from 'date-fns';
import LoadingSpinner from '../LoadingSpinner';
import { useNavigate } from 'react-router-dom';

interface WorkspaceInfo {
    _id: string;
    name: string;
    type: string;
    ownerId: string;
    createdAt: string;
    members: TeamMember[];
}

interface TeamMember {
    _id: string;
    userId: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
    role: string;
    permissions: string[];
    joinedAt: string;
    status: string;
}

const WorkspaceTab: React.FC = () => {
    const { user } = useAuth();
    const { hasRole } = useRBAC();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    const isOwner = hasRole('owner') || hasRole('pharmacist') || hasRole('pharmacy_outlet');
    const isSuperAdmin = hasRole('super_admin');

    useEffect(() => {
        fetchWorkspaceData();
    }, []);

    const fetchWorkspaceData = async () => {
        try {
            setLoading(true);

            // Try to get workplaceId from various sources
            const workplaceId = user?.workplaceId || (user as any)?.pharmacyId || (user as any)?._id;

            // Always try to fetch workspace info
            let workspaceSet = false;

            // Method 1: Try dashboard endpoint
            try {
                const workspaceResponse = await apiClient.get('/dashboard/workspace-info');
                if (workspaceResponse.data.success && workspaceResponse.data.data) {
                    const workplaceData = workspaceResponse.data.data;
                    setWorkspace({
                        _id: workplaceData._id || workplaceId,
                        name: workplaceData.name || workplaceData.workplaceName || 'My Workspace',
                        type: workplaceData.type || 'Pharmacy',
                        ownerId: workplaceData.ownerId || '',
                        createdAt: workplaceData.createdAt || new Date().toISOString(),
                        members: []
                    });
                    workspaceSet = true;
                }
            } catch (error) {
                console.warn('Could not fetch workspace info from dashboard:', error);
            }

            // Method 2: If dashboard failed, create fallback workspace from user data
            if (!workspaceSet) {
                const userName = `${user?.firstName || 'User'}'s Workspace`;
                setWorkspace({
                    _id: workplaceId,
                    name: userName,
                    type: 'Pharmacy',
                    ownerId: (user as any)?._id || '',
                    createdAt: (user as any)?.createdAt || new Date().toISOString(),
                    members: []
                });
            }

            // Fetch team members (if owner or super admin)
            if (isOwner || isSuperAdmin) {
                try {
                    const teamResponse = await apiClient.get('/workspace/team/members');
                    if (teamResponse.data.success) {
                        const members = teamResponse.data.data?.members || teamResponse.data.members || [];
                        setTeamMembers(members);
                    }
                } catch (error) {
                    console.warn('Could not fetch team members:', error);
                    // Not critical, continue without team data
                }
            }
        } catch (error) {
            console.error('Error fetching workspace data:', error);
            // Even on error, set a basic workspace so user sees something
            if (!workspace) {
                setWorkspace({
                    _id: (user as any)?._id || 'unknown',
                    name: `${user?.firstName || 'User'}'s Workspace`,
                    type: 'Pharmacy',
                    ownerId: (user as any)?._id || '',
                    createdAt: new Date().toISOString(),
                    members: []
                });
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!workspace) {
        return (
            <Alert severity="info">
                No workspace information available. You may not be part of a workspace yet.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Workspace Overview */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Workspace Information
                        </Typography>
                        {isOwner && (
                            <Button
                                variant="outlined"
                                startIcon={<SettingsIcon />}
                                onClick={() => navigate('/workspace/settings')}
                                size="small"
                            >
                                Workspace Settings
                            </Button>
                        )}
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <List dense>
                                <ListItem>
                                    <BusinessIcon color="primary" sx={{ mr: 2 }} />
                                    <ListItemText
                                        primary="Workspace Name"
                                        secondary={workspace.name}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Workspace Type"
                                        secondary={workspace.type}
                                        sx={{ pl: 6 }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Created"
                                        secondary={format(new Date(workspace.createdAt), 'PPP')}
                                        sx={{ pl: 6 }}
                                    />
                                </ListItem>
                            </List>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Your Role
                                </Typography>
                                <Chip
                                    label={user?.role?.replace('_', ' ').toUpperCase()}
                                    color="primary"
                                    icon={isOwner || isSuperAdmin ? <AdminIcon /> : <VerifiedIcon />}
                                />
                                {isOwner && (
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        As a workspace owner, you have full access to manage team members, billing, and settings.
                                    </Alert>
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Team Members (Owner/Admin only) */}
            {(isOwner || isSuperAdmin) && (
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">
                                Team Members ({teamMembers.length})
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => navigate('/workspace/team')}
                                size="small"
                            >
                                Manage Team
                            </Button>
                        </Box>
                        <Divider sx={{ mb: 2 }} />

                        {teamMembers.length === 0 ? (
                            <Alert severity="info">
                                No team members yet. Invite your team to collaborate!
                            </Alert>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Member</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Role</TableCell>
                                            <TableCell>Joined</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {teamMembers.map((member) => {
                                            // Handle both populated and non-populated userId
                                            const memberUser = member.userId || member;
                                            const firstName = memberUser?.firstName || 'Unknown';
                                            const lastName = memberUser?.lastName || 'User';
                                            const email = memberUser?.email || 'N/A';

                                            return (
                                                <TableRow key={member._id}>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Avatar sx={{ width: 32, height: 32 }}>
                                                                {firstName[0]}{lastName[0]}
                                                            </Avatar>
                                                            <Typography variant="body2">
                                                                {firstName} {lastName}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>{email}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={(member.role || 'Member').replace('_', ' ').toUpperCase()}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {member.joinedAt ? format(new Date(member.joinedAt), 'PP') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={(member.status || 'Unknown').toUpperCase()}
                                                            color={member.status === 'active' ? 'success' : 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Limited view for team members */}
            {!isOwner && !isSuperAdmin && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Team Access
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Alert severity="info">
                            You have limited access to workspace settings. Contact your workspace owner for team management and billing information.
                        </Alert>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Your Permissions
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                {user?.permissions?.map((permission, index) => (
                                    <Chip key={index} label={permission} size="small" variant="outlined" />
                                ))}
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default WorkspaceTab;
