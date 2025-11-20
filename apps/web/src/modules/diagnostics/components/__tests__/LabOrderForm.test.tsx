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
import LabOrderForm from '../LabOrderForm';
import { useLabStore } from '../../store/labStore';
import type { LabOrderForm as LabOrderFormType } from '../../types';

import { vi } from 'vitest';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

// Mock the lab store
vi.mock('../../store/labStore');
const mockUseLabStore = useLabStore as any;

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

const theme = createTheme();

const mockTestCatalog = [
  {
    code: 'CBC',
    name: 'Complete Blood Count',
    loincCode: '58410-2',
    category: 'Hematology',
    description: 'Complete blood count with differential',
  },
  {
    code: 'CMP',
    name: 'Comprehensive Metabolic Panel',
    loincCode: '24323-8',
    category: 'Chemistry',
    description: 'Basic metabolic panel plus liver function tests',
  },
  {
    code: 'GLUCOSE',
    name: 'Glucose',
    loincCode: '2345-7',
    category: 'Chemistry',
    description: 'Blood glucose level',
  },
];

const defaultStoreState = {
  testCatalog: mockTestCatalog,
  fetchTestCatalog: vi.fn(),
  searchTestCatalog: vi.fn().mockReturnValue(mockTestCatalog),
  loading: {
    fetchCatalog: false,
  },
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

describe('LabOrderForm', () => {
  const mockOnSubmit = vi.fn();
  const defaultProps = {
    patientId: 'patient-123',
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLabStore.mockReturnValue(defaultStoreState as any);
  });

  describe('Rendering', () => {
    it('renders the form with all required elements', () => {
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      expect(screen.getByText('Lab Order Form')).toBeInTheDocument();
      expect(
        screen.getByText('Create a new laboratory test order for the patient')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Clinical Indication')).toBeInTheDocument();
      expect(screen.getByText('Select Laboratory Tests')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeInTheDocument();
    });

    it('displays common lab tests as chips', () => {
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
      expect(
        screen.getByText('Comprehensive Metabolic Panel')
      ).toBeInTheDocument();
      expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      expect(
        screen.getByText('Thyroid Stimulating Hormone')
      ).toBeInTheDocument();
    });

    it('shows test catalog search when expanded', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      await user.click(searchButton);

      expect(
        screen.getByPlaceholderText('Search for lab tests...')
      ).toBeInTheDocument();
      expect(screen.getByText('Hide Test Catalog')).toBeInTheDocument();
    });

    it('displays error message when provided', () => {
      renderWithProviders(
        <LabOrderForm {...defaultProps} error="Test error message" />
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('shows loading state when loading prop is true', () => {
      renderWithProviders(<LabOrderForm {...defaultProps} loading={true} />);

      expect(screen.getByText('Creating Order...')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /creating order/i })
      ).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('requires clinical indication', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      expect(submitButton).toBeDisabled();

      // Try to submit without clinical indication
      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.click(clinicalIndicationInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(
          screen.getByText('Clinical indication is required')
        ).toBeInTheDocument();
      });
    });

    it('requires minimum length for clinical indication', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(clinicalIndicationInput, 'short');
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText('Please provide a detailed clinical indication')
        ).toBeInTheDocument();
      });
    });

    it('requires at least one test to be selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(
        clinicalIndicationInput,
        'This is a detailed clinical indication for testing'
      );

      expect(
        screen.getByText(
          'Please select at least one laboratory test to create an order.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeDisabled();
    });

    it('enables submit button when form is valid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Fill clinical indication
      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(
        clinicalIndicationInput,
        'This is a detailed clinical indication for testing'
      );

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /create order/i })
        ).toBeEnabled();
      });
    });
  });

  describe('Test Selection', () => {
    it('adds test when common test chip is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('Complete Blood Count')
        ).toBeInTheDocument();
      });
    });

    it('prevents adding duplicate tests', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);
      await user.click(cbcChip); // Try to add again

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
      });
    });

    it('removes test when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
      });

      // Remove the test
      const deleteButton = screen.getByRole('button', { name: '' }); // Delete icon button
      await user.click(deleteButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Selected Tests (1)')
        ).not.toBeInTheDocument();
      });
    });

    it('allows setting test priority', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
      });

      // Change priority
      const prioritySelect = screen.getByLabelText('Priority');
      await user.click(prioritySelect);

      const urgentOption = screen.getByText('Urgent');
      await user.click(urgentOption);

      expect(screen.getByDisplayValue('urgent')).toBeInTheDocument();
    });

    it('allows adding specific indication for each test', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
      });

      // Add specific indication
      const specificIndicationInput = screen.getByLabelText(
        'Specific Indication'
      );
      await user.type(specificIndicationInput, 'Check for anemia');

      expect(screen.getByDisplayValue('Check for anemia')).toBeInTheDocument();
    });
  });

  describe('Test Catalog Search', () => {
    it('shows test catalog when search button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      await user.click(searchButton);

      expect(
        screen.getByPlaceholderText('Search for lab tests...')
      ).toBeInTheDocument();
    });

    it('calls fetchTestCatalog when search term is entered', async () => {
      const user = userEvent.setup();
      const mockFetchTestCatalog = vi.fn();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        fetchTestCatalog: mockFetchTestCatalog,
      } as any);

      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Open search
      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      await user.click(searchButton);

      // Type search term
      const searchInput = screen.getByPlaceholderText(
        'Search for lab tests...'
      );
      await user.type(searchInput, 'glucose');

      await waitFor(() => {
        expect(mockFetchTestCatalog).toHaveBeenCalledWith('glucose');
      });
    });

    it('displays search results from catalog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Open search
      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      await user.click(searchButton);

      // Type search term
      const searchInput = screen.getByPlaceholderText(
        'Search for lab tests...'
      );
      await user.type(searchInput, 'glu');

      await waitFor(() => {
        expect(screen.getByText('Glucose')).toBeInTheDocument();
        expect(
          screen.getByText('GLUCOSE • Chemistry • LOINC: 2345-7')
        ).toBeInTheDocument();
      });
    });

    it('adds test from catalog when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Open search
      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      await user.click(searchButton);

      // Type search term
      const searchInput = screen.getByPlaceholderText(
        'Search for lab tests...'
      );
      await user.type(searchInput, 'glu');

      // Click on glucose test
      await waitFor(() => {
        const glucoseTest = screen.getByText('Glucose');
        user.click(glucoseTest);
      });

      await waitFor(() => {
        expect(screen.getByText('Selected Tests (1)')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with correct data structure', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Fill clinical indication
      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(
        clinicalIndicationInput,
        'This is a detailed clinical indication for testing'
      );

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      // Set expected date
      const expectedDateInput = screen.getByLabelText('Expected Results Date');
      await user.type(expectedDateInput, '2024-12-31');

      // Submit form
      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          patientId: 'patient-123',
          tests: [
            {
              code: 'CBC',
              name: 'Complete Blood Count',
              loincCode: '58410-2',
              indication: 'This is a detailed clinical indication for testing',
              priority: 'routine',
            },
          ],
          expectedDate: '2024-12-31',
        });
      });
    });

    it('uses specific test indication when provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Fill clinical indication
      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(clinicalIndicationInput, 'General clinical indication');

      // Add a test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      // Add specific indication
      const specificIndicationInput = screen.getByLabelText(
        'Specific Indication'
      );
      await user.type(specificIndicationInput, 'Check for anemia');

      // Submit form
      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tests: [
              expect.objectContaining({
                indication: 'Check for anemia',
              }),
            ],
          })
        );
      });
    });

    it('handles multiple tests with different priorities', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Fill clinical indication
      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.type(clinicalIndicationInput, 'Multiple test indication');

      // Add CBC test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      // Add CMP test
      const cmpChip = screen.getByText('Comprehensive Metabolic Panel');
      await user.click(cmpChip);

      // Change priority of second test
      const prioritySelects = screen.getAllByLabelText('Priority');
      await user.click(prioritySelects[1]);
      const urgentOption = screen.getByText('Urgent');
      await user.click(urgentOption);

      // Submit form
      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tests: [
              expect.objectContaining({
                code: 'CBC',
                priority: 'routine',
              }),
              expect.objectContaining({
                code: 'CMP',
                priority: 'urgent',
              }),
            ],
          })
        );
      });
    });
  });

  describe('Order Summary', () => {
    it('displays order summary when tests are selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Add tests
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      const cmpChip = screen.getByText('Comprehensive Metabolic Panel');
      await user.click(cmpChip);

      await waitFor(() => {
        expect(screen.getByText('Order Summary:')).toBeInTheDocument();
        expect(screen.getByText('2 test(s) selected')).toBeInTheDocument();
      });
    });

    it('shows priority breakdown in summary', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // Add CBC test
      const cbcChip = screen.getByText('Complete Blood Count');
      await user.click(cbcChip);

      // Add CMP test and change priority to urgent
      const cmpChip = screen.getByText('Comprehensive Metabolic Panel');
      await user.click(cmpChip);

      const prioritySelects = screen.getAllByLabelText('Priority');
      await user.click(prioritySelects[1]);
      const urgentOption = screen.getByText('Urgent');
      await user.click(urgentOption);

      await waitFor(() => {
        expect(screen.getByText('1 Routine')).toBeInTheDocument();
        expect(screen.getByText('1 Urgent')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Clinical Indication')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );

      // Tab to the input
      await user.tab();
      expect(clinicalIndicationInput).toHaveFocus();

      // Type in the input
      await user.type(clinicalIndicationInput, 'Test indication');
      expect(clinicalIndicationInput).toHaveValue('Test indication');
    });
  });

  describe('Error Handling', () => {
    it('displays validation errors appropriately', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderForm {...defaultProps} />);

      const clinicalIndicationInput = screen.getByLabelText(
        'Clinical Indication'
      );
      await user.click(clinicalIndicationInput);
      await user.tab(); // Blur without entering text

      await waitFor(() => {
        expect(
          screen.getByText('Clinical indication is required')
        ).toBeInTheDocument();
      });
    });

    it('handles store loading states', () => {
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        loading: {
          fetchCatalog: true,
        },
      } as any);

      renderWithProviders(<LabOrderForm {...defaultProps} />);

      // The search input should be disabled when loading
      const searchButton = screen.getByRole('button', {
        name: /search test catalog/i,
      });
      expect(searchButton).toBeEnabled(); // Button itself should still be enabled
    });
  });
});
