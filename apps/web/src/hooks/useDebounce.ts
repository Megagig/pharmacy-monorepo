import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing values
 * Useful for search inputs and API calls
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Advanced debounce hook with immediate execution option
 */
export function useAdvancedDebounce<T>(
    value: T,
    delay: number,
    options: {
        leading?: boolean;
        trailing?: boolean;
        maxWait?: number;
    } = {}
): T {
    const { leading = false, trailing = true, maxWait } = options;
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    const [lastCallTime, setLastCallTime] = useState<number>(0);

    useEffect(() => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        // Leading edge execution
        if (leading && timeSinceLastCall >= delay) {
            setDebouncedValue(value);
            setLastCallTime(now);
            return;
        }

        // Max wait exceeded
        if (maxWait && timeSinceLastCall >= maxWait) {
            setDebouncedValue(value);
            setLastCallTime(now);
            return;
        }

        // Trailing edge execution
        if (trailing) {
            const handler = setTimeout(() => {
                setDebouncedValue(value);
                setLastCallTime(Date.now());
            }, delay);

            return () => {
                clearTimeout(handler);
            };
        }
    }, [value, delay, leading, trailing, maxWait, lastCallTime]);

    return debouncedValue;
}

export default useDebounce;
