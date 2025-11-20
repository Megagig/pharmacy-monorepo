import React, { useState, useMemo, useCallback } from 'react';
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
  Chip,
  Alert,
  Stack,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { VirtualizedPatientList } from '../components/virtualized/VirtualizedPatientList';
import { VirtualizedDataTable } from '../components/virtualized/VirtualizedDataTable';
import { MobileOptimizedVirtualList } from '../components/virtualized/MobileOptimizedVirtualList';
import { useVirtualizedPatients } from '../hooks/useVirtualizedList';
import { useRBAC } from '../hooks/useRBAC';
import { getNigerianStates } from '../utils/nigeriaLocationData';
import type {
  Patient,
  PatientSearchParams,
  NigerianState,
  BloodGroup,
  Genotype,
} from '../types/patientManagement';
import type { ColumnDef } from '@tanstack/react-table';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES: Genotype[] = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'];

// View modes
type ViewMode = 'list' | 'table' | 'mobile';

const VirtualizedPatientsPage: React.FC = () => {
  // Get Nigerian states from the library
  const NIGERIAN_STATES = getNigerianStates();

  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const isForMedications = urlParams.get('for') === 'medications';
  const isForDiagnostics = urlParams.get('for') === 'diagnostics';
  const isForLabIntegration = urlParams.get('for') === 'lab-integration';

  // RBAC permissions
  const { permissions } = useRBAC();

  // State management
  const [searchParams, setSearchParams] = useState<PatientSearchParams>({
    page: 1,
    limit: 50, // Larger page size for virtualization
  });
  const [quickSearch, setQuickSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [useVirtualization, setUseVirtualization] = useState(true);

  // Use virtualized patients hook
  const {
    items: patients,
    totalCount,
    isLoading,
    isError,
    error,
    hasNextPage,
    isLoadingNextPage,
    loadNextPage,
    metrics,
  } = useVirtualizedPatients(searchParams);

  // Utility functions
  const calculateAge = useCallback((dob?: string): number | null => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, []);

  const getInitials = useCallback((firstName: string, lastName: string): string => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  }, []);

  const formatNigerianPhone = useCallback((phone?: string): string => {
    if (!phone) return 'N/A';
    if (phone.startsWith('+234')) {
      const number = phone.slice(4);
      return `+234 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
    }
    return phone;
  }, []);

  const getDisplayName = useCallback((patient: Patient): string => {
    return patient.displayName || `${patient.firstName} ${patient.lastName}`;
  }, []);

  const getPatientAge = useCallback((patient: Patient): string => {
    if (patient.age !== undefined) return `${patient.age} years`;
    if (patient.calculatedAge !== undefined) return `${patient.calculatedAge} years`;
    const calculatedAge = calculateAge(patient.dob);
    return calculatedAge ? `${calculatedAge} years` : 'Unknown';
  }, [calculateAge]);

  // Event handlers
  const handleQuickSearch = useCallback((value: string) => {
    setQuickSearch(value);
    setSearchParams(prev => ({
      ...prev,
      q: value || undefined,
      page: 1,
    }));
  }, []);

  const handleAdvancedFilter = useCallback((filters: Partial<PatientSearchParams>) => {
    setSearchParams(prev => ({
      ...prev,
      ...filters,
      page: 1,
    }));
  }, []);

  const handlePatientSelect = useCallback((patient: Patient) => {
    if (isForMedications) {
      navigate(`/patients/${patient._id}/medications`);
    } else if (isForDiagnostics) {
      navigate(`/pharmacy/diagnostics/case/new?selectedPatient=${patient._id}`);
    } else if (isForLabIntegration) {
      navigate(`/pharmacy/lab-integration/new?selectedPatient=${patient._id}`);
    } else {
      navigate(`/patients/${patient._id}`);
    }
  }, [navigate, isForMedications, isForDiagnostics, isForLabIntegration]);

  const handlePatientEdit = useCallback((patient: Patient) => {
    navigate(`/patients/${patient._id}/edit`);
  }, [navigate]);

  const handlePatientView = useCallback((patient: Patient) => {
    navigate(`/patients/${patient._id}`);
  }, [navigate]);

  // Table columns for virtualized data table
  const tableColumns = useMemo<ColumnDef<Patient>[]>(() => [
    {
      accessorKey: 'displayName',
      header: 'Patient Name',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {getInitials(patient.firstName, patient.lastName)}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {getDisplayName(patient)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {patient.mrn}
              </Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      accessorKey: 'age',
      header: 'Age/Gender',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <Box>
            <Typography variant="body2">{getPatientAge(patient)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {patient.gender || 'Unknown'}
            </Typography>
          </Box>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <Box>
            <Typography variant="body2">{formatNigerianPhone(patient.phone)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {patient.email || 'No email'}
            </Typography>
          </Box>
        );
      },
    },
    {
      accessorKey: 'state',
      header: 'Location',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <Box>
            <Typography variant="body2">{patient.state || 'Unknown'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {patient.lga || 'Unknown LGA'}
            </Typography>
          </Box>
        );
      },
    },
    {
      accessorKey: 'bloodGroup',
      header: 'Medical Info',
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <Stack direction="row" spacing={0.5}>
            {patient.bloodGroup && (
              <Chip
                label={patient.bloodGroup}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {patient.genotype && (
              <Chip
                label={patient.genotype}
                size="small"
                color={patient.genotype.includes('S') ? 'warning' : 'success'}
                variant="outlined"
              />
            )}
          </Stack>
        );
      },
    },
  ], [getInitials, getDisplayName, getPatientAge, formatNigerianPhone]);

  // Mobile list item renderer
  const renderMobileItem = useCallback((patient: Patient, index: number) => (
    <Card
      sx={{
        cursor: 'pointer',
        '&:hover': { elevation: 3 },
        bgcolor: isForMedications || isForDiagnostics ? 'rgba(25, 118, 210, 0.04)' : 'inherit',
      }}
      onClick={() => handlePatientSelect(patient)}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {getInitials(patient.firstName, patient.lastName)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {getDisplayName(patient)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {patient.mrn} • {getPatientAge(patient)} • {patient.gender}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNigerianPhone(patient.phone)}
            </Typography>
          </Box>
          <Stack spacing={0.5}>
            {patient.bloodGroup && (
              <Chip label={patient.bloodGroup} size="small" color="primary" variant="outlined" />
            )}
            {patient.genotype && (
              <Chip
                label={patient.genotype}
                size="small"
                color={patient.genotype.includes('S') ? 'warning' : 'success'}
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  ), [getInitials, getDisplayName, getPatientAge, formatNigerianPhone, handlePatientSelect, isForMedications, isForDiagnostics]);

  // Error state
  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Failed to load patients</Typography>
          <Typography variant="body2">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </Typography>
        </Alert>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Helper message for selection modes */}
      {(isForMedications || isForDiagnostics) && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<LocalHospitalIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
            Patient Selection Mode
          </Typography>
          <Typography variant="body2">
            {isForMedications
              ? 'Select a patient to manage their medications.'
              : 'Select a patient to create a diagnostic case.'}
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalHospitalIcon color="primary" />
            {isForMedications
              ? 'Select Patient for Medications'
              : isForDiagnostics
                ? 'Select Patient for Diagnostic Case'
                : 'Virtualized Patient Management'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            High-performance patient list with virtualization
            {totalCount > 0 && (
              <Chip
                label={`${totalCount} total patients`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          {/* Performance metrics */}
          <Tooltip title={`Cache Hit Ratio: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`}>
            <Chip
              icon={<SpeedIcon />}
              label={`${metrics.totalItems} items`}
              size="small"
              color="success"
              variant="outlined"
            />
          </Tooltip>

          {/* View mode toggles */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="List View">
              <IconButton
                size="small"
                color={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => setViewMode('list')}
              >
                <ViewListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Table View">
              <IconButton
                size="small"
                color={viewMode === 'table' ? 'primary' : 'default'}
                onClick={() => setViewMode('table')}
              >
                <ViewModuleIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? 'Hide Filters' : 'Filters'}
          </Button>

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate('/patients/new')}
          >
            Add Patient
          </Button>
        </Stack>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: showAdvancedFilters ? 3 : 0, alignItems: 'center' }}>
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

            <FormControlLabel
              control={
                <Switch
                  checked={useVirtualization}
                  onChange={(e) => setUseVirtualization(e.target.checked)}
                />
              }
              label="Virtualization"
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
                onChange={(_, value) => handleAdvancedFilter({ state: value || undefined })}
                renderInput={(params) => <TextField {...params} label="State" size="small" />}
              />

              <FormControl size="small">
                <InputLabel>Blood Group</InputLabel>
                <Select
                  value={searchParams.bloodGroup || ''}
                  label="Blood Group"
                  onChange={(e) => handleAdvancedFilter({ bloodGroup: (e.target.value as BloodGroup) || undefined })}
                >
                  <MenuItem value="">All Blood Groups</MenuItem>
                  {BLOOD_GROUPS.map((group) => (
                    <MenuItem key={group} value={group}>{group}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel>Genotype</InputLabel>
                <Select
                  value={searchParams.genotype || ''}
                  label="Genotype"
                  onChange={(e) => handleAdvancedFilter({ genotype: (e.target.value as Genotype) || undefined })}
                >
                  <MenuItem value="">All Genotypes</MenuItem>
                  {GENOTYPES.map((genotype) => (
                    <MenuItem key={genotype} value={genotype}>{genotype}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="MRN"
                size="small"
                value={searchParams.mrn || ''}
                onChange={(e) => handleAdvancedFilter({ mrn: e.target.value || undefined })}
                placeholder="PHM-LAG-001"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Virtualized Content */}
      <Card>
        {useVirtualization ? (
          <>
            {viewMode === 'list' && (
              <VirtualizedPatientList
                patients={patients}
                loading={isLoading}
                hasNextPage={hasNextPage}
                isNextPageLoading={isLoadingNextPage}
                loadNextPage={loadNextPage}
                onPatientSelect={handlePatientSelect}
                onPatientEdit={handlePatientEdit}
                onPatientView={handlePatientView}
                isSelectionMode={isForMedications || isForDiagnostics}
                height={600}
                itemHeight={120}
              />
            )}

            {viewMode === 'table' && (
              <VirtualizedDataTable
                data={patients}
                columns={tableColumns}
                loading={isLoading}
                hasNextPage={hasNextPage}
                isNextPageLoading={isLoadingNextPage}
                loadNextPage={loadNextPage}
                height={600}
                rowHeight={72}
                enableSorting={true}
                emptyMessage="No patients found"
              />
            )}

            {viewMode === 'mobile' && (
              <MobileOptimizedVirtualList
                items={patients}
                loading={isLoading}
                hasNextPage={hasNextPage}
                isNextPageLoading={isLoadingNextPage}
                loadNextPage={loadNextPage}
                renderItem={renderMobileItem}
                height={600}
                estimatedItemSize={100}
                emptyMessage="No patients found"
                emptyIcon={<LocalHospitalIcon sx={{ fontSize: 48, color: 'text.secondary' }} />}
              />
            )}
          </>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Non-virtualized view disabled for performance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enable virtualization to view large datasets efficiently
            </Typography>
          </Box>
        )}
      </Card>

      {/* Performance Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card sx={{ mt: 2, bgcolor: 'grey.50' }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Performance Metrics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Items</Typography>
                <Typography variant="body2">{metrics.totalItems}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Loaded Pages</Typography>
                <Typography variant="body2">{metrics.loadedPages}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Avg Page Size</Typography>
                <Typography variant="body2">{Math.round(metrics.averagePageSize)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Cache Hit Ratio</Typography>
                <Typography variant="body2">{(metrics.cacheHitRatio * 100).toFixed(1)}%</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default VirtualizedPatientsPage;