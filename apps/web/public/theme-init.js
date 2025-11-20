/**
 * Theme initialization script
 * Handles theme preference application before page render to prevent flicker
 */
(function () {
    'use strict';

    try {
        // Performance measurement start
        const themeStartTime = performance.now();

        // Read theme preference from localStorage (Zustand persist storage)
        let storedTheme = null;
        try {
            const themeStorage = localStorage.getItem('theme-storage');
            if (themeStorage) {
                const parsed = JSON.parse(themeStorage);
                storedTheme = parsed?.state?.theme || null;
            }
        } catch (e) {
            // Ignore localStorage errors
        }

        // Get system preference
        const prefersDark = window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Determine resolved theme
        let resolvedTheme;
        if (storedTheme === 'light') {
            resolvedTheme = 'light';
        } else if (storedTheme === 'dark') {
            resolvedTheme = 'dark';
        } else {
            // Default to system preference or light as fallback
            resolvedTheme = prefersDark ? 'dark' : 'light';
        }

        // Apply theme class synchronously to prevent flicker
        const root = document.documentElement;

        // Remove any existing theme classes
        root.classList.remove('light', 'dark');

        // Add the resolved theme class
        root.classList.add(resolvedTheme);

        // Set data attribute for CSS usage
        root.setAttribute('data-theme', resolvedTheme);

        // Set CSS custom property for immediate availability
        root.style.setProperty('--theme-mode', resolvedTheme);

        // Store resolved theme for React hydration sync
        window.__INITIAL_THEME__ = {
            stored: storedTheme,
            resolved: resolvedTheme,
            system: prefersDark ? 'dark' : 'light'
        };

        // Performance measurement
        const themeEndTime = performance.now();
        const themeDuration = themeEndTime - themeStartTime;

        // Store performance metric for monitoring
        window.__THEME_PERFORMANCE__ = {
            duration: themeDuration,
            timestamp: Date.now()
        };

        // Log performance if under development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`Theme applied in ${themeDuration.toFixed(2)}ms`);
        }

    } catch (error) {
        // Fallback to light theme on any error
        console.warn('Theme initialization error, falling back to light theme:', error);
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.setProperty('--theme-mode', 'light');

        window.__INITIAL_THEME__ = {
            stored: null,
            resolved: 'light',
            system: 'light',
            error: error.message
        };
    }
})();