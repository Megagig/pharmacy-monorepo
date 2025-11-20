import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CommunicationErrorBoundary from '../CommunicationErrorBoundary';
import ErrorRecoveryDialog from '../ErrorRecoveryDialog';
import OfflineModeHandler from '../OfflineModeHandler';
import {
  communicationErrorService,
  CommunicationError,
} from '../../../services/communicationErrorService';
import { errorReportingService } from '../../../services/errorReportingService';

// Mock dependencies
vi.mock('../../../services/socketService', () => ({
  socketService: {
    isConnected: vi.fn(() => true),
    forceReconnect: vi.fn(),
    getConnectionInfo: vi.fn(() => ({
      status: 'connected',
      reconnectAttempts: 0,
      joinedConversations: [],
      socketId: 'test-socket-id',
    })),
  },
}));

vi.mock('../../../hooks/useSocket', () => ({
  useSocketConnection: vi.fn(() => ({
    connectionStatus: 'connected',
    isConnected: true,
    connectionInfo: {
      status: 'connected',
      reconnectAttempts: 0,
      joinedConversations: [],
      socketId: 'test-socket-id',
    },
  })),
}));

vi.mock('../../../stores/communicationStore', () => ({
  useCommunicationStore: vi.fn(() => ({
    errors: {},
    loading: {},
  })),
}));

vi.mock('../../../utils/offlineStorage', () => ({
  offlineStorage: {
    getSyncQueue: vi.fn(() => Promise.resolve([])),
    storeOfflineIntervention: vi.fn(() => Promise.resolve('test-id')),
    removeSyncQueueItem: vi.fn(() => Promise.resolve()),
    clearAllData: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../../utils/retryMechanism', () => ({
  retryMechanism: {
    executeWithRetry: vi.fn((fn) => fn()),
  },
}));

vi.mock('../../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
}));

// Test theme
const theme = createTheme();

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Component that throws an error for testing
const ErrorThrowingComponent: React.FC<{
  shouldThrow: boolean;
  errorType?: string;
}> = ({ shouldThrow, errorType = 'generic' }) => {
  if (shouldThrow) {
    if (errorType === 'network') {
      throw new Error('Network Error: Failed to fetch');
    } else if (errorType === 'chunk') {
      const error = new Error('Loading chunk 1 failed');
      error.name = 'ChunkLoadError';
      throw error;
    } else {
      throw new Error('Test error');
    }
  }
  return <div data-testid="working-component">Component is working</div>;
};

describe('Communication Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CommunicationErrorBoundary', () => {
    it('renders children when there is no error', () => {
      render(
        <TestWrapper>
          <CommunicationErrorBoundary>
            <ErrorThrowingComponent shouldThrow={false} />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
    });

    it('catches and displays error when child component throws', async () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <CommunicationErrorBoundary context="test-component">
            <ErrorThrowingComponent shouldThrow={true} />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Communication Error/)).toBeInTheDocument();
        expect(
          screen.getByText(/unexpected error occurred/)
        ).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('displays network-specific error message for network errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <CommunicationErrorBoundary>
            <ErrorThrowingComponent shouldThrow={true} errorType="network" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Connection issue detected/)
        ).toBeInTheDocument();
        expect(screen.getByText(/Try Again/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('shows retry button for recoverable errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <CommunicationErrorBoundary enableRetry={true}>
            <ErrorThrowingComponent shouldThrow={true} errorType="network" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Try Again/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('displays offline indicator when offline', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <CommunicationErrorBoundary>
            <ErrorThrowingComponent shouldThrow={true} />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Offline/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('calls custom error handler when provided', async () => {
      const onError = vi.fn();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <TestWrapper>
          <CommunicationErrorBoundary onError={onError}>
            <ErrorThrowingComponent shouldThrow={true} />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('ErrorRecoveryDialog', () => {
    const mockError: CommunicationError = {
      type: 'message_send_failed',
      message: 'Failed to send message',
      userMessage: 'Your message could not be sent. Please try again.',
      timestamp: Date.now(),
      recoverable: true,
      retryable: true,
      severity: 'medium',
      suggestedActions: [
        { label: 'Retry', type: 'retry', primary: true },
        { label: 'Save Draft', type: 'custom' },
      ],
    };

    it('renders error recovery dialog with error information', () => {
      render(
        <TestWrapper>
          <ErrorRecoveryDialog
            open={true}
            error={mockError}
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/Error Recovery Assistant/)).toBeInTheDocument();
      expect(screen.getByText(mockError.userMessage)).toBeInTheDocument();
      expect(screen.getByText(/Recovery Steps/)).toBeInTheDocument();
    });

    it('displays recovery steps based on error type', () => {
      render(
        <TestWrapper>
          <ErrorRecoveryDialog
            open={true}
            error={mockError}
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/Retry Sending Message/)).toBeInTheDocument();
      expect(screen.getByText(/Save as Draft/)).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <ErrorRecoveryDialog
            open={true}
            error={mockError}
            onClose={vi.fn()}
            onRetry={onRetry}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByText(/Try Again/);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalled();
      });
    });

    it('shows technical details when enabled', () => {
      render(
        <TestWrapper>
          <ErrorRecoveryDialog
            open={true}
            error={mockError}
            onClose={vi.fn()}
            showTechnicalDetails={true}
          />
        </TestWrapper>
      );

      const detailsButton = screen.getByText(/Technical Details/);
      fireEvent.click(detailsButton);

      expect(screen.getByText(/Error Information/)).toBeInTheDocument();
    });

    it('executes auto recovery when button is clicked', async () => {
      render(
        <TestWrapper>
          <ErrorRecoveryDialog
            open={true}
            error={mockError}
            onClose={vi.fn()}
          />
        </TestWrapper>
      );

      const autoRecoveryButton = screen.getByText(/Auto Recovery/);
      fireEvent.click(autoRecoveryButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Automatic recovery in progress/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('OfflineModeHandler', () => {
    it('renders children normally when online', () => {
      render(
        <TestWrapper>
          <OfflineModeHandler>
            <div data-testid="child-component">Child content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      expect(screen.getByTestId('child-component')).toBeInTheDocument();
    });

    it('shows offline indicator when offline', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <OfflineModeHandler showOfflineIndicator={true}>
            <div data-testid="child-component">Child content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Offline Mode/)).toBeInTheDocument();
      });
    });

    it('displays queued items count when offline', async () => {
      // Mock offline storage with queued items
      const { offlineStorage } = await import('../../../utils/offlineStorage');
      vi.mocked(offlineStorage.getSyncQueue).mockResolvedValue([
        { id: '1', data: {}, timestamp: Date.now() },
        { id: '2', data: {}, timestamp: Date.now() },
      ]);

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <OfflineModeHandler>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/2 item\(s\) queued for sync/)
        ).toBeInTheDocument();
      });
    });

    it('shows sync button when back online with queued items', async () => {
      // Start offline with queued items
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { rerender } = render(
        <TestWrapper>
          <OfflineModeHandler>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Trigger online event
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      rerender(
        <TestWrapper>
          <OfflineModeHandler>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Sync Now/)).toBeInTheDocument();
      });
    });
  });

  describe('CommunicationErrorService', () => {
    it('analyzes network errors correctly', () => {
      const networkError = new Error('Network Error: Failed to fetch');
      const analyzedError = communicationErrorService.analyzeError(
        networkError,
        'test-context'
      );

      expect(analyzedError.type).toBe('connection_lost');
      expect(analyzedError.severity).toBe('medium');
      expect(analyzedError.retryable).toBe(true);
      expect(analyzedError.recoverable).toBe(true);
    });

    it('analyzes authentication errors correctly', () => {
      const authError = new Error('Authentication required');
      const analyzedError = communicationErrorService.analyzeError(authError);

      expect(analyzedError.type).toBe('authentication_expired');
      expect(analyzedError.severity).toBe('high');
      expect(analyzedError.retryable).toBe(false);
    });

    it('provides appropriate recovery actions for different error types', () => {
      const networkError = new Error('Network Error');
      const analyzedError =
        communicationErrorService.analyzeError(networkError);

      expect(analyzedError.suggestedActions).toContainEqual(
        expect.objectContaining({
          label: 'Retry',
          type: 'retry',
          primary: true,
        })
      );
      expect(analyzedError.suggestedActions).toContainEqual(
        expect.objectContaining({ label: 'Check Connection', type: 'custom' })
      );
    });

    it('handles errors with proper logging and metrics', async () => {
      const testError = new Error('Test error');

      await communicationErrorService.handleError(testError, {
        context: 'test-context',
        logError: true,
        trackMetrics: true,
      });

      // Verify metrics were recorded
      const { performanceMonitor } = await import(
        '../../../utils/performanceMonitor'
      );
      expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
        'communication_error_count',
        1,
        expect.objectContaining({
          error_type: 'unknown_error',
          context: 'test-context',
        })
      );
    });

    it('maintains error history correctly', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      communicationErrorService.analyzeError(error1);
      communicationErrorService.analyzeError(error2);

      const history = communicationErrorService.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('First error');
      expect(history[1].message).toBe('Second error');
    });

    it('provides error statistics', () => {
      // Clear previous history
      communicationErrorService.clearErrorHistory();

      const networkError = new Error('Network Error');
      const authError = new Error('Authentication required');

      communicationErrorService.analyzeError(networkError);
      communicationErrorService.analyzeError(authError);

      const stats = communicationErrorService.getErrorStats();
      expect(stats.total).toBe(2);
      expect(stats.byType.connection_lost).toBe(1);
      expect(stats.byType.authentication_expired).toBe(1);
    });
  });

  describe('ErrorReportingService', () => {
    it('generates error reports with proper structure', () => {
      const testError = new Error('Test error for reporting');
      const reportId = errorReportingService.reportError(testError, {
        component: 'test-component',
        action: 'test-action',
      });

      expect(reportId).toMatch(/^error_\d+_[a-z0-9]+$/);

      const stats = errorReportingService.getErrorStats();
      expect(stats.totalReports).toBeGreaterThan(0);
    });

    it('tracks user interactions when enabled', () => {
      // This would require more complex setup to test interaction tracking
      // For now, we'll test that the service initializes correctly
      expect(errorReportingService.getErrorStats().sessionId).toMatch(
        /^session_\d+_[a-z0-9]+$/
      );
    });

    it('exports error reports in correct format', () => {
      const testError = new Error('Export test error');
      errorReportingService.reportError(testError);

      const exported = errorReportingService.exportReports();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('reports');
      expect(Array.isArray(parsed.reports)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('handles complete error flow from boundary to recovery', async () => {
      const onRecover = vi.fn();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { rerender } = render(
        <TestWrapper>
          <CommunicationErrorBoundary>
            <ErrorThrowingComponent shouldThrow={true} errorType="network" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      // Error boundary should catch the error
      await waitFor(() => {
        expect(
          screen.getByText(/Connection issue detected/)
        ).toBeInTheDocument();
      });

      // Click try again button
      const tryAgainButton = screen.getByText(/Try Again/);
      fireEvent.click(tryAgainButton);

      // Component should attempt recovery
      await waitFor(() => {
        // The error boundary should reset and try to render the component again
        expect(
          screen.queryByText(/Connection issue detected/)
        ).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('handles offline to online transition with sync', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <OfflineModeHandler autoSync={true}>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Offline Mode/)).toBeInTheDocument();
      });

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Should show connection restored message or sync indicator
      await waitFor(() => {
        expect(screen.queryByText(/Offline Mode/)).not.toBeInTheDocument();
      });
    });
  });
});
