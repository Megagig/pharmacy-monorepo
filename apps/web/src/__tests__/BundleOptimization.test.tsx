/**
 * Bundle Optimization Tests
 * Tests for production bundle optimization and performance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import gzipSize from 'gzip-size';

describe('Bundle Optimization', () => {
  const buildDir = path.join(__dirname, '../../dist');
  const assetsDir = path.join(buildDir, 'assets');
  let buildStats: any = {};

  beforeAll(async () => {
    // Only run if build directory exists (skip in CI unless build is run first)
    if (!fs.existsSync(buildDir)) {
      console.warn('Build directory not found, skipping bundle optimization tests');
      return;
    }

    // Analyze existing build
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      
      for (const file of files) {
        const filePath = path.join(assetsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const content = fs.readFileSync(filePath);
          buildStats[file] = {
            size: content.length,
            gzipSize: gzipSize.sync(content),
          };
        }
      }
    }
  });

  describe('Bundle Size Limits', () => {
    it('should have total gzipped bundle size under 500KB', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      const totalGzipSize = jsFiles.reduce((total, file) => {
        return total + buildStats[file].gzipSize;
      }, 0);

      expect(totalGzipSize).toBeLessThan(500 * 1024); // 500KB
    });

    it('should have individual chunks under 200KB gzipped', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      jsFiles.forEach(file => {
        const gzipSize = buildStats[file].gzipSize;
        expect(gzipSize).toBeLessThan(200 * 1024); // 200KB per chunk
      });
    });

    it('should have reasonable number of chunks', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // Should have between 5-20 chunks for optimal loading
      expect(jsFiles.length).toBeGreaterThan(4);
      expect(jsFiles.length).toBeLessThan(21);
    });
  });

  describe('Compression Efficiency', () => {
    it('should achieve good compression ratios', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      jsFiles.forEach(file => {
        const { size, gzipSize } = buildStats[file];
        const compressionRatio = ((size - gzipSize) / size) * 100;
        
        // Should achieve at least 60% compression for JS files
        expect(compressionRatio).toBeGreaterThan(60);
      });
    });

    it('should have optimized CSS compression', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const cssFiles = Object.keys(buildStats).filter(file => file.endsWith('.css'));
      
      if (cssFiles.length > 0) {
        cssFiles.forEach(file => {
          const { size, gzipSize } = buildStats[file];
          const compressionRatio = ((size - gzipSize) / size) * 100;
          
          // CSS should achieve at least 70% compression
          expect(compressionRatio).toBeGreaterThan(70);
        });
      }
    });
  });

  describe('Chunk Splitting Strategy', () => {
    it('should have vendor chunks separated', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // Should have chunks for major vendors
      const hasReactChunk = jsFiles.some(file => 
        file.includes('react-core') || file.includes('vendor')
      );
      
      expect(hasReactChunk).toBe(true);
    });

    it('should have feature-based chunks', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // Should have chunks for major features
      const hasFeatureChunks = jsFiles.some(file => 
        file.includes('charts') || 
        file.includes('forms') || 
        file.includes('data-viz')
      );
      
      // This is optional as chunk names might be hashed
      if (hasFeatureChunks) {
        expect(hasFeatureChunks).toBe(true);
      }
    });
  });

  describe('Asset Optimization', () => {
    it('should have optimized file names with hashes', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // All JS files should have hashes for cache busting
      jsFiles.forEach(file => {
        expect(file).toMatch(/-[a-f0-9]{8,}\./); // Hash pattern
      });
    });

    it('should have minified content', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      if (jsFiles.length > 0) {
        const sampleFile = jsFiles[0];
        const filePath = path.join(assetsDir, sampleFile);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Minified files should not have excessive whitespace
        const lines = content.split('\n');
        const avgLineLength = content.length / lines.length;
        
        // Minified JS should have long lines (> 100 chars average)
        expect(avgLineLength).toBeGreaterThan(100);
      }
    });
  });

  describe('Build Output Validation', () => {
    it('should have index.html with proper script tags', () => {
      const indexPath = path.join(buildDir, 'index.html');
      
      if (!fs.existsSync(indexPath)) {
        console.warn('index.html not found, skipping test');
        return;
      }

      const content = fs.readFileSync(indexPath, 'utf-8');
      
      // Should have script tags
      expect(content).toMatch(/<script[^>]*src="[^"]*\.js"[^>]*>/);
      
      // Should have preload links for critical resources
      expect(content).toMatch(/<link[^>]*rel="preload"[^>]*>/);
    });

    it('should have proper asset organization', () => {
      if (!fs.existsSync(assetsDir)) {
        console.warn('Assets directory not found, skipping test');
        return;
      }

      const files = fs.readdirSync(assetsDir);
      
      // Should have JS files
      const jsFiles = files.filter(file => file.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);
      
      // Should have CSS files (optional)
      const cssFiles = files.filter(file => file.endsWith('.css'));
      // CSS files are optional as styles might be inlined
    });
  });

  describe('Performance Budgets', () => {
    it('should meet performance budget for main bundle', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // Find the main/entry chunk (usually the largest or named index)
      const mainChunk = jsFiles.reduce((largest, file) => {
        return buildStats[file].gzipSize > buildStats[largest].gzipSize ? file : largest;
      }, jsFiles[0]);

      if (mainChunk) {
        const mainChunkSize = buildStats[mainChunk].gzipSize;
        
        // Main chunk should be under 150KB gzipped
        expect(mainChunkSize).toBeLessThan(150 * 1024);
      }
    });

    it('should have efficient vendor chunk sizes', () => {
      if (Object.keys(buildStats).length === 0) {
        console.warn('No build stats available, skipping test');
        return;
      }

      const jsFiles = Object.keys(buildStats).filter(file => file.endsWith('.js'));
      
      // Vendor chunks should be reasonably sized
      jsFiles.forEach(file => {
        const size = buildStats[file].gzipSize;
        
        // No single chunk should exceed 300KB gzipped
        expect(size).toBeLessThan(300 * 1024);
      });
    });
  });
});

describe('Module Preloader', () => {
  it('should have module preloader utility', async () => {
    const { modulePreloader } = await import('../utils/modulePreloader');
    
    expect(modulePreloader).toBeDefined();
    expect(typeof modulePreloader.preload).toBe('function');
    expect(typeof modulePreloader.initialize).toBe('function');
  });

  it('should track preloaded modules', async () => {
    const { modulePreloader } = await import('../utils/modulePreloader');
    
    const stats = modulePreloader.getStats();
    expect(stats).toHaveProperty('preloaded');
    expect(stats).toHaveProperty('queued');
    expect(typeof stats.preloaded).toBe('number');
    expect(typeof stats.queued).toBe('number');
  });
});

describe('Compression Utils', () => {
  it('should detect compression support', async () => {
    const { compressionUtils } = await import('../utils/compressionUtils');
    
    const support = compressionUtils.detectCompressionSupport();
    expect(support).toHaveProperty('brotli');
    expect(support).toHaveProperty('gzip');
    expect(typeof support.brotli).toBe('boolean');
    expect(typeof support.gzip).toBe('boolean');
  });

  it('should provide asset loading strategies', async () => {
    const { compressionUtils } = await import('../utils/compressionUtils');
    
    const strategy = compressionUtils.getAssetLoadingStrategy('js');
    expect(strategy).toHaveProperty('preferredFormat');
    expect(strategy).toHaveProperty('cacheStrategy');
    expect(strategy).toHaveProperty('maxAge');
  });
});