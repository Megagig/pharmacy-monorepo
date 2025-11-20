import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  useAdherenceLogs,
  useMedicationsByPatient,
  useCreateMedication,
  useUpdateMedication,
  useArchiveMedication,
  useLogAdherence,
} from '../../queries/medicationManagementQueries';
import { usePatient } from '../../queries/usePatients';
import MedicationList from './MedicationList';
import AddMedicationDialog, { MedicationFormData } from './AddMedicationDialog';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  indication: string;
  prescriber: string;
  cost?: number;
  sellingPrice?: number;
  allergyCheck: {
    status: boolean;
    details: string;
  };
  status: 'active' | 'archived' | 'cancelled';
  patientId: string;
  reminders?: MedicationReminder[];
}

interface MedicationReminder {
  id?: string;
  time: string;
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  enabled: boolean;
  notes?: string;
}

interface PatientMedicationsPageProps {
  patientId?: string;
}

const PatientMedicationsPage: React.FC<PatientMedicationsPageProps> = ({
  patientId: propPatientId,
}) => {
  const { patientId: paramPatientId } = useParams<{ patientId: string }>();
  const patientId = propPatientId || paramPatientId;
  const [tabValue, setTabValue] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch patient data
  const {
    data: patientData,
    isLoading: isLoadingPatient,
    error: patientError,
  } = usePatient(patientId || '');

  // Fetch medications
  const { data: medicationsData, isLoading, refetch } = useMedicationsByPatient(
    patientId || ''
  );

  // Mutation for creating medication
  const createMedicationMutation = useCreateMedication();

  // Convert medication data to the expected format
  const medications: Medication[] = React.useMemo(() => {
    if (!medicationsData) return [];
    return medicationsData.map(
      (med) =>
        ({
          id: med._id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          route: med.route,
          startDate: med.startDate,
          endDate: med.endDate,
          indication: med.indication || '',
          prescriber: med.prescriber || '',
          allergyCheck: med.allergyCheck,
          status: med.status,
          patientId: med.patientId,
        } as Medication)
    );
  }, [medicationsData]);

  // Filter medications based on tab
  const activeMedications = medications.filter(med => med.status === 'active');
  const archivedMedications = medications.filter(med => med.status === 'archived');

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = (medication: Medication) => {
    // TODO: Open edit dialog
    console.log('Edit medication:', medication);
  };

  const handleArchive = (medicationId: string) => {
    // TODO: Archive medication
    console.log('Archive medication:', medicationId);
  };

  const handleAddAdherence = (medicationId: string) => {
    // TODO: Open adherence dialog
    console.log('Add adherence:', medicationId);
  };

  const handleViewHistory = (medicationId: string) => {
    // TODO: Open history dialog
    console.log('View history:', medicationId);
  };

  const handleAdd = () => {
    setAddDialogOpen(true);
  };

  const handleAddMedication = async (medicationData: MedicationFormData) => {
    try {
      await createMedicationMutation.mutateAsync({
        ...medicationData,
        patientId: patientId || '',
        workplaceId: '', // Will be set by backend from user context
      });

      setSnackbar({
        open: true,
        message: 'Medication added successfully',
        severity: 'success',
      });

      // Refresh medications list
      refetch();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to add medication',
        severity: 'error',
      });
      throw error; // Re-throw to let dialog handle it
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  if (isLoadingPatient || isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (patientError) {
    return (
      <Alert severity="error">
        Error loading patient data: {patientError.message}
      </Alert>
    );
  }

  if (!patientData) {
    return (
      <Alert severity="warning">
        Patient not found
      </Alert>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Medications - {patientData.firstName} {patientData.lastName}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label={`Current Medications (${activeMedications.length})`} />
          <Tab label={`Archived (${archivedMedications.length})`} />
          <Tab label="Analytics" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <MedicationList
          medications={activeMedications}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onAddAdherence={handleAddAdherence}
          onViewHistory={handleViewHistory}
          onAdd={handleAdd}
        />
      )}

      {tabValue === 1 && (
        <MedicationList
          medications={archivedMedications}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onAddAdherence={handleAddAdherence}
          onViewHistory={handleViewHistory}
          onAdd={handleAdd}
          isArchived={true}
        />
      )}

      {tabValue === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Medication Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Analytics functionality will be implemented here.
          </Typography>
        </Box>
      )}

      {tabValue === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Medication Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Settings functionality will be implemented here.
          </Typography>
        </Box>
      )}

      {/* Add Medication Dialog */}
      <AddMedicationDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddMedication}
        patientId={patientId || ''}
        existingMedications={activeMedications.map((med) => ({
          name: med.name,
          rxcui: undefined, // TODO: Add rxcui to medication model
        }))}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PatientMedicationsPage;