/**
 * Module Preloader Utility
 * Handles preloading of critical chunks and modules for better performance
 */

interface PreloadOptions {
  as?: 'script' | 'style' | 'font' | 'image';
  crossorigin?: 'anonymous' | 'use-credentials';
  integrity?: string;
  priority?: 'high' | 'low';
}

class ModulePreloader {
  private preloadedModules = new Set<string>();
  private preloadQueue: Array<{ href: string; options: PreloadOptions }> = [];
  private isProcessing = false;

  /**
   * Preload a module or asset
   */
  preload(href: string, options: PreloadOptions = {}): void {
    if (this.preloadedModules.has(href)) {
      return;
    }

    this.preloadQueue.push({ href, options });
    this.processQueue();
  }

  /**
   * Preload multiple modules
   */
  preloadMultiple(modules: Array<{ href: string; options?: PreloadOptions }>): void {
    modules.forEach(({ href, options = {} }) => {
      this.preload(href, options);
    });
  }

  /**
   * Preload critical route chunks
   */
  preloadCriticalRoutes(): void {
    const criticalRoutes = [
      '/assets/dashboard-',
      '/assets/patients-',
      '/assets/clinical-notes-',
    ];

    // Find and preload critical chunks
    const scripts = document.querySelectorAll('script[src*="assets/"]');
    scripts.forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      const shouldPreload = criticalRoutes.some(route => src.includes(route));
      
      if (shouldPreload && !this.preloadedModules.has(src)) {
        this.preload(src, { as: 'script', priority: 'high' });
      }
    });
  }

  /**
   * Preload vendor chunks
   */
  preloadVendorChunks(): void {
    const vendorChunks = [
      'react-core',
      'data-layer',
      'ui-libs',
    ];

    vendorChunks.forEach(chunk => {
      // Find chunk files that match vendor patterns
      const scripts = document.querySelectorAll(`script[src*="${chunk}"]`);
      scripts.forEach((script) => {
        const src = (script as HTMLScriptElement).src;
        this.preload(src, { as: 'script', priority: 'high' });
      });
    });
  }

  /**
   * Preload fonts and critical assets
   */
  preloadCriticalAssets(): void {
    // Preload critical fonts
    const fonts = [
      '/assets/fonts/inter-var.woff2',
      '/assets/fonts/inter-regular.woff2',
    ];

    fonts.forEach(font => {
      this.preload(font, { 
        as: 'font', 
        crossorigin: 'anonymous',
        priority: 'high'
      });
    });

    // Preload critical images
    const images = [
      '/assets/images/logo.svg',
      '/assets/images/avatar-placeholder.png',
    ];

    images.forEach(image => {
      this.preload(image, { as: 'image', priority: 'low' });
    });
  }

  /**
   * Process the preload queue
   */
  private processQueue(): void {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Process queue in batches to avoid overwhelming the browser
    const batchSize = 3;
    const batch = this.preloadQueue.splice(0, batchSize);

    batch.forEach(({ href, options }) => {
      this.createPreloadLink(href, options);
    });

    // Continue processing after a short delay
    setTimeout(() => {
      this.isProcessing = false;
      if (this.preloadQueue.length > 0) {
        this.processQueue();
      }
    }, 50);
  }

  /**
   * Create preload link element
   */
  private createPreloadLink(href: string, options: PreloadOptions): void {
    if (this.preloadedModules.has(href)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    
    if (options.as) {
      link.as = options.as;
    }
    
    if (options.crossorigin) {
      link.crossOrigin = options.crossorigin;
    }
    
    if (options.integrity) {
      link.integrity = options.integrity;
    }

    // Add priority hint if supported
    if (options.priority && 'fetchPriority' in link) {
      (link as any).fetchPriority = options.priority;
    }

    // Handle load and error events
    link.onload = () => {
      this.preloadedModules.add(href);
    };

    link.onerror = () => {
      console.warn(`Failed to preload: ${href}`);
    };

    document.head.appendChild(link);
  }

  /**
   * Preload route-specific chunks based on current route
   */
  preloadRouteChunks(routeName: string): void {
    const routeChunkMap: Record<string, string[]> = {
      dashboard: ['data-viz', 'charts'],
      patients: ['data-viz', 'forms'],
      'clinical-notes': ['forms', 'utils'],
      medications: ['data-viz', 'forms'],
      reports: ['data-viz', 'charts'],
      communications: ['realtime', 'forms'],
    };

    const chunks = routeChunkMap[routeName] || [];
    chunks.forEach(chunk => {
      // Find and preload chunk files
      const scripts = document.querySelectorAll(`script[src*="${chunk}"]`);
      scripts.forEach((script) => {
        const src = (script as HTMLScriptElement).src;
        this.preload(src, { as: 'script' });
      });
    });
  }

  /**
   * Initialize preloader with default preloads
   */
  initialize(): void {
    // Preload critical assets immediately
    this.preloadCriticalAssets();
    
    // Preload vendor chunks after a short delay
    setTimeout(() => {
      this.preloadVendorChunks();
    }, 100);

    // Preload critical routes after initial load
    setTimeout(() => {
      this.preloadCriticalRoutes();
    }, 500);
  }

  /**
   * Get preload statistics
   */
  getStats(): { preloaded: number; queued: number } {
    return {
      preloaded: this.preloadedModules.size,
      queued: this.preloadQueue.length,
    };
  }
}

// Create singleton instance
export const modulePreloader = new ModulePreloader();

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      modulePreloader.initialize();
    });
  } else {
    modulePreloader.initialize();
  }
}

export default modulePreloader;