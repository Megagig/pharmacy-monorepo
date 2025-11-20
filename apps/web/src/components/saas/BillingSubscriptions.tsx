import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TablePagination,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  MonetizationOn as MonetizationOnIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { billingService } from '../../services/billingService';

interface BillingAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByStatus: Record<string, number>;
  revenueByPlan: Array<{ planName: string; revenue: number; count: number }>;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  customerName: string;
  customerEmail: string;
}

interface Subscription {
  _id: string;
  status: string;
  planName: string;
  unitAmount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingInterval: string;
  customerName: string;
  customerEmail: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
}

interface RevenueTrend {
  date: string;
  revenue: number;
  transactions: number;
}

interface PaymentMethod {
  _id: string;
  userId: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  lastUsed: string;
  transactionCount: number;
  totalAmount: number;
  status: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

const BillingSubscriptions: React.FC = () => {
  // CRITICAL: ALL hooks must be called unconditionally at the top (Rules of Hooks)
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Filter states
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d' | '365d'>('30d');

  // Pagination states
  const [invoicePage, setInvoicePage] = useState(0);
  const [invoiceRowsPerPage, setInvoiceRowsPerPage] = useState(10);
  const [subscriptionPage, setSubscriptionPage] = useState(0);
  const [subscriptionRowsPerPage, setSubscriptionRowsPerPage] = useState(10);

  // Dialog states
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const fetchData = useCallback(async () => {

    setLoading(true);
    setError(null);

    try {

      const analyticsRes = await billingService.getBillingAnalytics();

      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);

      } else {
        console.warn('⚠️ [Billing] Analytics failed:', analyticsRes.message);
      }

      const trendsRes = await billingService.getRevenueTrends(timePeriod);

      if (trendsRes.success) {
        setRevenueTrends(trendsRes.data);

      } else {
        console.warn('⚠️ [Billing] Trends failed:', trendsRes.message);
      }

      const invoicesRes = await billingService.getInvoices(1, 100);

      if (invoicesRes.success) {
        setInvoices(invoicesRes.data.invoices || []);

      } else {
        console.warn('⚠️ [Billing] Invoices failed:', invoicesRes.message);
      }

      const subscriptionsRes = await billingService.getSubscriptions(1, 100);

      if (subscriptionsRes.success) {
        setSubscriptions(subscriptionsRes.data.subscriptions || []);

      } else {
        console.warn('⚠️ [Billing] Subscriptions failed:', subscriptionsRes.message);
      }

      const paymentMethodsRes = await billingService.getAllPaymentMethods();

      if (paymentMethodsRes.success) {
        setPaymentMethods(paymentMethodsRes.data || []);

      } else {
        console.warn('⚠️ [Billing] Payment methods failed:', paymentMethodsRes.message);
      }

    } catch (err) {
      console.error('❌ [Billing] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefund = async (paymentReference: string, amount?: number, reason?: string) => {
    try {
      const response = await billingService.processRefund({ paymentReference, amount, reason });
      if (response.success) {
        await fetchData();
        setRefundDialogOpen(false);
      } else {
        setError(response.message || 'Failed to process refund');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process refund');
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, reason?: string) => {
    try {
      const response = await billingService.cancelSubscription({
        subscriptionId,
        cancelAtPeriodEnd: true,
        reason,
      });
      if (response.success) {
        await fetchData();
        setCancelDialogOpen(false);
      } else {
        setError(response.message || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'active':
        return 'success';
      case 'pending':
      case 'open':
      case 'trialing':
        return 'warning';
      case 'failed':
      case 'canceled':
      case 'past_due':
      case 'void':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return `₦${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `₦${(num / 1000).toFixed(1)}K`;
    return `₦${num.toFixed(0)}`;
  };

  // Filter data
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !invoiceSearch ||
      inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customerEmail.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchesStatus = !invoiceStatus || inv.status === invoiceStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = !subscriptionSearch ||
      sub.customerName.toLowerCase().includes(subscriptionSearch.toLowerCase()) ||
      sub.customerEmail.toLowerCase().includes(subscriptionSearch.toLowerCase()) ||
      sub.planName.toLowerCase().includes(subscriptionSearch.toLowerCase());
    const matchesStatus = !subscriptionStatus || sub.status === subscriptionStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading && !analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Billing & Subscriptions
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              // Export functionality
            }}
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'white',
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Monthly Recurring Revenue
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {formatCompactNumber(analytics.monthlyRecurringRevenue)}
                    </Typography>
                  </Box>
                  <MonetizationOnIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                color: 'white',
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Annual Recurring Revenue
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {formatCompactNumber(analytics.annualRecurringRevenue)}
                    </Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                color: 'white',
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Average Revenue Per User
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {formatCompactNumber(analytics.averageRevenuePerUser)}
                    </Typography>
                  </Box>
                  <PeopleIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                color: 'white',
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Churn Rate
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {analytics.churnRate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <TrendingDownIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
            },
          }}
        >
          <Tab label="Revenue Overview" />
          <Tab label="Invoices" />
          <Tab label="Subscriptions" />
          <Tab label="Payment Methods" />
        </Tabs>

        <CardContent sx={{ p: 3 }}>
          {/* Revenue Overview Tab */}
          {activeTab === 0 && (
            <Box>
              {/* Time Period Selector */}
              <Box display="flex" justifyContent="flex-end" mb={3}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={timePeriod}
                    label="Time Period"
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                  >
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                    <MenuItem value="90d">Last 90 Days</MenuItem>
                    <MenuItem value="365d">Last Year</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Revenue Trends Chart */}
              <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Revenue Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tickFormatter={(value) => formatCompactNumber(value)} />
                    <RechartsTooltip
                      formatter={(value: any) => formatCurrency(value)}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      name="Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Grid container spacing={3}>
                {/* Subscription Status Distribution */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ p: 3, height: '100%' }}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      Subscription Status Distribution
                    </Typography>
                    {analytics && (
                      <>
                        <ResponsiveContainer width="100%" height={350}>
                          <PieChart>
                            <Pie
                              data={Object.entries(analytics.subscriptionsByStatus).map(([status, count]) => ({
                                name: status.charAt(0).toUpperCase() + status.slice(1),
                                value: count,
                              }))}
                              cx="50%"
                              cy="45%"
                              labelLine={false}
                              label={false}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.keys(analytics.subscriptionsByStatus).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: any, name: string) => [`${value} subscriptions`, name]}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              iconType="circle"
                              wrapperStyle={{ fontSize: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <Box mt={2}>
                          {Object.entries(analytics.subscriptionsByStatus).map(([status, count]) => (
                            <Box key={status} display="flex" justifyContent="space-between" alignItems="center" py={1.5} borderBottom={1} borderColor="divider">
                              <Chip
                                label={status}
                                color={getStatusColor(status) as any}
                                size="small"
                                sx={{ minWidth: 100 }}
                              />
                              <Typography variant="body1" fontWeight="medium">{count} subscriptions</Typography>
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                  </Card>
                </Grid>

                {/* Revenue by Plan - Expanded */}
                <Grid item xs={12} md={8}>
                  <Card variant="outlined" sx={{ p: 3, height: '100%' }}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      Revenue by Plan
                    </Typography>
                    {analytics && (
                      <>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={analytics.revenueByPlan}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                            <XAxis
                              dataKey="planName"
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis
                              tickFormatter={(value) => formatCompactNumber(value)}
                              tick={{ fontSize: 12 }}
                            />
                            <RechartsTooltip
                              formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                              contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8,
                              }}
                            />
                            <Legend />
                            <Bar
                              dataKey="revenue"
                              fill={theme.palette.primary.main}
                              radius={[8, 8, 0, 0]}
                              name="Revenue"
                            >
                              {analytics.revenueByPlan.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <Box mt={3}>
                          <Grid container spacing={2}>
                            {analytics.revenueByPlan.map((plan) => (
                              <Grid item xs={12} sm={6} key={plan.planName}>
                                <Box
                                  sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    border: 1,
                                    borderColor: 'divider',
                                    '&:hover': {
                                      borderColor: 'primary.main',
                                      boxShadow: 1,
                                    },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                                    {plan.planName}
                                  </Typography>
                                  <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="caption" color="textSecondary">
                                      {plan.count} subscribers
                                    </Typography>
                                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                                      {formatCurrency(plan.revenue)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      </>
                    )}
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Invoices Tab */}
          {activeTab === 1 && (
            <Box>
              {/* Filters */}
              <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                <TextField
                  size="small"
                  placeholder="Search invoices..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flexGrow: 1, minWidth: 250 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={invoiceStatus}
                    label="Status"
                    onChange={(e) => setInvoiceStatus(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="void">Void</MenuItem>
                    <MenuItem value="uncollectible">Uncollectible</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInvoices
                      .slice(invoicePage * invoiceRowsPerPage, invoicePage * invoiceRowsPerPage + invoiceRowsPerPage)
                      .map((invoice) => (
                        <TableRow key={invoice._id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {invoice.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{invoice.customerName}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {invoice.customerEmail}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(invoice.total, invoice.currency)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.status}
                              color={getStatusColor(invoice.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatDate(invoice.dueDate)}</Typography>
                            {invoice.paidAt && (
                              <Typography variant="caption" color="success.main">
                                Paid: {formatDate(invoice.paidAt)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Invoice">
                              <IconButton size="small">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {invoice.status === 'paid' && (
                              <Tooltip title="Process Refund">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setRefundDialogOpen(true);
                                  }}
                                >
                                  <RefreshIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={filteredInvoices.length}
                  page={invoicePage}
                  onPageChange={(_, newPage) => setInvoicePage(newPage)}
                  rowsPerPage={invoiceRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setInvoiceRowsPerPage(parseInt(e.target.value, 10));
                    setInvoicePage(0);
                  }}
                />
              </TableContainer>
            </Box>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 2 && (
            <Box>
              {/* Filters */}
              <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                <TextField
                  size="small"
                  placeholder="Search subscriptions..."
                  value={subscriptionSearch}
                  onChange={(e) => setSubscriptionSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flexGrow: 1, minWidth: 250 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={subscriptionStatus}
                    label="Status"
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="trialing">Trialing</MenuItem>
                    <MenuItem value="past_due">Past Due</MenuItem>
                    <MenuItem value="canceled">Canceled</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell>Customer</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Current Period</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSubscriptions
                      .slice(
                        subscriptionPage * subscriptionRowsPerPage,
                        subscriptionPage * subscriptionRowsPerPage + subscriptionRowsPerPage
                      )
                      .map((subscription) => (
                        <TableRow key={subscription._id} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{subscription.customerName}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {subscription.customerEmail}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {subscription.planName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {subscription.billingInterval}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(subscription.unitAmount, subscription.currency)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              /{subscription.billingInterval}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={subscription.status}
                              color={getStatusColor(subscription.status) as any}
                              size="small"
                            />
                            {subscription.cancelAtPeriodEnd && (
                              <Typography variant="caption" display="block" color="warning.main">
                                Cancels at period end
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(subscription.currentPeriodStart)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              to {formatDate(subscription.currentPeriodEnd)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Edit Subscription">
                              <IconButton size="small">
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                              <Tooltip title="Cancel Subscription">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setSelectedSubscription(subscription);
                                    setCancelDialogOpen(true);
                                  }}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={filteredSubscriptions.length}
                  page={subscriptionPage}
                  onPageChange={(_, newPage) => setSubscriptionPage(newPage)}
                  rowsPerPage={subscriptionRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setSubscriptionRowsPerPage(parseInt(e.target.value, 10));
                    setSubscriptionPage(0);
                  }}
                />
              </TableContainer>
            </Box>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 3 && (
            <Box>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell>Customer</TableCell>
                      <TableCell>Payment Method</TableCell>
                      <TableCell align="right">Total Transactions</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell>Last Used</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentMethods.map((method) => (
                      <TableRow key={method._id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{method.customerName}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {method.customerEmail}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={method.paymentMethod.toUpperCase()}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{method.transactionCount}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(method.totalAmount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatDate(method.lastUsed)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={method.status}
                            color={getStatusColor(method.status) as any}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {paymentMethods.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary" py={4}>
                            No payment methods found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Process Refund</DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Invoice: {selectedInvoice.invoiceNumber}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Original Amount: {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
              </Typography>
              <TextField
                fullWidth
                label="Refund Amount (optional)"
                type="number"
                helperText="Leave empty for full refund"
                sx={{ mt: 2, mb: 2 }}
              />
              <TextField
                fullWidth
                label="Reason"
                multiline
                rows={3}
                placeholder="Enter reason for refund..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (selectedInvoice) {
                handleRefund(selectedInvoice.invoiceNumber);
              }
            }}
          >
            Process Refund
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          {selectedSubscription && (
            <Box sx={{ pt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This subscription will be canceled at the end of the current billing period.
              </Alert>
              <Typography variant="body2" gutterBottom>
                Customer: {selectedSubscription.customerName}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Plan: {selectedSubscription.planName}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Period End: {formatDate(selectedSubscription.currentPeriodEnd)}
              </Typography>
              <TextField
                fullWidth
                label="Cancellation Reason (optional)"
                multiline
                rows={3}
                placeholder="Enter reason for cancellation..."
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (selectedSubscription) {
                handleCancelSubscription(selectedSubscription._id);
              }
            }}
          >
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingSubscriptions;
