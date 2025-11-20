import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PatientMTRWidget } from '../PatientMTRWidget';
import * as patientMTRIntegrationHooks from '../../queries/usePatientMTRIntegration';
import * as mtrHooks from '../../queries/useMTRQueries';

// Mock the hooks
vi.mock('../../queries/usePatientMTRIntegration');
vi.mock('../../queries/useMTRQueries');

const mockUsePatientDashboardMTRData = vi.mocked(
  patientMTRIntegrationHooks.usePatientDashboardMTRData
);
const mockUseSyncMedicationsWithMTR = vi.mocked(
  patientMTRIntegrationHooks.useSyncMedicationsWithMTR
);
const mockUseSyncDTPsWithMTR = vi.mocked(
  patientMTRIntegrationHooks.useSyncDTPsWithMTR
);
const mockUseCreateMTRSession = vi.mocked(mtrHooks.useCreateMTRSession);

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('PatientMTRWidget', () => {
  const mockPatientId = 'patient-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseSyncMedicationsWithMTR.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockUseSyncDTPsWithMTR.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockUseCreateMTRSession.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  describe('Loading State', () => {
    it('should show loading skeletons when data is loading', () => {
      mockUsePatientDashboardMTRData.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
      // Should show skeleton loaders
      expect(document.querySelectorAll('.MuiSkeleton-root')).toHaveLength(3);
    });
  });

  describe('Error State', () => {
    it('should show error alert when there is an error', () => {
      mockUsePatientDashboardMTRData.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load MTR data' },
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText(/Failed to load MTR data/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no MTR sessions exist', () => {
      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 0,
          activeMTRSessions: 0,
          completedMTRSessions: 0,
          hasActiveMTR: false,
          mtrStatus: 'none' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('No MTR Sessions')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Start the first medication therapy review for this patient'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Start First MTR')).toBeInTheDocument();
    });
  });

  describe('MTR Summary Stats', () => {
    it('should display MTR summary statistics', () => {
      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 5,
          activeMTRSessions: 1,
          completedMTRSessions: 4,
          hasActiveMTR: true,
          mtrStatus: 'active' as const,
          lastMTRDate: '2024-01-15T10:00:00Z',
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('5')).toBeInTheDocument(); // Total Sessions
      expect(screen.getByText('4')).toBeInTheDocument(); // Completed
      expect(screen.getByText('1')).toBeInTheDocument(); // Active
      expect(screen.getByText('Total Sessions')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Active MTR Sessions', () => {
    it('should display active MTR sessions with actions', () => {
      const mockActiveMTR = {
        _id: 'mtr-123',
        reviewNumber: 'MTR-2024-001',
        status: 'in_progress',
        priority: 'routine',
        startedAt: '2024-01-15T10:00:00Z',
        completionPercentage: 65,
        isOverdue: false,
      };

      const mockDashboardData = {
        activeMTRs: [mockActiveMTR],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 1,
          activeMTRSessions: 1,
          completedMTRSessions: 0,
          hasActiveMTR: true,
          mtrStatus: 'active' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('Active MTR Sessions')).toBeInTheDocument();
      expect(screen.getByText('MTR-2024-001')).toBeInTheDocument();
      expect(screen.getByText('routine')).toBeInTheDocument();
      expect(screen.getByText(/65% complete/)).toBeInTheDocument();
    });

    it('should show overdue indicator for overdue MTR sessions', () => {
      const mockOverdueMTR = {
        _id: 'mtr-123',
        reviewNumber: 'MTR-2024-001',
        status: 'in_progress',
        priority: 'urgent',
        startedAt: '2024-01-01T10:00:00Z',
        completionPercentage: 30,
        isOverdue: true,
      };

      const mockDashboardData = {
        activeMTRs: [mockOverdueMTR],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 1,
          activeMTRSessions: 1,
          completedMTRSessions: 0,
          hasActiveMTR: true,
          mtrStatus: 'overdue' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });
  });

  describe('Pending Actions', () => {
    it('should display pending actions', () => {
      const mockPendingActions = [
        {
          type: 'follow_up' as const,
          description: 'Follow up on medication adherence',
          dueDate: '2024-02-01T10:00:00Z',
          priority: 'high' as const,
        },
        {
          type: 'intervention' as const,
          description: 'Review drug interaction',
          priority: 'medium' as const,
        },
      ];

      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 2,
          activeMTRSessions: 0,
          completedMTRSessions: 2,
          hasActiveMTR: false,
          mtrStatus: 'none' as const,
          recentMTRs: [],
        },
        pendingActions: mockPendingActions,
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('Pending Actions')).toBeInTheDocument();
      expect(
        screen.getByText('Follow up on medication adherence')
      ).toBeInTheDocument();
      expect(screen.getByText('Review drug interaction')).toBeInTheDocument();
    });
  });

  describe('Recent MTR Sessions', () => {
    it('should display recent MTR sessions', () => {
      const mockRecentMTRs = [
        {
          _id: 'mtr-123',
          reviewNumber: 'MTR-2024-001',
          status: 'completed',
          startedAt: '2024-01-15T10:00:00Z',
          completedAt: '2024-01-20T10:00:00Z',
        },
        {
          _id: 'mtr-124',
          reviewNumber: 'MTR-2024-002',
          status: 'in_progress',
          startedAt: '2024-01-25T10:00:00Z',
        },
      ];

      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: mockRecentMTRs,
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 2,
          activeMTRSessions: 1,
          completedMTRSessions: 1,
          hasActiveMTR: true,
          mtrStatus: 'active' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('Recent MTR Sessions')).toBeInTheDocument();
      expect(screen.getByText('MTR-2024-001')).toBeInTheDocument();
      expect(screen.getByText('MTR-2024-002')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should handle start MTR action', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue({
        review: { _id: 'new-mtr-123' },
      });

      mockUseCreateMTRSession.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 0,
          activeMTRSessions: 0,
          completedMTRSessions: 0,
          hasActiveMTR: false,
          mtrStatus: 'none' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      const startButton = screen.getByText('Start MTR');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          patientId: mockPatientId,
          reviewType: 'initial',
          priority: 'routine',
        });
      });
    });

    it('should handle sync data action', async () => {
      const mockSyncMedicationsMutate = vi.fn().mockResolvedValue({});
      const mockSyncDTPsMutate = vi.fn().mockResolvedValue({});

      mockUseSyncMedicationsWithMTR.mockReturnValue({
        mutateAsync: mockSyncMedicationsMutate,
        isPending: false,
      });

      mockUseSyncDTPsWithMTR.mockReturnValue({
        mutateAsync: mockSyncDTPsMutate,
        isPending: false,
      });

      const mockActiveMTR = {
        _id: 'mtr-123',
        reviewNumber: 'MTR-2024-001',
        status: 'in_progress',
        priority: 'routine',
        startedAt: '2024-01-15T10:00:00Z',
        completionPercentage: 65,
        isOverdue: false,
      };

      const mockDashboardData = {
        activeMTRs: [mockActiveMTR],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 1,
          activeMTRSessions: 1,
          completedMTRSessions: 0,
          hasActiveMTR: true,
          mtrStatus: 'active' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget patientId={mockPatientId} />
        </TestWrapper>
      );

      // Click sync button
      const syncButton = screen.getByLabelText('Sync patient data');
      fireEvent.click(syncButton);

      // Confirm sync in dialog
      const confirmButton = screen.getByText('Sync Data');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockSyncMedicationsMutate).toHaveBeenCalledWith({
          patientId: mockPatientId,
          mtrId: 'mtr-123',
        });
        expect(mockSyncDTPsMutate).toHaveBeenCalledWith({
          patientId: mockPatientId,
          mtrId: 'mtr-123',
        });
      });
    });
  });

  describe('Custom Callbacks', () => {
    it('should call custom onStartMTR callback', async () => {
      const mockOnStartMTR = vi.fn();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        review: { _id: 'new-mtr-123' },
      });

      mockUseCreateMTRSession.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: [],
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 0,
          activeMTRSessions: 0,
          completedMTRSessions: 0,
          hasActiveMTR: false,
          mtrStatus: 'none' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget
            patientId={mockPatientId}
            onStartMTR={mockOnStartMTR}
          />
        </TestWrapper>
      );

      const startButton = screen.getByText('Start MTR');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStartMTR).toHaveBeenCalledWith('new-mtr-123');
      });
    });

    it('should call custom onViewMTR callback', () => {
      const mockOnViewMTR = vi.fn();

      const mockRecentMTRs = [
        {
          _id: 'mtr-123',
          reviewNumber: 'MTR-2024-001',
          status: 'completed',
          startedAt: '2024-01-15T10:00:00Z',
          completedAt: '2024-01-20T10:00:00Z',
        },
      ];

      const mockDashboardData = {
        activeMTRs: [],
        recentMTRs: mockRecentMTRs,
        mtrSummary: {
          patientId: mockPatientId,
          totalMTRSessions: 1,
          activeMTRSessions: 0,
          completedMTRSessions: 1,
          hasActiveMTR: false,
          mtrStatus: 'none' as const,
          recentMTRs: [],
        },
        pendingActions: [],
      };

      mockUsePatientDashboardMTRData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <PatientMTRWidget
            patientId={mockPatientId}
            onViewMTR={mockOnViewMTR}
          />
        </TestWrapper>
      );

      const mtrItem = screen.getByText('MTR-2024-001');
      fireEvent.click(mtrItem);

      expect(mockOnViewMTR).toHaveBeenCalledWith('mtr-123');
    });
  });
});
