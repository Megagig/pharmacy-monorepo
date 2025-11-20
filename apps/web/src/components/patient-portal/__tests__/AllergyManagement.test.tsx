import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import AllergyManagement from '../AllergyManagement';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockAllergies = [
  {
    _id: 'allergy_1',
    allergen: 'Penicillin',
    reaction: 'Skin rash',
    severity: 'moderate' as const,
    recordedDate: '2024-01-15',
  },
  {
    _id: 'allergy_2',
    allergen: 'Peanuts',
    reaction: 'Anaphylaxis',
    severity: 'severe' as const,
    recordedDate: '2024-02-10',
  },
];

describe('AllergyManagement', () => {
  const mockOnAdd = vi.fn();
  const mockOnUpdate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders allergy list correctly', () => {
    renderWithProviders(
      <AllergyManagement 
        allergies={mockAllergies}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText('Allergies & Reactions')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Peanuts')).toBeInTheDocument();
    expect(screen.getByText('Skin rash')).toBeInTheDocument();
    expect(screen.getByText('Anaphylaxis')).toBeInTheDocument();
  });

  it('shows severity badges with correct colors', () => {
    renderWithProviders(
      <AllergyManagement 
        allergies={mockAllergies}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Severe')).toBeInTheDocument();
  });

  it('handles adding new allergy', async () => {
    renderWithProviders(
      <AllergyManagement 
        allergies={mockAllergies}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const addButton = screen.getByRole('button', { name: /add allergy/i });
    fireEvent.click(addButton);

    // Fill out the form
    fireEvent.change(screen.getByLabelText('Allergen'), { target: { value: 'Shellfish' } });
    fireEvent.change(screen.getByLabelText('Reaction'), { target: { value: 'Swelling' } });
    
    const severitySelect = screen.getByLabelText('Severity');
    fireEvent.mouseDown(severitySelect);
    fireEvent.click(screen.getByText('Mild'));

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        allergen: 'Shellfish',
        reaction: 'Swelling',
        severity: 'mild',
      });
    });
  });
});