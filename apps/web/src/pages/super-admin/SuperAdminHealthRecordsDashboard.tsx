import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Alert,
    Button,
    Chip,
    Divider,
    Paper,
    Tab,
    Tabs,
} from '@mui/material';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { apiHelpers } from '../../utils/apiHelpers';

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
            id={`health-records-tabpanel-${index}`}
            aria-labelledby={`health-records-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const SuperAdminHealthRecordsDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    useEffect(() => {
        if (workspaces.length > 0) {
            fetchAnalytics();
        }
    }, [selectedWorkspace]);

    const fetchWorkspaces = async () => {
        try {
            const response = await apiHelpers.get('/api/super-admin/health-records/workspaces');
            setWorkspaces(response.data.workspaces || []);
            setLoading(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load workspaces');
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            let url = '/api/super-admin/health-records/analytics';
            if (selectedWorkspace !== 'all') {
                url += `?workspaceId=${selectedWorkspace}`;
            }

            const response = await apiHelpers.get(url);
            setAnalytics(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchAnalytics();
    };

    const handleExport = () => {
        if (!analytics) return;

        const dataStr = JSON.stringify(analytics, null, 2);
        const dataUri =
            'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `health-records-analytics-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    if (loading && workspaces.length === 0) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    const summary = analytics?.summary || {
        labResults: {},
        vitals: {},
        visits: {},
    };

    const totalRecords =
        (summary.labResults?.totalLabResults || 0) +
        (summary.vitals?.totalVitalsRecords || 0) +
        (summary.visits?.totalVisits || 0);

    // Prepare chart data
    const recordsDistributionData = [
        {
            name: 'Lab Results',
            value: summary.labResults?.totalLabResults || 0,
            icon: ScienceIcon,
        },
        {
            name: 'Vitals',
            value: summary.vitals?.totalVitalsRecords || 0,
            icon: FavoriteIcon,
        },
        {
            name: 'Visits',
            value: summary.visits?.totalVisits || 0,
            icon: EventNoteIcon,
        },
    ];

    const labStatusData = [
        {
            name: 'Completed',
            value: summary.labResults?.completedLabResults || 0,
            fill: '#00C49F',
        },
        {
            name: 'Pending',
            value: summary.labResults?.pendingLabResults || 0,
            fill: '#FFBB28',
        },
    ];

    const vitalsVerificationData = [
        {
            name: 'Verified',
            value: summary.vitals?.verifiedVitals || 0,
            fill: '#00C49F',
        },
        {
            name: 'Pending',
            value: summary.vitals?.pendingVerification || 0,
            fill: '#FF8042',
        },
    ];

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2,
                    }}
                >
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Health Records Analytics
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Cross-workspace health records management and analytics
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={handleExport}
                            disabled={!analytics}
                        >
                            Export
                        </Button>
                    </Box>
                </Box>

                <FormControl fullWidth sx={{ mb: 3, maxWidth: 400 }}>
                    <InputLabel>Workspace Filter</InputLabel>
                    <Select
                        value={selectedWorkspace}
                        label="Workspace Filter"
                        onChange={(e) => setSelectedWorkspace(e.target.value)}
                    >
                        <MenuItem value="all">All Workspaces</MenuItem>
                        {workspaces.map((workspace) => (
                            <MenuItem key={workspace.workspaceId} value={workspace.workspaceId}>
                                {workspace.name} ({workspace.healthRecordsSummary.totalRecords} records)
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {loading && analytics ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : analytics ? (
                <>
                    {/* Summary Cards */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1,
                                                bgcolor: 'primary.50',
                                                mr: 2,
                                            }}
                                        >
                                            <TrendingUpIcon color="primary" />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4">{totalRecords}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Records
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1,
                                                bgcolor: 'primary.50',
                                                mr: 2,
                                            }}
                                        >
                                            <ScienceIcon color="primary" />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4">
                                                {summary.labResults?.totalLabResults || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Lab Results
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Chip
                                            icon={<CheckCircleIcon fontSize="small" />}
                                            label={`${summary.labResults?.withInterpretations || 0} Interpreted`}
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                        <Chip
                                            icon={<WarningIcon fontSize="small" />}
                                            label={`${summary.labResults?.abnormalResults || 0} Abnormal`}
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1,
                                                bgcolor: 'error.50',
                                                mr: 2,
                                            }}
                                        >
                                            <FavoriteIcon color="error" />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4">
                                                {summary.vitals?.totalVitalsRecords || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Vitals Records
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip
                                            icon={<CheckCircleIcon fontSize="small" />}
                                            label={`${summary.vitals?.verifiedVitals || 0} Verified`}
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box
                                            sx={{
                                                p: 1,
                                                borderRadius: 1,
                                                bgcolor: 'success.50',
                                                mr: 2,
                                            }}
                                        >
                                            <EventNoteIcon color="success" />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4">
                                                {summary.visits?.totalVisits || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Visit Records
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip
                                            label={`${summary.visits?.withSummaries || 0} With Summaries`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Tabs for different views */}
                    <Paper sx={{ mb: 4 }}>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
                                <Tab label="Overview" />
                                <Tab label="Trends" />
                                <Tab label="Workspaces" />
                            </Tabs>
                        </Box>

                        <TabPanel value={tabValue} index={0}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="h6" gutterBottom>
                                        Records Distribution
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={recordsDistributionData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                fill="#8884d8"
                                                label
                                            >
                                                {recordsDistributionData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Typography variant="h6" gutterBottom>
                                        Lab Results Status
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={labStatusData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="value" fill="#8884d8">
                                                {labStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Typography variant="h6" gutterBottom>
                                        Vitals Verification Status
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={vitalsVerificationData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                label
                                            >
                                                {vitalsVerificationData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>
                                                Quick Stats
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Lab Interpretations:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {summary.labResults?.withInterpretations || 0} /{' '}
                                                        {summary.labResults?.totalLabResults || 0}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Visible to Patients:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {summary.labResults?.visibleToPatient || 0}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Verified Vitals:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {summary.vitals?.verifiedVitals || 0} /{' '}
                                                        {summary.vitals?.totalVitalsRecords || 0}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Visit Summaries:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {summary.visits?.withSummaries || 0} /{' '}
                                                        {summary.visits?.totalVisits || 0}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Summaries Visible:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {summary.visits?.summariesVisible || 0}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <Grid container spacing={3}>
                                {analytics.trends && (
                                    <>
                                        <Grid item xs={12}>
                                            <Typography variant="h6" gutterBottom>
                                                Lab Results Trends (Last 30 Days)
                                            </Typography>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={analytics.trends.labResults || []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="_id" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke="#0088FE"
                                                        strokeWidth={2}
                                                        name="Lab Results"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <Typography variant="h6" gutterBottom>
                                                Vitals Trends (Last 30 Days)
                                            </Typography>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={analytics.trends.vitals || []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="_id" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke="#FF8042"
                                                        strokeWidth={2}
                                                        name="Vitals"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <Typography variant="h6" gutterBottom>
                                                Visits Trends (Last 30 Days)
                                            </Typography>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={analytics.trends.visits || []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="_id" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="count"
                                                        stroke="#00C49F"
                                                        strokeWidth={2}
                                                        name="Visits"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                                Top 10 Workspaces by Activity
                            </Typography>
                            <Grid container spacing={2}>
                                {analytics.workspaceBreakdown &&
                                    analytics.workspaceBreakdown.map((workspace: any, index: number) => (
                                        <Grid item xs={12} key={workspace.workspaceId}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Typography
                                                                variant="h6"
                                                                sx={{
                                                                    bgcolor: 'primary.main',
                                                                    color: 'white',
                                                                    width: 32,
                                                                    height: 32,
                                                                    borderRadius: '50%',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                }}
                                                            >
                                                                {index + 1}
                                                            </Typography>
                                                            <Typography variant="h6" fontWeight="medium">
                                                                {workspace.workspaceName}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            label={`${workspace.labResults} Lab Results`}
                                                            color="primary"
                                                        />
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                            </Grid>
                        </TabPanel>
                    </Paper>
                </>
            ) : (
                <Alert severity="info">No analytics data available.</Alert>
            )}
        </Container>
    );
};

export default SuperAdminHealthRecordsDashboard;
