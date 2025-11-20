import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
    freezeOnceVisible?: boolean;
}

/**
 * Custom hook for intersection observer
 * Useful for infinite scrolling and lazy loading
 */
export function useIntersectionObserver({
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
}: UseIntersectionObserverOptions = {}) {
    const [entry, setEntry] = useState<IntersectionObserverEntry>();
    const [isIntersecting, setIsIntersecting] = useState(false);
    const targetRef = useRef<HTMLDivElement>(null);

    const frozen = entry?.isIntersecting && freezeOnceVisible;

    const updateEntry = useCallback(
        ([entry]: IntersectionObserverEntry[]): void => {
            setEntry(entry);
            setIsIntersecting(entry.isIntersecting);
        },
        []
    );

    useEffect(() => {
        const node = targetRef.current;
        const hasIOSupport = !!window.IntersectionObserver;

        if (!hasIOSupport || frozen || !node) return;

        const observerParams = { threshold, root, rootMargin };
        const observer = new IntersectionObserver(updateEntry, observerParams);

        observer.observe(node);

        return () => observer.disconnect();
    }, [targetRef, threshold, root, rootMargin, frozen, updateEntry]);

    return {
        targetRef,
        entry,
        isIntersecting,
    };
}

/**
 * Hook for multiple intersection observers
 */
export function useMultipleIntersectionObserver(
    options: UseIntersectionObserverOptions = {}
) {
    const [entries, setEntries] = useState<Map<Element, IntersectionObserverEntry>>(
        new Map()
    );
    const observerRef = useRef<IntersectionObserver>();

    const observe = useCallback((element: Element) => {
        if (!observerRef.current) {
            observerRef.current = new IntersectionObserver(
                (observerEntries) => {
                    setEntries((prev) => {
                        const newEntries = new Map(prev);
                        observerEntries.forEach((entry) => {
                            newEntries.set(entry.target, entry);
                        });
                        return newEntries;
                    });
                },
                options
            );
        }

        observerRef.current.observe(element);
    }, [options]);

    const unobserve = useCallback((element: Element) => {
        if (observerRef.current) {
            observerRef.current.unobserve(element);
            setEntries((prev) => {
                const newEntries = new Map(prev);
                newEntries.delete(element);
                return newEntries;
            });
        }
    }, []);

    const disconnect = useCallback(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            setEntries(new Map());
        }
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        entries,
        observe,
        unobserve,
        disconnect,
    };
}

export default useIntersectionObserver;