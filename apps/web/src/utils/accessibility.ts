/**
 * Accessibility Utilities
 * Helper functions and hooks for improving accessibility in React components
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Generate a unique ID for accessibility purposes
 * Useful for aria-labelledby, aria-describedby, etc.
 */
export const generateA11yId = (prefix: string = 'a11y'): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Hook to generate stable IDs for accessibility
 */
export const useA11yId = (prefix: string = 'a11y'): string => {
    const [id] = useState(() => generateA11yId(prefix));
    return id;
};

/**
 * Hook to manage focus trap within a component
 * Useful for modals, dialogs, and dropdown menus
 */
export const useFocusTrap = (isActive: boolean = true) => {
    const containerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        container.addEventListener('keydown', handleTabKey);
        firstElement?.focus();

        return () => {
            container.removeEventListener('keydown', handleTabKey);
        };
    }, [isActive]);

    return containerRef;
};

/**
 * Hook to announce messages to screen readers
 * Uses aria-live regions
 */
export const useScreenReaderAnnouncement = () => {
    const [announcement, setAnnouncement] = useState<string>('');
    const timeoutRef = useRef<NodeJS.Timeout>();

    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set the announcement
        setAnnouncement(message);

        // Clear the announcement after it's been read
        timeoutRef.current = setTimeout(() => {
            setAnnouncement('');
        }, 1000);

        // Return the priority for use in aria-live attribute
        return priority;
    };

    return { announcement, announce };
};

/**
 * Hook to handle keyboard navigation
 * Supports arrow keys, home, end, etc.
 */
interface UseKeyboardNavigationProps {
    itemCount: number;
    onSelect?: (index: number) => void;
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical';
}

export const useKeyboardNavigation = ({
    itemCount,
    onSelect,
    loop = true,
    orientation = 'vertical',
}: UseKeyboardNavigationProps) => {
    const [activeIndex, setActiveIndex] = useState<number>(0);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const isVertical = orientation === 'vertical';
        const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
        const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

        switch (e.key) {
            case nextKey:
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = prev + 1;
                    if (next >= itemCount) {
                        return loop ? 0 : prev;
                    }
                    return next;
                });
                break;

            case prevKey:
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = prev - 1;
                    if (next < 0) {
                        return loop ? itemCount - 1 : prev;
                    }
                    return next;
                });
                break;

            case 'Home':
                e.preventDefault();
                setActiveIndex(0);
                break;

            case 'End':
                e.preventDefault();
                setActiveIndex(itemCount - 1);
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                if (onSelect) {
                    onSelect(activeIndex);
                }
                break;
        }
    };

    return {
        activeIndex,
        setActiveIndex,
        handleKeyDown,
    };
};

/**
 * Hook to manage skip links for keyboard navigation
 */
export const useSkipLinks = () => {
    const skipToContent = (contentId: string) => {
        const element = document.getElementById(contentId);
        if (element) {
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return { skipToContent };
};

/**
 * Accessibility props for common patterns
 */
export const a11yProps = {
    /**
     * Props for tab components
     */
    tab: (index: number, prefix: string = 'tab') => ({
        id: `${prefix}-${index}`,
        'aria-controls': `${prefix}panel-${index}`,
    }),

    /**
     * Props for tab panel components
     */
    tabPanel: (index: number, value: number, prefix: string = 'tab') => ({
        id: `${prefix}panel-${index}`,
        'aria-labelledby': `${prefix}-${index}`,
        role: 'tabpanel',
        hidden: value !== index,
    }),

    /**
     * Props for dialog/modal components
     */
    dialog: (labelId: string, descriptionId?: string) => ({
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': labelId,
        ...(descriptionId && { 'aria-describedby': descriptionId }),
    }),

    /**
     * Props for buttons that control expanded content
     */
    expandButton: (expanded: boolean, controlsId: string) => ({
        'aria-expanded': expanded,
        'aria-controls': controlsId,
    }),

    /**
     * Props for live regions
     */
    liveRegion: (priority: 'polite' | 'assertive' = 'polite') => ({
        role: 'status',
        'aria-live': priority,
        'aria-atomic': true,
    }),
};

/**
 * Helper to create accessible labels for form fields
 */
export const createFieldLabels = (
    id: string,
    _label: string,
    error?: string,
    hint?: string
) => {
    const labelId = `${id}-label`;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = [
        hint && hintId,
        error && errorId,
    ]
        .filter(Boolean)
        .join(' ');

    return {
        field: {
            id,
            'aria-labelledby': labelId,
            'aria-invalid': !!error,
            ...(describedBy && { 'aria-describedby': describedBy }),
        },
        label: {
            id: labelId,
            htmlFor: id,
        },
        error: {
            id: errorId,
            role: 'alert',
        },
        hint: {
            id: hintId,
        },
    };
};

/**
 * Hook to detect if user prefers reduced motion
 */
export const usePrefersReducedMotion = (): boolean => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
};

/**
 * Helper to create accessible error messages
 */
export const createErrorMessage = (fieldName: string, error: string): string => {
    return `${fieldName} error: ${error}`;
};

/**
 * Helper to create accessible loading messages
 */
export const createLoadingMessage = (content: string): string => {
    return `Loading ${content}. Please wait.`;
};

/**
 * Helper to create accessible success messages
 */
export const createSuccessMessage = (action: string): string => {
    return `Success: ${action}`;
};
