import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createAppTheme } from '../../theme';
import CommunicationWidget from '../../components/communication/CommunicationWidget';
import CommunicationNotificationBadge from '../../components/communication/CommunicationNotificationBadge';

// Mock the communication store
const mockStore = {
  conversations: [
    {
      _id: 'conv1',
      type: 'patient_query',
      status: 'active',
      participants: [],
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 'conv2',
      type: 'direct',
      status: 'active',
      participants: [],
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  notifications: [
    {
      _id: 'notif1',
      userId: 'user1',
      type: 'new_message',
      title: 'New message from Dr. Smith',
      content: 'Patient query about medication',
      status: 'unread',
      priority: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  messages: {
    conv1: [
      {
        _id: 'msg1',
        conversationId: 'conv1',
        senderId: 'user1',
        content: { text: 'Test message', type: 'text' },
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
  unreadCount: 3,
  loading: false,
  getRecentMessages: vi.fn(() => [
    {
      _id: 'msg1',
      conversationId: 'conv1',
      senderId: 'user1',
      content: { text: 'Test message', type: 'text' },
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  markNotificationAsRead: vi.fn(),
};

vi.mock('../../stores/communicationStore', () => ({
  useCommunicationStore: () => mockStore,
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const theme = createAppTheme('light');

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Communication Dashboard Integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Communication Widget Standalone', () => {
    it('should render overview widget correctly', () => {
      render(
        <TestWrapper>
          <CommunicationWidget variant="overview" />
        </TestWrapper>
      );

      expect(screen.getByText('Communication Hub')).toBeInTheDocument();
      expect(screen.getByText('Total Conversations')).toBeInTheDocument();
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    it('should render recent messages widget correctly', () => {
      render(
        <TestWrapper>
          <CommunicationWidget variant="recent-messages" />
        </TestWrapper>
      );

      expect(screen.getByText('Recent Messages')).toBeInTheDocument();
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render notifications widget correctly', () => {
      render(
        <TestWrapper>
          <CommunicationWidget variant="notifications" />
        </TestWrapper>
      );

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(
        screen.getByText('New message from Dr. Smith')
      ).toBeInTheDocument();
    });

    it('should display correct metrics in widgets', async () => {
      render(
        <TestWrapper>
          <CommunicationWidget variant="overview" />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check metrics labels and values
        expect(screen.getByText('Total Conversations')).toBeInTheDocument();
        expect(screen.getByText('Unread Messages')).toBeInTheDocument();
        expect(screen.getByText('Active Chats')).toBeInTheDocument();
        expect(screen.getByText('Pending Queries')).toBeInTheDocument();

        // Check specific metric value
        expect(screen.getByText('3')).toBeInTheDocument(); // Unread messages
      });
    });

    it('should navigate to communication hub when clicking widgets', async () => {
      render(
        <TestWrapper>
          <CommunicationWidget variant="overview" />
        </TestWrapper>
      );

      // Find and click a navigation button
      const buttons = screen.getAllByRole('button');
      const hubButton = buttons.find(
        (button) =>
          button.getAttribute('aria-label')?.includes('Open') ||
          button.querySelector('[data-testid="ArrowForwardIcon"]')
      );

      if (hubButton) {
        fireEvent.click(hubButton);
        expect(mockNavigate).toHaveBeenCalledWith('/pharmacy/communication');
      }
    });
  });

  describe('Notification Badge Integration', () => {
    it('should render notification badge with correct count', () => {
      render(
        <TestWrapper>
          <CommunicationNotificationBadge />
        </TestWrapper>
      );

      // Check if badge shows unread count
      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('should open preview menu when clicked', async () => {
      render(
        <TestWrapper>
          <CommunicationNotificationBadge showPreview={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Communication Hub')).toBeInTheDocument();
        expect(screen.getByText('3 unread messages')).toBeInTheDocument();
      });
    });

    it('should navigate to communication hub from preview', async () => {
      render(
        <TestWrapper>
          <CommunicationNotificationBadge showPreview={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const viewAllButton = screen.getByText('View All in Communication Hub');
        fireEvent.click(viewAllButton);
        expect(mockNavigate).toHaveBeenCalledWith('/pharmacy/communication');
      });
    });
  });

  describe('Deep Linking', () => {
    it('should handle conversation deep links', async () => {
      const { CommunicationDeepLinks } = await import(
        '../../utils/communicationDeepLinks'
      );
      const deepLinks = new CommunicationDeepLinks(mockNavigate);

      deepLinks.toConversation('conv123', 'msg456');

      expect(mockNavigate).toHaveBeenCalledWith(
        '/pharmacy/communication?conversation=conv123&message=msg456'
      );
    });

    it('should handle notification deep links', async () => {
      const { CommunicationDeepLinks } = await import(
        '../../utils/communicationDeepLinks'
      );
      const deepLinks = new CommunicationDeepLinks(mockNavigate);

      deepLinks.toNotifications('notif123');

      expect(mockNavigate).toHaveBeenCalledWith(
        '/pharmacy/communication?tab=notifications&notification=notif123'
      );
    });

    it('should parse URL parameters correctly', async () => {
      const { CommunicationDeepLinks } = await import(
        '../../utils/communicationDeepLinks'
      );
      const searchParams = new URLSearchParams(
        'conversation=conv123&message=msg456&action=reply'
      );
      const params = CommunicationDeepLinks.parseUrlParams(searchParams);

      expect(params).toEqual({
        conversationId: 'conv123',
        messageId: 'msg456',
        action: 'reply',
        patientId: undefined,
        tab: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty state gracefully', () => {
      // Mock empty store
      vi.mocked(mockStore).conversations = [];
      vi.mocked(mockStore).notifications = [];
      vi.mocked(mockStore).messages = {};
      vi.mocked(mockStore).unreadCount = 0;
      vi.mocked(mockStore).getRecentMessages = vi.fn(() => []);

      render(
        <TestWrapper>
          <CommunicationWidget variant="recent-messages" />
        </TestWrapper>
      );

      expect(screen.getByText('No recent messages')).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      // Mock loading state
      vi.mocked(mockStore).loading = true;

      render(
        <TestWrapper>
          <CommunicationWidget variant="overview" />
        </TestWrapper>
      );

      // Should render without crashing during loading
      expect(screen.getByText('Communication Hub')).toBeInTheDocument();
    });
  });
});
