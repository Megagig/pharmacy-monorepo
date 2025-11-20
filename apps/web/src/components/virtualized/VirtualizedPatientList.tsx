import React, { useMemo, useCallback, forwardRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { InfiniteLoader } from 'react-window-infinite-loader';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Stack,
  Skeleton,
  Button,
  Tooltip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningIcon from '@mui/icons-material/Warning';
import type { Patient } from '../../types/patientManagement';

interface VirtualizedPatientListProps {
  patients: Patient[];
  loading?: boolean;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => Promise<void>;
  onPatientSelect?: (patient: Patient) => void;
  onPatientEdit?: (patient: Patient) => void;
  onPatientView?: (patient: Patient) => void;
  isSelectionMode?: boolean;
  height?: number;
  itemHeight?: number;
}

interface PatientItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    patients: Patient[];
    onPatientSelect?: (patient: Patient) => void;
    onPatientEdit?: (patient: Patient) => void;
    onPatientView?: (patient: Patient) => void;
    isSelectionMode?: boolean;
    isItemLoaded: (index: number) => boolean;
  };
}

// Individual patient item component
const PatientItem = React.memo(({ index, style, data }: PatientItemProps) => {
  const {
    patients,
    onPatientSelect,
    onPatientEdit,
    onPatientView,
    isSelectionMode,
    isItemLoaded,
  } = data;

  const isLoaded = isItemLoaded(index);
  const patient = patients[index];

  // Utility functions
  const calculateAge = useCallback((dob?: string): number | null => {
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

  // Loading skeleton
  if (!isLoaded) {
    return (
      <div style={style}>
        <Card sx={{ m: 1, height: 'calc(100% - 16px)' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Skeleton variant="circular" width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="80%" height={20} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="circular" width={32} height={32} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={style}>
        <Card sx={{ m: 1, height: 'calc(100% - 16px)' }}>
          <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading patient...</Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={style}>
      <Card
        sx={{
          m: 1,
          height: 'calc(100% - 16px)',
          cursor: isSelectionMode ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          '&:hover': {
            elevation: 3,
            bgcolor: isSelectionMode ? 'primary.lighter' : 'action.hover',
          },
          bgcolor: isSelectionMode ? 'rgba(25, 118, 210, 0.04)' : 'inherit',
        }}
        onClick={isSelectionMode ? () => onPatientSelect?.(patient) : undefined}
      >
        <CardContent sx={{ p: 2, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            {/* Avatar */}
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 48,
                height: 48,
                fontSize: '1.2rem',
                fontWeight: 600,
              }}
            >
              {getInitials(patient.firstName, patient.lastName)}
            </Avatar>

            {/* Patient Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  mb: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getDisplayName(patient)}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontFamily: 'monospace',
                  mb: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                MRN: {patient.mrn}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2">
                  {getPatientAge(patient)} • {patient.gender || 'Unknown'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatNigerianPhone(patient.phone)}
                </Typography>
              </Box>

              {/* Medical Info Chips */}
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {patient.bloodGroup && (
                  <Chip
                    label={patient.bloodGroup}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
                {patient.genotype && (
                  <Chip
                    label={patient.genotype}
                    size="small"
                    color={patient.genotype.includes('S') ? 'warning' : 'success'}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
                {patient.hasActiveDTP && (
                  <Chip
                    label="DTP"
                    size="small"
                    color="error"
                    icon={<WarningIcon sx={{ fontSize: 12 }} />}
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
              </Stack>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {isSelectionMode ? (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPatientSelect?.(patient);
                  }}
                  startIcon={<LocalHospitalIcon />}
                  sx={{ fontSize: '0.75rem', py: 0.5, px: 1 }}
                >
                  Select
                </Button>
              ) : (
                <Tooltip title="View Details">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onPatientView?.(patient)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Edit Patient">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onPatientEdit?.(patient)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
});

PatientItem.displayName = 'PatientItem';

// Main virtualized patient list component
export const VirtualizedPatientList: React.FC<VirtualizedPatientListProps> = ({
  patients,
  loading = false,
  hasNextPage = false,
  isNextPageLoading = false,
  loadNextPage,
  onPatientSelect,
  onPatientEdit,
  onPatientView,
  isSelectionMode = false,
  height = 600,
  itemHeight = 120,
}) => {
  // Calculate total item count (including loading items)
  const itemCount = hasNextPage ? patients.length + 1 : patients.length;

  // Check if an item is loaded
  const isItemLoaded = useCallback(
    (index: number) => !!patients[index],
    [patients]
  );

  // Load more items if needed
  const loadMoreItems = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (loadNextPage && !isNextPageLoading) {
        await loadNextPage();
      }
    },
    [loadNextPage, isNextPageLoading]
  );

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(
    () => ({
      patients,
      onPatientSelect,
      onPatientEdit,
      onPatientView,
      isSelectionMode,
      isItemLoaded,
    }),
    [patients, onPatientSelect, onPatientEdit, onPatientView, isSelectionMode, isItemLoaded]
  );

  // Inner element type for react-window
  const innerElementType = forwardRef<HTMLDivElement>(({ style: elementStyle, ...rest }: any, ref: any) => (
    <div
      ref={ref}
      style={{
        ...elementStyle,
        paddingTop: 8,
        paddingBottom: 8,
      }}
      {...rest}
    />
  ));

  if (loading && patients.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
        {Array.from({ length: Math.floor(height / itemHeight) }).map((_, index) => (
          <Card key={index} sx={{ height: itemHeight - 16 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="circular" width={48} height={48} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="40%" height={20} />
                  <Skeleton variant="text" width="80%" height={20} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (patients.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <LocalHospitalIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">
          No patients found
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {isSelectionMode
            ? 'No patients match your search criteria'
            : 'Add your first patient to get started'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: '100%' }}>
      <InfiniteLoader
        isRowLoaded={isItemLoaded}
        rowCount={itemCount}
        loadMoreRows={loadMoreItems}
        threshold={5} // Start loading when 5 items from the end
      >
        {({ onRowsRendered, ref }: any) => (
          <List
            ref={ref}
            width="100%"
            height={height}
            itemCount={itemCount}
            itemSize={itemHeight}
            itemData={itemData}
            onItemsRendered={({ visibleStartIndex, visibleStopIndex }: any) =>
              onRowsRendered({ startIndex: visibleStartIndex, stopIndex: visibleStopIndex })
            }
            innerElementType={innerElementType}
            overscanCount={5} // Render 5 extra items for smooth scrolling
          >
            {PatientItem}
          </List>
        )}
      </InfiniteLoader>
    </Box>
  );
};

export default VirtualizedPatientList;
