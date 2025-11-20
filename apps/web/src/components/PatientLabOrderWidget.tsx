import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Skeleton,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloseIcon from '@mui/icons-material/Close';

import {
  usePatientLabOrders,
  useCreateManualLabOrder,
} from '../hooks/useManualLabOrders';
import {
  ManualLabOrder,
  LAB_ORDER_STATUSES,
  TEST_CATEGORIES,
  LabTest,
  CreateOrderRequest,
} from '../types/manualLabOrder';
import { formatDate } from '../utils/formatters';

interface PatientLabOrderWidgetProps {
  patientId: string;
  maxOrders?: number;
  onViewOrder?: (orderId: string) => void;
  onViewResults?: (orderId: string) => void;
  onViewAllOrders?: () => void;
}

// Common lab tests for quick selection
const COMMON_LAB_TESTS: LabTest[] = [
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
  {
    name: 'Lipid Panel',
    code: 'LIPID',
    loincCode: '57698-3',
    specimenType: 'Blood',
    unit: 'mg/dL',
    refRange: 'Various',
    category: 'Chemistry',
  },
  {
    name: 'Liver Function Tests',
    code: 'LFT',
    loincCode: '24362-6',
    specimenType: 'Blood',
    unit: 'U/L',
    refRange: 'Various',
    category: 'Chemistry',
  },
  {
    name: 'Thyroid Function Tests',
    code: 'TFT',
    loincCode: '24348-5',
    specimenType: 'Blood',
    unit: 'mIU/L',
    refRange: '0.4-4.0',
    category: 'Endocrinology',
  },
  {
    name: 'Urinalysis',
    code: 'UA',
    loincCode: '24357-6',
    specimenType: 'Urine',
    unit: 'Various',
    refRange: 'Various',
    category: 'Urinalysis',
  },
];

const PatientLabOrderWidget: React.FC<PatientLabOrderWidgetProps> = ({
  patientId,
  maxOrders = 3,
  onViewOrder,
  onViewResults,
  onViewAllOrders,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [showQuickOrderDialog, setShowQuickOrderDialog] = useState(false);
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [indication, setIndication] = useState('');
  const [consentObtained, setConsentObtained] = useState(false);

  // Fetch orders
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePatientLabOrders(patientId);

  // Create order mutation
  const createOrderMutation = useCreateManualLabOrder();

  const recentOrders = orders.slice(0, maxOrders);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'requested':
        return <PendingIcon color="info" />;
      case 'sample_collected':
        return <ScienceIcon color="primary" />;
      case 'result_awaited':
        return <PendingIcon color="warning" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'referred':
        return <WarningIcon color="error" />;
      default:
        return <AssignmentIcon />;
    }
  };

  const getStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'requested':
        return 'info';
      case 'sample_collected':
        return 'primary';
      case 'result_awaited':
        return 'warning';
      case 'completed':
        return 'success';
      case 'referred':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleQuickOrderSubmit = async () => {
    if (selectedTests.length === 0 || !indication.trim() || !consentObtained) {
      return;
    }

    try {
      const orderData: CreateOrderRequest = {
        patientId,
        tests: selectedTests,
        indication: indication.trim(),
        priority: 'routine',
        consentObtained: true,
      };

      await createOrderMutation.mutateAsync(orderData);

      // Reset form
      setSelectedTests([]);
      setIndication('');
      setConsentObtained(false);
      setShowQuickOrderDialog(false);
    } catch (error) {
      console.error('Failed to create lab order:', error);
    }
  };

  const handleDownloadPdf = (orderId: string) => {
    const pdfUrl = `/api/manual-lab/${orderId}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Lab Orders" />
        <CardContent>
          <Stack spacing={2}>
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={60} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader title="Lab Orders" />
        <CardContent>
          <Alert severity="error">
            <Typography variant="body2">
              Failed to load lab orders:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              sx={{ mt: 1 }}
            >
              Retry
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Lab Orders
              </Typography>
              {orders.length > 0 && (
                <Chip label={orders.length} size="small" color="primary" />
              )}
            </Box>
          }
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowQuickOrderDialog(true)}
                variant="outlined"
              >
                Quick Order
              </Button>
              <IconButton size="small" onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Box>
          }
        />
        <CardContent>
          {recentOrders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <ScienceIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No lab orders yet
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setShowQuickOrderDialog(true)}
                variant="contained"
                size="small"
              >
                Create First Order
              </Button>
            </Box>
          ) : (
            <>
              <List dense>
                {recentOrders.map((order, index) => (
                  <React.Fragment key={order.orderId}>
                    <ListItem
                      sx={{ px: 0 }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Download PDF">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadPdf(order.orderId)}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {onViewOrder && (
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => onViewOrder(order.orderId)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'primary.main',
                          }}
                        >
                          {getStatusIcon(order.status)}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {order.orderId}
                            </Typography>
                            <Chip
                              label={
                                LAB_ORDER_STATUSES[order.status] || order.status
                              }
                              size="small"
                              color={getStatusColor(order.status)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {order.tests.length} test
                              {order.tests.length !== 1 ? 's' : ''} •{' '}
                              {formatDate(order.createdAt)}
                            </Typography>
                            <Typography
                              variant="caption"
                              display="block"
                              color="text.secondary"
                            >
                              {order.indication.length > 40
                                ? `${order.indication.substring(0, 40)}...`
                                : order.indication}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentOrders.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              {orders.length > maxOrders && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button size="small" onClick={onViewAllOrders} variant="text">
                    View All {orders.length} Orders
                  </Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Order Dialog */}
      <Dialog
        open={showQuickOrderDialog}
        onClose={() => setShowQuickOrderDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">Quick Lab Order</Typography>
            <IconButton onClick={() => setShowQuickOrderDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Test Selection */}
            <Autocomplete
              multiple
              options={COMMON_LAB_TESTS}
              getOptionLabel={(option) => `${option.name} (${option.code})`}
              value={selectedTests}
              onChange={(_, newValue) => setSelectedTests(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Tests"
                  placeholder="Choose lab tests..."
                  helperText="Select one or more tests to order"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={`${option.name} (${option.code})`}
                    {...getTagProps({ index })}
                    key={option.code}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {option.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Code: {option.code} • Specimen: {option.specimenType} •
                      Category: {option.category}
                    </Typography>
                  </Box>
                </Box>
              )}
            />

            {/* Indication */}
            <TextField
              label="Clinical Indication"
              multiline
              rows={3}
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="Enter the clinical reason for ordering these tests..."
              helperText="Provide the clinical indication or reason for the lab tests"
              required
            />

            {/* Consent */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={consentObtained}
                  onChange={(e) => setConsentObtained(e.target.checked)}
                  required
                />
              }
              label="Patient consent obtained for lab testing"
            />

            {/* Selected Tests Summary */}
            {selectedTests.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Tests ({selectedTests.length}):
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedTests.map((test) => (
                    <Chip
                      key={test.code}
                      label={`${test.name} (${test.code})`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuickOrderDialog(false)}>Cancel</Button>
          <Button
            onClick={handleQuickOrderSubmit}
            variant="contained"
            disabled={
              selectedTests.length === 0 ||
              !indication.trim() ||
              !consentObtained ||
              createOrderMutation.isPending
            }
          >
            {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientLabOrderWidget;
