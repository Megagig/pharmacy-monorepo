/**
 * AuditTrail Component
 * Displays workspace audit logs with timeline view, filters, and export functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Typography,
  Skeleton,
  Alert,
  TextField,
  MenuItem,
  Button,
  Grid,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { format } from 'date-fns';
import type {
  AuditFilters,
  AuditCategory,
  AuditSeverity,
  WorkspaceAuditLog,
} from '../../types/workspace';
import { useAuditLogs, useExportAuditLogs } from '../../queries/useWorkspaceTeam';

export interface AuditTrailProps {
  /** Optional initial filters */
  initialFilters?: AuditFilters;
}

/**
 * Get color for severity badge
 */
const getSeverityColor = (
  severity: AuditSeverity
): 'success' | 'info' | 'warning' | 'error' => {
  switch (severity) {
    case 'low':
      return 'success';
    case 'medium':
      return 'info';
    case 'high':
      return 'warning';
    case 'critical':
      return 'error';
    default:
      return 'info';
  }
};

/**
 * Get color for category badge
 */
const getCategoryColor = (
  category: AuditCategory
): 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'default' => {
  switch (category) {
    case 'member':
      return 'primary';
    case 'role':
      return 'secondary';
    case 'permission':
      return 'info';
    case 'invite':
      return 'success';
    case 'auth':
      return 'warning';
    case 'settings':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Format date for display
 */
const formatDate = (date: Date | string): string => {
  try {
    return format(new Date(date), 'MMM dd, yyyy HH:mm:ss');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format action name for display
 */
const formatAction = (action: string): string => {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Loading skeleton for table rows
 */
const TableRowSkeleton: React.FC = () => (
  <TableRow>
    <TableCell>
      <Skeleton variant="text" width={150} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={120} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={80} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={140} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={70} height={24} />
    </TableCell>
    <TableCell align="right">
      <Skeleton variant="circular" width={32} height={32} />
    </TableCell>
  </TableRow>
);

/**
 * Audit log details row component
 */
interface AuditDetailsRowProps {
  log: WorkspaceAuditLog;
  open: boolean;
}

const AuditDetailsRow: React.FC<AuditDetailsRowProps> = ({ log, open }) => {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 0 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ py: 2, px: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" gutterBottom>
              Details
            </Typography>
            
            {/* Before/After values */}
            {(log.details.before || log.details.after) && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {log.details.before && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Before:
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1, mt: 0.5 }}>
                      <Typography variant="body2" component="pre" sx={{ m: 0 }}>
                        {typeof log.details.before === 'object'
                          ? JSON.stringify(log.details.before, null, 2)
                          : String(log.details.before)}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {log.details.after && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      After:
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1, mt: 0.5 }}>
                      <Typography variant="body2" component="pre" sx={{ m: 0 }}>
                        {typeof log.details.after === 'object'
                          ? JSON.stringify(log.details.after, null, 2)
                          : String(log.details.after)}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}

            {/* Reason */}
            {log.details.reason && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Reason:
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {log.details.reason}
                </Typography>
              </Box>
            )}

            {/* Metadata */}
            {log.details.metadata && Object.keys(log.details.metadata).length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Additional Information:
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, mt: 0.5 }}>
                  <Typography variant="body2" component="pre" sx={{ m: 0 }}>
                    {JSON.stringify(log.details.metadata, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Technical details */}
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    IP Address:
                  </Typography>
                  <Typography variant="body2">{log.ipAddress}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    User Agent:
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {log.userAgent}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
};

/**
 * AuditTrail component
 * Displays audit logs with filters and export functionality
 */
const AuditTrail: React.FC<AuditTrailProps> = ({ initialFilters = {} }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch audit logs
  const { data, isLoading, error } = useAuditLogs(filters, {
    page: page + 1,
    limit: rowsPerPage,
  });

  // Export mutation
  const exportMutation = useExportAuditLogs();

  /**
   * Handle page change
   */
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
    setPage(0);
  };

  /**
   * Handle clear filters
   */
  const handleClearFilters = () => {
    setFilters({});
    setPage(0);
  };

  /**
   * Handle export to CSV
   */
  const handleExport = async () => {
    try {
      const blob = await exportMutation.mutateAsync(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  /**
   * Toggle row expansion
   */
  const toggleRowExpansion = (logId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load audit logs
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Date Range */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>

          {/* Category Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              label="Category"
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              size="small"
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="role">Role</MenuItem>
              <MenuItem value="permission">Permission</MenuItem>
              <MenuItem value="invite">Invite</MenuItem>
              <MenuItem value="auth">Auth</MenuItem>
              <MenuItem value="settings">Settings</MenuItem>
            </TextField>
          </Grid>

          {/* Action Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Action"
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              placeholder="e.g., role_changed"
              size="small"
            />
          </Grid>

          {/* Actions */}
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearFilters}
                fullWidth
              >
                Clear
              </Button>
              <Tooltip title="Export to CSV">
                <IconButton
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                  color="primary"
                  size="small"
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell align="right">Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              <>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </>
            ) : data?.logs && data.logs.length > 0 ? (
              // Actual data
              data.logs.map((log) => {
                const isExpanded = expandedRows.has(log._id);
                const hasDetails =
                  log.details.before ||
                  log.details.after ||
                  log.details.reason ||
                  (log.details.metadata && Object.keys(log.details.metadata).length > 0);

                return (
                  <React.Fragment key={log._id}>
                    <TableRow
                      hover
                      sx={{
                        '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                        cursor: hasDetails ? 'pointer' : 'default',
                      }}
                      onClick={() => hasDetails && toggleRowExpansion(log._id)}
                    >
                      {/* Timestamp */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {formatDate(log.timestamp)}
                        </Typography>
                      </TableCell>

                      {/* Actor */}
                      <TableCell>
                        <Typography variant="body2">
                          {log.actorId.firstName} {log.actorId.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {log.actorId._id}
                        </Typography>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Chip
                          label={log.category}
                          color={getCategoryColor(log.category)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>

                      {/* Action */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {formatAction(log.action)}
                        </Typography>
                      </TableCell>

                      {/* Target */}
                      <TableCell>
                        {log.targetId ? (
                          <>
                            <Typography variant="body2">
                              {log.targetId.firstName} {log.targetId.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {log.targetId._id}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            N/A
                          </Typography>
                        )}
                      </TableCell>

                      {/* Severity */}
                      <TableCell>
                        <Chip
                          label={log.severity}
                          color={getSeverityColor(log.severity)}
                          size="small"
                        />
                      </TableCell>

                      {/* Expand Button */}
                      <TableCell align="right">
                        {hasDetails && (
                          <IconButton size="small" aria-label="Expand details">
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Details Row */}
                    {hasDetails && (
                      <AuditDetailsRow log={log} open={isExpanded} />
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              // Empty state
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No audit logs found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Object.keys(filters).length > 0
                        ? 'Try adjusting your filters to see more results.'
                        : 'Audit logs will appear here as actions are performed in your workspace.'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data?.pagination && data.pagination.total > 0 && (
        <TablePagination
          component="div"
          count={data.pagination.total}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Box>
  );
};

export default AuditTrail;
