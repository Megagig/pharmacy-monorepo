import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { usePatientMedications } from '../usePatientMedications';

// Mock usePatientAuth
vi.mock('../usePatientAuth', () => ({
  usePatientAuth: () => ({
    user: {
      _id: 'patient-123',
      workspaceId: 'workspace-456',
    },
    isAuthenticated: true,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const mockMedications = [
  {
    _id: 'med1',
    name: 'Metformin',
    strength: '500mg',
    dosageForm: 'Tablet',
    status: 'active',
  },
  {
    _id: 'med2',
    name: 'Lisinopril',
    strength: '10mg',
    dosageForm: 'Tablet',
    status: 'active',
  },
];

describe('usePatientMedications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        currentMedications: mockMedications,
        medicationHistory: [],
        adherenceData: { overallScore: 85 },
        refillRequests: [],
      }),
    });
  });

  it('fetches medications on mount', async () => {
    const { result } = renderHook(() => usePatientMedications());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentMedications).toEqual(mockMedications);
    expect(result.current.error).toBe(null);
  });

  it('handles fetch error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePatientMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.currentMedications).toBe(null);
  });

  it('provides refill request functionality', async () => {
    const { result } = renderHook(() => usePatientMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.requestRefill).toBe('function');
    expect(typeof result.current.cancelRefillRequest).toBe('function');
  });

  it('provides refresh functionality', async () => {
    const { result } = renderHook(() => usePatientMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refreshMedications).toBe('function');
  });

  it('does not fetch when user is not authenticated', () => {
    vi.mocked(require('../usePatientAuth').usePatientAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => usePatientMedications());

    expect(result.current.currentMedications).toBe(null);
    expect(result.current.loading).toBe(false);
  });
});