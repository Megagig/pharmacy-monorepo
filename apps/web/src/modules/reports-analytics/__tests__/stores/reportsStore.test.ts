import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReportsStore } from '../../stores/reportsStore';
import { mockReportData, mockFilters, createMockApiResponse, createMockApiError } from '../mocks/mockData';
import { ReportType } from '../../types';

// Mock fetch
global.fetch = vi.fn();

describe('reportsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store state
        useReportsStore.getState().reset?.();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useReportsStore());

        expect(result.current.activeReport).toBe(ReportType.PATIENT_OUTCOMES);
        expect(result.current.reportData).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('sets active report correctly', () => {
        const { result } = renderHook(() => useReportsStore());

        act(() => {
            result.current.setActiveReport(ReportType.PHARMACIST_INTERVENTIONS);
        });

        expect(result.current.activeReport).toBe(ReportType.PHARMACIST_INTERVENTIONS);
    });

    it('fetches report data successfully', async () => {
        const mockResponse = createMockApiResponse(mockReportData);
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

        const { result } = renderHook(() => useReportsStore());

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.reportData).toEqual(mockReportData);
        expect(result.current.error).toBeNull();
    });

    it('handles fetch error correctly', async () => {
        const mockError = createMockApiError('Network error', 500);
        vi.mocked(fetch).mockRejectedValueOnce(mockError);

        const { result } = renderHook(() => useReportsStore());

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.reportData).toBeNull();
        expect(result.current.error).toBe('Network error');
    });

    it('sets loading state during fetch', async () => {
        const mockResponse = createMockApiResponse(mockReportData, 1000);
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

        const { result } = renderHook(() => useReportsStore());

        act(() => {
            result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 1100));
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('clears error when new fetch starts', async () => {
        const { result } = renderHook(() => useReportsStore());

        // Set initial error
        act(() => {
            result.current.setError('Previous error');
        });

        expect(result.current.error).toBe('Previous error');

        const mockResponse = createMockApiResponse(mockReportData);
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.error).toBeNull();
    });

    it('caches report data correctly', async () => {
        const mockResponse = createMockApiResponse(mockReportData);
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

        const { result } = renderHook(() => useReportsStore());

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.reportData).toEqual(mockReportData);

        // Second call should use cached data
        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(fetch).toHaveBeenCalledTimes(1); // Should not fetch again
    });

    it('refreshes data when filters change', async () => {
        const mockResponse1 = createMockApiResponse(mockReportData);
        const mockResponse2 = createMockApiResponse({ ...mockReportData, summary: { ...mockReportData.summary, totalPatients: 2000 } });

        vi.mocked(fetch)
            .mockResolvedValueOnce(mockResponse1 as any)
            .mockResolvedValueOnce(mockResponse2 as any);

        const { result } = renderHook(() => useReportsStore());

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        expect(result.current.reportData?.summary.totalPatients).toBe(1250);

        const newFilters = { ...mockFilters, priority: ['high'] };

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, newFilters);
        });

        expect(result.current.reportData?.summary.totalPatients).toBe(2000);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('handles concurrent fetch requests correctly', async () => {
        const mockResponse1 = createMockApiResponse(mockReportData, 100);
        const mockResponse2 = createMockApiResponse({ ...mockReportData, summary: { ...mockReportData.summary, totalPatients: 2000 } }, 50);

        vi.mocked(fetch)
            .mockResolvedValueOnce(mockResponse1 as any)
            .mockResolvedValueOnce(mockResponse2 as any);

        const { result } = renderHook(() => useReportsStore());

        // Start two concurrent requests
        const promise1 = act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        const promise2 = act(async () => {
            await result.current.fetchReportData(ReportType.PHARMACIST_INTERVENTIONS, mockFilters);
        });

        await Promise.all([promise1, promise2]);

        // Should handle concurrent requests without race conditions
        expect(result.current.isLoading).toBe(false);
        expect(result.current.reportData).toBeDefined();
    });

    it('validates report data structure', async () => {
        const invalidData = { invalid: 'data' };
        const mockResponse = createMockApiResponse(invalidData);
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

        const { result } = renderHook(() => useReportsStore());

        await act(async () => {
            await result.current.fetchReportData(ReportType.PATIENT_OUTCOMES, mockFilters);
        });

        // Should handle invalid data gracefully
        expect(result.current.error).toBeTruthy();
    });
});