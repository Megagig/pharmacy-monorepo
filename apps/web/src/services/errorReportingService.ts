import { performanceMonitor } from '../utils/performanceMonitor';
import { CommunicationError } from './communicationErrorService';

// Error report interface
export interface ErrorReport {
    id: string;
    timestamp: number;
    error: {
        message: string;
        stack?: string;
        name: string;
        code?: string | number;
    };
    context: {
        component?: string;
        action?: string;
        userId?: string;
        conversationId?: string;
        messageId?: string;
        url: string;
        userAgent: string;
    };
    system: {
        online: boolean;
        socketConnected: boolean;
        memoryUsage?: number;
        performanceMetrics?: any;
    };
    user: {
        sessionId: string;
        interactions: UserInteraction[];
    };
    severity: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
}

export interface UserInteraction {
    type: 'click' | 'input' | 'navigation' | 'api_call';
    target?: string;
    timestamp: number;
    data?: any;
}

export interface ErrorReportingConfig {
    enabled: boolean;
    endpoint?: string;
    maxReports: number;
    batchSize: number;
    flushInterval: number;
    includeUserInteractions: boolean;
    includePerformanceMetrics: boolean;
    sensitiveDataPatterns: RegExp[];
}

/**
 * Comprehensive error reporting and logging service
 * Collects detailed error information, user interactions, and system state
 */
class ErrorReportingService {
    private config: ErrorReportingConfig;
    private reportQueue: ErrorReport[] = [];
    private userInteractions: UserInteraction[] = [];
    private sessionId: string;
    private flushTimer?: NodeJS.Timeout;
    private isInitialized = false;

    constructor(config: Partial<ErrorReportingConfig> = {}) {
        this.config = {
            enabled: true,
            maxReports: 100,
            batchSize: 10,
            flushInterval: 30000, // 30 seconds
            includeUserInteractions: true,
            includePerformanceMetrics: true,
            sensitiveDataPatterns: [
                /password/i,
                /token/i,
                /secret/i,
                /key/i,
                /auth/i,
                /ssn/i,
                /social.security/i,
                /credit.card/i,
                /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card pattern
                /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
            ],
            ...config,
        };

        this.sessionId = this.generateSessionId();
        this.initialize();
    }

    /**
     * Initialize the error reporting service
     */
    private initialize(): void {
        if (!this.config.enabled || this.isInitialized) {
            return;
        }

        // Set up global error handlers
        this.setupGlobalErrorHandlers();

        // Set up user interaction tracking
        if (this.config.includeUserInteractions) {
            this.setupInteractionTracking();
        }

        // Set up periodic flushing
        this.setupPeriodicFlush();

        // Set up beforeunload handler to flush remaining reports
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        this.isInitialized = true;

    }

    /**
     * Set up global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.reportError(event.reason, {
                component: 'global',
                action: 'unhandled_promise_rejection',
            });
        });

        // Handle global JavaScript errors
        window.addEventListener('error', (event) => {
            this.reportError(event.error || new Error(event.message), {
                component: 'global',
                action: 'javascript_error',
                url: event.filename,
            });
        });

        // Handle resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target && event.target !== window) {
                const target = event.target as HTMLElement;
                this.reportError(new Error(`Resource loading failed: ${target.tagName}`), {
                    component: 'resource_loader',
                    action: 'resource_load_error',
                    url: (target as any).src || (target as any).href,
                });
            }
        }, true);
    }

    /**
     * Set up user interaction tracking
     */
    private setupInteractionTracking(): void {
        // Track clicks
        document.addEventListener('click', (event) => {
            this.trackInteraction({
                type: 'click',
                target: this.getElementSelector(event.target as Element),
                timestamp: Date.now(),
            });
        });

        // Track form inputs
        document.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            if (target.type !== 'password') { // Don't track password inputs
                this.trackInteraction({
                    type: 'input',
                    target: this.getElementSelector(target),
                    timestamp: Date.now(),
                    data: {
                        inputType: target.type,
                        value: this.sanitizeValue(target.value),
                    },
                });
            }
        });

        // Track navigation
        let lastUrl = window.location.href;
        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                this.trackInteraction({
                    type: 'navigation',
                    timestamp: Date.now(),
                    data: {
                        from: lastUrl,
                        to: currentUrl,
                    },
                });
                lastUrl = currentUrl;
            }
        };

        // Check for URL changes (for SPAs)
        setInterval(checkUrlChange, 1000);
    }

    /**
     * Set up periodic flushing of reports
     */
    private setupPeriodicFlush(): void {
        this.flushTimer = setInterval(() => {
            this.flushReports();
        }, this.config.flushInterval);
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get CSS selector for an element
     */
    private getElementSelector(element: Element): string {
        if (!element) return 'unknown';

        const parts: string[] = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                selector += `#${current.id}`;
                parts.unshift(selector);
                break;
            }

            if (current.className) {
                const classes = current.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }

            // Add nth-child if needed for uniqueness
            const siblings = Array.from(current.parentElement?.children || []);
            const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }

            parts.unshift(selector);
            current = current.parentElement!;
        }

        return parts.join(' > ').substring(0, 200); // Limit length
    }

    /**
     * Sanitize sensitive data from values
     */
    private sanitizeValue(value: string): string {
        if (!value) return value;

        let sanitized = value;

        this.config.sensitiveDataPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });

        // Limit length to prevent large data
        return sanitized.substring(0, 100);
    }

    /**
     * Track user interaction
     */
    private trackInteraction(interaction: UserInteraction): void {
        if (!this.config.includeUserInteractions) return;

        this.userInteractions.push(interaction);

        // Keep only last 50 interactions to prevent memory issues
        if (this.userInteractions.length > 50) {
            this.userInteractions = this.userInteractions.slice(-50);
        }
    }

    /**
     * Report an error
     */
    reportError(
        error: Error | CommunicationError | unknown,
        context: Partial<ErrorReport['context']> = {}
    ): string {
        if (!this.config.enabled) {
            return '';
        }

        const reportId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Extract error information
        let errorInfo: ErrorReport['error'];
        let severity: ErrorReport['severity'] = 'medium';
        let tags: string[] = [];

        if (error instanceof Error) {
            errorInfo = {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: (error as any).code || (error as any).status,
            };

            // Determine severity based on error type
            if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
                severity = 'high';
                tags.push('chunk-loading');
            } else if (error.message.includes('Network Error')) {
                severity = 'medium';
                tags.push('network');
            }
        } else if (typeof error === 'object' && error !== null && 'type' in error) {
            // Handle CommunicationError
            const commError = error as CommunicationError;
            errorInfo = {
                message: commError.message,
                name: commError.type,
                code: commError.code,
            };
            severity = commError.severity;
            tags.push('communication', commError.type);
        } else {
            errorInfo = {
                message: String(error),
                name: 'UnknownError',
            };
        }

        // Collect system information
        const systemInfo: ErrorReport['system'] = {
            online: navigator.onLine,
            socketConnected: false, // Will be updated by socket service
        };

        // Add memory usage if available
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            systemInfo.memoryUsage = memory.usedJSHeapSize;
        }

        // Add performance metrics if enabled
        if (this.config.includePerformanceMetrics) {
            systemInfo.performanceMetrics = {
                timing: performance.timing,
                navigation: performance.navigation,
                memory: (performance as any).memory,
            };
        }

        // Create error report
        const report: ErrorReport = {
            id: reportId,
            timestamp: Date.now(),
            error: errorInfo,
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...context,
            },
            system: systemInfo,
            user: {
                sessionId: this.sessionId,
                interactions: [...this.userInteractions], // Copy array
            },
            severity,
            tags,
        };

        // Add to queue
        this.reportQueue.push(report);

        // Keep queue size manageable
        if (this.reportQueue.length > this.config.maxReports) {
            this.reportQueue = this.reportQueue.slice(-this.config.maxReports);
        }

        // Log to console in development
        if (import.meta.env.DEV) {
            console.group(`🐛 Error Report: ${reportId}`);
            console.error('Error:', error);

            console.groupEnd();
        }

        // Flush immediately for critical errors
        if (severity === 'critical') {
            this.flushReports();
        }

        return reportId;
    }

    /**
     * Flush reports to server
     */
    private async flushReports(): Promise<void> {
        if (this.reportQueue.length === 0) {
            return;
        }

        const reportsToSend = this.reportQueue.splice(0, this.config.batchSize);

        try {
            if (this.config.endpoint) {
                // Send to configured endpoint
                await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        reports: reportsToSend,
                        sessionId: this.sessionId,
                    }),
                });
            } else {
                // Log to console if no endpoint configured
            }

        } catch (error) {
            console.error('Failed to flush error reports:', error);

            // Put reports back in queue for retry
            this.reportQueue.unshift(...reportsToSend);
        }
    }

    /**
     * Handle page unload
     */
    private handleBeforeUnload = (): void => {
        // Use sendBeacon for reliable delivery during page unload
        if (this.reportQueue.length > 0 && this.config.endpoint) {
            const data = JSON.stringify({
                reports: this.reportQueue,
                sessionId: this.sessionId,
            });

            if (navigator.sendBeacon) {
                navigator.sendBeacon(this.config.endpoint, data);
            }
        }
    };

    /**
     * Public API methods
     */

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (!this.config.enabled && this.isInitialized) {
            this.destroy();
        } else if (this.config.enabled && !this.isInitialized) {
            this.initialize();
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalReports: number;
        queuedReports: number;
        bySeverity: Record<string, number>;
        byTag: Record<string, number>;
        sessionId: string;
    } {
        const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
        const byTag: Record<string, number> = {};

        this.reportQueue.forEach(report => {
            bySeverity[report.severity]++;
            report.tags.forEach(tag => {
                byTag[tag] = (byTag[tag] || 0) + 1;
            });
        });

        return {
            totalReports: this.reportQueue.length,
            queuedReports: this.reportQueue.length,
            bySeverity,
            byTag,
            sessionId: this.sessionId,
        };
    }

    /**
     * Export error reports for analysis
     */
    exportReports(): string {
        return JSON.stringify({
            sessionId: this.sessionId,
            timestamp: Date.now(),
            reports: this.reportQueue,
            config: this.config,
        }, null, 2);
    }

    /**
     * Clear all reports
     */
    clearReports(): void {
        this.reportQueue = [];
        this.userInteractions = [];
    }

    /**
     * Destroy the service
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        window.removeEventListener('beforeunload', this.handleBeforeUnload);

        // Flush remaining reports
        this.flushReports();

        this.isInitialized = false;
    }
}

// Create singleton instance
export const errorReportingService = new ErrorReportingService({
    enabled: import.meta.env.PROD,
    endpoint: import.meta.env.VITE_ERROR_REPORTING_ENDPOINT,
});

// Export service and types
export default errorReportingService;