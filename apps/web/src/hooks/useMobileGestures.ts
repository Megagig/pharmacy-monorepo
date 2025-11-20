import { useRef, useEffect, useCallback, useState } from 'react';

export interface MobileGestureHandlers {
  onSwipeLeft?: (element?: HTMLElement) => void;
  onSwipeRight?: (element?: HTMLElement) => void;
  onSwipeUp?: (element?: HTMLElement) => void;
  onSwipeDown?: (element?: HTMLElement) => void;
  onPinchStart?: (element?: HTMLElement) => void;
  onPinchEnd?: (element?: HTMLElement) => void;
  onLongPress?: (element?: HTMLElement) => void;
  onDoubleTap?: (element?: HTMLElement) => void;
  onPullToRefresh?: () => void;
}

export interface MobileGestureOptions {
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  pinchThreshold?: number;
  pullToRefreshThreshold?: number;
  enableHapticFeedback?: boolean;
  preventDefaultScroll?: boolean;
}

export interface GestureState {
  isGesturing: boolean;
  gestureType: 'swipe' | 'pinch' | 'longpress' | 'doubletap' | 'pulltorefresh' | null;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  progress: number; // 0-1 for gesture completion
}

export const useMobileGestures = (
  handlers: MobileGestureHandlers,
  options: MobileGestureOptions = {}
) => {
  const {
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
    pinchThreshold = 10,
    pullToRefreshThreshold = 80,
    enableHapticFeedback = true,
    preventDefaultScroll = false,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const initialDistanceRef = useRef<number>(0);
  const isPinchingRef = useRef<boolean>(false);
  const pullStartYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const elementRef = useRef<HTMLElement | null>(null);

  const [gestureState, setGestureState] = useState<GestureState>({
    isGesturing: false,
    gestureType: null,
    direction: null,
    progress: 0,
  });

  // Haptic feedback helper
  const triggerHapticFeedback = useCallback((pattern: number | number[] = 50) => {
    if (enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [enableHapticFeedback]);

  // Calculate distance between two touch points
  const getTouchDistance = useCallback((touch1: Touch, touch2: Touch) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }, []);

  // Check if element is at top of scroll container
  const isAtTop = useCallback((element: HTMLElement) => {
    const scrollContainer = element.closest('[data-scroll-container]') || 
                           element.closest('.MuiDialog-paper') ||
                           element.closest('.MuiDrawer-paper') ||
                           document.documentElement;
    return scrollContainer.scrollTop === 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    const element = e.currentTarget as HTMLElement;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
    };

    // Handle multi-touch for pinch gestures
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getTouchDistance(touch1, touch2);
      initialDistanceRef.current = distance;
      isPinchingRef.current = true;
      
      setGestureState({
        isGesturing: true,
        gestureType: 'pinch',
        direction: null,
        progress: 0,
      });
      
      handlers.onPinchStart?.(element);
      triggerHapticFeedback(50);
    } else {
      isPinchingRef.current = false;
      pullStartYRef.current = touch.clientY;

      // Start long press timer
      if (handlers.onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          setGestureState({
            isGesturing: true,
            gestureType: 'longpress',
            direction: null,
            progress: 1,
          });
          handlers.onLongPress?.(element);
          triggerHapticFeedback([100, 50, 100]);
        }, longPressDelay);
      }
    }

    if (preventDefaultScroll) {
      e.preventDefault();
    }
  }, [handlers, longPressDelay, getTouchDistance, triggerHapticFeedback, preventDefaultScroll]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.touches[0];
    const element = e.currentTarget as HTMLElement;

    if (!touchStartRef.current) return;

    // Handle pinch gesture
    if (e.touches.length === 2 && isPinchingRef.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getTouchDistance(touch1, touch2);
      const deltaDistance = Math.abs(distance - initialDistanceRef.current);
      
      if (deltaDistance > pinchThreshold) {
        const progress = Math.min(deltaDistance / (pinchThreshold * 3), 1);
        setGestureState(prev => ({
          ...prev,
          progress,
        }));
      }
      return;
    }

    // Handle pull-to-refresh
    if (handlers.onPullToRefresh && isAtTop(element)) {
      const deltaY = touch.clientY - pullStartYRef.current;
      
      if (deltaY > 0 && deltaY < pullToRefreshThreshold * 2) {
        isPullingRef.current = true;
        const progress = Math.min(deltaY / pullToRefreshThreshold, 1);
        
        setGestureState({
          isGesturing: true,
          gestureType: 'pulltorefresh',
          direction: 'down',
          progress,
        });

        // Haptic feedback at threshold
        if (progress >= 1 && !gestureState.isGesturing) {
          triggerHapticFeedback(100);
        }

        if (preventDefaultScroll) {
          e.preventDefault();
        }
        return;
      }
    }

    // Handle swipe gesture progress
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > 10 || absY > 10) {
      let direction: 'left' | 'right' | 'up' | 'down' | null = null;
      let progress = 0;

      if (absX > absY) {
        // Horizontal swipe
        direction = deltaX > 0 ? 'right' : 'left';
        progress = Math.min(absX / swipeThreshold, 1);
      } else {
        // Vertical swipe
        direction = deltaY > 0 ? 'down' : 'up';
        progress = Math.min(absY / swipeThreshold, 1);
      }

      setGestureState({
        isGesturing: true,
        gestureType: 'swipe',
        direction,
        progress,
      });

      // Haptic feedback at 50% progress
      if (progress >= 0.5 && gestureState.progress < 0.5) {
        triggerHapticFeedback(30);
      }
    }
  }, [
    handlers,
    pinchThreshold,
    pullToRefreshThreshold,
    swipeThreshold,
    getTouchDistance,
    isAtTop,
    triggerHapticFeedback,
    preventDefaultScroll,
    gestureState,
  ]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.changedTouches[0];
    const now = Date.now();
    const element = e.currentTarget as HTMLElement;

    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
    };

    // Handle pinch end
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      handlers.onPinchEnd?.(element);
      setGestureState({
        isGesturing: false,
        gestureType: null,
        direction: null,
        progress: 0,
      });
      return;
    }

    // Handle pull-to-refresh completion
    if (isPullingRef.current && gestureState.progress >= 1) {
      isPullingRef.current = false;
      handlers.onPullToRefresh?.();
      triggerHapticFeedback([100, 50, 100]);
      setGestureState({
        isGesturing: false,
        gestureType: null,
        direction: null,
        progress: 0,
      });
      return;
    }

    if (!touchStartRef.current || !touchEndRef.current) {
      setGestureState({
        isGesturing: false,
        gestureType: null,
        direction: null,
        progress: 0,
      });
      return;
    }

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const deltaTime = touchEndRef.current.time - touchStartRef.current.time;

    // Check for double tap
    if (handlers.onDoubleTap && deltaTime < doubleTapDelay) {
      const timeSinceLastTap = now - lastTapRef.current;
      if (timeSinceLastTap < doubleTapDelay) {
        handlers.onDoubleTap(element);
        triggerHapticFeedback([50, 30, 50]);
        lastTapRef.current = 0; // Reset to prevent triple tap
        setGestureState({
          isGesturing: false,
          gestureType: null,
          direction: null,
          progress: 0,
        });
        return;
      }
    }
    lastTapRef.current = now;

    // Check for completed swipe gestures
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > swipeThreshold || absY > swipeThreshold) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0) {
          handlers.onSwipeRight?.(element);
        } else {
          handlers.onSwipeLeft?.(element);
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          handlers.onSwipeDown?.(element);
        } else {
          handlers.onSwipeUp?.(element);
        }
      }
      triggerHapticFeedback(75);
    }

    // Reset gesture state
    setGestureState({
      isGesturing: false,
      gestureType: null,
      direction: null,
      progress: 0,
    });
    isPullingRef.current = false;
  }, [
    handlers,
    swipeThreshold,
    doubleTapDelay,
    triggerHapticFeedback,
    gestureState.progress,
  ]);

  const attachGestures = useCallback((element: HTMLElement | null) => {
    if (elementRef.current) {
      elementRef.current.removeEventListener('touchstart', handleTouchStart);
      elementRef.current.removeEventListener('touchmove', handleTouchMove);
      elementRef.current.removeEventListener('touchend', handleTouchEnd);
    }

    elementRef.current = element;

    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefaultScroll });
      element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultScroll });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultScroll]);

  // Cleanup on unmount
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

  return { 
    attachGestures, 
    gestureState,
    isGesturing: gestureState.isGesturing,
  };
};

// Hook for pull-to-refresh specifically
export const usePullToRefresh = (
  onRefresh: () => void | Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {}
) => {
  const { threshold = 80, enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { attachGestures, gestureState } = useMobileGestures({
    onPullToRefresh: async () => {
      if (!enabled || isRefreshing) return;
      
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    },
  }, {
    pullToRefreshThreshold: threshold,
    enableHapticFeedback: true,
  });

  return {
    attachGestures,
    isRefreshing,
    pullProgress: gestureState.gestureType === 'pulltorefresh' ? gestureState.progress : 0,
    isPulling: gestureState.gestureType === 'pulltorefresh' && gestureState.isGesturing,
  };
};

// Hook for swipe actions on list items
export const useSwipeActions = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  options: { threshold?: number; hapticFeedback?: boolean } = {}
) => {
  const { threshold = 80, hapticFeedback = true } = options;

  const { attachGestures, gestureState } = useMobileGestures({
    onSwipeLeft,
    onSwipeRight,
  }, {
    swipeThreshold: threshold,
    enableHapticFeedback: hapticFeedback,
  });

  return {
    attachGestures,
    swipeProgress: gestureState.gestureType === 'swipe' ? gestureState.progress : 0,
    swipeDirection: gestureState.direction,
    isSwiping: gestureState.gestureType === 'swipe' && gestureState.isGesturing,
  };
};

// Hook for long press actions
export const useLongPress = (
  onLongPress: () => void,
  options: { delay?: number; hapticFeedback?: boolean } = {}
) => {
  const { delay = 500, hapticFeedback = true } = options;

  const { attachGestures, gestureState } = useMobileGestures({
    onLongPress,
  }, {
    longPressDelay: delay,
    enableHapticFeedback: hapticFeedback,
  });

  return {
    attachGestures,
    isLongPressing: gestureState.gestureType === 'longpress' && gestureState.isGesturing,
  };
};