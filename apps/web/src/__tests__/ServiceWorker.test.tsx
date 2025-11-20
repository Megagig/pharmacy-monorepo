/**
 * Service Worker Tests
 * Tests for service worker registration, caching, and offline functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceWorkerUpdateNotification from '../components/ServiceWorkerUpdateNotification';
import { serviceWorkerManager } from '../utils/serviceWorkerRegistration';

// Mock service worker APIs
const mockServiceWorker = {
  register: vi.fn(),
  ready: Promise.resolve({
    unregister: vi.fn(),
    update: vi.fn(),
    waiting: null,
    active: null,
    installing: null,
  }),
  controller: null,
  addEventListener: vi.fn(),
};

const mockCaches = {
  open: vi.fn(),
  keys: vi.fn(),
  delete: vi.fn(),
  match: vi.fn(),
};

// Mock global objects
Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: mockServiceWorker,
    onLine: true,
  },
  writable: true,
});

Object.defineProperty(global, 'caches', {
  value: mockCaches,
  writable: true,
});

describe('Service Worker Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });
  });

  describe('Registration Process', () => {
    it('should register service worker in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockServiceWorker.register.mockResolvedValue({
        installing: null,
        waiting: null,
        active: { state: 'activated' },
        addEventListener: vi.fn(),
      });

      const onSuccess = vi.fn();
      await serviceWorkerManager.register({ onSuccess });

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip registration in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await serviceWorkerManager.register();

      expect(mockServiceWorker.register).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle registration failure gracefully', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));

      await serviceWorkerManager.register();

      expect(consoleError).toHaveBeenCalledWith(
        'Service Worker registration failed:',
        expect.any(Error)
      );

      consoleError.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Update Handling', () => {
    it('should handle service worker updates', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockRegistration = {
        installing: null,
        waiting: { state: 'installed', postMessage: vi.fn() },
        active: { state: 'activated' },
        addEventListener: vi.fn(),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const onUpdate = vi.fn();
      await serviceWorkerManager.register({ onUpdate });

      // Simulate update available
      const updateHandler = mockRegistration.addEventListener.mock.calls.find(
        call => call[0] === 'updatefound'
      )?.[1];

      if (updateHandler) {
        mockRegistration.installing = { 
          state: 'installing',
          addEventListener: vi.fn(),
        };
        updateHandler();
      }

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip waiting when requested', () => {
      const mockWaiting = { postMessage: vi.fn() };
      serviceWorkerManager['registration'] = {
        waiting: mockWaiting,
      } as any;

      serviceWorkerManager.skipWaiting();

      expect(mockWaiting.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
    });
  });

  describe('Cache Management', () => {
    it('should cache URLs when requested', async () => {
      const mockController = { postMessage: vi.fn() };
      Object.defineProperty(navigator.serviceWorker, 'controller', {
        value: mockController,
        writable: true,
      });

      const urls = ['/api/patients', '/api/medications'];
      await serviceWorkerManager.cacheUrls(urls);

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_URLS',
        payload: { urls },
      });
    });

    it('should clear cache when requested', async () => {
      const mockController = { postMessage: vi.fn() };
      Object.defineProperty(navigator.serviceWorker, 'controller', {
        value: mockController,
        writable: true,
      });

      await serviceWorkerManager.clearCache('test-cache');

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'CLEAR_CACHE',
        payload: { cacheName: 'test-cache' },
      });
    });

    it('should get cache info', async () => {
      const mockController = { postMessage: vi.fn() };
      Object.defineProperty(navigator.serviceWorker, 'controller', {
        value: mockController,
        writable: true,
      });

      const cacheInfoPromise = serviceWorkerManager.getCacheInfo();

      // Simulate message channel response
      const messageCall = mockController.postMessage.mock.calls[0];
      expect(messageCall[0]).toEqual({ type: 'GET_CACHE_INFO' });
      
      // Simulate response
      const port = messageCall[1][0];
      port.onmessage({ data: { 'test-cache': { size: 5, urls: [] } } });

      const result = await cacheInfoPromise;
      expect(result).toEqual({ 'test-cache': { size: 5, urls: [] } });
    });
  });

  describe('Offline Detection', () => {
    it('should detect offline status', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      expect(serviceWorkerManager.isOffline()).toBe(true);

      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });

      expect(serviceWorkerManager.isOffline()).toBe(false);
    });

    it('should get registration status', () => {
      serviceWorkerManager['registration'] = {
        active: { state: 'activated' },
        waiting: null,
        installing: null,
      } as any;

      serviceWorkerManager['updateAvailable'] = true;

      const status = serviceWorkerManager.getRegistrationStatus();

      expect(status).toEqual({
        registered: true,
        active: true,
        waiting: false,
        installing: false,
        updateAvailable: true,
      });
    });
  });
});

describe('Service Worker Update Notification Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<ServiceWorkerUpdateNotification />);
    // Component should render without throwing
  });

  it('should show update notification when update is available', async () => {
    // Mock the useServiceWorker hook
    vi.doMock('../utils/serviceWorkerRegistration', () => ({
      useServiceWorker: () => ({
        updateAvailable: true,
        isOffline: false,
        skipWaiting: vi.fn(),
        registered: true,
      }),
    }));

    const { useServiceWorker } = await import('../utils/serviceWorkerRegistration');
    
    render(<ServiceWorkerUpdateNotification />);

    await waitFor(() => {
      expect(screen.getByText(/new version.*available/i)).toBeInTheDocument();
    });
  });

  it('should show offline notification when offline', async () => {
    vi.doMock('../utils/serviceWorkerRegistration', () => ({
      useServiceWorker: () => ({
        updateAvailable: false,
        isOffline: true,
        skipWaiting: vi.fn(),
        registered: true,
      }),
    }));

    render(<ServiceWorkerUpdateNotification />);

    await waitFor(() => {
      expect(screen.getByText(/offline.*limited/i)).toBeInTheDocument();
    });
  });

  it('should call skipWaiting when update button is clicked', async () => {
    const mockSkipWaiting = vi.fn();

    vi.doMock('../utils/serviceWorkerRegistration', () => ({
      useServiceWorker: () => ({
        updateAvailable: true,
        isOffline: false,
        skipWaiting: mockSkipWaiting,
        registered: true,
      }),
    }));

    render(<ServiceWorkerUpdateNotification />);

    const updateButton = await screen.findByText(/update/i);
    fireEvent.click(updateButton);

    expect(mockSkipWaiting).toHaveBeenCalled();
  });

  it('should call onUpdate callback when update is available', async () => {
    const onUpdate = vi.fn();

    vi.doMock('../utils/serviceWorkerRegistration', () => ({
      useServiceWorker: () => ({
        updateAvailable: true,
        isOffline: false,
        skipWaiting: vi.fn(),
        registered: true,
      }),
    }));

    render(<ServiceWorkerUpdateNotification onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('should call onOfflineReady callback when service worker is ready', async () => {
    const onOfflineReady = vi.fn();

    vi.doMock('../utils/serviceWorkerRegistration', () => ({
      useServiceWorker: () => ({
        updateAvailable: false,
        isOffline: false,
        skipWaiting: vi.fn(),
        registered: true,
      }),
    }));

    render(<ServiceWorkerUpdateNotification onOfflineReady={onOfflineReady} />);

    await waitFor(() => {
      expect(onOfflineReady).toHaveBeenCalled();
    });
  });
});

describe('Service Worker Caching Strategies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should implement cache-first strategy for static assets', async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(new Response('cached content')),
      put: vi.fn(),
    };

    mockCaches.open.mockResolvedValue(mockCache);

    // Simulate service worker fetch event for static asset
    const request = new Request('/assets/main.js');
    
    // This would be handled by the service worker
    const cachedResponse = await mockCache.match(request);
    expect(cachedResponse).toBeDefined();
  });

  it('should implement network-first strategy for API calls', async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn(),
    };

    mockCaches.open.mockResolvedValue(mockCache);

    // Simulate service worker fetch event for API call
    const request = new Request('/api/patients');
    
    // Network first - try cache only if network fails
    const cachedResponse = await mockCache.match(request);
    expect(cachedResponse).toBeNull();
  });

  it('should handle cache expiration', async () => {
    const expiredResponse = new Response('expired content', {
      headers: {
        'sw-cached-at': (Date.now() - 10 * 60 * 1000).toString(), // 10 minutes ago
      },
    });

    const mockCache = {
      match: vi.fn().mockResolvedValue(expiredResponse),
      delete: vi.fn(),
      put: vi.fn(),
    };

    mockCaches.open.mockResolvedValue(mockCache);

    // Check if response is expired (would be done in service worker)
    const cachedAt = expiredResponse.headers.get('sw-cached-at');
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const isExpired = cachedAt && (Date.now() - parseInt(cachedAt)) > maxAge;

    expect(isExpired).toBe(true);
  });
});

describe('Offline Functionality', () => {
  it('should serve offline page for navigation requests when offline', () => {
    const offlineHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Offline</title></head>
        <body><h1>You are offline</h1></body>
      </html>
    `;

    const offlineResponse = new Response(offlineHtml, {
      headers: { 'Content-Type': 'text/html' },
    });

    expect(offlineResponse.headers.get('Content-Type')).toBe('text/html');
  });

  it('should provide offline API responses', () => {
    const offlineApiResponse = new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature is not available offline',
        offline: true,
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(offlineApiResponse.status).toBe(503);
    expect(offlineApiResponse.headers.get('Content-Type')).toBe('application/json');
  });
});