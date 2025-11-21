"use strict";
/**
 * Platform Detection Hook
 * Detect current platform (web, mobile, desktop)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePlatform = usePlatform;
exports.useIsWeb = useIsWeb;
exports.useIsMobile = useIsMobile;
exports.useIsDesktop = useIsDesktop;
exports.useIsMobileDevice = useIsMobileDevice;
exports.useIsTablet = useIsTablet;
var react_1 = require("react");
/**
 * Hook to detect current platform
 */
function usePlatform() {
    var _a = (0, react_1.useState)('unknown'), platform = _a[0], setPlatform = _a[1];
    (0, react_1.useEffect)(function () {
        // Check for React Native
        if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
            setPlatform('mobile');
            return;
        }
        // Check for Electron
        if (typeof window !== 'undefined' &&
            window.process &&
            window.process.type === 'renderer') {
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
function useIsWeb() {
    var platform = usePlatform();
    return platform === 'web';
}
/**
 * Hook to check if running on mobile
 */
function useIsMobile() {
    var platform = usePlatform();
    return platform === 'mobile';
}
/**
 * Hook to check if running on desktop
 */
function useIsDesktop() {
    var platform = usePlatform();
    return platform === 'desktop';
}
/**
 * Hook to detect mobile device (responsive web)
 */
function useIsMobileDevice() {
    var _a = (0, react_1.useState)(false), isMobile = _a[0], setIsMobile = _a[1];
    (0, react_1.useEffect)(function () {
        if (typeof window === 'undefined')
            return;
        var checkMobile = function () {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return function () { return window.removeEventListener('resize', checkMobile); };
    }, []);
    return isMobile;
}
/**
 * Hook to detect tablet device (responsive web)
 */
function useIsTablet() {
    var _a = (0, react_1.useState)(false), isTablet = _a[0], setIsTablet = _a[1];
    (0, react_1.useEffect)(function () {
        if (typeof window === 'undefined')
            return;
        var checkTablet = function () {
            var width = window.innerWidth;
            setIsTablet(width >= 768 && width < 1024);
        };
        checkTablet();
        window.addEventListener('resize', checkTablet);
        return function () { return window.removeEventListener('resize', checkTablet); };
    }, []);
    return isTablet;
}
