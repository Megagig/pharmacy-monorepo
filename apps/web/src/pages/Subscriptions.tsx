import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PaymentIcon from '@mui/icons-material/Payment';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AddIcon from '@mui/icons-material/Add';
import { apiClient } from '../services/apiClient';
import LoadingSpinner from '../components/LoadingSpinner';

interface Plan {
  _id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
  description: string;
  features: string[];
  featuresDetails?: Array<{
    _id: string;
    featureId: string;
    name: string;
    category: string;
    order: number;
  }>;
  isPopular: boolean;
  isActive: boolean;
  isContactSales: boolean;
  whatsappNumber?: string;
  trialDays?: number;
  order: number;
  metadata?: {
    buttonText?: string;
    badge?: string;
    icon?: string;
  };
}

interface SubscriptionStatus {
  hasWorkspace: boolean;
  hasSubscription: boolean;
  status: string;
  tier?: string;
  accessLevel: 'basic' | 'limited' | 'full';
  isActive?: boolean;
  isTrialActive?: boolean;
  daysRemaining?: number;
  endDate?: string;
  message?: string;
}

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
      id={`subscription-tabpanel-${index}`}
      aria-labelledby={`subscription-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Subscriptions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'nomba'>('paystack');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    // Check for payment success in URL
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const reference = params.get('reference') || params.get('trxref');
    
    if (paymentStatus === 'success' || reference) {
      handlePaymentSuccess(reference);
    }
  }, [billingInterval]);

  const handlePaymentSuccess = async (reference: string | null) => {
    if (!reference) {
      console.warn('No payment reference found in URL');
      return;
    }

    try {

      // Verify the payment
      const verifyResponse = await apiClient.get(`/subscriptions/verify-payment?reference=${reference}`);
      
      if (verifyResponse.data.success) {
        setShowSuccessMessage(true);
        setTabValue(0); // Show Plans tab
        
        // Show success notification

        // Clear query params
        window.history.replaceState({}, '', '/subscriptions');
        
        // Force refresh subscription data immediately and multiple times to ensure update
        fetchData();
        setTimeout(() => {
          fetchData();
        }, 1000);
        setTimeout(() => {
          fetchData();
        }, 3000);
        setTimeout(() => {
          fetchData();
        }, 5000);
      } else {
        console.error('Payment verification failed:', verifyResponse.data.message);
        setError('Payment verification failed. Please contact support if your payment was processed.');
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      setError('Error verifying payment. Please contact support if your payment was processed.');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch subscription status with error handling (non-blocking)
      try {
        const statusResponse = await apiClient.get('/subscriptions/status');

        if (statusResponse.data.success) {
          setSubscriptionStatus(statusResponse.data.data);
        }
      } catch (statusError: any) {
        console.warn('Failed to fetch subscription status (this is expected if not authenticated):', statusError.response?.data?.message || statusError.message);
        // Don't set fallback status - let it remain undefined to indicate no data
        // Don't throw the error - this is non-critical
      }

      // Fetch available plans with error handling
      try {
        const plansResponse = await apiClient.get('/pricing/plans', {
          params: { billingPeriod: billingInterval }
        });

        if (plansResponse.data.success) {
          const plansData = plansResponse.data.data?.plans || [];
          setPlans(plansData);
        } else {
          throw new Error(plansResponse.data.message || 'Failed to load plans');
        }
      } catch (planError: any) {
        console.error('Failed to fetch plans:', planError);
        throw planError; // Re-throw to be handled by outer catch block
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Better error messaging for connection issues
      if (!error.response) {
        setError('Cannot connect to the server. Please ensure the backend is running and try again.');
      } else if (error.response.status >= 500) {
        setError('Server error occurred. Please try again later.');
      } else {
        setError(error.response?.data?.message || 'Failed to load subscription information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatPrice = (plan: Plan) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: plan.currency || 'NGN',
      minimumFractionDigits: 0,
    }).format(plan.price);
  };

  const getPlanButtonText = (plan: Plan) => {
    if (!subscriptionStatus?.tier) return 'Upgrade';

    const tierOrder = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
    const currentTierIndex = tierOrder.indexOf(subscriptionStatus.tier);
    const planTierIndex = tierOrder.indexOf(plan.tier);

    if (currentTierIndex === planTierIndex) return 'Current Plan';
    if (planTierIndex > currentTierIndex) return 'Upgrade';
    return 'Downgrade';
  };

  const isPlanDisabled = (plan: Plan) => {
    if (!subscriptionStatus?.tier) return false;
    return subscriptionStatus.tier === plan.tier;
  };

  const handlePlanAction = (plan: Plan) => {
    if (plan.isContactSales) {
      // Open WhatsApp for enterprise plans
      if (plan.whatsappNumber) {
        const message = encodeURIComponent(
          `Hi! I'm interested in the ${plan.name} plan. Can you provide more information?`
        );
        window.open(
          `https://wa.me/${plan.whatsappNumber.replace('+', '')}?text=${message}`,
          '_blank'
        );
      }
      return;
    }

    setSelectedPlan(plan);
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);

      // Initiate payment with plan details and selected payment method
      const response = await apiClient.post('/subscriptions/checkout', {
        planSlug: selectedPlan.slug,
        tier: selectedPlan.tier,
        billingInterval: selectedPlan.billingPeriod,
        amount: selectedPlan.price,
        paymentMethod: paymentMethod,
        callbackUrl: `${window.location.origin}/subscriptions?payment=success`,
      });

      if (response.data.success && response.data.data?.authorization_url) {
        // Redirect to payment page (Paystack or Nomba)
        window.location.href = response.data.data.authorization_url;
      } else {
        setError(response.data.message || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start payment process';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setPaymentDialogOpen(false);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const response = await apiClient.get('/subscriptions/billing-history');
      if (response.data.success) {
        setBillingHistory(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  useEffect(() => {
    if (tabValue === 1) {
      fetchBillingHistory();
    }
  }, [tabValue]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Subscription Plans
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose the perfect plan for your pharmacy needs
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="subscription tabs">
          <Tab label="Plans" icon={<StarIcon />} iconPosition="start" />
          <Tab label="Billing History" icon={<ReceiptIcon />} iconPosition="start" />
          <Tab label="Payment Methods" icon={<PaymentIcon />} iconPosition="start" />
          <Tab label="Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Plans Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Success Message */}
        {showSuccessMessage && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            onClose={() => setShowSuccessMessage(false)}
          >
            <Typography variant="h6" gutterBottom>
              Payment Successful! 🎉
            </Typography>
            <Typography variant="body2">
              Your subscription has been activated successfully. You now have access to all premium features.
            </Typography>
          </Alert>
        )}

        {/* Billing Interval Toggle */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant={billingInterval === 'monthly' ? 'contained' : 'outlined'}
            onClick={() => setBillingInterval('monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={billingInterval === 'yearly' ? 'contained' : 'outlined'}
            onClick={() => setBillingInterval('yearly')}
          >
            Yearly
            <Chip label="Save 17%" size="small" color="success" sx={{ ml: 1 }} />
          </Button>
        </Box>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Alert severity="info">
              <Typography variant="h6" gutterBottom>
                {billingInterval === 'yearly'
                  ? 'Yearly plans coming soon!'
                  : 'No subscription plans available'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {billingInterval === 'yearly'
                  ? 'Yearly billing plans are currently being set up. Please use monthly billing for now.'
                  : 'Unable to load subscription plans from the server. Please ensure the backend is running and try again.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                {billingInterval === 'yearly' && (
                  <Button
                    variant="contained"
                    onClick={() => setBillingInterval('monthly')}
                  >
                    Switch to Monthly
                  </Button>
                )}
                <Button
                  variant={billingInterval === 'yearly' ? 'outlined' : 'contained'}
                  onClick={fetchData}
                >
                  Retry
                </Button>
              </Box>
            </Alert>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
            {plans.map((plan) => (
              <Box key={plan._id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: plan.isPopular ? 2 : 1,
                    borderColor: plan.isPopular ? 'primary.main' : 'divider',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: 8,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  {plan.isPopular && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <StarIcon fontSize="small" />
                      <Typography variant="caption" fontWeight="bold">
                        Most Popular
                      </Typography>
                    </Box>
                  )}

                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                      {plan.name}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plan.description}
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      {plan.isContactSales ? (
                        <Typography variant="h4" component="div">
                          Custom
                        </Typography>
                      ) : (
                        <>
                          <Typography variant="h4" component="div">
                            {formatPrice(plan)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            per {plan.billingPeriod === 'yearly' ? 'year' : 'month'}
                          </Typography>
                        </>
                      )}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <List dense>
                      {plan.featuresDetails && plan.featuresDetails.length > 0 ? (
                        plan.featuresDetails.slice(0, 8).map((feature) => (
                          <ListItem key={feature._id} sx={{ px: 0 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={<Typography variant="body2">{feature.name}</Typography>}
                            />
                          </ListItem>
                        ))
                      ) : plan.features && plan.features.length > 0 ? (
                        plan.features.slice(0, 8).map((featureId, index) => (
                          <ListItem key={index} sx={{ px: 0 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={<Typography variant="body2">{featureId}</Typography>}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <ListItem sx={{ px: 0 }}>
                          <ListItemText
                            primary={<Typography variant="body2" color="text.secondary">No features listed</Typography>}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>

                  <Box sx={{ p: 3, pt: 0 }}>
                    <Button
                      fullWidth
                      variant={plan.isPopular ? 'contained' : 'outlined'}
                      startIcon={plan.isContactSales ? <CreditCardIcon /> : <TrendingUpIcon />}
                      onClick={() => handlePlanAction(plan)}
                      disabled={isPlanDisabled(plan)}
                      sx={{ py: 1.5 }}
                    >
                      {plan.isContactSales ? 'Contact Sales' : getPlanButtonText(plan)}
                    </Button>
                  </Box>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Billing History Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Billing History
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Invoice</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No billing history available
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Payment Methods Tab */}
      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Payment Methods</Typography>
              <Button startIcon={<AddIcon />} variant="contained">
                Add Payment Method
              </Button>
            </Box>
            <Alert severity="info">
              No payment methods saved yet. Add a payment method to enable automatic billing.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
          <Box>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Usage Statistics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track your subscription usage and limits
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <Alert severity="info">
                    Usage analytics will be available once you have an active subscription
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Subscription Value
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  See the value you're getting from your subscription
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <Alert severity="info">
                    Value metrics will be available once you have an active subscription
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </TabPanel>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Payment</DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                You will be redirected to Nomba's secure payment page to complete your subscription to the{' '}
                <strong>{selectedPlan.name}</strong> plan.
              </Alert>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Plan: <strong>{selectedPlan.name}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Amount: <strong>{formatPrice(selectedPlan)}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Billing: <strong>{selectedPlan.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}</strong>
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePayment} disabled={loading}>
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Subscriptions;
