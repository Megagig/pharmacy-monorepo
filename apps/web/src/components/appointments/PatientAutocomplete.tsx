import React, { useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { format } from 'date-fns';

import { useSearchPatients } from '../../queries/usePatients';
import { Patient } from '../../types/patientManagement';

interface PatientAutocompleteProps {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  onInputChange?: (searchTerm: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const PatientAutocomplete: React.FC<PatientAutocompleteProps> = ({
  value,
  onChange,
  onInputChange,
  label = 'Search and Select Patient',
  placeholder = 'Type patient name or MRN...',
  error = false,
  helperText,
  required = false,
  disabled = false,
  fullWidth = true,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  // Patient search query
  const {
    data: patientSearchResults,
    isLoading: searchingPatients,
    refetch: searchPatients,
  } = useSearchPatients(searchTerm, {
    enabled: searchTerm.length >= 2,
  });

  // Get available patients for autocomplete
  const availablePatients = useMemo(() => {
    return patientSearchResults?.data?.results || [];
  }, [patientSearchResults]);

  // Handle input change
  const handleInputChange = (event: React.SyntheticEvent, newInputValue: string) => {
    setSearchTerm(newInputValue);
    onInputChange?.(newInputValue);
    
    // Trigger search if input is long enough
    if (newInputValue.length >= 2) {
      searchPatients();
    }
  };

  // Handle selection change
  const handleChange = (event: React.SyntheticEvent, newValue: Patient | null) => {
    onChange(newValue);
  };

  // Get option label
  const getOptionLabel = (option: Patient) => {
    return `${option.firstName} ${option.lastName} (MRN: ${option.mrn})`;
  };

  // Check if options are equal
  const isOptionEqualToValue = (option: Patient, value: Patient) => {
    return option._id === value._id;
  };

  // Render option
  const renderOption = (props: React.HTMLAttributes<HTMLLIElement>, option: Patient) => (
    <Box component="li" {...props}>
      <Box display="flex" alignItems="center" gap={2} width="100%">
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
          <PersonIcon fontSize="small" />
        </Avatar>
        <Box flex={1}>
          <Typography variant="body1" fontWeight="medium">
            {option.firstName} {option.lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            MRN: {option.mrn}
            {option.dateOfBirth && (
              <> | DOB: {format(new Date(option.dateOfBirth), 'MMM dd, yyyy')}</>
            )}
            {option.phone && <> | Phone: {option.phone}</>}
          </Typography>
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
            {searchingPatients && <CircularProgress size={20} />}
            {params.InputProps.endAdornment}
          </>
        ),
      }}
    />
  );

  return (
    <Autocomplete
      value={value}
      onChange={handleChange}
      onInputChange={handleInputChange}
      options={availablePatients}
      loading={searchingPatients}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      renderOption={renderOption}
      renderInput={renderInput}
      fullWidth={fullWidth}
      disabled={disabled}
      filterOptions={(x) => x} // Disable client-side filtering since we use server-side search
      noOptionsText={
        searchTerm.length < 2 
          ? 'Type at least 2 characters to search'
          : searchingPatients 
          ? 'Searching...'
          : 'No patients found'
      }
      loadingText="Searching patients..."
    />
  );
};

export default PatientAutocomplete;