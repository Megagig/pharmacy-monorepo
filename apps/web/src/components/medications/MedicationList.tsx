import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';

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

interface MedicationListProps {
  medications: Medication[];
  onEdit: (medication: Medication) => void;
  onArchive: (medicationId: string) => void;
  onAddAdherence: (medicationId: string) => void;
  onViewHistory: (medicationId: string) => void;
  onAdd: () => void;
  isArchived?: boolean;
  showStatus?: boolean;
}

const MedicationList: React.FC<MedicationListProps> = ({
  medications,
  onEdit,
  onArchive,
  onAddAdherence,
  onViewHistory,
  onAdd,
  isArchived = false,
  showStatus = true,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'archived':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          {isArchived ? 'Archived Medications' : 'Current Medications'}
        </Typography>
        {!isArchived && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAdd}
            sx={{ mb: 2 }}
          >
            Add Medication
          </Button>
        )}
      </Box>

      {medications.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              {isArchived ? 'No archived medications found.' : 'No current medications found.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {medications.map((medication) => (
            <Grid item xs={12} md={6} lg={4} key={medication.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6">{medication.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {medication.dosage} • {medication.frequency}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Route: {medication.route}
                      </Typography>
                    </Box>
                    {showStatus && (
                      <Chip
                        label={medication.status}
                        color={getStatusColor(medication.status) as any}
                        size="small"
                      />
                    )}
                  </Box>

                  {medication.indication && (
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      <strong>Indication:</strong> {medication.indication}
                    </Typography>
                  )}

                  {medication.prescriber && (
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      <strong>Prescriber:</strong> {medication.prescriber}
                    </Typography>
                  )}

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Start Date:</strong>{' '}
                      {medication.startDate ? dayjs(medication.startDate).format('MMM DD, YYYY') : 'Not set'}
                    </Typography>
                    {medication.endDate && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>End Date:</strong> {dayjs(medication.endDate).format('MMM DD, YYYY')}
                      </Typography>
                    )}
                  </Box>

                  <Box display="flex" alignItems="center" mb={2}>
                    {medication.allergyCheck.status ? (
                      <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                    ) : (
                      <WarningIcon color="warning" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="body2">
                      Allergy Check: {medication.allergyCheck.status ? 'Passed' : 'Warning'}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <IconButton size="small" onClick={() => onEdit(medication)} title="Edit">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => onViewHistory(medication.id)} title="View History">
                        <HistoryIcon />
                      </IconButton>
                      {!isArchived && (
                        <IconButton size="small" onClick={() => onAddAdherence(medication.id)} title="Log Adherence">
                          <AddIcon />
                        </IconButton>
                      )}
                    </Box>
                    {!isArchived && (
                      <IconButton
                        size="small"
                        onClick={() => onArchive(medication.id)}
                        title="Archive"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default MedicationList;