import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  Avatar,
  Divider,
  Stack,
} from '@mui/material';
import ApproveIcon from '@mui/icons-material/CheckCircle';
import RejectIcon from '@mui/icons-material/Cancel';
import ViewIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import BadgeIcon from '@mui/icons-material/Badge';
import { apiClient } from '../../services/apiClient';
import { format, isValid, parseISO } from 'date-fns';

// Helper function to safely format dates
const safeFormatDate = (dateValue: string | Date | undefined | null, formatStr: string = 'MMM dd, yyyy'): string => {
  if (!dateValue) return 'N/A';

  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (!isValid(date)) return 'Invalid Date';
    return format(date, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error, 'Value:', dateValue);
    return 'Invalid Date';
  }
};

interface LicenseInfo {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  workplaceName?: string;
  licenseNumber: string;
  licenseStatus: 'pending' | 'approved' | 'rejected';
  pharmacySchool?: string;
  yearOfGraduation?: number;
  expirationDate?: string;
  documentInfo?: {
    fileName: string;
    uploadedAt: string;
    fileSize: number;
  };
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
}

const TenantLicenseManagement: React.FC = () => {
  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedLicense, setSelectedLicense] = useState<LicenseInfo | null>(null);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

  useEffect(() => {
    loadPendingLicenses();
  }, []);

  const loadPendingLicenses = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/licenses/pending');

      if (response.data.success) {
        setLicenses(response.data.data.licenses || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedLicense) return;

    try {
      setActionLoading(true);
      const response = await apiClient.post(
        `/admin/licenses/${selectedLicense.userId}/approve`,
        {}
      );

      if (response.data.success) {
        setSuccess('License approved successfully');
        setActionDialog(null);
        setSelectedLicense(null);

        // Optimistically remove the approved license from the list
        setLicenses((prevLicenses) =>
          prevLicenses.filter((license) => license.userId !== selectedLicense.userId)
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve license');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLicense || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      const response = await apiClient.post(
        `/admin/licenses/${selectedLicense.userId}/reject`,
        { reason: rejectionReason }
      );

      if (response.data.success) {
        setSuccess('License rejected successfully');
        setActionDialog(null);
        setSelectedLicense(null);
        setRejectionReason('');

        // Optimistically remove the rejected license from the list
        setLicenses((prevLicenses) =>
          prevLicenses.filter((license) => license.userId !== selectedLicense.userId)
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject license');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDocument = async (license: LicenseInfo) => {
    try {
      setSelectedLicense(license);
      setDocumentPreview(`/api/license/document/${license.userId}`);
      setActionDialog('view');
    } catch (err) {
      setError('Failed to load document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          License Verification Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadPendingLicenses}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading && licenses.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : licenses.length === 0 ? (
        <Alert severity="info">No pending license verifications</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>License Number</TableCell>
                <TableCell>Pharmacy School</TableCell>
                <TableCell>Graduation Year</TableCell>
                <TableCell>Expiration Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license.userId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">{license.userName}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {license.userEmail}
                        </Typography>
                        {license.workplaceName && (
                          <Typography variant="caption" display="block" color="textSecondary">
                            {license.workplaceName}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {license.licenseNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {license.pharmacySchool || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {license.yearOfGraduation || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {safeFormatDate(license.expirationDate, 'MMM dd, yyyy')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={license.licenseStatus.toUpperCase()}
                      size="small"
                      color={getStatusColor(license.licenseStatus) as any}
                    />
                  </TableCell>
                  <TableCell>
                    {license.documentInfo && (
                      <Box>
                        <Typography variant="caption" display="block">
                          {safeFormatDate(license.documentInfo.uploadedAt, 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatFileSize(license.documentInfo.fileSize)}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View Document">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDocument(license)}
                          color="primary"
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {license.licenseStatus === 'pending' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedLicense(license);
                                setActionDialog('approve');
                              }}
                              color="success"
                            >
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedLicense(license);
                                setActionDialog('reject');
                              }}
                              color="error"
                            >
                              <RejectIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={actionDialog === 'approve'}
        onClose={() => setActionDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve License</DialogTitle>
        <DialogContent>
          {selectedLicense && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                You are about to approve the license for <strong>{selectedLicense.userName}</strong>.
                This will grant them access to all license-required features.
              </Alert>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    License Number
                  </Typography>
                  <Typography variant="body1">{selectedLicense.licenseNumber}</Typography>
                </Box>
                {selectedLicense.pharmacySchool && (
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Pharmacy School
                    </Typography>
                    <Typography variant="body1">{selectedLicense.pharmacySchool}</Typography>
                  </Box>
                )}
                {selectedLicense.expirationDate && (
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Expiration Date
                    </Typography>
                    <Typography variant="body1">
                      {safeFormatDate(selectedLicense.expirationDate, 'MMMM dd, yyyy')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <ApproveIcon />}
          >
            Approve License
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={actionDialog === 'reject'}
        onClose={() => setActionDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject License</DialogTitle>
        <DialogContent>
          {selectedLicense && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You are about to reject the license for <strong>{selectedLicense.userName}</strong>.
                Please provide a clear reason for rejection.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Rejection Reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Document is unclear, license has expired, information doesn't match..."
                required
                helperText="This reason will be sent to the user via email"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setActionDialog(null);
            setRejectionReason('');
          }} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={actionLoading || !rejectionReason.trim()}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <RejectIcon />}
          >
            Reject License
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog
        open={actionDialog === 'view'}
        onClose={() => {
          setActionDialog(null);
          setDocumentPreview(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          License Document - {selectedLicense?.userName}
        </DialogTitle>
        <DialogContent>
          {selectedLicense && (
            <Box>
              <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                mb: 2,
                flexWrap: 'wrap'
              }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BadgeIcon color="primary" />
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        License Number
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {selectedLicense.licenseNumber}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                {selectedLicense.pharmacySchool && (
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SchoolIcon color="primary" />
                      <Box>
                        <Typography variant="caption" color="textSecondary">
                          Pharmacy School
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {selectedLicense.pharmacySchool}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
                {selectedLicense.expirationDate && (
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon color="primary" />
                      <Box>
                        <Typography variant="caption" color="textSecondary">
                          Expiration Date
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {safeFormatDate(selectedLicense.expirationDate, 'MMMM dd, yyyy')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
              <Divider sx={{ my: 2 }} />
              {documentPreview && (
                <Box sx={{ width: '100%', height: '500px', border: '1px solid #ddd', borderRadius: 1 }}>
                  <iframe
                    src={documentPreview}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    title="License Document"
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setActionDialog(null);
            setDocumentPreview(null);
          }}>
            Close
          </Button>
          {selectedLicense?.licenseStatus === 'pending' && (
            <>
              <Button
                onClick={() => {
                  setActionDialog('approve');
                  setDocumentPreview(null);
                }}
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  setActionDialog('reject');
                  setDocumentPreview(null);
                }}
                variant="contained"
                color="error"
                startIcon={<RejectIcon />}
              >
                Reject
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TenantLicenseManagement;
