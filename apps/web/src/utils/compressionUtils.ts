/**
 * Compression and Caching Utilities
 * Handles asset compression detection and optimal loading strategies
 */

interface CompressionSupport {
  brotli: boolean;
  gzip: boolean;
}

interface AssetLoadingStrategy {
  preferredFormat: 'br' | 'gz' | 'none';
  cacheStrategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  maxAge: number;
}

class CompressionUtils {
  private compressionSupport: CompressionSupport | null = null;
  private assetCache = new Map<string, { data: any; timestamp: number; maxAge: number }>();

  /**
   * Detect browser compression support
   */
  detectCompressionSupport(): CompressionSupport {
    if (this.compressionSupport) {
      return this.compressionSupport;
    }

    const acceptEncoding = navigator.userAgent.toLowerCase();
    
    this.compressionSupport = {
      brotli: this.supportsBrotli(),
      gzip: this.supportsGzip(),
    };

    return this.compressionSupport;
  }

  /**
   * Check if browser supports Brotli compression
   */
  private supportsBrotli(): boolean {
    // Check if fetch supports brotli
    if (typeof fetch !== 'undefined') {
      try {
        const headers = new Headers();
        headers.set('Accept-Encoding', 'br');
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Check if browser supports Gzip compression
   */
  private supportsGzip(): boolean {
    return typeof fetch !== 'undefined';
  }

  /**
   * Get optimal asset loading strategy
   */
  getAssetLoadingStrategy(assetType: 'js' | 'css' | 'font' | 'image'): AssetLoadingStrategy {
    const support = this.detectCompressionSupport();
    
    const strategies: Record<string, AssetLoadingStrategy> = {
      js: {
        preferredFormat: support.brotli ? 'br' : support.gzip ? 'gz' : 'none',
        cacheStrategy: 'cache-first',
        maxAge: 31536000, // 1 year for JS files with hash
      },
      css: {
        preferredFormat: support.brotli ? 'br' : support.gzip ? 'gz' : 'none',
        cacheStrategy: 'cache-first',
        maxAge: 31536000, // 1 year for CSS files with hash
      },
      font: {
        preferredFormat: support.brotli ? 'br' : 'none', // Fonts are already compressed
        cacheStrategy: 'cache-first',
        maxAge: 31536000, // 1 year for fonts
      },
      image: {
        preferredFormat: 'none', // Images are already compressed
        cacheStrategy: 'cache-first',
        maxAge: 2592000, // 30 days for images
      },
    };

    return strategies[assetType] || strategies.js;
  }

  /**
   * Load asset with optimal compression and caching
   */
  async loadAsset(url: string, assetType: 'js' | 'css' | 'font' | 'image'): Promise<any> {
    const strategy = this.getAssetLoadingStrategy(assetType);
    const cacheKey = `${url}_${assetType}`;

    // Check cache first if cache-first strategy
    if (strategy.cacheStrategy === 'cache-first') {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Prepare fetch options with compression headers
      const fetchOptions: RequestInit = {
        headers: this.getCompressionHeaders(strategy.preferredFormat),
        cache: this.getCacheMode(strategy.cacheStrategy),
      };

      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`Failed to load asset: ${response.status}`);
      }

      let data;
      switch (assetType) {
        case 'js':
        case 'css':
          data = await response.text();
          break;
        case 'font':
          data = await response.arrayBuffer();
          break;
        case 'image':
          data = await response.blob();
          break;
        default:
          data = await response.text();
      }

      // Cache the result
      this.setCache(cacheKey, data, strategy.maxAge);

      return data;
    } catch (error) {
      console.error(`Failed to load asset ${url}:`, error);
      
      // Try to return cached version as fallback
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.warn(`Using cached version of ${url}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Get compression headers based on preferred format
   */
  private getCompressionHeaders(preferredFormat: 'br' | 'gz' | 'none'): HeadersInit {
    const headers: HeadersInit = {};

    switch (preferredFormat) {
      case 'br':
        headers['Accept-Encoding'] = 'br, gzip, deflate';
        break;
      case 'gz':
        headers['Accept-Encoding'] = 'gzip, deflate';
        break;
      default:
        headers['Accept-Encoding'] = 'identity';
    }

    return headers;
  }

  /**
   * Get cache mode based on strategy
   */
  private getCacheMode(strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate'): RequestCache {
    switch (strategy) {
      case 'cache-first':
        return 'force-cache';
      case 'network-first':
        return 'no-cache';
      case 'stale-while-revalidate':
        return 'default';
      default:
        return 'default';
    }
  }

  /**
   * Get item from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.assetCache.get(key);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - cached.timestamp > cached.maxAge * 1000;

    if (isExpired) {
      this.assetCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in cache
   */
  private setCache(key: string, data: any, maxAge: number): void {
    // Limit cache size to prevent memory issues
    if (this.assetCache.size > 100) {
      // Remove oldest entries
      const entries = Array.from(this.assetCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        this.assetCache.delete(entries[i][0]);
      }
    }

    this.assetCache.set(key, {
      data,
      timestamp: Date.now(),
      maxAge,
    });
  }

  /**
   * Preload critical assets with compression
   */
  async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      { url: '/assets/css/main.css', type: 'css' as const },
      { url: '/assets/js/vendor.js', type: 'js' as const },
      { url: '/assets/fonts/inter-var.woff2', type: 'font' as const },
    ];

    const preloadPromises = criticalAssets.map(async ({ url, type }) => {
      try {
        await this.loadAsset(url, type);
      } catch (error) {
        console.warn(`Failed to preload ${url}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.assetCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.assetCache.entries()) {
      const isExpired = now - cached.timestamp > cached.maxAge * 1000;
      if (isExpired) {
        this.assetCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.assetCache.clear();
  }
}

// Create singleton instance
export const compressionUtils = new CompressionUtils();

// Auto-initialize compression detection
if (typeof window !== 'undefined') {
  compressionUtils.detectCompressionSupport();
  
  // Clear expired cache periodically
  setInterval(() => {
    compressionUtils.clearExpiredCache();
  }, 300000); // Every 5 minutes
}

export default compressionUtils;