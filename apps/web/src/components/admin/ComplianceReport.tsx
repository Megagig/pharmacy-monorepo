import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ReportIcon from '@mui/icons-material/Assessment';
import CheckIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import SecurityIcon from '@mui/icons-material/Security';
import DownloadIcon from '@mui/icons-material/Download';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { auditService } from '../../services/auditService';

interface ComplianceMetric {
  _id: string;
  count: number;
  riskDistribution: string[];
  errorCount: number;
}

interface ComplianceReportData {
  summary: {
    totalLogs: number;
    uniqueUserCount: number;
    errorRate: number;
    complianceScore: number;
    highRiskActivitiesCount: number;
    suspiciousActivitiesCount: number;
  };
  complianceMetrics: ComplianceMetric[];
  highRiskActivities: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high';
    action?: string;
    actionDisplay?: string;
    userId?: {
      firstName: string;
      lastName: string;
    };
  }>;
  suspiciousActivities: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    riskLevel: 'low' | 'medium' | 'high';
    actionCount: number;
    user?: {
      firstName: string;
      lastName: string;
    };
    ipAddress: string;
    errorRate?: number;
  }>;
  recommendations: string[];
}

const ComplianceReport: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: subMonths(new Date(), 1), // Default to last month
    endDate: new Date(),
  });
  const [reportGenerated, setReportGenerated] = useState(false);

  // Fetch compliance report
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useQuery<ComplianceReportData>({
    queryKey: ['complianceReport', dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      auditService.getComplianceReport({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
    enabled: reportGenerated,
  });

  const handleGenerateReport = () => {
    setReportGenerated(true);
    refetch();
  };

  const handleExportReport = async () => {
    if (!reportData) return;

    try {
      const exportData = await auditService.exportAuditData({
        format: 'pdf',
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        includeDetails: true,
      });

      // Generate PDF report
      const pdfBlob = await auditService.generatePDFReport({
        title: 'MTR Compliance Report',
        generatedAt: new Date(),
        dateRange,
        ...reportData,
        exportData,
      });

      auditService.downloadFile(
        pdfBlob,
        `compliance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        'application/pdf'
      );
    } catch (error) {
      console.error('Failed to export compliance report:', error);
    }
  };

  const getComplianceScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getComplianceScoreIcon = (score: number) => {
    if (score >= 90) return <CheckIcon color="success" />;
    if (score >= 70) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const getRiskDistributionSummary = (riskDistribution: string[]) => {
    const counts = riskDistribution.reduce((acc, risk) => {
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([risk, count]) => (
      <Chip
        key={risk}
        label={`${risk}: ${count}`}
        color={auditService.getRiskLevelColor(risk)}
        size="small"
        sx={{ mr: 1, mb: 1 }}
      />
    ));
  };

  if (error) {
    return (
      <Alert severity="error">
        Failed to generate compliance report: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        MTR Compliance Report
      </Typography>

      {/* Date Range Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Report Parameters
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={format(dateRange.startDate, 'yyyy-MM-dd')}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: new Date(e.target.value),
                  }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={format(dateRange.endDate, 'yyyy-MM-dd')}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    endDate: new Date(e.target.value),
                  }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <Button
                variant="contained"
                onClick={handleGenerateReport}
                disabled={isLoading}
                fullWidth
              >
                {isLoading ? 'Generating...' : 'Generate Report'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Report Content */}
      {reportData && (
        <>
          {/* Executive Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Executive Summary</Typography>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportReport}
                >
                  Export PDF
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {reportData.summary.totalLogs.toLocaleString()}
                    </Typography>
                    <Typography color="textSecondary">
                      Total Audit Logs
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {reportData.summary.uniqueUserCount}
                    </Typography>
                    <Typography color="textSecondary">Active Users</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography
                      variant="h4"
                      color={
                        reportData.summary.errorRate > 5 ? 'error' : 'success'
                      }
                    >
                      {reportData.summary.errorRate.toFixed(1)}%
                    </Typography>
                    <Typography color="textSecondary">Error Rate</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                  <Box
                    sx={{
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    {getComplianceScoreIcon(reportData.summary.complianceScore)}
                    <Box>
                      <Typography
                        variant="h4"
                        color={getComplianceScoreColor(
                          reportData.summary.complianceScore
                        )}
                      >
                        {reportData.summary.complianceScore}
                      </Typography>
                      <Typography color="textSecondary">
                        Compliance Score
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Compliance Metrics by Category */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Compliance Metrics by Category
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Total Activities</TableCell>
                      <TableCell align="right">Errors</TableCell>
                      <TableCell align="right">Error Rate</TableCell>
                      <TableCell>Risk Distribution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.complianceMetrics.map((metric) => {
                      const errorRate =
                        metric.count > 0
                          ? (metric.errorCount / metric.count) * 100
                          : 0;
                      return (
                        <TableRow key={metric._id}>
                          <TableCell>
                            <Typography variant="body2">
                              {auditService.getComplianceCategoryDisplay(
                                metric._id
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {metric.count.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            {metric.errorCount}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              color={errorRate > 5 ? 'error' : 'success'}
                            >
                              {errorRate.toFixed(1)}%
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                              {getRiskDistributionSummary(
                                metric.riskDistribution
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Security Alerts */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    High-Risk Activities (
                    {reportData.summary.highRiskActivitiesCount})
                  </Typography>
                  {reportData.highRiskActivities.length > 0 ? (
                    <List dense>
                      {reportData.highRiskActivities
                        .slice(0, 5)
                        .map((activity, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <SecurityIcon color="warning" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                activity.actionDisplay || activity.action
                              }
                              secondary={`${activity.userId?.firstName} ${
                                activity.userId?.lastName
                              } - ${format(
                                new Date(activity.timestamp),
                                'MMM dd, HH:mm'
                              )}`}
                            />
                          </ListItem>
                        ))}
                      {reportData.highRiskActivities.length > 5 && (
                        <ListItem>
                          <ListItemText
                            primary={`... and ${
                              reportData.highRiskActivities.length - 5
                            } more`}
                            sx={{ fontStyle: 'italic' }}
                          />
                        </ListItem>
                      )}
                    </List>
                  ) : (
                    <Typography color="textSecondary">
                      No high-risk activities detected
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error.main">
                    <ErrorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Suspicious Activities (
                    {reportData.summary.suspiciousActivitiesCount})
                  </Typography>
                  {reportData.suspiciousActivities.length > 0 ? (
                    <List dense>
                      {reportData.suspiciousActivities
                        .slice(0, 5)
                        .map((activity, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <ErrorIcon color="error" />
                            </ListItemIcon>
                            <ListItemText
                              primary={`${activity.actionCount} actions from ${activity.user?.firstName} ${activity.user?.lastName}`}
                              secondary={`IP: ${
                                activity.ipAddress
                              } - Error Rate: ${activity.errorRate?.toFixed(
                                1
                              )}%`}
                            />
                          </ListItem>
                        ))}
                      {reportData.suspiciousActivities.length > 5 && (
                        <ListItem>
                          <ListItemText
                            primary={`... and ${
                              reportData.suspiciousActivities.length - 5
                            } more`}
                            sx={{ fontStyle: 'italic' }}
                          />
                        </ListItem>
                      )}
                    </List>
                  ) : (
                    <Typography color="textSecondary">
                      No suspicious activities detected
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Recommendations */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ReportIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Compliance Recommendations
              </Typography>
              <List>
                {reportData.recommendations.map((recommendation, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={recommendation} />
                    </ListItem>
                    {index < reportData.recommendations.length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default ComplianceReport;
