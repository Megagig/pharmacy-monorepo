/**
 * Platform Detection Hook
 * Detect current platform (web, mobile, desktop)
 */

import { useState, useEffect } from 'react';

export type Platform = 'web' | 'mobile' | 'desktop' | 'unknown';

/**
 * Hook to detect current platform
 */
export function usePlatform(): Platform {
    const [platform, setPlatform] = useState<Platform>('unknown');

    useEffect(() => {
        // Check for React Native
        if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
            setPlatform('mobile');
            return;
        }

        // Check for Electron
        if (
            typeof window !== 'undefined' &&
            window.process &&
            (window.process as any).type === 'renderer'
        ) {
            setPlatform('desktop');
            return;
        }

        // Default to web
        if (typeof window !== 'undefined') {
            setPlatform('web');
            return;
        }

        setPlatform('unknown');
    }, []);

    return platform;
}

/**
 * Hook to check if running on web
 */
export function useIsWeb(): boolean {
    const platform = usePlatform();
    return platform === 'web';
}

/**
 * Hook to check if running on mobile
 */
export function useIsMobile(): boolean {
    const platform = usePlatform();
    return platform === 'mobile';
}

/**
 * Hook to check if running on desktop
 */
export function useIsDesktop(): boolean {
    const platform = usePlatform();
    return platform === 'desktop';
}

/**
 * Hook to detect mobile device (responsive web)
 */
export function useIsMobileDevice(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

/**
 * Hook to detect tablet device (responsive web)
 */
export function useIsTablet(): boolean {
    const [isTablet, setIsTablet] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkTablet = () => {
            const width = window.innerWidth;
            setIsTablet(width >= 768 && width < 1024);
        };

        checkTablet();
        window.addEventListener('resize', checkTablet);

        return () => window.removeEventListener('resize', checkTablet);
    }, []);

    return isTablet;
}
