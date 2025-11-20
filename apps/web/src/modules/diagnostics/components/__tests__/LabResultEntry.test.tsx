import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LabResultEntry from '../LabResultEntry';
import { useLabStore } from '../../store/labStore';
import type { LabResultForm } from '../../types';

// Mock the lab store
jest.mock('../../store/labStore');
const mockUseLabStore = useLabStore as jest.MockedFunction<typeof useLabStore>;

const theme = createTheme();

const mockOrders = [
  {
    _id: 'order-1',
    patientId: 'patient-123',
    orderedBy: 'user-1',
    workplaceId: 'workplace-1',
    tests: [
      {
        code: 'CBC',
        name: 'Complete Blood Count',
        loincCode: '58410-2',
        indication: 'Routine screening',
        priority: 'routine' as const,
      },
    ],
    status: 'ordered' as const,
    orderDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    _id: 'order-2',
    patientId: 'patient-123',
    orderedBy: 'user-1',
    workplaceId: 'workplace-1',
    tests: [
      {
        code: 'CMP',
        name: 'Comprehensive Metabolic Panel',
        loincCode: '24323-8',
        indication: 'Follow-up',
        priority: 'urgent' as const,
      },
    ],
    status: 'collected' as const,
    orderDate: '2024-01-14T14:30:00Z',
    createdAt: '2024-01-14T14:30:00Z',
    updatedAt: '2024-01-14T15:00:00Z',
  },
];

const defaultStoreState = {
  orders: mockOrders,
  getOrdersByPatient: jest.fn().mockReturnValue(mockOrders),
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('LabResultEntry', () => {
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    patientId: 'patient-123',
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLabStore.mockReturnValue(defaultStoreState as any);
  });

  describe('Rendering', () => {
    it('renders the form with all required elements', () => {
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      expect(screen.getByText('Lab Result Entry')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Enter laboratory test results with reference ranges and interpretation'
        )
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Test Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Result Value')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save result/i })
      ).toBeInTheDocument();
    });

    it('displays associated lab orders when available', () => {
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      expect(
        screen.getByLabelText('Associated Lab Order (Optional)')
      ).toBeInTheDocument();
    });

    it('pre-selects order when orderId is provided', () => {
      renderWithProviders(
        <LabResultEntry {...defaultProps} orderId="order-1" />
      );

      const orderSelect = screen.getByDisplayValue('order-1');
      expect(orderSelect).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      renderWithProviders(
        <LabResultEntry {...defaultProps} error="Test error message" />
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('shows loading state when loading prop is true', () => {
      renderWithProviders(<LabResultEntry {...defaultProps} loading={true} />);

      expect(screen.getByText('Saving Result...')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /saving result/i })
      ).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('requires test code', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const testCodeInput = screen.getByLabelText('Test Code');
      await user.click(testCodeInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText('Test code is required')).toBeInTheDocument();
      });
    });

    it('requires test name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const testNameInput = screen.getByLabelText('Test Name');
      await user.click(testNameInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText('Test name is required')).toBeInTheDocument();
      });
    });

    it('requires result value', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const resultValueInput = screen.getByLabelText('Result Value');
      await user.click(resultValueInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(
          screen.getByText('Result value is required')
        ).toBeInTheDocument();
      });
    });

    it('requires performed date', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const performedDateInput = screen.getByLabelText('Date Performed');
      await user.clear(performedDateInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(
          screen.getByText('Performed date is required')
        ).toBeInTheDocument();
      });
    });

    it('validates numeric result values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, 'invalid-value');
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(
            'Enter a valid numeric value, range, or qualitative result'
          )
        ).toBeInTheDocument();
      });
    });

    it('accepts valid numeric values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '12.5');

      expect(resultValueInput).toHaveValue('12.5');
      expect(
        screen.queryByText(
          'Enter a valid numeric value, range, or qualitative result'
        )
      ).not.toBeInTheDocument();
    });

    it('accepts qualitative results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, 'positive');

      expect(resultValueInput).toHaveValue('positive');
      expect(
        screen.queryByText(
          'Enter a valid numeric value, range, or qualitative result'
        )
      ).not.toBeInTheDocument();
    });

    it('accepts range values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '10-15');

      expect(resultValueInput).toHaveValue('10-15');
      expect(
        screen.queryByText(
          'Enter a valid numeric value, range, or qualitative result'
        )
      ).not.toBeInTheDocument();
    });

    it('validates reference range consistency', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const lowValueInput = screen.getByLabelText('Low Value');
      const highValueInput = screen.getByLabelText('High Value');

      await user.type(lowValueInput, '15');
      await user.type(highValueInput, '10');
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText('Low value must be less than high value')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Auto-interpretation', () => {
    it('automatically interprets low results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Set reference range
      const lowValueInput = screen.getByLabelText('Low Value');
      const highValueInput = screen.getByLabelText('High Value');
      await user.type(lowValueInput, '10');
      await user.type(highValueInput, '20');

      // Set low result value
      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '5');

      await waitFor(() => {
        const interpretationSelect = screen.getByDisplayValue('low');
        expect(interpretationSelect).toBeInTheDocument();
      });
    });

    it('automatically interprets high results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Set reference range
      const lowValueInput = screen.getByLabelText('Low Value');
      const highValueInput = screen.getByLabelText('High Value');
      await user.type(lowValueInput, '10');
      await user.type(highValueInput, '20');

      // Set high result value
      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '25');

      await waitFor(() => {
        const interpretationSelect = screen.getByDisplayValue('high');
        expect(interpretationSelect).toBeInTheDocument();
      });
    });

    it('automatically interprets normal results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Set reference range
      const lowValueInput = screen.getByLabelText('Low Value');
      const highValueInput = screen.getByLabelText('High Value');
      await user.type(lowValueInput, '10');
      await user.type(highValueInput, '20');

      // Set normal result value
      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '15');

      await waitFor(() => {
        const interpretationSelect = screen.getByDisplayValue('normal');
        expect(interpretationSelect).toBeInTheDocument();
      });
    });

    it('automatically interprets critical results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Set reference range
      const lowValueInput = screen.getByLabelText('Low Value');
      const highValueInput = screen.getByLabelText('High Value');
      await user.type(lowValueInput, '10');
      await user.type(highValueInput, '20');

      // Set critically high result value (> 2x high)
      const resultValueInput = screen.getByLabelText('Result Value');
      await user.type(resultValueInput, '50');

      await waitFor(() => {
        const interpretationSelect = screen.getByDisplayValue('critical');
        expect(interpretationSelect).toBeInTheDocument();
      });
    });
  });

  describe('Flag Management', () => {
    it('automatically adds flags based on interpretation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Set interpretation to high
      const interpretationSelect = screen.getByLabelText(
        'Result Interpretation'
      );
      await user.click(interpretationSelect);
      const highOption = screen.getByText('High');
      await user.click(highOption);

      await waitFor(() => {
        expect(screen.getByText('H')).toBeInTheDocument();
      });
    });

    it('allows adding common flags', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const lFlagChip = screen.getByText('L');
      await user.click(lFlagChip);

      expect(screen.getAllByText('L')).toHaveLength(2); // One in common flags, one in selected flags
    });

    it('allows adding custom flags', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const customFlagInput = screen.getByPlaceholderText('Custom flag...');
      await user.type(customFlagInput, 'CUSTOM');

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      expect(screen.getByText('CUSTOM')).toBeInTheDocument();
    });

    it('allows removing flags', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Add a flag first
      const lFlagChip = screen.getByText('L');
      await user.click(lFlagChip);

      // Find the selected flag and remove it
      const selectedFlags = screen.getAllByText('L');
      const selectedFlag = selectedFlags.find((flag) =>
        flag
          .closest('[role="button"]')
          ?.getAttribute('aria-label')
          ?.includes('delete')
      );

      if (selectedFlag) {
        const deleteButton = selectedFlag.closest('[role="button"]');
        if (deleteButton) {
          await user.click(deleteButton);
        }
      }

      // Should only have the common flag left
      expect(screen.getAllByText('L')).toHaveLength(1);
    });

    it('prevents duplicate flags', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const lFlagChip = screen.getByText('L');
      await user.click(lFlagChip);
      await user.click(lFlagChip); // Try to add again

      // Should still only have 2 instances (common + selected)
      expect(screen.getAllByText('L')).toHaveLength(2);
    });
  });

  describe('Unit Selection', () => {
    it('provides common units in autocomplete', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const unitInput = screen.getByLabelText('Unit');
      await user.click(unitInput);

      // Should show common units
      await waitFor(() => {
        expect(screen.getByText('mg/dL')).toBeInTheDocument();
        expect(screen.getByText('g/dL')).toBeInTheDocument();
      });
    });

    it('allows custom unit entry', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const unitInput = screen.getByLabelText('Unit');
      await user.type(unitInput, 'custom-unit');

      expect(unitInput).toHaveValue('custom-unit');
    });
  });

  describe('Form Submission', () => {
    it('submits form with correct data structure', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Fill required fields
      await user.type(screen.getByLabelText('Test Code'), 'CBC');
      await user.type(
        screen.getByLabelText('Test Name'),
        'Complete Blood Count'
      );
      await user.type(screen.getByLabelText('Result Value'), '12.5');
      await user.type(screen.getByLabelText('Unit'), 'g/dL');
      await user.type(screen.getByLabelText('Low Value'), '12.0');
      await user.type(screen.getByLabelText('High Value'), '16.0');
      await user.type(
        screen.getByLabelText('LOINC Code (Optional)'),
        '58410-2'
      );

      // Set interpretation
      const interpretationSelect = screen.getByLabelText(
        'Result Interpretation'
      );
      await user.click(interpretationSelect);
      const normalOption = screen.getByText('Normal');
      await user.click(normalOption);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save result/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          patientId: 'patient-123',
          orderId: '',
          testCode: 'CBC',
          testName: 'Complete Blood Count',
          value: '12.5',
          unit: 'g/dL',
          referenceRange: {
            low: 12.0,
            high: 16.0,
            text: undefined,
          },
          interpretation: 'normal',
          flags: ['N'],
          performedAt: expect.any(String),
          loincCode: '58410-2',
          comments: '',
        });
      });
    });

    it('includes order ID when selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Select an order
      const orderSelect = screen.getByLabelText(
        'Associated Lab Order (Optional)'
      );
      await user.click(orderSelect);
      const orderOption = screen.getByText(/Order #order-1/);
      await user.click(orderOption);

      // Fill other required fields
      await user.type(screen.getByLabelText('Test Code'), 'CBC');
      await user.type(
        screen.getByLabelText('Test Name'),
        'Complete Blood Count'
      );
      await user.type(screen.getByLabelText('Result Value'), '12.5');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save result/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            orderId: 'order-1',
          })
        );
      });
    });

    it('includes comments when provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Fill required fields
      await user.type(screen.getByLabelText('Test Code'), 'CBC');
      await user.type(
        screen.getByLabelText('Test Name'),
        'Complete Blood Count'
      );
      await user.type(screen.getByLabelText('Result Value'), '12.5');

      // Add comments
      const commentsInput = screen.getByLabelText('Comments (Optional)');
      await user.type(commentsInput, 'Sample was slightly hemolyzed');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save result/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            comments: 'Sample was slightly hemolyzed',
          })
        );
      });
    });
  });

  describe('Critical Value Alert', () => {
    it('shows critical value alert when interpretation is critical', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const interpretationSelect = screen.getByLabelText(
        'Result Interpretation'
      );
      await user.click(interpretationSelect);
      const criticalOption = screen.getByText('Critical');
      await user.click(criticalOption);

      await waitFor(() => {
        expect(screen.getByText('Critical Value Alert:')).toBeInTheDocument();
        expect(
          screen.getByText(
            'This result is critically abnormal and may require immediate clinical attention.'
          )
        ).toBeInTheDocument();
      });
    });

    it('does not show critical value alert for normal results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const interpretationSelect = screen.getByLabelText(
        'Result Interpretation'
      );
      await user.click(interpretationSelect);
      const normalOption = screen.getByText('Normal');
      await user.click(normalOption);

      expect(
        screen.queryByText('Critical Value Alert:')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Code')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Result Value')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save result/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      // Tab through form elements
      await user.tab(); // Order select (if available)
      await user.tab(); // Test code
      expect(screen.getByLabelText('Test Code')).toHaveFocus();

      await user.tab(); // Test name
      expect(screen.getByLabelText('Test Name')).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('displays validation errors appropriately', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const testCodeInput = screen.getByLabelText('Test Code');
      await user.click(testCodeInput);
      await user.tab(); // Blur without entering text

      await waitFor(() => {
        expect(screen.getByText('Test code is required')).toBeInTheDocument();
      });
    });

    it('prevents submission when form is invalid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultEntry {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /save result/i });
      expect(submitButton).toBeDisabled();

      await user.click(submitButton);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
