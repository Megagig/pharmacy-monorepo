import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDebounce, useAdvancedDebounce } from '../useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('should debounce value changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 500 },
            }
        );

        expect(result.current).toBe('initial');

        // Change value
        rerender({ value: 'updated', delay: 500 });
        expect(result.current).toBe('initial'); // Should still be initial

        // Fast forward time but not enough
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(result.current).toBe('initial');

        // Fast forward past delay
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 500 },
            }
        );

        // Rapid changes
        rerender({ value: 'change1', delay: 500 });
        act(() => {
            vi.advanceTimersByTime(250);
        });

        rerender({ value: 'change2', delay: 500 });
        act(() => {
            vi.advanceTimersByTime(250);
        });

        rerender({ value: 'final', delay: 500 });

        // Should still be initial because timer keeps resetting
        expect(result.current).toBe('initial');

        // Now let it complete
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(result.current).toBe('final');
    });

    it('should handle different delay values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 1000 },
            }
        );

        rerender({ value: 'updated', delay: 100 });

        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(result.current).toBe('updated');
    });

    it('should handle zero delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 0 },
            }
        );

        rerender({ value: 'updated', delay: 0 });

        act(() => {
            vi.advanceTimersByTime(0);
        });
        expect(result.current).toBe('updated');
    });
});

describe('useAdvancedDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('should support leading edge execution', () => {
        const { result, rerender } = renderHook(
            ({ value, delay, options }) => useAdvancedDebounce(value, delay, options),
            {
                initialProps: {
                    value: 'initial',
                    delay: 500,
                    options: { leading: true, trailing: false },
                },
            }
        );

        expect(result.current).toBe('initial');

        // Change value - should execute immediately due to leading edge
        rerender({
            value: 'updated',
            delay: 500,
            options: { leading: true, trailing: false },
        });

        expect(result.current).toBe('updated');
    });

    it('should support trailing edge execution', () => {
        const { result, rerender } = renderHook(
            ({ value, delay, options }) => useAdvancedDebounce(value, delay, options),
            {
                initialProps: {
                    value: 'initial',
                    delay: 500,
                    options: { leading: false, trailing: true },
                },
            }
        );

        rerender({
            value: 'updated',
            delay: 500,
            options: { leading: false, trailing: true },
        });

        expect(result.current).toBe('initial');

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe('updated');
    });

    it('should respect maxWait option', () => {
        const { result, rerender } = renderHook(
            ({ value, delay, options }) => useAdvancedDebounce(value, delay, options),
            {
                initialProps: {
                    value: 'initial',
                    delay: 1000,
                    options: { maxWait: 500, trailing: true },
                },
            }
        );

        // Rapid changes that would normally reset the timer
        rerender({
            value: 'change1',
            delay: 1000,
            options: { maxWait: 500, trailing: true },
        });

        act(() => {
            vi.advanceTimersByTime(250);
        });

        rerender({
            value: 'change2',
            delay: 1000,
            options: { maxWait: 500, trailing: true },
        });

        act(() => {
            vi.advanceTimersByTime(250);
        });

        // Should execute due to maxWait even though delay hasn't passed
        expect(result.current).toBe('change2');
    });

    it('should support both leading and trailing execution', () => {
        const { result, rerender } = renderHook(
            ({ value, delay, options }) => useAdvancedDebounce(value, delay, options),
            {
                initialProps: {
                    value: 'initial',
                    delay: 500,
                    options: { leading: true, trailing: true },
                },
            }
        );

        // First change - should execute immediately (leading)
        rerender({
            value: 'updated1',
            delay: 500,
            options: { leading: true, trailing: true },
        });

        expect(result.current).toBe('updated1');

        // Quick change - should not execute immediately
        rerender({
            value: 'updated2',
            delay: 500,
            options: { leading: true, trailing: true },
        });

        expect(result.current).toBe('updated1');

        // Wait for trailing execution
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe('updated2');
    });

    it('should handle complex scenarios with multiple options', () => {
        const { result, rerender } = renderHook(
            ({ value, delay, options }) => useAdvancedDebounce(value, delay, options),
            {
                initialProps: {
                    value: 'initial',
                    delay: 1000,
                    options: { leading: true, trailing: true, maxWait: 2000 },
                },
            }
        );

        // Series of rapid changes
        const changes = ['change1', 'change2', 'change3', 'change4', 'final'];

        changes.forEach((change, index) => {
            rerender({
                value: change,
                delay: 1000,
                options: { leading: true, trailing: true, maxWait: 2000 },
            });

            if (index === 0) {
                // First change should execute immediately (leading)
                expect(result.current).toBe(change);
            }

            // Advance time but not enough to trigger trailing
            act(() => {
                vi.advanceTimersByTime(200);
            });
        });

        // Should still be at first change
        expect(result.current).toBe('change1');

        // Advance to trigger trailing execution
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current).toBe('final');
    });
});

describe('useDebounce Edge Cases', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('should handle undefined values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: undefined, delay: 500 },
            }
        );

        expect(result.current).toBeUndefined();

        rerender({ value: 'defined', delay: 500 });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe('defined');
    });

    it('should handle null values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: null, delay: 500 },
            }
        );

        expect(result.current).toBeNull();

        rerender({ value: 'not null', delay: 500 });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe('not null');
    });

    it('should handle object values', () => {
        const initialObj = { id: 1, name: 'initial' };
        const updatedObj = { id: 2, name: 'updated' };

        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: initialObj, delay: 500 },
            }
        );

        expect(result.current).toBe(initialObj);

        rerender({ value: updatedObj, delay: 500 });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe(updatedObj);
    });

    it('should handle array values', () => {
        const initialArray = [1, 2, 3];
        const updatedArray = [4, 5, 6];

        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: initialArray, delay: 500 },
            }
        );

        expect(result.current).toBe(initialArray);

        rerender({ value: updatedArray, delay: 500 });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current).toBe(updatedArray);
    });
});