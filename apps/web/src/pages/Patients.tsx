import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  TablePagination,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
  Stack,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  Skeleton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningIcon from '@mui/icons-material/Warning';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { usePatients, useDeletePatient } from '../queries/usePatients';
import { useRBAC } from '../hooks/useRBAC';
import { getNigerianStates } from '../utils/nigeriaLocationData';
import type {
  Patient,
  PatientSearchParams,
  NigerianState,
  BloodGroup,
  Genotype,
} from '../types/patientManagement';

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

const Patients = () => {
  // Get Nigerian states from the library
  const NIGERIAN_STATES = getNigerianStates();

  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const isForMedications = urlParams.get('for') === 'medications';
  const isForDiagnostics = urlParams.get('for') === 'diagnostics';
  const isForLabIntegration = urlParams.get('for') === 'lab-integration';
  const isSelectMode = urlParams.get('mode') === 'select';
  const returnTo = urlParams.get('returnTo');

  // RBAC permissions
  const { permissions } = useRBAC();

  // Search and filter state
  const [searchParams, setSearchParams] = useState<PatientSearchParams>({
    page: 1,
    limit: 10,
  });
  const [quickSearch, setQuickSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // React Query hooks
  const {
    data: patientsResponse,
    isLoading,
    isError,
    error,
  } = usePatients(searchParams);

  const deletePatientMutation = useDeletePatient();

  // Computed values
  const patients = patientsResponse?.data?.results || [];
  const totalPatients = patientsResponse?.meta?.total || 0;
  const currentPage = (searchParams.page || 1) - 1; // MUI pagination is 0-based

  // Debug logging

  // Event handlers
  const handleQuickSearch = (value: string) => {
    setQuickSearch(value);
    setSearchParams((prev) => ({
      ...prev,
      q: value || undefined,
      page: 1, // Reset to first page on search
    }));
  };

  const handleAdvancedFilter = (filters: Partial<PatientSearchParams>) => {
    setSearchParams((prev) => ({
      ...prev,
      ...filters,
      page: 1, // Reset to first page on filter change
    }));
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setSearchParams((prev) => ({
      ...prev,
      page: newPage + 1, // Convert to 1-based pagination
    }));
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newLimit = parseInt(event.target.value, 10);
    setSearchParams((prev) => ({
      ...prev,
      limit: newLimit,
      page: 1, // Reset to first page
    }));
  };

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    patientId: string
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedPatient(patientId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPatient(null);
  };

  const handleDeletePatient = async () => {
    if (selectedPatient) {
      try {
        await deletePatientMutation.mutateAsync(selectedPatient);
        handleMenuClose();
      } catch (error) {
        console.error('Failed to delete patient:', error);
      }
    }
  };

  const handleViewPatient = (patientId: string) => {
    // If we're in select mode with returnTo, navigate back with selected patient
    if (isSelectMode && returnTo) {
      const separator = returnTo.includes('?') ? '&' : '?';
      navigate(`${returnTo}${separator}selectedPatient=${patientId}`);
    }
    // If we're selecting a patient for medications, navigate to the medications page
    else if (isForMedications) {
      navigate(`/patients/${patientId}/medications`);
    } else if (isForDiagnostics) {
      // Navigate back to diagnostic case creation with selected patient
      navigate(`/pharmacy/diagnostics/case/new?selectedPatient=${patientId}`);
    } else if (isForLabIntegration) {
      // Navigate back to lab integration case creation with selected patient
      navigate(`/pharmacy/lab-integration/new?selectedPatient=${patientId}`);
    } else {
      navigate(`/patients/${patientId}`);
    }
    handleMenuClose();
  };

  const handleEditPatient = (patientId: string) => {
    navigate(`/patients/${patientId}/edit`);
    handleMenuClose();
  };

  // Utility functions
  const calculateAge = (dob?: string): number | null => {
    if (!dob) return null;

    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  const formatNigerianPhone = (phone?: string): string => {
    if (!phone) return 'N/A';
    // Format Nigerian E.164 numbers (+234XXXXXXXXXX) to readable format
    if (phone.startsWith('+234')) {
      const number = phone.slice(4);
      return `+234 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(
        6
      )}`;
    }
    return phone;
  };

  const getDisplayName = (patient: Patient): string => {
    return patient.displayName || `${patient.firstName} ${patient.lastName}`;
  };

  const getPatientAge = (patient: Patient): string => {
    if (patient.age !== undefined) return `${patient.age} years`;
    if (patient.calculatedAge !== undefined)
      return `${patient.calculatedAge} years`;

    const calculatedAge = calculateAge(patient.dob);
    return calculatedAge ? `${calculatedAge} years` : 'Unknown';
  };

  // Loading and error states
  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Failed to load patients</Typography>
          <Typography variant="body2">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred while loading patient data.'}
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Helper message for selection modes */}
      {(isForMedications || isForDiagnostics || isForLabIntegration || isSelectMode) && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            display: 'flex',
            alignItems: 'center',
          }}
          icon={<LocalHospitalIcon fontSize="inherit" />}
        >
          <Box sx={{ fontWeight: 'medium' }}>Patient Selection Mode</Box>
          <Typography variant="body2">
            {isForMedications
              ? 'Select a patient from the list below to manage their medications. Click the "Select" button in the Actions column to proceed.'
              : isForDiagnostics
                ? 'Select a patient from the list below to create a diagnostic case. Click the "Select" button in the Actions column to proceed.'
                : isForLabIntegration
                  ? 'Select a patient from the list below to create a lab integration case. Click the "Select" button in the Actions column to proceed.'
                  : 'Select a patient from the list below. Click the "Select" button in the Actions column to proceed.'}
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 600,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <LocalHospitalIcon color="primary" />
            {isForMedications
              ? 'Select a Patient for Medications'
              : isForDiagnostics
                ? 'Select a Patient for Diagnostic Case'
                : isForLabIntegration
                  ? 'Select a Patient for Lab Integration'
                  : isSelectMode
                    ? 'Select a Patient'
                    : 'Patient Management'}
          </Typography>
          <Typography component="div" variant="body1" color="text.secondary">
            {isForMedications
              ? 'Click on any patient to manage their medications'
              : isForDiagnostics
                ? 'Click on any patient to create a diagnostic case'
                : isForLabIntegration
                  ? 'Click on any patient to create a lab integration case'
                  : isSelectMode
                    ? 'Click on any patient to select them'
                    : 'Comprehensive patient care and medical records management'}
            {totalPatients > 0 && (
              <Chip
                label={`${totalPatients} total patients`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            sx={{ borderRadius: 2 }}
          >
            {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            sx={{ borderRadius: 2, py: 1.5, px: 3 }}
            onClick={() => navigate('/patients/new')}
          >
            Add New Patient
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Quick Search */}
          <Box
            sx={{ display: 'flex', gap: 2, mb: showAdvancedFilters ? 3 : 0 }}
          >
            <TextField
              placeholder="Search patients by name, MRN, phone, or email..."
              variant="outlined"
              value={quickSearch}
              onChange={(e) => handleQuickSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 300 }}
            />
          </Box>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 2,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Autocomplete
                options={NIGERIAN_STATES}
                value={searchParams.state || null}
                onChange={(_, value) =>
                  handleAdvancedFilter({ state: value || undefined })
                }
                renderInput={(params) => (
                  <TextField {...params} label="State" size="small" />
                )}
              />

              <FormControl size="small">
                <InputLabel>Blood Group</InputLabel>
                <Select
                  value={searchParams.bloodGroup || ''}
                  label="Blood Group"
                  onChange={(e) =>
                    handleAdvancedFilter({
                      bloodGroup: (e.target.value as BloodGroup) || undefined,
                    })
                  }
                >
                  <MenuItem value="">All Blood Groups</MenuItem>
                  {BLOOD_GROUPS.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel>Genotype</InputLabel>
                <Select
                  value={searchParams.genotype || ''}
                  label="Genotype"
                  onChange={(e) =>
                    handleAdvancedFilter({
                      genotype: (e.target.value as Genotype) || undefined,
                    })
                  }
                >
                  <MenuItem value="">All Genotypes</MenuItem>
                  {GENOTYPES.map((genotype) => (
                    <MenuItem key={genotype} value={genotype}>
                      {genotype}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="MRN"
                size="small"
                value={searchParams.mrn || ''}
                onChange={(e) =>
                  handleAdvancedFilter({ mrn: e.target.value || undefined })
                }
                placeholder="PHM-LAG-001"
              />

              <TextField
                label="Phone Number"
                size="small"
                value={searchParams.phone || ''}
                onChange={(e) =>
                  handleAdvancedFilter({ phone: e.target.value || undefined })
                }
                placeholder="+234812345678"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>MRN</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Age/Gender</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Medical Info</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>MTR Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Vitals</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: searchParams.limit || 10 }).map(
                  (_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 9 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" height={40} />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                )
              ) : patients.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6 }}>
                    <Stack spacing={2} alignItems="center">
                      <LocalHospitalIcon
                        sx={{ fontSize: 48, color: 'text.secondary' }}
                      />
                      <Typography variant="h6" color="text.secondary">
                        No patients found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {quickSearch || Object.keys(searchParams).length > 2
                          ? 'Try adjusting your search or filter criteria'
                          : 'Add your first patient to get started with patient management'}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<PersonAddIcon />}
                        sx={{ mt: 2 }}
                        onClick={() => navigate('/patients/new')}
                      >
                        Add First Patient
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                // Patient data rows
                patients.map((patient: Patient) => (
                  <TableRow
                    key={patient._id}
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor:
                          isForMedications || isForDiagnostics
                            ? 'primary.lighter'
                            : 'action.hover',
                        transition: 'background-color 0.2s ease',
                      },
                      cursor:
                        isForMedications || isForDiagnostics
                          ? 'pointer'
                          : 'default',
                      bgcolor:
                        isForMedications || isForDiagnostics
                          ? 'rgba(25, 118, 210, 0.04)'
                          : 'inherit',
                    }}
                    onClick={
                      isForMedications || isForDiagnostics
                        ? () => handleViewPatient(patient._id)
                        : undefined
                    }
                  >
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: 'primary.main',
                            width: 40,
                            height: 40,
                          }}
                        >
                          {getInitials(patient.firstName, patient.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getDisplayName(patient)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {patient.otherNames && `(${patient.otherNames})`}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, fontFamily: 'monospace' }}
                      >
                        {patient.mrn}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {getPatientAge(patient)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.gender
                          ? patient.gender.charAt(0).toUpperCase() +
                          patient.gender.slice(1)
                          : 'Unknown'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {formatNigerianPhone(patient.phone)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.email || 'No email'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {patient.state || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.lga || 'Unknown LGA'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {patient.bloodGroup && (
                          <Chip
                            label={patient.bloodGroup}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        )}
                        {patient.genotype && (
                          <Chip
                            label={patient.genotype}
                            size="small"
                            color={
                              patient.genotype.includes('S')
                                ? 'warning'
                                : 'success'
                            }
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        )}
                        {patient.hasActiveDTP && (
                          <Chip
                            label="DTP"
                            size="small"
                            color="error"
                            icon={<WarningIcon sx={{ fontSize: 14 }} />}
                            sx={{ fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    <TableCell>
                      {/* Temporarily disabled to prevent excessive API calls */}
                      <Chip
                        label="MTR Available"
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    </TableCell>

                    <TableCell>
                      {patient.latestVitals ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            BP: {patient.latestVitals.bpSys}/
                            {patient.latestVitals.bpDia} mmHg
                          </Typography>
                          {patient.weightKg && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              Weight: {patient.weightKg}kg
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No vitals recorded
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          justifyContent: 'center',
                        }}
                      >
                        {/* Check if we're in selection mode */}
                        {isForMedications || isForDiagnostics || isForLabIntegration || isSelectMode ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click from triggering
                              handleViewPatient(patient._id);
                            }}
                            startIcon={<LocalHospitalIcon />}
                          >
                            Select
                          </Button>
                        ) : (
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewPatient(patient._id)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit Patient">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditPatient(patient._id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More Actions">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, patient._id)}
                            color="primary"
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalPatients}
          page={currentPage}
          onPageChange={handlePageChange}
          rowsPerPage={searchParams.limit || 10}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
          }
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { minWidth: 180 },
        }}
      >
        <MenuItem
          onClick={() => selectedPatient && handleViewPatient(selectedPatient)}
        >
          <VisibilityIcon sx={{ mr: 1, fontSize: 18 }} />
          View Patient Profile
        </MenuItem>
        <MenuItem
          onClick={() => selectedPatient && handleEditPatient(selectedPatient)}
        >
          <EditIcon sx={{ mr: 1, fontSize: 18 }} />
          Edit Patient Info
        </MenuItem>
        {permissions.canDelete && (
          <MenuItem
            onClick={handleDeletePatient}
            sx={{ color: 'error.main' }}
            disabled={deletePatientMutation.isPending}
          >
            {deletePatientMutation.isPending ? (
              <CircularProgress size={18} sx={{ mr: 1 }} />
            ) : (
              <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
            )}
            Delete Patient
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default Patients;
