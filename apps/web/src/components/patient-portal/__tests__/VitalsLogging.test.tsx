import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import VitalsLogging from '../VitalsLogging';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('VitalsLogging', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders basic vitals form fields', () => {
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText('Basic Vitals')).toBeInTheDocument();
    expect(screen.getByText('Blood Pressure (mmHg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Systolic')).toBeInTheDocument();
    expect(screen.getByLabelText('Diastolic')).toBeInTheDocument();
    expect(screen.getByLabelText('Heart Rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();
  });

  it('shows advanced measurements when expanded', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Initially hidden
    expect(screen.queryByLabelText('Blood Glucose')).not.toBeInTheDocument();
    
    // Click to expand
    const expandButton = screen.getByText('Advanced Measurements');
    await user.click(expandButton);
    
    // Now visible
    expect(screen.getByLabelText('Blood Glucose')).toBeInTheDocument();
    expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
    expect(screen.getByLabelText('Oxygen Saturation')).toBeInTheDocument();
  });

  it('validates that at least one vital sign is required', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('At least one vital sign measurement is required')).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates blood pressure requires both systolic and diastolic', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Enter only systolic
    const systolicInput = screen.getByLabelText('Systolic');
    await user.type(systolicInput, '120');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Both systolic and diastolic blood pressure values are required')).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid vitals data', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Fill in blood pressure
    const systolicInput = screen.getByLabelText('Systolic');
    const diastolicInput = screen.getByLabelText('Diastolic');
    await user.type(systolicInput, '120');
    await user.type(diastolicInput, '80');
    
    // Fill in heart rate
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    // Fill in notes
    const notesInput = screen.getByLabelText('Notes (Optional)');
    await user.type(notesInput, 'Morning reading');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        heartRate: 72,
        weight: undefined,
        glucose: undefined,
        temperature: undefined,
        oxygenSaturation: undefined,
        notes: 'Morning reading'
      });
    });
  });

  it('shows validation messages for out-of-range values', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Enter very high systolic pressure
    const systolicInput = screen.getByLabelText('Systolic');
    await user.type(systolicInput, '200');
    
    await waitFor(() => {
      expect(screen.getByText(/Value outside normal range/)).toBeInTheDocument();
    });
  });

  it('shows success message after successful submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Fill in valid data
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Vitals logged successfully!')).toBeInTheDocument();
    });
  });

  it('shows error message when submission fails', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Network error'));
    
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Fill in valid data
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('clears form when clear button is clicked', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Fill in some data
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    expect(heartRateInput).toHaveValue(72);
    
    // Click clear button
    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);
    
    expect(heartRateInput).toHaveValue(null);
  });

  it('disables submit button when loading', () => {
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} loading={true} />);
    
    const submitButton = screen.getByText('Saving...');
    expect(submitButton).toBeDisabled();
  });

  it('shows measurement tips', () => {
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText('Measurement Tips')).toBeInTheDocument();
    expect(screen.getByText('• Take blood pressure after 5 minutes of rest')).toBeInTheDocument();
    expect(screen.getByText('• Measure weight at the same time daily')).toBeInTheDocument();
    expect(screen.getByText('• Check glucose as directed by your pharmacist')).toBeInTheDocument();
    expect(screen.getByText('• Record any symptoms or unusual circumstances')).toBeInTheDocument();
  });

  it('validates numeric input ranges', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Test systolic pressure too low
    const systolicInput = screen.getByLabelText('Systolic');
    await user.type(systolicInput, '50');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Systolic pressure too low')).toBeInTheDocument();
    });
  });

  it('handles advanced measurements submission', async () => {
    const user = userEvent.setup();
    renderWithTheme(<VitalsLogging onSubmit={mockOnSubmit} />);
    
    // Expand advanced measurements
    const expandButton = screen.getByText('Advanced Measurements');
    await user.click(expandButton);
    
    // Fill in glucose
    const glucoseInput = screen.getByLabelText('Blood Glucose');
    await user.type(glucoseInput, '110');
    
    // Fill in temperature
    const temperatureInput = screen.getByLabelText('Temperature');
    await user.type(temperatureInput, '36.5');
    
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        bloodPressureSystolic: undefined,
        bloodPressureDiastolic: undefined,
        heartRate: undefined,
        weight: undefined,
        glucose: 110,
        temperature: 36.5,
        oxygenSaturation: undefined,
        notes: undefined
      });
    });
  });
});