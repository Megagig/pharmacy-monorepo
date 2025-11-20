/**
 * Service Worker Registration and Management
 * Handles service worker lifecycle and communication
 */

import React from 'react';

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
}

interface CacheInfo {
  [cacheName: string]: {
    size: number;
    urls: string[];
  };
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};
  private updateAvailable = false;

  /**
   * Register service worker with configuration
   */
  async register(config: ServiceWorkerConfig = {}): Promise<void> {
    this.config = config;

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported in this browser');
      return;
    }

    if (process.env.NODE_ENV !== 'production') {

      return;
    }

    // Delay service worker registration to prevent hydration issues
    // Wait for the page to finish loading to avoid React error #185
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0);
      } else {
        window.addEventListener('load', () => resolve(void 0), { once: true });
      }
    });

    // Extended delay to ensure React has fully hydrated and DOM is stable
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      this.registration = registration;

      // Handle different service worker states
      if (registration.installing) {

        this.trackInstalling(registration.installing);
      } else if (registration.waiting) {

        this.showUpdateAvailable();
      } else if (registration.active) {

        this.config.onSuccess?.(registration);
      }

      // Listen for updates
      registration.addEventListener('updatefound', () => {

        const newWorker = registration.installing;
        if (newWorker) {
          this.trackInstalling(newWorker);
        }
      });

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {

        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const result = await registration.unregister();

      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  /**
   * Update service worker
   */
  async update(): Promise<void> {
    if (!this.registration) {
      console.warn('No service worker registration available');
      return;
    }

    try {
      await this.registration.update();

    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  skipWaiting(): void {
    if (!this.registration?.waiting) {
      console.warn('No waiting service worker available');
      return;
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Cache specific URLs
   */
  async cacheUrls(urls: string[]): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to handle cache request');
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      payload: { urls },
    });
  }

  /**
   * Clear cache
   */
  async clearCache(cacheName?: string): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to handle clear cache request');
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
      payload: { cacheName },
    });
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<CacheInfo> {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to get cache info');
      return {};
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_INFO' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Check if app is running offline
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Get service worker registration status
   */
  getRegistrationStatus(): {
    registered: boolean;
    active: boolean;
    waiting: boolean;
    installing: boolean;
    updateAvailable: boolean;
  } {
    return {
      registered: !!this.registration,
      active: !!this.registration?.active,
      waiting: !!this.registration?.waiting,
      installing: !!this.registration?.installing,
      updateAvailable: this.updateAvailable,
    };
  }

  /**
   * Track installing service worker
   */
  private trackInstalling(worker: ServiceWorker): void {
    worker.addEventListener('statechange', () => {

      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New update available

          this.showUpdateAvailable();
        } else {
          // First install

          this.config.onOfflineReady?.();
        }
      }
    });
  }

  /**
   * Show update available notification
   */
  private showUpdateAvailable(): void {
    this.updateAvailable = true;
    this.config.onUpdate?.(this.registration!);
    this.config.onNeedRefresh?.();
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'CACHE_UPDATED':

        break;

      case 'OFFLINE_FALLBACK':

        break;

      default:

    }
  }
}

// Create singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Register service worker with default configuration
 */
export function registerSW(config: ServiceWorkerConfig = {}): void {
  serviceWorkerManager.register({
    onSuccess: (registration) => {

      config.onSuccess?.(registration);
    },
    onNeedRefresh: () => {

      config.onNeedRefresh?.();
    },
    onOfflineReady: () => {

      config.onOfflineReady?.();
    },
    onUpdate: (registration) => {

      config.onUpdate?.(registration);
    },
  });
}

/**
 * Unregister service worker
 */
export function unregisterSW(): Promise<boolean> {
  return serviceWorkerManager.unregister();
}

/**
 * Hook for React components to interact with service worker
 */
export function useServiceWorker() {
  const [status, setStatus] = React.useState(serviceWorkerManager.getRegistrationStatus());
  const [isOffline, setIsOffline] = React.useState(serviceWorkerManager.isOffline());

  React.useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setStatus(serviceWorkerManager.getRegistrationStatus());
      setIsOffline(serviceWorkerManager.isOffline());
    }, 1000);

    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    ...status,
    isOffline,
    update: () => serviceWorkerManager.update(),
    skipWaiting: () => serviceWorkerManager.skipWaiting(),
    cacheUrls: (urls: string[]) => serviceWorkerManager.cacheUrls(urls),
    clearCache: (cacheName?: string) => serviceWorkerManager.clearCache(cacheName),
    getCacheInfo: () => serviceWorkerManager.getCacheInfo(),
  };
}

export default serviceWorkerManager;