import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  Alert,
  Avatar,
  Chip,
  Tooltip,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useDiagnosticReferrals,
  useDownloadReferralDocument,
  useSendReferralElectronically,
  useDeleteReferral,
  useUpdateReferralDocument,
} from '../../../queries/useDiagnosticHistory';
import { DiagnosticReferral } from '../../../services/diagnosticHistoryService';
import SendReferralDialog from '../../../components/diagnostics/SendReferralDialog';
import EditReferralDialog from '../../../components/diagnostics/EditReferralDialog';
import {
  generateTextDocument,
  generateRTFDocument,
  generatePDFDocument,
  downloadDocument,
  ReferralDocumentData
} from '../../../utils/documentGenerator';

const DiagnosticReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedReferral, setSelectedReferral] = useState<DiagnosticReferral | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editingReferral, setEditingReferral] = useState<DiagnosticReferral | null>(null);
  const [sendingReferral, setSendingReferral] = useState<DiagnosticReferral | null>(null);

  const {
    data: referralsData,
    isLoading,
    error,
    refetch,
  } = useDiagnosticReferrals({
    page: page + 1,
    limit: rowsPerPage,
    status: statusFilter || undefined,
    specialty: specialtyFilter || undefined,
  });

  const referrals = referralsData?.referrals || [];
  const pagination = referralsData?.pagination || {
    current: 1,
    total: 1,
    count: 0,
    totalReferrals: 0,
  };
  const statistics = referralsData?.statistics || {
    pending: 0,
    sent: 0,
    acknowledged: 0,
    completed: 0,
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: any) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleSpecialtyFilterChange = (event: any) => {
    setSpecialtyFilter(event.target.value);
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, referral: DiagnosticReferral) => {
    setAnchorEl(event.currentTarget);
    setSelectedReferral(referral);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedReferral(null);
  };

  // Mutations
  const downloadMutation = useDownloadReferralDocument();
  const sendMutation = useSendReferralElectronically();
  const deleteMutation = useDeleteReferral();
  const updateMutation = useUpdateReferralDocument();

  const handleRefresh = () => {
    refetch();
  };

  const handleDownload = async (caseId: string, format: 'pdf' | 'docx' | 'text' = 'pdf') => {
    try {
      const result = await downloadMutation.mutateAsync({ caseId, format });

      // Get patient and pharmacist names from the selected referral
      const patientName = selectedReferral?.patientId && typeof selectedReferral.patientId === 'object' ?
        `${selectedReferral.patientId.firstName || ''} ${selectedReferral.patientId.lastName || ''}`.trim() :
        undefined;
      const pharmacistName = selectedReferral?.pharmacistId ?
        `${selectedReferral.pharmacistId.firstName} ${selectedReferral.pharmacistId.lastName}` :
        undefined;

      const documentData: ReferralDocumentData = {
        content: result.content,
        caseId,
        patientName,
        pharmacistName,
        generatedAt: new Date(),
      };

      let blob: Blob;
      let filename: string;

      switch (format) {
        case 'text':
          blob = generateTextDocument(documentData);
          filename = `referral-${caseId}.txt`;
          break;
        case 'docx':
          blob = generateRTFDocument(documentData);
          filename = `referral-${caseId}.rtf`;
          break;
        case 'pdf':
          blob = generatePDFDocument(documentData);
          filename = `referral-${caseId}.pdf`;
          break;
        default:
          blob = generatePDFDocument(documentData);
          filename = `referral-${caseId}.pdf`;
      }

      downloadDocument(
        blob,
        filename,
        () => {
          handleMenuClose();
          // Show success notification instead of alert

        },
        (error) => {
          console.error('Download failed:', error);
          alert('Download failed. Please try again.');
        }
      );

    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    }
  };

  const handleSendReferral = async (data: any) => {
    if (!sendingReferral) {
      console.error('No referral selected for sending');
      alert('Error: No referral selected. Please try again.');
      return;
    }

    try {

      await sendMutation.mutateAsync({
        caseId: sendingReferral.caseId,
        data,
      });

      // Clear the sending referral state
      setSendingReferral(null);

      // Refetch data to update status
      await refetch();

    } catch (error) {
      console.error('Failed to send referral:', error);

      // Show user-friendly error message
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while sending the referral.';

      alert(`Failed to send referral: ${errorMessage}\n\nPlease try again or contact support if the problem persists.`);

      // Don't close the dialog on error so user can retry
      throw error;
    }
  };

  const handleEditReferral = () => {
    if (!selectedReferral?.referral?.document?.content) return;

    // Store the referral being edited separately so it persists after menu closes
    setEditingReferral(selectedReferral);
    setEditContent(selectedReferral.referral.document.content);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleSaveEdit = async (content: string) => {
    if (!editingReferral) {
      console.error('No referral selected for editing');
      alert('Error: No referral selected. Please try again.');
      return;
    }

    try {

      const result = await updateMutation.mutateAsync({
        caseId: editingReferral.caseId,
        content,
      });

      // Refetch the data to get updated content
      await refetch();

      // Clear the editing referral state
      setEditingReferral(null);

    } catch (error) {
      console.error('Failed to save referral edit:', error);

      // Show user-friendly error message
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while saving the referral document.';

      alert(`Failed to save changes: ${errorMessage}\n\nPlease try again or contact support if the problem persists.`);

      // Don't close the dialog on error so user can retry
      throw error;
    }
  };

  const handleDeleteReferral = async () => {
    if (!selectedReferral) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this referral? This action cannot be undone.'
    );

    if (confirmed) {
      await deleteMutation.mutateAsync(selectedReferral.caseId);
      refetch();
      handleMenuClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'acknowledged':
        return 'info';
      case 'sent':
        return 'primary';
      default:
        return 'warning';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return 'error';
      case 'within_24h':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return <WarningIcon fontSize="small" />;
      case 'within_24h':
        return <ScheduleIcon fontSize="small" />;
      default:
        return <AssignmentIcon fontSize="small" />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/pharmacy/diagnostics')}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
            Diagnostic Referrals
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        {/* Statistics Cards */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={statistics.pending} color="warning">
                  <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                    <ScheduleIcon />
                  </Avatar>
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {statistics.pending}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={statistics.sent} color="primary">
                  <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1 }}>
                    <SendIcon />
                  </Avatar>
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {statistics.sent}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sent
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={statistics.acknowledged} color="info">
                  <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1 }}>
                    <VisibilityIcon />
                  </Avatar>
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {statistics.acknowledged}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Acknowledged
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' } }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={statistics.completed} color="success">
                  <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {statistics.completed}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Stack>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={handleStatusFilterChange}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="acknowledged">Acknowledged</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Specialty</InputLabel>
                <Select
                  value={specialtyFilter}
                  label="Specialty"
                  onChange={handleSpecialtyFilterChange}
                >
                  <MenuItem value="">All Specialties</MenuItem>
                  <MenuItem value="cardiology">Cardiology</MenuItem>
                  <MenuItem value="dermatology">Dermatology</MenuItem>
                  <MenuItem value="endocrinology">Endocrinology</MenuItem>
                  <MenuItem value="gastroenterology">Gastroenterology</MenuItem>
                  <MenuItem value="neurology">Neurology</MenuItem>
                  <MenuItem value="oncology">Oncology</MenuItem>
                  <MenuItem value="orthopedics">Orthopedics</MenuItem>
                  <MenuItem value="psychiatry">Psychiatry</MenuItem>
                  <MenuItem value="pulmonology">Pulmonology</MenuItem>
                  <MenuItem value="urology">Urology</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Referrals Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {error ? (
            <Alert severity="error" sx={{ m: 3 }}>
              Failed to load referrals. Please try refreshing the page.
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Patient</TableCell>
                      <TableCell>Case ID</TableCell>
                      <TableCell>Specialty</TableCell>
                      <TableCell>Urgency</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Pharmacist</TableCell>
                      <TableCell>Generated</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? (
                      // Loading skeletons
                      [...Array(rowsPerPage)].map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton width={150} /></TableCell>
                          <TableCell><Skeleton width={100} /></TableCell>
                          <TableCell><Skeleton width={120} /></TableCell>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell><Skeleton width={150} /></TableCell>
                          <TableCell><Skeleton width={100} /></TableCell>
                          <TableCell><Skeleton width={50} /></TableCell>
                        </TableRow>
                      ))
                    ) : referrals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                          <LocalHospitalIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No referrals found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {statusFilter || specialtyFilter
                              ? 'Try adjusting your filter criteria'
                              : 'No referrals have been generated yet'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      referrals.map((referral) => (
                        <TableRow key={referral._id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                                <PersonIcon fontSize="small" />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {referral.patientId?.firstName} {referral.patientId?.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {referral.patientId?.age}y, {referral.patientId?.gender}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {referral.caseId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={referral.referral?.specialty}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getUrgencyIcon(referral.referral?.urgency)}
                              label={referral.referral?.urgency?.replace('_', ' ')}
                              size="small"
                              color={getUrgencyColor(referral.referral?.urgency) as any}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={referral.referral?.status}
                              size="small"
                              color={getStatusColor(referral.referral?.status) as any}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {referral.pharmacistId?.firstName} {referral.pharmacistId?.lastName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {referral.referral?.generatedAt
                                ? format(new Date(referral.referral.generatedAt), 'MMM dd, yyyy')
                                : 'N/A'}
                            </Typography>
                            {referral.referral?.generatedAt && (
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(referral.referral.generatedAt), 'HH:mm')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/pharmacy/diagnostics/case/${referral.caseId}/results`)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="More Actions">
                              <IconButton
                                size="small"
                                onClick={(e) => handleMenuOpen(e, referral)}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <TablePagination
                rowsPerPageOptions={[10, 20, 50]}
                component="div"
                count={pagination.totalReferrals}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuList>
          <MenuItemComponent
            onClick={() => {
              if (selectedReferral) {
                navigate(`/pharmacy/diagnostics/case/${selectedReferral.caseId}/results`);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Case Details</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(selectedReferral?.caseId || '', 'pdf');
            }}
            disabled={downloadMutation.isPending}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download PDF</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(selectedReferral?.caseId || '', 'docx');
            }}
            disabled={downloadMutation.isPending}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download RTF (Word Compatible)</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(selectedReferral?.caseId || '', 'text');
            }}
            disabled={downloadMutation.isPending}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download Text File</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={() => {
              // Store the referral being sent separately so it persists after menu closes
              setSendingReferral(selectedReferral);
              setSendDialogOpen(true);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <SendIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Send Referral</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={handleEditReferral}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Referral</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={handleDeleteReferral}
            disabled={deleteMutation.isPending}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Referral</ListItemText>
          </MenuItemComponent>
        </MenuList>
      </Menu>

      {/* Send Referral Dialog */}
      <SendReferralDialog
        open={sendDialogOpen}
        onClose={() => {
          setSendDialogOpen(false);
          setSendingReferral(null); // Clear sending referral when dialog closes
        }}
        onSend={handleSendReferral}
        loading={sendMutation.isPending}
        caseId={sendingReferral?.caseId}
      />

      {/* Edit Referral Dialog */}
      <EditReferralDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingReferral(null); // Clear editing referral when dialog closes
        }}
        onSave={handleSaveEdit}
        loading={updateMutation.isPending}
        initialContent={editContent}
        caseId={editingReferral?.caseId}
      />
    </Container>
  );
};

export default DiagnosticReferralsPage;