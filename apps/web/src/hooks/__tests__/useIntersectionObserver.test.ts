import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { useIntersectionObserver, useMultipleIntersectionObserver } from '../useIntersectionObserver';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

beforeAll(() => {
    global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => {
        mockIntersectionObserver.mockImplementation(callback);
        return {
            observe: mockObserve,
            unobserve: mockUnobserve,
            disconnect: mockDisconnect,
            root: options?.root || null,
            rootMargin: options?.rootMargin || '0px',
            thresholds: Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0],
        };
    });
});

beforeEach(() => {
    mockIntersectionObserver.mockClear();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
});

describe('useIntersectionObserver', () => {
    it('should initialize with default values', () => {
        const { result } = renderHook(() => useIntersectionObserver());

        expect(result.current.entry).toBeUndefined();
        expect(result.current.isIntersecting).toBe(false);
        expect(result.current.targetRef.current).toBeNull();
    });

    it('should create IntersectionObserver when target is set', () => {
        const { result } = renderHook(() => useIntersectionObserver());

        // Simulate setting a target element
        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        // Re-render to trigger useEffect
        const { rerender } = renderHook(() => useIntersectionObserver());
        rerender();

        expect(global.IntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            {
                threshold: 0,
                root: null,
                rootMargin: '0%',
            }
        );
        expect(mockObserve).toHaveBeenCalledWith(mockElement);
    });

    it('should handle intersection changes', () => {
        const { result } = renderHook(() => useIntersectionObserver());

        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        // Simulate intersection change
        const mockEntry = {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 0.5,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        act(() => {
            mockIntersectionObserver([mockEntry]);
        });

        expect(result.current.entry).toBe(mockEntry);
        expect(result.current.isIntersecting).toBe(true);
    });

    it('should respect custom options', () => {
        const options = {
            threshold: 0.5,
            root: document.body,
            rootMargin: '10px',
        };

        const { result } = renderHook(() => useIntersectionObserver(options));

        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        expect(global.IntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            options
        );
    });

    it('should freeze when freezeOnceVisible is true and element is visible', () => {
        const { result } = renderHook(() =>
            useIntersectionObserver({ freezeOnceVisible: true })
        );

        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        // First intersection - becomes visible
        const mockEntry1 = {
            target: mockElement,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        act(() => {
            mockIntersectionObserver([mockEntry1]);
        });

        expect(result.current.isIntersecting).toBe(true);

        // Second intersection - should be frozen
        const mockEntry2 = {
            ...mockEntry1,
            isIntersecting: false,
        };

        act(() => {
            mockIntersectionObserver([mockEntry2]);
        });

        // Should still be true because it's frozen
        expect(result.current.isIntersecting).toBe(true);
    });

    it('should disconnect observer on unmount', () => {
        const { result, unmount } = renderHook(() => useIntersectionObserver());

        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle missing IntersectionObserver support', () => {
        // Temporarily remove IntersectionObserver
        const originalIO = global.IntersectionObserver;
        // @ts-expect-error
        delete global.IntersectionObserver;

        const { result } = renderHook(() => useIntersectionObserver());

        const mockElement = document.createElement('div');
        act(() => {
            result.current.targetRef.current = mockElement;
        });

        // Should not crash and should have default values
        expect(result.current.entry).toBeUndefined();
        expect(result.current.isIntersecting).toBe(false);

        // Restore IntersectionObserver
        global.IntersectionObserver = originalIO;
    });
});

describe('useMultipleIntersectionObserver', () => {
    it('should initialize with empty entries', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        expect(result.current.entries.size).toBe(0);
        expect(typeof result.current.observe).toBe('function');
        expect(typeof result.current.unobserve).toBe('function');
        expect(typeof result.current.disconnect).toBe('function');
    });

    it('should observe multiple elements', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        const element1 = document.createElement('div');
        const element2 = document.createElement('div');

        act(() => {
            result.current.observe(element1);
            result.current.observe(element2);
        });

        expect(mockObserve).toHaveBeenCalledWith(element1);
        expect(mockObserve).toHaveBeenCalledWith(element2);
    });

    it('should handle intersection changes for multiple elements', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        const element1 = document.createElement('div');
        const element2 = document.createElement('div');

        act(() => {
            result.current.observe(element1);
            result.current.observe(element2);
        });

        const mockEntry1 = {
            target: element1,
            isIntersecting: true,
            intersectionRatio: 0.5,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        const mockEntry2 = {
            target: element2,
            isIntersecting: false,
            intersectionRatio: 0,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        act(() => {
            mockIntersectionObserver([mockEntry1, mockEntry2]);
        });

        expect(result.current.entries.get(element1)).toBe(mockEntry1);
        expect(result.current.entries.get(element2)).toBe(mockEntry2);
        expect(result.current.entries.size).toBe(2);
    });

    it('should unobserve specific elements', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        const element1 = document.createElement('div');
        const element2 = document.createElement('div');

        act(() => {
            result.current.observe(element1);
            result.current.observe(element2);
        });

        // Add entries
        const mockEntry1 = {
            target: element1,
            isIntersecting: true,
            intersectionRatio: 0.5,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        act(() => {
            mockIntersectionObserver([mockEntry1]);
        });

        expect(result.current.entries.size).toBe(1);

        // Unobserve element1
        act(() => {
            result.current.unobserve(element1);
        });

        expect(mockUnobserve).toHaveBeenCalledWith(element1);
        expect(result.current.entries.size).toBe(0);
    });

    it('should disconnect all observers', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        const element1 = document.createElement('div');
        const element2 = document.createElement('div');

        act(() => {
            result.current.observe(element1);
            result.current.observe(element2);
        });

        act(() => {
            result.current.disconnect();
        });

        expect(mockDisconnect).toHaveBeenCalled();
        expect(result.current.entries.size).toBe(0);
    });

    it('should disconnect on unmount', () => {
        const { result, unmount } = renderHook(() => useMultipleIntersectionObserver());

        const element = document.createElement('div');
        act(() => {
            result.current.observe(element);
        });

        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should handle options correctly', () => {
        const options = {
            threshold: [0, 0.5, 1],
            rootMargin: '20px',
        };

        const { result } = renderHook(() => useMultipleIntersectionObserver(options));

        const element = document.createElement('div');
        act(() => {
            result.current.observe(element);
        });

        expect(global.IntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            options
        );
    });

    it('should update entries correctly when same element intersects multiple times', () => {
        const { result } = renderHook(() => useMultipleIntersectionObserver());

        const element = document.createElement('div');
        act(() => {
            result.current.observe(element);
        });

        // First intersection
        const mockEntry1 = {
            target: element,
            isIntersecting: true,
            intersectionRatio: 0.5,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: {} as DOMRectReadOnly,
            time: Date.now(),
        };

        act(() => {
            mockIntersectionObserver([mockEntry1]);
        });

        expect(result.current.entries.get(element)).toBe(mockEntry1);

        // Second intersection - should update the entry
        const mockEntry2 = {
            ...mockEntry1,
            isIntersecting: false,
            intersectionRatio: 0,
            time: Date.now() + 1000,
        };

        act(() => {
            mockIntersectionObserver([mockEntry2]);
        });

        expect(result.current.entries.get(element)).toBe(mockEntry2);
        expect(result.current.entries.size).toBe(1);
    });
});