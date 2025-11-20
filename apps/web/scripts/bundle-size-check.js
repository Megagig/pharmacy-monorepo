#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { gzipSync, brotliCompressSync } = require('zlib');

// Bundle size budgets (in bytes)
const BUNDLE_BUDGETS = {
  total: {
    raw: 2 * 1024 * 1024,    // 2MB
    gzip: 500 * 1024,        // 500KB
    brotli: 400 * 1024,      // 400KB
  },
  mainChunk: {
    raw: 800 * 1024,         // 800KB
    gzip: 200 * 1024,        // 200KB
    brotli: 160 * 1024,      // 160KB
  },
  vendorChunk: {
    raw: 1 * 1024 * 1024,    // 1MB
    gzip: 250 * 1024,        // 250KB
    brotli: 200 * 1024,      // 200KB
  },
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath);
  return {
    raw: content.length,
    gzip: gzipSync(content).length,
    brotli: brotliCompressSync(content).length,
  };
}

function analyzeBundleSize() {
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    console.error('❌ Assets directory not found in build output.');
    process.exit(1);
  }

  const files = fs.readdirSync(assetsPath);
  const jsFiles = files.filter(file => file.endsWith('.js'));
  const cssFiles = files.filter(file => file.endsWith('.css'));

  let totalSize = { raw: 0, gzip: 0, brotli: 0 };
  const chunks = [];

  console.log('📊 Bundle Size Analysis\n');
  console.log('JavaScript Files:');
  console.log('─'.repeat(80));

  jsFiles.forEach(file => {
    const filePath = path.join(assetsPath, file);
    const size = getFileSize(filePath);
    
    totalSize.raw += size.raw;
    totalSize.gzip += size.gzip;
    totalSize.brotli += size.brotli;

    const chunkType = getChunkType(file);
    chunks.push({ file, size, type: chunkType });

    console.log(`${file}`);
    console.log(`  Raw: ${formatBytes(size.raw)}`);
    console.log(`  Gzip: ${formatBytes(size.gzip)}`);
    console.log(`  Brotli: ${formatBytes(size.brotli)}`);
    console.log('');
  });

  console.log('CSS Files:');
  console.log('─'.repeat(80));

  cssFiles.forEach(file => {
    const filePath = path.join(assetsPath, file);
    const size = getFileSize(filePath);
    
    totalSize.raw += size.raw;
    totalSize.gzip += size.gzip;
    totalSize.brotli += size.brotli;

    console.log(`${file}`);
    console.log(`  Raw: ${formatBytes(size.raw)}`);
    console.log(`  Gzip: ${formatBytes(size.gzip)}`);
    console.log(`  Brotli: ${formatBytes(size.brotli)}`);
    console.log('');
  });

  console.log('Total Bundle Size:');
  console.log('─'.repeat(80));
  console.log(`Raw: ${formatBytes(totalSize.raw)}`);
  console.log(`Gzip: ${formatBytes(totalSize.gzip)}`);
  console.log(`Brotli: ${formatBytes(totalSize.brotli)}`);
  console.log('');

  // Check budgets
  const budgetResults = checkBudgets(totalSize, chunks);
  
  // Generate report
  generateReport(totalSize, chunks, budgetResults);

  // Exit with error if budgets exceeded
  if (budgetResults.some(result => !result.passed)) {
    console.error('❌ Bundle size budget exceeded!');
    process.exit(1);
  } else {
    console.log('✅ All bundle size budgets passed!');
  }
}

function getChunkType(filename) {
  if (filename.includes('vendor') || filename.includes('react') || filename.includes('router')) {
    return 'vendor';
  }
  if (filename.includes('index') || filename.includes('main')) {
    return 'main';
  }
  return 'chunk';
}

function checkBudgets(totalSize, chunks) {
  const results = [];

  // Check total budget
  results.push({
    name: 'Total Bundle',
    type: 'total',
    passed: totalSize.gzip <= BUNDLE_BUDGETS.total.gzip,
    actual: totalSize.gzip,
    budget: BUNDLE_BUDGETS.total.gzip,
  });

  // Check main chunk budget
  const mainChunk = chunks.find(chunk => chunk.type === 'main');
  if (mainChunk) {
    results.push({
      name: 'Main Chunk',
      type: 'main',
      passed: mainChunk.size.gzip <= BUNDLE_BUDGETS.mainChunk.gzip,
      actual: mainChunk.size.gzip,
      budget: BUNDLE_BUDGETS.mainChunk.gzip,
    });
  }

  // Check vendor chunk budget
  const vendorChunks = chunks.filter(chunk => chunk.type === 'vendor');
  const vendorSize = vendorChunks.reduce((sum, chunk) => sum + chunk.size.gzip, 0);
  if (vendorSize > 0) {
    results.push({
      name: 'Vendor Chunks',
      type: 'vendor',
      passed: vendorSize <= BUNDLE_BUDGETS.vendorChunk.gzip,
      actual: vendorSize,
      budget: BUNDLE_BUDGETS.vendorChunk.gzip,
    });
  }

  console.log('Budget Check Results:');
  console.log('─'.repeat(80));

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const percentage = ((result.actual / result.budget) * 100).toFixed(1);
    
    console.log(`${status} ${result.name}: ${formatBytes(result.actual)} / ${formatBytes(result.budget)} (${percentage}%)`);
  });

  console.log('');

  return results;
}

function generateReport(totalSize, chunks, budgetResults) {
  const report = {
    timestamp: new Date().toISOString(),
    totalSize,
    chunks: chunks.map(chunk => ({
      file: chunk.file,
      type: chunk.type,
      size: chunk.size,
    })),
    budgetResults,
    recommendations: generateRecommendations(totalSize, chunks, budgetResults),
  };

  const reportPath = path.join(__dirname, '../dist/bundle-size-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

function generateRecommendations(totalSize, chunks, budgetResults) {
  const recommendations = [];

  // Check for large chunks
  chunks.forEach(chunk => {
    if (chunk.size.gzip > 100 * 1024) { // > 100KB
      recommendations.push({
        type: 'large-chunk',
        message: `Consider code splitting for ${chunk.file} (${formatBytes(chunk.size.gzip)})`,
        file: chunk.file,
        size: chunk.size.gzip,
      });
    }
  });

  // Check for failed budgets
  budgetResults.forEach(result => {
    if (!result.passed) {
      const overage = result.actual - result.budget;
      recommendations.push({
        type: 'budget-exceeded',
        message: `${result.name} exceeds budget by ${formatBytes(overage)}`,
        category: result.type,
        overage,
      });
    }
  });

  // General recommendations
  if (totalSize.gzip > BUNDLE_BUDGETS.total.gzip * 0.8) {
    recommendations.push({
      type: 'optimization',
      message: 'Consider implementing lazy loading for non-critical components',
    });
  }

  return recommendations;
}

// Run the analysis
if (require.main === module) {
  analyzeBundleSize();
}

module.exports = { analyzeBundleSize, formatBytes };