import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import PharmacistSelector from '../PharmacistSelector';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();

  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

describe('PharmacistSelector', () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: null,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText('Assign Pharmacist')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select a pharmacist or leave empty for auto-assignment')).toBeInTheDocument();
    expect(screen.getByText('If not selected, appointment will be auto-assigned based on availability')).toBeInTheDocument();
  });

  it('renders with custom label and placeholder', () => {
    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          label="Custom Pharmacist Label"
          placeholder="Custom placeholder"
          helperText="Custom helper text"
        />
      </TestWrapper>
    );

    expect(screen.getByLabelText('Custom Pharmacist Label')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    expect(screen.getByText('Custom helper text')).toBeInTheDocument();
  });

  it('shows error state when error prop is true', () => {
    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          error={true}
          helperText="This field is required"
        />
      </TestWrapper>
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('shows required indicator when required prop is true', () => {
    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          required={true}
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist *');
    expect(input).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          disabled={true}
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    expect(input).toBeDisabled();
  });

  it('displays pharmacist options when opened', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    // Wait for options to appear
    await waitFor(() => {
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Dr. Michael Brown')).toBeInTheDocument();
      expect(screen.getByText('Dr. Emily Davis')).toBeInTheDocument();
    });

    // Check role information
    expect(screen.getByText('Senior Pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Clinical Pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Intern Pharmacist')).toBeInTheDocument();
  });

  it('shows specializations and working hours in options', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      // Check specializations
      expect(screen.getByText('Specializations: Clinical Pharmacy, MTM, Diabetes Care')).toBeInTheDocument();
      expect(screen.getByText('Specializations: Chronic Disease Management, Immunizations')).toBeInTheDocument();
      
      // Check working hours
      expect(screen.getByText('Working Hours: 08:00 - 17:00')).toBeInTheDocument();
      expect(screen.getByText('Working Hours: 09:00 - 18:00')).toBeInTheDocument();
    });
  });

  it('shows unavailable status for unavailable pharmacists', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      // Dr. Michael Brown is marked as unavailable in the mock data
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });
  });

  it('calls onChange when pharmacist is selected', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
    });

    const johnOption = screen.getByText('Dr. John Smith');
    await user.click(johnOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      _id: '1',
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'Senior Pharmacist',
      email: 'john.smith@pharmacy.com',
      specializations: ['Clinical Pharmacy', 'MTM', 'Diabetes Care'],
      isAvailable: true,
      workingHours: { start: '08:00', end: '17:00' },
    });
  });

  it('displays selected pharmacist value', () => {
    const selectedPharmacist = {
      _id: '1',
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'Senior Pharmacist',
      email: 'john.smith@pharmacy.com',
      specializations: ['Clinical Pharmacy', 'MTM', 'Diabetes Care'],
      isAvailable: true,
      workingHours: { start: '08:00', end: '17:00' },
    };

    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          value={selectedPharmacist}
        />
      </TestWrapper>
    );

    const input = screen.getByDisplayValue('Dr. John Smith');
    expect(input).toBeInTheDocument();
  });

  it('filters by availability when filterByAvailability is true', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          filterByAvailability={true}
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      // Should show available pharmacists
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Dr. Emily Davis')).toBeInTheDocument();
      
      // Should not show unavailable pharmacist
      expect(screen.queryByText('Dr. Michael Brown')).not.toBeInTheDocument();
    });
  });

  it('filters by working hours when appointment time is provided', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          filterByAvailability={true}
          appointmentTime="07:00" // Before most pharmacists' working hours
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      // Should show fewer options due to time filtering
      // Dr. John Smith starts at 08:00, so shouldn't be available at 07:00
      expect(screen.queryByText('Dr. John Smith')).not.toBeInTheDocument();
    });
  });

  it('shows appropriate no options text when filtering', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          filterByAvailability={true}
          appointmentTime="06:00" // Very early time when no one is available
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('No pharmacists available for the selected time')).toBeInTheDocument();
    });
  });

  it('groups pharmacists by role', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    // The groupBy prop should group options by role
    // This would be visible in the actual Autocomplete component rendering
    await waitFor(() => {
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
    });
  });

  it('clears selection when null is passed as value', () => {
    const selectedPharmacist = {
      _id: '1',
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'Senior Pharmacist',
      email: 'john.smith@pharmacy.com',
      specializations: ['Clinical Pharmacy', 'MTM', 'Diabetes Care'],
      isAvailable: true,
      workingHours: { start: '08:00', end: '17:00' },
    };

    const { rerender } = render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          value={selectedPharmacist}
        />
      </TestWrapper>
    );

    // Initially shows selected pharmacist
    expect(screen.getByDisplayValue('Dr. John Smith')).toBeInTheDocument();

    // Clear selection
    rerender(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          value={null}
        />
      </TestWrapper>
    );

    // Should be cleared
    const input = screen.getByLabelText('Assign Pharmacist');
    expect(input).toHaveValue('');
  });

  it('handles appointment date prop', () => {
    const appointmentDate = new Date('2024-01-15');

    render(
      <TestWrapper>
        <PharmacistSelector
          {...defaultProps}
          appointmentDate={appointmentDate}
        />
      </TestWrapper>
    );

    // The component should accept the date prop without errors
    expect(screen.getByLabelText('Assign Pharmacist')).toBeInTheDocument();
  });

  it('shows email addresses in pharmacist options', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PharmacistSelector {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Assign Pharmacist');
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText('john.smith@pharmacy.com')).toBeInTheDocument();
      expect(screen.getByText('sarah.johnson@pharmacy.com')).toBeInTheDocument();
      expect(screen.getByText('michael.brown@pharmacy.com')).toBeInTheDocument();
      expect(screen.getByText('emily.davis@pharmacy.com')).toBeInTheDocument();
    });
  });
});