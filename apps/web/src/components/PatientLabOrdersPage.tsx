import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Breadcrumbs,
  Link,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import ScienceIcon from '@mui/icons-material/Science';

import { usePatient } from '../queries/usePatients';
import { extractData } from '../utils/apiHelpers';
import OrderHistory from './OrderHistory';

const PatientLabOrdersPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  // Fetch patient data for breadcrumbs and header
  const { data: patientResponse, isLoading: patientLoading } = usePatient(
    patientId!
  );

  const patientData = extractData(patientResponse)?.patient;

  const handleCreateOrder = () => {
    navigate(`/patients/${patientId}/lab-orders/create`);
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/lab-orders/${orderId}`);
  };

  const handleViewResults = (orderId: string) => {
    navigate(`/lab-orders/${orderId}/results`);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Breadcrumbs */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(`/patients/${patientId}`)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Lab Orders
          </Typography>
        </Box>

        <Breadcrumbs aria-label="breadcrumb">
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            color="inherit"
            onClick={() => navigate('/dashboard')}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </Link>
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            color="inherit"
            onClick={() => navigate('/patients')}
          >
            <PersonIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Patients
          </Link>
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            color="inherit"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            {patientLoading
              ? 'Loading...'
              : patientData
              ? `${patientData.firstName} ${patientData.lastName}`
              : 'Patient'}
          </Link>
          <Typography
            sx={{ display: 'flex', alignItems: 'center' }}
            color="text.primary"
          >
            <ScienceIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Lab Orders
          </Typography>
        </Breadcrumbs>

        {/* Patient Info */}
        {patientData && (
          <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" gutterBottom>
              {patientData.firstName} {patientData.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MRN: {patientData.mrn} •
              {patientData.age && ` Age: ${patientData.age} •`}
              {patientData.gender && ` Gender: ${patientData.gender}`}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Lab Orders History */}
      <OrderHistory
        patientId={patientId!}
        showCreateButton={true}
        onCreateOrder={handleCreateOrder}
        onViewOrder={handleViewOrder}
        onViewResults={handleViewResults}
        compact={false}
      />
    </Box>
  );
};

export default PatientLabOrdersPage;
