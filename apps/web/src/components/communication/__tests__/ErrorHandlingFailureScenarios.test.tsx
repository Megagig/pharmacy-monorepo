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
import OfflineModeHandler, { useOfflineMode } from '../OfflineModeHandler';
import { communicationErrorService } from '../../../services/communicationErrorService';
import { errorReportingService } from '../../../services/errorReportingService';
import { retryMechanism } from '../../../utils/retryMechanism';

// Mock fetch globally
global.fetch = vi.fn();

// Mock dependencies with failure scenarios
vi.mock('../../../services/socketService', () => ({
  socketService: {
    isConnected: vi.fn(() => false), // Simulate disconnected state
    forceReconnect: vi.fn().mockRejectedValue(new Error('Reconnection failed')),
    getConnectionInfo: vi.fn(() => ({
      status: 'disconnected',
      reconnectAttempts: 3,
      joinedConversations: [],
      socketId: null,
    })),
  },
}));

vi.mock('../../../hooks/useSocket', () => ({
  useSocketConnection: vi.fn(() => ({
    connectionStatus: 'disconnected',
    isConnected: false,
    connectionInfo: {
      status: 'disconnected',
      reconnectAttempts: 3,
      joinedConversations: [],
      socketId: null,
    },
  })),
}));

vi.mock('../../../stores/communicationStore', () => ({
  useCommunicationStore: vi.fn(() => ({
    errors: {
      fetchMessages: 'Failed to load messages',
      sendMessage: 'Failed to send message',
    },
    loading: {
      fetchMessages: false,
      sendMessage: false,
    },
  })),
}));

vi.mock('../../../utils/offlineStorage', () => ({
  offlineStorage: {
    getSyncQueue: vi.fn(() =>
      Promise.reject(new Error('IndexedDB not available'))
    ),
    storeOfflineIntervention: vi.fn(() =>
      Promise.reject(new Error('Storage quota exceeded'))
    ),
    removeSyncQueueItem: vi.fn(() =>
      Promise.reject(new Error('Item not found'))
    ),
    clearAllData: vi.fn(() =>
      Promise.reject(new Error('Clear operation failed'))
    ),
  },
}));

vi.mock('../../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    recordMetric: vi.fn().mockImplementation(() => {
      throw new Error('Performance monitoring failed');
    }),
  },
}));

// Test theme
const theme = createTheme();

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Component that simulates various failure scenarios
const FailureSimulatorComponent: React.FC<{
  scenario:
    | 'memory_leak'
    | 'infinite_loop'
    | 'async_error'
    | 'chunk_error'
    | 'normal';
}> = ({ scenario }) => {
  React.useEffect(() => {
    if (scenario === 'memory_leak') {
      // Simulate memory leak
      const interval = setInterval(() => {
        const largeArray = new Array(1000000).fill('memory leak test');
        // Don't clean up to simulate leak
      }, 10);
      // Don't return cleanup function
    } else if (scenario === 'infinite_loop') {
      // Simulate infinite loop (but with timeout to prevent actual hang)
      let count = 0;
      const start = Date.now();
      while (Date.now() - start < 100 && count < 10000) {
        count++;
      }
      if (count >= 10000) {
        throw new Error('Infinite loop detected');
      }
    } else if (scenario === 'async_error') {
      // Simulate async error that's hard to catch
      setTimeout(() => {
        throw new Error('Async error that escaped');
      }, 0);
    }
  }, [scenario]);

  if (scenario === 'chunk_error') {
    const error = new Error(
      'Loading chunk 5 failed. (missing: http://localhost/chunk.js)'
    );
    error.name = 'ChunkLoadError';
    throw error;
  }

  return (
    <div data-testid="failure-simulator">Failure Simulator: {scenario}</div>
  );
};

describe('Error Handling Failure Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();

    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Network Failure Scenarios', () => {
    it('handles complete network failure gracefully', async () => {
      // Mock fetch to always fail
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network Error'));

      render(
        <TestWrapper>
          <CommunicationErrorBoundary context="network-test">
            <FailureSimulatorComponent scenario="normal" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      // Component should render normally since no error is thrown initially
      expect(screen.getByTestId('failure-simulator')).toBeInTheDocument();
    });

    it('handles intermittent connection failures', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.resolve(new Response('OK'));
        } else {
          return Promise.reject(new Error('Connection timeout'));
        }
      });

      // Test retry mechanism with intermittent failures
      const result = await retryMechanism.executeWithRetry(
        async () => {
          const response = await fetch('/api/test');
          if (!response.ok) throw new Error('Request failed');
          return 'success';
        },
        'intermittent-test',
        { maxAttempts: 3 }
      );

      expect(result).toBe('success');
      expect(callCount).toBeGreaterThan(1);
    });

    it('handles DNS resolution failures', async () => {
      vi.mocked(global.fetch).mockRejectedValue(
        new Error('DNS resolution failed')
      );

      const error = await communicationErrorService.handleError(
        new Error('DNS resolution failed'),
        { context: 'dns-test' }
      );

      expect(error.type).toBe('connection_lost');
      expect(error.severity).toBe('medium');
    });
  });

  describe('Storage Failure Scenarios', () => {
    it('handles IndexedDB unavailability', async () => {
      render(
        <TestWrapper>
          <OfflineModeHandler enableOfflineMode={true}>
            <div data-testid="content">Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      // Should still render content even if offline storage fails
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('handles storage quota exceeded errors', async () => {
      const TestComponent = () => {
        const { addToQueue } = useOfflineMode();

        const handleAddToQueue = async () => {
          try {
            await addToQueue('message', { content: 'test' });
          } catch (error) {
            // Should handle storage errors gracefully
            console.log('Storage error handled:', error);
          }
        };

        return (
          <button onClick={handleAddToQueue} data-testid="add-to-queue">
            Add to Queue
          </button>
        );
      };

      render(
        <TestWrapper>
          <OfflineModeHandler>
            <TestComponent />
          </OfflineModeHandler>
        </TestWrapper>
      );

      const button = screen.getByTestId('add-to-queue');
      fireEvent.click(button);

      // Should not crash the application
      expect(button).toBeInTheDocument();
    });

    it('handles corrupted offline data', async () => {
      // Mock corrupted data
      const { offlineStorage } = await import('../../../utils/offlineStorage');
      vi.mocked(offlineStorage.getSyncQueue).mockResolvedValue([
        { id: 'corrupted', data: null, timestamp: NaN } as any,
      ]);

      render(
        <TestWrapper>
          <OfflineModeHandler>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      // Should handle corrupted data without crashing
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });
  });

  describe('Memory and Performance Failures', () => {
    it('handles memory pressure gracefully', async () => {
      render(
        <TestWrapper>
          <CommunicationErrorBoundary context="memory-test">
            <FailureSimulatorComponent scenario="memory_leak" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      // Should render without immediate crash
      expect(screen.getByTestId('failure-simulator')).toBeInTheDocument();
    });

    it('handles performance monitoring failures', async () => {
      const testError = new Error('Performance test error');

      // Should not throw even if performance monitoring fails
      await expect(
        communicationErrorService.handleError(testError, {
          trackMetrics: true,
          context: 'performance-test',
        })
      ).resolves.toBeDefined();
    });

    it('handles chunk loading failures with recovery', async () => {
      render(
        <TestWrapper>
          <CommunicationErrorBoundary enableRetry={true}>
            <FailureSimulatorComponent scenario="chunk_error" />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error/)).toBeInTheDocument();
        expect(screen.getByText(/Reload Page/)).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('handles multiple simultaneous errors', async () => {
      const errors = [
        new Error('Network Error 1'),
        new Error('Network Error 2'),
        new Error('Validation Error'),
      ];

      const promises = errors.map((error) =>
        communicationErrorService.handleError(error, {
          context: 'concurrent-test',
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('timestamp');
      });
    });

    it('handles error reporting service failures', () => {
      // Mock error reporting to fail
      const originalReportError = errorReportingService.reportError;
      errorReportingService.reportError = vi.fn().mockImplementation(() => {
        throw new Error('Error reporting failed');
      });

      // Should not crash when error reporting fails
      expect(() => {
        communicationErrorService.handleError(new Error('Test error'), {
          logError: true,
        });
      }).not.toThrow();

      // Restore original method
      errorReportingService.reportError = originalReportError;
    });

    it('handles retry mechanism failures', async () => {
      // Mock retry mechanism to fail
      const originalExecuteWithRetry = retryMechanism.executeWithRetry;
      retryMechanism.executeWithRetry = vi
        .fn()
        .mockRejectedValue(new Error('Retry mechanism failed'));

      const error = await communicationErrorService.handleError(
        new Error('Test error'),
        { enableRetry: true }
      );

      expect(error).toBeDefined();
      expect(error.type).toBe('unknown_error');

      // Restore original method
      retryMechanism.executeWithRetry = originalExecuteWithRetry;
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles null and undefined errors', async () => {
      const nullError = await communicationErrorService.handleError(null);
      const undefinedError = await communicationErrorService.handleError(
        undefined
      );

      expect(nullError.type).toBe('unknown_error');
      expect(undefinedError.type).toBe('unknown_error');
    });

    it('handles circular reference errors', async () => {
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;

      const error = new Error('Circular reference error');
      (error as any).circular = circularObj;

      const result = await communicationErrorService.handleError(error);
      expect(result).toBeDefined();
    });

    it('handles very long error messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);

      const result = await communicationErrorService.handleError(error);
      expect(result.message).toBe(longMessage);
    });

    it('handles errors with special characters', async () => {
      const specialMessage =
        '🚨 Error with émojis and spëcial chars: <script>alert("xss")</script>';
      const error = new Error(specialMessage);

      const result = await communicationErrorService.handleError(error);
      expect(result.message).toBe(specialMessage);
    });

    it('handles rapid successive errors', async () => {
      const rapidErrors = Array.from(
        { length: 100 },
        (_, i) => new Error(`Rapid error ${i}`)
      );

      const startTime = Date.now();
      const promises = rapidErrors.map((error) =>
        communicationErrorService.handleError(error, { context: 'rapid-test' })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Recovery Mechanism Failures', () => {
    it('handles failed recovery attempts gracefully', async () => {
      const FailingRecoveryComponent = () => {
        const [shouldFail, setShouldFail] = React.useState(false);

        if (shouldFail) {
          throw new Error('Recovery failed');
        }

        return (
          <button
            onClick={() => setShouldFail(true)}
            data-testid="trigger-failure"
          >
            Trigger Failure
          </button>
        );
      };

      render(
        <TestWrapper>
          <CommunicationErrorBoundary enableRetry={true}>
            <FailingRecoveryComponent />
          </CommunicationErrorBoundary>
        </TestWrapper>
      );

      const button = screen.getByTestId('trigger-failure');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Error/)).toBeInTheDocument();
      });

      // Try to recover
      const retryButton = screen.getByText(/Try Again/);
      fireEvent.click(retryButton);

      // Should show error again if recovery fails
      await waitFor(() => {
        expect(screen.getByText(/Error/)).toBeInTheDocument();
      });
    });

    it('handles offline sync failures', async () => {
      // Mock sync to fail
      vi.mocked(global.fetch).mockRejectedValue(new Error('Sync failed'));

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { rerender } = render(
        <TestWrapper>
          <OfflineModeHandler autoSync={true}>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      // Go back online to trigger sync
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      rerender(
        <TestWrapper>
          <OfflineModeHandler autoSync={true}>
            <div>Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      // Should handle sync failure gracefully
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });
  });

  describe('Browser Compatibility Issues', () => {
    it('handles missing IndexedDB support', async () => {
      // Mock IndexedDB as undefined
      const originalIndexedDB = global.indexedDB;
      (global as any).indexedDB = undefined;

      render(
        <TestWrapper>
          <OfflineModeHandler>
            <div data-testid="content">Content</div>
          </OfflineModeHandler>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();

      // Restore IndexedDB
      (global as any).indexedDB = originalIndexedDB;
    });

    it('handles missing WebSocket support', async () => {
      // Mock WebSocket as undefined
      const originalWebSocket = global.WebSocket;
      (global as any).WebSocket = undefined;

      const error = await communicationErrorService.handleError(
        new Error('WebSocket is not supported'),
        { context: 'websocket-test' }
      );

      expect(error.type).toBe('websocket_error');

      // Restore WebSocket
      (global as any).WebSocket = originalWebSocket;
    });

    it('handles missing fetch support', async () => {
      // Mock fetch as undefined
      const originalFetch = global.fetch;
      (global as any).fetch = undefined;

      const error = await communicationErrorService.handleError(
        new Error('fetch is not supported'),
        { context: 'fetch-test' }
      );

      expect(error.type).toBe('connection_lost');

      // Restore fetch
      global.fetch = originalFetch;
    });
  });
});
