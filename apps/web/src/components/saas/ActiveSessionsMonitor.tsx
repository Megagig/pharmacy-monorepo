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
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Block as TerminateIcon,
    Search as SearchIcon,
    LocationOn as LocationIcon,
    Devices as DeviceIcon,
} from '@mui/icons-material';
import { saasSecurityService } from '../../services/saas';
import StatusBadge from '../common/StatusBadge';
import ConfirmDialog from '../common/ConfirmDialog';
import StatsCard from '../common/StatsCard';
import ExportButton from '../common/ExportButton';

interface Session {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    ipAddress: string;
    userAgent: string;
    location?: string;
    device?: string;
    browser?: string;
    lastActivity: Date;
    createdAt: Date;
}

const ActiveSessionsMonitor: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        sessionId?: string;
        userName?: string;
    }>({ open: false });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        loadSessions();

        // Auto-refresh every 30 seconds
        if (autoRefresh) {
            const interval = setInterval(loadSessions, 30000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    useEffect(() => {
        // Filter sessions based on search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            setFilteredSessions(
                sessions.filter(
                    (session) =>
                        session.userName.toLowerCase().includes(query) ||
                        session.userEmail.toLowerCase().includes(query) ||
                        session.ipAddress.includes(query) ||
                        session.location?.toLowerCase().includes(query)
                )
            );
        } else {
            setFilteredSessions(sessions);
        }
    }, [searchQuery, sessions]);

    const loadSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await saasSecurityService.getActiveSessions();
            setSessions(response.sessions || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load active sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleTerminateSession = async (sessionId: string) => {
        try {
            setLoading(true);
            await saasSecurityService.terminateSession(sessionId);
            setSuccess('Session terminated successfully');
            await loadSessions();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to terminate session');
        } finally {
            setLoading(false);
            setConfirmDialog({ open: false });
        }
    };

    const handleExportSessions = async (format: 'csv' | 'excel' | 'pdf') => {
        // Convert sessions to blob for export
        const data = filteredSessions.map(session => ({
            User: session.userName,
            Email: session.userEmail,
            'IP Address': session.ipAddress,
            Location: session.location || 'Unknown',
            Device: session.device || 'Unknown',
            Browser: session.browser || 'Unknown',
            'Last Activity': new Date(session.lastActivity).toLocaleString(),
            'Session Started': new Date(session.createdAt).toLocaleString(),
        }));

        const csv = [
            Object.keys(data[0]).join(','),
            ...data.map(row => Object.values(row).join(','))
        ].join('\n');

        return new Blob([csv], { type: 'text/csv' });
    };

    const getTimeSinceActivity = (lastActivity: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(lastActivity).getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Active Sessions Monitor
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadSessions}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <ExportButton
                        formats={['csv', 'excel']}
                        onExport={handleExportSessions}
                        filename="active_sessions"
                    />
                </Box>
            </Box>

            {/* Statistics */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatsCard
                        title="Active Sessions"
                        value={sessions.length}
                        icon={<DeviceIcon />}
                        color="primary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatsCard
                        title="Unique Users"
                        value={new Set(sessions.map(s => s.userId)).size}
                        icon={<PeopleIcon />}
                        color="info"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatsCard
                        title="Auto Refresh"
                        value={autoRefresh ? 'ON' : 'OFF'}
                        icon={<RefreshIcon />}
                        color={autoRefresh ? 'success' : 'default'}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        subtitle="Click to toggle"
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
                    {/* Search */}
                    <TextField
                        fullWidth
                        placeholder="Search by user, email, IP, or location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ mb: 2 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />

                    {loading && sessions.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredSessions.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="h6" color="textSecondary">
                                {searchQuery ? 'No sessions found' : 'No active sessions'}
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>User</TableCell>
                                        <TableCell>IP Address</TableCell>
                                        <TableCell>Location</TableCell>
                                        <TableCell>Device</TableCell>
                                        <TableCell>Last Activity</TableCell>
                                        <TableCell>Session Duration</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredSessions.map((session) => (
                                        <TableRow key={session.sessionId} hover>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="subtitle2">{session.userName}</Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {session.userEmail}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={session.ipAddress} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <LocationIcon fontSize="small" color="action" />
                                                    <Typography variant="body2">
                                                        {session.location || 'Unknown'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2">{session.device || 'Unknown'}</Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {session.browser || 'Unknown browser'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={getTimeSinceActivity(session.lastActivity)}
                                                    size="small"
                                                    color={
                                                        new Date().getTime() - new Date(session.lastActivity).getTime() < 300000
                                                            ? 'success'
                                                            : 'default'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {Math.floor(
                                                    (new Date().getTime() - new Date(session.createdAt).getTime()) / 60000
                                                )}{' '}
                                                min
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Terminate Session">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setConfirmDialog({
                                                                open: true,
                                                                sessionId: session.sessionId,
                                                                userName: session.userName,
                                                            })
                                                        }
                                                    >
                                                        <TerminateIcon />
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

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                title="Terminate Session"
                message={`Are you sure you want to terminate the session for ${confirmDialog.userName}? The user will be logged out immediately.`}
                confirmText="Terminate"
                confirmColor="error"
                onConfirm={() => {
                    if (confirmDialog.sessionId) {
                        handleTerminateSession(confirmDialog.sessionId);
                    }
                }}
                onCancel={() => setConfirmDialog({ open: false })}
                loading={loading}
            />
        </Box>
    );
};

export default ActiveSessionsMonitor;
