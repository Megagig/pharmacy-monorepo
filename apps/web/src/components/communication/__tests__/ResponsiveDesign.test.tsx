import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createAppTheme } from '../../../theme';
import MessageItem from '../MessageItem';

// Mock the responsive hooks
const mockUseResponsive = vi.fn();
const mockUseIsTouchDevice = vi.fn();
const mockUseOrientation = vi.fn();
const mockUseSafeAreaInsets = vi.fn();

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: mockUseResponsive,
  useIsTouchDevice: mockUseIsTouchDevice,
  useOrientation: mockUseOrientation,
  useSafeAreaInsets: mockUseSafeAreaInsets,
}));

// Mock the touch gestures hook
vi.mock('../../../hooks/useTouchGestures', () => ({
  useTouchGestures: vi.fn(() => ({
    attachGestures: vi.fn(),
  })),
}));

// Mock the communication store
const mockStore = {
  conversations: [],
  activeConversation: null,
  messages: {},
  notifications: [],
  unreadCount: 0,
  setActiveConversation: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationAsRead: vi.fn(),
  fetchConversations: vi.fn(),
  loading: {},
  errors: {},
};

vi.mock('../../../stores/communicationStore', () => ({
  useCommunicationStore: () => mockStore,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={createAppTheme('light')}>{children}</ThemeProvider>
  </QueryClientProvider>
);

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default responsive values
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSmallMobile: false,
      isLargeMobile: false,
      screenWidth: 1200,
      screenHeight: 800,
    });

    mockUseIsTouchDevice.mockReturnValue(false);
    mockUseOrientation.mockReturnValue('landscape');
    mockUseSafeAreaInsets.mockReturnValue({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  describe('Message Item Responsive Behavior', () => {
    const mockMessage = {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'Test message',
        type: 'text' as const,
      },
      status: 'sent' as const,
      priority: 'normal' as const,
      mentions: [],
      reactions: [],
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should render desktop message item', () => {
      render(
        <TestWrapper>
          <MessageItem
            message={mockMessage}
            onReply={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onReaction={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render mobile message item with touch optimizations', () => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: true,
        isLargeMobile: false,
        screenWidth: 320,
        screenHeight: 568,
      });

      mockUseIsTouchDevice.mockReturnValue(true);

      render(
        <TestWrapper>
          <MessageItem
            message={mockMessage}
            mobile={true}
            touchOptimized={true}
            onReply={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onReaction={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should handle compact mode on small screens', () => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: true,
        isLargeMobile: false,
        screenWidth: 320,
        screenHeight: 568,
      });

      render(
        <TestWrapper>
          <MessageItem message={mockMessage} compact={true} mobile={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should show proper touch targets on mobile', () => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 375,
        screenHeight: 667,
      });

      mockUseIsTouchDevice.mockReturnValue(true);

      render(
        <TestWrapper>
          <MessageItem
            message={mockMessage}
            mobile={true}
            touchOptimized={true}
          />
        </TestWrapper>
      );

      // Touch targets should be accessible
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Breakpoint Behavior', () => {
    const mockMessage = {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'Test message',
        type: 'text' as const,
      },
      status: 'sent' as const,
      priority: 'normal' as const,
      mentions: [],
      reactions: [],
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should adapt to mobile breakpoint', () => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 375,
        screenHeight: 667,
      });

      const { rerender } = render(
        <TestWrapper>
          <MessageItem message={mockMessage} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();

      // Change to desktop
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isSmallMobile: false,
        isLargeMobile: false,
        screenWidth: 1200,
        screenHeight: 800,
      });

      rerender(
        <TestWrapper>
          <MessageItem message={mockMessage} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should handle tablet breakpoint', () => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: false,
        screenWidth: 768,
        screenHeight: 1024,
      });

      render(
        <TestWrapper>
          <MessageItem message={mockMessage} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('Touch Device Behavior', () => {
    const mockMessage = {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'Test message',
        type: 'text' as const,
      },
      status: 'sent' as const,
      priority: 'normal' as const,
      mentions: [],
      reactions: [],
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should enable touch optimizations on touch devices', () => {
      mockUseIsTouchDevice.mockReturnValue(true);
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 375,
        screenHeight: 667,
      });

      render(
        <TestWrapper>
          <MessageItem message={mockMessage} touchOptimized={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should handle orientation changes', () => {
      mockUseOrientation.mockReturnValue('portrait');
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 375,
        screenHeight: 667,
      });

      const { rerender } = render(
        <TestWrapper>
          <MessageItem message={mockMessage} mobile={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();

      // Change to landscape
      mockUseOrientation.mockReturnValue('landscape');
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 667,
        screenHeight: 375,
      });

      rerender(
        <TestWrapper>
          <MessageItem message={mockMessage} mobile={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('Safe Area Insets', () => {
    const mockMessage = {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'Test message',
        type: 'text' as const,
      },
      status: 'sent' as const,
      priority: 'normal' as const,
      mentions: [],
      reactions: [],
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should handle safe area insets on devices with notches', () => {
      mockUseSafeAreaInsets.mockReturnValue({
        top: 44,
        right: 0,
        bottom: 34,
        left: 0,
      });

      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isSmallMobile: false,
        isLargeMobile: true,
        screenWidth: 375,
        screenHeight: 812, // iPhone X dimensions
      });

      render(
        <TestWrapper>
          <MessageItem message={mockMessage} mobile={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });
});
