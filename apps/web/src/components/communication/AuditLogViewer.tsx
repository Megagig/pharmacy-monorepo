import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Collapse,
} from '@mui/material';
import FilterIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ViewIcon from '@mui/icons-material/Visibility';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';

// Helper function to safely parse JSON responses
const safeJsonParse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      throw new Error('Invalid JSON response from server');
    }
  } else {
    // Try to get text response and see if it's actually JSON
    const textResponse = await response.text();

    // Check if it's an HTML error page (common when endpoints don't exist)
    if (
      textResponse.trim().startsWith('<!DOCTYPE') ||
      textResponse.trim().startsWith('<html')
    ) {
      console.warn(
        'Received HTML response instead of JSON - endpoint may not exist'
      );
      throw new Error(
        `Server returned HTML instead of JSON: ${response.status} ${response.statusText}`
      );
    }

    // Handle empty responses
    if (!textResponse.trim()) {
      console.warn('Received empty response');
      throw new Error(
        `Server returned empty response: ${response.status} ${response.statusText}`
      );
    }

    try {
      return JSON.parse(textResponse);
    } catch {
      console.warn('Response is not JSON:', textResponse.substring(0, 200));
      throw new Error(
        `Server returned non-JSON response: ${response.status} ${response.statusText}`
      );
    }
  }
};

interface AuditLog {
  _id: string;
  action: string;
  timestamp: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  targetId: string;
  targetType: 'conversation' | 'message' | 'user' | 'file' | 'notification';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  duration?: number;
  details: {
    conversationId?: string;
    messageId?: string;
    patientId?: string;
    fileName?: string;
    metadata?: Record<string, unknown>;
  };
  errorMessage?: string;
}

interface AuditFilters {
  userId?: string;
  action?: string;
  targetType?: string;
  conversationId?: string;
  patientId?: string;
  riskLevel?: string;
  complianceCategory?: string;
  success?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  searchQuery?: string;
}

interface AuditLogViewerProps {
  conversationId?: string;
  patientId?: string;
  height?: string;
  showFilters?: boolean;
  showExport?: boolean;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  conversationId,
  patientId,
  height = '600px',
  showFilters = true,
  showExport = true,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<AuditFilters>({
    conversationId,
    patientId,
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
      });

      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (value instanceof Date) {
            queryParams.append(key, value.toISOString());
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const endpoint = conversationId
        ? `/api/communication/audit/conversation/${conversationId}?${queryParams}`
        : `/api/communication/audit?${queryParams}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // Handle different error cases
        if (response.status === 404) {
          // Endpoint doesn't exist - return empty data
          setLogs([]);
          setTotalCount(0);
          return;
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication required. Please log in again.');
        }

        try {
          const errorData = await safeJsonParse(response);
          throw new Error(
            (errorData as { message?: string }).message ||
            'Failed to fetch audit logs'
          );
        } catch {
          throw new Error(
            `Failed to fetch audit logs: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await safeJsonParse(response);
      setLogs((data as { data: AuditLog[] }).data);
      setTotalCount(
        (data as { pagination?: { total: number }; count?: number }).pagination
          ?.total ||
        (data as { count?: number }).count ||
        0
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [conversationId, filters, page, rowsPerPage]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Handle filter changes
  const handleFilterChange = (key: keyof AuditFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page when filters change
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      conversationId,
      patientId,
    });
    setPage(0);
  };

  // Export audit logs
  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const queryParams = new URLSearchParams({ format });

      // Add filters to export
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (value instanceof Date) {
            queryParams.append(key, value.toISOString());
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const response = await fetch(
        `/api/communication/audit/export?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Export functionality is not available');
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication required. Please log in again.');
        }

        try {
          const errorData = await safeJsonParse(response);
          throw new Error(
            (errorData as { message?: string }).message ||
            'Failed to export audit logs'
          );
        } catch {
          throw new Error(
            `Failed to export audit logs: ${response.status} ${response.statusText}`
          );
        }
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${format}_${format === 'csv' ? new Date().toISOString().split('T')[0] : Date.now()
        }.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError((err as Error).message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  // Get risk level color and icon
  const getRiskLevelDisplay = (riskLevel: string) => {
    const config = {
      low: { color: 'success', icon: <InfoIcon fontSize="small" /> },
      medium: { color: 'warning', icon: <WarningIcon fontSize="small" /> },
      high: { color: 'error', icon: <ErrorIcon fontSize="small" /> },
      critical: { color: 'error', icon: <SecurityIcon fontSize="small" /> },
    };

    const { color, icon } =
      config[riskLevel as keyof typeof config] || config.low;

    return (
      <Chip
        size="small"
        color={
          color as
          | 'success'
          | 'warning'
          | 'error'
          | 'info'
          | 'default'
          | 'primary'
          | 'secondary'
        }
        icon={icon}
        label={riskLevel.toUpperCase()}
        variant="outlined"
      />
    );
  };

  // Format action name
  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format details for display
  const formatDetails = (log: AuditLog) => {
    const details = [];
    const safeSuffix = (val: any, len = 8) => {
      const s = typeof val === 'string' ? val : (val?._id ?? (typeof val?.toString === 'function' ? val.toString() : undefined));
      return typeof s === 'string' ? s.slice(-len) : '—';
    };
    if (log.details.conversationId)
      details.push(`Conv: ${safeSuffix(log.details.conversationId, 8)}`);
    if (log.details.messageId)
      details.push(`Msg: ${safeSuffix(log.details.messageId, 8)}`);
    if (log.details.patientId)
      details.push(`Patient: ${safeSuffix(log.details.patientId, 8)}`);
    if (log.details.fileName) details.push(`File: ${log.details.fileName}`);
    if (log.duration) details.push(`${log.duration}ms`);
    return details.join(', ');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <SecurityIcon />
              Audit Log Viewer
              {conversationId && (
                <Chip
                  size="small"
                  label={`Conversation: ${conversationId.slice(-8)}`}
                />
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {showFilters && (
                <Button
                  startIcon={<FilterIcon />}
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  variant={showFiltersPanel ? 'contained' : 'outlined'}
                  size="small"
                >
                  Filters
                </Button>
              )}
              {showExport && (
                <>
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    size="small"
                    variant="outlined"
                  >
                    Export CSV
                  </Button>
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                    size="small"
                    variant="outlined"
                  >
                    Export JSON
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Filters Panel */}
          <Collapse in={showFiltersPanel}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      label="Search"
                      placeholder="Search actions, users..."
                      value={filters.searchQuery || ''}
                      onChange={(e) =>
                        handleFilterChange('searchQuery', e.target.value)
                      }
                      InputProps={{
                        startAdornment: (
                          <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        ),
                      }}
                    />
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel>Action</InputLabel>
                      <Select
                        value={filters.action || ''}
                        onChange={(e) =>
                          handleFilterChange('action', e.target.value)
                        }
                        label="Action"
                      >
                        <MenuItem value="">All Actions</MenuItem>
                        <MenuItem value="message_sent">Message Sent</MenuItem>
                        <MenuItem value="message_read">Message Read</MenuItem>
                        <MenuItem value="conversation_created">
                          Conversation Created
                        </MenuItem>
                        <MenuItem value="participant_added">
                          Participant Added
                        </MenuItem>
                        <MenuItem value="file_uploaded">File Uploaded</MenuItem>
                        <MenuItem value="conversation_exported">
                          Conversation Exported
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel>Risk Level</InputLabel>
                      <Select
                        value={filters.riskLevel || ''}
                        onChange={(e) =>
                          handleFilterChange('riskLevel', e.target.value)
                        }
                        label="Risk Level"
                      >
                        <MenuItem value="">All Levels</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel>Success</InputLabel>
                      <Select
                        value={
                          filters.success !== undefined
                            ? filters.success.toString()
                            : ''
                        }
                        onChange={(e) =>
                          handleFilterChange(
                            'success',
                            e.target.value === ''
                              ? undefined
                              : e.target.value === 'true'
                          )
                        }
                        label="Success"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="true">Success</MenuItem>
                        <MenuItem value="false">Failed</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <DatePicker
                      label="Start Date"
                      value={filters.startDate}
                      onChange={(date) => handleFilterChange('startDate', date)}
                      slotProps={{
                        textField: { size: 'small', fullWidth: true },
                      }}
                    />
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <DatePicker
                      label="End Date"
                      value={filters.endDate}
                      onChange={(date) => handleFilterChange('endDate', date)}
                      slotProps={{
                        textField: { size: 'small', fullWidth: true },
                      }}
                    />
                  </div>
                  <div
                    style={{ flex: '1 1 calc(25% - 16px)', minWidth: '250px' }}
                  >
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={clearFilters}
                      size="small"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Collapse>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Audit Logs Table */}
        {!loading && (
          <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {format(
                          parseISO(log.timestamp),
                          'MMM dd, yyyy HH:mm:ss'
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatAction(log.action)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {log.targetType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.userId.firstName} {log.userId.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {log.userId.role}
                      </Typography>
                    </TableCell>
                    <TableCell>{getRiskLevelDisplay(log.riskLevel)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={log.success ? 'success' : 'error'}
                        label={log.success ? 'Success' : 'Failed'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {formatDetails(log)}
                      </Typography>
                      {log.errorMessage && (
                        <Typography variant="caption" color="error">
                          {log.errorMessage}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => setSelectedLog(log)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No audit logs found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        )}

        {/* Audit Log Details Dialog */}
        <Dialog
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Audit Log Details
            {selectedLog && getRiskLevelDisplay(selectedLog.riskLevel)}
          </DialogTitle>
          <DialogContent>
            {selectedLog && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div
                  style={{ flex: '1 1 calc(50% - 16px)', minWidth: '250px' }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Action:</strong> {formatAction(selectedLog.action)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Timestamp:</strong>{' '}
                    {format(parseISO(selectedLog.timestamp), 'PPpp')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>User:</strong> {selectedLog.userId.firstName}{' '}
                    {selectedLog.userId.lastName} ({selectedLog.userId.email})
                  </Typography>
                  <Typography variant="body2">
                    <strong>Role:</strong> {selectedLog.userId.role}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Target Type:</strong> {selectedLog.targetType}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Target ID:</strong> {selectedLog.targetId}
                  </Typography>
                </div>
                <div
                  style={{ flex: '1 1 calc(50% - 16px)', minWidth: '250px' }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Security & Compliance
                  </Typography>
                  <Typography variant="body2">
                    <strong>Risk Level:</strong> {selectedLog.riskLevel}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Compliance Category:</strong>{' '}
                    {selectedLog.complianceCategory}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Success:</strong>{' '}
                    {selectedLog.success ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>IP Address:</strong> {selectedLog.ipAddress}
                  </Typography>
                  {selectedLog.duration && (
                    <Typography variant="body2">
                      <strong>Duration:</strong> {selectedLog.duration}ms
                    </Typography>
                  )}
                </div>
                <div style={{ flex: '1 1 100%', minWidth: '250px' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Details
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </Paper>
                </div>
                {selectedLog.errorMessage && (
                  <div style={{ flex: '1 1 100%', minWidth: '250px' }}>
                    <Typography variant="subtitle2" gutterBottom color="error">
                      Error Message
                    </Typography>
                    <Alert severity="error">{selectedLog.errorMessage}</Alert>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedLog(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AuditLogViewer;
