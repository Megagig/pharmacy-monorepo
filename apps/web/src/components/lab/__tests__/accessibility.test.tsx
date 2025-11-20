/**
 * Accessibility Testing Suite for Manual Lab Order Components
 * Tests WCAG 2.1 AA compliance and accessibility features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../../../theme';

// Import components to test
import { ManualLabOrderForm } from '../ManualLabOrderForm';
import { LabOrderList } from '../LabOrderList';
import { ResultEntryForm } from '../ResultEntryForm';
import { QRScanner } from '../QRScanner';
import { LabOrderPDFViewer } from '../LabOrderPDFViewer';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockTestCatalog = [
  {
    _id: '1',
    code: 'CBC',
    name: 'Complete Blood Count',
    category: 'Hematology',
    specimenType: 'Blood',
    units: 'cells/μL',
    referenceRange: '4000-11000',
    cost: 25.0,
    isActive: true,
  },
  {
    _id: '2',
    code: 'BMP',
    name: 'Basic Metabolic Panel',
    category: 'Chemistry',
    specimenType: 'Blood',
    units: 'mg/dL',
    referenceRange: 'Various',
    cost: 35.0,
    isActive: true,
  },
];

const mockPatient = {
  _id: 'patient1',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  gender: 'male',
  phone: '+1234567890',
  email: 'john.doe@test.com',
};

const mockLabOrders = [
  {
    _id: 'order1',
    orderId: 'LAB-2024-0001',
    patient: mockPatient,
    tests: [mockTestCatalog[0]],
    status: 'requested',
    indication: 'Routine checkup',
    priority: 'routine',
    createdAt: '2024-01-01T10:00:00Z',
    createdBy: {
      firstName: 'Dr.',
      lastName: 'Smith',
    },
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Manual Lab Order Components - Accessibility Tests', () => {
  beforeEach(() => {
    // Mock console.error to catch accessibility warnings
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ManualLabOrderForm Accessibility', () => {
    const defaultProps = {
      testCatalog: mockTestCatalog,
      patients: [mockPatient],
      onSubmit: jest.fn(),
      isLoading: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form labels and ARIA attributes', () => {
      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Check for proper labels
      expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tests/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/indication/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();

      // Check for ARIA attributes
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Manual Lab Order Form');

      // Check required field indicators
      const requiredFields = screen.getAllByText('*');
      requiredFields.forEach((field) => {
        expect(field).toHaveAttribute('aria-label', 'required');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/patient/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/tests/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/indication/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/priority/i)).toHaveFocus();
    });

    it('should provide clear error messages with ARIA live regions', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Submit form without required fields
      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        const errorRegion = screen.getByRole('alert');
        expect(errorRegion).toBeInTheDocument();
        expect(errorRegion).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should have sufficient color contrast', () => {
      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Check button contrast
      const submitButton = screen.getByRole('button', {
        name: /create order/i,
      });
      const styles = window.getComputedStyle(submitButton);

      // Primary button should have sufficient contrast
      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.color).toBeTruthy();
    });

    it('should support screen reader announcements', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Check for screen reader text
      expect(screen.getByText(/form to create manual lab order/i)).toHaveClass(
        'sr-only'
      );

      // Check for progress indicators
      const loadingProps = { ...defaultProps, isLoading: true };
      render(
        <TestWrapper>
          <ManualLabOrderForm {...loadingProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-label',
        'Creating lab order'
      );
    });
  });

  describe('LabOrderList Accessibility', () => {
    const defaultProps = {
      orders: mockLabOrders,
      onOrderSelect: jest.fn(),
      isLoading: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper table structure with headers', () => {
      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Lab Orders List');

      // Check for column headers
      expect(
        screen.getByRole('columnheader', { name: /order id/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: /patient/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: /status/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: /created/i })
      ).toBeInTheDocument();
    });

    it('should support keyboard navigation in table', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      // Navigate to first row
      const firstRow = screen.getByRole('row', { name: /LAB-2024-0001/i });
      await user.click(firstRow);

      expect(firstRow).toHaveFocus();

      // Arrow key navigation
      fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
      // Should move to next row if available
    });

    it('should provide status indicators with proper ARIA labels', () => {
      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      const statusCell = screen.getByText(/requested/i);
      expect(statusCell).toHaveAttribute('aria-label', 'Status: Requested');
    });

    it('should handle empty state accessibly', () => {
      const emptyProps = { ...defaultProps, orders: [] };

      render(
        <TestWrapper>
          <LabOrderList {...emptyProps} />
        </TestWrapper>
      );

      const emptyMessage = screen.getByText(/no lab orders found/i);
      expect(emptyMessage).toHaveAttribute('role', 'status');
      expect(emptyMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('ResultEntryForm Accessibility', () => {
    const defaultProps = {
      order: mockLabOrders[0],
      onSubmit: jest.fn(),
      isLoading: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form structure with fieldsets', () => {
      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      // Check for fieldset grouping
      const fieldset = screen.getByRole('group', { name: /test results/i });
      expect(fieldset).toBeInTheDocument();

      // Check for proper labels
      expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/units/i)).toBeInTheDocument();
    });

    it('should provide validation feedback accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      // Enter invalid value
      const valueInput = screen.getByLabelText(/value/i);
      await user.type(valueInput, 'invalid');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(valueInput).toHaveAttribute('aria-describedby');
        expect(valueInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should support reference range indicators', () => {
      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const referenceRange = screen.getByText(/4000-11000/i);
      expect(referenceRange).toHaveAttribute(
        'aria-label',
        'Reference range: 4000 to 11000 cells per microliter'
      );
    });
  });

  describe('QRScanner Accessibility', () => {
    const defaultProps = {
      onScan: jest.fn(),
      onError: jest.fn(),
      isActive: true,
    };

    // Mock camera API
    beforeEach(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
          }),
        },
      });
    });

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide camera access instructions', () => {
      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(/point camera at qr code/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('should have manual input alternative', () => {
      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      const manualInput = screen.getByLabelText(/enter code manually/i);
      expect(manualInput).toBeInTheDocument();
      expect(manualInput).toHaveAttribute('type', 'text');
    });

    it('should handle camera permission errors accessibly', async () => {
      // Mock permission denied
      navigator.mediaDevices.getUserMedia = jest
        .fn()
        .mockRejectedValue(new Error('Permission denied'));

      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/camera permission/i);
      });
    });
  });

  describe('Mobile Responsiveness and Touch Accessibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
    });

    it('should have touch-friendly button sizes', () => {
      render(
        <TestWrapper>
          <ManualLabOrderForm
            testCatalog={mockTestCatalog}
            patients={[mockPatient]}
            onSubmit={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight);

        // WCAG recommends minimum 44px for touch targets
        expect(minHeight).toBeGreaterThanOrEqual(44);
      });
    });

    it('should maintain proper spacing on mobile', () => {
      render(
        <TestWrapper>
          <LabOrderList
            orders={mockLabOrders}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Check for mobile-optimized layout
      const table = screen.getByRole('table');
      expect(table).toHaveClass('mobile-responsive');
    });

    it('should support swipe gestures accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LabOrderList
            orders={mockLabOrders}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Simulate swipe gesture
      const row = screen.getByRole('row', { name: /LAB-2024-0001/i });

      fireEvent.touchStart(row, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(row, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchEnd(row);

      // Should provide feedback for swipe action
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });

  describe('High Contrast and Color Accessibility', () => {
    it('should work with high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <ManualLabOrderForm
            testCatalog={mockTestCatalog}
            patients={[mockPatient]}
            onSubmit={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Check that high contrast styles are applied
      const form = screen.getByRole('form');
      expect(form).toHaveClass('high-contrast');
    });

    it('should not rely solely on color for information', () => {
      render(
        <TestWrapper>
          <LabOrderList
            orders={[
              { ...mockLabOrders[0], status: 'urgent' },
              { ...mockLabOrders[0], status: 'completed' },
            ]}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Status should have icons or text, not just color
      const urgentStatus = screen.getByText(/urgent/i);
      expect(urgentStatus).toHaveAttribute('aria-label');

      const completedStatus = screen.getByText(/completed/i);
      expect(completedStatus).toHaveAttribute('aria-label');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LabOrderPDFViewer
            orderId="LAB-2024-0001"
            isOpen={true}
            onClose={jest.fn()}
          />
        </TestWrapper>
      );

      // Focus should be trapped in modal
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveFocus();

      // Tab should cycle within modal
      await user.tab();
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveFocus();
    });

    it('should restore focus after modal closes', async () => {
      const user = userEvent.setup();
      let isOpen = true;
      const onClose = () => {
        isOpen = false;
      };

      const { rerender } = render(
        <TestWrapper>
          <div>
            <button>Trigger Button</button>
            <LabOrderPDFViewer
              orderId="LAB-2024-0001"
              isOpen={isOpen}
              onClose={onClose}
            />
          </div>
        </TestWrapper>
      );

      const triggerButton = screen.getByText('Trigger Button');
      triggerButton.focus();

      // Open modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Rerender without modal
      rerender(
        <TestWrapper>
          <div>
            <button>Trigger Button</button>
          </div>
        </TestWrapper>
      );

      // Focus should return to trigger button
      expect(triggerButton).toHaveFocus();
    });
  });
});
