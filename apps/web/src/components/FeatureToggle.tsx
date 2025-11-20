import React from 'react';
import {
  Switch,
  FormControlLabel,
  FormControl,
  FormHelperText,
} from '@mui/material';
import useFeatureFlags from '../hooks/useFeatureFlags';

interface FeatureToggleProps {
  featureKey: string;
  label: string;
  description?: string;
  disabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

/**
 * Component that provides a toggle switch for a feature flag
 */
const FeatureToggle: React.FC<FeatureToggleProps> = ({
  featureKey,
  label,
  description,
  disabled = false,
  onChange,
}) => {
  const { featureFlags, isLoading } = useFeatureFlags();

  // Find the feature flag in the list
  const featureFlag = featureFlags.find((flag) => flag.key === featureKey);
  const isEnabled = featureFlag?.isActive || false;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <FormControl component="fieldset" disabled={disabled || isLoading}>
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={handleChange}
            name={featureKey}
            color="primary"
          />
        }
        label={label}
      />
      {description && <FormHelperText>{description}</FormHelperText>}
    </FormControl>
  );
};

export default FeatureToggle;
