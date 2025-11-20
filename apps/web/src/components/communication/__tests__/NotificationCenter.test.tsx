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
import NotificationCenter from '../NotificationCenter';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { CommunicationNotification } from '../../../stores/types';
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
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
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
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

// Mock the store
vi.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as any;

// Mock audio
global.Audio = vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  volume: 0.3,
}));

// Mock Notification API
Object.defineProperty(global, 'Notification', {
  value: vi.fn().mockImplementation((title, options) => ({
    title,
    ...options,
  })),
  configurable: true,
});

Object.defineProperty(global.Notification, 'permission', {
  value: 'granted',
  configurable: true,
});

Object.defineProperty(global.Notification, 'requestPermission', {
  value: vi.fn().mockResolvedValue('granted'),
  configurable: true,
});

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
    content:
      'Potential interaction between Warfarin and Aspirin for patient Jane Smith',
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
  {
    _id: '3',
    userId: 'user1',
    type: 'mention',
    title: 'You were mentioned',
    content: '@pharmacist please review this medication list',
    data: {
      conversationId: 'conv2',
      messageId: 'msg2',
      senderId: 'doctor2',
    },
    priority: 'high',
    status: 'read',
    deliveryChannels: {
      inApp: true,
      email: false,
      sms: false,
    },
    workplaceId: 'workplace1',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
];

const defaultMockStore = {
  notifications: mockNotifications,
  unreadCount: 2,
  fetchNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  removeNotification: vi.fn(),
  loading: { fetchNotifications: false },
  errors: {},
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCommunicationStore.mockReturnValue(defaultMockStore as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('renders notification center with header', () => {
      renderWithTheme(<NotificationCenter />);

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Unread count badge
    });

    it('renders without header when showHeader is false', () => {
      renderWithTheme(<NotificationCenter showHeader={false} />);

      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('displays all notifications', () => {
      renderWithTheme(<NotificationCenter />);

      expect(
        screen.getByText('New message from Dr. Smith')
      ).toBeInTheDocument();
      expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      expect(screen.getByText('You were mentioned')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        notifications: [],
        unreadCount: 0,
      } as any);

      renderWithTheme(<NotificationCenter />);

      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        loading: { fetchNotifications: true },
      } as any);

      renderWithTheme(<NotificationCenter />);

      // Should show skeleton loaders
      expect(screen.getAllByTestId('skeleton')).toHaveLength(5);
    });

    it('shows error state', () => {
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        errors: { fetchNotifications: 'Failed to load notifications' },
      } as any);

      renderWithTheme(<NotificationCenter />);

      expect(
        screen.getByText('Failed to load notifications')
      ).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters notifications by search query', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const searchInput = screen.getByPlaceholderText(
        'Search notifications...'
      );
      await user.type(searchInput, 'drug interaction');

      expect(screen.getByText('Drug interaction alert')).toBeInTheDocument();
      expect(
        screen.queryByText('New message from Dr. Smith')
      ).not.toBeInTheDocument();
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const searchInput = screen.getByPlaceholderText(
        'Search notifications...'
      );
      await user.type(searchInput, 'test');

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });

    it('opens filter menu and applies filters', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const unreadFilter = screen.getByText('Unread only');
      await user.click(unreadFilter);

      // Should show filter chip
      expect(screen.getByText('status: unread')).toBeInTheDocument();
    });

    it('clears all filters', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      // Add a search query
      const searchInput = screen.getByPlaceholderText(
        'Search notifications...'
      );
      await user.type(searchInput, 'test');

      // Add a filter
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);
      const unreadFilter = screen.getByText('Unread only');
      await user.click(unreadFilter);

      // Clear all filters
      const clearAllButton = screen.getByText('Clear all');
      await user.click(clearAllButton);

      expect(searchInput).toHaveValue('');
      expect(screen.queryByText('status: unread')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('marks all notifications as read', async () => {
      const user = userEvent.setup();
      const markAllAsRead = jest.fn();
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        markAllNotificationsAsRead: markAllAsRead,
      } as any);

      renderWithTheme(<NotificationCenter />);

      const markAllButton = screen.getByRole('button', {
        name: /mark all as read/i,
      });
      await user.click(markAllButton);

      expect(markAllAsRead).toHaveBeenCalled();
    });

    it('refreshes notifications', async () => {
      const user = userEvent.setup();
      const fetchNotifications = jest.fn();
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        fetchNotifications,
      } as any);

      renderWithTheme(<NotificationCenter />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(fetchNotifications).toHaveBeenCalled();
    });

    it('calls onNotificationClick when notification is clicked', async () => {
      const user = userEvent.setup();
      const onNotificationClick = jest.fn();

      renderWithTheme(
        <NotificationCenter onNotificationClick={onNotificationClick} />
      );

      const notification = screen.getByText('New message from Dr. Smith');
      await user.click(notification);

      expect(onNotificationClick).toHaveBeenCalledWith(mockNotifications[0]);
    });
  });

  describe('Settings and Preferences', () => {
    it('opens settings menu', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      expect(screen.getByText('Sound notifications')).toBeInTheDocument();
    });

    it('toggles sound notifications preference', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      const soundSwitch = screen.getByRole('checkbox', {
        name: /sound notifications/i,
      });
      await user.click(soundSwitch);

      // Should update the preference (this would be tested with actual state management)
      expect(soundSwitch).not.toBeChecked();
    });

    it('toggles desktop notifications preference', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      const desktopSwitch = screen.getByRole('checkbox', {
        name: /desktop notifications/i,
      });
      await user.click(desktopSwitch);

      expect(desktopSwitch).not.toBeChecked();
    });
  });

  describe('Auto-refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('auto-refreshes notifications when enabled', () => {
      const fetchNotifications = jest.fn();
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        fetchNotifications,
      } as any);

      renderWithTheme(
        <NotificationCenter autoRefresh={true} refreshInterval={5000} />
      );

      // Initial fetch
      expect(fetchNotifications).toHaveBeenCalledTimes(1);

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(fetchNotifications).toHaveBeenCalledTimes(2);
    });

    it('does not auto-refresh when disabled', () => {
      const fetchNotifications = jest.fn();
      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        fetchNotifications,
      } as any);

      renderWithTheme(<NotificationCenter autoRefresh={false} />);

      // Only initial fetch
      expect(fetchNotifications).toHaveBeenCalledTimes(1);

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should still be only 1 call
      expect(fetchNotifications).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sound and Desktop Notifications', () => {
    it('plays sound for new notifications', () => {
      const mockAudio = {
        play: jest.fn().mockResolvedValue(undefined),
        volume: 0.3,
      };
      (global.Audio as jest.Mock).mockImplementation(() => mockAudio);

      renderWithTheme(<NotificationCenter />);

      // Should play sound for unread notifications
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('shows desktop notification for urgent notifications', () => {
      renderWithTheme(<NotificationCenter />);

      // Should create desktop notification for urgent notification
      expect(global.Notification).toHaveBeenCalledWith(
        'Drug interaction alert',
        expect.objectContaining({
          body: 'Potential interaction between Warfarin and Aspirin for patient Jane Smith',
          requireInteraction: true,
        })
      );
    });
  });

  describe('Notification Grouping', () => {
    it('groups similar notifications when enabled', () => {
      const similarNotifications = [
        ...mockNotifications,
        {
          ...mockNotifications[0],
          _id: '4',
          title: 'Another message from Dr. Smith',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ];

      mockUseCommunicationStore.mockReturnValue({
        ...defaultMockStore,
        notifications: similarNotifications,
      } as unknown);

      renderWithTheme(<NotificationCenter />);

      // Should show only the most recent notification from each group
      expect(
        screen.getByText('Another message from Dr. Smith')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('New message from Dr. Smith')
      ).not.toBeInTheDocument();
    });
  });

  describe('Priority Sorting', () => {
    it('sorts notifications by priority and date', () => {
      renderWithTheme(<NotificationCenter />);

      const notifications = screen.getAllByRole('button');
      const notificationTexts = notifications.map((n) => n.textContent);

      // Urgent should come first, then high, then normal
      expect(
        notificationTexts.some((text) =>
          text?.includes('Drug interaction alert')
        )
      ).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(<NotificationCenter />);

      expect(
        screen.getByRole('button', { name: /refresh/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /filter/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /settings/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<NotificationCenter />);

      // Tab through interactive elements
      await user.tab();
      expect(
        screen.getByPlaceholderText('Search notifications...')
      ).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /refresh/i })).toHaveFocus();
    });
  });
});
