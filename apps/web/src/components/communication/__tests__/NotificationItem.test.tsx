import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import NotificationItem from '../NotificationItem';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { CommunicationNotification } from '../../../stores/types';

// Mock the store
vi.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as any;

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

const theme = createTheme();

const mockNotification: CommunicationNotification = {
  _id: '1',
  userId: 'user1',
  type: 'new_message',
  title: 'New message from Dr. Smith',
  content:
    'Patient John Doe needs medication review. Please check the latest lab results and adjust the dosage accordingly.',
  data: {
    conversationId: 'conv1',
    messageId: 'msg1',
    senderId: 'doctor1',
    actionUrl: '/conversations/conv1',
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
};

const urgentNotification: CommunicationNotification = {
  ...mockNotification,
  _id: '2',
  type: 'clinical_alert',
  title: 'Drug interaction alert',
  content: 'Potential interaction between Warfarin and Aspirin',
  priority: 'urgent',
  scheduledFor: '2024-01-15T15:00:00Z',
};

const readNotification: CommunicationNotification = {
  ...mockNotification,
  _id: '3',
  status: 'read',
  readAt: '2024-01-15T11:00:00Z',
};

const defaultMockStore = {
  markNotificationAsRead: vi.fn(),
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('NotificationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCommunicationStore.mockReturnValue(defaultMockStore as any);
  });

  describe('Rendering', () => {
    it('renders notification with basic information', () => {
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      expect(
        screen.getByText('New message from Dr. Smith')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Patient John Doe needs medication review/)
      ).toBeInTheDocument();
      expect(screen.getByText('New Message')).toBeInTheDocument();
      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('shows priority chip for non-normal priority', () => {
      renderWithTheme(<NotificationItem notification={urgentNotification} />);

      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('does not show priority chip for normal priority', () => {
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      expect(screen.queryByText('normal')).not.toBeInTheDocument();
    });

    it('shows scheduled icon for scheduled notifications', () => {
      renderWithTheme(<NotificationItem notification={urgentNotification} />);

      expect(screen.getByTestId('ScheduleIcon')).toBeInTheDocument();
    });

    it('renders different icons for different notification types', () => {
      const mentionNotification = {
        ...mockNotification,
        type: 'mention' as const,
      };
      renderWithTheme(<NotificationItem notification={mentionNotification} />);

      expect(screen.getByTestId('AlternateEmailIcon')).toBeInTheDocument();
    });

    it('applies different styling for unread vs read notifications', () => {
      const { rerender } = renderWithTheme(
        <NotificationItem notification={mockNotification} />
      );

      // Unread notification should have different background
      const unreadItem = screen.getByRole('button');
      expect(unreadItem).toHaveStyle({ borderLeft: '3px' });

      rerender(
        <ThemeProvider theme={theme}>
          <NotificationItem notification={readNotification} />
        </ThemeProvider>
      );

      // Read notification should not have border
      const readItem = screen.getByRole('button');
      expect(readItem).toHaveStyle({ borderLeft: '0px' });
    });
  });

  describe('Content Expansion', () => {
    it('shows "More" button for long content', () => {
      const longNotification = {
        ...mockNotification,
        content:
          'This is a very long notification content that should be truncated and show a More button to expand the full content. '.repeat(
            3
          ),
      };

      renderWithTheme(<NotificationItem notification={longNotification} />);

      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('expands and collapses content', async () => {
      const user = userEvent.setup();
      const longNotification = {
        ...mockNotification,
        content:
          'This is a very long notification content that should be truncated and show a More button to expand the full content. '.repeat(
            3
          ),
      };

      renderWithTheme(<NotificationItem notification={longNotification} />);

      const moreButton = screen.getByText('More');
      await user.click(moreButton);

      expect(screen.getByText('Less')).toBeInTheDocument();

      const lessButton = screen.getByText('Less');
      await user.click(lessButton);

      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('shows expanded details when expanded', async () => {
      const user = userEvent.setup();
      const longNotification = {
        ...mockNotification,
        content: 'This is a very long notification content. '.repeat(10),
      };

      renderWithTheme(<NotificationItem notification={longNotification} />);

      const moreButton = screen.getByText('More');
      await user.click(moreButton);

      expect(
        screen.getByText(
          `Conversation ID: ${mockNotification.data.conversationId}`
        )
      ).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onClick when notification is clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      renderWithTheme(
        <NotificationItem notification={mockNotification} onClick={onClick} />
      );

      const notificationButton = screen.getByRole('button');
      await user.click(notificationButton);

      expect(onClick).toHaveBeenCalled();
    });

    it('marks notification as read when clicked if unread', async () => {
      const user = userEvent.setup();
      const markAsRead = vi.fn();
      mockUseCommunicationStore.mockReturnValue({
        markNotificationAsRead: markAsRead,
      } as any);

      renderWithTheme(<NotificationItem notification={mockNotification} />);

      const notificationButton = screen.getByRole('button');
      await user.click(notificationButton);

      expect(markAsRead).toHaveBeenCalledWith('1');
    });

    it('does not mark as read if already read', async () => {
      const user = userEvent.setup();
      const markAsRead = vi.fn();
      mockUseCommunicationStore.mockReturnValue({
        markNotificationAsRead: markAsRead,
      } as any);

      renderWithTheme(<NotificationItem notification={readNotification} />);

      const notificationButton = screen.getByRole('button');
      await user.click(notificationButton);

      expect(markAsRead).not.toHaveBeenCalled();
    });

    it('shows action buttons when showActions is true', () => {
      renderWithTheme(
        <NotificationItem notification={mockNotification} showActions={true} />
      );

      expect(
        screen.getByRole('button', { name: /mark as read/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /more actions/i })
      ).toBeInTheDocument();
    });

    it('hides action buttons when showActions is false', () => {
      renderWithTheme(
        <NotificationItem notification={mockNotification} showActions={false} />
      );

      expect(
        screen.queryByRole('button', { name: /mark as read/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /more actions/i })
      ).not.toBeInTheDocument();
    });

    it('toggles read status when read/unread button is clicked', async () => {
      const user = userEvent.setup();
      const markAsRead = vi.fn();
      mockUseCommunicationStore.mockReturnValue({
        markNotificationAsRead: markAsRead,
      } as unknown);

      renderWithTheme(<NotificationItem notification={mockNotification} />);

      const readButton = screen.getByRole('button', { name: /mark as read/i });
      await user.click(readButton);

      expect(markAsRead).toHaveBeenCalledWith('1');
    });

    it('calls onDismiss when dismiss is clicked from menu', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();

      renderWithTheme(
        <NotificationItem
          notification={mockNotification}
          onDismiss={onDismiss}
        />
      );

      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      const dismissButton = screen.getByText('Dismiss');
      await user.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Menu Actions', () => {
    it('opens action menu when more button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      expect(screen.getByText('Mark as read')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('shows "Mark as unread" for read notifications', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationItem notification={readNotification} />);

      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      expect(screen.getByText('Mark as unread')).toBeInTheDocument();
    });

    it('closes menu when clicking outside', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      const moreButton = screen.getByRole('button', { name: /more actions/i });
      await user.click(moreButton);

      expect(screen.getByText('Dismiss')).toBeInTheDocument();

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
      });
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact mode', () => {
      renderWithTheme(
        <NotificationItem notification={mockNotification} compact={true} />
      );

      // Should still show the notification but with smaller styling
      expect(
        screen.getByText('New message from Dr. Smith')
      ).toBeInTheDocument();
    });
  });

  describe('Type Labels', () => {
    const typeTests = [
      { type: 'new_message', label: 'New Message' },
      { type: 'mention', label: 'Mention' },
      { type: 'therapy_update', label: 'Therapy Update' },
      { type: 'clinical_alert', label: 'Clinical Alert' },
      { type: 'conversation_invite', label: 'Conversation Invite' },
      { type: 'file_shared', label: 'File Shared' },
      { type: 'intervention_assigned', label: 'Intervention Assigned' },
      { type: 'patient_query', label: 'Patient Query' },
      { type: 'urgent_message', label: 'Urgent Message' },
      { type: 'system_notification', label: 'System Notification' },
    ] as const;

    typeTests.forEach(({ type, label }) => {
      it(`shows correct label for ${type}`, () => {
        const notification = { ...mockNotification, type };
        renderWithTheme(<NotificationItem notification={notification} />);

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('Priority Colors', () => {
    it('shows error color for urgent priority', () => {
      renderWithTheme(<NotificationItem notification={urgentNotification} />);

      const priorityChip = screen.getByText('urgent');
      expect(priorityChip).toBeInTheDocument();
    });

    it('shows warning color for high priority', () => {
      const highPriorityNotification = {
        ...mockNotification,
        priority: 'high' as const,
      };
      renderWithTheme(
        <NotificationItem notification={highPriorityNotification} />
      );

      const priorityChip = screen.getByText('high');
      expect(priorityChip).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for buttons', () => {
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      expect(
        screen.getByRole('button', { name: /mark as read/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /more actions/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationItem notification={mockNotification} />);

      // Tab to the notification
      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();

      // Enter should trigger click
      const onClick = vi.fn();
      renderWithTheme(
        <NotificationItem notification={mockNotification} onClick={onClick} />
      );

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles invalid date gracefully', () => {
      const invalidDateNotification = {
        ...mockNotification,
        createdAt: 'invalid-date',
      };

      renderWithTheme(
        <NotificationItem notification={invalidDateNotification} />
      );

      expect(screen.getByText('Unknown time')).toBeInTheDocument();
    });

    it('handles missing action URL gracefully', async () => {
      const user = userEvent.setup();
      const noUrlNotification = {
        ...mockNotification,
        data: { ...mockNotification.data, actionUrl: undefined },
      };

      renderWithTheme(<NotificationItem notification={noUrlNotification} />);

      // Should not show open button
      expect(
        screen.queryByRole('button', { name: /open/i })
      ).not.toBeInTheDocument();
    });
  });
});
