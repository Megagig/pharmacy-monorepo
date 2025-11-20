import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Tooltip,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import Download from '@mui/icons-material/Download';
import Warning from '@mui/icons-material/Warning';
import Error from '@mui/icons-material/Error';
import Info from '@mui/icons-material/Info';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { format, parseISO } from 'date-fns';
import { clinicalInterventionService } from '../services/clinicalInterventionService';

interface AuditLog {
  _id: string;
  action: string;
  timestamp: string;
  userId: {
    firstName: string;
    lastName: string;
    email: string;
  };
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: string;
  changedFields?: string[];
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

interface AuditTrailProps {
  interventionId?: string;
  interventionNumber?: string;
}

const ClinicalInterventionAuditTrail: React.FC<AuditTrailProps> = ({
  interventionId,
  interventionNumber,
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<{
    totalActions: number;
    uniqueUsers: number;
    lastActivity: string | null;
    riskActivities: number;
  } | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState('');

  const limit = 20;

  const fetchAuditTrail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const options: {
        page: number;
        limit: number;
        startDate?: string;
        endDate?: string;
        riskLevel?: string;
      } = {
        page,
        limit,
      };

      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;
      if (riskLevelFilter) options.riskLevel = riskLevelFilter;

      let response;

      if (interventionId) {
        // Fetch audit trail for specific intervention
        response = await clinicalInterventionService.getInterventionAuditTrail(
          interventionId,
          options
        );
      } else {
        // Fetch general audit trail for all interventions
        response = await clinicalInterventionService.getAllAuditTrail(options);
      }

      if (response.success && response.data) {
        setAuditLogs(response.data.logs as AuditLog[]);
        setTotalPages(Math.ceil((response.data.total || 0) / limit));
        setSummary(
          response.data.summary || {
            totalActions: 0,
            uniqueUsers: 0,
            lastActivity: null,
            riskActivities: 0,
          }
        );
      } else {
        // Set empty state when no data is available
        setAuditLogs([]);
        setTotalPages(1);
        setSummary({
          totalActions: 0,
          uniqueUsers: 0,
          lastActivity: null,
          riskActivities: 0,
        });
        setError(response.message || 'No audit data available');
      }
    } catch (error: unknown) {
      console.error('Error fetching audit trail:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch audit trail';
      setError(errorMessage);

      // Set empty state on error
      setAuditLogs([]);
      setTotalPages(1);
      setSummary({
        totalActions: 0,
        uniqueUsers: 0,
        lastActivity: null,
        riskActivities: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [interventionId, page, startDate, endDate, riskLevelFilter, limit]);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const handleExportAudit = async () => {
    try {
      const options = {
        format: 'csv' as const,
        startDate:
          startDate ||
          format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        endDate: endDate || format(new Date(), 'yyyy-MM-dd'),
        interventionIds: interventionId ? [interventionId] : [],
        includeDetails: true,
      };

      const blob = await clinicalInterventionService.exportAuditData(options);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${
        interventionId
          ? `intervention_${interventionNumber || interventionId}_audit`
          : 'clinical_interventions_audit'
      }_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.error('Export error:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to export audit data'
      );
    }
  };

  const toggleRowExpansion = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
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
      default:
        return 'success';
    }
  };

  const getRiskLevelIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <Error />;
      case 'high':
        return <Warning />;
      case 'medium':
        return <Info />;
      case 'low':
      default:
        return <CheckCircle />;
    }
  };

  const formatActionName = (action: string) => {
    return action
      .replace('INTERVENTION_', '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={200}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">
              {interventionId
                ? `Audit Trail - ${interventionNumber || interventionId}`
                : 'Clinical Interventions Audit Trail'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportAudit}
              size="small"
            >
              Export
            </Button>
          </Box>

          {/* Summary Cards */}
          {summary && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: 'repeat(4, 1fr)',
                },
                gap: 2,
                mb: 3,
              }}
            >
              <Card variant="outlined">
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Actions
                  </Typography>
                  <Typography variant="h4">{summary.totalActions}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Unique Users
                  </Typography>
                  <Typography variant="h4">{summary.uniqueUsers}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Risk Activities
                  </Typography>
                  <Typography
                    variant="h4"
                    color={summary.riskActivities > 0 ? 'error' : 'success'}
                  >
                    {summary.riskActivities}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Last Activity
                  </Typography>
                  <Typography variant="body2">
                    {summary.lastActivity
                      ? format(
                          parseISO(summary.lastActivity),
                          'MMM dd, yyyy HH:mm'
                        )
                      : 'No activity'}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Filters */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              size="small"
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Risk Level</InputLabel>
              <Select
                value={riskLevelFilter}
                onChange={(e) => setRiskLevelFilter(e.target.value)}
                label="Risk Level"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setRiskLevelFilter('');
                setPage(1);
              }}
              fullWidth
            >
              Clear Filters
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Audit Log Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <React.Fragment key={log._id}>
                    <TableRow hover>
                      <TableCell>
                        <Typography variant="body2">
                          {format(parseISO(log.timestamp), 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {format(parseISO(log.timestamp), 'HH:mm:ss')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {formatActionName(log.action)}
                        </Typography>
                        {log.changedFields && log.changedFields.length > 0 && (
                          <Typography variant="caption" color="textSecondary">
                            Changed: {log.changedFields.join(', ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {log.userId.firstName} {log.userId.lastName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {log.userId.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getRiskLevelIcon(log.riskLevel)}
                          label={log.riskLevel.toUpperCase()}
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
                        <Typography variant="body2" textTransform="capitalize">
                          {log.complianceCategory.replace(/_/g, ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpansion(log._id)}
                          >
                            {expandedRows.has(log._id) ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        style={{ paddingBottom: 0, paddingTop: 0 }}
                        colSpan={6}
                      >
                        <Collapse
                          in={expandedRows.has(log._id)}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box margin={1}>
                            <Typography variant="subtitle2" gutterBottom>
                              Details
                            </Typography>
                            <pre
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor: '#f5f5f5',
                                padding: '8px',
                                borderRadius: '4px',
                                overflow: 'auto',
                                maxHeight: '200px',
                              }}
                            >
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                            {log.oldValues && log.newValues && (
                              <Box mt={2}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Changes
                                </Typography>
                                <Box
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 2,
                                  }}
                                >
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                    >
                                      Before:
                                    </Typography>
                                    <pre
                                      style={{
                                        fontSize: '0.75rem',
                                        backgroundColor: '#ffebee',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        overflow: 'auto',
                                        maxHeight: '150px',
                                      }}
                                    >
                                      {JSON.stringify(log.oldValues, null, 2)}
                                    </pre>
                                  </Box>
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                    >
                                      After:
                                    </Typography>
                                    <pre
                                      style={{
                                        fontSize: '0.75rem',
                                        backgroundColor: '#e8f5e8',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        overflow: 'auto',
                                        maxHeight: '150px',
                                      }}
                                    >
                                      {JSON.stringify(log.newValues, null, 2)}
                                    </pre>
                                  </Box>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}

          {auditLogs.length === 0 && !loading && (
            <Box textAlign="center" py={4}>
              <Alert severity="info">
                <Typography variant="h6" gutterBottom>
                  No Audit Data Available
                </Typography>
                <Typography variant="body2">
                  {interventionId
                    ? 'No audit logs found for this specific intervention.'
                    : 'No audit logs match the selected criteria. Try adjusting your filters or check back later as audit data is generated through system usage.'}
                </Typography>
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClinicalInterventionAuditTrail;
