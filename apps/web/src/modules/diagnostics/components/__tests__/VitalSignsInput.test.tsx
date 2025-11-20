import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../../theme';
import VitalSignsInput from '../VitalSignsInput';
import type { VitalSignsInputProps } from '../../types';

// Mock theme
const theme = createAppTheme('light');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('VitalSignsInput Component', () => {
  const defaultProps: VitalSignsInputProps = {
    value: undefined,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with title and description', () => {
      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      expect(screen.getByText('Vital Signs')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Record current vital signs and physiological measurements'
        )
      ).toBeInTheDocument();
    });

    it('renders all vital sign input fields', () => {
      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
      expect(screen.getByText('Heart Rate')).toBeInTheDocument();
      expect(screen.getByText('Temperature')).toBeInTheDocument();
      expect(screen.getByText('Respiratory Rate')).toBeInTheDocument();
      expect(screen.getByText('Blood Glucose')).toBeInTheDocument();
    });

    it('displays reference ranges information', () => {
      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      expect(screen.getByText('Normal Reference Ranges:')).toBeInTheDocument();
      expect(
        screen.getByText(/Blood Pressure: 90-140\/60-90 mmHg/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Heart Rate: 60-100 bpm/)).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      const errorMessage = 'Test error message';
      renderWithTheme(
        <VitalSignsInput {...defaultProps} error={errorMessage} />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('disables inputs when disabled prop is true', () => {
      renderWithTheme(<VitalSignsInput {...defaultProps} disabled={true} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      const hrInput = screen.getByPlaceholderText('72');

      expect(bpInput).toBeDisabled();
      expect(hrInput).toBeDisabled();
    });
  });

  describe('Blood Pressure Input', () => {
    it('allows entering valid blood pressure', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, '120/80');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            bloodPressure: '120/80',
          })
        );
      });
    });

    it('shows normal status for normal blood pressure', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, '110/70');

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
      });
    });

    it('shows high status for elevated blood pressure', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, '160/100');

      await waitFor(() => {
        expect(screen.getByText('High BP')).toBeInTheDocument();
      });
    });

    it('shows low status for low blood pressure', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, '80/50');

      await waitFor(() => {
        expect(screen.getByText('Low BP')).toBeInTheDocument();
      });
    });

    it('validates blood pressure format', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, 'invalid');

      // Trigger validation by blurring
      fireEvent.blur(bpInput);

      await waitFor(() => {
        expect(
          screen.getByText('Format: XXX/XX (e.g., 120/80)')
        ).toBeInTheDocument();
      });
    });

    it('validates systolic higher than diastolic', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bpInput = screen.getByPlaceholderText('120/80');
      await user.type(bpInput, '80/120');

      fireEvent.blur(bpInput);

      await waitFor(() => {
        expect(
          screen.getByText('Systolic pressure should be higher than diastolic')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Heart Rate Input', () => {
    it('allows entering valid heart rate', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      const hrInput = screen.getByPlaceholderText('72');
      await user.type(hrInput, '75');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            heartRate: 75,
          })
        );
      });
    });

    it('shows normal status for normal heart rate', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const hrInput = screen.getByPlaceholderText('72');
      await user.type(hrInput, '75');

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
      });
    });

    it('shows high status for elevated heart rate', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const hrInput = screen.getByPlaceholderText('72');
      await user.type(hrInput, '120');

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });

    it('validates heart rate range', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const hrInput = screen.getByPlaceholderText('72');
      await user.type(hrInput, '300');

      fireEvent.blur(hrInput);

      await waitFor(() => {
        expect(
          screen.getByText('Heart rate should be between 30-220 bpm')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Temperature Input', () => {
    it('allows entering valid temperature', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      const tempInput = screen.getByPlaceholderText('36.5');
      await user.type(tempInput, '37.0');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 37.0,
          })
        );
      });
    });

    it('shows normal status for normal temperature', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const tempInput = screen.getByPlaceholderText('36.5');
      await user.type(tempInput, '36.8');

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
      });
    });

    it('validates temperature range', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const tempInput = screen.getByPlaceholderText('36.5');
      await user.type(tempInput, '50');

      fireEvent.blur(tempInput);

      await waitFor(() => {
        expect(
          screen.getByText('Temperature should be between 32-45°C')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Respiratory Rate Input', () => {
    it('allows entering valid respiratory rate', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      const rrInput = screen.getByPlaceholderText('16');
      await user.type(rrInput, '18');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            respiratoryRate: 18,
          })
        );
      });
    });

    it('validates respiratory rate range', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const rrInput = screen.getByPlaceholderText('16');
      await user.type(rrInput, '100');

      fireEvent.blur(rrInput);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Respiratory rate should be between 5-60 breaths/min'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Blood Glucose Input', () => {
    it('allows entering valid blood glucose', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      const bgInput = screen.getByPlaceholderText('95');
      await user.type(bgInput, '100');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            bloodGlucose: 100,
          })
        );
      });
    });

    it('shows normal status for normal blood glucose', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bgInput = screen.getByPlaceholderText('95');
      await user.type(bgInput, '90');

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
      });
    });

    it('shows hypoglycemia status for low blood glucose', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bgInput = screen.getByPlaceholderText('95');
      await user.type(bgInput, '60');

      await waitFor(() => {
        expect(screen.getByText('Hypoglycemia')).toBeInTheDocument();
      });
    });

    it('shows hyperglycemia status for high blood glucose', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bgInput = screen.getByPlaceholderText('95');
      await user.type(bgInput, '250');

      await waitFor(() => {
        expect(screen.getByText('Hyperglycemia')).toBeInTheDocument();
      });
    });

    it('validates blood glucose range', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      const bgInput = screen.getByPlaceholderText('95');
      await user.type(bgInput, '700');

      fireEvent.blur(bgInput);

      await waitFor(() => {
        expect(
          screen.getByText('Blood glucose should be between 20-600 mg/dL')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Critical Values Warning', () => {
    it('shows critical values warning for abnormal vitals', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      // Enter critical heart rate
      const hrInput = screen.getByPlaceholderText('72');
      await user.type(hrInput, '40');

      await waitFor(() => {
        expect(
          screen.getByText(/Critical Values Detected/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /Some vital signs are outside normal ranges and may require immediate attention/
          )
        ).toBeInTheDocument();
      });
    });

    it('shows critical values warning for high temperature', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      // Enter high temperature
      const tempInput = screen.getByPlaceholderText('36.5');
      await user.type(tempInput, '40');

      await waitFor(() => {
        expect(
          screen.getByText(/Critical Values Detected/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration', () => {
    it('calls onChange with complete vital signs data', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      // Enter multiple vital signs
      await user.type(screen.getByPlaceholderText('120/80'), '130/85');
      await user.type(screen.getByPlaceholderText('72'), '80');
      await user.type(screen.getByPlaceholderText('36.5'), '37.2');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith({
          bloodPressure: '130/85',
          heartRate: 80,
          temperature: 37.2,
        });
      });
    });

    it('handles controlled component updates', () => {
      const initialValue = {
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 36.5,
      };

      const { rerender } = renderWithTheme(
        <VitalSignsInput {...defaultProps} value={initialValue} />
      );

      expect(screen.getByDisplayValue('120/80')).toBeInTheDocument();
      expect(screen.getByDisplayValue('72')).toBeInTheDocument();
      expect(screen.getByDisplayValue('36.5')).toBeInTheDocument();

      const updatedValue = {
        bloodPressure: '140/90',
        heartRate: 85,
        temperature: 37.0,
      };

      rerender(
        <ThemeProvider theme={theme}>
          <VitalSignsInput {...defaultProps} value={updatedValue} />
        </ThemeProvider>
      );

      expect(screen.getByDisplayValue('140/90')).toBeInTheDocument();
      expect(screen.getByDisplayValue('85')).toBeInTheDocument();
      expect(screen.getByDisplayValue('37')).toBeInTheDocument();
    });

    it('filters out empty values when calling onChange', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <VitalSignsInput {...defaultProps} onChange={mockOnChange} />
      );

      // Enter only blood pressure
      await user.type(screen.getByPlaceholderText('120/80'), '120/80');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          bloodPressure: '120/80',
        });
      });

      // Should not include empty fields
      expect(mockOnChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          heartRate: undefined,
          temperature: undefined,
        })
      );
    });

    it('calls onChange with undefined when all fields are empty', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const propsWithValue = {
        ...defaultProps,
        value: { bloodPressure: '120/80' },
        onChange: mockOnChange,
      };

      renderWithTheme(<VitalSignsInput {...propsWithValue} />);

      // Clear the blood pressure field
      const bpInput = screen.getByDisplayValue('120/80');
      await user.clear(bpInput);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(undefined);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and descriptions', () => {
      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      expect(screen.getByLabelText(/Blood Pressure/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Heart Rate/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Temperature/)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      // Tab through inputs
      await user.tab();
      expect(screen.getByPlaceholderText('120/80')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('72')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('36.5')).toHaveFocus();
    });

    it('provides helpful tooltips', async () => {
      const user = userEvent.setup();

      renderWithTheme(<VitalSignsInput {...defaultProps} />);

      // Find info icon and hover
      const infoIcons = screen.getAllByTestId('InfoIcon');
      await user.hover(infoIcons[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Normal: 90-140/60-90 mmHg')
        ).toBeInTheDocument();
      });
    });
  });
});
