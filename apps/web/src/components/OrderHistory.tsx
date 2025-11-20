import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
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
  Badge,
  useTheme,
  useMediaQuery,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';

import {
  usePatientLabOrders,
  useOrderPdfUrl,
  useLabResults,
} from '../hooks/useManualLabOrders';
import {
  ManualLabOrder,
  LAB_ORDER_STATUSES,
  LAB_ORDER_PRIORITIES,
} from '../types/manualLabOrder';
import { formatDate, formatDateTime } from '../utils/formatters';

interface OrderHistoryProps {
  patientId: string;
  maxOrders?: number;
  showCreateButton?: boolean;
  onCreateOrder?: () => void;
  onViewOrder?: (orderId: string) => void;
  onViewResults?: (orderId: string) => void;
  compact?: boolean;
}

type SortOption = 'newest' | 'oldest' | 'status' | 'priority';
type FilterOption =
  | 'all'
  | 'requested'
  | 'sample_collected'
  | 'result_awaited'
  | 'completed'
  | 'referred';

const OrderHistory: React.FC<OrderHistoryProps> = ({
  patientId,
  maxOrders,
  showCreateButton = false,
  onCreateOrder,
  onViewOrder,
  onViewResults,
  compact = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State for filtering and sorting
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Fetch orders
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePatientLabOrders(patientId);

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = orders;

    // Apply status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((order) => order.status === filterBy);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.orderId.toLowerCase().includes(searchLower) ||
          order.indication.toLowerCase().includes(searchLower) ||
          order.tests.some(
            (test) =>
              test.name.toLowerCase().includes(searchLower) ||
              test.code.toLowerCase().includes(searchLower)
          )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case 'status':
          return a.status.localeCompare(b.status);
        case 'priority':
          const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
          return (
            (priorityOrder[a.priority || 'routine'] || 2) -
            (priorityOrder[b.priority || 'routine'] || 2)
          );
        default:
          return 0;
      }
    });

    // Apply max orders limit
    if (maxOrders) {
      filtered = filtered.slice(0, maxOrders);
    }

    return filtered;
  }, [orders, filterBy, searchTerm, sortBy, maxOrders]);

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

  const getPriorityColor = (
    priority?: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (priority) {
      case 'stat':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'routine':
        return 'info';
      default:
        return 'default';
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleDownloadPdf = (orderId: string) => {
    const pdfUrl = `/api/manual-lab-orders/${orderId}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Lab Order History" />
        <CardContent>
          <Stack spacing={2}>
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={80} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader title="Lab Order History" />
        <CardContent>
          <Alert severity="error">
            <Typography variant="body2">
              Failed to load lab order history:{' '}
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

  if (compact) {
    // Compact view for dashboard widgets
    return (
      <Card>
        <CardHeader
          title="Recent Lab Orders"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {showCreateButton && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={onCreateOrder}
                  variant="outlined"
                >
                  New Order
                </Button>
              )}
              <IconButton size="small" onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Box>
          }
        />
        <CardContent>
          {filteredAndSortedOrders.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              py={2}
            >
              No lab orders found
            </Typography>
          ) : (
            <List dense>
              {filteredAndSortedOrders.map((order, index) => (
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
                        sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
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
                          {order.priority && order.priority !== 'routine' && (
                            <Chip
                              label={
                                LAB_ORDER_PRIORITIES[order.priority] ||
                                order.priority
                              }
                              size="small"
                              color={getPriorityColor(order.priority)}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {order.tests.length} test
                            {order.tests.length !== 1 ? 's' : ''} •{' '}
                            {formatDate(order.createdAt)}
                          </Typography>
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {order.indication.length > 50
                              ? `${order.indication.substring(0, 50)}...`
                              : order.indication}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < filteredAndSortedOrders.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view with filters and timeline
  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Lab Order History
            </Typography>
            <Badge badgeContent={orders.length} color="primary">
              <AssignmentIcon />
            </Badge>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {showCreateButton && (
              <Button
                startIcon={<AddIcon />}
                onClick={onCreateOrder}
                variant="contained"
                size={isMobile ? 'small' : 'medium'}
              >
                New Order
              </Button>
            )}
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>
        }
      />
      <CardContent>
        {/* Filters and Search */}
        <Box sx={{ mb: 3 }}>
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            alignItems={isMobile ? 'stretch' : 'center'}
          >
            <TextField
              size="small"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterBy}
                label="Status"
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              >
                <MenuItem value="all">All</MenuItem>
                {Object.entries(LAB_ORDER_STATUSES).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="priority">Priority</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>

        {/* Orders List */}
        {filteredAndSortedOrders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ScienceIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No lab orders found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {orders.length === 0
                ? "This patient doesn't have any lab orders yet."
                : 'No orders match your current filters.'}
            </Typography>
            {showCreateButton && orders.length === 0 && (
              <Button
                startIcon={<AddIcon />}
                onClick={onCreateOrder}
                variant="contained"
                sx={{ mt: 2 }}
              >
                Create First Lab Order
              </Button>
            )}
          </Box>
        ) : (
          <Timeline>
            {filteredAndSortedOrders.map((order, index) => (
              <OrderHistoryItem
                key={order.orderId}
                order={order}
                isLast={index === filteredAndSortedOrders.length - 1}
                isExpanded={expandedOrders.has(order.orderId)}
                onToggleExpansion={() => toggleOrderExpansion(order.orderId)}
                onDownloadPdf={() => handleDownloadPdf(order.orderId)}
                onViewOrder={onViewOrder}
                onViewResults={onViewResults}
              />
            ))}
          </Timeline>
        )}
      </CardContent>
    </Card>
  );
};

// Individual order item component
interface OrderHistoryItemProps {
  order: ManualLabOrder;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  onDownloadPdf: () => void;
  onViewOrder?: (orderId: string) => void;
  onViewResults?: (orderId: string) => void;
}

const OrderHistoryItem: React.FC<OrderHistoryItemProps> = ({
  order,
  isLast,
  isExpanded,
  onToggleExpansion,
  onDownloadPdf,
  onViewOrder,
  onViewResults,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'requested':
        return <PendingIcon />;
      case 'sample_collected':
        return <ScienceIcon />;
      case 'result_awaited':
        return <PendingIcon />;
      case 'completed':
        return <CheckCircleIcon />;
      case 'referred':
        return <WarningIcon />;
      default:
        return <AssignmentIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return theme.palette.info.main;
      case 'sample_collected':
        return theme.palette.primary.main;
      case 'result_awaited':
        return theme.palette.warning.main;
      case 'completed':
        return theme.palette.success.main;
      case 'referred':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <TimelineItem>
      <TimelineOppositeContent sx={{ flex: 0.2, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(order.createdAt)}
        </Typography>
        {order.priority && order.priority !== 'routine' && (
          <Chip
            label={LAB_ORDER_PRIORITIES[order.priority] || order.priority}
            size="small"
            color={order.priority === 'stat' ? 'error' : 'warning'}
            sx={{ mt: 0.5, display: 'block', width: 'fit-content' }}
          />
        )}
      </TimelineOppositeContent>

      <TimelineSeparator>
        <TimelineDot sx={{ bgcolor: getStatusColor(order.status) }}>
          {getStatusIcon(order.status)}
        </TimelineDot>
        {!isLast && <TimelineConnector />}
      </TimelineSeparator>

      <TimelineContent sx={{ py: 2 }}>
        <Card variant="outlined">
          <CardContent sx={{ pb: 1 }}>
            {/* Order Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="h6" fontWeight={600}>
                  {order.orderId}
                </Typography>
                <Chip
                  label={LAB_ORDER_STATUSES[order.status] || order.status}
                  size="small"
                  sx={{ bgcolor: getStatusColor(order.status), color: 'white' }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Download PDF">
                  <IconButton size="small" onClick={onDownloadPdf}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                {onViewOrder && (
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => onViewOrder(order.orderId)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton size="small" onClick={onToggleExpansion}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            </Box>

            {/* Order Summary */}
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {order.tests.length} test{order.tests.length !== 1 ? 's' : ''}{' '}
              ordered
            </Typography>

            <Typography variant="body2" gutterBottom>
              <strong>Indication:</strong> {order.indication}
            </Typography>

            {/* Expanded Details */}
            <Collapse in={isExpanded}>
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Ordered Tests:
                </Typography>
                <List dense>
                  {order.tests.map((test, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={test.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" component="span">
                              Code: {test.code}
                            </Typography>
                            {test.specimenType && (
                              <Typography
                                variant="caption"
                                component="span"
                                sx={{ ml: 2 }}
                              >
                                Specimen: {test.specimenType}
                              </Typography>
                            )}
                            {test.category && (
                              <Typography
                                variant="caption"
                                component="span"
                                sx={{ ml: 2 }}
                              >
                                Category: {test.category}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  {order.status === 'completed' && onViewResults && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AssignmentIcon />}
                      onClick={() => onViewResults(order.orderId)}
                    >
                      View Results
                    </Button>
                  )}
                  {(order.status === 'sample_collected' ||
                    order.status === 'result_awaited') && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ScienceIcon />}
                      onClick={() =>
                        onViewResults && onViewResults(order.orderId)
                      }
                    >
                      Enter Results
                    </Button>
                  )}
                </Box>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </TimelineContent>
    </TimelineItem>
  );
};

export default OrderHistory;
