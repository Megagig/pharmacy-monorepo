import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemSecondaryAction,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Paper,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ImportIcon from '@mui/icons-material/ImportExport';
import SearchIcon from '@mui/icons-material/Search';
import MedicationIcon from '@mui/icons-material/Medication';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FixedGrid from './common/FixedGrid';
import { useForm, Controller } from 'react-hook-form';

// Custom debounce implementation
const debounce = (func: (searchQuery: string) => void, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (searchQuery: string) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(searchQuery), wait);
  };
};

import { useMTRStore, MTRMedication } from '../stores/mtrStore';

// Form data interface for react-hook-form
interface MedicationFormData {
  drugName: string;
  genericName?: string;
  strength: {
    value: number;
    unit: string;
  };
  dosageForm: string;
  instructions: {
    dose: string;
    frequency: string;
    route: string;
    duration?: string;
  };
  category: 'prescribed' | 'otc' | 'herbal' | 'supplement';
  prescriber?: {
    name: string;
    license?: string;
    contact?: string;
  };
  startDate: Date;
  endDate?: Date;
  indication: string;
  adherenceScore?: number;
  notes?: string;
}
import { medicationService } from '../services/medicationService';
import { useResponsive } from '../hooks/useResponsive';
import { useSwipeGesture, useLongPress } from '../hooks/useGestures';
import { offlineStorage } from '../utils/offlineStorage';

// Constants
const MEDICATION_CATEGORIES = [
  { value: 'prescribed', label: 'Prescribed Medications', color: 'primary' },
  { value: 'otc', label: 'Over-the-Counter', color: 'secondary' },
  { value: 'herbal', label: 'Herbal/Traditional', color: 'success' },
  { value: 'supplement', label: 'Supplements/Vitamins', color: 'info' },
] as const;

const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Cream',
  'Ointment',
  'Drops',
  'Inhaler',
  'Patch',
  'Suppository',
  'Powder',
  'Solution',
  'Gel',
  'Lotion',
];

const STRENGTH_UNITS = [
  'mg',
  'g',
  'mcg',
  'ml',
  'IU',
  '%',
  'units',
  'mmol',
  'mEq',
];

const ROUTES = [
  'Oral',
  'Topical',
  'Intravenous',
  'Intramuscular',
  'Subcutaneous',
  'Inhalation',
  'Rectal',
  'Vaginal',
  'Ophthalmic',
  'Otic',
  'Nasal',
  'Sublingual',
  'Buccal',
];

const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed',
  'Weekly',
  'Monthly',
  'Other',
];

// Mock drug database for autocomplete
const MOCK_DRUGS = [
  {
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    commonStrengths: ['500mg', '1000mg'],
  },
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    commonStrengths: ['200mg', '400mg', '600mg'],
  },
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    commonStrengths: ['250mg', '500mg', '875mg'],
  },
  {
    name: 'Metformin',
    genericName: 'Metformin',
    commonStrengths: ['500mg', '850mg', '1000mg'],
  },
  {
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    commonStrengths: ['5mg', '10mg', '20mg'],
  },
  {
    name: 'Amlodipine',
    genericName: 'Amlodipine',
    commonStrengths: ['2.5mg', '5mg', '10mg'],
  },
  {
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    commonStrengths: ['20mg', '40mg'],
  },
  {
    name: 'Atorvastatin',
    genericName: 'Atorvastatin',
    commonStrengths: ['10mg', '20mg', '40mg', '80mg'],
  },
];

// Interfaces
interface MedicationHistoryProps {
  patientId: string;
  onMedicationsUpdate: (medications: MTRMedication[]) => void;
  onNext?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`medication-tabpanel-${index}`}
      aria-labelledby={`medication-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const MedicationHistory: React.FC<MedicationHistoryProps> = ({
  patientId,
  onMedicationsUpdate,
  onNext,
}) => {
  // Responsive hooks
  const { isMobile, getSpacing } = useResponsive();

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [editingMedication, setEditingMedication] =
    useState<MTRMedication | null>(null);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [drugSuggestions, setDrugSuggestions] = useState<typeof MOCK_DRUGS>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [showManualEntryButton, setShowManualEntryButton] = useState(false);
  const [expandedMedications, setExpandedMedications] = useState<Set<string>>(
    new Set()
  );
  const [importLoading, setImportLoading] = useState(false);
  const [swipedMedication, setSwipedMedication] = useState<string | null>(null);

  // Store
  const {
    medications,
    addMedication,
    updateMedication,
    removeMedication,
    importMedications,
    validateMedications,
    loading,
    errors,
    setLoading,
    setError,
    selectedPatient,
  } = useMTRStore();

  // Form for medication entry
  // Memoize default values to prevent form re-initialization
  const defaultFormValues = useMemo(
    (): MedicationFormData => ({
      drugName: '',
      genericName: '',
      strength: { value: 0, unit: 'mg' },
      dosageForm: '',
      instructions: {
        dose: '',
        frequency: '',
        route: 'Oral',
        duration: '',
      },
      category: 'prescribed',
      prescriber: {
        name: '',
        license: '',
        contact: '',
      },
      startDate: new Date(),
      endDate: undefined,
      indication: '',
      adherenceScore: 0,
      notes: '',
    }),
    []
  );

  // Memoize constants to prevent re-filtering on every render
  const memoizedDrugs = useMemo(() => MOCK_DRUGS, []);
  const memoizedCategories = useMemo(() => MEDICATION_CATEGORIES, []);

  const {
    control: medicationControl,
    handleSubmit: handleMedicationFormSubmit,
    watch: watchMedication,
    setValue: setMedicationValue,
    formState: { errors: medicationErrors },
    reset: resetMedicationForm,
  } = useForm<MedicationFormData>({
    mode: 'onChange',
    defaultValues: defaultFormValues,
  });

  const watchedCategory = watchMedication('category');

  // Debounced drug search - memoize the debounced function
  const debouncedDrugSearch = useMemo(
    () =>
      debounce((searchQuery: string) => {
        if (searchQuery.length >= 2) {
          const filtered = memoizedDrugs.filter(
            (drug) =>
              drug.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              drug.genericName.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setDrugSuggestions(filtered);
          // Show manual entry button if no results found and user has typed something
          setShowManualEntryButton(
            filtered.length === 0 && searchQuery.length >= 2
          );
        } else {
          setDrugSuggestions([]);
          setShowManualEntryButton(false);
        }
      }, 300),
    [memoizedDrugs]
  );

  // Effects
  useEffect(() => {
    debouncedDrugSearch(drugSearchQuery);
  }, [drugSearchQuery, debouncedDrugSearch]);

  // Memoize the medications update to prevent infinite re-renders
  const memoizedMedications = useMemo(() => medications, [medications]);

  useEffect(() => {
    onMedicationsUpdate(memoizedMedications);
  }, [memoizedMedications, onMedicationsUpdate]);

  // Check for duplicates when medications change
  useEffect(() => {
    const checkDuplicates = () => {
      const warnings: string[] = [];
      const drugNames = new Set<string>();

      medications.forEach((med, index) => {
        const normalizedName = med.drugName.toLowerCase().trim();
        if (drugNames.has(normalizedName)) {
          warnings.push(`Duplicate medication detected: ${med.drugName}`);
        } else {
          drugNames.add(normalizedName);
        }

        // Check for therapeutic duplicates (simplified)
        const therapeuticClasses = {
          paracetamol: 'analgesic',
          acetaminophen: 'analgesic',
          ibuprofen: 'nsaid',
          diclofenac: 'nsaid',
          metformin: 'antidiabetic',
          glibenclamide: 'antidiabetic',
        };

        const currentClass =
          therapeuticClasses[normalizedName as keyof typeof therapeuticClasses];
        if (currentClass) {
          medications.forEach((otherMed, otherIndex) => {
            if (index !== otherIndex) {
              const otherClass =
                therapeuticClasses[
                  otherMed.drugName
                    .toLowerCase()
                    .trim() as keyof typeof therapeuticClasses
                ];
              if (currentClass === otherClass) {
                warnings.push(
                  `Potential therapeutic duplication: ${med.drugName} and ${otherMed.drugName}`
                );
              }
            }
          });
        }
      });

      setDuplicateWarnings([...new Set(warnings)]);
    };

    checkDuplicates();
  }, [medications]);

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddMedication = (
    category?: 'prescribed' | 'otc' | 'herbal' | 'supplement'
  ) => {
    resetMedicationForm();
    if (category) {
      setMedicationValue('category', category);
    }
    setEditingMedication(null);
    setIsManualEntry(false);
    setShowManualEntryButton(false);
    setDrugSearchQuery('');
    setShowMedicationModal(true);
  };

  const handleEditMedication = (medication: MTRMedication) => {
    setEditingMedication(medication);

    // Populate form with medication data
    setMedicationValue('drugName', medication.drugName);
    setMedicationValue('genericName', medication.genericName || '');
    setMedicationValue('strength', medication.strength);
    setMedicationValue('dosageForm', medication.dosageForm);
    setMedicationValue('instructions', medication.instructions);
    setMedicationValue('category', medication.category);
    setMedicationValue(
      'prescriber',
      medication.prescriber || { name: '', license: '', contact: '' }
    );
    setMedicationValue('startDate', new Date(medication.startDate));
    if (medication.endDate) {
      setMedicationValue('endDate', new Date(medication.endDate));
    }
    setMedicationValue('indication', medication.indication);
    setMedicationValue('adherenceScore', medication.adherenceScore);
    setMedicationValue('notes', medication.notes || '');

    // Set manual entry mode if medication was manually entered
    setIsManualEntry(medication.isManual || false);
    setDrugSearchQuery(medication.drugName);
    setShowManualEntryButton(false);

    setShowMedicationModal(true);
  };

  const handleDeleteMedication = (medicationId: string) => {
    if (window.confirm('Are you sure you want to delete this medication?')) {
      removeMedication(medicationId);
    }
  };

  const handleMedicationSubmit = useCallback(
    async (data: MedicationFormData) => {
      try {
        setLoading('saveMedication', true);
        setError('saveMedication', null);

        const medicationData: MTRMedication = {
          id: editingMedication?.id || undefined,
          drugName: data.drugName,
          genericName: data.genericName,
          strength: data.strength,
          dosageForm: data.dosageForm,
          category: data.category,
          indication: data.indication,
          startDate: data.startDate,
          endDate: data.endDate,
          adherenceScore: data.adherenceScore,
          notes: data.notes,
          isManual: isManualEntry, // Flag to indicate manual entry
          instructions: {
            dose: data.instructions.dose,
            frequency: data.instructions.frequency,
            route: data.instructions.route,
            duration: data.instructions.duration || '',
          },
          prescriber: data.prescriber
            ? {
                name: data.prescriber.name,
                license: data.prescriber.license || '',
                contact: data.prescriber.contact || '',
              }
            : undefined,
        };

        if (editingMedication) {
          updateMedication(editingMedication.id!, medicationData);
        } else {
          addMedication(medicationData);
        }

        // Save to offline storage for offline capability
        if (navigator.onLine === false) {
          await offlineStorage.saveMedication(medicationData);
          await offlineStorage.autoSaveDraft(
            'medication',
            medicationData,
            patientId
          );
        }

        setShowMedicationModal(false);
        resetMedicationForm();
        setEditingMedication(null);
        setIsManualEntry(false);
        setShowManualEntryButton(false);
        setDrugSearchQuery('');
      } catch (error) {
        setError(
          'saveMedication',
          error instanceof Error ? error.message : 'Failed to save medication'
        );
      } finally {
        setLoading('saveMedication', false);
      }
    },
    [
      editingMedication,
      addMedication,
      updateMedication,
      patientId,
      setLoading,
      setError,
      resetMedicationForm,
    ]
  );

  const handleImportMedications = async () => {
    try {
      setImportLoading(true);
      setError('importMedications', null);

      // Import from existing patient records
      await importMedications(patientId);

      // Also try to import from medication service
      const existingMeds = await medicationService.getMedicationsByPatient(
        patientId
      );

      if (existingMeds.success && existingMeds.data) {
        existingMeds.data.forEach((med) => {
          const mtrMedication: MTRMedication = {
            drugName: med.name,
            genericName: med.name, // Assuming name is generic
            strength: { value: parseFloat(med.dosage) || 0, unit: 'mg' },
            dosageForm: 'Tablet', // Default
            instructions: {
              dose: med.dosage,
              frequency: med.frequency,
              route: med.route,
              duration: med.duration,
            },
            category: 'prescribed',
            prescriber: {
              name: med.prescribedBy,
            },
            startDate: new Date(med.startDate),
            endDate: med.endDate ? new Date(med.endDate) : undefined,
            indication: med.instructions,
            notes: `Imported from existing records. Status: ${med.status}`,
          };

          addMedication(mtrMedication);
        });
      }
    } catch (error) {
      setError(
        'importMedications',
        error instanceof Error ? error.message : 'Failed to import medications'
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handleDrugSelect = (drug: (typeof MOCK_DRUGS)[0]) => {
    setMedicationValue('drugName', drug.name);
    setMedicationValue('genericName', drug.genericName);
    setDrugSearchQuery(drug.name);
    setIsManualEntry(false);
    setShowManualEntryButton(false);
  };

  const handleManualEntry = () => {
    setIsManualEntry(true);
    setShowManualEntryButton(false);
    setDrugSuggestions([]);
    // Clear the search query and set the drug name to what user typed
    setMedicationValue('drugName', drugSearchQuery);
    setMedicationValue('genericName', ''); // Clear generic name for manual entry
  };

  const handleBackToSearch = () => {
    setIsManualEntry(false);
    setDrugSearchQuery('');
    setMedicationValue('drugName', '');
    setMedicationValue('genericName', '');
  };

  const toggleMedicationExpansion = (medicationId: string) => {
    const newExpanded = new Set(expandedMedications);
    if (newExpanded.has(medicationId)) {
      newExpanded.delete(medicationId);
    } else {
      newExpanded.add(medicationId);
    }
    setExpandedMedications(newExpanded);
  };

  const getMedicationsByCategory = (category: string) => {
    return medications.filter((med) => med.category === category);
  };

  const getValidationErrors = () => {
    return validateMedications();
  };

  const canProceed = () => {
    return medications.length > 0 && getValidationErrors().length === 0;
  };

  // Swipe gesture for medication cards
  useSwipeGesture(
    (result) => {
      if (result.direction === 'left' && swipedMedication) {
        // Show delete confirmation on left swipe
        if (window.confirm('Delete this medication?')) {
          handleDeleteMedication(swipedMedication);
        }
        setSwipedMedication(null);
      } else if (result.direction === 'right' && swipedMedication) {
        // Show edit on right swipe
        const medication = medications.find((m) => m.id === swipedMedication);
        if (medication) {
          handleEditMedication(medication);
        }
        setSwipedMedication(null);
      }
    },
    { threshold: 100, preventScroll: false }
  );

  // Long press for medication options
  useLongPress(
    () => {
      if (swipedMedication) {
        toggleMedicationExpansion(swipedMedication);
      }
    },
    { delay: 500 }
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: getSpacing(1, 2, 3) }}>
        {/* Header */}
        <Box sx={{ mb: getSpacing(2, 3, 4) }}>
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Medication History Collection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Document all medications including prescribed, over-the-counter,
            herbal, and supplements
          </Typography>
        </Box>

        {/* Patient Info */}
        {selectedPatient && (
          <Card
            sx={{
              mb: getSpacing(2, 3, 3),
              bgcolor: 'info.50',
              border: 1,
              borderColor: 'info.200',
              borderRadius: isMobile ? 2 : 1,
            }}
          >
            <CardContent sx={{ p: getSpacing(2, 2, 3) }}>
              <Typography
                variant={isMobile ? 'subtitle1' : 'h6'}
                color="info.main"
                sx={{ mb: 1 }}
              >
                Patient: {selectedPatient.firstName} {selectedPatient.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {selectedPatient._id}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {(errors.saveMedication || errors.importMedications) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errors.saveMedication || errors.importMedications}
          </Alert>
        )}

        {/* Duplicate Warnings */}
        {duplicateWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Potential Issues Detected:
            </Typography>
            {duplicateWarnings.map((warning, index) => (
              <Typography key={index} variant="body2">
                • {warning}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Validation Errors */}
        {getValidationErrors().length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Please fix the following issues:
            </Typography>
            {getValidationErrors().map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Action Buttons */}
        <Box
          sx={{
            mb: getSpacing(2, 3, 3),
            display: 'flex',
            gap: getSpacing(1, 2, 2),
            flexWrap: 'wrap',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleAddMedication()}
            size={isMobile ? 'large' : 'medium'}
            fullWidth={isMobile}
          >
            Add Medication
          </Button>
          <Button
            variant="outlined"
            startIcon={
              importLoading ? <CircularProgress size={16} /> : <ImportIcon />
            }
            onClick={handleImportMedications}
            disabled={importLoading}
            size={isMobile ? 'large' : 'medium'}
            fullWidth={isMobile}
          >
            Import from Records
          </Button>
          {onNext && (
            <Button
              variant="contained"
              color="success"
              onClick={onNext}
              disabled={!canProceed()}
              sx={{ ml: isMobile ? 0 : 'auto', mt: isMobile ? 1 : 0 }}
              size={isMobile ? 'large' : 'medium'}
              fullWidth={isMobile}
            >
              Continue to Assessment
            </Button>
          )}
        </Box>

        {/* Medication Categories Tabs */}
        <Card sx={{ borderRadius: isMobile ? 2 : 1 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="medication categories"
              variant={isMobile ? 'scrollable' : 'standard'}
              scrollButtons={isMobile ? 'auto' : false}
              allowScrollButtonsMobile={isMobile}
            >
              {memoizedCategories.map((category, index) => (
                <Tab
                  key={category.value}
                  label={
                    <Badge
                      badgeContent={
                        getMedicationsByCategory(category.value).length
                      }
                      color={
                        category.color as
                          | 'primary'
                          | 'secondary'
                          | 'success'
                          | 'info'
                      }
                      showZero
                    >
                      <Typography
                        variant={isMobile ? 'caption' : 'body2'}
                        sx={{
                          textTransform: 'none',
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                        }}
                      >
                        {isMobile
                          ? category.label.split('/')[0]
                          : category.label}
                      </Typography>
                    </Badge>
                  }
                  id={`medication-tab-${index}`}
                  aria-controls={`medication-tabpanel-${index}`}
                  sx={{
                    minWidth: isMobile ? 80 : 120,
                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                  }}
                />
              ))}
            </Tabs>
          </Box>

          {memoizedCategories.map((category, index) => (
            <TabPanel key={category.value} value={activeTab} index={index}>
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="h6">{category.label}</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddMedication(category.value)}
                >
                  Add {category.label.split('/')[0]}
                </Button>
              </Box>

              {getMedicationsByCategory(category.value).length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'grey.50',
                  }}
                >
                  <MedicationIcon
                    sx={{ fontSize: 48, color: 'grey.400', mb: 2 }}
                  />
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    No {category.label} Added
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Click "Add {category.label.split('/')[0]}" to document
                    medications in this category
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddMedication(category.value)}
                  >
                    Add {category.label.split('/')[0]}
                  </Button>
                </Paper>
              ) : (
                <List>
                  {getMedicationsByCategory(category.value).map(
                    (medication) => (
                      <React.Fragment key={medication.id}>
                        <ListItem
                          sx={{
                            bgcolor: 'background.paper',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 1,
                              }}
                            >
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                              >
                                {medication.drugName}
                              </Typography>

                              {/* Entry Method Badge */}
                              <Chip
                                label={
                                  medication.isManual ? 'Manual' : 'Database'
                                }
                                size="small"
                                color={
                                  medication.isManual ? 'secondary' : 'success'
                                }
                                variant="outlined"
                                icon={
                                  medication.isManual ? (
                                    <EditIcon />
                                  ) : (
                                    <CheckCircleIcon />
                                  )
                                }
                              />

                              {medication.genericName &&
                                medication.genericName !==
                                  medication.drugName && (
                                  <Chip
                                    label={medication.genericName}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              <Chip
                                label={`${medication.strength.value}${medication.strength.unit}`}
                                size="small"
                                color="primary"
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {medication.instructions.dose} •{' '}
                              {medication.instructions.frequency} •{' '}
                              {medication.instructions.route}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Indication: {medication.indication}
                            </Typography>
                            {medication.prescriber?.name && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Prescribed by: {medication.prescriber.name}
                              </Typography>
                            )}
                          </Box>
                          <ListItemSecondaryAction>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    toggleMedicationExpansion(medication.id!)
                                  }
                                >
                                  {expandedMedications.has(medication.id!) ? (
                                    <ExpandLessIcon />
                                  ) : (
                                    <ExpandMoreIcon />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleEditMedication(medication)
                                  }
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    handleDeleteMedication(medication.id!)
                                  }
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </ListItemSecondaryAction>
                        </ListItem>

                        <Collapse in={expandedMedications.has(medication.id!)}>
                          <Paper
                            variant="outlined"
                            sx={{ p: 2, mb: 1, ml: 2, bgcolor: 'grey.50' }}
                          >
                            <FixedGrid container spacing={2}>
                              <FixedGrid item xs={12} sm={6}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Dosage Form
                                </Typography>
                                <Typography variant="body2">
                                  {medication.dosageForm}
                                </Typography>
                              </FixedGrid>
                              <FixedGrid item xs={12} sm={6}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Duration
                                </Typography>
                                <Typography variant="body2">
                                  {medication.instructions.duration ||
                                    'Not specified'}
                                </Typography>
                              </FixedGrid>
                              <FixedGrid item xs={12} sm={6}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Start Date
                                </Typography>
                                <Typography variant="body2">
                                  {new Date(
                                    medication.startDate
                                  ).toLocaleDateString()}
                                </Typography>
                              </FixedGrid>
                              {medication.endDate && (
                                <FixedGrid item xs={12} sm={6}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    End Date
                                  </Typography>
                                  <Typography variant="body2">
                                    {new Date(
                                      medication.endDate
                                    ).toLocaleDateString()}
                                  </Typography>
                                </FixedGrid>
                              )}
                              {medication.adherenceScore !== undefined && (
                                <FixedGrid item xs={12} sm={6}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Adherence Score
                                  </Typography>
                                  <Typography variant="body2">
                                    {medication.adherenceScore}%
                                  </Typography>
                                </FixedGrid>
                              )}
                              {medication.notes && (
                                <FixedGrid item xs={12}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Notes
                                  </Typography>
                                  <Typography variant="body2">
                                    {medication.notes}
                                  </Typography>
                                </FixedGrid>
                              )}
                            </FixedGrid>
                          </Paper>
                        </Collapse>
                      </React.Fragment>
                    )
                  )}
                </List>
              )}
            </TabPanel>
          ))}
        </Card>

        {/* Summary */}
        {medications.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Medication Summary
              </Typography>
              <FixedGrid container spacing={2}>
                {memoizedCategories.map((category) => (
                  <FixedGrid item xs={6} sm={3} key={category.value}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      <Typography variant="h4" color={`${category.color}.main`}>
                        {getMedicationsByCategory(category.value).length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {category.label}
                      </Typography>
                    </Paper>
                  </FixedGrid>
                ))}
              </FixedGrid>
              <Box
                sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Total Medications: {medications.length}
                </Typography>
                {canProceed() ? (
                  <CheckCircleIcon color="success" fontSize="small" />
                ) : (
                  <WarningIcon color="warning" fontSize="small" />
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Medication Entry Modal */}
        <Dialog
          open={showMedicationModal}
          onClose={() => setShowMedicationModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h6">
                {editingMedication ? 'Edit Medication' : 'Add New Medication'}
              </Typography>
              <IconButton onClick={() => setShowMedicationModal(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          <Box
            component="form"
            onSubmit={handleMedicationFormSubmit(handleMedicationSubmit)}
          >
            <DialogContent>
              <Stack spacing={3}>
                {/* Drug Information */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
                  Drug Information
                </Typography>

                <FixedGrid container spacing={2}>
                  <FixedGrid item xs={12}>
                    {/* Entry Mode Toggle */}
                    <Box
                      sx={{
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Chip
                        label={
                          isManualEntry ? 'Manual Entry' : 'Database Search'
                        }
                        color={isManualEntry ? 'secondary' : 'primary'}
                        size="small"
                        icon={isManualEntry ? <EditIcon /> : <SearchIcon />}
                      />
                      {isManualEntry && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleBackToSearch}
                          startIcon={<SearchIcon />}
                        >
                          Back to Search
                        </Button>
                      )}
                    </Box>

                    {/* Drug Name Field - Search or Manual */}
                    <Controller
                      name="drugName"
                      control={medicationControl}
                      rules={{ required: 'Drug name is required' }}
                      render={({ field }) => (
                        <>
                          {!isManualEntry ? (
                            // Search Mode
                            <Box>
                              <Autocomplete
                                options={drugSuggestions}
                                getOptionLabel={(option) =>
                                  typeof option === 'string'
                                    ? option
                                    : option.name
                                }
                                value={
                                  drugSuggestions.find(
                                    (drug) => drug.name === field.value
                                  ) || null
                                }
                                renderOption={(props, option) => {
                                  const { key, ...otherProps } = props;
                                  return (
                                    <Box
                                      component="li"
                                      key={key}
                                      {...otherProps}
                                    >
                                      <Box>
                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 500 }}
                                        >
                                          {option.name}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Generic: {option.genericName}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  );
                                }}
                                onInputChange={(_event, newInputValue) => {
                                  setDrugSearchQuery(newInputValue);
                                  field.onChange(newInputValue);
                                }}
                                onChange={(_event, newValue) => {
                                  if (
                                    newValue &&
                                    typeof newValue !== 'string'
                                  ) {
                                    handleDrugSelect(newValue);
                                  }
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Drug Name *"
                                    placeholder="Search for medication..."
                                    error={!!medicationErrors.drugName}
                                    helperText={
                                      medicationErrors.drugName?.message ||
                                      'Start typing to search our drug database'
                                    }
                                    required
                                    InputProps={{
                                      ...params.InputProps,
                                      startAdornment: (
                                        <SearchIcon
                                          sx={{
                                            mr: 1,
                                            color: 'text.secondary',
                                          }}
                                        />
                                      ),
                                    }}
                                  />
                                )}
                              />

                              {/* Manual Entry Button */}
                              {showManualEntryButton && (
                                <Box sx={{ mt: 2 }}>
                                  <Alert
                                    severity="info"
                                    action={
                                      <Button
                                        color="inherit"
                                        size="small"
                                        onClick={handleManualEntry}
                                        startIcon={<AddIcon />}
                                      >
                                        Add Manually
                                      </Button>
                                    }
                                  >
                                    Drug not found in database? You can add it
                                    manually.
                                  </Alert>
                                </Box>
                              )}
                            </Box>
                          ) : (
                            // Manual Entry Mode
                            <TextField
                              {...field}
                              fullWidth
                              label="Drug Name *"
                              placeholder="Enter drug name manually..."
                              error={!!medicationErrors.drugName}
                              helperText={
                                medicationErrors.drugName?.message ||
                                'Manually entered - not from database'
                              }
                              required
                              InputProps={{
                                startAdornment: (
                                  <EditIcon
                                    sx={{ mr: 1, color: 'text.secondary' }}
                                  />
                                ),
                              }}
                            />
                          )}
                        </>
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="genericName"
                      control={medicationControl}
                      rules={
                        isManualEntry
                          ? {
                              required:
                                'Generic name is recommended for manual entries',
                            }
                          : {}
                      }
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={
                            isManualEntry ? 'Generic Name *' : 'Generic Name'
                          }
                          placeholder={
                            isManualEntry
                              ? 'Enter generic/active ingredient name'
                              : 'Generic or active ingredient name'
                          }
                          helperText={
                            medicationErrors.genericName?.message ||
                            (isManualEntry
                              ? 'Required for manual entries - helps with drug interaction checking'
                              : 'Generic or active ingredient name')
                          }
                          error={!!medicationErrors.genericName}
                          required={isManualEntry}
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="category"
                      control={medicationControl}
                      rules={{ required: 'Category is required' }}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!medicationErrors.category}
                        >
                          <InputLabel>Category</InputLabel>
                          <Select {...field} label="Category">
                            {memoizedCategories.map((category) => (
                              <MenuItem
                                key={category.value}
                                value={category.value}
                              >
                                {category.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {medicationErrors.category && (
                            <FormHelperText>
                              {medicationErrors.category.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={4}>
                    <Controller
                      name="strength.value"
                      control={medicationControl}
                      rules={{
                        required: 'Strength is required',
                        min: {
                          value: 0.001,
                          message: 'Strength must be greater than 0',
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="number"
                          label="Strength"
                          error={!!medicationErrors.strength?.value}
                          helperText={medicationErrors.strength?.value?.message}
                          required
                          inputProps={{ step: 0.001, min: 0 }}
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={4}>
                    <Controller
                      name="strength.unit"
                      control={medicationControl}
                      rules={{ required: 'Unit is required' }}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!medicationErrors.strength?.unit}
                        >
                          <InputLabel>Unit</InputLabel>
                          <Select {...field} label="Unit">
                            {STRENGTH_UNITS.map((unit) => (
                              <MenuItem key={unit} value={unit}>
                                {unit}
                              </MenuItem>
                            ))}
                          </Select>
                          {medicationErrors.strength?.unit && (
                            <FormHelperText>
                              {medicationErrors.strength.unit.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={4}>
                    <Controller
                      name="dosageForm"
                      control={medicationControl}
                      rules={{ required: 'Dosage form is required' }}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!medicationErrors.dosageForm}
                        >
                          <InputLabel>Dosage Form *</InputLabel>
                          <Select {...field} label="Dosage Form *">
                            {DOSAGE_FORMS.map((form) => (
                              <MenuItem key={form} value={form}>
                                {form}
                              </MenuItem>
                            ))}
                          </Select>
                          {medicationErrors.dosageForm && (
                            <FormHelperText>
                              {medicationErrors.dosageForm.message}
                            </FormHelperText>
                          )}
                          {isManualEntry && !medicationErrors.dosageForm && (
                            <FormHelperText>
                              Required for manual entries - select the physical
                              form of the medication
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </FixedGrid>
                </FixedGrid>

                {/* Instructions */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
                  Instructions
                </Typography>

                <FixedGrid container spacing={2}>
                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="instructions.dose"
                      control={medicationControl}
                      rules={{ required: 'Dose is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Dose"
                          placeholder="e.g., 1 tablet, 5ml"
                          error={!!medicationErrors.instructions?.dose}
                          helperText={
                            medicationErrors.instructions?.dose?.message
                          }
                          required
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="instructions.frequency"
                      control={medicationControl}
                      rules={{ required: 'Frequency is required' }}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!medicationErrors.instructions?.frequency}
                        >
                          <InputLabel>Frequency</InputLabel>
                          <Select {...field} label="Frequency">
                            {FREQUENCIES.map((freq) => (
                              <MenuItem key={freq} value={freq}>
                                {freq}
                              </MenuItem>
                            ))}
                          </Select>
                          {medicationErrors.instructions?.frequency && (
                            <FormHelperText>
                              {medicationErrors.instructions.frequency.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="instructions.route"
                      control={medicationControl}
                      rules={{ required: 'Route is required' }}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!medicationErrors.instructions?.route}
                        >
                          <InputLabel>Route</InputLabel>
                          <Select {...field} label="Route">
                            {ROUTES.map((route) => (
                              <MenuItem key={route} value={route}>
                                {route}
                              </MenuItem>
                            ))}
                          </Select>
                          {medicationErrors.instructions?.route && (
                            <FormHelperText>
                              {medicationErrors.instructions.route.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="instructions.duration"
                      control={medicationControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Duration"
                          placeholder="e.g., 7 days, 3 months, ongoing"
                          helperText="How long to take the medication"
                        />
                      )}
                    />
                  </FixedGrid>
                </FixedGrid>

                {/* Clinical Information */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
                  Clinical Information
                </Typography>

                <FixedGrid container spacing={2}>
                  <FixedGrid item xs={12}>
                    <Controller
                      name="indication"
                      control={medicationControl}
                      rules={{ required: 'Indication is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Indication"
                          placeholder="What condition is this medication treating?"
                          error={!!medicationErrors.indication}
                          helperText={medicationErrors.indication?.message}
                          required
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="startDate"
                      control={medicationControl}
                      rules={{ required: 'Start date is required' }}
                      render={({ field: { onChange, value, ...field } }) => (
                        <DatePicker
                          {...field}
                          value={value || null}
                          onChange={(newValue) => onChange(newValue)}
                          label="Start Date"
                          maxDate={new Date()}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!medicationErrors.startDate,
                              helperText: medicationErrors.startDate?.message,
                              required: true,
                            },
                          }}
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="endDate"
                      control={medicationControl}
                      render={({ field: { onChange, value, ...field } }) => (
                        <DatePicker
                          {...field}
                          value={value || null}
                          onChange={(newValue) => onChange(newValue)}
                          label="End Date (Optional)"
                          minDate={watchMedication('startDate')}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              helperText: 'Leave blank if ongoing',
                            },
                          }}
                        />
                      )}
                    />
                  </FixedGrid>

                  <FixedGrid item xs={12} sm={6}>
                    <Controller
                      name="adherenceScore"
                      control={medicationControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="number"
                          label="Adherence Score (%)"
                          placeholder="0-100"
                          helperText="Patient's adherence to this medication (0-100%)"
                          inputProps={{ min: 0, max: 100 }}
                        />
                      )}
                    />
                  </FixedGrid>
                </FixedGrid>

                {/* Prescriber Information (for prescribed medications) */}
                {watchedCategory === 'prescribed' && (
                  <>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, mt: 2 }}
                    >
                      Prescriber Information
                    </Typography>

                    <FixedGrid container spacing={2}>
                      <FixedGrid item xs={12} sm={6}>
                        <Controller
                          name="prescriber.name"
                          control={medicationControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="Prescriber Name"
                              placeholder="Dr. John Smith"
                            />
                          )}
                        />
                      </FixedGrid>

                      <FixedGrid item xs={12} sm={6}>
                        <Controller
                          name="prescriber.license"
                          control={medicationControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="License Number"
                              placeholder="Medical license number"
                            />
                          )}
                        />
                      </FixedGrid>

                      <FixedGrid item xs={12}>
                        <Controller
                          name="prescriber.contact"
                          control={medicationControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="Contact Information"
                              placeholder="Phone, email, or clinic address"
                            />
                          )}
                        />
                      </FixedGrid>
                    </FixedGrid>
                  </>
                )}

                {/* Additional Notes */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
                  Additional Information
                </Typography>

                <Controller
                  name="notes"
                  control={medicationControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      placeholder="Any additional notes about this medication..."
                      helperText="Side effects, patient concerns, special instructions, etc."
                    />
                  )}
                />
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setShowMedicationModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading.saveMedication}
                startIcon={
                  loading.saveMedication ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                {editingMedication ? 'Update Medication' : 'Add Medication'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MedicationHistory;
