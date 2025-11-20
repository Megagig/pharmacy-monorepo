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
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Paper,
  IconButton,
  Zoom,
  Collapse,
  InputAdornment,
  List,
  Slide,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationIcon from '@mui/icons-material/LocationOn';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useForm, Controller } from 'react-hook-form';

// Custom debounce implementation to avoid lodash dependency
const debounce = (
  func: (query: string) => void,
  wait: number
): ((query: string) => void) => {
  let timeout: NodeJS.Timeout;
  return (query: string) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(query), wait);
  };
};

import { useSearchPatients, useCreatePatient } from '../queries/usePatients';
import { useMTRStore } from '../stores/mtrStore';
import { useResponsive } from '../hooks/useResponsive';
import type {
  Patient,
  CreatePatientData,
  NigerianState,
  BloodGroup,
  Genotype,
  Gender,
  MaritalStatus,
} from '../types/patientManagement';
import { getNigerianStates, getLGAsForState } from '../utils/nigeriaLocationData';

// Constants
const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];
const GENOTYPES: Genotype[] = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'];
const GENDERS: Gender[] = ['male', 'female', 'other'];
const MARITAL_STATUSES: MaritalStatus[] = [
  'single',
  'married',
  'divorced',
  'widowed',
];

// Interfaces
interface PatientSelectionProps {
  onPatientSelect: (patient: Patient) => void;
  selectedPatient?: Patient | null;
  onNext?: () => void;
}

// interface PatientSearchFilters {
//   search: string;
//   hasActiveMTR?: boolean;
//   lastReviewDate?: Date;
//   medicationCount?: number;
// }

interface NewPatientFormData {
  firstName: string;
  lastName: string;
  otherNames?: string;
  dob?: Date;
  age?: number;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  phone?: string;
  email?: string;
  address?: string;
  state?: NigerianState;
  lga?: string;
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  weightKg?: number;
}

const PatientSelection: React.FC<PatientSelectionProps> = ({
  onPatientSelect,
  selectedPatient,
  onNext,
}) => {
  // Responsive hooks
  const { isMobile, shouldUseCardLayout, getSpacing, getDialogMaxWidth } =
    useResponsive();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  // const [filters, setFilters] = useState({
  //   search: '',
  // });
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [showRecentPatients, setShowRecentPatients] = useState(true);
  const [availableLGAs, setAvailableLGAs] = useState<string[]>([]);

  // Get Nigerian states from the library
  const NIGERIAN_STATES = getNigerianStates();

  // Store
  const { loading, errors, setLoading, setError, currentReview, createReview } =
    useMTRStore();

  // Queries
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchPatients(searchQuery);

  const createPatientMutation = useCreatePatient();

  // Clear error when MTR review is successfully created
  useEffect(() => {
    if (currentReview?._id) {

      setError('selectPatient', null);
    }
  }, [currentReview?._id, setError]);

  // Form for new patient
  const {
    control: newPatientControl,
    handleSubmit: handleNewPatientFormSubmit,
    watch: watchNewPatient,
    setValue: setNewPatientValue,
    formState: { errors: newPatientErrors },
    reset: resetNewPatientForm,
  } = useForm<NewPatientFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      otherNames: '',
      gender: undefined,
      maritalStatus: undefined,
      phone: '',
      email: '',
      address: '',
      state: undefined,
      lga: '',
      bloodGroup: undefined,
      genotype: undefined,
      weightKg: undefined,
    },
  });

  const watchedDob = watchNewPatient('dob');
  const watchedAge = watchNewPatient('age');
  const watchedState = watchNewPatient('state');

  // Update available LGAs when state changes
  useEffect(() => {
    if (watchedState) {
      const lgas = getLGAsForState(watchedState as string);
      setAvailableLGAs(lgas);
      // Clear LGA if it's not in the new list
      const currentLga = watchNewPatient('lga');
      if (currentLga && !lgas.includes(currentLga as string)) {
        setNewPatientValue('lga', '');
      }
    } else {
      setAvailableLGAs([]);
      setNewPatientValue('lga', '');
    }
  }, [watchedState, watchNewPatient, setNewPatientValue]);

  // Debounced search
  const debouncedSearchFn = useMemo(
    () =>
      debounce((query: string) => {
        // setFilters((prev) => ({ ...prev, search: query }));
        // Filters functionality can be implemented later

      }, 300),
    []
  );

  const debouncedSearch = useCallback(
    (query: string) => {
      debouncedSearchFn(query);
    },
    [debouncedSearchFn]
  );

  // Effects
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Auto-calculate age when DOB changes
  useEffect(() => {
    if (watchedDob && !watchedAge) {
      const today = new Date();
      const birthDate = new Date(watchedDob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age >= 0 && age <= 150) {
        setNewPatientValue('age', age);
      }
    }
  }, [watchedDob, watchedAge, setNewPatientValue]);

  // Load recent patients on mount
  useEffect(() => {
    // Note: Recent patients functionality disabled as we've moved away from localStorage
    // In a production environment, this could be implemented server-side or using IndexedDB
    const loadRecentPatients = () => {
      try {
        // localStorage removed for security - no client-side persistence
        // Recent patients list will be empty on page reload
        setRecentPatients([]);
      } catch (error) {
        console.error('Failed to load recent patients:', error);
      }
    };

    loadRecentPatients();
  }, []);

  // Validation functions
  const validateNigerianPhone = (phone: string): boolean => {
    const phoneRegex = /^\+234[789]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handlers
  const handleRefreshSearch = () => {
    setSearchQuery('');
  };

  const handleNewPatientSubmit = async (data: NewPatientFormData) => {
    try {
      setLoading('createNewPatient', true);
      setError('createNewPatient', null);

      // Format phone number to Nigerian E.164 format if provided
      let formattedPhone: string | undefined;
      if (data.phone) {
        const phone = data.phone.trim();
        if (phone) {
          // Remove any non-digit characters
          const digits = phone.replace(/\D/g, '');
          // If starts with 0, replace with +234
          if (digits.startsWith('0') && digits.length === 11) {
            formattedPhone = '+234' + digits.substring(1);
          } else if (digits.startsWith('234') && digits.length === 13) {
            formattedPhone = '+' + digits;
          } else if (digits.length === 10) {
            formattedPhone = '+234' + digits;
          } else if (phone.startsWith('+234')) {
            formattedPhone = phone;
          } else {
            formattedPhone = phone; // Keep original if we can't format it
          }
        }
      }

      const newPatientData: CreatePatientData = {
        firstName: data.firstName,
        lastName: data.lastName,
        otherNames: data.otherNames && data.otherNames.trim() !== '' ? data.otherNames : undefined,
        dob: data.dob?.toISOString(),
        age: data.age,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        phone: formattedPhone,
        email: data.email && data.email.trim() !== '' ? data.email : undefined,
        address: data.address && data.address.trim() !== '' ? data.address : undefined,
        state: data.state && typeof data.state === 'string' && data.state.trim() !== '' ? data.state : undefined,
        lga: data.lga && typeof data.lga === 'string' && data.lga.trim() !== '' ? data.lga : undefined,
        bloodGroup: data.bloodGroup,
        genotype: data.genotype,
        weightKg: data.weightKg ? Number(data.weightKg) : undefined,
      };

      const response = await createPatientMutation.mutateAsync(
        newPatientData
      );

      // Close modal and reset form
      setShowNewPatientModal(false);
      resetNewPatientForm();

      // Select the newly created patient - extract from response
      const createdPatient = (response as any)?.data?.patient;
      if (createdPatient) {
        await handlePatientSelect(createdPatient);
      }
    } catch (error) {
      console.error('Error creating patient:', error);
      setError(
        'createNewPatient',
        error instanceof Error ? error.message : 'Failed to create patient'
      );
    } finally {
      setLoading('createNewPatient', false);
    }
  };

  const handlePatientSelect = async (patient: Patient) => {
    try {
      setLoading('selectPatient', true);
      setError('selectPatient', null);

      // Add to recent patients
      const updatedRecent = [
        patient,
        ...recentPatients.filter((p) => p._id !== patient._id),
      ].slice(0, 5);
      setRecentPatients(updatedRecent);

      // First, select the patient
      onPatientSelect(patient);

      // Create MTR session if none exists
      if (!currentReview) {
        // Try multiple ID fields - use mrn as fallback since backend doesn't return _id
        const patientId = patient._id || (patient as any).id || (patient as any).patientId || (patient as any).mrn;

        // Force use mrn if no other ID is available
        const finalPatientId = patientId || (patient as any).mrn;

        if (!finalPatientId) {
          setError('selectPatient', 'Patient ID is missing. Cannot create MTR review.');
          return;
        }

        try {
          await createReview(finalPatientId);
        } catch (createError) {
          throw createError;
        }
      }
    } catch (error) {
      console.error('Error in handlePatientSelect:', error);

      // Show error - no fallback available
      setError(
        'selectPatient',
        error instanceof Error ? error.message : 'Failed to select patient'
      );
    } finally {
      setLoading('selectPatient', false);
    }
  };

  // Get patients from search results
  const patients: Patient[] = Array.isArray(searchResults)
    ? searchResults
    : (searchResults?.data?.results as Patient[]) || [];

  const hasSearchResults = searchQuery.length >= 2 && patients.length > 0;
  const showNoResults =
    searchQuery.length >= 2 && patients.length === 0 && !searchLoading;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: getSpacing(1, 2, 3) }}>
        {/* Header */}
        <Box sx={{ mb: getSpacing(2, 3, 4) }}>
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Patient Selection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search for an existing patient or create a new patient record to
            begin the MTR process
          </Typography>
        </Box>

        {/* Error Display - hide if we have a working MTR review */}
        {(errors.selectPatient || errors.createNewPatient || searchError) && !currentReview && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errors.selectPatient ||
              errors.createNewPatient ||
              'Search failed. Please try again.'}
          </Alert>
        )}

        {/* Selected Patient Display */}
        {selectedPatient && (
          <Zoom in={true}>
            <Card
              sx={{
                mb: getSpacing(2, 3, 3),
                bgcolor: 'success.50',
                border: 1,
                borderColor: 'success.200',
                borderRadius: isMobile ? 2 : 1,
              }}
            >
              <CardContent sx={{ p: getSpacing(2, 2, 3) }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexDirection: isMobile ? 'column' : 'row',
                    textAlign: isMobile ? 'center' : 'left',
                  }}
                >
                  <CheckCircleIcon
                    color="success"
                    sx={{ fontSize: isMobile ? 32 : 24 }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography
                      variant={isMobile ? 'subtitle1' : 'h6'}
                      color="success.main"
                    >
                      Selected Patient
                    </Typography>
                    <Typography
                      variant={isMobile ? 'body2' : 'body1'}
                      sx={{ fontWeight: 500 }}
                    >
                      {selectedPatient.firstName} {selectedPatient.lastName}
                      {selectedPatient.otherNames &&
                        ` ${selectedPatient.otherNames}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      MRN: {selectedPatient.mrn} • Age:{' '}
                      {selectedPatient.age || 'N/A'}
                      {selectedPatient.phone && ` • ${selectedPatient.phone}`}
                    </Typography>
                  </Box>
                  {onNext && (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={async () => {
                        // Clear any existing errors when user clicks Continue
                        setError('selectPatient', null);

                        // Ensure patient is selected in store before proceeding
                        if (selectedPatient) {
                          onPatientSelect(selectedPatient);
                          // Add a small delay to ensure the store is updated
                          await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                          );
                        }
                        onNext();
                      }}
                      sx={{
                        minWidth: isMobile ? '100%' : 120,
                        mt: isMobile ? 2 : 0,
                      }}
                      size={isMobile ? 'large' : 'medium'}
                    >
                      Continue
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Zoom>
        )}

        {/* Search Section */}
        <Card
          sx={{
            mb: getSpacing(2, 3, 3),
            borderRadius: isMobile ? 2 : 1,
          }}
        >
          <CardContent sx={{ p: getSpacing(2, 2, 3) }}>
            <Typography
              variant={isMobile ? 'subtitle1' : 'h6'}
              sx={{ mb: getSpacing(1, 2, 2) }}
            >
              Search Patients
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: getSpacing(1, 2, 2),
                mb: getSpacing(1, 2, 2),
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <TextField
                fullWidth
                placeholder="Search by name, MRN, or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size={isMobile ? 'medium' : 'medium'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={handleRefreshSearch}
                        edge="end"
                      >
                        <CloseIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: isMobile ? 2 : 1,
                  },
                }}
              />
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setShowNewPatientModal(true)}
                sx={{
                  minWidth: isMobile ? '100%' : 140,
                  borderRadius: isMobile ? 2 : 1,
                }}
                size={isMobile ? 'large' : 'medium'}
              >
                New Patient
              </Button>
            </Box>

            {/* Search Results */}
            {searchLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {hasSearchResults && (
              <Paper
                variant="outlined"
                sx={{
                  maxHeight: isMobile ? 300 : 400,
                  overflow: 'auto',
                  borderRadius: isMobile ? 2 : 1,
                }}
              >
                {shouldUseCardLayout ? (
                  // Mobile card layout
                  <Box sx={{ p: 1 }}>
                    {patients.map((patient: Patient) => (
                      <Card
                        key={patient._id}
                        sx={{
                          mb: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 2,
                        }}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 2,
                            }}
                          >
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              <PersonIcon />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 0.5,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {patient.firstName} {patient.lastName}
                                  {patient.otherNames &&
                                    ` ${patient.otherNames}`}
                                </Typography>
                                {patient.hasActiveDTP && (
                                  <Chip
                                    label="Active DTP"
                                    size="small"
                                    color="warning"
                                    icon={<WarningIcon />}
                                  />
                                )}
                              </Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1 }}
                              >
                                MRN: {patient.mrn} • Age: {patient.age || 'N/A'}
                                {patient.gender &&
                                  ` • ${patient.gender.charAt(0).toUpperCase() +
                                  patient.gender.slice(1)
                                  }`}
                              </Typography>
                              {patient.phone && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mb: 0.5,
                                  }}
                                >
                                  <PhoneIcon
                                    sx={{
                                      fontSize: 16,
                                      color: 'text.secondary',
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {patient.phone}
                                  </Typography>
                                </Box>
                              )}
                              {patient.email && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mb: 0.5,
                                  }}
                                >
                                  <EmailIcon
                                    sx={{
                                      fontSize: 16,
                                      color: 'text.secondary',
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {patient.email}
                                  </Typography>
                                </Box>
                              )}
                              {patient.address && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                  }}
                                >
                                  <LocationIcon
                                    sx={{
                                      fontSize: 16,
                                      color: 'text.secondary',
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {patient.address}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  // Desktop list layout
                  <List>
                    {patients.map((patient: Patient, index: number) => (
                      <React.Fragment key={patient._id}>
                        <ListItemButton
                          onClick={() => handlePatientSelect(patient)}
                          disabled={loading.selectPatient}
                        >
                          <ListItemAvatar>
                            <Avatar>
                              <PersonIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="subtitle1"
                                  sx={{ fontWeight: 500 }}
                                >
                                  {patient.firstName} {patient.lastName}
                                  {patient.otherNames &&
                                    ` ${patient.otherNames}`}
                                </Typography>
                                {patient.hasActiveDTP && (
                                  <Chip
                                    label="Active DTP"
                                    size="small"
                                    color="warning"
                                    icon={<WarningIcon />}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  MRN: {patient.mrn} • Age:{' '}
                                  {patient.age || 'N/A'}
                                  {patient.gender &&
                                    ` • ${patient.gender.charAt(0).toUpperCase() +
                                    patient.gender.slice(1)
                                    }`}
                                </Typography>
                                {patient.phone && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    <PhoneIcon sx={{ fontSize: 14 }} />
                                    <Typography variant="caption">
                                      {patient.phone}
                                    </Typography>
                                  </Box>
                                )}
                                {patient.email && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                    }}
                                  >
                                    <EmailIcon sx={{ fontSize: 14 }} />
                                    <Typography variant="caption">
                                      {patient.email}
                                    </Typography>
                                  </Box>
                                )}
                                {patient.address && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                    }}
                                  >
                                    <LocationIcon sx={{ fontSize: 14 }} />
                                    <Typography variant="caption">
                                      {patient.address}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            }
                          />
                        </ListItemButton>
                        {index < patients.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>
            )}

            {showNoResults && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No patients found matching "{searchQuery}". Try a different
                search term or create a new patient.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Recent Patients */}
        {recentPatients.length > 0 && !selectedPatient && (
          <Card sx={{ borderRadius: isMobile ? 2 : 1 }}>
            <CardContent sx={{ p: getSpacing(2, 2, 3) }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: getSpacing(1, 2, 2),
                }}
              >
                <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
                  Recent Patients
                </Typography>
                {isMobile && (
                  <IconButton
                    size="small"
                    onClick={() => setShowRecentPatients(!showRecentPatients)}
                  >
                    {showRecentPatients ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                )}
              </Box>

              <Collapse in={!isMobile || showRecentPatients}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {recentPatients.map((patient) => (
                    <Box sx={{ width: '100%' }} key={patient._id}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: getSpacing(1.5, 2, 2),
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          transition: 'all 0.2s',
                          borderRadius: isMobile ? 2 : 1,
                          '&:active': isMobile
                            ? {
                              transform: 'scale(0.98)',
                              bgcolor: 'action.selected',
                            }
                            : {},
                        }}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Avatar sx={{ width: 32, height: 32 }}>
                            <PersonIcon />
                          </Avatar>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 500 }}
                          >
                            {patient.firstName} {patient.lastName}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          MRN: {patient.mrn}
                        </Typography>
                        {patient.phone && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {patient.phone}
                          </Typography>
                        )}
                      </Paper>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        )}

        {/* New Patient Modal */}
        <Dialog
          open={showNewPatientModal}
          onClose={() => setShowNewPatientModal(false)}
          maxWidth={getDialogMaxWidth('xs', 'sm', 'md')}
          fullWidth
          fullScreen={isMobile}
          TransitionComponent={isMobile ? Slide : undefined}
          slotProps={{
            transition: isMobile ? { direction: 'up' } : undefined,
          }}
        >
          <DialogTitle>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h6">Create New Patient</Typography>
              <IconButton onClick={() => setShowNewPatientModal(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          <form onSubmit={handleNewPatientFormSubmit(handleNewPatientSubmit)}>
            <DialogContent>
              <Stack>
                {/* Basic Information */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
                  Basic Information
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="firstName"
                      control={newPatientControl}
                      rules={{ required: 'First name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="First Name"
                          error={!!newPatientErrors.firstName}
                          helperText={newPatientErrors.firstName?.message}
                          required
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="lastName"
                      control={newPatientControl}
                      rules={{ required: 'Last name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Last Name"
                          error={!!newPatientErrors.lastName}
                          helperText={newPatientErrors.lastName?.message}
                          required
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="otherNames"
                      control={newPatientControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Other Names"
                          helperText="Middle names or other names (optional)"
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="dob"
                      control={newPatientControl}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="Date of Birth"
                          maxDate={new Date()}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!newPatientErrors.dob,
                              helperText: newPatientErrors.dob?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="age"
                      control={newPatientControl}
                      rules={{
                        min: { value: 0, message: 'Age must be positive' },
                        max: { value: 150, message: 'Age must be realistic' },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="number"
                          label="Age (years)"
                          error={!!newPatientErrors.age}
                          helperText={
                            newPatientErrors.age?.message ||
                            'Auto-calculated from DOB'
                          }
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="gender"
                      control={newPatientControl}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!newPatientErrors.gender}
                        >
                          <InputLabel>Gender</InputLabel>
                          <Select
                            {...field}
                            label="Gender"
                            value={field.value || ''}
                          >
                            {GENDERS.map((gender) => (
                              <MenuItem key={gender} value={gender}>
                                {gender.charAt(0).toUpperCase() +
                                  gender.slice(1)}
                              </MenuItem>
                            ))}
                          </Select>
                          {newPatientErrors.gender && (
                            <FormHelperText>
                              {newPatientErrors.gender.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="maritalStatus"
                      control={newPatientControl}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!newPatientErrors.maritalStatus}
                        >
                          <InputLabel>Marital Status</InputLabel>
                          <Select
                            {...field}
                            label="Marital Status"
                            value={field.value || ''}
                          >
                            {MARITAL_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </MenuItem>
                            ))}
                          </Select>
                          {newPatientErrors.maritalStatus && (
                            <FormHelperText>
                              {newPatientErrors.maritalStatus.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>
                </Box>

                {/* Contact Information */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
                  Contact Information
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="phone"
                      control={newPatientControl}
                      rules={{
                        validate: (value) =>
                          !value ||
                          validateNigerianPhone(value) ||
                          'Enter valid Nigerian phone (+234XXXXXXXXX)',
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Phone Number"
                          placeholder="+234812345678"
                          error={!!newPatientErrors.phone}
                          helperText={
                            newPatientErrors.phone?.message ||
                            'Nigerian format: +234XXXXXXXXX'
                          }
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="email"
                      control={newPatientControl}
                      rules={{
                        validate: (value) =>
                          !value ||
                          validateEmail(value) ||
                          'Enter a valid email address',
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="email"
                          label="Email Address"
                          error={!!newPatientErrors.email}
                          helperText={newPatientErrors.email?.message}
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="address"
                      control={newPatientControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Address"
                          multiline
                          rows={2}
                          helperText="Street address or residential area"
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="state"
                      control={newPatientControl}
                      render={({ field }) => (
                        <Autocomplete
                          {...field}
                          options={NIGERIAN_STATES}
                          value={field.value || null}
                          onChange={(_, value) => field.onChange(value)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="State"
                              error={!!newPatientErrors.state}
                              helperText={newPatientErrors.state?.message}
                            />
                          )}
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="lga"
                      control={newPatientControl}
                      render={({ field }) => (
                        <Autocomplete
                          {...field}
                          options={availableLGAs}
                          value={field.value || null}
                          onChange={(_, value) => field.onChange(value || '')}
                          disabled={!watchedState || availableLGAs.length === 0}
                          freeSolo
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Local Government Area"
                              helperText={
                                !watchedState
                                  ? 'Select a state first'
                                  : availableLGAs.length === 0
                                    ? 'No LGAs available'
                                    : 'Select or type LGA name'
                              }
                              error={!!newPatientErrors.lga}
                            />
                          )}
                        />
                      )}
                    />
                  </Box>
                </Box>

                {/* Medical Information */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
                  Medical Information
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="bloodGroup"
                      control={newPatientControl}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!newPatientErrors.bloodGroup}
                        >
                          <InputLabel>Blood Group</InputLabel>
                          <Select
                            {...field}
                            label="Blood Group"
                            value={field.value || ''}
                          >
                            {BLOOD_GROUPS.map((group) => (
                              <MenuItem key={group} value={group}>
                                {group}
                              </MenuItem>
                            ))}
                          </Select>
                          {newPatientErrors.bloodGroup && (
                            <FormHelperText>
                              {newPatientErrors.bloodGroup.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="genotype"
                      control={newPatientControl}
                      render={({ field }) => (
                        <FormControl
                          fullWidth
                          error={!!newPatientErrors.genotype}
                        >
                          <InputLabel>Genotype</InputLabel>
                          <Select
                            {...field}
                            label="Genotype"
                            value={field.value || ''}
                          >
                            {GENOTYPES.map((genotype) => (
                              <MenuItem key={genotype} value={genotype}>
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center' }}
                                >
                                  {genotype}
                                  {genotype.includes('S') && (
                                    <Chip
                                      label="Sickle Cell"
                                      size="small"
                                      color="warning"
                                      sx={{ ml: 1, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                          {newPatientErrors.genotype && (
                            <FormHelperText>
                              {newPatientErrors.genotype.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>

                  <Box sx={{ width: '100%' }}>
                    <Controller
                      name="weightKg"
                      control={newPatientControl}
                      rules={{
                        min: { value: 0.5, message: 'Weight must be positive' },
                        max: {
                          value: 500,
                          message: 'Weight must be realistic',
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="number"
                          label="Weight (kg)"
                          error={!!newPatientErrors.weightKg}
                          helperText={newPatientErrors.weightKg?.message}
                          inputProps={{ step: 0.1, min: 0.5, max: 500 }}
                        />
                      )}
                    />
                  </Box>
                </Box>

                {/* Medical Information Note */}
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Medical Information:</strong> Blood group and
                    genotype are important for emergency situations and
                    medication compatibility. Weight is used for dosage
                    calculations.
                  </Typography>
                </Alert>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setShowNewPatientModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading.createNewPatient}
                startIcon={
                  loading.createNewPatient ? (
                    <CircularProgress size={16} />
                  ) : (
                    <PersonAddIcon />
                  )
                }
              >
                {loading.createNewPatient ? 'Creating...' : 'Create Patient'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default PatientSelection;
