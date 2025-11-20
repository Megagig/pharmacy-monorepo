/**
 * Service to check for application updates and handle version mismatches
 */

// Get app version from build time or package.json
const APP_VERSION = import.meta.env.VITE_APP_VERSION || new Date().toISOString();
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

class VersionCheckService {
    private currentVersion: string = APP_VERSION;
    private checkTimer: number | null = null;
    private isChecking = false;

    /**
     * Start periodic version checks
     */
    start() {
        if (this.checkTimer) return;

        this.checkTimer = window.setInterval(() => {
            this.checkForUpdates();
        }, CHECK_INTERVAL);

        // Also check immediately
        this.checkForUpdates();
    }

    /**
     * Stop version checks
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;

        }
    }

    /**
     * Check if a new version is available
     */
    private async checkForUpdates() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            // Fetch index.html with cache-busting query param
            const response = await fetch(`/index.html?t=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-cache',
            });

            // Check ETag or Last-Modified to detect changes
            const etag = response.headers.get('etag');
            const lastModified = response.headers.get('last-modified');

            // Store initial values on first check
            const storedEtag = sessionStorage.getItem('app_etag');
            const storedLastModified = sessionStorage.getItem('app_last_modified');

            if (!storedEtag && etag) {
                sessionStorage.setItem('app_etag', etag);
            }
            if (!storedLastModified && lastModified) {
                sessionStorage.setItem('app_last_modified', lastModified);
            }

            // Check if version changed
            const hasChanged =
                (etag && storedEtag && etag !== storedEtag) ||
                (lastModified && storedLastModified && lastModified !== storedLastModified);

            if (hasChanged) {

                this.handleNewVersion();
            }
        } catch (error) {
            console.error('[VersionCheck] Error checking for updates:', error);
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Handle new version detection
     */
    private handleNewVersion() {
        // Clear session storage
        sessionStorage.clear();

        // Show notification to user
        const shouldReload = window.confirm(
            'A new version of the application is available. Would you like to reload to get the latest updates?'
        );

        if (shouldReload) {
            window.location.reload();
        } else {
            // Store flag to show banner
            sessionStorage.setItem('update_available', 'true');

            // Dispatch custom event for UI to show update banner
            window.dispatchEvent(new CustomEvent('app-update-available'));
        }
    }

    /**
     * Manually trigger update
     */
    reloadApp() {
        sessionStorage.clear();
        window.location.reload();
    }
}

export const versionCheckService = new VersionCheckService();

// Auto-start in production
if (import.meta.env.PROD) {
    versionCheckService.start();
}
