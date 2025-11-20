import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Grid,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import SecurityIcon from '@mui/icons-material/Security';
// import { loadStripe } from '@stripe/stripe-js';
// import {
//   Elements,
//   CardElement,
//   useStripe,
//   useElements,
// } from '@stripe/react-stripe-js';
import {
  paymentService,
  type PaymentMethod,
} from '../../services/paymentService';
import { useUIStore } from '../../stores';
import LoadingSpinner from '../LoadingSpinner';

// Initialize Stripe (commented out until Stripe packages are installed)
// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// const CARD_ELEMENT_OPTIONS = {
//   style: {
//     base: {
//       fontSize: '16px',
//       color: '#424770',
//       '::placeholder': {
//         color: '#aab7c4',
//       },
//     },
//     invalid: {
//       color: '#9e2146',
//     },
//   },
// };

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AddPaymentMethodForm: React.FC<AddPaymentMethodFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  // const stripe = useStripe();
  // const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(false);

  const addNotification = useUIStore((state) => state.addNotification);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(
      'Stripe integration is not yet implemented. Please install @stripe/stripe-js and @stripe/react-stripe-js packages.'
    );

    // TODO: These variables will be used when Stripe integration is implemented
    // Currently preserved for future use: onSuccess, setLoading, addNotification

    // TODO: Implement Stripe integration
    // Original Stripe code commented out below:

    /*
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create setup intent
      const { clientSecret } = await paymentService.createSetupIntent();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm setup intent
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (setupIntent?.payment_method) {
        // Add payment method to backend
        await paymentService.addPaymentMethod(
          setupIntent.payment_method as string,
          setAsDefault
        );

        addNotification({
          type: 'success',
          title: 'Payment Method Added',
          message: 'Your payment method has been added successfully',
          duration: 3000,
        });

        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error adding payment method:', err);
    } finally {
      setLoading(false);
    }
    */
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Card Information
        </Typography>
        <Box
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            textAlign: 'center',
            color: 'text.secondary',
            '&:focus-within': {
              borderColor: 'primary.main',
            },
          }}
        >
          <Typography variant="body2">
            Stripe Card Element will be rendered here when Stripe packages are
            installed
          </Typography>
          {/* <CardElement options={CARD_ELEMENT_OPTIONS} /> */}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Button
          variant={setAsDefault ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setSetAsDefault(!setAsDefault)}
          startIcon={setAsDefault ? <StarIcon /> : <StarBorderIcon />}
        >
          Set as default payment method
        </Button>
      </Box>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
        >
          {loading ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </Stack>
    </Box>
  );
};

const PaymentMethodsManagement: React.FC = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadPaymentMethods = useCallback(async () => {
    setLoading(true);
    try {
      const methods = await paymentService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load payment methods',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const handleSetDefault = async (paymentMethodId: string) => {
    setActionLoading(paymentMethodId);
    try {
      await paymentService.setDefaultPaymentMethod(paymentMethodId);
      await loadPaymentMethods();
      addNotification({
        type: 'success',
        title: 'Default Updated',
        message: 'Default payment method updated successfully',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error setting default payment method:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update default payment method',
        duration: 5000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedMethodId) return;

    const method = paymentMethods.find((m) => m.id === selectedMethodId);
    if (method?.isDefault) {
      addNotification({
        type: 'warning',
        title: 'Cannot Delete',
        message:
          'Cannot delete the default payment method. Please set another method as default first.',
        duration: 5000,
      });
      setDeleteConfirmOpen(false);
      setSelectedMethodId(null);
      return;
    }

    handleDelete();
  };

  const handleDelete = async () => {
    if (!selectedMethodId) return;

    setActionLoading(selectedMethodId);
    try {
      await paymentService.removePaymentMethod(selectedMethodId);
      await loadPaymentMethods();
      addNotification({
        type: 'success',
        title: 'Payment Method Removed',
        message: 'Payment method removed successfully',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error removing payment method:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to remove payment method',
        duration: 5000,
      });
    } finally {
      setActionLoading(null);
      setDeleteConfirmOpen(false);
      setSelectedMethodId(null);
    }
  };

  const getCardBrandIcon = () => {
    // In a real implementation, you'd have specific icons for each brand
    return <CreditCardIcon />;
  };

  const formatExpiryDate = (month: number, year: number) => {
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  const handleAddSuccess = () => {
    setAddDialogOpen(false);
    loadPaymentMethods();
  };

  if (loading) {
    return <LoadingSpinner message="Loading payment methods..." />;
  }

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5">Payment Methods</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Payment Method
        </Button>
      </Stack>

      {/* Security Notice */}
      <Alert severity="info" icon={<SecurityIcon />} sx={{ mb: 3 }}>
        Your payment information is securely stored and encrypted. We never
        store your full card details on our servers.
      </Alert>

      {paymentMethods.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CreditCardIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" gutterBottom>
              No Payment Methods
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add a payment method to manage your subscription and billing.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Your First Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {paymentMethods.map((method) => (
            <Grid size={{ xs: 12, md: 6 }} key={method.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ color: 'text.secondary' }}>
                      {getCardBrandIcon()}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ textTransform: 'capitalize' }}
                        >
                          {method.brand}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          •••• {method.last4}
                        </Typography>
                        {method.isDefault && (
                          <Chip
                            label="Default"
                            size="small"
                            color="primary"
                            icon={<StarIcon />}
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Expires{' '}
                        {formatExpiryDate(
                          method.expiryMonth,
                          method.expiryYear
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Added {new Date(method.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {!method.isDefault && (
                        <IconButton
                          size="small"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={actionLoading === method.id}
                          title="Set as default"
                        >
                          {actionLoading === method.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <StarBorderIcon />
                          )}
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedMethodId(method.id);
                          setDeleteConfirmOpen(true);
                        }}
                        disabled={actionLoading === method.id}
                        title="Remove payment method"
                      >
                        {actionLoading === method.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Payment Method Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Payment Method</DialogTitle>
        <DialogContent>
          {/* Elements wrapper commented out until Stripe packages are installed */}
          {/* <Elements stripe={stripePromise}> */}
          <AddPaymentMethodForm
            onSuccess={handleAddSuccess}
            onCancel={() => setAddDialogOpen(false)}
          />
          {/* </Elements> */}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Payment Method</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to remove this payment method?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. Make sure you have another payment
            method set up for your subscription.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Remove Payment Method
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentMethodsManagement;
