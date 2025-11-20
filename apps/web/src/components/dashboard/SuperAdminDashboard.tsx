import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Chip,
    LinearProgress,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    InputAdornment,
    Paper,
    Button,
} from '@mui/material';
import {
    People as PeopleIcon,
    Medication as MedicationIcon,
    TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

// Individual icon imports for correct module imports
import BusinessIcon from '@mui/icons-material/Business';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GetAppIcon from '@mui/icons-material/GetApp';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { motion } from 'framer-motion';
import { roleBasedDashboardService, SuperAdminDashboardData, WorkspaceDetails } from '../../services/roleBasedDashboardService';
import SimpleChart from './SimpleChart';
import RoleSwitcher from './RoleSwitcher';

// Phase 3: New Components
import SuperAdminQuickActions from './SuperAdminQuickActions';
import SuperAdminClinicalInterventions from './SuperAdminClinicalInterventions';
import SuperAdminRecentActivities from './SuperAdminRecentActivities';
import SuperAdminCommunicationHub from './SuperAdminCommunicationHub';

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
            id={`super-admin-tabpanel-${index}`}
            aria-labelledby={`super-admin-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

interface SystemMetricCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    trend?: number;
    subtitle?: string;
}

const SystemMetricCard: React.FC<SystemMetricCardProps> = ({
    title,
    value,
    icon,
    color,
    trend,
    subtitle,
}) => {
    const theme = useTheme();

    const getTrendIcon = () => {
        if (trend === undefined) return null;
        return trend >= 0 ? (
            <TrendingUpIcon sx={{ color: theme.palette.success.main, fontSize: 16 }} />
        ) : (
            <TrendingDownIcon sx={{ color: theme.palette.error.main, fontSize: 16 }} />
        );
    };

    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <Card
                sx={{
                    height: '100%',
                    background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(
                        color,
                        0.05
                    )} 100%)`,
                    border: `1px solid ${alpha(color, 0.2)}`,
                    position: 'relative',
                }}
            >
                <CardContent sx={{ p: 3 }}>
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={2}
                    >
                        <Avatar sx={{ bgcolor: alpha(color, 0.15), color: color }}>
                            {icon}
                        </Avatar>
                        {trend !== undefined && (
                            <Box display="flex" alignItems="center" gap={0.5}>
                                {getTrendIcon()}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: trend >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {trend > 0 ? '+' : ''}{trend}%
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {title}
                    </Typography>

                    <Typography
                        variant="h4"
                        sx={{ fontWeight: 'bold', color: color, mb: 1 }}
                    >
                        {roleBasedDashboardService.formatNumber(value)}
                    </Typography>

                    {subtitle && (
                        <Typography variant="body2" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

// Helper function to transform backend data to chart format
const transformTrendData = (trendData: Array<{ _id: { year: number; month: number }; count: number }>) => {
    if (!trendData || trendData.length === 0) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return trendData.map(item => ({
        name: `${monthNames[item._id.month - 1]} ${item._id.year}`,
        value: item.count
    }));
};

const transformCategoryData = (categoryData: Array<{ _id: string; count: number }>) => {
    if (!categoryData || categoryData.length === 0) return [];

    return categoryData.map(item => ({
        name: item._id || 'Unknown',
        value: item.count
    }));
};

const SuperAdminDashboard: React.FC = () => {
    // CRITICAL: ALL hooks must be called unconditionally at the top
    // This follows the Rules of Hooks - hooks must be called in the same order every render
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState(0);
    const [data, setData] = useState<SuperAdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
    const [workspaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails | null>(null);
    const [workspaceFilter, setWorkspaceFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        fetchSuperAdminData();
    }, []);

    const fetchSuperAdminData = async () => {
        try {
            setLoading(true);

            const dashboardData = await roleBasedDashboardService.getSuperAdminDashboard();

            // Ensure workspaces is always an array
            const safeData = {
                ...dashboardData,
                workspaces: dashboardData.workspaces || []
            };

            setData(safeData);
            setError(null);
        } catch (err: any) {
            console.error('❌ Error fetching super admin dashboard:', err);
            console.error('Error details:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status
            });
            setError('Failed to load super admin dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleWorkspaceView = async (workspaceId: string) => {
        try {
            setSelectedWorkspace(workspaceId);
            const details = await roleBasedDashboardService.getWorkspaceDetails(workspaceId);
            setWorkspaceDetails(details);
            setActiveTab(4); // Switch to workspace details tab
        } catch (err: any) {
            console.error('Error fetching workspace details:', err);
            setError('Failed to load workspace details');
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleRefresh = () => {
        fetchSuperAdminData();
    };

    const filteredWorkspaces = React.useMemo(() => {
        if (!data?.workspaces || !Array.isArray(data.workspaces)) {
            console.warn('⚠️ SuperAdminDashboard: workspaces is not an array:', data?.workspaces);
            return [];
        }

        return data.workspaces.filter(workspace =>
            workspace?.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (workspaceFilter === '' || workspace.subscriptionStatus === workspaceFilter)
        );
    }, [data?.workspaces, searchTerm, workspaceFilter]);

    const handleRoleChange = (role: 'super_admin' | 'workspace_user', workspaceId?: string) => {
        if (role === 'workspace_user' && workspaceId) {
            // Navigate to workspace-specific view

            // You could trigger a different dashboard component here
        } else {
            // Stay in super admin view

        }
    };

    if (loading) {

        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <LinearProgress sx={{ width: '50%' }} />
            </Box>
        );
    }

    if (error) {

        return (
            <Card sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="error" variant="h6" gutterBottom>
                    {error}
                </Typography>
                <Button onClick={handleRefresh} variant="contained" startIcon={<RefreshIcon />}>
                    Retry
                </Button>
            </Card>
        );
    }

    if (!data) {

        return (
            <Card sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                    No dashboard data available
                </Typography>
                <Button onClick={handleRefresh} variant="contained" startIcon={<RefreshIcon />}>
                    Load Data
                </Button>
            </Card>
        );
    }

    return (
        <Box>
            {/* Role Switcher */}
            <RoleSwitcher onRoleChange={handleRoleChange} />

            {/* Header */}
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={3}
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                        Super Admin Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        System-wide analytics and management
                    </Typography>
                </Box>
                <Box display="flex" gap={1}>
                    <Tooltip title="Export Data">
                        <IconButton>
                            <GetAppIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh Data">
                        <IconButton onClick={handleRefresh}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="super admin dashboard tabs">
                    <Tab label="System Overview" />
                    <Tab label="Workspaces" />
                    <Tab label="Users & Analytics" />
                    <Tab label="Revenue & Subscriptions" />
                    {selectedWorkspace && <Tab label="Workspace Details" />}
                </Tabs>
            </Box>

            {/* System Overview Tab */}
            <TabPanel value={activeTab} index={0}>
                {/* Quick Actions - Phase 3 */}
                <SuperAdminQuickActions />

                {/* System Metrics - Existing */}
                <Box mb={4}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 'bold',
                            mb: 3,
                            color: 'text.primary',
                        }}
                    >
                        System Metrics
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={3}>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Total Patients"
                                value={data?.systemStats?.totalPatients || 0}
                                icon={<LocalHospitalIcon />}
                                color={theme.palette.primary.main}
                                subtitle="Across all workspaces"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Total Workspaces"
                                value={data?.systemStats?.totalWorkspaces || 0}
                                icon={<BusinessIcon />}
                                color={theme.palette.secondary.main}
                                subtitle="Active organizations"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Total Users"
                                value={data?.systemStats?.totalUsers || 0}
                                icon={<PeopleIcon />}
                                color={theme.palette.info.main}
                                subtitle="System-wide users"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="MTR Sessions"
                                value={data?.systemStats?.totalMTRs || 0}
                                icon={<AssignmentIcon />}
                                color={theme.palette.success.main}
                                subtitle="Total MTR sessions"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Clinical Notes"
                                value={data?.systemStats?.totalClinicalNotes || 0}
                                icon={<NoteAddIcon />}
                                color={theme.palette.warning.main}
                                subtitle="All clinical records"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Medications"
                                value={data?.systemStats?.totalMedications || 0}
                                icon={<MedicationIcon />}
                                color={theme.palette.error.main}
                                subtitle="Medication records"
                            />
                        </Box>
                        <Box sx={{ minWidth: { xs: '100%', sm: '45%', md: '22%' }, flex: 1 }}>
                            <SystemMetricCard
                                title="Active Subscriptions"
                                value={data?.systemStats?.activeSubscriptions || 0}
                                icon={<MonetizationOnIcon />}
                                color={theme.palette.primary.dark}
                                subtitle="Paid subscriptions"
                            />
                        </Box>
                    </Box>
                </Box>

                {/* Charts */}
                <Box display="flex" flexWrap="wrap" gap={3}>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Patients by Month
                                </Typography>
                                <SimpleChart
                                    data={transformTrendData(data?.trends?.patientsTrend || [])}
                                    type="line"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Clinical Notes by Type
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.trends?.clinicalNotesByType || [])}
                                    type="pie"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    MTR Sessions by Status
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.trends?.mtrsByStatus || [])}
                                    type="bar"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    User Registration Trend
                                </Typography>
                                <SimpleChart
                                    data={transformTrendData(data?.trends?.usersTrend || [])}
                                    type="area"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                </Box>

                {/* Clinical Interventions - Phase 3 */}
                <SuperAdminClinicalInterventions />

                {/* Communication Hub - Phase 3 */}
                <SuperAdminCommunicationHub />

                {/* Recent Activities - Phase 3 */}
                <SuperAdminRecentActivities />
            </TabPanel>

            {/* Workspaces Tab */}
            <TabPanel value={activeTab} index={1}>
                {/* Filters */}
                <Box display="flex" gap={2} mb={3}>
                    <TextField
                        placeholder="Search workspaces..."
                        variant="outlined"
                        size="small"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 250 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Subscription Status</InputLabel>
                        <Select
                            value={workspaceFilter}
                            label="Subscription Status"
                            onChange={(e) => setWorkspaceFilter(e.target.value)}
                        >
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="trial">Trial</MenuItem>
                            <MenuItem value="expired">Expired</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* Workspaces Table */}
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                                <TableCell>Workspace</TableCell>
                                <TableCell>Owner</TableCell>
                                <TableCell align="center">Patients</TableCell>
                                <TableCell align="center">Users</TableCell>
                                <TableCell align="center">MTRs</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="center">Created</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredWorkspaces.map((workspace, index) => (
                                <TableRow
                                    key={workspace._id}
                                    component={motion.tr}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}
                                >
                                    <TableCell>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                {workspace.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                ID: {workspace._id.substring(0, 8)}...
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Avatar sx={{ width: 32, height: 32 }}>
                                                {workspace.ownerId?.firstName?.[0] || 'U'}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2">
                                                    {workspace.ownerId?.firstName} {workspace.ownerId?.lastName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {workspace.ownerId?.email}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {workspace.metrics.patients}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {workspace.metrics.users}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {workspace.metrics.mtrs}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={workspace.subscriptionStatus}
                                            color={
                                                workspace.subscriptionStatus === 'active'
                                                    ? 'success'
                                                    : workspace.subscriptionStatus === 'trial'
                                                        ? 'warning'
                                                        : 'error'
                                            }
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">
                                            {new Date(workspace.createdAt).toLocaleDateString()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="View Details">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleWorkspaceView(workspace._id)}
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            {/* Users & Analytics Tab */}
            <TabPanel value={activeTab} index={2}>
                <Box display="flex" flexWrap="wrap" gap={3}>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Users by System Role
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.userActivity?.usersByRole || [])}
                                    type="pie"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Users by Workplace Role
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.userActivity?.usersByWorkplaceRole || [])}
                                    type="bar"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '30%' }, flex: 1 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    Active Users (30 days)
                                </Typography>
                                <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                                    {data?.userActivity?.activeUsers || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '30%' }, flex: 1 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    New Users (30 days)
                                </Typography>
                                <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold' }}>
                                    {data?.userActivity?.newUsers || 0}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </TabPanel>

            {/* Revenue & Subscriptions Tab */}
            <TabPanel value={activeTab} index={3}>
                <Box display="flex" flexWrap="wrap" gap={3}>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Subscriptions by Status
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.subscriptions?.subscriptionsByStatus || [])}
                                    type="pie"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Subscriptions by Tier
                                </Typography>
                                <SimpleChart
                                    data={transformCategoryData(data?.subscriptions?.subscriptionsByTier || [])}
                                    type="bar"
                                    height={300}
                                />
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    Monthly Revenue
                                </Typography>
                                <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                                    ₦{roleBasedDashboardService.formatNumber(data?.subscriptions?.monthlyRevenue || 0)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', md: '48%' }, flex: 1 }}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    Total Revenue
                                </Typography>
                                <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold' }}>
                                    ₦{roleBasedDashboardService.formatNumber(data?.subscriptions?.totalRevenue || 0)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </TabPanel>

            {/* Workspace Details Tab */}
            {selectedWorkspace && (
                <TabPanel value={activeTab} index={4}>
                    {workspaceDetails ? (
                        <Box>
                            <Typography variant="h5" gutterBottom>
                                {workspaceDetails.workspace?.name} - Detailed View
                            </Typography>

                            <Box mb={3}>
                                <Box display="flex" flexWrap="wrap" gap={3}>
                                    <Box sx={{ minWidth: { xs: '100%', md: '18%' }, flex: 1 }}>
                                        <SystemMetricCard
                                            title="Patients"
                                            value={workspaceDetails.stats?.totalPatients || 0}
                                            icon={<PersonIcon />}
                                            color={theme.palette.primary.main}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: { xs: '100%', md: '18%' }, flex: 1 }}>
                                        <SystemMetricCard
                                            title="Users"
                                            value={workspaceDetails.stats?.totalUsers || 0}
                                            icon={<PeopleIcon />}
                                            color={theme.palette.secondary.main}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: { xs: '100%', md: '18%' }, flex: 1 }}>
                                        <SystemMetricCard
                                            title="Clinical Notes"
                                            value={workspaceDetails.stats?.totalClinicalNotes || 0}
                                            icon={<DescriptionIcon />}
                                            color={theme.palette.info.main}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: { xs: '100%', md: '18%' }, flex: 1 }}>
                                        <SystemMetricCard
                                            title="Medications"
                                            value={workspaceDetails.stats?.totalMedications || 0}
                                            icon={<MedicationIcon />}
                                            color={theme.palette.warning.main}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: { xs: '100%', md: '18%' }, flex: 1 }}>
                                        <SystemMetricCard
                                            title="MTR Sessions"
                                            value={workspaceDetails.stats?.totalMTRs || 0}
                                            icon={<MedicalServicesIcon />}
                                            color={theme.palette.success.main}
                                        />
                                    </Box>
                                </Box>
                            </Box>

                            {/* Users Table */}

                            {/* Users Table */}
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Workspace Users
                                    </Typography>
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>User</TableCell>
                                                    <TableCell>Role</TableCell>
                                                    <TableCell>Workplace Role</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>Last Login</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {workspaceDetails.users.map((user: any) => (
                                                    <TableRow key={user._id}>
                                                        <TableCell>
                                                            <Box>
                                                                <Typography variant="subtitle2">
                                                                    {user.firstName} {user.lastName}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {user.email}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip label={user.role} size="small" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip label={user.workplaceRole || 'N/A'} size="small" variant="outlined" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={user.status}
                                                                color={user.status === 'active' ? 'success' : 'default'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {user.lastLoginAt
                                                                ? new Date(user.lastLoginAt).toLocaleDateString()
                                                                : 'Never'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Box>
                    ) : (
                        <Box display="flex" justifyContent="center" p={4}>
                            <LinearProgress sx={{ width: '50%' }} />
                        </Box>
                    )}
                </TabPanel>
            )}
        </Box>
    );
};

export default SuperAdminDashboard;