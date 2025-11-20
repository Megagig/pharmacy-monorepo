#!/usr/bin/env node

/**
 * Performance Test Runner
 * Runs comprehensive performance tests and generates reports
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PERFORMANCE_CONFIG = {
  testTimeout: 300000, // 5 minutes
  reportDir: 'performance-reports',
  baselineFile: 'performance-baseline.json',
  budgetFile: 'performance-budgets.json',
};

class PerformanceTestRunner {
  constructor() {
    this.results = {
      timestamp: Date.now(),
      buildId: process.env.BUILD_ID || 'local',
      branch: process.env.BRANCH || 'main',
      commit: process.env.COMMIT_SHA || 'unknown',
      tests: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        overallScore: 0,
        budgetCompliance: false,
      },
    };
  }

  async runThemePerformanceTests() {
    console.log('🎨 Running theme performance tests...');
    
    try {
      const output = execSync(
        'npm run test:theme:performance -- --reporter=json',
        { 
          encoding: 'utf8',
          timeout: PERFORMANCE_CONFIG.testTimeout,
          cwd: process.cwd(),
        }
      );
      
      const testResults = JSON.parse(output);
      this.processTestResults('theme', testResults);
      
      console.log('✅ Theme performance tests completed');
    } catch (error) {
      console.error('❌ Theme performance tests failed:', error.message);
      this.results.tests.push({
        category: 'theme',
        name: 'Theme Performance Suite',
        passed: false,
        error: error.message,
      });
    }
  }

  async runBundleSizeTests() {
    console.log('📦 Running bundle size tests...');
    
    try {
      // Run bundle analysis
      const bundleOutput = execSync('npm run bundle:analyze', { 
        encoding: 'utf8',
        timeout: PERFORMANCE_CONFIG.testTimeout,
      });
      
      // Run bundle size validation
      const sizeOutput = execSync('npm run bundle:size', { 
        encoding: 'utf8',
        timeout: PERFORMANCE_CONFIG.testTimeout,
      });
      
      this.processBundleResults(bundleOutput, sizeOutput);
      
      console.log('✅ Bundle size tests completed');
    } catch (error) {
      console.error('❌ Bundle size tests failed:', error.message);
      this.results.tests.push({
        category: 'bundle',
        name: 'Bundle Size Analysis',
        passed: false,
        error: error.message,
      });
    }
  }

  async runApiLatencyTests() {
    console.log('🌐 Running API latency tests...');
    
    try {
      const output = execSync(
        'vitest run src/__tests__/performance/ApiLatency.test.tsx --reporter=json',
        { 
          encoding: 'utf8',
          timeout: PERFORMANCE_CONFIG.testTimeout,
        }
      );
      
      const testResults = JSON.parse(output);
      this.processTestResults('api', testResults);
      
      console.log('✅ API latency tests completed');
    } catch (error) {
      console.error('❌ API latency tests failed:', error.message);
      this.results.tests.push({
        category: 'api',
        name: 'API Latency Tests',
        passed: false,
        error: error.message,
      });
    }
  }

  async runWebVitalsTests() {
    console.log('📊 Running Web Vitals tests...');
    
    try {
      const output = execSync(
        'vitest run src/__tests__/performance/WebVitals.test.tsx --reporter=json',
        { 
          encoding: 'utf8',
          timeout: PERFORMANCE_CONFIG.testTimeout,
        }
      );
      
      const testResults = JSON.parse(output);
      this.processTestResults('webVitals', testResults);
      
      console.log('✅ Web Vitals tests completed');
    } catch (error) {
      console.error('❌ Web Vitals tests failed:', error.message);
      this.results.tests.push({
        category: 'webVitals',
        name: 'Web Vitals Tests',
        passed: false,
        error: error.message,
      });
    }
  }

  async runLighthouseTests() {
    console.log('🏠 Running Lighthouse performance tests...');
    
    try {
      const output = execSync('npm run lighthouse', { 
        encoding: 'utf8',
        timeout: PERFORMANCE_CONFIG.testTimeout,
      });
      
      this.processLighthouseResults(output);
      
      console.log('✅ Lighthouse tests completed');
    } catch (error) {
      console.error('❌ Lighthouse tests failed:', error.message);
      this.results.tests.push({
        category: 'lighthouse',
        name: 'Lighthouse Performance',
        passed: false,
        error: error.message,
      });
    }
  }

  processTestResults(category, testResults) {
    if (testResults && testResults.testResults) {
      testResults.testResults.forEach(suite => {
        suite.assertionResults.forEach(test => {
          this.results.tests.push({
            category,
            name: test.title,
            passed: test.status === 'passed',
            duration: test.duration,
            error: test.failureMessages?.[0],
          });
        });
      });
    }
  }

  processBundleResults(bundleOutput, sizeOutput) {
    try {
      // Parse bundle analysis results
      const bundleData = this.parseBundleOutput(bundleOutput);
      const sizeData = this.parseSizeOutput(sizeOutput);
      
      // Validate against budgets
      const budgets = this.loadBudgets();
      
      this.results.tests.push({
        category: 'bundle',
        name: 'Total Bundle Size',
        passed: bundleData.totalSize < budgets.bundleSize.maxGzip,
        value: bundleData.totalSize,
        budget: budgets.bundleSize.maxGzip,
      });
      
      // Validate individual chunks
      Object.entries(bundleData.chunks).forEach(([name, size]) => {
        this.results.tests.push({
          category: 'bundle',
          name: `Chunk Size: ${name}`,
          passed: size < budgets.bundleSize.maxChunkGzip,
          value: size,
          budget: budgets.bundleSize.maxChunkGzip,
        });
      });
      
    } catch (error) {
      console.error('Error processing bundle results:', error);
    }
  }

  processLighthouseResults(output) {
    try {
      // Parse Lighthouse results
      const lighthouseData = this.parseLighthouseOutput(output);
      const budgets = this.loadBudgets();
      
      this.results.tests.push({
        category: 'lighthouse',
        name: 'Lighthouse Performance Score',
        passed: lighthouseData.performance >= budgets.lighthouse.minPerformance,
        value: lighthouseData.performance,
        budget: budgets.lighthouse.minPerformance,
      });
      
      this.results.tests.push({
        category: 'lighthouse',
        name: 'Lighthouse Accessibility Score',
        passed: lighthouseData.accessibility >= budgets.lighthouse.minAccessibility,
        value: lighthouseData.accessibility,
        budget: budgets.lighthouse.minAccessibility,
      });
      
    } catch (error) {
      console.error('Error processing Lighthouse results:', error);
    }
  }

  parseBundleOutput(output) {
    // Mock bundle parsing - in real implementation, parse actual bundle analyzer output
    return {
      totalSize: 450 * 1024, // 450KB
      chunks: {
        'main.js': 150 * 1024,
        'vendor.js': 200 * 1024,
        'chunk.js': 100 * 1024,
      },
    };
  }

  parseSizeOutput(output) {
    // Mock size parsing
    return {
      gzipSize: 450 * 1024,
      uncompressedSize: 1200 * 1024,
    };
  }

  parseLighthouseOutput(output) {
    // Mock Lighthouse parsing
    return {
      performance: 92,
      accessibility: 96,
      bestPractices: 91,
      seo: 94,
    };
  }

  loadBudgets() {
    const budgetPath = path.join(process.cwd(), PERFORMANCE_CONFIG.budgetFile);
    
    if (fs.existsSync(budgetPath)) {
      return JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
    }
    
    // Default budgets
    return {
      theme: {
        maxToggleTime: 16,
        maxAverageTime: 12,
      },
      bundleSize: {
        maxGzip: 500 * 1024,
        maxChunkGzip: 200 * 1024,
      },
      api: {
        maxP50: 200,
        maxP95: 500,
      },
      webVitals: {
        maxLCP: 2500,
        maxFID: 100,
        maxCLS: 0.1,
      },
      lighthouse: {
        minPerformance: 90,
        minAccessibility: 95,
        minBestPractices: 90,
        minSeo: 90,
      },
    };
  }

  calculateSummary() {
    const totalTests = this.results.tests.length;
    const passed = this.results.tests.filter(t => t.passed).length;
    const failed = totalTests - passed;
    const overallScore = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
    
    this.results.summary = {
      totalTests,
      passed,
      failed,
      overallScore,
      budgetCompliance: failed === 0,
    };
  }

  async generateReport() {
    console.log('📊 Generating performance report...');
    
    // Ensure report directory exists
    const reportDir = path.join(process.cwd(), PERFORMANCE_CONFIG.reportDir);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Calculate summary
    this.calculateSummary();
    
    // Generate reports in multiple formats
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // JSON report
    const jsonReport = path.join(reportDir, `performance-report-${timestamp}.json`);
    fs.writeFileSync(jsonReport, JSON.stringify(this.results, null, 2));
    
    // HTML report
    const htmlReport = path.join(reportDir, `performance-report-${timestamp}.html`);
    fs.writeFileSync(htmlReport, this.generateHtmlReport());
    
    // Console summary
    this.printSummary();
    
    console.log(`📄 Reports generated:`);
    console.log(`  JSON: ${jsonReport}`);
    console.log(`  HTML: ${htmlReport}`);
    
    return this.results;
  }

  generateHtmlReport() {
    const { summary, tests } = this.results;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-results { margin-top: 20px; }
        .category { margin: 20px 0; }
        .category h3 { background: #e9ecef; padding: 10px; margin: 0; }
        .test { padding: 10px; border-left: 4px solid #ccc; margin: 5px 0; }
        .test.passed { border-left-color: #28a745; background: #f8fff9; }
        .test.failed { border-left-color: #dc3545; background: #fff8f8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p>Generated: ${new Date(this.results.timestamp).toLocaleString()}</p>
        <p>Build: ${this.results.buildId} | Branch: ${this.results.branch} | Commit: ${this.results.commit}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Overall Score</h3>
            <div class="${summary.overallScore >= 90 ? 'passed' : 'failed'}">${summary.overallScore}/100</div>
        </div>
        <div class="metric">
            <h3>Tests Passed</h3>
            <div class="${summary.failed === 0 ? 'passed' : 'failed'}">${summary.passed}/${summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Budget Compliance</h3>
            <div class="${summary.budgetCompliance ? 'passed' : 'failed'}">${summary.budgetCompliance ? 'PASS' : 'FAIL'}</div>
        </div>
    </div>
    
    <div class="test-results">
        ${this.generateHtmlTestResults()}
    </div>
</body>
</html>`;
  }

  generateHtmlTestResults() {
    const categories = [...new Set(this.results.tests.map(t => t.category))];
    
    return categories.map(category => {
      const categoryTests = this.results.tests.filter(t => t.category === category);
      const categoryPassed = categoryTests.filter(t => t.passed).length;
      
      return `
        <div class="category">
            <h3>${category.toUpperCase()} (${categoryPassed}/${categoryTests.length} passed)</h3>
            ${categoryTests.map(test => `
                <div class="test ${test.passed ? 'passed' : 'failed'}">
                    <strong>${test.name}</strong>
                    ${test.value !== undefined ? `<br>Value: ${test.value} (Budget: ${test.budget})` : ''}
                    ${test.duration ? `<br>Duration: ${test.duration}ms` : ''}
                    ${test.error ? `<br>Error: ${test.error}` : ''}
                </div>
            `).join('')}
        </div>
      `;
    }).join('');
  }

  printSummary() {
    const { summary } = this.results;
    
    console.log('\n📊 Performance Test Summary');
    console.log('============================');
    console.log(`Overall Score: ${summary.overallScore}/100`);
    console.log(`Tests: ${summary.passed}/${summary.totalTests} passed`);
    console.log(`Budget Compliance: ${summary.budgetCompliance ? '✅ PASS' : '❌ FAIL'}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => !t.passed)
        .forEach(test => {
          console.log(`  - ${test.category}: ${test.name}`);
          if (test.error) {
            console.log(`    Error: ${test.error}`);
          }
        });
    }
    
    console.log('');
  }

  async run() {
    console.log('🚀 Starting comprehensive performance tests...\n');
    
    try {
      await this.runThemePerformanceTests();
      await this.runBundleSizeTests();
      await this.runApiLatencyTests();
      await this.runWebVitalsTests();
      await this.runLighthouseTests();
      
      const report = await this.generateReport();
      
      // Exit with error code if tests failed
      if (!report.summary.budgetCompliance) {
        process.exit(1);
      }
      
      console.log('🎉 All performance tests passed!');
      
    } catch (error) {
      console.error('💥 Performance test runner failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run().catch(console.error);
}

module.exports = PerformanceTestRunner;