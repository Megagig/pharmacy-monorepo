import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useMTRSessions,
  useMTRSession,
  useCreateMTRSession,
  useUpdateMTRSession,
  useDrugTherapyProblems,
  useCreateDrugTherapyProblem,
  useMTRInterventions,
  useCreateMTRIntervention,
  useMTRFollowUps,
  useCreateMTRFollowUp,
  useMTRSummaryReport,
  useInterventionEffectivenessReport,
  usePharmacistPerformanceReport,
  useQualityAssuranceReport,
  useOutcomeMetricsReport,
} from '../useMTRQueries';

// Mock the MTR service
vi.mock('../../services/mtrService', () => ({
  mtrService: {
    getMTRSessions: vi.fn(),
    getMTRSession: vi.fn(),
    createMTRSession: vi.fn(),
    updateMTRSession: vi.fn(),
    completeMTRSession: vi.fn(),
    getDrugTherapyProblems: vi.fn(),
    createDrugTherapyProblem: vi.fn(),
    updateDrugTherapyProblem: vi.fn(),
    getMTRInterventions: vi.fn(),
    createMTRIntervention: vi.fn(),
    updateMTRIntervention: vi.fn(),
    getMTRFollowUps: vi.fn(),
    createMTRFollowUp: vi.fn(),
    updateMTRFollowUp: vi.fn(),
    getMTRSummaryReport: vi.fn(),
    getInterventionEffectivenessReport: vi.fn(),
    getPharmacistPerformanceReport: vi.fn(),
    getQualityAssuranceReport: vi.fn(),
    getOutcomeMetricsReport: vi.fn(),
  },
}));

// Mock the UI store
vi.mock('../../stores', () => ({
  useUIStore: () => ({
    showNotification: vi.fn(),
  }),
}));

// Mock query keys
vi.mock('../../lib/queryClient', () => ({
  queryKeys: {
    mtr: {
      list: (params: Record<string, unknown>) => ['mtr', 'list', params],
      detail: (id: string) => ['mtr', 'detail', id],
      problems: (reviewId: string, params: Record<string, unknown>) => [
        'mtr',
        reviewId,
        'problems',
        params,
      ],
      interventions: (reviewId: string, params: Record<string, unknown>) => [
        'mtr',
        reviewId,
        'interventions',
        params,
      ],
      followUps: (reviewId: string, params: Record<string, unknown>) => [
        'mtr',
        reviewId,
        'followUps',
        params,
      ],
      reports: {
        summary: (params: Record<string, unknown>) => [
          'mtr',
          'reports',
          'summary',
          params,
        ],
        interventions: (params: Record<string, unknown>) => [
          'mtr',
          'reports',
          'interventions',
          params,
        ],
        pharmacists: (params: Record<string, unknown>) => [
          'mtr',
          'reports',
          'pharmacists',
          params,
        ],
        quality: (params: Record<string, unknown>) => [
          'mtr',
          'reports',
          'quality',
          params,
        ],
        outcomes: (params: Record<string, unknown>) => [
          'mtr',
          'reports',
          'outcomes',
          params,
        ],
      },
    },
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMTRQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Hooks', () => {
    describe('useMTRSessions', () => {
      it('should fetch MTR sessions successfully', async () => {
        const mockSessions = {
          data: {
            results: [
              {
                _id: 'session-1',
                reviewNumber: 'MTR-001',
                status: 'in_progress',
                patientId: 'patient-1',
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRSessions).mockResolvedValue(mockSessions);

        const { result } = renderHook(() => useMTRSessions(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSessions);
        expect(mtrService.getMTRSessions).toHaveBeenCalledWith({});
      });

      it('should handle MTR sessions fetch error', async () => {
        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRSessions).mockRejectedValue(
          new Error('Network error')
        );

        const { result } = renderHook(() => useMTRSessions(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(new Error('Network error'));
      });
    });

    describe('useMTRSession', () => {
      it('should fetch single MTR session successfully', async () => {
        const mockSession = {
          data: {
            _id: 'session-1',
            reviewNumber: 'MTR-001',
            status: 'in_progress',
            patientId: 'patient-1',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRSession).mockResolvedValue(mockSession);

        const { result } = renderHook(() => useMTRSession('session-1'), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockSession);
        expect(mtrService.getMTRSession).toHaveBeenCalledWith('session-1');
      });
    });

    describe('useDrugTherapyProblems', () => {
      it('should fetch drug therapy problems successfully', async () => {
        const mockProblems = {
          data: {
            results: [
              {
                _id: 'problem-1',
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction detected',
              },
            ],
            total: 1,
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getDrugTherapyProblems).mockResolvedValue(
          mockProblems
        );

        const { result } = renderHook(
          () => useDrugTherapyProblems('review-1'),
          {
            wrapper: createWrapper(),
          }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockProblems);
        expect(mtrService.getDrugTherapyProblems).toHaveBeenCalledWith(
          'review-1',
          {}
        );
      });
    });

    describe('useMTRInterventions', () => {
      it('should fetch MTR interventions successfully', async () => {
        const mockInterventions = {
          data: {
            results: [
              {
                _id: 'intervention-1',
                type: 'recommendation',
                description: 'Adjust medication dose',
                outcome: 'pending',
              },
            ],
            total: 1,
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRInterventions).mockResolvedValue(
          mockInterventions
        );

        const { result } = renderHook(() => useMTRInterventions('review-1'), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockInterventions);
        expect(mtrService.getMTRInterventions).toHaveBeenCalledWith(
          'review-1',
          {}
        );
      });
    });

    describe('useMTRFollowUps', () => {
      it('should fetch MTR follow-ups successfully', async () => {
        const mockFollowUps = {
          data: {
            results: [
              {
                _id: 'followup-1',
                type: 'phone_call',
                scheduledDate: '2024-01-15T10:00:00Z',
                status: 'scheduled',
              },
            ],
            total: 1,
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRFollowUps).mockResolvedValue(mockFollowUps);

        const { result } = renderHook(() => useMTRFollowUps('review-1'), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockFollowUps);
        expect(mtrService.getMTRFollowUps).toHaveBeenCalledWith('review-1', {});
      });
    });
  });

  describe('Mutation Hooks', () => {
    describe('useCreateMTRSession', () => {
      it('should create MTR session successfully', async () => {
        const mockResponse = {
          data: {
            _id: 'session-1',
            reviewNumber: 'MTR-001',
            status: 'in_progress',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.createMTRSession).mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useCreateMTRSession(), {
          wrapper: createWrapper(),
        });

        const createData = {
          patientId: 'patient-1',
          reviewType: 'initial' as const,
          priority: 'routine' as const,
        };

        await result.current.mutateAsync(createData);

        expect(mtrService.createMTRSession).toHaveBeenCalledWith(createData);
      });

      it('should handle create MTR session error', async () => {
        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.createMTRSession).mockRejectedValue(
          new Error('Creation failed')
        );

        const { result } = renderHook(() => useCreateMTRSession(), {
          wrapper: createWrapper(),
        });

        const createData = {
          patientId: 'patient-1',
          reviewType: 'initial' as const,
          priority: 'routine' as const,
        };

        await expect(result.current.mutateAsync(createData)).rejects.toThrow(
          'Creation failed'
        );
      });
    });

    describe('useUpdateMTRSession', () => {
      it('should update MTR session successfully', async () => {
        const mockResponse = {
          data: {
            _id: 'session-1',
            status: 'completed',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.updateMTRSession).mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useUpdateMTRSession(), {
          wrapper: createWrapper(),
        });

        const updateData = {
          sessionId: 'session-1',
          data: { status: 'completed' as const },
        };

        await result.current.mutateAsync(updateData);

        expect(mtrService.updateMTRSession).toHaveBeenCalledWith('session-1', {
          status: 'completed',
        });
      });
    });

    describe('useCreateDrugTherapyProblem', () => {
      it('should create drug therapy problem successfully', async () => {
        const mockResponse = {
          data: {
            _id: 'problem-1',
            category: 'safety',
            type: 'interaction',
            severity: 'major',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.createDrugTherapyProblem).mockResolvedValue(
          mockResponse
        );

        const { result } = renderHook(() => useCreateDrugTherapyProblem(), {
          wrapper: createWrapper(),
        });

        const createData = {
          reviewId: 'review-1',
          category: 'safety' as const,
          type: 'interaction' as const,
          severity: 'major' as const,
          description: 'Drug interaction detected',
          clinicalSignificance: 'Monitor for bleeding',
          affectedMedications: ['med-1', 'med-2'],
          evidenceLevel: 'probable' as const,
        };

        await result.current.mutateAsync(createData);

        expect(mtrService.createDrugTherapyProblem).toHaveBeenCalledWith(
          createData
        );
      });
    });

    describe('useCreateMTRIntervention', () => {
      it('should create MTR intervention successfully', async () => {
        const mockResponse = {
          data: {
            _id: 'intervention-1',
            type: 'recommendation',
            description: 'Adjust dose',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.createMTRIntervention).mockResolvedValue(
          mockResponse
        );

        const { result } = renderHook(() => useCreateMTRIntervention(), {
          wrapper: createWrapper(),
        });

        const createData = {
          reviewId: 'review-1',
          type: 'recommendation' as const,
          category: 'medication_change' as const,
          description: 'Adjust dose',
          rationale: 'Side effects reported',
          targetAudience: 'prescriber' as const,
          communicationMethod: 'phone' as const,
          priority: 'high' as const,
          urgency: 'within_24h' as const,
        };

        await result.current.mutateAsync(createData);

        expect(mtrService.createMTRIntervention).toHaveBeenCalledWith(
          createData
        );
      });
    });

    describe('useCreateMTRFollowUp', () => {
      it('should create MTR follow-up successfully', async () => {
        const mockResponse = {
          data: {
            _id: 'followup-1',
            type: 'phone_call',
            scheduledDate: '2024-01-15T10:00:00Z',
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.createMTRFollowUp).mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useCreateMTRFollowUp(), {
          wrapper: createWrapper(),
        });

        const createData = {
          reviewId: 'review-1',
          type: 'phone_call' as const,
          priority: 'medium' as const,
          description: 'Follow up on medication adherence',
          scheduledDate: new Date('2024-01-15T10:00:00Z'),
          assignedTo: 'Dr. Smith',
        };

        await result.current.mutateAsync(createData);

        expect(mtrService.createMTRFollowUp).toHaveBeenCalledWith(createData);
      });
    });
  });

  describe('Report Hooks', () => {
    describe('useMTRSummaryReport', () => {
      it('should fetch MTR summary report successfully', async () => {
        const mockReport = {
          data: {
            summary: {
              totalReviews: 100,
              completedReviews: 85,
              completionRate: 85.0,
            },
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getMTRSummaryReport).mockResolvedValue(mockReport);

        const { result } = renderHook(() => useMTRSummaryReport(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockReport);
        expect(mtrService.getMTRSummaryReport).toHaveBeenCalledWith({});
      });
    });

    describe('useInterventionEffectivenessReport', () => {
      it('should fetch intervention effectiveness report successfully', async () => {
        const mockReport = {
          data: {
            summary: {
              totalInterventions: 250,
              acceptedInterventions: 200,
              overallAcceptanceRate: 80.0,
            },
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(
          mtrService.getInterventionEffectivenessReport
        ).mockResolvedValue(mockReport);

        const { result } = renderHook(
          () => useInterventionEffectivenessReport(),
          {
            wrapper: createWrapper(),
          }
        );

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockReport);
        expect(
          mtrService.getInterventionEffectivenessReport
        ).toHaveBeenCalledWith({});
      });
    });

    describe('usePharmacistPerformanceReport', () => {
      it('should fetch pharmacist performance report successfully', async () => {
        const mockReport = {
          data: {
            pharmacistPerformance: [
              {
                _id: '1',
                pharmacistName: 'Dr. Smith',
                totalReviews: 25,
                completionRate: 92.0,
              },
            ],
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getPharmacistPerformanceReport).mockResolvedValue(
          mockReport
        );

        const { result } = renderHook(() => usePharmacistPerformanceReport(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockReport);
        expect(mtrService.getPharmacistPerformanceReport).toHaveBeenCalledWith(
          {}
        );
      });
    });

    describe('useQualityAssuranceReport', () => {
      it('should fetch quality assurance report successfully', async () => {
        const mockReport = {
          data: {
            qualityMetrics: {
              avgPlanCompletionRate: 95.0,
              avgFollowUpCompliance: 83.3,
              avgProblemResolutionRate: 90.2,
            },
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getQualityAssuranceReport).mockResolvedValue(
          mockReport
        );

        const { result } = renderHook(() => useQualityAssuranceReport(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockReport);
        expect(mtrService.getQualityAssuranceReport).toHaveBeenCalledWith({});
      });
    });

    describe('useOutcomeMetricsReport', () => {
      it('should fetch outcome metrics report successfully', async () => {
        const mockReport = {
          data: {
            summary: {
              totalReviews: 100,
              totalProblemsResolved: 150,
              adherenceImprovementRate: 75.0,
            },
          },
        };

        const { mtrService } = await import('../../services/mtrService');
        vi.mocked(mtrService.getOutcomeMetricsReport).mockResolvedValue(
          mockReport
        );

        const { result } = renderHook(() => useOutcomeMetricsReport(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockReport);
        expect(mtrService.getOutcomeMetricsReport).toHaveBeenCalledWith({});
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { mtrService } = await import('../../services/mtrService');
      vi.mocked(mtrService.getMTRSessions).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useMTRSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Network error'));
    });

    it('should handle API validation errors', async () => {
      const validationError = {
        message: 'Validation failed',
        details: { patientId: 'Patient ID is required' },
      };

      const { mtrService } = await import('../../services/mtrService');
      vi.mocked(mtrService.createMTRSession).mockRejectedValue(validationError);

      const { result } = renderHook(() => useCreateMTRSession(), {
        wrapper: createWrapper(),
      });

      const createData = {
        patientId: '',
        reviewType: 'initial' as const,
        priority: 'routine' as const,
      };

      await expect(result.current.mutateAsync(createData)).rejects.toEqual(
        validationError
      );
    });
  });

  describe('Query Invalidation', () => {
    it('should invalidate related queries after successful mutation', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { mtrService } = await import('../../services/mtrService');
      vi.mocked(mtrService.createMTRSession).mockResolvedValue({
        data: { _id: 'session-1' },
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {' '}
          {children}{' '}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateMTRSession(), { wrapper });

      const createData = {
        patientId: 'patient-1',
        reviewType: 'initial' as const,
        priority: 'routine' as const,
      };

      await result.current.mutateAsync(createData);

      // Verify that queries are invalidated after successful mutation
      expect(invalidateQueriesSpy).toHaveBeenCalled();
    });
  });
});
