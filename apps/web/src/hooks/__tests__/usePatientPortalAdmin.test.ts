/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';
import { usePatientPortalAdmin } from '../usePatientPortalAdmin';

// Mock fetch globally
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('usePatientPortalAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  describe('usePortalStats', () => {
    it('fetches portal statistics successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePortalStats(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        totalPatients: 1247,
        activePatients: 1089,
        pendingApprovals: 23,
        pendingRefills: 45,
        monthlyLogins: 3456,
        messagesSent: 789,
        appointmentsBooked: 234,
        engagementRate: 78,
      });
    });

    it('handles loading state', () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePortalStats(),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('usePatientUsers', () => {
    it('fetches patient users with filters', async () => {
      const params = { status: 'pending', page: 1, limit: 20 };
      
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePatientUsers(params),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveProperty('users');
      expect(result.current.data).toHaveProperty('counts');
      expect(result.current.data).toHaveProperty('pagination');
    });

    it('filters users by status', async () => {
      const params = { status: 'active' };
      
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePatientUsers(params),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // All returned users should have 'active' status
      const activeUsers = result.current.data?.users.filter(user => user.status === 'active');
      expect(activeUsers?.length).toBe(result.current.data?.users.length);
    });
  });

  describe('useRefillRequests', () => {
    it('fetches refill requests successfully', async () => {
      const params = { page: 1, limit: 20 };
      
      const { result } = renderHook(
        () => usePatientPortalAdmin().useRefillRequests(params),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveProperty('requests');
      expect(result.current.data).toHaveProperty('counts');
      expect(result.current.data?.requests).toBeInstanceOf(Array);
    });

    it('filters requests by status', async () => {
      const params = { status: 'pending' };
      
      const { result } = renderHook(
        () => usePatientPortalAdmin().useRefillRequests(params),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const pendingRequests = result.current.data?.requests.filter(req => req.status === 'pending');
      expect(pendingRequests?.length).toBe(result.current.data?.requests.length);
    });
  });

  describe('usePortalAnalytics', () => {
    it('fetches analytics data successfully', async () => {
      const params = { timeRange: '30d' };
      
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePortalAnalytics(params),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });

      expect(result.current.data).toHaveProperty('metrics');
      expect(result.current.data).toHaveProperty('charts');
      expect(result.current.data?.charts).toHaveProperty('dailyActiveUsers');
      expect(result.current.data?.charts).toHaveProperty('userStatusDistribution');
    });
  });

  describe('usePortalSettings', () => {
    it('fetches portal settings successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePortalSettings(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveProperty('general');
      expect(result.current.data).toHaveProperty('features');
      expect(result.current.data).toHaveProperty('notifications');
      expect(result.current.data).toHaveProperty('security');
      expect(result.current.data).toHaveProperty('customization');
      expect(result.current.data).toHaveProperty('businessHours');
    });
  });

  describe('usePharmacists', () => {
    it('fetches pharmacists list successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().usePharmacists(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeInstanceOf(Array);
      expect(result.current.data?.[0]).toHaveProperty('id');
      expect(result.current.data?.[0]).toHaveProperty('firstName');
      expect(result.current.data?.[0]).toHaveProperty('lastName');
    });
  });

  describe('User action mutations', () => {
    it('approves user successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useApproveUser(),
        { wrapper: createWrapper() }
      );

      const userId = 'patient_1';
      
      result.current.mutate(userId, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('suspends user with reason', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useSuspendUser(),
        { wrapper: createWrapper() }
      );

      const suspendData = { userId: 'patient_1', reason: 'Policy violation' };
      
      result.current.mutate(suspendData, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('activates user successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useActivateUser(),
        { wrapper: createWrapper() }
      );

      const userId = 'patient_1';
      
      result.current.mutate(userId, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('removes user successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useRemoveUser(),
        { wrapper: createWrapper() }
      );

      const userId = 'patient_1';
      
      result.current.mutate(userId, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Refill request action mutations', () => {
    it('approves refill request successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useApproveRefillRequest(),
        { wrapper: createWrapper() }
      );

      const approveData = { requestId: 'refill_1', estimatedPickupDate: '2024-02-01' };
      
      result.current.mutate(approveData, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('denies refill request with reason', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useDenyRefillRequest(),
        { wrapper: createWrapper() }
      );

      const denyData = { requestId: 'refill_1', reason: 'Insufficient refills remaining' };
      
      result.current.mutate(denyData, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('assigns refill request to pharmacist', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useAssignRefillRequest(),
        { wrapper: createWrapper() }
      );

      const assignData = { requestId: 'refill_1', pharmacistId: 'pharm_1' };
      
      result.current.mutate(assignData, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Settings mutations', () => {
    it('updates portal settings successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useUpdatePortalSettings(),
        { wrapper: createWrapper() }
      );

      const settings = {
        general: { portalEnabled: true },
        features: { appointments: true },
      };
      
      result.current.mutate(settings, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('resets portal settings successfully', async () => {
      const { result } = renderHook(
        () => usePatientPortalAdmin().useResetPortalSettings(),
        { wrapper: createWrapper() }
      );
      
      result.current.mutate(undefined, {
        onSuccess: (data) => {
          expect(data).toEqual({ success: true });
        },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });
});