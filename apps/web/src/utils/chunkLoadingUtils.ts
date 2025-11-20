/**
 * Utility functions for handling chunk loading errors with retry mechanisms
 */

// React import for lazy components
import React from 'react';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Check if an error is a chunk loading error
 */
export const isChunkLoadError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('network error') ||
    name === 'chunkloaderror' ||
    name === 'chunkerror'
  );
};

/**
 * Retry a function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // If it's not a chunk error, don't retry
      if (!isChunkLoadError(lastError)) {
        throw lastError;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Wait before retrying with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.warn(`Chunk loading failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`, lastError.message);
    }
  }
  
  throw lastError!;
};

/**
 * Enhanced dynamic import with retry mechanism
 */
export const importWithRetry = async <T = any>(
  importFn: () => Promise<T>,
  options: RetryOptions = {},
  componentName?: string
): Promise<T> => {
  const name = componentName || 'Unknown Component';
  const isDev = import.meta.env.DEV;
  console.debug(`[ChunkLoader] Starting import for ${name} (dev: ${isDev})`);
  
  try {
    const result = await retryWithBackoff(importFn, {
      maxAttempts: isDev ? 2 : 3,
      delayMs: isDev ? 100 : 500,
      backoffMultiplier: 2,
      ...options,
    });
    console.debug(`[ChunkLoader] Successfully imported ${name}`);
    return result;
  } catch (error) {
    console.error(`[ChunkLoader] Failed to import ${name} after all retries:`, error);
    
    // In development mode, provide more helpful error handling
    if (isDev && isChunkLoadError(error as Error)) {
      console.warn(`[ChunkLoader] Development mode: Chunk loading failed for ${name}. This might be due to Vite HMR issues.`);
      
      // Wait a bit and try one more time in dev mode
      await new Promise(resolve => setTimeout(resolve, 200));
      try {
        console.debug(`[ChunkLoader] Final attempt for ${name} in dev mode`);
        return await importFn();
      } catch (finalError) {
        console.error(`[ChunkLoader] Final attempt failed for ${name}:`, finalError);
        throw finalError;
      }
    }
    
    throw error;
  }
};

/**
 * Create a lazy component with retry mechanism
 */
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName?: string
): React.LazyExoticComponent<T> => {
  const name = componentName || importFn.toString().match(/import\(['"](.+?)['"]/)?.[1] || 'Unknown';
  console.debug(`[ChunkLoader] Creating lazy component: ${name}`);
  
  // In development mode, Vite handles dynamic imports differently
  // If we're in development, try a simpler approach first
  const isDev = import.meta.env.DEV;
  
  return React.lazy(() => {
    console.debug(`[ChunkLoader] Lazy loading triggered for ${name} (dev: ${isDev})`);
    
    if (isDev) {
      // In development, try direct import first, fall back to retry mechanism
      return importFn().catch((error) => {
        console.warn(`[ChunkLoader] Direct import failed for ${name} in dev mode, falling back to retry:`, error);
        return importWithRetry(importFn, { maxAttempts: 2, delayMs: 100 }, name);
      });
    }
    
    // In production, use full retry mechanism
    return importWithRetry(importFn, {}, name);
  });
};

/**
 * Clear browser cache and reload if chunk loading continues to fail
 */
export const handlePersistentChunkError = (): void => {
  console.warn('Persistent chunk loading error detected. Clearing cache and reloading...');
  
  // Clear various types of cache
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  
  // Clear local storage items that might be related to caching
  const cacheKeys = Object.keys(localStorage).filter(key => 
    key.includes('cache') || 
    key.includes('version') || 
    key.includes('build')
  );
  cacheKeys.forEach(key => localStorage.removeItem(key));
  
  // Add a cache-busting parameter and reload
  const url = new URL(window.location.href);
  url.searchParams.set('cacheBust', Date.now().toString());
  window.location.href = url.toString();
};

/**
 * Preload a component with error handling
 */
export const preloadComponentSafely = (
  importFn: () => Promise<any>,
  componentName: string = 'Unknown'
): void => {
  importWithRetry(importFn, { maxAttempts: 2, delayMs: 100 })
    .then(() => {
      console.debug(`Successfully preloaded ${componentName}`);
    })
    .catch((error) => {
      console.warn(`Failed to preload ${componentName}:`, error.message);
    });
};

/**
 * Check if the application version has changed (useful for detecting new deployments)
 */
export const checkForNewVersion = async (): Promise<boolean> => {
  try {
    const response = await fetch('/version.json?' + Date.now(), {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const versionInfo = await response.json();
    const currentVersion = localStorage.getItem('app-version');
    
    if (currentVersion && currentVersion !== versionInfo.version) {
      localStorage.setItem('app-version', versionInfo.version);
      return true; // New version detected
    }
    
    if (!currentVersion) {
      localStorage.setItem('app-version', versionInfo.version);
    }
    
    return false;
  } catch (error) {
    console.warn('Failed to check app version:', error);
    return false;
  }
};