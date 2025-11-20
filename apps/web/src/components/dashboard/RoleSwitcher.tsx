import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Chip,
    Avatar,
    Divider,
    useTheme,
    alpha,
} from '@mui/material';
// Individual icon imports for correct module imports
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import BusinessIcon from '@mui/icons-material/Business';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { motion } from 'framer-motion';
import { roleBasedDashboardService } from '../../services/roleBasedDashboardService';
import { useAuth } from '../../context/AuthContext';

interface WorkspaceOption {
    _id: string;
    name: string;
    subscriptionStatus: string;
    userRole?: string;
}

interface RoleSwitcherProps {
    onRoleChange?: (role: 'super_admin' | 'workspace_user', workspaceId?: string) => void;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ onRoleChange }) => {
    const theme = useTheme();
    const { user } = useAuth();
    const [currentMode, setCurrentMode] = useState<'super_admin' | 'workspace_user'>('super_admin');
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
    const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceOption[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (roleBasedDashboardService.isSuperAdmin(user?.role as any)) {
            fetchAvailableWorkspaces();
        }
    }, [user]);

    const fetchAvailableWorkspaces = async () => {
        try {
            setLoading(true);
            const workspaces = await roleBasedDashboardService.getAvailableWorkspaces();
            setAvailableWorkspaces(workspaces);
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = event.target.checked ? 'workspace_user' : 'super_admin';
        setCurrentMode(newMode);

        if (newMode === 'super_admin') {
            setSelectedWorkspace('');
            onRoleChange?.(newMode);
        }
    };

    const handleWorkspaceChange = (event: any) => {
        const workspaceId = event.target.value;
        setSelectedWorkspace(workspaceId);

        if (workspaceId && currentMode === 'workspace_user') {
            onRoleChange?.('workspace_user', workspaceId);
        }
    };

    const selectedWorkspaceData = availableWorkspaces.find(w => w._id === selectedWorkspace);

    // Only show if user is super admin
    if (!roleBasedDashboardService.isSuperAdmin(user?.role as any)) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card
                sx={{
                    mb: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
                        theme.palette.secondary.main,
                        0.05
                    )} 100%)`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
            >
                <CardContent sx={{ pb: '16px !important' }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 32, height: 32 }}>
                                <SupervisorAccountIcon fontSize="small" />
                            </Avatar>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                Super Admin Controls
                            </Typography>
                        </Box>

                        <Chip
                            label={currentMode === 'super_admin' ? 'System View' : 'Workspace View'}
                            color={currentMode === 'super_admin' ? 'primary' : 'secondary'}
                            size="small"
                        />
                    </Box>

                    <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={currentMode === 'workspace_user'}
                                    onChange={handleModeChange}
                                    color="secondary"
                                />
                            }
                            label={
                                <Box display="flex" alignItems="center" gap={1}>
                                    {currentMode === 'super_admin' ? (
                                        <>
                                            <SupervisorAccountIcon fontSize="small" />
                                            <Typography variant="body2">System-wide View</Typography>
                                        </>
                                    ) : (
                                        <>
                                            <BusinessIcon fontSize="small" />
                                            <Typography variant="body2">Workspace View</Typography>
                                        </>
                                    )}
                                </Box>
                            }
                        />

                        {currentMode === 'workspace_user' && (
                            <>
                                <Divider orientation="vertical" flexItem />

                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Select Workspace</InputLabel>
                                    <Select
                                        value={selectedWorkspace}
                                        label="Select Workspace"
                                        onChange={handleWorkspaceChange}
                                        disabled={loading}
                                        IconComponent={ArrowDropDownIcon}
                                    >
                                        {availableWorkspaces.map((workspace) => (
                                            <MenuItem key={workspace._id} value={workspace._id}>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                        {workspace.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Status: {workspace.subscriptionStatus}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {selectedWorkspaceData && (
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Chip
                                            label={`Viewing as: ${selectedWorkspaceData.userRole || 'User'}`}
                                            color="secondary"
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>

                    {currentMode === 'workspace_user' && !selectedWorkspace && (
                        <Box mt={2}>
                            <Typography variant="caption" color="text.secondary">
                                💡 Select a workspace to view its specific dashboard and data
                            </Typography>
                        </Box>
                    )}

                    {currentMode === 'super_admin' && (
                        <Box mt={2}>
                            <Typography variant="caption" color="text.secondary">
                                🔍 Currently viewing system-wide analytics and all workspace data
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default RoleSwitcher;