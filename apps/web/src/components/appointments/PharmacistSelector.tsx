import React, { useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import { 
  Person as PersonIcon,
  LocalPharmacy as PharmacyIcon,
  School as SchoolIcon,
} from '@mui/icons-material';

import { useWorkspaceMembers } from '../../queries/useWorkspaceTeam';
import type { Member } from '../../types/workspace';

// Pharmacist interface based on workspace member
interface Pharmacist {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string;
  specializations?: string[];
  isAvailable?: boolean;
  workingHours?: {
    start: string;
    end: string;
  };
}

interface PharmacistSelectorProps {
  value: Pharmacist | null;
  onChange: (pharmacist: Pharmacist | null) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  filterByAvailability?: boolean;
  appointmentDate?: Date;
  appointmentTime?: string;
}

const PharmacistSelector: React.FC<PharmacistSelectorProps> = ({
  value,
  onChange,
  label = 'Assign Pharmacist',
  placeholder = 'Select a pharmacist or leave empty for auto-assignment',
  error = false,
  helperText = 'If not selected, appointment will be auto-assigned based on availability',
  required = false,
  disabled = false,
  fullWidth = true,
  filterByAvailability = false,
  appointmentDate,
  appointmentTime,
}) => {
  // Fetch workspace members (pharmacists and staff)
  const { data: membersData, isLoading: loadingMembers } = useWorkspaceMembers(
    { status: 'active' }, // Only fetch active members
    { page: 1, limit: 100 }
  );

  // Transform workspace members to pharmacist format
  const allPharmacists: Pharmacist[] = useMemo(() => {
    if (!membersData?.members) return [];
    
    return membersData.members
      .filter((member: Member) => 
        // Include Pharmacists, Staff, and Owners (they can handle appointments)
        ['Pharmacist', 'Staff', 'Owner'].includes(member.workplaceRole)
      )
      .map((member: Member) => ({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.workplaceRole,
        email: member.email,
        isAvailable: member.status === 'active',
        // Default working hours - in real app, this would come from user preferences
        workingHours: { start: '08:00', end: '18:00' },
      }));
  }, [membersData]);

  // Filter pharmacists based on availability if needed
  const availablePharmacists = useMemo(() => {
    if (!filterByAvailability) {
      return allPharmacists;
    }

    return allPharmacists.filter(pharmacist => {
      // Basic availability check
      if (!pharmacist.isAvailable) {
        return false;
      }

      // Check working hours if appointment time is provided
      if (appointmentTime && pharmacist.workingHours) {
        const appointmentHour = parseInt(appointmentTime.split(':')[0]);
        const startHour = parseInt(pharmacist.workingHours.start.split(':')[0]);
        const endHour = parseInt(pharmacist.workingHours.end.split(':')[0]);
        
        if (appointmentHour < startHour || appointmentHour >= endHour) {
          return false;
        }
      }

      return true;
    });
  }, [allPharmacists, filterByAvailability, appointmentTime]);

  // Get option label
  const getOptionLabel = (option: Pharmacist) => {
    return `${option.firstName} ${option.lastName}`;
  };

  // Check if options are equal
  const isOptionEqualToValue = (option: Pharmacist, value: Pharmacist) => {
    return option._id === value._id;
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    if (role.toLowerCase().includes('intern')) {
      return <SchoolIcon fontSize="small" />;
    }
    return <PharmacyIcon fontSize="small" />;
  };

  // Get role color
  const getRoleColor = (role: string) => {
    if (role.toLowerCase().includes('senior')) {
      return 'primary';
    }
    if (role.toLowerCase().includes('clinical')) {
      return 'secondary';
    }
    if (role.toLowerCase().includes('intern')) {
      return 'warning';
    }
    return 'default';
  };

  // Render option
  const renderOption = (props: React.HTMLAttributes<HTMLLIElement>, option: Pharmacist) => (
    <Box component="li" {...props}>
      <Box display="flex" alignItems="center" gap={2} width="100%">
        <Avatar 
          sx={{ 
            width: 40, 
            height: 40, 
            bgcolor: option.isAvailable ? 'success.main' : 'grey.400' 
          }}
        >
          <PersonIcon />
        </Avatar>
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="body1" fontWeight="medium">
              {option.firstName} {option.lastName}
            </Typography>
            <Chip
              icon={getRoleIcon(option.role)}
              label={option.role}
              size="small"
              color={getRoleColor(option.role) as any}
              variant="outlined"
            />
            {!option.isAvailable && (
              <Chip
                label="Unavailable"
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Box>
          
          {option.specializations && option.specializations.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Specializations: {option.specializations.join(', ')}
            </Typography>
          )}
          
          {option.workingHours && (
            <Typography variant="caption" color="text.secondary" display="block">
              Working Hours: {option.workingHours.start} - {option.workingHours.end}
            </Typography>
          )}
          
          {option.email && (
            <Typography variant="caption" color="text.secondary" display="block">
              {option.email}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );

  // Render input
  const renderInput = (params: any) => (
    <TextField
      {...params}
      label={label}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      required={required}
      InputProps={{
        ...params.InputProps,
        endAdornment: (
          <>
            {loadingMembers && <CircularProgress size={20} />}
            {params.InputProps.endAdornment}
          </>
        ),
      }}
    />
  );

  // Handle change
  const handleChange = (event: React.SyntheticEvent, newValue: Pharmacist | null) => {
    onChange(newValue);
  };

  return (
    <Autocomplete
      value={value}
      onChange={handleChange}
      options={availablePharmacists}
      loading={loadingMembers}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      renderOption={renderOption}
      renderInput={renderInput}
      fullWidth={fullWidth}
      disabled={disabled || loadingMembers}
      noOptionsText={
        loadingMembers
          ? 'Loading pharmacists...'
          : filterByAvailability 
          ? 'No pharmacists available for the selected time'
          : 'No pharmacists found'
      }
      groupBy={(option) => option.role}
    />
  );
};

export default PharmacistSelector;