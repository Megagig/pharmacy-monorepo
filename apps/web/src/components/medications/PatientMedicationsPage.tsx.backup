import * as React from 'react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  FormHelperText,
  FormControlLabel,
  Switch,
  Alert,
  AlertTitle,
  Avatar,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  useAdherenceLogs,
  useMedicationsByPatient,
  useCreateMedication,
  useUpdateMedication,
  useArchiveMedication,
  useLogAdherence,
  useAdherenceAnalytics,
  usePrescriptionPatternAnalytics,
  useInteractionAnalytics,
  usePatientMedicationSummary,
} from '../../queries/medicationManagementQueries';
import { usePatient } from '../../queries/usePatients';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import MedicationSettingsPanel from './MedicationSettingsPanel';
import ModernMedicationSettings from './ModernMedicationSettings';
import EnhancedMedicationAnalytics from './EnhancedMedicationAnalytics';

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

interface MedicationData {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string | Date | undefined;
  endDate: string | Date | undefined;
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

interface MedicationFormValues {
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: Date | null;
  endDate: Date | null;
  indication: string;
  prescriber: string;
  cost: number | string; // Cost price in Naira (string for form handling)
  sellingPrice: number | string; // Selling price in Naira (string for form handling)
  allergyCheck: {
    status: boolean;
    details: string;
  };
  status: 'active' | 'archived' | 'cancelled';
  reminders?: MedicationReminder[];
}

interface MedicationReminder {
  id?: string;
  time: string; // format: HH:MM
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  enabled: boolean;
  notes?: string;
}

interface MedicationListProps {
  medications: (Medication | MedicationData)[];
  onEdit: (medication: Medication | MedicationData) => void;
  onArchive: (medicationId: string) => void;
  onAddAdherence: (medicationId: string) => void;
  onViewHistory: (medicationId: string) => void;
  isArchived?: boolean;
  showStatus?: boolean;
}

interface AdherenceRecord {
  id: string;
  medicationId: string;
  refillDate: string | Date;
  adherenceScore: number;
  pillCount: number;
  notes: string;
  createdAt: string | Date;
}

// Import types from services
import {
  AdherenceLogData,
  MedicationCreateData,
} from '../../services/medicationManagementService';

const initialFormValues: MedicationFormValues = {
  name: '',
  dosage: '',
  frequency: '',
  route: 'oral',
  startDate: new Date(),
  endDate: null,
  indication: '',
  prescriber: '',
  cost: '', // Empty string for optional cost
  sellingPrice: '', // Empty string for optional selling price
  allergyCheck: {
    status: false,
    details: '',
  },
  status: 'active',
};

const routeOptions = [
  { value: 'oral', label: 'Oral' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'injection', label: 'Injection' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'vaginal', label: 'Vaginal' },
  { value: 'ophthalmic', label: 'Ophthalmic' },
  { value: 'otic', label: 'Otic' },
  { value: 'nasal', label: 'Nasal' },
  { value: 'transdermal', label: 'Transdermal' },
  { value: 'other', label: 'Other' },
];

const frequencyOptions = [
  { value: 'once daily', label: 'Once Daily' },
  { value: 'twice daily', label: 'Twice Daily' },
  { value: 'three times daily', label: 'Three Times Daily' },
  { value: 'four times daily', label: 'Four Times Daily' },
  { value: 'every morning', label: 'Every Morning' },
  { value: 'every night', label: 'Every Night' },
  { value: 'as needed', label: 'As Needed (PRN)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'other', label: 'Other' },
];

interface PatientMedicationsPageProps {
  patientId?: string;
}

interface AdherenceData {
  monthlyAdherence: {
    month: string;
    adherence: number;
  }[];
  averageAdherence: number;
  trendDirection: string;
  complianceDays: {
    day: string;
    count: number;
  }[];
}

interface PrescriptionData {
  medicationsByCategory: {
    category: string;
    count: number;
  }[];
  medicationsByRoute: {
    route: string;
    count: number;
  }[];
  prescriptionFrequency: {
    month: string;
    count: number;
  }[];
  topPrescribers: {
    prescriber: string;
    count: number;
  }[];
}

interface InteractionData {
  severityDistribution: {
    severity: string;
    count: number;
  }[];
  interactionTrends: {
    month: string;
    count: number;
  }[];
}

interface MedicationSummaryData {
  activeCount: number;
  archivedCount: number;
  cancelledCount: number;
  adherenceRate: number;
  interactionCount: number;
  mostCommonCategory: string;
  mostCommonRoute: string;
  lastUpdated: string;
}

const PatientMedicationsPage: React.FC<PatientMedicationsPageProps> = ({
  patientId: propPatientId,
}) => {
  const { patientId: paramPatientId } = useParams<{ patientId: string }>();
  const patientId = propPatientId || paramPatientId;
  const [tabValue, setTabValue] = useState(0);
  const [medicationDialogOpen, setMedicationDialogOpen] = useState(false);
  const [medicationDialogTab, setMedicationDialogTab] = useState(0);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [adherenceDialogOpen, setAdherenceDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<MedicationFormValues>(initialFormValues);
  const [adherenceValues, setAdherenceValues] = useState({
    medicationId: '',
    refillDate: new Date(),
    adherenceScore: 100,
    pillCount: 0,
    notes: '',
  });
  const [currentMedicationId, setCurrentMedicationId] = useState<string | null>(
    null
  );
  const [selectedMedicationHistory, setSelectedMedicationHistory] = useState<
    AdherenceRecord[]
  >([]);
  const [interactionCheckEnabled, setInteractionCheckEnabled] = useState(true);
  const [interactions, setInteractions] = useState<string[]>([]);

  // Fetch patient data
  const {
    data: patientData,
    isLoading: isLoadingPatient,
    error: patientError,
  } = usePatient(patientId || '');

  // Fetch medications
  const { data: medicationsData, isLoading } = useMedicationsByPatient(
    patientId || ''
  );

  // Convert medication data to the expected format
  const medications: (Medication | MedicationData)[] = React.useMemo(() => {
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
  const { data: adherenceLogs } = useAdherenceLogs(patientId || '');

  // Use real mutations from React Query
  const createMutation = useCreateMedication();
  const updateMutation = useUpdateMedication();
  const archiveMutation = useArchiveMedication();
  const createAdherenceMutation = useLogAdherence();
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      if (parent === 'allergyCheck') {
        setFormValues({
          ...formValues,
          allergyCheck: {
            ...formValues.allergyCheck,
            [child]: value,
          },
        });
      }
    } else {
      setFormValues({
        ...formValues,
        [name]: value,
      });
    }
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name === 'allergyCheck.status') {
      setFormValues({
        ...formValues,
        allergyCheck: {
          ...formValues.allergyCheck,
          status: checked,
        },
      });
    } else if (name === 'interactionCheck') {
      setInteractionCheckEnabled(checked);
    }
  };

  // Handler for MUI Select components
  const handleStatusChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | {
          target: { value: string; name: string };
        }
  ) => {
    setFormValues({
      ...formValues,
      status: event.target.value as 'active' | 'archived' | 'cancelled',
    });
  };

  // Handler for MUI Select components
  const handleRouteChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | {
          target: { value: string; name: string };
        }
  ) => {
    setFormValues({
      ...formValues,
      route: event.target.value as string,
    });
  };

  // Handler for MUI Select components
  const handleFrequencyChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | {
          target: { value: string; name: string };
        }
  ) => {
    setFormValues({
      ...formValues,
      frequency: event.target.value as string,
    });
  };

  const handleDateChange = (name: string, date: Date | null) => {
    setFormValues({
      ...formValues,
      [name]: date,
    });
  };

  const handleAdherenceValueChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setAdherenceValues({
      ...adherenceValues,
      [name]:
        name === 'adherenceScore' || name === 'pillCount'
          ? parseInt(value, 10) || 0
          : value,
    });
  };

  const handleAdherenceDateChange = (date: Date | null) => {
    if (date) {
      setAdherenceValues({
        ...adherenceValues,
        refillDate: date,
      });
    }
  };

  // Handle reminder changes
  const handleAddReminder = () => {
    const newReminder: MedicationReminder = {
      time: '09:00',
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      enabled: true,
    };
    setReminders([...reminders, newReminder]);
  };

  const handleReminderChange = (
    index: number,
    field: keyof MedicationReminder,
    value:
      | string
      | boolean
      | string[]
      | ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[]
  ) => {
    const updatedReminders = [...reminders];
    if (field === 'days') {
      // Handle special case for days array
      updatedReminders[index] = {
        ...updatedReminders[index],
        [field]: value as (
          | 'mon'
          | 'tue'
          | 'wed'
          | 'thu'
          | 'fri'
          | 'sat'
          | 'sun'
        )[],
      };
    } else {
      updatedReminders[index] = {
        ...updatedReminders[index],
        [field]: value,
      };
    }
    setReminders(updatedReminders);
  };

  const handleDeleteReminder = (index: number) => {
    const updatedReminders = [...reminders];
    updatedReminders.splice(index, 1);
    setReminders(updatedReminders);
  };

  const handleOpenMedicationDialog = () => {
    setCurrentMedicationId(null);
    setFormValues(initialFormValues);
    setReminders([]);
    setMedicationDialogTab(0);
    setMedicationDialogOpen(true);
  };

  const handleOpenEditMedicationDialog = (
    medication: Medication | MedicationData
  ) => {
    setCurrentMedicationId(medication.id);
    setFormValues({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      route: medication.route,
      startDate: medication.startDate ? new Date(medication.startDate) : null,
      endDate: medication.endDate ? new Date(medication.endDate) : null,
      indication: medication.indication,
      prescriber: medication.prescriber,
      cost: medication.cost?.toString() || '',
      sellingPrice: medication.sellingPrice?.toString() || '',
      allergyCheck: medication.allergyCheck,
      status: medication.status,
      reminders: medication.reminders || [],
    });

    // Set reminders if they exist
    setReminders(medication.reminders || []);

    setMedicationDialogTab(0);
    setMedicationDialogOpen(true);
  };

  const handleOpenAdherenceDialog = (medicationId: string) => {
    setAdherenceValues({
      ...adherenceValues,
      medicationId,
    });
    setAdherenceDialogOpen(true);
  };

  const handleOpenHistoryDialog = (medicationId: string) => {
    if (adherenceLogs) {
      const filteredLogs = adherenceLogs.filter(
        (log) => log.medicationId === medicationId
      );
      // Convert AdherenceLogData to AdherenceRecord format
      setSelectedMedicationHistory(
        filteredLogs.map((log: AdherenceLogData) => ({
          id: log._id,
          medicationId: log.medicationId,
          refillDate: log.refillDate,
          adherenceScore: log.adherenceScore,
          pillCount: log.pillCount ?? 0, // Provide default value for optional field
          notes: log.notes ?? '', // Provide default value for optional field
          createdAt: log.createdAt,
        }))
      );
      setHistoryDialogOpen(true);
    }
  };

  const handleOpenArchiveDialog = (medicationId: string) => {
    setCurrentMedicationId(medicationId);
    setArchiveDialogOpen(true);
  };

  const handleSubmitMedication = async () => {
    try {
      // Check for interactions if enabled
      if (interactionCheckEnabled && medications && medications.length > 0) {
        // This would be a real API call in production
        // For demo, we'll just simulate an interaction check
        // Map medications to their names
        const drugNames = medications.map((med) => med.name);
        if (
          !currentMedicationId &&
          drugNames.includes('Warfarin') &&
          formValues.name.includes('Aspirin')
        ) {
          setInteractions([
            'Potential interaction detected: Warfarin + Aspirin may increase bleeding risk',
          ]);
          return; // Prevent submission if interactions found
        }
      }

      // Include reminders in the submission and convert cost/sellingPrice to numbers
      const submissionData = {
        ...formValues,
        startDate: formValues.startDate ? formValues.startDate : undefined,
        endDate: formValues.endDate ? formValues.endDate : undefined,
        cost: formValues.cost
          ? parseFloat(formValues.cost as string)
          : undefined,
        sellingPrice: formValues.sellingPrice
          ? parseFloat(formValues.sellingPrice as string)
          : undefined,
        reminders: reminders,
      };

      if (currentMedicationId) {
        // Update existing medication
        await updateMutation.mutateAsync({
          id: currentMedicationId,
          data: submissionData as Partial<MedicationData>,
        });
      } else {
        // Create new medication
        const createData = {
          ...submissionData,
          patientId,
        };
        await createMutation.mutateAsync(createData as MedicationCreateData);
      }

      setMedicationDialogOpen(false);
      setFormValues(initialFormValues);
      setInteractions([]);
      setCurrentMedicationId(null);
    } catch (error) {
      console.error('Error saving medication:', error);
    }
  };

  const handleSubmitAdherence = async () => {
    try {
      await createAdherenceMutation.mutateAsync({
        ...adherenceValues,
        medicationId: adherenceValues.medicationId || '',
        patientId: patientId || '',
        adherenceScore: adherenceValues.adherenceScore || 100,
      });
      setAdherenceDialogOpen(false);
      setAdherenceValues({
        medicationId: '',
        refillDate: new Date(),
        adherenceScore: 100,
        pillCount: 0,
        notes: '',
      });
    } catch (error) {
      console.error('Error saving adherence record:', error);
    }
  };

  const handleArchiveMedication = async () => {
    if (!currentMedicationId) return;

    try {
      await archiveMutation.mutateAsync({
        id: currentMedicationId,
        reason: 'Medication archived by user',
      });
      setArchiveDialogOpen(false);
      setCurrentMedicationId(null);
    } catch (error) {
      console.error('Error archiving medication:', error);
    }
  };

  if (!patientId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>No Patient Selected</AlertTitle>
          Please select a patient to manage medications.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Filter medications by status
  const activeMedications =
    medications?.filter((med) => med.status === 'active') || [];
  const archivedMedications =
    medications?.filter((med) => med.status === 'archived') || [];
  const cancelledMedications =
    medications?.filter((med) => med.status === 'cancelled') || [];

  // Overall adherence calculation (simplified for demo)
  const calculateOverallAdherence = (): number => {
    if (!adherenceLogs || adherenceLogs.length === 0) return 0;

    const totalScore = adherenceLogs.reduce(
      (sum, log) => sum + log.adherenceScore,
      0
    );
    return Math.round(totalScore / adherenceLogs.length);
  };

  const overallAdherence = calculateOverallAdherence();

  return (
    <Box sx={{ p: 2 }}>
      {/* Patient Information Card */}
      {isLoadingPatient ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CircularProgress />
        </Box>
      ) : patientError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading patient information. Please try refreshing the page.
        </Alert>
      ) : patientData?.data?.patient ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: 'primary.light',
            color: 'primary.contrastText',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 48,
                height: 48,
                mr: 2,
              }}
            >
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                {patientData.data.patient.firstName}{' '}
                {patientData.data.patient.lastName}
                {patientData.data.patient.otherNames
                  ? ` ${patientData.data.patient.otherNames}`
                  : ''}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 0.5 }}>
                <Typography variant="body2">
                  <strong>MRN:</strong>{' '}
                  {patientData.data.patient.mrn || patientData.data.patient._id}
                </Typography>
                <Typography variant="body2">
                  <strong>DOB:</strong>{' '}
                  {patientData.data.patient.dob
                    ? new Date(
                        patientData.data.patient.dob
                      ).toLocaleDateString()
                    : 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Gender:</strong>{' '}
                  {patientData.data.patient.gender || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Contact:</strong>{' '}
                  {patientData.data.patient.phone ||
                    patientData.data.patient.email ||
                    'None'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1">
          Medication Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenMedicationDialog}
        >
          Add Medication
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Adherence Chart */}
        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                Average Adherence Score
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={overallAdherence}
                  size={80}
                  thickness={5}
                  sx={{
                    color:
                      overallAdherence > 80
                        ? 'success.main'
                        : overallAdherence > 50
                        ? 'warning.main'
                        : 'error.main',
                  }}
                />
                <Typography
                  variant="h4"
                  sx={{ ml: 2 }}
                  color={
                    overallAdherence > 80
                      ? 'success.main'
                      : overallAdherence > 50
                      ? 'warning.main'
                      : 'error.main'
                  }
                >
                  {overallAdherence}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                Active Medications
              </Typography>
              <Typography variant="h4">{activeMedications.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                {archivedMedications.length} archived
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                Last Adherence Check
              </Typography>
              <Typography variant="h6">
                {adherenceLogs && adherenceLogs.length > 0
                  ? new Date(
                      adherenceLogs[adherenceLogs.length - 1].createdAt
                    ).toLocaleDateString()
                  : 'No records'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Active Medications" />
            <Tab label="Archived" />
            <Tab label="Cancelled" />
            <Tab label="Analytics" />
            <Tab label="Settings" />
          </Tabs>
        </Box>

        {/* Active Medications */}
        {tabValue === 0 && (
          <Box sx={{ p: 2 }}>
            {activeMedications.length === 0 ? (
              <Typography variant="body1" sx={{ py: 2 }}>
                No active medications found. Click "Add Medication" to get
                started.
              </Typography>
            ) : (
              <MedicationList
                medications={activeMedications}
                onEdit={handleOpenEditMedicationDialog}
                onArchive={handleOpenArchiveDialog}
                onAddAdherence={handleOpenAdherenceDialog}
                onViewHistory={handleOpenHistoryDialog}
              />
            )}
          </Box>
        )}

        {/* Archived Medications */}
        {tabValue === 1 && (
          <Box sx={{ p: 2 }}>
            {archivedMedications.length === 0 ? (
              <Typography variant="body1" sx={{ py: 2 }}>
                No archived medications found.
              </Typography>
            ) : (
              <MedicationList
                medications={archivedMedications}
                onEdit={handleOpenEditMedicationDialog}
                onArchive={handleOpenArchiveDialog}
                onAddAdherence={handleOpenAdherenceDialog}
                onViewHistory={handleOpenHistoryDialog}
                isArchived={true}
              />
            )}
          </Box>
        )}

        {/* Cancelled Medications */}
        {tabValue === 2 && (
          <Box sx={{ p: 2 }}>
            {cancelledMedications.length === 0 ? (
              <Typography variant="body1" sx={{ py: 2 }}>
                No cancelled medications found.
              </Typography>
            ) : (
              <MedicationList
                medications={cancelledMedications}
                onEdit={handleOpenEditMedicationDialog}
                onArchive={handleOpenArchiveDialog}
                onAddAdherence={handleOpenAdherenceDialog}
                onViewHistory={handleOpenHistoryDialog}
                isArchived={true}
              />
            )}
          </Box>
        )}

        {/* Analytics Tab */}
        {tabValue === 3 && (
          <EnhancedMedicationAnalytics patientId={patientId} />
        )}

        {/* Settings Tab */}
        {tabValue === 4 && (
          <ModernMedicationSettings patientId={patientId} />
        )}
      </Paper>

      {/* Medication Dialog */}
      <Dialog
        open={medicationDialogOpen}
        onClose={() => setMedicationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentMedicationId ? 'Edit Medication' : 'Add New Medication'}
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={medicationDialogTab}
            onChange={(_, newValue) => setMedicationDialogTab(newValue)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Medication Details" />
            <Tab label="Reminders & Schedule" />
          </Tabs>

          {medicationDialogTab === 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <TextField
                  name="name"
                  label="Medication Name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <TextField
                  name="dosage"
                  label="Dosage"
                  value={formValues.dosage}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <FormControl fullWidth>
                  <InputLabel id="frequency-label">Frequency</InputLabel>
                  <Select
                    labelId="frequency-label"
                    id="frequency"
                    name="frequency"
                    value={formValues.frequency}
                    onChange={handleFrequencyChange}
                    label="Frequency"
                    required
                  >
                    {frequencyOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <FormControl fullWidth>
                  <InputLabel id="route-label">Route</InputLabel>
                  <Select
                    labelId="route-label"
                    id="route"
                    name="route"
                    value={formValues.route}
                    onChange={handleRouteChange}
                    label="Route"
                    required
                  >
                    {routeOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Start Date"
                    value={
                      formValues.startDate ? dayjs(formValues.startDate) : null
                    }
                    onChange={(date) =>
                      handleDateChange(
                        'startDate',
                        date ? new Date(date.toString()) : null
                      )
                    }
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="End Date (Optional)"
                    value={
                      formValues.endDate ? dayjs(formValues.endDate) : null
                    }
                    onChange={(date) =>
                      handleDateChange(
                        'endDate',
                        date ? new Date(date.toString()) : null
                      )
                    }
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid sx={{ gridColumn: 'span 12' }}>
                <TextField
                  name="indication"
                  label="Indication"
                  value={formValues.indication}
                  onChange={handleInputChange}
                  fullWidth
                />
              </Grid>
              <Grid sx={{ gridColumn: 'span 12' }}>
                <TextField
                  name="prescriber"
                  label="Prescriber"
                  value={formValues.prescriber}
                  onChange={handleInputChange}
                  fullWidth
                />
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <TextField
                  name="cost"
                  label="Cost Price (₦)"
                  value={formValues.cost}
                  onChange={handleInputChange}
                  fullWidth
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  helperText="Optional - Cost price in Naira"
                />
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
                <TextField
                  name="sellingPrice"
                  label="Selling Price (₦)"
                  value={formValues.sellingPrice}
                  onChange={handleInputChange}
                  fullWidth
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  helperText="Optional - Selling price in Naira"
                />
              </Grid>
              <Grid sx={{ gridColumn: 'span 12' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formValues.allergyCheck.status}
                      onChange={handleSwitchChange}
                      name="allergyCheck.status"
                      color="primary"
                    />
                  }
                  label="Patient has allergies related to this medication"
                />
                {formValues.allergyCheck.status && (
                  <TextField
                    name="allergyCheck.details"
                    label="Allergy Details"
                    value={formValues.allergyCheck.details}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                  />
                )}
              </Grid>

              {/* Interaction check toggle */}
              <Grid sx={{ gridColumn: 'span 12' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={interactionCheckEnabled}
                      onChange={handleSwitchChange}
                      name="interactionCheck"
                      color="primary"
                    />
                  }
                  label="Check for drug interactions before saving"
                />
              </Grid>

              {/* Status field for edit mode */}
              {currentMedicationId && (
                <Grid sx={{ gridColumn: 'span 12' }}>
                  <FormControl fullWidth>
                    <InputLabel id="status-label">Status</InputLabel>
                    <Select
                      labelId="status-label"
                      id="status"
                      name="status"
                      value={formValues.status}
                      onChange={handleStatusChange}
                      label="Status"
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Show interactions if any */}
              {interactions.length > 0 && (
                <Grid sx={{ gridColumn: 'span 12' }}>
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <AlertTitle>Potential Interactions Detected</AlertTitle>
                    <ul>
                      {interactions.map((interaction, index) => (
                        <li key={index}>{interaction}</li>
                      ))}
                    </ul>
                    <Box sx={{ mt: 1 }}>
                      Override and continue? Check with prescriber first.
                    </Box>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}

          {medicationDialogTab === 1 && (
            <Box sx={{ p: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 2,
                  alignItems: 'center',
                }}
              >
                <Typography variant="h6">Medication Reminders</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddReminder}
                >
                  Add Reminder
                </Button>
              </Box>

              {reminders.length === 0 ? (
                <Alert severity="info" sx={{ my: 2 }}>
                  No reminders set for this medication. Add a reminder to help
                  the patient stay on schedule.
                </Alert>
              ) : (
                reminders.map((reminder, index) => (
                  <Paper
                    key={index}
                    sx={{
                      p: 2,
                      mb: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid
                        sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}
                      >
                        <TextField
                          label="Time"
                          type="time"
                          fullWidth
                          value={reminder.time}
                          onChange={(e) =>
                            handleReminderChange(index, 'time', e.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid
                        sx={{ gridColumn: { xs: 'span 12', sm: 'span 5' } }}
                      >
                        <FormControl fullWidth>
                          <InputLabel id={`days-label-${index}`}>
                            Days
                          </InputLabel>
                          <Select
                            labelId={`days-label-${index}`}
                            multiple
                            value={reminder.days}
                            onChange={(e) =>
                              handleReminderChange(
                                index,
                                'days',
                                e.target.value as (
                                  | 'mon'
                                  | 'tue'
                                  | 'wed'
                                  | 'thu'
                                  | 'fri'
                                  | 'sat'
                                  | 'sun'
                                )[]
                              )
                            }
                            renderValue={(selected) =>
                              selected
                                .map((day) => day.toUpperCase())
                                .join(', ')
                            }
                          >
                            <MenuItem value="mon">Monday</MenuItem>
                            <MenuItem value="tue">Tuesday</MenuItem>
                            <MenuItem value="wed">Wednesday</MenuItem>
                            <MenuItem value="thu">Thursday</MenuItem>
                            <MenuItem value="fri">Friday</MenuItem>
                            <MenuItem value="sat">Saturday</MenuItem>
                            <MenuItem value="sun">Sunday</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3' } }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={reminder.enabled}
                              onChange={(e) =>
                                handleReminderChange(
                                  index,
                                  'enabled',
                                  e.target.checked
                                )
                              }
                            />
                          }
                          label="Enabled"
                        />
                      </Grid>
                      <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 1' } }}>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteReminder(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                      <Grid sx={{ gridColumn: 'span 12' }}>
                        <TextField
                          label="Notes"
                          fullWidth
                          placeholder="Additional instructions for this reminder..."
                          value={reminder.notes || ''}
                          onChange={(e) =>
                            handleReminderChange(index, 'notes', e.target.value)
                          }
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                ))
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMedicationDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmitMedication}
            variant="contained"
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adherence Dialog */}
      <Dialog
        open={adherenceDialogOpen}
        onClose={() => setAdherenceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Medication Adherence</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid sx={{ gridColumn: 'span 12' }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Refill Date"
                  value={dayjs(adherenceValues.refillDate)}
                  onChange={(date) =>
                    handleAdherenceDateChange(
                      date ? new Date(date.toString()) : null
                    )
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                name="adherenceScore"
                label="Adherence Score (%)"
                type="number"
                value={adherenceValues.adherenceScore}
                onChange={handleAdherenceValueChange}
                fullWidth
                inputProps={{ min: 0, max: 100 }}
              />
              <FormHelperText>
                0% = No adherence, 100% = Perfect adherence
              </FormHelperText>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                name="pillCount"
                label="Remaining Pill Count"
                type="number"
                value={adherenceValues.pillCount}
                onChange={handleAdherenceValueChange}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                name="notes"
                label="Notes"
                value={adherenceValues.notes}
                onChange={handleAdherenceValueChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdherenceDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmitAdherence}
            variant="contained"
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Medication History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Medication Adherence History</DialogTitle>
        <DialogContent>
          {selectedMedicationHistory.length === 0 ? (
            <Typography>
              No adherence records found for this medication.
            </Typography>
          ) : (
            <Box>
              {selectedMedicationHistory.map((record) => (
                <Paper key={record.id} sx={{ p: 2, my: 1 }}>
                  <Typography variant="subtitle1">
                    {new Date(record.refillDate).toLocaleDateString()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      Adherence Score:
                    </Typography>
                    <Chip
                      icon={
                        record.adherenceScore > 80 ? (
                          <CheckCircleIcon />
                        ) : record.adherenceScore > 50 ? (
                          <WarningIcon />
                        ) : (
                          <WarningIcon color="error" />
                        )
                      }
                      label={`${record.adherenceScore}%`}
                      color={
                        record.adherenceScore > 80
                          ? 'success'
                          : record.adherenceScore > 50
                          ? 'warning'
                          : 'error'
                      }
                    />
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Pill Count: {record.pillCount}
                  </Typography>
                  {record.notes && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Notes: {record.notes}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
      >
        <DialogTitle>Archive Medication</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to archive this medication? This will mark it
            as no longer active, but the record will be preserved for historical
            purposes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleArchiveMedication}
            variant="contained"
            color="primary"
          >
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Medication List Component
const MedicationList: React.FC<MedicationListProps> = ({
  medications,
  onEdit,
  onArchive,
  onAddAdherence,
  onViewHistory,
  isArchived = false,
  showStatus = false,
}) => {
  return (
    <Box>
      {medications.map((medication) => (
        <Paper key={medication.id} sx={{ p: 2, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Box>
              <Typography variant="h6" component="div">
                {medication.name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {medication.dosage} - {medication.frequency} ({medication.route}
                )
              </Typography>
              <Typography variant="body2">
                Start Date:{' '}
                {medication.startDate
                  ? new Date(medication.startDate).toLocaleDateString()
                  : 'Not specified'}
              </Typography>
              {medication.endDate && (
                <Typography variant="body2">
                  End Date: {new Date(medication.endDate).toLocaleDateString()}
                </Typography>
              )}

              {/* Display reminders summary if they exist */}
              {medication.reminders && medication.reminders.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon
                    color="info"
                    fontSize="small"
                    sx={{ mr: 0.5 }}
                  />
                  <Typography variant="body2" color="info.main">
                    {medication.reminders!.length} Reminder
                    {medication.reminders!.length > 1 ? 's' : ''} set
                  </Typography>
                </Box>
              )}

              {showStatus && (
                <Chip
                  label={medication.status.toUpperCase()}
                  color={
                    medication.status === 'active'
                      ? 'success'
                      : medication.status === 'archived'
                      ? 'default'
                      : 'error'
                  }
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
              {medication.allergyCheck.status && (
                <Chip
                  icon={<WarningIcon />}
                  label="Allergy Alert"
                  color="warning"
                  size="small"
                  sx={{ mt: 1, ml: showStatus ? 1 : 0 }}
                />
              )}
            </Box>
            <Box>
              <Button
                startIcon={<EditIcon />}
                onClick={() => onEdit(medication)}
                size="small"
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              {!isArchived && (
                <>
                  <Button
                    startIcon={<HistoryIcon />}
                    onClick={() => onViewHistory(medication.id)}
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    History
                  </Button>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => onAddAdherence(medication.id)}
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Add Adherence
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => onArchive(medication.id)}
                    size="small"
                    color="error"
                  >
                    Archive
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

// Analytics Components
interface MedicationAnalyticsPanelProps {
  patientId: string;
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
];

const MedicationAnalyticsPanel: React.FC<MedicationAnalyticsPanelProps> = ({
  patientId,
}) => {
  const [adherencePeriod, setAdherencePeriod] = useState<string>('6months');
  const [activeTab, setActiveTab] = useState<number>(0);

  // Fetch analytics data
  const { data: adherenceData, isLoading: isLoadingAdherence } =
    useAdherenceAnalytics(patientId, adherencePeriod);

  const { data: prescriptionData, isLoading: isLoadingPrescription } =
    usePrescriptionPatternAnalytics(patientId);

  const { data: interactionData, isLoading: isLoadingInteraction } =
    useInteractionAnalytics(patientId);

  const { data: summaryData, isLoading: isLoadingSummary } =
    usePatientMedicationSummary(patientId);

  const handleAdherencePeriodChange = (event: SelectChangeEvent) => {
    setAdherencePeriod(event.target.value);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (
    isLoadingAdherence ||
    isLoadingPrescription ||
    isLoadingInteraction ||
    isLoadingSummary
  ) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Until real API is implemented, provide mock data for visualization
  // In a real implementation, this would use the fetched data
  const mockAdherenceData: AdherenceData = adherenceData || {
    monthlyAdherence: [
      { month: 'Jan', adherence: 75 },
      { month: 'Feb', adherence: 82 },
      { month: 'Mar', adherence: 78 },
      { month: 'Apr', adherence: 85 },
      { month: 'May', adherence: 90 },
      { month: 'Jun', adherence: 88 },
    ],
    averageAdherence: 83,
    trendDirection: 'up',
    complianceDays: [
      { day: 'Mon', count: 24 },
      { day: 'Tue', count: 26 },
      { day: 'Wed', count: 28 },
      { day: 'Thu', count: 25 },
      { day: 'Fri', count: 22 },
      { day: 'Sat', count: 18 },
      { day: 'Sun', count: 20 },
    ],
  };

  const mockPrescriptionData: PrescriptionData = prescriptionData || {
    medicationsByCategory: [
      { category: 'Cardiovascular', count: 5 },
      { category: 'Analgesic', count: 3 },
      { category: 'Antibiotic', count: 2 },
      { category: 'Respiratory', count: 4 },
      { category: 'CNS', count: 1 },
    ],
    medicationsByRoute: [
      { route: 'Oral', count: 10 },
      { route: 'Injection', count: 2 },
      { route: 'Topical', count: 1 },
      { route: 'Inhaled', count: 2 },
    ],
    prescriptionFrequency: [
      { month: 'Jan', count: 3 },
      { month: 'Feb', count: 2 },
      { month: 'Mar', count: 4 },
      { month: 'Apr', count: 1 },
      { month: 'May', count: 5 },
      { month: 'Jun', count: 3 },
    ],
    topPrescribers: [
      { prescriber: 'Dr. Smith', count: 8 },
      { prescriber: 'Dr. Johnson', count: 4 },
      { prescriber: 'Dr. Williams', count: 3 },
    ],
  };

  const mockInteractionData: InteractionData = interactionData || {
    severityDistribution: [
      { severity: 'Minor', count: 7 },
      { severity: 'Moderate', count: 4 },
      { severity: 'Severe', count: 1 },
    ],
    interactionTrends: [
      { month: 'Jan', count: 2 },
      { month: 'Feb', count: 3 },
      { month: 'Mar', count: 1 },
      { month: 'Apr', count: 4 },
      { month: 'May', count: 2 },
      { month: 'Jun', count: 0 },
    ],
  };

  const mockSummaryData: MedicationSummaryData = summaryData || {
    activeCount: 8,
    archivedCount: 3,
    cancelledCount: 1,
    adherenceRate: 85,
    interactionCount: 12,
    mostCommonCategory: 'Cardiovascular',
    mostCommonRoute: 'Oral',
    lastUpdated: new Date().toISOString(),
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        Medication Analytics Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3' } }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Active Medications
              </Typography>
              <Typography variant="h4">
                {mockSummaryData.activeCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3' } }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Avg. Adherence
              </Typography>
              <Typography variant="h4">
                {mockSummaryData.adherenceRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3' } }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Potential Interactions
              </Typography>
              <Typography variant="h4">
                {mockSummaryData.interactionCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3' } }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Most Common
              </Typography>
              <Typography variant="h6">
                {mockSummaryData.mostCommonCategory}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Adherence Trends" />
          <Tab label="Prescription Patterns" />
          <Tab label="Interactions" />
        </Tabs>
      </Box>

      {/* Adherence Trends Tab */}
      {activeTab === 0 && (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6">Medication Adherence Over Time</Typography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="adherence-period-label">Period</InputLabel>
              <Select
                labelId="adherence-period-label"
                value={adherencePeriod}
                label="Period"
                onChange={handleAdherencePeriodChange}
              >
                <MenuItem value="3months">Last 3 Months</MenuItem>
                <MenuItem value="6months">Last 6 Months</MenuItem>
                <MenuItem value="1year">Last Year</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Monthly Adherence Rates
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockAdherenceData.monthlyAdherence}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="adherence"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                  name="Adherence %"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Medication Compliance by Day of Week
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockAdherenceData.complianceDays}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Compliant Days" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
      )}

      {/* Prescription Patterns Tab */}
      {activeTab === 1 && (
        <Box sx={{ p: 2 }}>
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Medications by Category
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockPrescriptionData.medicationsByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="category"
                      label={({ name, percent }) =>
                        `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`
                      }
                    >
                      {mockPrescriptionData.medicationsByCategory.map(
                        (
                          _entry: { category: string; count: number },
                          index: number
                        ) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Medications by Route
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockPrescriptionData.medicationsByRoute}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="route"
                      label={({ name, percent }) =>
                        `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`
                      }
                    >
                      {mockPrescriptionData.medicationsByRoute.map(
                        (
                          _entry: { route: string; count: number },
                          index: number
                        ) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: 'span 12' }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Prescription Frequency Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockPrescriptionData.prescriptionFrequency}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="count"
                      fill="#8884d8"
                      name="New Prescriptions"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Interactions Tab */}
      {activeTab === 2 && (
        <Box sx={{ p: 2 }}>
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Interaction Severity Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockInteractionData.severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="severity"
                      label={({ name, percent }) =>
                        `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`
                      }
                    >
                      {mockInteractionData.severityDistribution.map(
                        (
                          entry: { severity: string; count: number },
                          index: number
                        ) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.severity === 'Severe'
                                ? '#ff6b6b'
                                : entry.severity === 'Moderate'
                                ? '#feca57'
                                : '#1dd1a1'
                            }
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Interaction Trends Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockInteractionData.interactionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ff6b6b"
                      activeDot={{ r: 8 }}
                      name="Interactions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default PatientMedicationsPage;
