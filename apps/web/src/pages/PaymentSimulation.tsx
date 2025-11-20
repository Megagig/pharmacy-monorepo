import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Divider,
  Alert,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PaymentIcon from '@mui/icons-material/Payment';

const PaymentSimulation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  const reference = searchParams.get('ref');
  const amount = searchParams.get('amount');

  const handlePaymentSuccess = async () => {
    setProcessing(true);

    // Simulate payment processing delay
    setTimeout(() => {
      // Redirect to success page with reference
      navigate(`/subscription-management/success?reference=${reference}`);
    }, 2000);
  };

  const handlePaymentFailure = () => {
    navigate('/subscription-management?payment=failed');
  };

  const handleCancel = () => {
    navigate('/subscription-management');
  };

  if (!reference || !amount) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">
          Invalid payment session. Please try again.
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/subscription-management')}
          sx={{ mt: 2 }}
        >
          Back to Subscription Plans
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <PaymentIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Payment Simulation
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Development Mode
          </Typography>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Details
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography>Amount:</Typography>
              <Typography fontWeight="bold">
                ₦{Number(amount).toLocaleString()}
              </Typography>
            </Box>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography>Reference:</Typography>
              <Typography variant="body2" color="text.secondary">
                {reference}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Status:</Typography>
              <Typography color="warning.main">Pending Payment</Typography>
            </Box>
          </CardContent>
        </Card>

        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="body2">
            <strong>Development Mode:</strong> This is a simulated payment page.
            In production, this would redirect to the actual Nomba payment
            gateway.
          </Typography>
        </Alert>

        {processing && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="body2" align="center" sx={{ mb: 2 }}>
              Processing payment...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handlePaymentSuccess}
            disabled={processing}
            size="large"
          >
            Simulate Success
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            onClick={handlePaymentFailure}
            disabled={processing}
            size="large"
          >
            Simulate Failure
          </Button>

          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={processing}
            size="large"
          >
            Cancel
          </Button>
        </Box>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            This simulation will be replaced with real Nomba integration in
            production
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentSimulation;
