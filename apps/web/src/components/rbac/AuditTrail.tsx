import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Pagination,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    History as HistoryIcon,
    Security as SecurityIcon,
    Person as PersonIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { getWorkspaceAuditLogs } from '../../services/rbacService';
import { format } from 'date-fns';

interface AuditLog {
    _id: string;
    actorId: {
        firstName: string;
        lastName: string;
        email: string;
    };
    targetId?: {
        firstName: string;
        lastName: string;
        email: string;
    };
    action: string;
    category: string;
    details: {
        before?: any;
        after?: any;
        reason?: string;
        metadata?: any;
    };
    timestamp: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    ipAddress?: string;
    userAgent?: string;
}

interface AuditTrailProps {
    workspaceId?: string;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ workspaceId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const logsPerPage = 20;

    useEffect(() => {
        loadAuditLogs();
    }, [page, categoryFilter, actionFilter, severityFilter]);

    const loadAuditLogs = async () => {
        try {
            setLoading(true);
            const response = await getWorkspaceAuditLogs({
                page,
                limit: logsPerPage,
                category: categoryFilter || undefined,
                action: actionFilter || undefined,
            });

            if (response.success) {
                setLogs(response.data.logs || []);
                const pagination = response.data.pagination as any;
                setTotalPages(pagination?.pages || 1);
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        if (action.includes('assign') || action.includes('add') || action.includes('create')) {
            return <AddIcon />;
        }
        if (action.includes('revoke') || action.includes('delete') || action.includes('remove')) {
            return <DeleteIcon />;
        }
        if (action.includes('update') || action.includes('edit')) {
            return <EditIcon />;
        }
        if (action.includes('approve')) {
            return <CheckCircleIcon />;
        }
        if (action.includes('reject')) {
            return <CancelIcon />;
        }
        return <InfoIcon />;
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'low':
                return 'info';
            case 'medium':
                return 'warning';
            case 'high':
                return 'error';
            case 'critical':
                return 'error';
            default:
                return 'default';
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'role':
                return 'primary';
            case 'permission':
                return 'secondary';
            case 'member':
                return 'success';
            case 'invite':
                return 'info';
            case 'auth':
                return 'warning';
            default:
                return 'default';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        try {
            return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
        } catch {
            return timestamp;
        }
    };

    const filteredLogs = logs.filter((log) => {
        const matchesSearch =
            !searchTerm ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.actorId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.targetId?.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSeverity = !severityFilter || log.severity === severityFilter;

        return matchesSearch && matchesSeverity;
    });

    if (loading && logs.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <HistoryIcon color="primary" />
                    RBAC Audit Trail
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Track all role and permission changes in your workspace
                </Typography>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            placeholder="Search by action, user, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            size="small"
                        />
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                label="Category"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="role">Role</MenuItem>
                                <MenuItem value="permission">Permission</MenuItem>
                                <MenuItem value="member">Member</MenuItem>
                                <MenuItem value="invite">Invite</MenuItem>
                                <MenuItem value="auth">Auth</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Action</InputLabel>
                            <Select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                label="Action"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="role_assigned">Role Assigned</MenuItem>
                                <MenuItem value="role_revoked">Role Revoked</MenuItem>
                                <MenuItem value="role_created">Role Created</MenuItem>
                                <MenuItem value="role_updated">Role Updated</MenuItem>
                                <MenuItem value="role_deleted">Role Deleted</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Severity</InputLabel>
                            <Select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                                label="Severity"
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                                <MenuItem value="critical">Critical</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <Chip
                            label={`${filteredLogs.length} Entries`}
                            color="primary"
                            sx={{ height: 40, fontSize: '0.875rem' }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Audit Logs List */}
            {filteredLogs.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <HistoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Audit Logs Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        No RBAC changes have been recorded yet
                    </Typography>
                </Paper>
            ) : (
                <>
                    <Stack spacing={2}>
                        {filteredLogs.map((log, index) => (
                            <Card key={log._id} sx={{ position: 'relative' }}>
                                <CardContent>
                                    {/* Header with category, action, and timestamp */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                            <Box
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: `${getCategoryColor(log.category)}.main`,
                                                    color: 'white',
                                                }}
                                            >
                                                {getActionIcon(log.action)}
                                            </Box>
                                            <Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                    <Chip
                                                        label={log.category}
                                                        size="small"
                                                        color={getCategoryColor(log.category) as any}
                                                    />
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {log.action.replace(/_/g, ' ').toUpperCase()}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {formatTimestamp(log.timestamp)}
                                            </Typography>
                                            <Chip
                                                label={log.severity}
                                                size="small"
                                                color={getSeverityColor(log.severity) as any}
                                                sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                                            />
                                        </Box>
                                    </Box>

                                    <Divider sx={{ mb: 2 }} />

                                    {/* Actor and target information */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Performed by:{' '}
                                            <strong>
                                                {log.actorId?.firstName} {log.actorId?.lastName}
                                            </strong>{' '}
                                            ({log.actorId?.email})
                                        </Typography>
                                        {log.targetId && (
                                            <Typography variant="body2" color="text.secondary">
                                                Target:{' '}
                                                <strong>
                                                    {log.targetId?.firstName} {log.targetId?.lastName}
                                                </strong>{' '}
                                                ({log.targetId?.email})
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Reason */}
                                    {log.details?.reason && (
                                        <Alert severity="info" sx={{ mb: 2 }}>
                                            <strong>Reason:</strong> {log.details.reason}
                                        </Alert>
                                    )}

                                    {/* Before/After details */}
                                    {(log.details?.before || log.details?.after) && (
                                        <Accordion>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant="caption">View Details</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Grid container spacing={2}>
                                                    {log.details.before && (
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="error">
                                                                BEFORE:
                                                            </Typography>
                                                            <Paper sx={{ p: 1, bgcolor: 'grey.100', mt: 0.5 }}>
                                                                <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem' }}>
                                                                    {JSON.stringify(log.details.before, null, 2)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                    )}
                                                    {log.details.after && (
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="success.main">
                                                                AFTER:
                                                            </Typography>
                                                            <Paper sx={{ p: 1, bgcolor: 'grey.100', mt: 0.5 }}>
                                                                <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem' }}>
                                                                    {JSON.stringify(log.details.after, null, 2)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                    )}
                                                </Grid>
                                            </AccordionDetails>
                                        </Accordion>
                                    )}

                                    {/* IP Address */}
                                    {log.ipAddress && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                            IP: {log.ipAddress}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>

                    {/* Pagination */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(_, value) => setPage(value)}
                            color="primary"
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

export default AuditTrail;
