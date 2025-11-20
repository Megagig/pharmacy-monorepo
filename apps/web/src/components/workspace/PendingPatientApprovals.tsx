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
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';
import { format } from 'date-fns';

interface PendingPatient {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  status: string;
  createdAt: string;
  workplaceId: string;
}

const PendingPatientApprovals: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PendingPatient | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject' | null;
  }>({ open: false, action: null });
  const [reason, setReason] = useState('');

  // Fetch pending patients
  const {
    data: patients,
    isLoading,
    error,
  } = useQuery<PendingPatient[]>({
    queryKey: ['pendingPatients'],
    queryFn: async () => {
      const response = await apiClient.get('/patient-portal/patients/pending');
      return response.data.data?.patients || [];
    },
  });

  // Approve/Reject mutation
  const approveMutation = useMutation({
    mutationFn: async ({ patientId, approved }: { patientId: string; approved: boolean }) => {
      const response = await apiClient.patch(`/patient-portal/auth/approve/${patientId}`, {
        approved,
        reason: approved ? undefined : reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingPatients'] });
      queryClient.invalidateQueries({ queryKey: ['workspaceStats'] });
      handleCloseDialog();
    },
  });

  const handleApprove = (patient: PendingPatient) => {
    setSelectedPatient(patient);
    setActionDialog({ open: true, action: 'approve' });
  };

  const handleReject = (patient: PendingPatient) => {
    setSelectedPatient(patient);
    setActionDialog({ open: true, action: 'reject' });
  };

  const handleConfirmAction = async () => {
    if (!selectedPatient) return;

    await approveMutation.mutateAsync({
      patientId: selectedPatient._id,
      approved: actionDialog.action === 'approve',
    });
  };

  const handleCloseDialog = () => {
    setActionDialog({ open: false, action: null });
    setSelectedPatient(null);
    setReason('');
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load pending patient registrations. Please try again later.
      </Alert>
    );
  }

  if (!patients || patients.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Pending Patient Registrations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All patient registrations have been processed.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pending Patient Registrations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve patient registrations for your workspace
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Date of Birth</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient._id} hover>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {patient.firstName} {patient.lastName}
                      </Typography>
                      <Chip
                        label={patient.status}
                        size="small"
                        color="warning"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{patient.email}</TableCell>
                <TableCell>{patient.phone || '-'}</TableCell>
                <TableCell>
                  {patient.dateOfBirth
                    ? format(new Date(patient.dateOfBirth), 'MMM dd, yyyy')
                    : '-'}
                </TableCell>
                <TableCell>
                  {format(new Date(patient.createdAt), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" gap={1} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleApprove(patient)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={() => handleReject(patient)}
                      disabled={approveMutation.isPending}
                    >
                      Reject
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog */}
      <Dialog open={actionDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.action === 'approve' ? 'Approve Patient' : 'Reject Patient'}
        </DialogTitle>
        <DialogContent>
          {selectedPatient && (
            <Box>
              <Typography gutterBottom>
                {actionDialog.action === 'approve'
                  ? `Are you sure you want to approve ${selectedPatient.firstName} ${selectedPatient.lastName}? They will be able to log in to the patient portal.`
                  : `Are you sure you want to reject ${selectedPatient.firstName} ${selectedPatient.lastName}'s registration?`}
              </Typography>
              {actionDialog.action === 'reject' && (
                <TextField
                  fullWidth
                  label="Reason for rejection (optional)"
                  multiline
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  sx={{ mt: 2 }}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={approveMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={actionDialog.action === 'approve' ? 'success' : 'error'}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <CircularProgress size={20} />
            ) : actionDialog.action === 'approve' ? (
              'Approve'
            ) : (
              'Reject'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PendingPatientApprovals;
