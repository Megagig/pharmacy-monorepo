import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import PatientAutocomplete from '../PatientAutocomplete';
import { Patient } from '../../../types/patientManagement';

// Mock the useSearchPatients hook
const mockRefetch = vi.fn();
vi.mock('../../../queries/usePatients', () => ({
  useSearchPatients: vi.fn(() => ({
    data: {
      data: {
        patients: [
          {
            _id: '1',
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN001',
            dateOfBirth: '1990-01-01',
            phone: '+234-123-456-7890',
          },
          {
            _id: '2',
            firstName: 'Jane',
            lastName: 'Smith',
            mrn: 'MRN002',
            dateOfBirth: '1985-05-15',
            phone: '+234-987-654-3210',
          },
        ],
      },
    },
    isLoading: false,
    refetch: mockRefetch,
  })),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('PatientAutocomplete', () => {
  const mockOnChange = vi.fn();
  const mockOnInputChange = vi.fn();

  const defaultProps = {
    value: null,
    onChange: mockOnChange,
    onInputChange: mockOnInputChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText('Search and Select Patient')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type patient name or MRN...')).toBeInTheDocument();
  });

  it('renders with custom label and placeholder', () => {
    render(
      <TestWrapper>
        <PatientAutocomplete
          {...defaultProps}
          label="Custom Patient Label"
          placeholder="Custom placeholder"
        />
      </TestWrapper>
    );

    expect(screen.getByLabelText('Custom Patient Label')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('shows error state when error prop is true', () => {
    render(
      <TestWrapper>
        <PatientAutocomplete
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
        <PatientAutocomplete
          {...defaultProps}
          required={true}
        />
      </TestWrapper>
    );

    // The required prop should be passed to the TextField
    const input = screen.getByLabelText('Search and Select Patient *');
    expect(input).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <TestWrapper>
        <PatientAutocomplete
          {...defaultProps}
          disabled={true}
        />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    expect(input).toBeDisabled();
  });

  it('calls onInputChange when user types', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.type(input, 'John');

    expect(mockOnInputChange).toHaveBeenCalledWith('John');
  });

  it('triggers search when input length is >= 2', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.type(input, 'Jo');

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('does not trigger search when input length is < 2', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.type(input, 'J');

    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('displays patient options when available', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);
    await user.type(input, 'John');

    // Wait for options to appear
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Check that patient details are shown
    expect(screen.getByText('MRN: MRN001')).toBeInTheDocument();
    expect(screen.getByText('MRN: MRN002')).toBeInTheDocument();
  });

  it('calls onChange when patient is selected', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);
    await user.type(input, 'John');

    // Wait for options and select one
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const johnOption = screen.getByText('John Doe');
    await user.click(johnOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      _id: '1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
      dateOfBirth: '1990-01-01',
      phone: '+234-123-456-7890',
    });
  });

  it('displays selected patient value', () => {
    const selectedPatient: Patient = {
      _id: '1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
      dateOfBirth: '1990-01-01',
      phone: '+234-123-456-7890',
      workplaceId: 'workplace1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <TestWrapper>
        <PatientAutocomplete
          {...defaultProps}
          value={selectedPatient}
        />
      </TestWrapper>
    );

    const input = screen.getByDisplayValue('John Doe (MRN: MRN001)');
    expect(input).toBeInTheDocument();
  });

  it('shows loading indicator when searching', () => {
    // Mock loading state
    vi.mocked(require('../../../queries/usePatients').useSearchPatients).mockReturnValue({
      data: { data: { patients: [] } },
      isLoading: true,
      refetch: mockRefetch,
    });

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows appropriate no options text based on search state', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);

    // Should show message for short input
    expect(screen.getByText('Type at least 2 characters to search')).toBeInTheDocument();
  });

  it('shows no patients found when search returns empty results', async () => {
    const user = userEvent.setup();

    // Mock empty results
    vi.mocked(require('../../../queries/usePatients').useSearchPatients).mockReturnValue({
      data: { data: { patients: [] } },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);
    await user.type(input, 'NonExistent');

    await waitFor(() => {
      expect(screen.getByText('No patients found')).toBeInTheDocument();
    });
  });

  it('shows searching text when loading', async () => {
    const user = userEvent.setup();

    // Mock loading state
    vi.mocked(require('../../../queries/usePatients').useSearchPatients).mockReturnValue({
      data: { data: { patients: [] } },
      isLoading: true,
      refetch: mockRefetch,
    });

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);
    await user.type(input, 'John');

    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });

  it('handles patient with missing optional fields', async () => {
    const user = userEvent.setup();

    // Mock patient with minimal data
    vi.mocked(require('../../../queries/usePatients').useSearchPatients).mockReturnValue({
      data: {
        data: {
          patients: [
            {
              _id: '1',
              firstName: 'John',
              lastName: 'Doe',
              mrn: 'MRN001',
              // Missing dateOfBirth and phone
            },
          ],
        },
      },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(
      <TestWrapper>
        <PatientAutocomplete {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByLabelText('Search and Select Patient');
    await user.click(input);
    await user.type(input, 'John');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN001')).toBeInTheDocument();
    });
  });

  it('clears selection when null is passed as value', () => {
    const selectedPatient: Patient = {
      _id: '1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
      dateOfBirth: '1990-01-01',
      phone: '+234-123-456-7890',
      workplaceId: 'workplace1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { rerender } = render(
      <TestWrapper>
        <PatientAutocomplete
          {...defaultProps}
          value={selectedPatient}
        />
      </TestWrapper>
    );

    // Initially shows selected patient
    expect(screen.getByDisplayValue('John Doe (MRN: MRN001)')).toBeInTheDocument();

    // Clear selection
    rerender(
      <TestWrapper>
        <PatientAutocomplete
          {...defaultProps}
          value={null}
        />
      </TestWrapper>
    );

    // Should be cleared
    const input = screen.getByLabelText('Search and Select Patient');
    expect(input).toHaveValue('');
  });
});