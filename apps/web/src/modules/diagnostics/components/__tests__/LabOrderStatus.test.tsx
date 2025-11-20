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
import LabOrderStatus from '../LabOrderStatus';
import { useLabStore } from '../../store/labStore';
import type { LabOrder } from '../../types';

// Mock the lab store
jest.mock('../../store/labStore');
const mockUseLabStore = useLabStore as jest.MockedFunction<typeof useLabStore>;

const theme = createTheme();

const mockOrder: LabOrder = {
  _id: 'order-123',
  patientId: 'patient-123',
  orderedBy: 'user-1',
  workplaceId: 'workplace-1',
  locationId: 'location-1',
  tests: [
    {
      code: 'CBC',
      name: 'Complete Blood Count',
      loincCode: '58410-2',
      indication: 'Routine screening',
      priority: 'routine',
    },
    {
      code: 'CMP',
      name: 'Comprehensive Metabolic Panel',
      loincCode: '24323-8',
      indication: 'Follow-up',
      priority: 'urgent',
    },
  ],
  status: 'ordered',
  orderDate: '2024-01-15T10:00:00Z',
  expectedDate: '2024-01-17T10:00:00Z',
  externalOrderId: 'EXT-12345',
  fhirReference: 'ServiceRequest/12345',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const defaultStoreState = {
  updateOrderStatus: jest.fn(),
  cancelOrder: jest.fn(),
  loading: {
    updateOrder: false,
  },
  errors: {
    updateOrder: null,
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

describe('LabOrderStatus', () => {
  const mockOnStatusChange = jest.fn();
  const mockOnOrderUpdate = jest.fn();

  const defaultProps = {
    order: mockOrder,
    onStatusChange: mockOnStatusChange,
    onOrderUpdate: mockOnOrderUpdate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLabStore.mockReturnValue(defaultStoreState as any);

    // Mock Date.now() to return a consistent value for testing
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2024-01-15T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering - Full View', () => {
    it('renders the order status card with all required elements', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('Lab Order #order-123')).toBeInTheDocument();
      expect(screen.getByText(/Ordered .* • 2 test\(s\)/)).toBeInTheDocument();
      expect(screen.getByText('Ordered')).toBeInTheDocument();
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });

    it('displays order details correctly', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
      expect(
        screen.getByText('Comprehensive Metabolic Panel')
      ).toBeInTheDocument();
      expect(screen.getByText('Code: CBC')).toBeInTheDocument();
      expect(screen.getByText('Code: CMP')).toBeInTheDocument();
    });

    it('shows test priorities correctly', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('Routine')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('displays progress bar with correct percentage', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('25%')).toBeInTheDocument(); // 'ordered' status = 25%
      expect(screen.getByText('Order has been placed')).toBeInTheDocument();
    });

    it('shows order timeline with current status highlighted', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('Order Placed')).toBeInTheDocument();
      expect(screen.getByText('Specimen Collected')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Results Available')).toBeInTheDocument();
    });

    it('displays external references when available', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByText('External References:')).toBeInTheDocument();
      expect(screen.getByText('External ID: EXT-12345')).toBeInTheDocument();
      expect(
        screen.getByText('FHIR Reference: ServiceRequest/12345')
      ).toBeInTheDocument();
    });
  });

  describe('Rendering - Compact View', () => {
    it('renders compact view when compact prop is true', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} compact={true} />);

      expect(screen.getByText('Ordered')).toBeInTheDocument();
      expect(
        screen.queryByText('Lab Order #order-123')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    });

    it('shows urgent indicator in compact view', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} compact={true} />);

      expect(screen.getByText('URGENT')).toBeInTheDocument();
    });

    it('displays time since order in compact view', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} compact={true} />);

      expect(screen.getByText(/2 hours? ago/)).toBeInTheDocument();
    });
  });

  describe('Status Variations', () => {
    it('renders collected status correctly', () => {
      const collectedOrder = { ...mockOrder, status: 'collected' as const };
      renderWithProviders(<LabOrderStatus order={collectedOrder} />);

      expect(screen.getByText('Collected')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Specimen collected')).toBeInTheDocument();
    });

    it('renders processing status correctly', () => {
      const processingOrder = { ...mockOrder, status: 'processing' as const };
      renderWithProviders(<LabOrderStatus order={processingOrder} />);

      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Lab is processing')).toBeInTheDocument();
    });

    it('renders completed status correctly', () => {
      const completedOrder = { ...mockOrder, status: 'completed' as const };
      renderWithProviders(<LabOrderStatus order={completedOrder} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('Results available')).toBeInTheDocument();
    });

    it('renders cancelled status correctly', () => {
      const cancelledOrder = { ...mockOrder, status: 'cancelled' as const };
      renderWithProviders(<LabOrderStatus order={cancelledOrder} />);

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This order has been cancelled and will not be processed.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText('Progress')).not.toBeInTheDocument(); // No progress bar for cancelled
    });
  });

  describe('Alerts and Warnings', () => {
    it('shows urgent test warning', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(
        screen.getByText(
          'This order contains urgent or STAT tests that require priority processing.'
        )
      ).toBeInTheDocument();
    });

    it('shows expected time warning when overdue', () => {
      // Set expected date to past
      const overdueOrder = {
        ...mockOrder,
        expectedDate: '2024-01-14T10:00:00Z', // Yesterday
      };
      renderWithProviders(<LabOrderStatus order={overdueOrder} />);

      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(
        screen.getByText(/Consider following up with the laboratory/)
      ).toBeInTheDocument();
    });

    it('shows expected time info when due soon', () => {
      // Set expected date to near future
      const soonOrder = {
        ...mockOrder,
        expectedDate: '2024-01-15T18:00:00Z', // 6 hours from mock current time
      };
      renderWithProviders(<LabOrderStatus order={soonOrder} />);

      expect(screen.getByText('Expected in 6h')).toBeInTheDocument();
    });

    it('does not show urgent warning when no urgent tests', () => {
      const routineOrder = {
        ...mockOrder,
        tests: [
          {
            code: 'CBC',
            name: 'Complete Blood Count',
            loincCode: '58410-2',
            indication: 'Routine screening',
            priority: 'routine' as const,
          },
        ],
      };
      renderWithProviders(<LabOrderStatus order={routineOrder} />);

      expect(
        screen.queryByText('This order contains urgent or STAT tests')
      ).not.toBeInTheDocument();
    });
  });

  describe('Actions Menu', () => {
    it('opens actions menu when menu button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' }); // Menu button has no accessible name
      await user.click(menuButton);

      expect(screen.getByText('Update Status')).toBeInTheDocument();
      expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      expect(screen.getByText('Print Order')).toBeInTheDocument();
      expect(screen.getByText('Export FHIR')).toBeInTheDocument();
      expect(screen.getByText('Cancel Order')).toBeInTheDocument();
    });

    it('does not show actions menu when showActions is false', () => {
      renderWithProviders(
        <LabOrderStatus {...defaultProps} showActions={false} />
      );

      expect(
        screen.queryByRole('button', { name: '' })
      ).not.toBeInTheDocument();
    });

    it('does not show cancel option for completed orders', async () => {
      const user = userEvent.setup();
      const completedOrder = { ...mockOrder, status: 'completed' as const };
      renderWithProviders(<LabOrderStatus order={completedOrder} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
    });

    it('does not show cancel option for cancelled orders', async () => {
      const user = userEvent.setup();
      const cancelledOrder = { ...mockOrder, status: 'cancelled' as const };
      renderWithProviders(<LabOrderStatus order={cancelledOrder} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
    });
  });

  describe('Status Update Dialog', () => {
    it('opens status update dialog when update status is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      expect(screen.getByText('Update Order Status')).toBeInTheDocument();
      expect(screen.getByText('Current Status: Ordered')).toBeInTheDocument();
    });

    it('displays all available status options in dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      expect(screen.getByText('Ordered')).toBeInTheDocument();
      expect(screen.getByText('Collected')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      // Cancelled should not be shown as an option
      expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
    });

    it('allows selecting a new status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      // Click on collected status
      const collectedOption = screen.getByText('Collected');
      await user.click(collectedOption);

      // The option should be selected (visually indicated by border)
      expect(collectedOption.closest('div')).toHaveStyle(
        'border-color: rgb(25, 118, 210)'
      ); // primary.main color
    });

    it('allows adding status update note', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      const noteInput = screen.getByLabelText('Status Update Note (Optional)');
      await user.type(noteInput, 'Specimen collected successfully');

      expect(noteInput).toHaveValue('Specimen collected successfully');
    });

    it('calls updateOrderStatus when update button is clicked', async () => {
      const user = userEvent.setup();
      const mockUpdateOrderStatus = jest.fn().mockResolvedValue(true);
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        updateOrderStatus: mockUpdateOrderStatus,
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      // Select collected status
      const collectedOption = screen.getByText('Collected');
      await user.click(collectedOption);

      // Click update button
      const updateButton = screen.getByRole('button', {
        name: 'Update Status',
      });
      await user.click(updateButton);

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        'order-123',
        'collected'
      );
    });

    it('calls onStatusChange callback when status is updated successfully', async () => {
      const user = userEvent.setup();
      const mockUpdateOrderStatus = jest.fn().mockResolvedValue(true);
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        updateOrderStatus: mockUpdateOrderStatus,
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      const collectedOption = screen.getByText('Collected');
      await user.click(collectedOption);

      const updateButton = screen.getByRole('button', {
        name: 'Update Status',
      });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(
          'order-123',
          'collected'
        );
      });
    });

    it('closes dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.queryByText('Update Order Status')).not.toBeInTheDocument();
    });

    it('displays error message when update fails', async () => {
      const user = userEvent.setup();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        errors: {
          updateOrder: 'Failed to update order status',
        },
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      expect(
        screen.getByText('Failed to update order status')
      ).toBeInTheDocument();
    });

    it('shows loading state during update', async () => {
      const user = userEvent.setup();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        loading: {
          updateOrder: true,
        },
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const updateStatusItem = screen.getByText('Update Status');
      await user.click(updateStatusItem);

      const updateButton = screen.getByRole('button', { name: 'Updating...' });
      expect(updateButton).toBeDisabled();
    });
  });

  describe('Order Cancellation', () => {
    it('calls cancelOrder when cancel order is clicked', async () => {
      const user = userEvent.setup();
      const mockCancelOrder = jest.fn().mockResolvedValue(true);
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        cancelOrder: mockCancelOrder,
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const cancelOrderItem = screen.getByText('Cancel Order');
      await user.click(cancelOrderItem);

      expect(mockCancelOrder).toHaveBeenCalledWith('order-123');
    });

    it('calls onStatusChange callback when order is cancelled successfully', async () => {
      const user = userEvent.setup();
      const mockCancelOrder = jest.fn().mockResolvedValue(true);
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        cancelOrder: mockCancelOrder,
      } as any);

      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      const cancelOrderItem = screen.getByText('Cancel Order');
      await user.click(cancelOrderItem);

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(
          'order-123',
          'cancelled'
        );
      });
    });
  });

  describe('Time Calculations', () => {
    it('displays correct time since order for recent orders', () => {
      // Order placed 30 minutes ago
      const recentOrder = {
        ...mockOrder,
        orderDate: '2024-01-15T11:30:00Z',
      };
      renderWithProviders(<LabOrderStatus order={recentOrder} />);

      expect(screen.getByText(/Less than 1 hour ago/)).toBeInTheDocument();
    });

    it('displays correct time since order for orders placed hours ago', () => {
      // Order placed 5 hours ago
      const hoursAgoOrder = {
        ...mockOrder,
        orderDate: '2024-01-15T07:00:00Z',
      };
      renderWithProviders(<LabOrderStatus order={hoursAgoOrder} />);

      expect(screen.getByText(/5 hours ago/)).toBeInTheDocument();
    });

    it('displays correct time since order for orders placed days ago', () => {
      // Order placed 2 days ago
      const daysAgoOrder = {
        ...mockOrder,
        orderDate: '2024-01-13T12:00:00Z',
      };
      renderWithProviders(<LabOrderStatus order={daysAgoOrder} />);

      expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument(); // Menu button
      expect(screen.getByText('Lab Order #order-123')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabOrderStatus {...defaultProps} />);

      // Tab to menu button
      await user.tab();
      const menuButton = screen.getByRole('button');
      expect(menuButton).toHaveFocus();

      // Press Enter to open menu
      await user.keyboard('{Enter}');
      expect(screen.getByText('Update Status')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles missing expected date gracefully', () => {
      const orderWithoutExpectedDate = {
        ...mockOrder,
        expectedDate: undefined,
      };
      renderWithProviders(<LabOrderStatus order={orderWithoutExpectedDate} />);

      // Should not crash and should display the order
      expect(screen.getByText('Lab Order #order-123')).toBeInTheDocument();
    });

    it('handles missing external references gracefully', () => {
      const orderWithoutExternalRefs = {
        ...mockOrder,
        externalOrderId: undefined,
        fhirReference: undefined,
      };
      renderWithProviders(<LabOrderStatus order={orderWithoutExternalRefs} />);

      expect(
        screen.queryByText('External References:')
      ).not.toBeInTheDocument();
    });

    it('handles empty tests array gracefully', () => {
      const orderWithoutTests = {
        ...mockOrder,
        tests: [],
      };
      renderWithProviders(<LabOrderStatus order={orderWithoutTests} />);

      expect(screen.getByText('Lab Order #order-123')).toBeInTheDocument();
      expect(screen.getByText(/0 test\(s\)/)).toBeInTheDocument();
    });
  });
});
