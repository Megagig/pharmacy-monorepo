import React from 'react';
import { FormControl, InputLabel, Select as MuiSelect, SelectProps as MuiSelectProps, FormHelperText } from '@mui/material';

interface SelectProps extends Omit<MuiSelectProps, 'variant'> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  children,
  id,
  ...props
}) => {
  return (
    <FormControl fullWidth error={!!error}>
      {label && <InputLabel id={`${id}-label`}>{label}</InputLabel>}
      <MuiSelect
        labelId={label ? `${id}-label` : undefined}
        id={id}
        variant="outlined"
        label={label}
        {...props}
      >
        {children}
      </MuiSelect>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
};

export default Select;