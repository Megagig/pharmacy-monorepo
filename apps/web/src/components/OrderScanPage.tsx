import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Chip,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  CameraAlt as CameraIcon,
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

import {
  ManualLabOrder,
  LAB_ORDER_STATUSES,
  LAB_ORDER_PRIORITIES,
} from '../types/manualLabOrder';
import { Patient } from '../types/patientManagement';

// Mock data for demonstration
const MOCK_ORDER: ManualLabOrder = {
  _id: 'order_123',
  orderId: 'LAB-2024-0001',
  patientId: 'patient_456',
  workplaceId: 'workplace_789',
  orderedBy: 'user_101',
  tests: [
    {
      name: 'Complete Blood Count',
      code: 'CBC',
      loincCode: '58410-2',
      specimenType: 'Blood',
      unit: 'cells/μL',
      refRange: '4.5-11.0 x10³',
      category: 'Hematology',
    },
    {
      name: 'Basic Metabolic Panel',
      code: 'BMP',
      loincCode: '51990-0',
      specimenType: 'Blood',
      unit: 'mmol/L',
      refRange: 'Various',
      category: 'Chemistry',
    },
  ],
  indication: 'Routine health screening and follow-up',
  requisitionFormUrl: '/api/manual-lab-orders/LAB-2024-0001/pdf',
  barcodeData: 'eyJvcmRlcklkIjoiTEFCLTIwMjQtMDAwMSIsInRva2VuIjoiYWJjZGVmZ2gifQ',
  status: 'sample_collected',
  priority: 'routine',
  consentObtained: true,
  consentTimestamp: new Date(),
  consentObtainedBy: 'user_101',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'user_101',
  isDeleted: false,
  patient: {
    _id: 'patient_456',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'PHM-LAG-001234',
    age: 45,
    gender: 'male',
    phone: '+2348012345678',
    pharmacyId: 'workplace_789',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  } as Patient,
};

interface OrderScanPageProps {
  token?: string;
  onOrderResolved?: (order: ManualLabOrder) => void;
  onNavigateToResults?: (orderId: string) => void;
}

const OrderScanPage: React.FC<OrderScanPageProps> = ({
  token: propToken,
  onOrderResolved,
  onNavigateToResults,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token: routeToken } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  // State management
  const [token, setToken] = useState(
    propToken || routeToken || searchParams.get('token') || ''
  );
  const [manualToken, setManualToken] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ManualLabOrder | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    'granted' | 'denied' | 'prompt' | 'unknown'
  >('unknown');

  // Refs
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerElementRef = useRef<HTMLDivElement>(null);

  // Check camera permissions
  const checkCameraPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      setCameraPermission(result.state);

      result.addEventListener('change', () => {
        setCameraPermission(result.state);
      });
    } catch (error) {
      console.warn('Camera permission check not supported:', error);
      setCameraPermission('unknown');
    }
  }, []);

  // Initialize camera permission check
  useEffect(() => {
    checkCameraPermission();
  }, [checkCameraPermission]);

  // Resolve token to order
  const resolveToken = useCallback(
    async (tokenToResolve: string) => {
      if (!tokenToResolve.trim()) {
        setError('Please provide a valid token');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Mock API call - replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock token validation
        if (tokenToResolve === 'invalid_token') {
          throw new Error('Invalid or expired token');
        }

        // Mock successful resolution
        setOrder(MOCK_ORDER);
        if (onOrderResolved) {
          onOrderResolved(MOCK_ORDER);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to resolve token';
        setError(errorMessage);
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    },
    [onOrderResolved]
  );

  // Initialize scanner
  const initializeScanner = useCallback(() => {
    if (!scannerElementRef.current || scannerRef.current) return;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
      supportedScanTypes: [Html5QrcodeScanner.SCAN_TYPE_CAMERA],
    };

    scannerRef.current = new Html5QrcodeScanner(
      'qr-scanner',
      config,
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Success callback
        setToken(decodedText);
        resolveToken(decodedText);
        stopScanner();
      },
      (errorMessage) => {
        // Error callback - can be ignored for continuous scanning
        console.debug('QR scan error:', errorMessage);
      }
    );

    setScannerActive(true);
  }, [resolveToken]);

  // Stop scanner
  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScannerActive(false);
    setIsScanning(false);
  }, []);

  // Start scanning
  const startScanning = () => {
    setIsScanning(true);
    setError(null);
    setTimeout(initializeScanner, 100); // Small delay to ensure DOM is ready
  };

  // Handle manual token submission
  const handleManualTokenSubmit = () => {
    if (manualToken.trim()) {
      setToken(manualToken.trim());
      resolveToken(manualToken.trim());
      setShowManualEntry(false);
    }
  };

  // Navigate to result entry
  const handleNavigateToResults = () => {
    if (order) {
      if (onNavigateToResults) {
        onNavigateToResults(order.orderId);
      } else {
        navigate(`/lab-orders/${order.orderId}/results`);
      }
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate(-1);
  };

  // Auto-resolve token if provided
  useEffect(() => {
    if (token && !order && !isLoading) {
      resolveToken(token);
    }
  }, [token, order, isLoading, resolveToken]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusInfo = LAB_ORDER_STATUSES.find((s) => s.value === status);
    return statusInfo || { value: status, label: status, color: '#666' };
  };

  const getPriorityInfo = (priority: string) => {
    const priorityInfo = LAB_ORDER_PRIORITIES.find((p) => p.value === priority);
    return priorityInfo || { value: priority, label: priority, color: '#666' };
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Scan Lab Order
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scan QR code or enter token to access lab order
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ErrorIcon sx={{ mr: 1 }} />
            {error}
          </Box>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
              }}
            >
              <CircularProgress sx={{ mr: 2 }} />
              <Typography>Resolving token...</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Scanner Section */}
      {!order && !isLoading && (
        <Grid container spacing={3}>
          {/* QR Scanner */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  QR Code Scanner
                </Typography>

                {!isScanning && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <QrCodeScannerIcon
                      sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }}
                    />
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      Position the QR code within the camera frame
                    </Typography>

                    {cameraPermission === 'denied' && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        Camera access is required for QR scanning. Please enable
                        camera permissions in your browser settings.
                      </Alert>
                    )}

                    <Button
                      variant="contained"
                      startIcon={<CameraIcon />}
                      onClick={startScanning}
                      disabled={cameraPermission === 'denied'}
                      size="large"
                    >
                      Start Camera
                    </Button>
                  </Box>
                )}

                {isScanning && (
                  <Box>
                    <Box
                      id="qr-scanner"
                      ref={scannerElementRef}
                      sx={{
                        '& video': {
                          width: '100%',
                          borderRadius: 1,
                        },
                      }}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mt: 2,
                        gap: 1,
                      }}
                    >
                      <Button
                        variant="outlined"
                        startIcon={<CloseIcon />}
                        onClick={stopScanner}
                      >
                        Stop Scanner
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Manual Entry */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Manual Entry
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Can't scan? Enter the token manually
                </Typography>

                <TextField
                  fullWidth
                  label="Token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Enter token from requisition"
                  sx={{ mb: 2 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleManualTokenSubmit();
                    }
                  }}
                />

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleManualTokenSubmit}
                  disabled={!manualToken.trim()}
                >
                  Resolve Token
                </Button>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Instructions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  1. Scan the QR code on the lab requisition form
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  2. Or manually enter the token printed below the QR code
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3. Review order details and proceed to result entry
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Order Details */}
      {order && !isLoading && (
        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'between',
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Order Found</Typography>
              </Box>
              <Chip
                label={getStatusInfo(order.status).label}
                sx={{
                  bgcolor: getStatusInfo(order.status).color,
                  color: 'white',
                }}
              />
            </Box>

            <Grid container spacing={3}>
              {/* Order Information */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Order Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Order ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {order.orderId}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Priority
                  </Typography>
                  <Chip
                    label={getPriorityInfo(order.priority || 'routine').label}
                    size="small"
                    sx={{
                      bgcolor: getPriorityInfo(order.priority || 'routine')
                        .color,
                      color: 'white',
                    }}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {new Date(order.createdAt).toLocaleDateString()} at{' '}
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </Typography>
                </Box>
              </Grid>

              {/* Patient Information */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Patient Information
                </Typography>
                {order.patient && (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {order.patient.firstName} {order.patient.lastName}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        MRN
                      </Typography>
                      <Typography variant="body1">
                        {order.patient.mrn}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Age
                      </Typography>
                      <Typography variant="body1">
                        {order.patient.age || 'Not specified'}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Grid>

              {/* Clinical Information */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Clinical Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Clinical Indication
                  </Typography>
                  <Typography variant="body1">{order.indication}</Typography>
                </Box>
                {order.notes && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Additional Notes
                    </Typography>
                    <Typography variant="body1">{order.notes}</Typography>
                  </Box>
                )}
              </Grid>

              {/* Ordered Tests */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Ordered Tests ({order.tests.length})
                </Typography>
                <Paper variant="outlined">
                  {order.tests.map((test, index) => (
                    <Box key={index}>
                      <Box sx={{ p: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'between',
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {test.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              label={test.code}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={test.category}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Specimen: {test.specimenType} | Reference Range:{' '}
                          {test.refRange}
                        </Typography>
                        {test.unit && (
                          <Typography variant="body2" color="text.secondary">
                            Unit: {test.unit}
                          </Typography>
                        )}
                      </Box>
                      {index < order.tests.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Paper>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 4,
                pt: 3,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Button
                variant="outlined"
                startIcon={<VisibilityIcon />}
                onClick={() => window.open(order.requisitionFormUrl, '_blank')}
              >
                View Requisition
              </Button>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setOrder(null);
                    setToken('');
                    setManualToken('');
                  }}
                >
                  Scan Another
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AssignmentIcon />}
                  onClick={handleNavigateToResults}
                  disabled={order.status === 'completed'}
                >
                  {order.status === 'completed'
                    ? 'Results Entered'
                    : 'Enter Results'}
                </Button>
              </Box>
            </Box>

            {/* Status-specific messages */}
            {order.status === 'requested' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This order is in "Requested" status. Sample collection may
                  still be pending.
                </Typography>
              </Alert>
            )}

            {order.status === 'completed' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Results have already been entered for this order. You can view
                  the results but cannot modify them.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for Mobile */}
      {isMobile && !order && !isScanning && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={startScanning}
          disabled={cameraPermission === 'denied'}
        >
          <QrCodeScannerIcon />
        </Fab>
      )}
    </Box>
  );
};

export default OrderScanPage;
