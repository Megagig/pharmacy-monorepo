import React from 'react';
import { Box } from '@mui/material';
import PatientMedicationsPage from './medications/PatientMedicationsPage';

interface MedicationManagementProps {
  patientId: string;
}

const MedicationManagement: React.FC<MedicationManagementProps> = ({
  patientId,
}) => {
  return (
    <Box>
      <PatientMedicationsPage patientId={patientId} />
    </Box>
  );
};

export default MedicationManagement;
