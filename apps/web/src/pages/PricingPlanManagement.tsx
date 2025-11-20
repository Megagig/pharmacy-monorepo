import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Tooltip,
    Divider,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import toast from 'react-hot-toast';
import pricingPlanService, { PricingPlan, SyncResult } from '../services/pricingPlanService';

const PricingPlanManagement: React.FC = () => {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncResultDialog, setSyncResultDialog] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await pricingPlanService.getAllPlans();
            setPlans(data);

        } catch (error: any) {
            console.error('❌ Error fetching pricing plans:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to fetch pricing plans';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncAll = async () => {
        try {
            setSyncing(true);
            setError(null);

            const result = await pricingPlanService.syncAllPlans();

            setLastSyncResult(result.data);
            setSyncResultDialog(true);

            if (result.success) {
                toast.success('Pricing plans synced successfully!');
                await fetchPlans(); // Refresh the list
            } else {
                toast.error('Sync completed with errors');
            }
        } catch (error: any) {
            console.error('❌ Sync error:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to sync pricing plans';
            toast.error(errorMessage);
            setError(errorMessage);
        } finally {
            setSyncing(false);
        }
    };

    const handleValidateSubscriptions = async () => {
        try {
            setValidating(true);
            setError(null);

            const result = await pricingPlanService.validateSubscriptions();

            setLastSyncResult(result.data);
            setSyncResultDialog(true);

            if (result.success) {
                toast.success('All subscriptions validated successfully!');
            } else {
                toast.error('Subscription validation completed with errors');
            }
        } catch (error: any) {
            console.error('❌ Validation error:', error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to validate subscriptions';
            toast.error(errorMessage);
            setError(errorMessage);
        } finally {
            setValidating(false);
        }
    };

    const getTierColor = (tier: string) => {
        const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
            free_trial: 'default',
            basic: 'primary',
            pro: 'secondary',
            pharmily: 'success',
            network: 'warning',
            enterprise: 'error',
        };
        return colors[tier] || 'default';
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress size={48} />
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                        Loading pricing plans...
                    </Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
            {/* Header */}
            <Box mb={3}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Pricing Plan Management
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    View and manage pricing plans. Plans are automatically synced with feature flags.
                    When you toggle features in the Feature Management UI, the pricing plans update automatically.
                </Typography>
            </Box>

            {/* Action Buttons */}
            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                    onClick={handleSyncAll}
                    disabled={syncing || validating}
                >
                    {syncing ? 'Syncing...' : 'Sync All Plans'}
                </Button>
                <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={validating ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                    onClick={handleValidateSubscriptions}
                    disabled={syncing || validating}
                >
                    {validating ? 'Validating...' : 'Validate Subscriptions'}
                </Button>
                <Tooltip title="Refresh pricing plans list">
                    <IconButton onClick={fetchPlans} disabled={syncing || validating}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                    <strong>How it works:</strong>
                </Typography>
                <Typography variant="body2" component="div">
                    1. Toggle features in the <strong>Feature Management</strong> tab
                    <br />
                    2. Pricing plans automatically sync with the tier matrix
                    <br />
                    3. All active subscriptions update instantly
                    <br />
                    4. No need for scripts or database commands!
                </Typography>
            </Alert>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Plans Grid */}
            {plans.length === 0 ? (
                <Alert severity="warning">
                    No pricing plans found. Plans should be created in the database.
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {plans.map((plan) => (
                        <Grid item xs={12} md={6} lg={4} key={plan._id}>
                            <Card
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: plan.isPopular ? '2px solid' : undefined,
                                    borderColor: plan.isPopular ? 'primary.main' : undefined,
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    {/* Header */}
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                        <Box>
                                            <Typography variant="h5" component="h2" gutterBottom>
                                                {plan.name}
                                            </Typography>
                                            <Chip
                                                label={plan.tier.replace('_', ' ')}
                                                color={getTierColor(plan.tier)}
                                                size="small"
                                                sx={{ mr: 1 }}
                                            />
                                            {plan.isPopular && (
                                                <Chip label="Popular" color="primary" size="small" variant="outlined" />
                                            )}
                                            {!plan.isActive && (
                                                <Chip label="Inactive" color="default" size="small" sx={{ ml: 1 }} />
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Price */}
                                    <Box mb={2}>
                                        <Typography variant="h4" component="div" color="primary">
                                            ₦{plan.price.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            per {plan.billingPeriod}
                                        </Typography>
                                    </Box>

                                    <Divider sx={{ my: 2 }} />

                                    {/* Features */}
                                    <Box>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Features ({plan.featureCount})
                                        </Typography>
                                        <Box
                                            sx={{
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                pr: 1,
                                                '&::-webkit-scrollbar': {
                                                    width: '6px',
                                                },
                                                '&::-webkit-scrollbar-thumb': {
                                                    backgroundColor: 'action.selected',
                                                    borderRadius: '3px',
                                                },
                                            }}
                                        >
                                            {plan.features.length === 0 ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    No features assigned
                                                </Typography>
                                            ) : (
                                                plan.features.map((feature, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={feature}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ m: 0.5, fontSize: '0.75rem' }}
                                                    />
                                                ))
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Plan Details */}
                                    <Box mt={2}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Slug: {plan.slug}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Order: {plan.order}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Sync Result Dialog */}
            <Dialog
                open={syncResultDialog}
                onClose={() => setSyncResultDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {lastSyncResult?.errors && lastSyncResult.errors.length > 0 ? (
                        <Box display="flex" alignItems="center" gap={1}>
                            <WarningIcon color="warning" />
                            <span>Sync Completed with Warnings</span>
                        </Box>
                    ) : (
                        <Box display="flex" alignItems="center" gap={1}>
                            <CheckCircleIcon color="success" />
                            <span>Sync Successful</span>
                        </Box>
                    )}
                </DialogTitle>
                <DialogContent>
                    {lastSyncResult && (
                        <Box>
                            <List dense>
                                {lastSyncResult.plansUpdated !== undefined && (
                                    <ListItem>
                                        <ListItemText
                                            primary="Pricing Plans Updated"
                                            secondary={lastSyncResult.plansUpdated}
                                        />
                                    </ListItem>
                                )}
                                {lastSyncResult.plansFailed !== undefined && lastSyncResult.plansFailed > 0 && (
                                    <ListItem>
                                        <ListItemText
                                            primary="Pricing Plans Failed"
                                            secondary={lastSyncResult.plansFailed}
                                            secondaryTypographyProps={{ color: 'error' }}
                                        />
                                    </ListItem>
                                )}
                                {lastSyncResult.subscriptionsUpdated !== undefined && (
                                    <ListItem>
                                        <ListItemText
                                            primary="Subscriptions Synced"
                                            secondary={lastSyncResult.subscriptionsUpdated}
                                        />
                                    </ListItem>
                                )}
                                {lastSyncResult.subscriptionsFixed !== undefined && (
                                    <ListItem>
                                        <ListItemText
                                            primary="Subscriptions Fixed"
                                            secondary={lastSyncResult.subscriptionsFixed}
                                        />
                                    </ListItem>
                                )}
                                {lastSyncResult.totalSubscriptions !== undefined && (
                                    <ListItem>
                                        <ListItemText
                                            primary="Total Subscriptions"
                                            secondary={lastSyncResult.totalSubscriptions}
                                        />
                                    </ListItem>
                                )}
                            </List>

                            {lastSyncResult.errors && lastSyncResult.errors.length > 0 && (
                                <Box mt={2}>
                                    <Typography variant="subtitle2" color="error" gutterBottom>
                                        Errors:
                                    </Typography>
                                    <List dense>
                                        {lastSyncResult.errors.map((error, index) => (
                                            <ListItem key={index}>
                                                <ListItemText
                                                    primary={error}
                                                    primaryTypographyProps={{ variant: 'caption', color: 'error' }}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSyncResultDialog(false)} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default PricingPlanManagement;
