import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import MedicationCard from '../MedicationCard';

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
  genericName: 'Metformin Hydrochloride',
  strength: '500mg',
  dosageForm: 'Tablet',
  manufacturer: 'Pharma Corp',
  instructions: 'Take twice daily with meals',
  frequency: 'Twice daily',
  duration: '30 days',
  quantity: 60,
  refillsRemaining: 2,
  prescribedDate: '2024-01-15',
  expiryDate: '2024-12-31',
  status: 'active' as const,
  sideEffects: ['Nausea', 'Diarrhea', 'Stomach upset'],
  interactions: ['Alcohol', 'Insulin'],
  warnings: ['Take with food', 'Monitor blood sugar'],
  category: 'Diabetes',
  isControlled: false,
  adherenceScore: 85,
  lastTaken: '2024-03-10T08:00:00.000Z',
  nextDose: '2024-03-10T20:00:00.000Z',
};

describe('MedicationCard', () => {
  const mockOnRefillRequest = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders medication information correctly', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('500mg Tablet')).toBeInTheDocument();
    expect(screen.getByText('Take twice daily with meals')).toBeInTheDocument();
    expect(screen.getByText('Twice daily')).toBeInTheDocument();
    expect(screen.getByText('2 refills remaining')).toBeInTheDocument();
  });

  it('shows medication status badge', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays adherence score', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Adherence')).toBeInTheDocument();
  });

  it('shows next dose information', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText(/Next dose:/)).toBeInTheDocument();
  });

  it('handles refill request', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const refillButton = screen.getByRole('button', { name: /request refill/i });
    fireEvent.click(refillButton);

    expect(mockOnRefillRequest).toHaveBeenCalledWith(mockMedication);
  });

  it('handles view details', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const detailsButton = screen.getByRole('button', { name: /view details/i });
    fireEvent.click(detailsButton);

    expect(mockOnViewDetails).toHaveBeenCalledWith(mockMedication);
  });

  it('expands to show additional information', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    expect(screen.getByText('Side Effects')).toBeInTheDocument();
    expect(screen.getByText('Nausea')).toBeInTheDocument();
    expect(screen.getByText('Drug Interactions')).toBeInTheDocument();
    expect(screen.getByText('Alcohol')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Take with food')).toBeInTheDocument();
  });

  it('shows low refill warning', () => {
    const lowRefillMedication = {
      ...mockMedication,
      refillsRemaining: 0,
    };

    renderWithProviders(
      <MedicationCard 
        medication={lowRefillMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('No refills remaining')).toBeInTheDocument();
    expect(screen.getByText(/Contact your pharmacist/)).toBeInTheDocument();
  });

  it('shows expiry warning for medications expiring soon', () => {
    const expiringMedication = {
      ...mockMedication,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    };

    renderWithProviders(
      <MedicationCard 
        medication={expiringMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText(/Expires soon/)).toBeInTheDocument();
  });

  it('shows expired medication warning', () => {
    const expiredMedication = {
      ...mockMedication,
      expiryDate: '2024-01-01', // Past date
      status: 'expired' as const,
    };

    renderWithProviders(
      <MedicationCard 
        medication={expiredMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('disables refill button for expired medications', () => {
    const expiredMedication = {
      ...mockMedication,
      status: 'expired' as const,
    };

    renderWithProviders(
      <MedicationCard 
        medication={expiredMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const refillButton = screen.getByRole('button', { name: /request refill/i });
    expect(refillButton).toBeDisabled();
  });

  it('shows controlled substance indicator', () => {
    const controlledMedication = {
      ...mockMedication,
      isControlled: true,
    };

    renderWithProviders(
      <MedicationCard 
        medication={controlledMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Controlled Substance')).toBeInTheDocument();
  });

  it('shows adherence color coding', () => {
    // High adherence (green)
    const highAdherenceMed = { ...mockMedication, adherenceScore: 90 };
    const { rerender } = renderWithProviders(
      <MedicationCard 
        medication={highAdherenceMed}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    let adherenceElement = screen.getByText('90%');
    expect(adherenceElement.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');

    // Medium adherence (orange)
    const mediumAdherenceMed = { ...mockMedication, adherenceScore: 70 };
    rerender(
      <ThemeProvider theme={theme}>
        <MedicationCard 
          medication={mediumAdherenceMed}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      </ThemeProvider>
    );

    adherenceElement = screen.getByText('70%');
    expect(adherenceElement.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');

    // Low adherence (red)
    const lowAdherenceMed = { ...mockMedication, adherenceScore: 50 };
    rerender(
      <ThemeProvider theme={theme}>
        <MedicationCard 
          medication={lowAdherenceMed}
          onRefillRequest={mockOnRefillRequest}
          onViewDetails={mockOnViewDetails}
        />
      </ThemeProvider>
    );

    adherenceElement = screen.getByText('50%');
    expect(adherenceElement.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
  });

  it('handles missing optional fields gracefully', () => {
    const minimalMedication = {
      _id: 'med_123',
      name: 'Basic Med',
      strength: '100mg',
      dosageForm: 'Tablet',
      instructions: 'Take as directed',
      status: 'active' as const,
    };

    renderWithProviders(
      <MedicationCard 
        medication={minimalMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Basic Med')).toBeInTheDocument();
    expect(screen.getByText('100mg Tablet')).toBeInTheDocument();
    expect(screen.getByText('Take as directed')).toBeInTheDocument();
  });

  it('shows loading state when specified', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const refillButton = screen.getByRole('button', { name: /request refill/i });
    const detailsButton = screen.getByRole('button', { name: /view details/i });

    // Tab navigation
    refillButton.focus();
    fireEvent.keyDown(refillButton, { key: 'Tab' });
    expect(detailsButton).toHaveFocus();
  });

  it('handles click on card to expand', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const card = screen.getByRole('article');
    fireEvent.click(card);

    expect(screen.getByText('Side Effects')).toBeInTheDocument();
  });

  it('shows manufacturer information when available', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Pharma Corp')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    expect(screen.getByText(/Prescribed:/)).toBeInTheDocument();
    expect(screen.getByText(/Expires:/)).toBeInTheDocument();
  });

  it('shows category badge when available', () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Diabetes')).toBeInTheDocument();
  });

  it('handles refill request with confirmation dialog', async () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
        showRefillConfirmation={true}
      />
    );

    const refillButton = screen.getByRole('button', { name: /request refill/i });
    fireEvent.click(refillButton);

    // Should show confirmation dialog
    expect(screen.getByText('Confirm Refill Request')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to request a refill/)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(mockOnRefillRequest).toHaveBeenCalledWith(mockMedication);
  });

  it('handles refill request cancellation', async () => {
    renderWithProviders(
      <MedicationCard 
        medication={mockMedication}
        onRefillRequest={mockOnRefillRequest}
        onViewDetails={mockOnViewDetails}
        showRefillConfirmation={true}
      />
    );

    const refillButton = screen.getByRole('button', { name: /request refill/i });
    fireEvent.click(refillButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnRefillRequest).not.toHaveBeenCalled();
  });
});