import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import toast from 'react-hot-toast';

import ClinicalNotesErrorBoundary from '../ClinicalNotesErrorBoundary';
import {
  ClinicalNotesLoadingState,
  ClinicalNotesSkeletonLoader,
} from '../ClinicalNotesLoadingStates';
import {
  ValidationFeedback,
  useRealTimeValidation,
} from '../ClinicalNotesValidation';
import {
  useClinicalNotesErrorHandling,
  useDuplicateSubmissionPrevention,
} from '../../hooks/useClinicalNotesErrorHandling';
import ClinicalNotesUXEnhancer from '../ClinicalNotesUXEnhancer';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.log = jest.fn();
  jest.clearAllMocks();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Component that throws an error for testing error boundary
const ErrorThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({
  shouldThrow = true,
}) => {
  if (shouldThrow) {
    throw new Error('Test error for error boundary');
  }
  return <div>No error</div>;
};

// Test component for validation
const ValidationTestComponent: React.FC = () => {
  const formData = {
    patient: null,
    title: '',
    type: '',
    content: {},
  };

  const { validationResult } = useRealTimeValidation(formData);

  return (
    <div>
      <ValidationFeedback validationResult={validationResult} />
    </div>
  );
};

// Test component for error handling hook
const ErrorHandlingTestComponent: React.FC = () => {
  const { handleError, getErrors, hasErrors } = useClinicalNotesErrorHandling();

  const triggerError = () => {
    const error = new Error('Test API error');
    handleError(error, 'create', { noteId: 'test-note-1' });
  };

  return (
    <div>
      <button onClick={triggerError}>Trigger Error</button>
      <div data-testid="has-errors">{hasErrors.toString()}</div>
      <div data-testid="error-count">{getErrors().length}</div>
    </div>
  );
};

// Test component for duplicate submission prevention
const DuplicateSubmissionTestComponent: React.FC = () => {
  const { preventDuplicateSubmission, isSubmitting } =
    useDuplicateSubmissionPrevention();

  const handleSubmit = async () => {
    try {
      await preventDuplicateSubmission(async () => {
        return new Promise((resolve) => setTimeout(resolve, 100));
      });
    } catch (error) {
      console.error('Submission error:', error);
    }
  };

  return (
    <div>
      <button onClick={handleSubmit} disabled={isSubmitting}>
        Submit
      </button>
      <div data-testid="is-submitting">{isSubmitting.toString()}</div>
    </div>
  );
};

describe('Clinical Notes Error Handling', () => {
  describe('ClinicalNotesErrorBoundary', () => {
    it('should catch and display errors', () => {
      render(
        <TestWrapper>
          <ClinicalNotesErrorBoundary>
            <ErrorThrowingComponent />
          </ClinicalNotesErrorBoundary>
        </TestWrapper>
      );

      expect(screen.getByText(/Clinical Notes Error/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /An error occurred while loading the clinical notes module/i
        )
      ).toBeInTheDocument();
    });

    it('should show recovery instructions', () => {
      render(
        <TestWrapper>
          <ClinicalNotesErrorBoundary>
            <ErrorThrowingComponent />
          </ClinicalNotesErrorBoundary>
        </TestWrapper>
      );

      expect(screen.getByText(/Recovery Steps:/i)).toBeInTheDocument();
      expect(screen.getByText(/Try the action again/i)).toBeInTheDocument();
    });

    it('should provide retry functionality', async () => {
      const { rerender } = render(
        <TestWrapper>
          <ClinicalNotesErrorBoundary>
            <ErrorThrowingComponent shouldThrow={true} />
          </ClinicalNotesErrorBoundary>
        </TestWrapper>
      );

      expect(screen.getByText(/Clinical Notes Error/i)).toBeInTheDocument();

      // Click try again button
      const tryAgainButton = screen.getByText(/Try Again/i);
      fireEvent.click(tryAgainButton);

      // Re-render with no error
      rerender(
        <TestWrapper>
          <ClinicalNotesErrorBoundary>
            <ErrorThrowingComponent shouldThrow={false} />
          </ClinicalNotesErrorBoundary>
        </TestWrapper>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should show technical details when expanded', () => {
      render(
        <TestWrapper>
          <ClinicalNotesErrorBoundary>
            <ErrorThrowingComponent />
          </ClinicalNotesErrorBoundary>
        </TestWrapper>
      );

      const showDetailsButton = screen.getByText(/Show Technical Details/i);
      fireEvent.click(showDetailsButton);

      expect(screen.getByText(/Error ID:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Test error for error boundary/i)
      ).toBeInTheDocument();
    });
  });

  describe('ClinicalNotesLoadingState', () => {
    it('should render loading state with message', () => {
      render(
        <TestWrapper>
          <ClinicalNotesLoadingState
            type="loading"
            message="Loading clinical notes..."
          />
        </TestWrapper>
      );

      expect(screen.getByText('Loading clinical notes...')).toBeInTheDocument();
    });

    it('should render progress indicator when progress is provided', () => {
      render(
        <TestWrapper>
          <ClinicalNotesLoadingState
            type="uploading"
            progress={50}
            showProgress={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('50% complete')).toBeInTheDocument();
    });

    it('should render cancel button when onCancel is provided', () => {
      const mockCancel = jest.fn();

      render(
        <TestWrapper>
          <ClinicalNotesLoadingState type="uploading" onCancel={mockCancel} />
        </TestWrapper>
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('ClinicalNotesSkeletonLoader', () => {
    it('should render table skeleton', () => {
      render(
        <TestWrapper>
          <ClinicalNotesSkeletonLoader variant="table" count={3} />
        </TestWrapper>
      );

      // Check for skeleton elements (MUI Skeleton components)
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render card skeleton', () => {
      render(
        <TestWrapper>
          <ClinicalNotesSkeletonLoader variant="card" count={2} />
        </TestWrapper>
      );

      // Check for skeleton elements
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('ValidationFeedback', () => {
    it('should display validation errors', () => {
      const validationResult = {
        isValid: false,
        errors: [
          {
            id: 'patient_required',
            field: 'patient',
            message: 'Patient is required',
            severity: 'error' as const,
          },
        ],
        warnings: [],
        infos: [],
      };

      render(
        <TestWrapper>
          <ValidationFeedback validationResult={validationResult} />
        </TestWrapper>
      );

      expect(screen.getByText('Patient is required')).toBeInTheDocument();
    });

    it('should display validation warnings', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [
          {
            id: 'title_length',
            field: 'title',
            message: 'Title should be between 3 and 100 characters',
            severity: 'warning' as const,
          },
        ],
        infos: [],
      };

      render(
        <TestWrapper>
          <ValidationFeedback validationResult={validationResult} />
        </TestWrapper>
      );

      expect(
        screen.getByText('Title should be between 3 and 100 characters')
      ).toBeInTheDocument();
    });

    it('should handle auto-fix functionality', () => {
      const mockAutoFix = jest.fn();
      const validationResult = {
        isValid: false,
        errors: [
          {
            id: 'test_error',
            field: 'test',
            message: 'Test error',
            severity: 'error' as const,
            canAutoFix: true,
          },
        ],
        warnings: [],
        infos: [],
      };

      render(
        <TestWrapper>
          <ValidationFeedback
            validationResult={validationResult}
            onAutoFix={mockAutoFix}
          />
        </TestWrapper>
      );

      const fixButton = screen.getByText('Fix');
      fireEvent.click(fixButton);

      expect(mockAutoFix).toHaveBeenCalledWith('test');
    });
  });

  describe('useClinicalNotesErrorHandling', () => {
    it('should handle errors and track them', async () => {
      render(
        <TestWrapper>
          <ErrorHandlingTestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
      expect(screen.getByTestId('error-count')).toHaveTextContent('0');

      const triggerButton = screen.getByText('Trigger Error');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByTestId('has-errors')).toHaveTextContent('true');
        expect(screen.getByTestId('error-count')).toHaveTextContent('1');
      });
    });

    it('should show toast notifications for errors', async () => {
      render(
        <TestWrapper>
          <ErrorHandlingTestComponent />
        </TestWrapper>
      );

      const triggerButton = screen.getByText('Trigger Error');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('useDuplicateSubmissionPrevention', () => {
    it('should prevent duplicate submissions', async () => {
      render(
        <TestWrapper>
          <DuplicateSubmissionTestComponent />
        </TestWrapper>
      );

      const submitButton = screen.getByText('Submit');

      // First submission
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('is-submitting')).toHaveTextContent('true');
      });

      // Try to submit again while first is in progress
      fireEvent.click(submitButton);

      // Should still be submitting (duplicate prevented)
      expect(screen.getByTestId('is-submitting')).toHaveTextContent('true');

      // Wait for submission to complete
      await waitFor(
        () => {
          expect(screen.getByTestId('is-submitting')).toHaveTextContent(
            'false'
          );
        },
        { timeout: 200 }
      );
    });
  });

  describe('ClinicalNotesUXEnhancer', () => {
    it('should render children without errors', () => {
      render(
        <TestWrapper>
          <ClinicalNotesUXEnhancer>
            <div>Test content</div>
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should handle global loading states', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesUXEnhancer showGlobalLoading={true}>
            <div>Test content</div>
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      // Trigger global loading
      act(() => {
        window.dispatchEvent(
          new CustomEvent('clinical-notes-loading-start', {
            detail: { message: 'Loading test...' },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Loading test...')).toBeInTheDocument();
      });

      // Stop global loading
      act(() => {
        window.dispatchEvent(new CustomEvent('clinical-notes-loading-end'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading test...')).not.toBeInTheDocument();
      });
    });

    it('should handle network status changes', async () => {
      render(
        <TestWrapper>
          <ClinicalNotesUXEnhancer>
            <div>Test content</div>
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      // Simulate going offline
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // Simulate coming back online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Connection restored/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow with recovery', async () => {
      const { rerender } = render(
        <TestWrapper>
          <ClinicalNotesUXEnhancer>
            <ClinicalNotesErrorBoundary>
              <ErrorThrowingComponent shouldThrow={true} />
            </ClinicalNotesErrorBoundary>
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      // Error should be caught and displayed
      expect(screen.getByText(/Clinical Notes Error/i)).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByText(/Try Again/i);
      fireEvent.click(retryButton);

      // Re-render without error
      rerender(
        <TestWrapper>
          <ClinicalNotesUXEnhancer>
            <ClinicalNotesErrorBoundary>
              <ErrorThrowingComponent shouldThrow={false} />
            </ClinicalNotesErrorBoundary>
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should handle validation with error handling', () => {
      render(
        <TestWrapper>
          <ClinicalNotesUXEnhancer>
            <ValidationTestComponent />
          </ClinicalNotesUXEnhancer>
        </TestWrapper>
      );

      // Should show validation errors for empty form
      expect(screen.getByText(/Patient is required/i)).toBeInTheDocument();
    });
  });
});

describe('Error Recovery Scenarios', () => {
  it('should handle network errors with retry', async () => {
    const networkError = {
      code: 'NETWORK_ERROR',
      message: 'Network Error',
    };

    render(
      <TestWrapper>
        <ErrorHandlingTestComponent />
      </TestWrapper>
    );

    // Simulate network error
    const triggerButton = screen.getByText('Trigger Error');
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('should handle validation errors without retry', async () => {
    const validationError = {
      response: {
        status: 400,
        data: {
          message: 'Validation failed',
          errors: ['Field is required'],
        },
      },
    };

    render(
      <TestWrapper>
        <ErrorHandlingTestComponent />
      </TestWrapper>
    );

    // Simulate validation error
    const triggerButton = screen.getByText('Trigger Error');
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('should handle permission errors', async () => {
    const permissionError = {
      response: {
        status: 403,
        data: {
          message: 'Access denied',
        },
      },
    };

    render(
      <TestWrapper>
        <ErrorHandlingTestComponent />
      </TestWrapper>
    );

    // Simulate permission error
    const triggerButton = screen.getByText('Trigger Error');
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
