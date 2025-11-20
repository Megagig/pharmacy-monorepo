import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';

interface InputProps extends Omit<TextFieldProps, 'variant'> {
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  error,
  helperText,
  ...props
}) => {
  return (
    <TextField
      variant="outlined"
      fullWidth
      error={!!error}
      helperText={error || helperText}
      {...props}
    />
  );
};

export default Input;