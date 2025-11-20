import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Assessment as ReportIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { auditService } from '../../services/auditService';

interface AuditLog {
  _id: string;
  timestamp: string;
  action: string;
  actionDisplay: string;
  resourceType: string;
  resourceId: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  userRole: string;
  complianceCategory: string;
  complianceCategoryDisplay: string;
  riskLevel: string;
  riskLevelDisplay: string;
  ipAddress?: string;
  patientId?: {
    _id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  reviewId?: {
    _id: string;
    reviewNumber: string;
    status: string;
  };
  details: Record<string, unknown>;
  errorMessage?: string;
  duration?: number;
}

interface AuditFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resourceType?: string;
  complianceCategory?: string;
  riskLevel?: string;
  patientId?: string;
  reviewId?: string;
  ipAddress?: string;
}

const AuditDashboard: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState<AuditFilters>({
    startDate: subDays(new Date(), 7), // Default to last 7 days
    endDate: new Date(),
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>(
    'json'
  );

  // Fetch audit logs
  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auditLogs', page, rowsPerPage, filters],
    queryFn: () =>
      auditService.getAuditLogs({
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
      }),
  });

  // Fetch audit summary
  const { data: summaryData } = useQuery({
    queryKey: ['auditSummary', filters.startDate, filters.endDate],
    queryFn: () =>
      auditService.getAuditSummary({
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
      }),
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['auditActions'],
    queryFn: () => auditService.getAuditActions(),
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: (exportData: Record<string, unknown>) =>
      auditService.exportAuditData(exportData),
    onSuccess: (data, variables) => {
      // Handle file download
      const blob = new Blob([data], {
        type: variables.format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_export_${format(new Date(), 'yyyy-MM-dd')}.${
        variables.format
      }`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    },
  });

  const handleFilterChange = (field: keyof AuditFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filters change
  };

  const handleExport = () => {
    exportMutation.mutate({
      format: exportFormat,
      startDate: filters.startDate?.toISOString(),
      endDate: filters.endDate?.toISOString(),
      filters: {
        userId: filters.userId,
        action: filters.action,
        resourceType: filters.resourceType,
        complianceCategory: filters.complianceCategory,
        riskLevel: filters.riskLevel,
        patientId: filters.patientId,
        reviewId: filters.reviewId,
        ipAddress: filters.ipAddress,
      },
      includeDetails: true,
    });
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getComplianceCategoryIcon = (category: string) => {
    switch (category) {
      case 'system_security':
        return <SecurityIcon fontSize="small" />;
      case 'patient_safety':
        return <WarningIcon fontSize="small" />;
      default:
        return <ReportIcon fontSize="small" />;
    }
  };

  if (error) {
    return (
      <Alert severity="error">Failed to load audit logs: {error.message}</Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Audit Trail Dashboard
      </Typography>

      {/* Summary Cards */}
      {summaryData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Logs
                </Typography>
                <Typography variant="h5">
                  {summaryData.totalLogs?.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unique Users
                </Typography>
                <Typography variant="h5">
                  {summaryData.uniqueUserCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Error Rate
                </Typography>
                <Typography
                  variant="h5"
                  color={summaryData.errorRate > 5 ? 'error' : 'success'}
                >
                  {summaryData.errorRate?.toFixed(1) || 0}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Compliance Score
                </Typography>
                <Typography
                  variant="h5"
                  color={
                    summaryData.complianceScore > 80 ? 'success' : 'warning'
                  }
                >
                  {summaryData.complianceScore || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Controls */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => setExportDialogOpen(true)}
        >
          Export
        </Button>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Start Date"
                  value={
                    filters.startDate
                      ? format(filters.startDate, 'yyyy-MM-dd')
                      : ''
                  }
                  onChange={(e) =>
                    handleFilterChange('startDate', new Date(e.target.value))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="End Date"
                  value={
                    filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''
                  }
                  onChange={(e) =>
                    handleFilterChange('endDate', new Date(e.target.value))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={filters.action || ''}
                    onChange={(e) =>
                      handleFilterChange('action', e.target.value || undefined)
                    }
                    label="Action"
                  >
                    <MenuItem value="">All Actions</MenuItem>
                    {filterOptions?.actions?.map((action: string) => (
                      <MenuItem key={action} value={action}>
                        {action}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Risk Level</InputLabel>
                  <Select
                    value={filters.riskLevel || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'riskLevel',
                        e.target.value || undefined
                      )
                    }
                    label="Risk Level"
                  >
                    <MenuItem value="">All Levels</MenuItem>
                    {filterOptions?.riskLevels?.map((level: string) => (
                      <MenuItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Resource Type</InputLabel>
                  <Select
                    value={filters.resourceType || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'resourceType',
                        e.target.value || undefined
                      )
                    }
                    label="Resource Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    {filterOptions?.resourceTypes?.map((type: string) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Compliance Category</InputLabel>
                  <Select
                    value={filters.complianceCategory || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'complianceCategory',
                        e.target.value || undefined
                      )
                    }
                    label="Compliance Category"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {filterOptions?.complianceCategories?.map(
                      (category: string) => (
                        <MenuItem key={category} value={category}>
                          {category
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </MenuItem>
                      )
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="IP Address"
                  value={filters.ipAddress || ''}
                  onChange={(e) =>
                    handleFilterChange('ipAddress', e.target.value || undefined)
                  }
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Audit Logs
          </Typography>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Resource</TableCell>
                      <TableCell>Risk Level</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditData?.data?.map((log: AuditLog) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <Typography variant="body2">
                            {format(
                              new Date(log.timestamp),
                              'MMM dd, yyyy HH:mm:ss'
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.actionDisplay}
                          </Typography>
                          {log.errorMessage && (
                            <Tooltip title={log.errorMessage}>
                              <WarningIcon color="error" fontSize="small" />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.userId.firstName} {log.userId.lastName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {log.userRole}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.resourceType}
                          </Typography>
                          {log.patientId && (
                            <Typography variant="caption" color="textSecondary">
                              Patient: {log.patientId.firstName}{' '}
                              {log.patientId.lastName}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.riskLevelDisplay}
                            color={
                              getRiskLevelColor(log.riskLevel) as
                                | 'default'
                                | 'primary'
                                | 'secondary'
                                | 'error'
                                | 'info'
                                | 'success'
                                | 'warning'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            {getComplianceCategoryIcon(log.complianceCategory)}
                            <Typography variant="body2">
                              {log.complianceCategoryDisplay}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.ipAddress || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setSelectedLog(log)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={auditData?.total || 0}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Timestamp</Typography>
                  <Typography variant="body2">
                    {format(new Date(selectedLog.timestamp), 'PPpp')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Action</Typography>
                  <Typography variant="body2">
                    {selectedLog.actionDisplay}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">User</Typography>
                  <Typography variant="body2">
                    {selectedLog.userId.firstName} {selectedLog.userId.lastName}{' '}
                    ({selectedLog.userId.email})
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Risk Level</Typography>
                  <Chip
                    label={selectedLog.riskLevelDisplay}
                    color={
                      getRiskLevelColor(selectedLog.riskLevel) as
                        | 'default'
                        | 'primary'
                        | 'secondary'
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warning'
                    }
                    size="small"
                  />
                </Grid>
                {selectedLog.duration && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Duration</Typography>
                    <Typography variant="body2">
                      {selectedLog.duration}ms
                    </Typography>
                  </Grid>
                )}
                {selectedLog.errorMessage && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Error Message</Typography>
                    <Typography variant="body2" color="error">
                      {selectedLog.errorMessage}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Details</Typography>
                  <Box
                    component="pre"
                    sx={{
                      backgroundColor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 300,
                      fontSize: '0.875rem',
                    }}
                  >
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedLog(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      >
        <DialogTitle>Export Audit Data</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as string)}
              label="Format"
            >
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="pdf">PDF</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditDashboard;
