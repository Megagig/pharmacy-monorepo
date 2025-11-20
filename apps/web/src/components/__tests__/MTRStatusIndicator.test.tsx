import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MTRStatusIndicator } from '../MTRStatusIndicator';
import * as patientMTRIntegrationHooks from '../../queries/usePatientMTRIntegration';

// Mock the hooks
vi.mock('../../queries/usePatientMTRIntegration');

const mockUsePatientMTRSummary = vi.mocked(
  patientMTRIntegrationHooks.usePatientMTRSummary
);

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

describe('MTRStatusIndicator', () => {
  const mockPatientId = 'patient-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator when data is loading', () => {
      mockUsePatientMTRSummary.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error chip when there is an error', () => {
      mockUsePatientMTRSummary.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load' },
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(screen.getByText('MTR Status Error')).toBeInTheDocument();
    });
  });

  describe('Chip Variant', () => {
    it('should render active MTR status chip', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 3,
        activeMTRSessions: 1,
        completedMTRSessions: 2,
        hasActiveMTR: true,
        mtrStatus: 'active' as const,
        recentMTRs: [{ _id: 'mtr-123' }],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} variant="chip" />
        </TestWrapper>
      );

      expect(screen.getByText('Active MTR')).toBeInTheDocument();
    });

    it('should render overdue MTR status chip', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 2,
        activeMTRSessions: 1,
        completedMTRSessions: 1,
        hasActiveMTR: true,
        mtrStatus: 'overdue' as const,
        recentMTRs: [{ _id: 'mtr-123' }],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} variant="chip" />
        </TestWrapper>
      );

      expect(screen.getByText('Overdue MTR')).toBeInTheDocument();
    });

    it('should render no active MTR status chip', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 1,
        activeMTRSessions: 0,
        completedMTRSessions: 1,
        hasActiveMTR: false,
        mtrStatus: 'none' as const,
        recentMTRs: [],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} variant="chip" />
        </TestWrapper>
      );

      expect(screen.getByText('No Active MTR')).toBeInTheDocument();
    });
  });

  describe('Compact Variant', () => {
    it('should render compact variant with actions', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 3,
        activeMTRSessions: 1,
        completedMTRSessions: 2,
        hasActiveMTR: true,
        mtrStatus: 'active' as const,
        recentMTRs: [{ _id: 'mtr-123' }],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator
            patientId={mockPatientId}
            variant="compact"
            showActions={true}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Detailed Variant', () => {
    it('should render detailed variant with statistics', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 5,
        activeMTRSessions: 1,
        completedMTRSessions: 4,
        hasActiveMTR: true,
        mtrStatus: 'active' as const,
        lastMTRDate: '2024-01-15T10:00:00Z',
        recentMTRs: [{ _id: 'mtr-123' }],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator
            patientId={mockPatientId}
            variant="detailed"
            showActions={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('MTR Status')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total sessions
      expect(screen.getByText('4')).toBeInTheDocument(); // Completed sessions
      expect(screen.getByText('1')).toBeInTheDocument(); // Active sessions
    });

    it('should show next scheduled MTR alert', () => {
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 2,
        activeMTRSessions: 0,
        completedMTRSessions: 2,
        hasActiveMTR: false,
        mtrStatus: 'scheduled' as const,
        nextScheduledMTR: '2024-02-15T10:00:00Z',
        recentMTRs: [],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator
            patientId={mockPatientId}
            variant="detailed"
            showActions={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/Next MTR scheduled for/)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onViewMTR when active MTR chip is clicked', async () => {
      const mockOnViewMTR = vi.fn();
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 1,
        activeMTRSessions: 1,
        completedMTRSessions: 0,
        hasActiveMTR: true,
        mtrStatus: 'active' as const,
        recentMTRs: [{ _id: 'mtr-123' }],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator
            patientId={mockPatientId}
            variant="chip"
            onViewMTR={mockOnViewMTR}
          />
        </TestWrapper>
      );

      const chip = screen.getByText('Active MTR');
      fireEvent.click(chip);

      await waitFor(() => {
        expect(mockOnViewMTR).toHaveBeenCalledWith('mtr-123');
      });
    });

    it('should call onStartMTR when start MTR action is triggered', async () => {
      const mockOnStartMTR = vi.fn();
      const mockSummary = {
        patientId: mockPatientId,
        totalMTRSessions: 0,
        activeMTRSessions: 0,
        completedMTRSessions: 0,
        hasActiveMTR: false,
        mtrStatus: 'none' as const,
        recentMTRs: [],
      };

      mockUsePatientMTRSummary.mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator
            patientId={mockPatientId}
            variant="detailed"
            showActions={true}
            onStartMTR={mockOnStartMTR}
          />
        </TestWrapper>
      );

      const startButton = screen.getByText('Start New MTR');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStartMTR).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null data gracefully', () => {
      mockUsePatientMTRSummary.mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
      });

      const { container } = render(
        <TestWrapper>
          <MTRStatusIndicator patientId={mockPatientId} />
        </TestWrapper>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should handle empty patient ID', () => {
      mockUsePatientMTRSummary.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
      });

      render(
        <TestWrapper>
          <MTRStatusIndicator patientId="" />
        </TestWrapper>
      );

      expect(mockUsePatientMTRSummary).toHaveBeenCalledWith('');
    });
  });
});
