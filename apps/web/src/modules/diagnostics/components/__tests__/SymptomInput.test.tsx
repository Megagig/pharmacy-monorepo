import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../../theme';
import SymptomInput from '../SymptomInput';
import type { SymptomInputProps } from '../../types';

// Mock theme
const theme = createAppTheme('light');

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('SymptomInput Component', () => {
  const defaultProps: SymptomInputProps = {
    value: {
      subjective: [],
      objective: [],
      duration: '',
      severity: 'mild',
      onset: 'acute',
    },
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with title and description', () => {
      renderWithTheme(<SymptomInput {...defaultProps} />);

      expect(screen.getByText('Symptom Assessment')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Document patient-reported symptoms and clinical observations'
        )
      ).toBeInTheDocument();
    });

    it('renders subjective and objective symptom sections', () => {
      renderWithTheme(<SymptomInput {...defaultProps} />);

      expect(screen.getByText('Subjective Symptoms')).toBeInTheDocument();
      expect(screen.getByText('Objective Findings')).toBeInTheDocument();
    });

    it('renders symptom characteristics section', () => {
      renderWithTheme(<SymptomInput {...defaultProps} />);

      expect(screen.getByText('Symptom Characteristics')).toBeInTheDocument();
      expect(screen.getByLabelText('Duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByLabelText('Onset')).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      const errorMessage = 'Test error message';
      renderWithTheme(<SymptomInput {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('disables inputs when disabled prop is true', () => {
      renderWithTheme(<SymptomInput {...defaultProps} disabled={true} />);

      const subjectiveInput = screen.getByPlaceholderText(
        'Add subjective symptom...'
      );
      const objectiveInput = screen.getByPlaceholderText(
        'Add objective finding...'
      );

      expect(subjectiveInput).toBeDisabled();
      expect(objectiveInput).toBeDisabled();
    });
  });

  describe('Subjective Symptoms', () => {
    it('allows adding subjective symptoms', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const input = screen.getByPlaceholderText('Add subjective symptom...');
      const addButton = screen.getByRole('button', { name: /add/i });

      await user.type(input, 'Headache');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            subjective: ['Headache'],
          })
        );
      });
    });

    it('allows adding symptoms by pressing Enter', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const input = screen.getByPlaceholderText('Add subjective symptom...');

      await user.type(input, 'Nausea');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            subjective: ['Nausea'],
          })
        );
      });
    });

    it('displays existing subjective symptoms as chips', () => {
      const propsWithSymptoms = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          subjective: ['Headache', 'Nausea'],
        },
      };

      renderWithTheme(<SymptomInput {...propsWithSymptoms} />);

      expect(screen.getByText('Headache')).toBeInTheDocument();
      expect(screen.getByText('Nausea')).toBeInTheDocument();
    });

    it('allows removing subjective symptoms', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const propsWithSymptoms = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          subjective: ['Headache', 'Nausea'],
        },
        onChange: mockOnChange,
      };

      renderWithTheme(<SymptomInput {...propsWithSymptoms} />);

      // Find and click the delete button for 'Headache'
      const headacheChip = screen
        .getByText('Headache')
        .closest('.MuiChip-root');
      const deleteButton = headacheChip?.querySelector(
        '[data-testid="CancelIcon"]'
      );

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith(
            expect.objectContaining({
              subjective: ['Nausea'],
            })
          );
        });
      }
    });

    it('shows common symptoms when toggle is clicked', async () => {
      const user = userEvent.setup();

      renderWithTheme(<SymptomInput {...defaultProps} />);

      const toggleButton = screen.getByText('Show Common Symptoms');
      await user.click(toggleButton);

      expect(screen.getByText('Hide Common Symptoms')).toBeInTheDocument();
      expect(
        screen.getByText('Click to add common subjective symptoms:')
      ).toBeInTheDocument();
    });

    it('prevents duplicate subjective symptoms', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      const propsWithSymptoms = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          subjective: ['Headache'],
        },
        onChange: mockOnChange,
      };

      renderWithTheme(<SymptomInput {...propsWithSymptoms} />);

      const input = screen.getByPlaceholderText('Add subjective symptom...');
      const addButton = screen.getByRole('button', { name: /add/i });

      await user.type(input, 'Headache');
      await user.click(addButton);

      // Should not add duplicate
      expect(mockOnChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          subjective: ['Headache', 'Headache'],
        })
      );
    });
  });

  describe('Objective Findings', () => {
    it('allows adding objective findings', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const input = screen.getByPlaceholderText('Add objective finding...');
      const addButton = screen.getAllByRole('button', { name: /add/i })[1]; // Second add button

      await user.type(input, 'Elevated temperature');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            objective: ['Elevated temperature'],
          })
        );
      });
    });

    it('displays existing objective findings as chips', () => {
      const propsWithFindings = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          objective: ['Elevated temperature', 'High blood pressure'],
        },
      };

      renderWithTheme(<SymptomInput {...propsWithFindings} />);

      expect(screen.getByText('Elevated temperature')).toBeInTheDocument();
      expect(screen.getByText('High blood pressure')).toBeInTheDocument();
    });
  });

  describe('Symptom Characteristics', () => {
    it('allows selecting duration', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const durationSelect = screen.getByLabelText('Duration');
      await user.click(durationSelect);

      const option = screen.getByText('1-3 days');
      await user.click(option);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: '1-3 days',
          })
        );
      });
    });

    it('allows selecting severity', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const severitySelect = screen.getByLabelText('Severity');
      await user.click(severitySelect);

      const option = screen.getByText('Severe');
      await user.click(option);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'severe',
          })
        );
      });
    });

    it('allows selecting onset', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      const onsetSelect = screen.getByLabelText('Onset');
      await user.click(onsetSelect);

      const option = screen.getByText('Chronic (long-term)');
      await user.click(option);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            onset: 'chronic',
          })
        );
      });
    });

    it('shows validation warning when no symptoms are added', () => {
      renderWithTheme(<SymptomInput {...defaultProps} />);

      expect(
        screen.getByText(
          'Please add at least one subjective symptom or objective finding to proceed with the assessment.'
        )
      ).toBeInTheDocument();
    });

    it('shows assessment summary when symptoms are present', () => {
      const propsWithData = {
        ...defaultProps,
        value: {
          subjective: ['Headache'],
          objective: ['Elevated temperature'],
          duration: '1-3 days',
          severity: 'moderate',
          onset: 'acute',
        },
      };

      renderWithTheme(<SymptomInput {...propsWithData} />);

      expect(screen.getByText('Assessment Summary:')).toBeInTheDocument();
      expect(
        screen.getByText(/1 subjective symptom\(s\), 1 objective finding\(s\)/)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(<SymptomInput {...defaultProps} />);

      expect(screen.getByLabelText('Duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByLabelText('Onset')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      renderWithTheme(<SymptomInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Add subjective symptom...');

      // Tab to input and type
      await user.tab();
      expect(input).toHaveFocus();

      await user.type(input, 'Test symptom');
      await user.keyboard('{Enter}');

      // Should add the symptom
      await waitFor(() => {
        expect(screen.getByText('Test symptom')).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration', () => {
    it('calls onChange with complete symptom data', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      renderWithTheme(
        <SymptomInput {...defaultProps} onChange={mockOnChange} />
      );

      // Add subjective symptom
      const subjectiveInput = screen.getByPlaceholderText(
        'Add subjective symptom...'
      );
      await user.type(subjectiveInput, 'Headache');
      await user.keyboard('{Enter}');

      // Add objective finding
      const objectiveInput = screen.getByPlaceholderText(
        'Add objective finding...'
      );
      await user.type(objectiveInput, 'Fever');
      await user.keyboard('{Enter}');

      // Select duration
      const durationSelect = screen.getByLabelText('Duration');
      await user.click(durationSelect);
      await user.click(screen.getByText('1-3 days'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith({
          subjective: ['Headache'],
          objective: ['Fever'],
          duration: '1-3 days',
          severity: 'mild',
          onset: 'acute',
        });
      });
    });

    it('handles controlled component updates', () => {
      const { rerender } = renderWithTheme(<SymptomInput {...defaultProps} />);

      const updatedProps = {
        ...defaultProps,
        value: {
          subjective: ['Updated symptom'],
          objective: [],
          duration: '1-3 days',
          severity: 'severe' as const,
          onset: 'chronic' as const,
        },
      };

      rerender(
        <ThemeProvider theme={theme}>
          <SymptomInput {...updatedProps} />
        </ThemeProvider>
      );

      expect(screen.getByText('Updated symptom')).toBeInTheDocument();
    });
  });
});
