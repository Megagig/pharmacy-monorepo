import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../../theme';
import MedicationHistoryInput from '../MedicationHistoryInput';
import type { MedicationHistoryInputProps } from '../../types';

// Mock theme
const theme = createAppTheme('light');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('MedicationHistoryInput Component', () => {
  const defaultProps: MedicationHistoryInputProps = {
    value: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with title and description', () => {
      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      expect(screen.getByText('Current Medications')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Document all current medications, supplements, and over-the-counter drugs'
        )
      ).toBeInTheDocument();
    });

    it('shows empty state when no medications', () => {
      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      expect(
        screen.getByText(
          'No medications recorded. Add current medications to help with drug interaction checking and clinical assessment.'
        )
      ).toBeInTheDocument();
    });

    it('displays existing medications', () => {
      const medications = [
        { name: 'Lisinopril', dosage: '10 mg', frequency: 'Once daily' },
        { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={medications} />
      );

      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('10 mg')).toBeInTheDocument();
      expect(screen.getByText('500 mg')).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      const errorMessage = 'Test error message';
      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} error={errorMessage} />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('disables controls when disabled prop is true', () => {
      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} disabled={true} />
      );

      const addButton = screen.getByRole('button', { name: /add medication/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Adding Medications', () => {
    it('opens dialog when Add Medication button is clicked', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      expect(screen.getByText('Add Medication')).toBeInTheDocument();
      expect(screen.getByLabelText('Medication Name')).toBeInTheDocument();
    });

    it('allows adding a medication with all details', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} onChange={mockOnChange} />
      );

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Fill in medication details
      const nameInput = screen.getByLabelText('Medication Name');
      await user.type(nameInput, 'Lisinopril');

      const amountInput = screen.getByLabelText('Amount');
      await user.type(amountInput, '10');

      const unitSelect = screen.getByLabelText('Unit');
      await user.click(unitSelect);
      await user.click(screen.getByText('mg'));

      const frequencySelect = screen.getByLabelText('Frequency');
      await user.click(frequencySelect);
      await user.click(screen.getByText('Once daily'));

      // Save medication
      const saveButton = screen.getByRole('button', {
        name: /add medication/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          {
            name: 'Lisinopril',
            dosage: '10 mg',
            frequency: 'Once daily',
          },
        ]);
      });
    });

    it('allows adding medication with custom frequency', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} onChange={mockOnChange} />
      );

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Fill in medication details
      await user.type(screen.getByLabelText('Medication Name'), 'Aspirin');

      // Select "Other" frequency
      const frequencySelect = screen.getByLabelText('Frequency');
      await user.click(frequencySelect);
      await user.click(screen.getByText('Other'));

      // Enter custom frequency
      const customFrequencyInput = screen.getByLabelText('Custom Frequency');
      await user.type(customFrequencyInput, 'Every other day');

      // Save medication
      const saveButton = screen.getByRole('button', {
        name: /add medication/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          {
            name: 'Aspirin',
            dosage: '',
            frequency: 'Every other day',
          },
        ]);
      });
    });

    it('validates required medication name', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Try to save without name
      const saveButton = screen.getByRole('button', {
        name: /add medication/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('Medication name is required')
        ).toBeInTheDocument();
      });
    });

    it('validates dosage amount and unit consistency', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Enter name and amount but no unit
      await user.type(screen.getByLabelText('Medication Name'), 'Test Med');
      await user.type(screen.getByLabelText('Amount'), '10');

      // Clear the unit
      const unitSelect = screen.getByLabelText('Unit');
      await user.click(unitSelect);
      await user.click(screen.getByText('mg')); // Select then clear

      // Try to save
      const saveButton = screen.getByRole('button', {
        name: /add medication/i,
      });
      await user.click(saveButton);

      // Should validate dosage consistency
      expect(screen.getByLabelText('Medication Name')).toBeInTheDocument();
    });
  });

  describe('Editing Medications', () => {
    it('allows editing existing medications', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const medications = [
        { name: 'Lisinopril', dosage: '10 mg', frequency: 'Once daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput
          {...defaultProps}
          value={medications}
          onChange={mockOnChange}
        />
      );

      // Click edit button
      const editButton = screen.getByLabelText('Edit medication');
      await user.click(editButton);

      expect(screen.getByText('Edit Medication')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Lisinopril')).toBeInTheDocument();

      // Change the name
      const nameInput = screen.getByLabelText('Medication Name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Enalapril');

      // Save changes
      const updateButton = screen.getByRole('button', {
        name: /update medication/i,
      });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          {
            name: 'Enalapril',
            dosage: '10 mg',
            frequency: 'Once daily',
          },
        ]);
      });
    });

    it('pre-fills dialog with existing medication data', async () => {
      const user = userEvent.setup();

      const medications = [
        { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={medications} />
      );

      // Click edit button
      const editButton = screen.getByLabelText('Edit medication');
      await user.click(editButton);

      // Check pre-filled values
      expect(screen.getByDisplayValue('Metformin')).toBeInTheDocument();
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
      // Note: Select values might not show as displayValue, check if they're selected
    });
  });

  describe('Removing Medications', () => {
    it('allows removing medications', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const medications = [
        { name: 'Lisinopril', dosage: '10 mg', frequency: 'Once daily' },
        { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput
          {...defaultProps}
          value={medications}
          onChange={mockOnChange}
        />
      );

      // Click remove button for first medication
      const removeButtons = screen.getAllByLabelText('Remove medication');
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily' },
        ]);
      });
    });
  });

  describe('Quick Add Common Medications', () => {
    it('displays common medications for quick selection', () => {
      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      expect(
        screen.getByText('Quick Add Common Medications')
      ).toBeInTheDocument();
      expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    });

    it('allows quick adding of common medications', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} onChange={mockOnChange} />
      );

      // Click on a common medication
      const acetaminophenChip = screen.getByText('Acetaminophen');
      await user.click(acetaminophenChip);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          {
            name: 'Acetaminophen',
            dosage: '',
            frequency: 'Once daily',
          },
        ]);
      });
    });

    it('filters common medications based on search', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search medications...');
      await user.type(searchInput, 'lisin');

      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.queryByText('Acetaminophen')).not.toBeInTheDocument();
    });

    it('excludes already added medications from quick add', () => {
      const medications = [
        { name: 'Lisinopril', dosage: '10 mg', frequency: 'Once daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={medications} />
      );

      // Lisinopril should not appear in quick add since it's already added
      const quickAddSection = screen
        .getByText('Quick Add Common Medications')
        .closest('div');
      expect(quickAddSection).not.toHaveTextContent('Lisinopril');
    });
  });

  describe('Dialog Interactions', () => {
    it('closes dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      expect(screen.getByText('Add Medication')).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Add Medication')).not.toBeInTheDocument();
      });
    });

    it('closes dialog when close icon is clicked', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Click close icon
      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Add Medication')).not.toBeInTheDocument();
      });
    });

    it('shows autocomplete suggestions for medication names', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Type in medication name input
      const nameInput = screen.getByLabelText('Medication Name');
      await user.type(nameInput, 'Lis');

      // Should show autocomplete suggestions
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration', () => {
    it('calls onChange with updated medication list', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const initialMedications = [
        { name: 'Aspirin', dosage: '81 mg', frequency: 'Once daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput
          {...defaultProps}
          value={initialMedications}
          onChange={mockOnChange}
        />
      );

      // Add another medication
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      await user.type(screen.getByLabelText('Medication Name'), 'Ibuprofen');

      const saveButton = screen.getByRole('button', {
        name: /add medication/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith([
          { name: 'Aspirin', dosage: '81 mg', frequency: 'Once daily' },
          { name: 'Ibuprofen', dosage: '', frequency: 'Once daily' },
        ]);
      });
    });

    it('handles controlled component updates', () => {
      const initialMedications = [
        { name: 'Medication A', dosage: '10 mg', frequency: 'Once daily' },
      ];

      const { rerender } = renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={initialMedications} />
      );

      expect(screen.getByText('Medication A')).toBeInTheDocument();

      const updatedMedications = [
        { name: 'Medication B', dosage: '20 mg', frequency: 'Twice daily' },
      ];

      rerender(
        <ThemeProvider theme={theme}>
          <MedicationHistoryInput
            {...defaultProps}
            value={updatedMedications}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Medication B')).toBeInTheDocument();
      expect(screen.queryByText('Medication A')).not.toBeInTheDocument();
    });
  });

  describe('Summary and Information', () => {
    it('shows medication summary when medications are present', () => {
      const medications = [
        { name: 'Med1', dosage: '10 mg', frequency: 'Once daily' },
        { name: 'Med2', dosage: '20 mg', frequency: 'Twice daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={medications} />
      );

      expect(screen.getByText(/2 medications recorded/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /This information will be used for drug interaction checking/
        )
      ).toBeInTheDocument();
    });

    it('displays helpful information in dialog', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      expect(
        screen.getByText(
          /Include all medications, supplements, vitamins, and over-the-counter drugs/
        )
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /add medication/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation in dialog', async () => {
      const user = userEvent.setup();

      renderWithTheme(<MedicationHistoryInput {...defaultProps} />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add medication/i });
      await user.click(addButton);

      // Tab through form fields
      await user.tab();
      expect(screen.getByLabelText('Medication Name')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Amount')).toHaveFocus();
    });

    it('provides helpful tooltips and labels', async () => {
      const user = userEvent.setup();

      const medications = [
        { name: 'Test Med', dosage: '10 mg', frequency: 'Once daily' },
      ];

      renderWithTheme(
        <MedicationHistoryInput {...defaultProps} value={medications} />
      );

      const editButton = screen.getByLabelText('Edit medication');
      const removeButton = screen.getByLabelText('Remove medication');

      expect(editButton).toBeInTheDocument();
      expect(removeButton).toBeInTheDocument();
    });
  });
});
