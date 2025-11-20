import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import RefillRequest from '../RefillRequest';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockMedication = {
  _id: 'med_123',
  name: 'Metformin',
  strength: '500mg',
  dosageForm: 'Tablet',
  refillsRemaining: 2,
  quantity: 60,
  instructions: 'Take twice daily with meals',
};

describe('RefillRequest', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders refill request form correctly', () => {
    renderWithProviders(
      <RefillRequest 
        medication={mockMedication}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Request Refill')).toBeInTheDocument();
    expect(screen.getByText('Metformin 500mg Tablet')).toBeInTheDocument();
    expect(screen.getByText('2 refills remaining')).toBeInTheDocument();
  });

  it('handles form submission with valid data', async () => {
    renderWithProviders(
      <RefillRequest 
        medication={mockMedication}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const notesInput = screen.getByLabelText('Additional Notes');
    fireEvent.change(notesInput, { target: { value: 'Need refill urgently' } });

    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        medicationId: 'med_123',
        quantity: 60,
        urgency: 'routine',
        notes: 'Need refill urgently',
      });
    });
  });

  it('handles cancel action', () => {
    renderWithProviders(
      <RefillRequest 
        medication={mockMedication}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});