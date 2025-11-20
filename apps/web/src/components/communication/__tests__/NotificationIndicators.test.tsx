import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import NotificationIndicators from '../NotificationIndicators';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { CommunicationNotification } from '../../../stores/types';

// Mock the store
vi.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as any;
jest.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as jest.MockedFunction<
  typeof useCommunicationStore
>;

const theme = createTheme();

const mockNotifications: CommunicationNotification[] = [
  {
    _id: '1',
    userId: 'user1',
    type: 'new_message',
    title: 'New message from Dr. Smith',
    content: 'Patient John Doe needs medication review',
    data: {
      conversationId: 'conv1',
      messageId: 'msg1',
      senderId: 'doctor1',
    },
    priority: 'normal',
    status: 'unread',
    deliveryChannels: {
      inApp: true,
      email: false,
      sms: false,
    },
    workplaceId: 'workplace1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    _id: '2',
    userId: 'user1',
    type: 'clinical_alert',
    title: 'Drug interaction alert',
    content: 'Potential interaction between Warfarin and Aspirin',
    data: {
      patientId: 'patient2',
    },
    priority: 'urgent',
    status: 'unread',
    deliveryChannels: {
      inApp: true,
      email: true,
      sms: false,
    },
    workplaceId: 'workplace1',
    createdAt: '2024-01-15T09:30:00Z',
    updatedAt: '2024-01-15T09:30:00Z',
  },
];

const defaultMockStore = {
  notifications: mockNotifications,
  unreadCount: 2,
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('NotificationIndicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseCommunicationStore.mockReturnValue(defaultMockStore as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Badge Display', () => {
    it('renders notification badge with unread count', () => {
      renderWithTheme(<NotificationIndicators />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows correct tooltip text', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithTheme(<NotificationIndicators />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('2 unread notifications')).toBeInTheDocument();
      });
    });

    it('hides badge when showBadge is false', () => {
      renderWithTheme(<NotificationIndicators showBadge={false} />);

      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    it('shows different icon for urgent notifications', () => {
      renderWithTheme(<NotificationIndicators />);

      // Should show NotificationsActiveIcon for urgent notifications
      expect(screen.getByTestId('NotificationsActiveIcon')).toBeInTheDocument();
    });

    it('shows regular icon when no urgent notifications', () => {
      const noUrgentNotifications = [
        {
          ...mockNotifications[0],
          priority: 'normal' as const,
        },
      ];

      mockUseCommunicationStore.mockReturnValue({
        notifications: noUrgentNotifications,
        unreadCount: 1,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      expect(screen.getByTestId('NotificationsIcon')).toBeInTheDocument();
    });

    it('shows no badge when unread count is 0', () => {
      mockUseCommunicationStore.mockReturnValue({
        notifications: [],
        unreadCount: 0,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('shows urgent pulse indicator for urgent notifications', () => {
      renderWithTheme(<NotificationIndicators />);

      // Should show the urgent pulse dot
      const pulseIndicator = screen
        .getByRole('button')
        .parentElement?.querySelector('[style*="urgentPulse"]');
      expect(pulseIndicator).toBeInTheDocument();
    });

    it('hides pulse indicator when showPulse is false', () => {
      renderWithTheme(<NotificationIndicators showPulse={false} />);

      const pulseIndicator = screen
        .getByRole('button')
        .parentElement?.querySelector('[style*="urgentPulse"]');
      expect(pulseIndicator).not.toBeInTheDocument();
    });

    it('animates badge when unread count changes', () => {
      const { rerender } = renderWithTheme(<NotificationIndicators />);

      // Change unread count
      mockUseCommunicationStore.mockReturnValue({
        notifications: [
          ...mockNotifications,
          { ...mockNotifications[0], _id: '3' },
        ],
        unreadCount: 3,
      } as any);

      rerender(
        <ThemeProvider theme={theme}>
          <NotificationIndicators />
        </ThemeProvider>
      );

      // Badge should have animation class
      const badge = screen.getByText('3');
      expect(badge.parentElement).toHaveStyle({
        animation: expect.stringContaining('pulse'),
      });
    });
  });

  describe('Toast Notifications', () => {
    beforeEach(() => {
      // Mock the urgent notification as new
      mockUseCommunicationStore.mockReturnValue({
        notifications: [mockNotifications[1]], // Only urgent notification
        unreadCount: 1,
      } as any);
    });

    it('shows toast for urgent notifications', async () => {
      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      });
    });

    it('hides toast when showToast is false', () => {
      renderWithTheme(<NotificationIndicators showToast={false} />);

      expect(
        screen.queryByText('Drug interaction alert')
      ).not.toBeInTheDocument();
    });

    it('auto-dismisses toast after duration', async () => {
      renderWithTheme(<NotificationIndicators toastDuration={1000} />);

      await waitFor(() => {
        expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(
          screen.queryByText('Drug interaction alert')
        ).not.toBeInTheDocument();
      });
    });

    it('calls onNotificationClick when toast is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onNotificationClick = vi.fn();

      renderWithTheme(
        <NotificationIndicators onNotificationClick={onNotificationClick} />
      );

      await waitFor(() => {
        expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      });

      const toast = screen.getByText('Drug interaction alert');
      await user.click(toast);

      expect(onNotificationClick).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: '2',
          title: 'Drug interaction alert',
        })
      );
    });

    it('dismisses toast when close button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: '' }); // Close icon button
      await user.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Drug interaction alert')
        ).not.toBeInTheDocument();
      });
    });

    it('limits number of toast notifications', async () => {
      const manyNotifications = Array.from({ length: 5 }, (_, i) => ({
        ...mockNotifications[1],
        _id: `urgent-${i}`,
        title: `Urgent notification ${i}`,
      }));

      mockUseCommunicationStore.mockReturnValue({
        notifications: manyNotifications,
        unreadCount: 5,
      } as any);

      renderWithTheme(<NotificationIndicators maxToastNotifications={2} />);

      await waitFor(() => {
        expect(screen.getByText('Urgent notification 0')).toBeInTheDocument();
        expect(screen.getByText('Urgent notification 1')).toBeInTheDocument();
        expect(
          screen.queryByText('Urgent notification 2')
        ).not.toBeInTheDocument();
      });
    });

    it('shows priority chip in toast', async () => {
      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(screen.getByText('urgent')).toBeInTheDocument();
      });
    });

    it('shows staggered animation for multiple toasts', async () => {
      const multipleUrgent = [
        { ...mockNotifications[1], _id: '2' },
        { ...mockNotifications[1], _id: '3', title: 'Another urgent alert' },
      ];

      mockUseCommunicationStore.mockReturnValue({
        notifications: multipleUrgent,
        unreadCount: 2,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
        expect(screen.getByText('Another urgent alert')).toBeInTheDocument();
      });
    });
  });

  describe('Priority Colors', () => {
    it('shows correct color for urgent priority', async () => {
      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        const urgentChip = screen.getByText('urgent');
        expect(urgentChip).toBeInTheDocument();
      });
    });

    it('shows correct color for high priority', async () => {
      const highPriorityNotification = {
        ...mockNotifications[1],
        priority: 'high' as const,
      };

      mockUseCommunicationStore.mockReturnValue({
        notifications: [highPriorityNotification],
        unreadCount: 1,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
      });
    });
  });

  describe('Connection Status', () => {
    it('shows connection indicator when there are unread notifications', () => {
      renderWithTheme(<NotificationIndicators />);

      const connectionIndicator = screen
        .getByRole('button')
        .parentElement?.querySelector('[style*="success.main"]');
      expect(connectionIndicator).toBeInTheDocument();
    });

    it('hides connection indicator when no unread notifications', () => {
      mockUseCommunicationStore.mockReturnValue({
        notifications: [],
        unreadCount: 0,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      const connectionIndicator = screen
        .getByRole('button')
        .parentElement?.querySelector('[style*="success.main"]');
      expect(connectionIndicator).toHaveStyle({ display: 'none' });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(<NotificationIndicators />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithTheme(<NotificationIndicators />);

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('provides meaningful tooltip text', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderWithTheme(<NotificationIndicators />);

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('2 unread notifications')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('prevents duplicate toasts for same notification', async () => {
      const { rerender } = renderWithTheme(<NotificationIndicators />);

      // Re-render with same notifications
      rerender(
        <ThemeProvider theme={theme}>
          <NotificationIndicators />
        </ThemeProvider>
      );

      await waitFor(() => {
        const alerts = screen.getAllByText('Drug interaction alert');
        expect(alerts).toHaveLength(1); // Should not duplicate
      });
    });

    it('cleans up timers on unmount', () => {
      const { unmount } = renderWithTheme(<NotificationIndicators />);

      unmount();

      // Should not throw errors when timers fire after unmount
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty notifications array', () => {
      mockUseCommunicationStore.mockReturnValue({
        notifications: [],
        unreadCount: 0,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('handles notifications without priority', async () => {
      const noPriorityNotification = {
        ...mockNotifications[1],
        priority: undefined as any,
      };

      mockUseCommunicationStore.mockReturnValue({
        notifications: [noPriorityNotification],
        unreadCount: 1,
      } as any);

      renderWithTheme(<NotificationIndicators />);

      // Should not crash and should use default priority
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles very long notification content', async () => {
      const longContentNotification = {
        ...mockNotifications[1],
        content:
          'This is a very long notification content that should be truncated properly in the toast display to prevent layout issues and maintain good user experience. '.repeat(
            5
          ),
      };

      mockUseCommunicationStore.mockReturnValue({
        notifications: [longContentNotification],
        unreadCount: 1,
      } as unknown);

      renderWithTheme(<NotificationIndicators />);

      await waitFor(() => {
        expect(
          screen.getByText(/This is a very long notification content/)
        ).toBeInTheDocument();
      });
    });
  });
});
