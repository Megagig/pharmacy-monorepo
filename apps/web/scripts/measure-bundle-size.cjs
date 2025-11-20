#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { gzipSizeSync } = require('gzip-size');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundle() {
  console.log(`${colors.cyan}${colors.bright}📦 Bundle Size Analysis${colors.reset}\n`);

  const distPath = path.join(__dirname, '../build');
  
  if (!fs.existsSync(distPath)) {
    console.log(`${colors.red}❌ Build directory not found. Please run 'npm run build' first.${colors.reset}`);
    process.exit(1);
  }

  const assetsPath = path.join(distPath, 'assets');
  
  if (!fs.existsSync(assetsPath)) {
    console.log(`${colors.red}❌ Assets directory not found in build output.${colors.reset}`);
    process.exit(1);
  }

  const files = fs.readdirSync(assetsPath);
  const jsFiles = files.filter(file => file.endsWith('.js'));
  const cssFiles = files.filter(file => file.endsWith('.css'));

  let totalSize = 0;
  let totalGzipSize = 0;
  const fileAnalysis = [];

  // Analyze JavaScript files
  console.log(`${colors.blue}${colors.bright}JavaScript Files:${colors.reset}`);
  jsFiles.forEach(file => {
    const filePath = path.join(assetsPath, file);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    const gzipped = gzipSizeSync(content);
    
    totalSize += stats.size;
    totalGzipSize += gzipped;
    
    fileAnalysis.push({
      name: file,
      size: stats.size,
      gzipSize: gzipped,
      type: 'js'
    });

    const sizeColor = stats.size > 500000 ? colors.red : stats.size > 200000 ? colors.yellow : colors.green;
    console.log(`  ${file}`);
    console.log(`    Raw: ${sizeColor}${formatBytes(stats.size)}${colors.reset}`);
    console.log(`    Gzipped: ${sizeColor}${formatBytes(gzipped)}${colors.reset}`);
    console.log('');
  });

  // Analyze CSS files
  if (cssFiles.length > 0) {
    console.log(`${colors.magenta}${colors.bright}CSS Files:${colors.reset}`);
    cssFiles.forEach(file => {
      const filePath = path.join(assetsPath, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath);
      const gzipped = gzipSizeSync(content);
      
      totalSize += stats.size;
      totalGzipSize += gzipped;
      
      fileAnalysis.push({
        name: file,
        size: stats.size,
        gzipSize: gzipped,
        type: 'css'
      });

      console.log(`  ${file}`);
      console.log(`    Raw: ${formatBytes(stats.size)}`);
      console.log(`    Gzipped: ${formatBytes(gzipped)}`);
      console.log('');
    });
  }

  // Summary
  console.log(`${colors.cyan}${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total files: ${jsFiles.length + cssFiles.length}`);
  console.log(`  Total raw size: ${formatBytes(totalSize)}`);
  console.log(`  Total gzipped size: ${formatBytes(totalGzipSize)}`);
  console.log(`  Compression ratio: ${((1 - totalGzipSize / totalSize) * 100).toFixed(1)}%`);

  // Performance budgets check
  console.log(`\n${colors.yellow}${colors.bright}Performance Budget Check:${colors.reset}`);
  
  const budgets = {
    totalGzipped: 500 * 1024, // 500KB
    mainChunkGzipped: 200 * 1024, // 200KB
    vendorChunkGzipped: 300 * 1024, // 300KB
  };

  let budgetPassed = true;

  // Check total size
  if (totalGzipSize > budgets.totalGzipped) {
    console.log(`  ${colors.red}❌ Total gzipped size exceeds budget: ${formatBytes(totalGzipSize)} > ${formatBytes(budgets.totalGzipped)}${colors.reset}`);
    budgetPassed = false;
  } else {
    console.log(`  ${colors.green}✅ Total gzipped size within budget: ${formatBytes(totalGzipSize)} <= ${formatBytes(budgets.totalGzipped)}${colors.reset}`);
  }

  // Check main chunk size
  const mainChunk = fileAnalysis.find(file => file.name.includes('index') && file.type === 'js');
  if (mainChunk && mainChunk.gzipSize > budgets.mainChunkGzipped) {
    console.log(`  ${colors.red}❌ Main chunk exceeds budget: ${formatBytes(mainChunk.gzipSize)} > ${formatBytes(budgets.mainChunkGzipped)}${colors.reset}`);
    budgetPassed = false;
  } else if (mainChunk) {
    console.log(`  ${colors.green}✅ Main chunk within budget: ${formatBytes(mainChunk.gzipSize)} <= ${formatBytes(budgets.mainChunkGzipped)}${colors.reset}`);
  }

  // Check vendor chunks
  const vendorChunks = fileAnalysis.filter(file => 
    file.name.includes('vendor') && file.type === 'js'
  );
  
  vendorChunks.forEach(chunk => {
    if (chunk.gzipSize > budgets.vendorChunkGzipped) {
      console.log(`  ${colors.red}❌ Vendor chunk ${chunk.name} exceeds budget: ${formatBytes(chunk.gzipSize)} > ${formatBytes(budgets.vendorChunkGzipped)}${colors.reset}`);
      budgetPassed = false;
    } else {
      console.log(`  ${colors.green}✅ Vendor chunk ${chunk.name} within budget: ${formatBytes(chunk.gzipSize)} <= ${formatBytes(budgets.vendorChunkGzipped)}${colors.reset}`);
    }
  });

  // Recommendations
  console.log(`\n${colors.cyan}${colors.bright}Recommendations:${colors.reset}`);
  
  const largeFiles = fileAnalysis
    .filter(file => file.gzipSize > 100 * 1024) // Files larger than 100KB
    .sort((a, b) => b.gzipSize - a.gzipSize);

  if (largeFiles.length > 0) {
    console.log(`  ${colors.yellow}⚠️  Large files detected:${colors.reset}`);
    largeFiles.forEach(file => {
      console.log(`    - ${file.name}: ${formatBytes(file.gzipSize)} gzipped`);
    });
    console.log(`    Consider code splitting or lazy loading for these files.`);
  } else {
    console.log(`  ${colors.green}✅ No unusually large files detected.${colors.reset}`);
  }

  // Save results to file
  const results = {
    timestamp: new Date().toISOString(),
    totalSize,
    totalGzipSize,
    files: fileAnalysis,
    budgetPassed,
    budgets
  };

  fs.writeFileSync(
    path.join(__dirname, '../bundle-analysis.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n${colors.blue}📊 Detailed analysis saved to bundle-analysis.json${colors.reset}`);

  if (!budgetPassed) {
    console.log(`\n${colors.red}${colors.bright}❌ Bundle size budget check failed!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}✅ All bundle size budgets passed!${colors.reset}`);
  }
}

// Run analysis
try {
  analyzeBundle();
} catch (error) {
  console.error(`${colors.red}❌ Error analyzing bundle:${colors.reset}`, error.message);
  process.exit(1);
}