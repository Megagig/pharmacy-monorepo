/**
 * Touch gesture hooks for mobile interactions
 * Provides swipe, pinch, and other touch gesture support
 */

import { useRef, useEffect, useState, useCallback } from 'react';

interface TouchPoint {
    x: number;
    y: number;
    timestamp: number;
}

interface SwipeGestureOptions {
    threshold?: number; // Minimum distance for swipe
    velocityThreshold?: number; // Minimum velocity for swipe
    timeThreshold?: number; // Maximum time for swipe
    preventScroll?: boolean; // Prevent default scroll behavior
}

interface SwipeGestureResult {
    direction: 'left' | 'right' | 'up' | 'down' | null;
    distance: number;
    velocity: number;
    duration: number;
}

interface PinchGestureOptions {
    threshold?: number; // Minimum scale change to trigger
}

interface PinchGestureResult {
    scale: number;
    center: { x: number; y: number };
}

// Swipe gesture hook
export const useSwipeGesture = (
    onSwipe: (result: SwipeGestureResult) => void,
    options: SwipeGestureOptions = {}
) => {
    const {
        threshold = 50,
        velocityThreshold = 0.3,
        timeThreshold = 300,
        preventScroll = false,
    } = options;

    const startPoint = useRef<TouchPoint | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            startPoint.current = {
                x: touch.clientX,
                y: touch.clientY,
                timestamp: Date.now(),
            };
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (preventScroll && startPoint.current) {
            e.preventDefault();
        }
    }, [preventScroll]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!startPoint.current || e.changedTouches.length !== 1) {
            startPoint.current = null;
            return;
        }

        const touch = e.changedTouches[0];
        const endPoint = {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
        };

        const deltaX = endPoint.x - startPoint.current.x;
        const deltaY = endPoint.y - startPoint.current.y;
        const duration = endPoint.timestamp - startPoint.current.timestamp;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const velocity = distance / duration;

        // Check if gesture meets thresholds
        if (distance >= threshold && velocity >= velocityThreshold && duration <= timeThreshold) {
            let direction: SwipeGestureResult['direction'] = null;

            // Determine primary direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }

            onSwipe({
                direction,
                distance,
                velocity,
                duration,
            });
        }

        startPoint.current = null;
    }, [onSwipe, threshold, velocityThreshold, timeThreshold]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return elementRef;
};

// Pinch gesture hook
export const usePinchGesture = (
    onPinch: (result: PinchGestureResult) => void,
    options: PinchGestureOptions = {}
) => {
    const { threshold = 0.1 } = options;
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);
    const elementRef = useRef<HTMLElement | null>(null);

    const getDistance = (touch1: Touch, touch2: Touch): number => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
        };
    };

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2) {
            initialDistance.current = getDistance(e.touches[0], e.touches[1]);
            e.preventDefault();
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2 && initialDistance.current !== null) {
            e.preventDefault();

            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance.current;
            const center = getCenter(e.touches[0], e.touches[1]);

            if (Math.abs(scale - initialScale.current) >= threshold) {
                onPinch({ scale, center });
                initialScale.current = scale;
            }
        }
    }, [onPinch, threshold]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (e.touches.length < 2) {
            initialDistance.current = null;
            initialScale.current = 1;
        }
    }, []);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return elementRef;
};

// Long press gesture hook
export const useLongPress = (
    onLongPress: () => void,
    options: { delay?: number; moveThreshold?: number } = {}
) => {
    const { delay = 500, moveThreshold = 10 } = options;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startPoint = useRef<{ x: number; y: number } | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleStart = useCallback((e: TouchEvent | MouseEvent) => {
        const point = 'touches' in e ? e.touches[0] : e;
        startPoint.current = { x: point.clientX, y: point.clientY };

        timeoutRef.current = setTimeout(() => {
            onLongPress();
        }, delay);
    }, [onLongPress, delay]);

    const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
        if (!startPoint.current || !timeoutRef.current) return;

        const point = 'touches' in e ? e.touches[0] : e;
        const distance = Math.sqrt(
            Math.pow(point.clientX - startPoint.current.x, 2) +
            Math.pow(point.clientY - startPoint.current.y, 2)
        );

        if (distance > moveThreshold) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, [moveThreshold]);

    const handleEnd = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        startPoint.current = null;
    }, []);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Touch events
        element.addEventListener('touchstart', handleStart, { passive: false });
        element.addEventListener('touchmove', handleMove, { passive: false });
        element.addEventListener('touchend', handleEnd, { passive: false });
        element.addEventListener('touchcancel', handleEnd, { passive: false });

        // Mouse events for desktop testing
        element.addEventListener('mousedown', handleStart);
        element.addEventListener('mousemove', handleMove);
        element.addEventListener('mouseup', handleEnd);
        element.addEventListener('mouseleave', handleEnd);

        return () => {
            element.removeEventListener('touchstart', handleStart);
            element.removeEventListener('touchmove', handleMove);
            element.removeEventListener('touchend', handleEnd);
            element.removeEventListener('touchcancel', handleEnd);
            element.removeEventListener('mousedown', handleStart);
            element.removeEventListener('mousemove', handleMove);
            element.removeEventListener('mouseup', handleEnd);
            element.removeEventListener('mouseleave', handleEnd);
        };
    }, [handleStart, handleMove, handleEnd]);

    return elementRef;
};

// Pull to refresh hook
export const usePullToRefresh = (
    onRefresh: () => Promise<void> | void,
    options: { threshold?: number; resistance?: number } = {}
) => {
    const { threshold = 80, resistance = 2.5 } = options;
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const startY = useRef<number | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (elementRef.current?.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (startY.current === null || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY.current;

        if (deltaY > 0 && elementRef.current?.scrollTop === 0) {
            e.preventDefault();
            const distance = Math.min(deltaY / resistance, threshold * 1.5);
            setPullDistance(distance);
        }
    }, [isRefreshing, resistance, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }

        startY.current = null;
        setPullDistance(0);
    }, [pullDistance, threshold, isRefreshing, onRefresh]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return {
        elementRef,
        isRefreshing,
        pullDistance,
        shouldShowRefreshIndicator: pullDistance >= threshold,
    };
};

// Tap gesture hook (distinguishes from click)
export const useTapGesture = (
    onTap: () => void,
    options: { maxDelay?: number; maxDistance?: number } = {}
) => {
    const { maxDelay = 200, maxDistance = 10 } = options;
    const startPoint = useRef<TouchPoint | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            startPoint.current = {
                x: touch.clientX,
                y: touch.clientY,
                timestamp: Date.now(),
            };
        }
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!startPoint.current || e.changedTouches.length !== 1) {
            startPoint.current = null;
            return;
        }

        const touch = e.changedTouches[0];
        const endTime = Date.now();
        const duration = endTime - startPoint.current.timestamp;
        const distance = Math.sqrt(
            Math.pow(touch.clientX - startPoint.current.x, 2) +
            Math.pow(touch.clientY - startPoint.current.y, 2)
        );

        if (duration <= maxDelay && distance <= maxDistance) {
            onTap();
        }

        startPoint.current = null;
    }, [onTap, maxDelay, maxDistance]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchEnd]);

    return elementRef;
};

export default {
    useSwipeGesture,
    usePinchGesture,
    useLongPress,
    usePullToRefresh,
    useTapGesture,
};