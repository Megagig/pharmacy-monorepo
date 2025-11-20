import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Collapse,
} from '@mui/material';
import {
  Payment,
  Receipt,
  Download,
  Visibility,
  Warning,
  CheckCircle,
  Error,
  Schedule,
  CreditCard,
  AccountBalance,
  Phone,
  Close,
  ExpandMore,
  ExpandLess,
  Refresh,
} from '@mui/icons-material';
import { format, parseISO, isAfter, isBefore } from 'date-fns';

import { usePatientAuth } from '../../hooks/usePatientAuth';
import usePatientBilling from '../../hooks/usePatientBilling';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`billing-tabpanel-${index}`}
      aria-labelledby={`billing-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const PatientBilling: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated } = usePatientAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer' | 'mobile_money'>('card');

  // API hooks
  const {
    invoices,
    paymentHistory,
    billingStats,
    loading,
    error,
    paymentLoading,
    paymentError,
    refreshBilling,
    initiatePayment,
    getInvoiceDetails,
    downloadInvoice,
  } = usePatientBilling(user?.id);

  // Categorize invoices
  const { pendingInvoices, paidInvoices, overdueInvoices } = useMemo(() => {
    if (!invoices) return { pendingInvoices: [], paidInvoices: [], overdueInvoices: [] };

    const pending = invoices.filter(inv => inv.status === 'pending');
    const paid = invoices.filter(inv => inv.status === 'paid');
    const overdue = invoices.filter(inv => inv.status === 'overdue');

    return { pendingInvoices: pending, paidInvoices: paid, overdueInvoices: overdue };
  }, [invoices]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleViewInvoice = async (invoice: any) => {
    try {
      const details = await getInvoiceDetails(invoice._id);
      setSelectedInvoice(details);
      setShowInvoiceDialog(true);
    } catch (error) {
      console.error('Failed to load invoice details:', error);
    }
  };

  const handlePayInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowPaymentDialog(true);
  };

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      await downloadInvoice(invoice._id);
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  const handleToggleExpand = (invoiceId: string) => {
    setExpandedInvoice(expandedInvoice === invoiceId ? null : invoiceId);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedInvoice) return;

    try {
      const result = await initiatePayment({
        invoiceId: selectedInvoice._id,
        paymentMethod,
        returnUrl: window.location.href,
      });

      if (result.paymentUrl) {
        // Redirect to payment gateway
        window.location.href = result.paymentUrl;
      } else {
        // Handle other payment methods (bank transfer, mobile money)
        setShowPaymentDialog(false);
        // Show success message or instructions
      }
    } catch (error) {
      console.error('Payment initiation failed:', error);
    }
  };

  // Status badge configuration
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'warning' as const, icon: <Schedule />, label: 'Pending' },
      paid: { color: 'success' as const, icon: <CheckCircle />, label: 'Paid' },
      overdue: { color: 'error' as const, icon: <Warning />, label: 'Overdue' },
      cancelled: { color: 'default' as const, icon: <Error />, label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  // Render invoice card
  const renderInvoiceCard = (invoice: any) => {
    const isExpanded = expandedInvoice === invoice._id;
    const dueDate = parseISO(invoice.dueDate);
    const isOverdue = invoice.status === 'overdue' || (invoice.status === 'pending' && isBefore(dueDate, new Date()));

    return (
      <Card 
        key={invoice._id} 
        sx={{ 
          mb: 2,
          border: isOverdue ? `1px solid ${theme.palette.error.main}` : undefined,
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
        }}
      >
        <CardContent>
          <Grid container spacing={2} alignItems="flex-start">
            {/* Main invoice info */}
            <Grid item xs={12} sm={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h6" component="h3">
                  {invoice.invoiceNumber}
                </Typography>
                {getStatusBadge(invoice.status)}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  Issued: {format(parseISO(invoice.issuedDate), 'MMM d, yyyy')}
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  Due: {format(parseISO(invoice.dueDate), 'MMM d, yyyy')}
                </Typography>
              </Box>

              <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                {formatCurrency(invoice.totalAmount)}
              </Typography>

              {invoice.notes && (
                <Typography variant="body2" color="text.secondary">
                  {invoice.notes}
                </Typography>
              )}
            </Grid>

            {/* Action buttons */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                justifyContent: isMobile ? 'flex-start' : 'flex-end',
                flexWrap: 'wrap',
              }}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => handleViewInvoice(invoice)}
                >
                  View
                </Button>

                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => handleDownloadInvoice(invoice)}
                >
                  Download
                </Button>

                {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Payment />}
                    onClick={() => handlePayInvoice(invoice)}
                    color={invoice.status === 'overdue' ? 'error' : 'primary'}
                  >
                    Pay Now
                  </Button>
                )}

                <IconButton 
                  size="small" 
                  onClick={() => handleToggleExpand(invoice._id)}
                >
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </Grid>
          </Grid>

          {/* Expanded details */}
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Invoice Items
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.items.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{item.description}</Typography>
                          <Chip 
                            label={item.category} 
                            size="small" 
                            variant="outlined" 
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 200 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">{formatCurrency(invoice.subtotal)}</Typography>
                </Box>
                {invoice.discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="success.main">Discount:</Typography>
                    <Typography variant="body2" color="success.main">
                      -{formatCurrency(invoice.discount)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Tax:</Typography>
                  <Typography variant="body2">{formatCurrency(invoice.tax)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(invoice.totalAmount)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  // Render payment history
  const renderPaymentHistory = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Invoice</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Method</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Reference</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paymentHistory?.map((payment) => (
            <TableRow key={payment._id}>
              <TableCell>
                {payment.processedAt 
                  ? format(parseISO(payment.processedAt), 'MMM d, yyyy HH:mm')
                  : format(parseISO(payment.createdAt), 'MMM d, yyyy HH:mm')
                }
              </TableCell>
              <TableCell>{payment.invoiceId}</TableCell>
              <TableCell>{formatCurrency(payment.amount)}</TableCell>
              <TableCell>
                <Chip 
                  label={payment.paymentMethod.replace('_', ' ').toUpperCase()} 
                  size="small" 
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                {getStatusBadge(payment.status)}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {payment.reference}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Render empty state
  const renderEmptyState = (type: string) => (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Receipt sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No {type} found
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {type === 'invoices' 
          ? "You don't have any invoices yet."
          : "You don't have any payment history yet."
        }
      </Typography>
    </Paper>
  );

  if (!isAuthenticated || !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Alert severity="warning">
          Please log in to view your billing information.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load billing information. Please try again.
        <Button onClick={refreshBilling} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 2 : 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Billing & Payments
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View your invoices, payment history, and manage payments
          </Typography>
        </Box>
        
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={refreshBilling}
          size={isMobile ? 'small' : 'medium'}
        >
          Refresh
        </Button>
      </Box>

      {/* Billing Stats Cards */}
      {billingStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error.main" gutterBottom>
                  {formatCurrency(billingStats.totalOutstanding)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Outstanding
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="success.main" gutterBottom>
                  {formatCurrency(billingStats.totalPaid)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Paid
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="warning.main" gutterBottom>
                  {billingStats.pendingInvoices}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error.main" gutterBottom>
                  {billingStats.overdueInvoices}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overdue
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Overdue Alert */}
      {overdueInvoices.length > 0 && (
        <Alert severity="error" sx={{ mb: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            You have {overdueInvoices.length} overdue invoice(s)
          </Typography>
          <Typography variant="body2">
            Please settle your overdue payments to avoid service interruption.
          </Typography>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="billing tabs"
            variant={isMobile ? 'fullWidth' : 'standard'}
          >
            <Tab 
              label={`Invoices (${invoices?.length || 0})`} 
              icon={<Receipt />}
              iconPosition="start"
              id="billing-tab-0"
              aria-controls="billing-tabpanel-0"
            />
            <Tab 
              label={`Payment History (${paymentHistory?.length || 0})`} 
              icon={<Payment />}
              iconPosition="start"
              id="billing-tab-1"
              aria-controls="billing-tabpanel-1"
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {!invoices || invoices.length === 0 ? (
            renderEmptyState('invoices')
          ) : (
            <Box>
              {/* Overdue invoices first */}
              {overdueInvoices.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" color="error.main" gutterBottom>
                    Overdue Invoices
                  </Typography>
                  {overdueInvoices.map(renderInvoiceCard)}
                </Box>
              )}

              {/* Pending invoices */}
              {pendingInvoices.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" color="warning.main" gutterBottom>
                    Pending Invoices
                  </Typography>
                  {pendingInvoices.map(renderInvoiceCard)}
                </Box>
              )}

              {/* Paid invoices */}
              {paidInvoices.length > 0 && (
                <Box>
                  <Typography variant="h6" color="success.main" gutterBottom>
                    Paid Invoices
                  </Typography>
                  {paidInvoices.map(renderInvoiceCard)}
                </Box>
              )}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {!paymentHistory || paymentHistory.length === 0 ? (
            renderEmptyState('payment history')
          ) : (
            renderPaymentHistory()
          )}
        </TabPanel>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog
        open={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt color="primary" />
              Invoice Details
            </Box>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setShowInvoiceDialog(false)}
              aria-label="close"
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>
                    {selectedInvoice.invoiceNumber}
                  </Typography>
                  {getStatusBadge(selectedInvoice.status)}
                </Grid>
                <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="h5" color="primary">
                    {formatCurrency(selectedInvoice.totalAmount)}
                  </Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Issued Date</Typography>
                  <Typography variant="body2">
                    {format(parseISO(selectedInvoice.issuedDate), 'MMMM d, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Due Date</Typography>
                  <Typography variant="body2">
                    {format(parseISO(selectedInvoice.dueDate), 'MMMM d, yyyy')}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" gutterBottom>
                Invoice Items
              </Typography>
              <TableContainer sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedInvoice.items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ minWidth: 250 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Subtotal:</Typography>
                    <Typography>{formatCurrency(selectedInvoice.subtotal)}</Typography>
                  </Box>
                  {selectedInvoice.discount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography color="success.main">Discount:</Typography>
                      <Typography color="success.main">
                        -{formatCurrency(selectedInvoice.discount)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Tax:</Typography>
                    <Typography>{formatCurrency(selectedInvoice.tax)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Total:</Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(selectedInvoice.totalAmount)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInvoiceDialog(false)}>
            Close
          </Button>
          {selectedInvoice && (selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
            <Button
              variant="contained"
              startIcon={<Payment />}
              onClick={() => {
                setShowInvoiceDialog(false);
                handlePayInvoice(selectedInvoice);
              }}
            >
              Pay Now
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment color="primary" />
            Make Payment
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedInvoice.invoiceNumber}
              </Typography>
              <Typography variant="h4" color="primary" sx={{ mb: 3 }}>
                {formatCurrency(selectedInvoice.totalAmount)}
              </Typography>

              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">Select Payment Method</FormLabel>
                <RadioGroup
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  sx={{ mt: 2 }}
                >
                  <FormControlLabel
                    value="card"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CreditCard />
                        <Box>
                          <Typography>Credit/Debit Card</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pay securely with your card
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="bank_transfer"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalance />
                        <Box>
                          <Typography>Bank Transfer</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Transfer directly from your bank
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="mobile_money"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone />
                        <Box>
                          <Typography>Mobile Money</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pay with your mobile wallet
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {paymentError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {paymentError}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePaymentSubmit}
            disabled={paymentLoading}
            startIcon={paymentLoading ? <CircularProgress size={20} /> : <Payment />}
          >
            {paymentLoading ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientBilling;