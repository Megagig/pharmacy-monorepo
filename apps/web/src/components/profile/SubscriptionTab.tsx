import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    LinearProgress,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    TrendingUp as TrendingUpIcon,
    Receipt as ReceiptIcon,
    Download as DownloadIcon,
    CreditCard as CreditCardIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStatus } from '../../hooks/useSubscription';
import { apiClient } from '../../services/apiClient';
import { format } from 'date-fns';
import LoadingSpinner from '../LoadingSpinner';

interface Plan {
    _id: string;
    name: string;
    tier: string;
    price: number;
    currency: string;
    billingPeriod: string;
    features: string[];
}

interface Invoice {
    _id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    dueDate: string;
    paidAt?: string;
}

const SubscriptionTab: React.FC = () => {
    const navigate = useNavigate();
    const subscriptionStatus = useSubscriptionStatus();
    const [loading, setLoading] = useState(true);
    const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

    useEffect(() => {
        fetchSubscriptionData();
    }, []);

    const fetchSubscriptionData = async () => {
        try {
            setLoading(true);

            // Fetch current plan details
            const planResponse = await apiClient.get('/subscriptions/current-plan');
            if (planResponse.data.success) {
                setCurrentPlan(planResponse.data.data);
            }

            // Fetch billing history
            const invoicesResponse = await apiClient.get('/subscriptions/billing-history');
            if (invoicesResponse.data.success) {
                setInvoices(invoicesResponse.data.data || []);
            }

            // Fetch usage stats
            const usageResponse = await apiClient.get('/subscriptions/usage-stats');
            if (usageResponse.data.success) {
                setUsageStats(usageResponse.data.data);
            }
        } catch (error) {
            console.error('Error fetching subscription data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = () => {
        navigate('/subscriptions');
    };

    const handleDownloadInvoice = async (invoiceId: string) => {
        try {
            const response = await apiClient.get(`/subscriptions/invoices/${invoiceId}/download`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice-${invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading invoice:', error);
        }
    };

    const formatCurrency = (amount: number, currency: string = 'NGN') => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getUsagePercentage = (used: number, limit: number | null) => {
        if (!limit) return 0;
        return (used / limit) * 100;
    };

    const getUsageColor = (percentage: number) => {
        if (percentage >= 90) return 'error';
        if (percentage >= 75) return 'warning';
        return 'success';
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <Box>
            {/* Current Plan Overview */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Current Subscription Plan
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<TrendingUpIcon />}
                            onClick={handleUpgrade}
                        >
                            Upgrade Plan
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Box>
                                <Typography variant="h4" gutterBottom>
                                    {currentPlan?.name || subscriptionStatus.tier?.toUpperCase() || 'Free Trial'}
                                </Typography>
                                <Chip
                                    label={subscriptionStatus.status?.toUpperCase() || 'ACTIVE'}
                                    color={subscriptionStatus.isActive ? 'success' : 'warning'}
                                    sx={{ mb: 2 }}
                                />

                                {currentPlan && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="h3" color="primary">
                                            {formatCurrency(currentPlan.price, currentPlan.currency)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            per {currentPlan.billingPeriod}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <List dense>
                                {subscriptionStatus.endDate && (
                                    <ListItem>
                                        <ListItemIcon>
                                            <InfoIcon color="action" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Next Billing Date"
                                            secondary={format(new Date(subscriptionStatus.endDate), 'PPP')}
                                        />
                                    </ListItem>
                                )}
                                {subscriptionStatus.daysRemaining && (
                                    <ListItem>
                                        <ListItemIcon>
                                            <WarningIcon color={subscriptionStatus.daysRemaining < 7 ? 'warning' : 'action'} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={subscriptionStatus.isTrialActive ? 'Trial Days Remaining' : 'Days Until Renewal'}
                                            secondary={`${subscriptionStatus.daysRemaining} days`}
                                        />
                                    </ListItem>
                                )}
                                <ListItem>
                                    <ListItemIcon>
                                        <CreditCardIcon color="action" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Payment Method"
                                        secondary="Paystack / Nomba"
                                    />
                                </ListItem>
                            </List>
                        </Grid>
                    </Grid>

                    {/* Plan Features */}
                    {currentPlan?.features && currentPlan.features.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Plan Features
                            </Typography>
                            <Grid container spacing={1}>
                                {currentPlan.features.slice(0, 12).map((feature, index) => (
                                    <Grid item xs={12} sm={6} md={4} key={index}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CheckCircleIcon color="success" fontSize="small" />
                                            <Typography variant="body2">{feature}</Typography>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Usage Metrics */}
            {usageStats && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Usage & Limits
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <Grid container spacing={3}>
                            {usageStats.patients && (
                                <Grid item xs={12} md={6}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">Patients</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {usageStats.patients.used} / {usageStats.patients.limit || 'Unlimited'}
                                            </Typography>
                                        </Box>
                                        {usageStats.patients.limit && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={getUsagePercentage(usageStats.patients.used, usageStats.patients.limit)}
                                                color={getUsageColor(getUsagePercentage(usageStats.patients.used, usageStats.patients.limit))}
                                            />
                                        )}
                                    </Box>
                                </Grid>
                            )}

                            {usageStats.users && (
                                <Grid item xs={12} md={6}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">Team Members</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {usageStats.users.used} / {usageStats.users.limit || 'Unlimited'}
                                            </Typography>
                                        </Box>
                                        {usageStats.users.limit && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={getUsagePercentage(usageStats.users.used, usageStats.users.limit)}
                                                color={getUsageColor(getUsagePercentage(usageStats.users.used, usageStats.users.limit))}
                                            />
                                        )}
                                    </Box>
                                </Grid>
                            )}

                            {usageStats.storage && (
                                <Grid item xs={12} md={6}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">Storage</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {(usageStats.storage.used / 1024 / 1024).toFixed(2)} MB / {usageStats.storage.limit ? `${usageStats.storage.limit / 1024 / 1024} MB` : 'Unlimited'}
                                            </Typography>
                                        </Box>
                                        {usageStats.storage.limit && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={getUsagePercentage(usageStats.storage.used, usageStats.storage.limit)}
                                                color={getUsageColor(getUsagePercentage(usageStats.storage.used, usageStats.storage.limit))}
                                            />
                                        )}
                                    </Box>
                                </Grid>
                            )}

                            {usageStats.apiCalls && (
                                <Grid item xs={12} md={6}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">API Calls (This Month)</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {usageStats.apiCalls.used} / {usageStats.apiCalls.limit || 'Unlimited'}
                                            </Typography>
                                        </Box>
                                        {usageStats.apiCalls.limit && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={getUsagePercentage(usageStats.apiCalls.used, usageStats.apiCalls.limit)}
                                                color={getUsageColor(getUsagePercentage(usageStats.apiCalls.used, usageStats.apiCalls.limit))}
                                            />
                                        )}
                                    </Box>
                                </Grid>
                            )}
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Billing History */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Billing History
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {invoices.length === 0 ? (
                        <Alert severity="info">
                            No billing history available yet.
                        </Alert>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Invoice #</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Amount</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {invoices.map((invoice) => (
                                        <TableRow key={invoice._id}>
                                            <TableCell>{invoice.invoiceNumber}</TableCell>
                                            <TableCell>{format(new Date(invoice.createdAt), 'PPP')}</TableCell>
                                            <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={invoice.status.toUpperCase()}
                                                    color={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDownloadInvoice(invoice._id)}
                                                    title="Download Invoice"
                                                >
                                                    <DownloadIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default SubscriptionTab;
