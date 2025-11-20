import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Button,
    Alert,
    Pagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Snackbar,
    Card,
    CardContent,
    Fade,
    Skeleton,
    Stack,
    Chip,
    useTheme,
    useMediaQuery,
    IconButton,
    Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import superAdminAuditService, {
    AuditFilters as AuditFiltersType,
    AuditLog,
    AuditStats as AuditStatsType,
} from '../services/superAdminAuditService';
import ActivityCard from '../components/audit/ActivityCard';
import AuditFilters from '../components/audit/AuditFilters';
import AuditStats from '../components/audit/AuditStats';

const SuperAdminAuditTrail: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStatsType | null>(null);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 50,
        pages: 0,
    });
    const [filters, setFilters] = useState<AuditFiltersType>({
        page: 1,
        limit: 50,
    });
    const [activityTypes, setActivityTypes] = useState<string[]>([]);
    const [riskLevels, setRiskLevels] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<AuditLog | null>(null);
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'success',
    });

    // Fetch audit trail
    const fetchAuditTrail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await superAdminAuditService.getAuditTrail(filters);
            setLogs(response.logs);
            setPagination(response.pagination);
        } catch (err: any) {
            const errorMessage = typeof err.response?.data?.error === 'string'
                ? err.response.data.error
                : err.response?.data?.message || err.message || 'Failed to fetch audit trail';
            setError(errorMessage);
            showSnackbar(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Fetch statistics
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const statsData = await superAdminAuditService.getAuditStats(
                filters.workplaceId,
                filters.startDate,
                filters.endDate
            );
            setStats(statsData);
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [filters.workplaceId, filters.startDate, filters.endDate]);

    // Fetch activity types and risk levels
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [types, levels] = await Promise.all([
                    superAdminAuditService.getActivityTypes(),
                    superAdminAuditService.getRiskLevels(),
                ]);
                setActivityTypes(types);
                setRiskLevels(levels);
            } catch (err) {
                console.error('Failed to fetch metadata:', err);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch data on mount and filter changes
    useEffect(() => {
        fetchAuditTrail();
    }, [fetchAuditTrail]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Handle filter changes
    const handleFilterChange = (newFilters: AuditFiltersType) => {
        setFilters({ ...newFilters, page: 1 });
    };

    // Handle pagination
    const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
        setFilters({ ...filters, page });
    };

    // Handle flag toggle
    const handleFlag = async (auditId: string, flagged: boolean) => {
        try {
            await superAdminAuditService.flagAuditEntry(auditId, flagged);
            showSnackbar(`Activity ${flagged ? 'flagged' : 'unflagged'} successfully`, 'success');
            fetchAuditTrail();
            fetchStats();
        } catch (err: any) {
            showSnackbar('Failed to update flag status', 'error');
        }
    };

    // Handle review
    const handleOpenReview = (activity: AuditLog) => {
        setSelectedActivity(activity);
        setReviewNotes('');
        setReviewDialogOpen(true);
    };

    const handleSubmitReview = async () => {
        if (!selectedActivity || !reviewNotes.trim()) {
            showSnackbar('Please enter review notes', 'error');
            return;
        }

        try {
            await superAdminAuditService.reviewAuditEntry(selectedActivity._id, reviewNotes);
            showSnackbar('Review submitted successfully', 'success');
            setReviewDialogOpen(false);
            setSelectedActivity(null);
            setReviewNotes('');
            fetchAuditTrail();
            fetchStats();
        } catch (err: any) {
            showSnackbar('Failed to submit review', 'error');
        }
    };

    // Handle export
    const handleExport = async (format: 'json' | 'csv') => {
        try {
            showSnackbar(`Exporting audit data as ${format.toUpperCase()}...`, 'info');
            const blob = await superAdminAuditService.exportAuditData(filters, format);
            const filename = `audit-trail-${new Date().toISOString().split('T')[0]}.${format}`;
            superAdminAuditService.downloadFile(blob, filename);
            showSnackbar('Export completed successfully', 'success');
        } catch (err: any) {
            showSnackbar('Failed to export data', 'error');
        }
    };

    // Show snackbar
    const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                pb: 4,
            }}
        >
            <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 } }}>
                {/* Modern Header Section */}
                <Fade in timeout={600}>
                    <Card
                        elevation={0}
                        sx={{
                            mb: 3,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            color: 'white',
                            borderRadius: 3,
                            overflow: 'hidden',
                        }}
                    >
                        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                            <Box
                                display="flex"
                                flexDirection={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', md: 'center' }}
                                gap={2}
                            >
                                <Box>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                                        <AssessmentIcon sx={{ fontSize: 32 }} />
                                        <Typography
                                            variant={isMobile ? 'h5' : 'h4'}
                                            fontWeight="700"
                                            sx={{
                                                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            }}
                                        >
                                            Unified Audit Trail
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            opacity: 0.95,
                                            maxWidth: 600,
                                        }}
                                    >
                                        Comprehensive activity monitoring and compliance tracking for all system operations
                                    </Typography>
                                    {stats && (
                                        <Box display="flex" gap={2} mt={2} flexWrap="wrap">
                                            <Chip
                                                label={`${stats.totalActivities.toLocaleString()} Total Activities`}
                                                sx={{
                                                    bgcolor: 'rgba(255,255,255,0.2)',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    backdropFilter: 'blur(10px)',
                                                }}
                                                size="small"
                                            />
                                            {stats.failedActivities > 0 && (
                                                <Chip
                                                    label={`${stats.failedActivities} Failed`}
                                                    sx={{
                                                        bgcolor: 'rgba(211, 47, 47, 0.3)',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        backdropFilter: 'blur(10px)',
                                                    }}
                                                    size="small"
                                                />
                                            )}
                                        </Box>
                                    )}
                                </Box>

                                {/* Action Buttons */}
                                <Stack
                                    direction={{ xs: 'row', sm: 'row' }}
                                    spacing={1}
                                    flexWrap="wrap"
                                    sx={{ width: { xs: '100%', md: 'auto' } }}
                                >
                                    <Button
                                        variant="contained"
                                        startIcon={<RefreshIcon />}
                                        onClick={() => {
                                            fetchAuditTrail();
                                            fetchStats();
                                        }}
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.2)',
                                            backdropFilter: 'blur(10px)',
                                            '&:hover': {
                                                bgcolor: 'rgba(255,255,255,0.3)',
                                            },
                                            fontWeight: 600,
                                            flex: { xs: 1, sm: 'none' },
                                        }}
                                        size={isMobile ? 'small' : 'medium'}
                                    >
                                        Refresh
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<CloudDownloadIcon />}
                                        onClick={() => handleExport('csv')}
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.2)',
                                            backdropFilter: 'blur(10px)',
                                            '&:hover': {
                                                bgcolor: 'rgba(255,255,255,0.3)',
                                            },
                                            fontWeight: 600,
                                            flex: { xs: 1, sm: 'none' },
                                        }}
                                        size={isMobile ? 'small' : 'medium'}
                                    >
                                        CSV
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleExport('json')}
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.2)',
                                            backdropFilter: 'blur(10px)',
                                            '&:hover': {
                                                bgcolor: 'rgba(255,255,255,0.3)',
                                            },
                                            fontWeight: 600,
                                            flex: { xs: 1, sm: 'none' },
                                        }}
                                        size={isMobile ? 'small' : 'medium'}
                                    >
                                        JSON
                                    </Button>
                                </Stack>
                            </Box>
                        </CardContent>
                    </Card>
                </Fade>

                {/* Statistics Section */}
                <Fade in timeout={800}>
                    <Box>
                        {statsLoading ? (
                            <Box mb={3}>
                                <Stack spacing={2}>
                                    <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                                    <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                                </Stack>
                            </Box>
                        ) : (
                            <AuditStats stats={stats} loading={statsLoading} />
                        )}
                    </Box>
                </Fade>

                {/* Filters Section with Collapse */}
                <Fade in timeout={1000}>
                    <Card
                        elevation={0}
                        sx={{
                            mb: 3,
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`,
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
                                },
                            }}
                            onClick={() => setFiltersExpanded(!filtersExpanded)}
                        >
                            <Box display="flex" alignItems="center" gap={1}>
                                <FilterListIcon color="primary" />
                                <Typography variant="h6" fontWeight="600">
                                    Filters
                                </Typography>
                                <Chip
                                    label={Object.keys(filters).filter(k => filters[k as keyof AuditFiltersType] && k !== 'page' && k !== 'limit').length || 'None'}
                                    size="small"
                                    color="primary"
                                    sx={{ ml: 1 }}
                                />
                            </Box>
                            <IconButton size="small">
                                {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Box>
                        <Box
                            sx={{
                                maxHeight: filtersExpanded ? '1000px' : '0px',
                                overflow: 'hidden',
                                transition: 'max-height 0.3s ease-in-out',
                            }}
                        >
                            <Divider />
                            <Box sx={{ p: 2 }}>
                                <AuditFilters
                                    filters={filters}
                                    onChange={handleFilterChange}
                                    activityTypes={activityTypes}
                                    riskLevels={riskLevels}
                                />
                            </Box>
                        </Box>
                    </Card>
                </Fade>

                {/* Error Alert */}
                {error && (
                    <Fade in timeout={400}>
                        <Alert
                            severity="error"
                            sx={{
                                mb: 3,
                                borderRadius: 2,
                                boxShadow: 1,
                            }}
                            onClose={() => setError(null)}
                        >
                            {error}
                        </Alert>
                    </Fade>
                )}

                {/* Activity List Section */}
                <Fade in timeout={1200}>
                    <Card
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Activity List Header */}
                        <Box
                            sx={{
                                p: 3,
                                bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50',
                                borderBottom: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            <Box
                                display="flex"
                                flexDirection={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                gap={2}
                            >
                                <Box>
                                    <Typography variant="h6" fontWeight="600" gutterBottom>
                                        Activity Log
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {pagination.total.toLocaleString()} total entries found
                                    </Typography>
                                </Box>
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                    sx={{
                                        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'background.paper',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                    }}
                                >
                                    <Typography variant="body2" color="text.secondary" fontWeight="500">
                                        Page {pagination.page} of {pagination.pages}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Activity List Content */}
                        <Box sx={{ p: { xs: 2, md: 3 } }}>
                            {loading ? (
                                <Stack spacing={2}>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton
                                            key={i}
                                            variant="rectangular"
                                            height={120}
                                            sx={{ borderRadius: 2 }}
                                        />
                                    ))}
                                </Stack>
                            ) : logs.length === 0 ? (
                                <Box
                                    sx={{
                                        textAlign: 'center',
                                        py: 10,
                                        px: 2,
                                    }}
                                >
                                    <AssessmentIcon
                                        sx={{
                                            fontSize: 80,
                                            color: 'text.disabled',
                                            mb: 2,
                                        }}
                                    />
                                    <Typography variant="h6" color="text.secondary" gutterBottom>
                                        No activities found
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Try adjusting your filters to see more results
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    <Stack spacing={2}>
                                        {logs.map((activity, index) => (
                                            <Fade in timeout={400 + index * 50} key={activity._id}>
                                                <Box>
                                                    <ActivityCard
                                                        activity={activity}
                                                        onFlag={handleFlag}
                                                        onViewDetails={handleOpenReview}
                                                    />
                                                </Box>
                                            </Fade>
                                        ))}
                                    </Stack>

                                    {/* Pagination */}
                                    {pagination.pages > 1 && (
                                        <Box
                                            display="flex"
                                            justifyContent="center"
                                            mt={4}
                                            pt={3}
                                            borderTop={`1px solid ${theme.palette.divider}`}
                                        >
                                            <Pagination
                                                count={pagination.pages}
                                                page={pagination.page}
                                                onChange={handlePageChange}
                                                color="primary"
                                                size={isMobile ? 'medium' : 'large'}
                                                siblingCount={isMobile ? 0 : 1}
                                                sx={{
                                                    '& .MuiPaginationItem-root': {
                                                        fontWeight: 600,
                                                    },
                                                }}
                                            />
                                        </Box>
                                    )}
                                </>
                            )}
                        </Box>
                    </Card>
                </Fade>

                {/* Review Dialog */}
                <Dialog
                    open={reviewDialogOpen}
                    onClose={() => setReviewDialogOpen(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                        },
                    }}
                >
                    <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: '1.25rem' }}>
                        Review Activity
                    </DialogTitle>
                    <Divider />
                    <DialogContent sx={{ pt: 3 }}>
                        {selectedActivity && (
                            <Box>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        mb: 3,
                                        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
                                        borderRadius: 2,
                                    }}
                                >
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Activity Description
                                    </Typography>
                                    <Typography variant="body1" fontWeight="500">
                                        {selectedActivity.description}
                                    </Typography>
                                </Paper>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    label="Review Notes"
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Enter your review notes here..."
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Box>
                        )}
                    </DialogContent>
                    <Divider />
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button
                            onClick={() => setReviewDialogOpen(false)}
                            variant="outlined"
                            sx={{ borderRadius: 2 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitReview}
                            variant="contained"
                            color="primary"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        >
                            Submit Review
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleCloseSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert
                        onClose={handleCloseSnackbar}
                        severity={snackbar.severity}
                        sx={{
                            width: '100%',
                            borderRadius: 2,
                            boxShadow: 3,
                        }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </Box>
    );
};

export default SuperAdminAuditTrail;
