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
    Alert,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Collapse,
    IconButton,
    Skeleton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../../hooks/useAuth';
import { useRBAC } from '../../hooks/useRBAC';
import { useSubscriptionStatus } from '../../hooks/useSubscription';
import { apiClient } from '../../services/apiClient';
import { useNavigate } from 'react-router-dom';

interface Plan {
    _id: string;
    name: string;
    tier: string;
    priceNGN: number;
    billingInterval: 'monthly' | 'yearly';
    features: string[];
    featuresDetails?: PricingFeature[];
}

interface PricingFeature {
    featureId: string;
    name: string;
    description: string;
    category: string;
}

interface SubscriptionData {
    features: string[];
    limits: {
        patients: number | null;
        users: number | null;
        locations: number | null;
        storage: number | null;
        apiCalls: number | null;
    };
    usageMetrics: Array<{
        feature: string;
        count: number;
        lastUpdated: Date;
    }>;
}

const FeaturesTab: React.FC = () => {
    const { user } = useAuth();
    const { hasFeature } = useRBAC();
    const subscriptionStatus = useSubscriptionStatus();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [allPlans, setAllPlans] = useState<Plan[]>([]);
    const [currentPlanFeatures, setCurrentPlanFeatures] = useState<string[]>([]);
    const [availableFeatures, setAvailableFeatures] = useState<PricingFeature[]>([]);
    const [usageData, setUsageData] = useState<any>(null);
    const [showComparison, setShowComparison] = useState(false);

    useEffect(() => {
        fetchFeaturesData();
    }, []);

    const fetchFeaturesData = async () => {
        try {
            setLoading(true);

            // Fetch all pricing plans with features
            const plansResponse = await apiClient.get('/pricing/plans');
            if (plansResponse.data.success) {
                setAllPlans(plansResponse.data.data.plans || []);
                setAvailableFeatures(plansResponse.data.data.features || []);
            }

            // Fetch current subscription data - use the correct endpoint
            try {
                const subResponse = await apiClient.get('/subscriptions/');
                if (subResponse.data.success && subResponse.data.data) {
                    const subscription = subResponse.data.data;
                    setCurrentPlanFeatures(subscription.features || []);

                    // Set usage data if available
                    if (subscription.usageMetrics) {
                        setUsageData({ usageMetrics: subscription.usageMetrics });
                    }
                }
            } catch (subError) {
                console.warn('Could not fetch subscription data:', subError);
                // Continue without subscription data - user might be on free tier
            }
        } catch (error) {
            console.error('Error fetching features data:', error);
        } finally {
            setLoading(false);
        }
    };

    const groupFeaturesByCategory = () => {
        const grouped: { [key: string]: PricingFeature[] } = {};
        availableFeatures.forEach(feature => {
            if (!grouped[feature.category]) {
                grouped[feature.category] = [];
            }
            grouped[feature.category].push(feature);
        });
        return grouped;
    };

    const isFeatureEnabled = (featureId: string): boolean => {
        return currentPlanFeatures.includes(featureId);
    };

    const getCurrentPlan = (): Plan | undefined => {
        return allPlans.find(plan => plan.tier === subscriptionStatus.tier);
    };

    const getFeatureUsage = (featureId: string) => {
        if (!usageData?.usageMetrics) return null;
        return usageData.usageMetrics.find((m: any) => m.feature === featureId);
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
        return (
            <Box>
                <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
                    {[1, 2, 3].map((i) => (
                        <Box key={i} sx={{ flex: '1 1 300px' }}>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                        </Box>
                    ))}
                </Box>
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }

    const groupedFeatures = groupFeaturesByCategory();
    const enabledFeatures = availableFeatures.filter(f => isFeatureEnabled(f.featureId));
    const lockedFeatures = availableFeatures.filter(f => !isFeatureEnabled(f.featureId));
    const currentPlan = getCurrentPlan();

    // Show message if no enabled features found
    const hasEnabledFeatures = enabledFeatures.length > 0;

    return (
        <Box>
            {/* Summary Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
                <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Enabled Features
                        </Typography>
                        <Typography variant="h3" color="success.main" sx={{ mb: 1 }}>
                            {enabledFeatures.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Active in your plan
                        </Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Locked Features
                        </Typography>
                        <Typography variant="h3" color="warning.main" sx={{ mb: 1 }}>
                            {lockedFeatures.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Available with upgrade
                        </Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 300px', minWidth: 250 }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Current Plan
                        </Typography>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                            {currentPlan?.name || 'Free Trial'}
                        </Typography>
                        <Chip
                            label={subscriptionStatus.tier?.replace('_', ' ').toUpperCase() || 'FREE'}
                            color="primary"
                            size="small"
                        />
                    </CardContent>
                </Card>
            </Box>

            {/* Enabled Features by Category */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon color="success" />
                        Your Enabled Features
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    {!hasEnabledFeatures ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            No features are currently enabled. Contact support or upgrade your plan to access premium features.
                        </Alert>
                    ) : (
                        Object.entries(groupedFeatures).map(([category, categoryFeatures]) => {
                            const enabledInCategory = categoryFeatures.filter(f => isFeatureEnabled(f.featureId));
                            if (enabledInCategory.length === 0) return null;

                            return (
                                <Box key={category} sx={{ mb: 4 }}>
                                    <Typography
                                        variant="subtitle1"
                                        color="primary"
                                        gutterBottom
                                        sx={{
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                            mb: 2
                                        }}
                                    >
                                        {category}
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 2,
                                        mb: 2
                                    }}>
                                        {enabledInCategory.map((feature) => {
                                            const usage = getFeatureUsage(feature.featureId);
                                            return (
                                                <Card
                                                    key={feature.featureId}
                                                    variant="outlined"
                                                    sx={{
                                                        flex: '1 1 calc(33.333% - 16px)',
                                                        minWidth: 280,
                                                        p: 2,
                                                        borderRadius: 2,
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            boxShadow: 2,
                                                            borderColor: 'success.main'
                                                        }
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                                        <CheckCircleIcon
                                                            color="success"
                                                            sx={{ mt: 0.3, fontSize: 20 }}
                                                        />
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={600}
                                                                sx={{ mb: 0.5 }}
                                                            >
                                                                {feature.name}
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{ display: 'block', mb: usage ? 1.5 : 0 }}
                                                            >
                                                                {feature.description}
                                                            </Typography>

                                                            {/* Usage tracking if available */}
                                                            {usage && (
                                                                <Box sx={{ mt: 1.5 }}>
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        mb: 0.5,
                                                                        alignItems: 'center'
                                                                    }}>
                                                                        <Typography
                                                                            variant="caption"
                                                                            color="text.secondary"
                                                                            fontWeight={500}
                                                                        >
                                                                            Usage
                                                                        </Typography>
                                                                        <Chip
                                                                            label={`${usage.count} used`}
                                                                            size="small"
                                                                            color="success"
                                                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                                                        />
                                                                    </Box>
                                                                    <LinearProgress
                                                                        variant="determinate"
                                                                        value={Math.min((usage.count / 100) * 100, 100)}
                                                                        color="success"
                                                                        sx={{
                                                                            height: 6,
                                                                            borderRadius: 1,
                                                                            bgcolor: 'action.hover'
                                                                        }}
                                                                    />
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </Card>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Locked Features - Upgrade Prompts */}
            {lockedFeatures.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                            flexWrap: 'wrap',
                            gap: 2
                        }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LockIcon color="warning" />
                                Unlock More Features
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<TrendingUpIcon />}
                                onClick={() => navigate('/subscriptions')}
                                sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    px: 3
                                }}
                            >
                                Upgrade Now
                            </Button>
                        </Box>
                        <Divider sx={{ mb: 3 }} />

                        <Alert
                            severity="info"
                            sx={{
                                mb: 3,
                                borderRadius: 2,
                                '& .MuiAlert-icon': {
                                    fontSize: 24
                                }
                            }}
                        >
                            Upgrade your plan to unlock these premium features and grow your pharmacy practice.
                        </Alert>

                        {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => {
                            const lockedInCategory = categoryFeatures.filter(f => !isFeatureEnabled(f.featureId));
                            if (lockedInCategory.length === 0) return null;

                            return (
                                <Box key={category} sx={{ mb: 4 }}>
                                    <Typography
                                        variant="subtitle1"
                                        color="text.secondary"
                                        gutterBottom
                                        sx={{
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                            mb: 2
                                        }}
                                    >
                                        {category}
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 2
                                    }}>
                                        {lockedInCategory.map((feature) => {
                                            // Find which plan has this feature
                                            const planWithFeature = allPlans.find(p => p.features?.includes(feature.featureId));
                                            return (
                                                <Card
                                                    key={feature.featureId}
                                                    variant="outlined"
                                                    sx={{
                                                        flex: '1 1 calc(33.333% - 16px)',
                                                        minWidth: 280,
                                                        p: 2,
                                                        borderRadius: 2,
                                                        bgcolor: 'action.hover',
                                                        borderColor: 'divider',
                                                        transition: 'all 0.2s',
                                                        position: 'relative',
                                                        overflow: 'visible',
                                                        '&:hover': {
                                                            boxShadow: 2,
                                                            borderColor: 'warning.main',
                                                            bgcolor: 'background.paper'
                                                        }
                                                    }}
                                                >
                                                    {planWithFeature && (
                                                        <Chip
                                                            label={planWithFeature.name}
                                                            size="small"
                                                            color="warning"
                                                            sx={{
                                                                position: 'absolute',
                                                                top: -10,
                                                                right: 12,
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}
                                                        />
                                                    )}
                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: 1.5
                                                    }}>
                                                        <LockIcon
                                                            color="action"
                                                            sx={{ mt: 0.3, fontSize: 20, opacity: 0.5 }}
                                                        />
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={600}
                                                                sx={{ mb: 0.5, color: 'text.primary' }}
                                                            >
                                                                {feature.name}
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{ display: 'block', lineHeight: 1.4 }}
                                                            >
                                                                {feature.description}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Card>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Tier Comparison */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Plan Comparison
                        </Typography>
                        <IconButton onClick={() => setShowComparison(!showComparison)}>
                            {showComparison ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>

                    <Collapse in={showComparison}>
                        <Divider sx={{ mb: 2 }} />
                        {allPlans.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Feature</TableCell>
                                            {allPlans.slice(0, 4).map((plan) => (
                                                <TableCell key={plan._id} align="center">
                                                    <Box>
                                                        <Typography variant="subtitle2">{plan.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            ₦{(plan.priceNGN || 0).toLocaleString()}/{plan.billingInterval === 'monthly' ? 'mo' : 'yr'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {/* Generate comparison rows based on features */}
                                        {availableFeatures.slice(0, 15).map((feature) => (
                                            <TableRow key={feature.featureId}>
                                                <TableCell>
                                                    <Typography variant="body2">{feature.name}</Typography>
                                                </TableCell>
                                                {allPlans.slice(0, 4).map((plan) => (
                                                    <TableCell key={plan._id} align="center">
                                                        {plan.features?.includes(feature.featureId) ? (
                                                            <CheckCircleIcon color="success" fontSize="small" />
                                                        ) : (
                                                            <LockIcon color="disabled" fontSize="small" />
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Alert severity="info">
                                Plan comparison data is loading. Visit the{' '}
                                <Button onClick={() => navigate('/subscriptions')} sx={{ textTransform: 'none' }}>
                                    subscriptions page
                                </Button>
                                {' '}to see all available plans.
                            </Alert>
                        )}
                    </Collapse>
                </CardContent>
            </Card>
        </Box>
    );
};

export default FeaturesTab;
