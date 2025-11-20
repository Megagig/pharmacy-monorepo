import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltersStore } from '../../stores/filtersStore';
import { mockFilters, mockDateRange } from '../mocks/mockData';
import { ReportType } from '../../types';

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('filtersStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(null);
        // Reset store state
        useFiltersStore.getState().reset?.();
    });

    it('initializes with default filters', () => {
        const { result } = renderHook(() => useFiltersStore());

        expect(result.current.filters).toBeDefined();
        expect(result.current.filters.dateRange).toBeDefined();
        expect(result.current.isLoading).toBe(false);
    });

    it('sets filters correctly', () => {
        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.setFilters(mockFilters);
        });

        expect(result.current.filters).toEqual(mockFilters);
    });

    it('updates date range filter', () => {
        const { result } = renderHook(() => useFiltersStore());

        const newDateRange = {
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-30'),
            preset: '30d' as const,
        };

        act(() => {
            result.current.setDateRange(newDateRange);
        });

        expect(result.current.filters.dateRange).toEqual(newDateRange);
    });

    it('adds therapy type filter', () => {
        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.addTherapyType('new-therapy');
        });

        expect(result.current.filters.therapyType).toContain('new-therapy');
    });

    it('removes therapy type filter', () => {
        const { result } = renderHook(() => useFiltersStore());

        // Set initial filters with therapy types
        act(() => {
            result.current.setFilters(mockFilters);
        });

        act(() => {
            result.current.removeTherapyType('medication-therapy');
        });

        expect(result.current.filters.therapyType).not.toContain('medication-therapy');
    });

    it('sets pharmacist filter', () => {
        const { result } = renderHook(() => useFiltersStore());

        const pharmacistIds = ['pharmacist-3', 'pharmacist-4'];

        act(() => {
            result.current.setPharmacistIds(pharmacistIds);
        });

        expect(result.current.filters.pharmacistId).toEqual(pharmacistIds);
    });

    it('sets location filter', () => {
        const { result } = renderHook(() => useFiltersStore());

        const locations = ['location-2', 'location-3'];

        act(() => {
            result.current.setLocations(locations);
        });

        expect(result.current.filters.location).toEqual(locations);
    });

    it('resets filters to default', () => {
        const { result } = renderHook(() => useFiltersStore());

        // Set custom filters
        act(() => {
            result.current.setFilters(mockFilters);
        });

        expect(result.current.filters).toEqual(mockFilters);

        // Reset filters
        act(() => {
            result.current.resetFilters();
        });

        expect(result.current.filters.therapyType).toEqual([]);
        expect(result.current.filters.pharmacistId).toEqual([]);
    });

    it('validates date range correctly', () => {
        const { result } = renderHook(() => useFiltersStore());

        const invalidDateRange = {
            startDate: new Date('2024-12-31'),
            endDate: new Date('2024-01-01'), // End before start
        };

        act(() => {
            result.current.setDateRange(invalidDateRange);
        });

        // Should handle invalid date range gracefully
        expect(result.current.filters.dateRange).toBeDefined();
    });

    it('persists filters to localStorage', () => {
        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.setFilters(mockFilters);
        });

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
            'reports-filters',
            expect.stringContaining('dateRange')
        );
    });

    it('loads filters from localStorage', () => {
        const storedFilters = JSON.stringify({
            ...mockFilters,
            dateRange: {
                ...mockFilters.dateRange,
                startDate: mockFilters.dateRange.startDate.toISOString(),
                endDate: mockFilters.dateRange.endDate.toISOString(),
            },
        });

        mockLocalStorage.getItem.mockReturnValue(storedFilters);

        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.loadFiltersFromStorage();
        });

        expect(result.current.filters.therapyType).toEqual(mockFilters.therapyType);
    });

    it('handles localStorage errors gracefully', () => {
        mockLocalStorage.getItem.mockImplementation(() => {
            throw new Error('localStorage error');
        });

        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.loadFiltersFromStorage();
        });

        // Should not crash and maintain default state
        expect(result.current.filters).toBeDefined();
    });

    it('applies preset date ranges correctly', () => {
        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.applyDatePreset('30d');
        });

        expect(result.current.filters.dateRange.preset).toBe('30d');
        expect(result.current.filters.dateRange.startDate).toBeInstanceOf(Date);
        expect(result.current.filters.dateRange.endDate).toBeInstanceOf(Date);
    });

    it('clears specific filter types', () => {
        const { result } = renderHook(() => useFiltersStore());

        // Set initial filters
        act(() => {
            result.current.setFilters(mockFilters);
        });

        // Clear therapy type filters
        act(() => {
            result.current.clearTherapyTypes();
        });

        expect(result.current.filters.therapyType).toEqual([]);
        expect(result.current.filters.pharmacistId).toEqual(mockFilters.pharmacistId); // Other filters unchanged
    });

    it('validates filter combinations', () => {
        const { result } = renderHook(() => useFiltersStore());

        const conflictingFilters = {
            ...mockFilters,
            priority: ['high'],
            status: ['inactive'], // Might conflict with high priority
        };

        act(() => {
            result.current.setFilters(conflictingFilters);
        });

        const isValid = result.current.validateFilters();
        expect(typeof isValid).toBe('boolean');
    });

    it('gets filter summary correctly', () => {
        const { result } = renderHook(() => useFiltersStore());

        act(() => {
            result.current.setFilters(mockFilters);
        });

        const summary = result.current.getFilterSummary();
        expect(summary).toBeDefined();
        expect(summary.activeFilters).toBeGreaterThan(0);
    });

    it('handles custom filters', () => {
        const { result } = renderHook(() => useFiltersStore());

        const customFilters = {
            customField1: 'value1',
            customField2: ['value2', 'value3'],
        };

        act(() => {
            result.current.setCustomFilters(customFilters);
        });

        expect(result.current.filters.customFilters).toEqual(customFilters);
    });
});