import { useRef, useEffect, useCallback } from 'react';

export interface TouchGestureHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onPinchStart?: () => void;
    onPinchEnd?: () => void;
    onLongPress?: () => void;
    onDoubleTap?: () => void;
}

export interface TouchGestureOptions {
    swipeThreshold?: number;
    longPressDelay?: number;
    doubleTapDelay?: number;
    pinchThreshold?: number;
}

export const useTouchGestures = (
    handlers: TouchGestureHandlers,
    options: TouchGestureOptions = {}
) => {
    const {
        swipeThreshold = 50,
        longPressDelay = 500,
        doubleTapDelay = 300,
        pinchThreshold = 10,
    } = options;

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const touchEndRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapRef = useRef<number>(0);
    const initialDistanceRef = useRef<number>(0);
    const isPinchingRef = useRef<boolean>(false);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        const now = Date.now();

        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: now,
        };

        // Handle multi-touch for pinch gestures
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            initialDistanceRef.current = distance;
            isPinchingRef.current = true;
            handlers.onPinchStart?.();
        } else {
            isPinchingRef.current = false;

            // Start long press timer
            if (handlers.onLongPress) {
                longPressTimerRef.current = setTimeout(() => {
                    handlers.onLongPress?.();
                }, longPressDelay);
            }
        }
    }, [handlers, longPressDelay]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        // Cancel long press on move
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // Handle pinch gesture
        if (e.touches.length === 2 && isPinchingRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            const deltaDistance = Math.abs(distance - initialDistanceRef.current);
            if (deltaDistance > pinchThreshold) {
                // Pinch detected - you can add zoom logic here if needed
            }
        }
    }, [pinchThreshold]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        // Clear long press timer
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // Handle pinch end
        if (isPinchingRef.current) {
            isPinchingRef.current = false;
            handlers.onPinchEnd?.();
            return;
        }

        const touch = e.changedTouches[0];
        const now = Date.now();

        touchEndRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: now,
        };

        if (!touchStartRef.current || !touchEndRef.current) return;

        const deltaX = touchEndRef.current.x - touchStartRef.current.x;
        const deltaY = touchEndRef.current.y - touchStartRef.current.y;
        const deltaTime = touchEndRef.current.time - touchStartRef.current.time;

        // Check for double tap
        if (handlers.onDoubleTap && deltaTime < doubleTapDelay) {
            const timeSinceLastTap = now - lastTapRef.current;
            if (timeSinceLastTap < doubleTapDelay) {
                handlers.onDoubleTap();
                lastTapRef.current = 0; // Reset to prevent triple tap
                return;
            }
        }
        lastTapRef.current = now;

        // Check for swipe gestures
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > swipeThreshold || absY > swipeThreshold) {
            if (absX > absY) {
                // Horizontal swipe
                if (deltaX > 0) {
                    handlers.onSwipeRight?.();
                } else {
                    handlers.onSwipeLeft?.();
                }
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    handlers.onSwipeDown?.();
                } else {
                    handlers.onSwipeUp?.();
                }
            }
        }
    }, [handlers, swipeThreshold, doubleTapDelay]);

    const elementRef = useRef<HTMLElement | null>(null);

    const attachGestures = useCallback((element: HTMLElement | null) => {
        if (elementRef.current) {
            elementRef.current.removeEventListener('touchstart', handleTouchStart);
            elementRef.current.removeEventListener('touchmove', handleTouchMove);
            elementRef.current.removeEventListener('touchend', handleTouchEnd);
        }

        elementRef.current = element;

        if (element) {
            element.addEventListener('touchstart', handleTouchStart, { passive: false });
            element.addEventListener('touchmove', handleTouchMove, { passive: false });
            element.addEventListener('touchend', handleTouchEnd, { passive: false });
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
            if (elementRef.current) {
                elementRef.current.removeEventListener('touchstart', handleTouchStart);
                elementRef.current.removeEventListener('touchmove', handleTouchMove);
                elementRef.current.removeEventListener('touchend', handleTouchEnd);
            }
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return { attachGestures };
};