/**
 * Progressive Web App Utilities
 * Handles PWA installation, updates, and offline functionality
 */

interface PWAInstallPrompt {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAUtils {
    isInstallable: boolean;
    isInstalled: boolean;
    isUpdateAvailable: boolean;
    installPrompt: PWAInstallPrompt | null;
}

class PWAManager {
    private installPrompt: PWAInstallPrompt | null = null;
    private isUpdateAvailable = false;
    private registration: ServiceWorkerRegistration | null = null;
    private listeners: Array<(state: PWAUtils) => void> = [];

    constructor() {
        this.init();
    }

    private async init() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e as any;
            this.notifyListeners();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            this.installPrompt = null;
            this.notifyListeners();
        });

        // Register service worker
        await this.registerServiceWorker();
    }

    private async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return;
        }

        try {
            this.registration = await navigator.serviceWorker.register('/sw.js');

            // Listen for updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration!.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.isUpdateAvailable = true;
                            this.notifyListeners();
                        }
                    });
                }
            });

            // Listen for controlling service worker changes
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    private notifyListeners() {
        const state = this.getState();
        this.listeners.forEach(listener => listener(state));
    }

    public getState(): PWAUtils {
        return {
            isInstallable: !!this.installPrompt,
            isInstalled: this.isAppInstalled(),
            isUpdateAvailable: this.isUpdateAvailable,
            installPrompt: this.installPrompt,
        };
    }

    public subscribe(listener: (state: PWAUtils) => void) {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    public async install(): Promise<boolean> {
        if (!this.installPrompt) {
            return false;
        }

        try {
            await this.installPrompt.prompt();
            const choice = await this.installPrompt.userChoice;

            if (choice.outcome === 'accepted') {
                this.installPrompt = null;
                this.notifyListeners();
                return true;
            }

            return false;
        } catch (error) {
            console.error('PWA installation failed:', error);
            return false;
        }
    }

    public async updateApp(): Promise<void> {
        if (!this.registration || !this.isUpdateAvailable) {
            return;
        }

        const waitingWorker = this.registration.waiting;
        if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    }

    public isAppInstalled(): boolean {
        // Check if running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return true;
        }

        // Check if running in PWA mode on iOS
        if ((window.navigator as any).standalone === true) {
            return true;
        }

        // Check if installed via Chrome
        if (document.referrer.includes('android-app://')) {
            return true;
        }

        return false;
    }

    public async checkForUpdates(): Promise<void> {
        if (!this.registration) {
            return;
        }

        try {
            await this.registration.update();
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }

    public async cacheEssentialResources(): Promise<void> {
        if (!('caches' in window)) {
            return;
        }

        try {
            const cache = await caches.open('clinical-interventions-essential-v1');

            const essentialResources = [
                '/',
                '/clinical-interventions',
                '/static/js/bundle.js',
                '/static/css/main.css',
                '/manifest.json',
            ];

            await cache.addAll(essentialResources);

        } catch (error) {
            console.error('Failed to cache essential resources:', error);
        }
    }

    public async clearCache(): Promise<void> {
        if (!('caches' in window)) {
            return;
        }

        try {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );

        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    public getStorageUsage(): Promise<StorageEstimate | null> {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return navigator.storage.estimate();
        }
        return Promise.resolve(null);
    }

    public async requestPersistentStorage(): Promise<boolean> {
        if ('storage' in navigator && 'persist' in navigator.storage) {
            try {
                return await navigator.storage.persist();
            } catch (error) {
                console.error('Failed to request persistent storage:', error);
            }
        }
        return false;
    }
}

// Singleton instance
export const pwaManager = new PWAManager();

// Utility functions
export const pwaUtils = {
    // Check if PWA features are supported
    isPWASupported(): boolean {
        return 'serviceWorker' in navigator && 'caches' in window;
    },

    // Check if device is mobile
    isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    },

    // Check if device supports installation
    supportsInstallation(): boolean {
        return 'beforeinstallprompt' in window || (navigator as any).standalone !== undefined;
    },

    // Get device type for analytics
    getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
        const userAgent = navigator.userAgent;

        if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
            return 'tablet';
        }

        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
            return 'mobile';
        }

        return 'desktop';
    },

    // Show install prompt with custom UI
    showInstallPrompt(): Promise<boolean> {
        return pwaManager.install();
    },

    // Show update notification
    showUpdateNotification(onUpdate: () => void): void {
        // This would integrate with your notification system
        const shouldUpdate = confirm(
            'A new version of the app is available. Would you like to update now?'
        );

        if (shouldUpdate) {
            onUpdate();
        }
    },

    // Add to home screen instructions for iOS
    showIOSInstallInstructions(): void {
        if (this.isMobileDevice() && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
            alert(
                'To install this app on your iOS device, tap the Share button and then "Add to Home Screen".'
            );
        }
    },

    // Check network connection quality
    getConnectionInfo(): {
        type: string;
        effectiveType: string;
        downlink: number;
        rtt: number;
    } | null {
        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection;

        if (connection) {
            return {
                type: connection.type || 'unknown',
                effectiveType: connection.effectiveType || 'unknown',
                downlink: connection.downlink || 0,
                rtt: connection.rtt || 0,
            };
        }

        return null;
    },

    // Preload critical resources
    async preloadCriticalResources(): Promise<void> {
        const criticalResources = [
            '/api/workplaces/current',
            '/api/users/me',
            '/api/clinical-interventions/categories',
        ];

        try {
            await Promise.all(
                criticalResources.map(url =>
                    fetch(url, { method: 'HEAD' }).catch(() => { })
                )
            );
        } catch (error) {
            console.error('Failed to preload critical resources:', error);
        }
    },

    // Analytics for PWA usage
    trackPWAEvent(event: string, data?: any): void {
        // This would integrate with your analytics system

    },
};

export default pwaManager;