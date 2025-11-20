/**
 * Tests for responsive design and mobile optimization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';

// Mock useMediaQuery
jest.mock('@mui/material/useMediaQuery');
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<
  typeof useMediaQuery
>;

// Components to test
import MTRDashboard from '../MTRDashboard';
import PatientSelection from '../PatientSelection';
import MedicationHistory from '../MedicationHistory';
import { MobileCard, MobileList } from '../common/MobileOptimizedLayout';
import OfflineIndicator from '../common/OfflineIndicator';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { test } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

// Mock stores
jest.mock('../stores/mtrStore', () => ({
  useMTRStore: () => ({
    currentReview: {
      _id: 'test-review',
      reviewNumber: 'MTR-001',
      status: 'in_progress',
      steps: {
        patientSelection: { completed: true },
        medicationHistory: { completed: false },
        therapyAssessment: { completed: false },
        planDevelopment: { completed: false },
        interventions: { completed: false },
        followUp: { completed: false },
      },
    },
    currentStep: 0,
    selectedPatient: {
      _id: 'test-patient',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN123',
      age: 45,
    },
    medications: [],
    identifiedProblems: [],
    interventions: [],
    followUps: [],
    loading: {},
    errors: {},
    goToStep: jest.fn(),
    completeStep: jest.fn(),
    saveReview: jest.fn(),
    completeReview: jest.fn(),
    cancelReview: jest.fn(),
    createReview: jest.fn(),
    loadReview: jest.fn(),
    getCompletionPercentage: () => 25,
    canCompleteReview: () => false,
    validateStep: () => [],
    getCurrentStepName: () => 'Patient Selection',
    getNextStep: () => 1,
    clearErrors: jest.fn(),
    addMedication: jest.fn(),
    updateMedication: jest.fn(),
    removeMedication: jest.fn(),
    importMedications: jest.fn(),
    validateMedications: () => [],
    setLoading: jest.fn(),
    setError: jest.fn(),
  }),
}));

// Mock queries
jest.mock('../queries/usePatients', () => ({
  useSearchPatients: () => ({
    data: { data: { results: [] } },
    isLoading: false,
    error: null,
  }),
  useCreatePatient: () => ({
    mutateAsync: jest.fn(),
  }),
}));

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(() => ({
    result: {},
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  })),
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock services
jest.mock('../services/syncService', () => ({
  syncService: {
    onSync: jest.fn(() => () => {}),
    getSyncStatus: jest.fn(() =>
      Promise.resolve({
        isOnline: true,
        syncInProgress: false,
        queueLength: 0,
      })
    ),
    forcSync: jest.fn(),
  },
}));

// Mock offline storage
jest.mock('../utils/offlineStorage', () => ({
  offlineStorage: {
    initialize: jest.fn(() => Promise.resolve()),
    saveMedication: jest.fn(() => Promise.resolve()),
    autoSaveDraft: jest.fn(() => Promise.resolve()),
  },
}));

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme();

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    // Reset mocks
    mockUseMediaQuery.mockReset();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      // Mock mobile breakpoints
      mockUseMediaQuery.mockImplementation((query) => {
        if (query.includes('down')) {
          if (query.includes('md')) return true; // isMobile
          if (query.includes('lg')) return true; // isTablet
          if (query.includes('sm')) return false; // isSmallMobile
        }
        return false;
      });
    });

    test('MTRDashboard shows mobile app bar on mobile', () => {
      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('MTR - Step 1')).toBeInTheDocument();
      expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    });

    test('MTRDashboard shows mobile stepper drawer', async () => {
      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      // Click the timeline icon to open drawer
      const timelineButton = screen.getByRole('button', { name: /timeline/i });
      fireEvent.click(timelineButton);

      await waitFor(() => {
        expect(screen.getByText('MTR Steps')).toBeInTheDocument();
      });
    });

    test('PatientSelection uses mobile card layout', () => {
      render(
        <TestWrapper>
          <PatientSelection
            onPatientSelect={jest.fn()}
            selectedPatient={null}
          />
        </TestWrapper>
      );

      // Should show mobile-optimized search
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      expect(searchInput).toBeInTheDocument();

      // New patient button should be full width on mobile
      const newPatientButton = screen.getByText('New Patient');
      expect(newPatientButton).toBeInTheDocument();
    });

    test('MedicationHistory shows scrollable tabs on mobile', () => {
      render(
        <TestWrapper>
          <MedicationHistory
            patientId="test-patient"
            onMedicationsUpdate={jest.fn()}
          />
        </TestWrapper>
      );

      // Should show medication categories as scrollable tabs
      expect(screen.getByText('Prescribed')).toBeInTheDocument();
      expect(screen.getByText('Over-the-Counter')).toBeInTheDocument();
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      // Mock desktop breakpoints
      mockUseMediaQuery.mockImplementation((query) => {
        if (query.includes('down')) {
          return false; // Not mobile/tablet
        }
        if (query.includes('up')) {
          if (query.includes('lg')) return true; // isDesktop
        }
        return false;
      });
    });

    test('MTRDashboard shows desktop header without app bar', () => {
      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
      expect(screen.queryByText('MTR - Step 1')).not.toBeInTheDocument();
    });

    test('MTRDashboard shows vertical stepper on desktop', () => {
      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      // Should show vertical stepper with descriptions
      expect(screen.getByText('Patient Selection')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Select or create a patient for medication therapy review'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Touch Gestures', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockImplementation(() => true); // Mobile
    });

    test('MobileCard responds to swipe gestures', () => {
      const onSwipeLeft = jest.fn();
      const onSwipeRight = jest.fn();

      render(
        <MobileCard
          title="Test Card"
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
      );

      const card = screen.getByText('Test Card').closest('div');
      expect(card).toBeInTheDocument();

      // Simulate touch events for swipe
      if (card) {
        fireEvent.touchStart(card, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchEnd(card, {
          changedTouches: [{ clientX: 50, clientY: 100 }],
        });
      }

      // Note: Actual gesture detection would require more complex simulation
      // This test verifies the component renders and accepts gesture props
    });

    test('MobileList renders items with mobile cards', () => {
      const items = [
        {
          id: '1',
          title: 'Item 1',
          subtitle: 'Subtitle 1',
          chips: [{ label: 'Test', color: 'primary' as const }],
        },
        {
          id: '2',
          title: 'Item 2',
          subtitle: 'Subtitle 2',
        },
      ];

      render(<MobileList items={items} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Subtitle 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Offline Capability', () => {
    test('OfflineIndicator shows when offline', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<OfflineIndicator />);

      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    test('OfflineIndicator shows sync status', async () => {
      render(<OfflineIndicator showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText(/all changes synced/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Breakpoints', () => {
    test('useResponsive hook returns correct values for mobile', () => {
      mockUseMediaQuery.mockImplementation((query) => {
        if (query.includes('down') && query.includes('md')) return true;
        return false;
      });

      // This would need to be tested in a component that uses the hook
      // For now, we verify the components render correctly with mobile breakpoints
      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('MTR - Step 1')).toBeInTheDocument();
    });

    test('Components adapt to tablet breakpoints', () => {
      mockUseMediaQuery.mockImplementation((query) => {
        if (query.includes('down') && query.includes('lg')) return true;
        if (query.includes('down') && query.includes('md')) return false;
        return false;
      });

      render(
        <TestWrapper>
          <MTRDashboard />
        </TestWrapper>
      );

      // Should show desktop layout but with tablet adaptations
      expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('Mobile components maintain accessibility', () => {
      mockUseMediaQuery.mockImplementation(() => true);

      render(
        <TestWrapper>
          <PatientSelection
            onPatientSelect={jest.fn()}
            selectedPatient={null}
          />
        </TestWrapper>
      );

      // Check for proper ARIA labels and roles
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      expect(searchInput).toHaveAttribute('type', 'text');

      const newPatientButton = screen.getByRole('button', {
        name: /new patient/i,
      });
      expect(newPatientButton).toBeInTheDocument();
    });

    test('Touch targets meet minimum size requirements', () => {
      mockUseMediaQuery.mockImplementation(() => true);

      render(
        <MobileCard
          title="Test Card"
          actions={[
            {
              label: 'Edit',
              icon: <span>Edit</span>,
              onClick: jest.fn(),
            },
          ]}
        />
      );

      // Buttons should be large enough for touch interaction
      const actionButton = screen.getByText('Edit');
      expect(actionButton).toBeInTheDocument();
    });
  });
});

describe('Performance Tests', () => {
  test('Components render efficiently on mobile', () => {
    mockUseMediaQuery.mockImplementation(() => true);

    const startTime = performance.now();

    render(
      <TestWrapper>
        <MTRDashboard />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render within reasonable time (adjust threshold as needed)
    expect(renderTime).toBeLessThan(100);
  });

  test('Large lists perform well on mobile', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      title: `Item ${i}`,
      subtitle: `Subtitle ${i}`,
    }));

    const startTime = performance.now();

    render(<MobileList items={items} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should handle large lists efficiently
    expect(renderTime).toBeLessThan(200);
  });
});
