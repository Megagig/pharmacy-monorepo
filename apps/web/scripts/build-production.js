#!/usr/bin/env node

/**
 * Production Build Script with Optimization
 * Handles production build with compression, analysis, and validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const gzipSize = require('gzip-size');

class ProductionBuilder {
  constructor() {
    this.buildDir = path.join(__dirname, '../dist');
    this.stats = {
      buildTime: 0,
      bundleSize: {},
      compressionRatio: {},
      chunkCount: 0,
    };
  }

  /**
   * Run the complete production build process
   */
  async build() {
    console.log('🚀 Starting production build...\n');
    
    const startTime = Date.now();
    
    try {
      // Step 1: Clean previous build
      await this.cleanBuild();
      
      // Step 2: Run Vite build
      await this.runViteBuild();
      
      // Step 3: Analyze bundle
      await this.analyzeBundleSize();
      
      // Step 4: Generate compression report
      await this.generateCompressionReport();
      
      // Step 5: Validate build
      await this.validateBuild();
      
      this.stats.buildTime = Date.now() - startTime;
      
      // Step 6: Generate build report
      await this.generateBuildReport();
      
      console.log('✅ Production build completed successfully!\n');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Production build failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Clean previous build directory
   */
  async cleanBuild() {
    console.log('🧹 Cleaning previous build...');
    
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
    
    console.log('✓ Build directory cleaned\n');
  }

  /**
   * Run Vite build with optimizations
   */
  async runViteBuild() {
    console.log('📦 Building application...');
    
    try {
      // Set production environment
      process.env.NODE_ENV = 'production';
      
      // Run Vite build
      execSync('npm run build', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });
      
      console.log('✓ Vite build completed\n');
    } catch (error) {
      throw new Error(`Vite build failed: ${error.message}`);
    }
  }

  /**
   * Analyze bundle size and chunks
   */
  async analyzeBundleSize() {
    console.log('📊 Analyzing bundle size...');
    
    if (!fs.existsSync(this.buildDir)) {
      throw new Error('Build directory not found');
    }

    const assetsDir = path.join(this.buildDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      throw new Error('Assets directory not found');
    }

    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    const cssFiles = files.filter(file => file.endsWith('.css'));
    
    this.stats.chunkCount = jsFiles.length;
    
    let totalSize = 0;
    let totalGzipSize = 0;
    
    // Analyze JS files
    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = fs.readFileSync(filePath);
      const size = content.length;
      const gzipped = gzipSize.sync(content);
      
      totalSize += size;
      totalGzipSize += gzipped;
      
      this.stats.bundleSize[file] = {
        raw: size,
        gzip: gzipped,
        ratio: ((size - gzipped) / size * 100).toFixed(1),
      };
    }
    
    // Analyze CSS files
    for (const file of cssFiles) {
      const filePath = path.join(assetsDir, file);
      const content = fs.readFileSync(filePath);
      const size = content.length;
      const gzipped = gzipSize.sync(content);
      
      totalSize += size;
      totalGzipSize += gzipped;
      
      this.stats.bundleSize[file] = {
        raw: size,
        gzip: gzipped,
        ratio: ((size - gzipped) / size * 100).toFixed(1),
      };
    }
    
    this.stats.bundleSize.total = {
      raw: totalSize,
      gzip: totalGzipSize,
      ratio: ((totalSize - totalGzipSize) / totalSize * 100).toFixed(1),
    };
    
    console.log(`✓ Bundle analysis completed (${jsFiles.length} JS, ${cssFiles.length} CSS files)\n`);
  }

  /**
   * Generate compression report
   */
  async generateCompressionReport() {
    console.log('🗜️  Generating compression report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalFiles: Object.keys(this.stats.bundleSize).length - 1, // Exclude 'total'
      totalSize: this.stats.bundleSize.total,
      files: this.stats.bundleSize,
      recommendations: this.generateOptimizationRecommendations(),
    };
    
    const reportPath = path.join(this.buildDir, 'compression-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✓ Compression report saved to ${reportPath}\n`);
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    const { total } = this.stats.bundleSize;
    
    // Check total bundle size
    if (total.gzip > 500 * 1024) { // 500KB
      recommendations.push({
        type: 'warning',
        message: `Total gzipped bundle size (${this.formatBytes(total.gzip)}) exceeds 500KB`,
        suggestion: 'Consider code splitting or removing unused dependencies',
      });
    }
    
    // Check individual chunk sizes
    Object.entries(this.stats.bundleSize).forEach(([file, stats]) => {
      if (file === 'total') return;
      
      if (stats.gzip > 200 * 1024) { // 200KB
        recommendations.push({
          type: 'warning',
          message: `Large chunk detected: ${file} (${this.formatBytes(stats.gzip)} gzipped)`,
          suggestion: 'Consider splitting this chunk further',
        });
      }
      
      if (parseFloat(stats.ratio) < 60) {
        recommendations.push({
          type: 'info',
          message: `Low compression ratio for ${file} (${stats.ratio}%)`,
          suggestion: 'This file may already be compressed or contain binary data',
        });
      }
    });
    
    // Check chunk count
    if (this.stats.chunkCount > 20) {
      recommendations.push({
        type: 'warning',
        message: `High number of chunks (${this.stats.chunkCount})`,
        suggestion: 'Consider consolidating some chunks to reduce HTTP requests',
      });
    }
    
    return recommendations;
  }

  /**
   * Validate build output
   */
  async validateBuild() {
    console.log('🔍 Validating build output...');
    
    const validations = [];
    
    // Check if index.html exists
    const indexPath = path.join(this.buildDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('index.html not found in build output');
    }
    validations.push('✓ index.html exists');
    
    // Check if assets directory exists
    const assetsDir = path.join(this.buildDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      throw new Error('assets directory not found in build output');
    }
    validations.push('✓ assets directory exists');
    
    // Check for critical chunks
    const files = fs.readdirSync(assetsDir);
    const hasJsFiles = files.some(file => file.endsWith('.js'));
    const hasCssFiles = files.some(file => file.endsWith('.css'));
    
    if (!hasJsFiles) {
      throw new Error('No JavaScript files found in build output');
    }
    validations.push('✓ JavaScript files present');
    
    if (!hasCssFiles) {
      console.warn('⚠️  No CSS files found in build output');
    } else {
      validations.push('✓ CSS files present');
    }
    
    // Validate index.html content
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    if (!indexContent.includes('script')) {
      throw new Error('No script tags found in index.html');
    }
    validations.push('✓ Script tags present in index.html');
    
    console.log(validations.join('\n'));
    console.log('✓ Build validation passed\n');
  }

  /**
   * Generate comprehensive build report
   */
  async generateBuildReport() {
    console.log('📋 Generating build report...');
    
    const report = {
      buildInfo: {
        timestamp: new Date().toISOString(),
        buildTime: this.stats.buildTime,
        nodeVersion: process.version,
        platform: process.platform,
      },
      bundleAnalysis: {
        totalSize: this.stats.bundleSize.total,
        chunkCount: this.stats.chunkCount,
        files: this.stats.bundleSize,
      },
      performance: {
        compressionRatio: this.stats.bundleSize.total.ratio,
        recommendations: this.generateOptimizationRecommendations(),
      },
      validation: {
        passed: true,
        timestamp: new Date().toISOString(),
      },
    };
    
    const reportPath = path.join(this.buildDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable report
    const readableReport = this.generateReadableReport(report);
    const readableReportPath = path.join(this.buildDir, 'BUILD_REPORT.md');
    fs.writeFileSync(readableReportPath, readableReport);
    
    console.log(`✓ Build report saved to ${reportPath}\n`);
  }

  /**
   * Generate human-readable build report
   */
  generateReadableReport(report) {
    const { bundleAnalysis, performance, buildInfo } = report;
    
    return `# Production Build Report

## Build Information
- **Build Time**: ${this.formatDuration(buildInfo.buildTime)}
- **Timestamp**: ${buildInfo.timestamp}
- **Node Version**: ${buildInfo.nodeVersion}
- **Platform**: ${buildInfo.platform}

## Bundle Analysis
- **Total Size**: ${this.formatBytes(bundleAnalysis.totalSize.raw)} (raw), ${this.formatBytes(bundleAnalysis.totalSize.gzip)} (gzipped)
- **Compression Ratio**: ${bundleAnalysis.totalSize.ratio}%
- **Chunk Count**: ${bundleAnalysis.chunkCount}

### File Breakdown
${Object.entries(bundleAnalysis.files)
  .filter(([file]) => file !== 'total')
  .map(([file, stats]) => `- **${file}**: ${this.formatBytes(stats.raw)} → ${this.formatBytes(stats.gzip)} (${stats.ratio}% compression)`)
  .join('\n')}

## Performance Recommendations
${performance.recommendations.length > 0 
  ? performance.recommendations.map(rec => `- **${rec.type.toUpperCase()}**: ${rec.message}\n  *${rec.suggestion}*`).join('\n')
  : '✅ No performance issues detected'
}

## Validation
✅ All build validations passed

---
*Generated on ${new Date().toLocaleString()}*
`;
  }

  /**
   * Print build summary
   */
  printSummary() {
    const { total } = this.stats.bundleSize;
    
    console.log('📊 Build Summary:');
    console.log(`   Build Time: ${this.formatDuration(this.stats.buildTime)}`);
    console.log(`   Total Size: ${this.formatBytes(total.raw)} → ${this.formatBytes(total.gzip)} (${total.ratio}% compression)`);
    console.log(`   Chunks: ${this.stats.chunkCount}`);
    
    const recommendations = this.generateOptimizationRecommendations();
    if (recommendations.length > 0) {
      console.log(`   Recommendations: ${recommendations.length} optimization suggestions`);
    } else {
      console.log('   ✅ No optimization issues detected');
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable format
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  }
}

// Run the build if this script is executed directly
if (require.main === module) {
  const builder = new ProductionBuilder();
  builder.build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionBuilder;