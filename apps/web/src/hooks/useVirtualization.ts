import { useMemo, useCallback, useState, useEffect } from 'react';

interface VirtualizationOptions {
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
    scrollingDelay?: number;
}

interface VirtualItem {
    index: number;
    start: number;
    end: number;
    size: number;
}

/**
 * Custom hook for virtualization logic
 * Calculates visible items and scroll positions
 */
export function useVirtualization<T>(
    items: T[],
    options: VirtualizationOptions
) {
    const {
        itemHeight,
        containerHeight,
        overscan = 5,
        scrollingDelay = 150,
    } = options;

    const [scrollTop, setScrollTop] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);

    // Calculate total height
    const totalHeight = useMemo(() => {
        return items.length * itemHeight;
    }, [items.length, itemHeight]);

    // Calculate visible range
    const visibleRange = useMemo(() => {
        const start = Math.floor(scrollTop / itemHeight);
        const end = Math.min(
            start + Math.ceil(containerHeight / itemHeight),
            items.length - 1
        );

        return {
            start: Math.max(0, start - overscan),
            end: Math.min(items.length - 1, end + overscan),
        };
    }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

    // Calculate virtual items
    const virtualItems = useMemo(() => {
        const items: VirtualItem[] = [];
        for (let i = visibleRange.start; i <= visibleRange.end; i++) {
            items.push({
                index: i,
                start: i * itemHeight,
                end: (i + 1) * itemHeight,
                size: itemHeight,
            });
        }
        return items;
    }, [visibleRange, itemHeight]);

    // Get visible items
    const visibleItems = useMemo(() => {
        return virtualItems.map((virtualItem) => ({
            ...virtualItem,
            item: items[virtualItem.index],
        }));
    }, [virtualItems, items]);

    // Handle scroll
    const handleScroll = useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
            const scrollTop = event.currentTarget.scrollTop;
            setScrollTop(scrollTop);

            if (!isScrolling) {
                setIsScrolling(true);
            }
        },
        [isScrolling]
    );

    // Reset scrolling state after delay
    useEffect(() => {
        if (isScrolling) {
            const timer = setTimeout(() => {
                setIsScrolling(false);
            }, scrollingDelay);

            return () => clearTimeout(timer);
        }
    }, [isScrolling, scrollingDelay]);

    // Scroll to item
    const scrollToItem = useCallback(
        (index: number, align: 'start' | 'center' | 'end' = 'start') => {
            let scrollTop: number;

            switch (align) {
                case 'start':
                    scrollTop = index * itemHeight;
                    break;
                case 'center':
                    scrollTop = index * itemHeight - containerHeight / 2 + itemHeight / 2;
                    break;
                case 'end':
                    scrollTop = index * itemHeight - containerHeight + itemHeight;
                    break;
                default:
                    scrollTop = index * itemHeight;
            }

            setScrollTop(Math.max(0, Math.min(scrollTop, totalHeight - containerHeight)));
        },
        [itemHeight, containerHeight, totalHeight]
    );

    return {
        totalHeight,
        visibleRange,
        virtualItems,
        visibleItems,
        isScrolling,
        scrollTop,
        handleScroll,
        scrollToItem,
    };
}

/**
 * Hook for dynamic item heights (more complex virtualization)
 */
export function useDynamicVirtualization<T>(
    items: T[],
    estimateItemHeight: (index: number) => number,
    containerHeight: number,
    overscan: number = 5
) {
    const [scrollTop, setScrollTop] = useState(0);
    const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(
        new Map()
    );

    // Calculate item positions
    const itemPositions = useMemo(() => {
        const positions: { start: number; end: number; size: number }[] = [];
        let currentPosition = 0;

        for (let i = 0; i < items.length; i++) {
            const height = measuredHeights.get(i) ?? estimateItemHeight(i);
            positions.push({
                start: currentPosition,
                end: currentPosition + height,
                size: height,
            });
            currentPosition += height;
        }

        return positions;
    }, [items.length, measuredHeights, estimateItemHeight]);

    // Calculate total height
    const totalHeight = useMemo(() => {
        return itemPositions.length > 0
            ? itemPositions[itemPositions.length - 1].end
            : 0;
    }, [itemPositions]);

    // Find visible range using binary search
    const visibleRange = useMemo(() => {
        if (itemPositions.length === 0) {
            return { start: 0, end: 0 };
        }

        const findIndex = (position: number) => {
            let low = 0;
            let high = itemPositions.length - 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const itemPosition = itemPositions[mid];

                if (itemPosition.start <= position && position < itemPosition.end) {
                    return mid;
                } else if (itemPosition.end <= position) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            return Math.min(low, itemPositions.length - 1);
        };

        const start = findIndex(scrollTop);
        const end = findIndex(scrollTop + containerHeight);

        return {
            start: Math.max(0, start - overscan),
            end: Math.min(itemPositions.length - 1, end + overscan),
        };
    }, [scrollTop, containerHeight, itemPositions, overscan]);

    // Calculate virtual items
    const virtualItems = useMemo(() => {
        const items: (VirtualItem & { item: T })[] = [];
        for (let i = visibleRange.start; i <= visibleRange.end; i++) {
            const position = itemPositions[i];
            if (position) {
                items.push({
                    index: i,
                    start: position.start,
                    end: position.end,
                    size: position.size,
                    item: items[i],
                });
            }
        }
        return items;
    }, [visibleRange, itemPositions, items]);

    // Measure item height
    const measureItem = useCallback((index: number, height: number) => {
        setMeasuredHeights((prev) => {
            const newMap = new Map(prev);
            newMap.set(index, height);
            return newMap;
        });
    }, []);

    // Handle scroll
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(event.currentTarget.scrollTop);
    }, []);

    return {
        totalHeight,
        visibleRange,
        virtualItems,
        scrollTop,
        handleScroll,
        measureItem,
    };
}

export default useVirtualization;