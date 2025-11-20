#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: [],
    };
  }

  async runTests(options = {}) {
    console.log('🚀 Starting MTR E2E Test Suite...\n');

    const startTime = Date.now();

    try {
      // Check prerequisites
      await this.checkPrerequisites();

      // Run test suites
      const testSuites = [
        {
          name: 'Complete Workflow Tests',
          file: 'mtr-complete-workflow.spec.ts',
          description: 'Tests full MTR workflow from start to finish',
        },
        {
          name: 'Error Scenarios Tests',
          file: 'mtr-error-scenarios.spec.ts',
          description: 'Tests error handling and recovery mechanisms',
        },
        {
          name: 'Mobile & Responsive Tests',
          file: 'mtr-mobile-responsive.spec.ts',
          description: 'Tests mobile and responsive functionality',
        },
        {
          name: 'Performance Tests',
          file: 'mtr-performance.spec.ts',
          description: 'Tests performance with large datasets',
        },
      ];

      for (const suite of testSuites) {
        if (options.suite && options.suite !== suite.name) {
          continue;
        }

        console.log(`\n📋 Running ${suite.name}...`);
        console.log(`   ${suite.description}`);

        const result = await this.runTestSuite(suite.file, options);
        this.testResults.suites.push({
          name: suite.name,
          file: suite.file,
          ...result,
        });
      }

      const endTime = Date.now();
      this.testResults.duration = endTime - startTime;

      // Generate report
      await this.generateReport();

      // Exit with appropriate code
      process.exit(this.testResults.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ E2E test execution failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');

    // Check if Playwright is installed
    try {
      await this.runCommand('npx', ['playwright', '--version']);
      console.log('✅ Playwright is installed');
    } catch (error) {
      throw new Error(
        'Playwright is not installed. Run: npx playwright install'
      );
    }

    // Check if browsers are installed
    try {
      const browsersPath = path.join(
        process.cwd(),
        'node_modules',
        '@playwright',
        'test'
      );
      if (!fs.existsSync(browsersPath)) {
        throw new Error('Playwright browsers not found');
      }
      console.log('✅ Playwright browsers are available');
    } catch (error) {
      console.log('⚠️  Installing Playwright browsers...');
      await this.runCommand('npx', ['playwright', 'install']);
    }

    console.log('✅ Prerequisites check completed\n');
  }

  async runTestSuite(testFile, options = {}) {
    const args = ['playwright', 'test', testFile];

    // Add options
    if (options.headed) args.push('--headed');
    if (options.debug) args.push('--debug');
    if (options.ui) args.push('--ui');
    if (options.browser) args.push('--project', options.browser);
    if (options.workers) args.push('--workers', options.workers.toString());

    // Add reporter
    args.push('--reporter=json');

    try {
      const result = await this.runCommand('npx', args);
      return this.parseTestResults(result.stdout);
    } catch (error) {
      console.error(`❌ Test suite ${testFile} failed:`, error.message);
      return {
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 0,
        error: error.message,
      };
    }
  }

  parseTestResults(output) {
    try {
      const results = JSON.parse(output);
      return {
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
      };
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      const lines = output.split('\n');
      let passed = 0,
        failed = 0,
        skipped = 0;

      lines.forEach((line) => {
        if (line.includes('passed')) passed++;
        if (line.includes('failed')) failed++;
        if (line.includes('skipped')) skipped++;
      });

      return { passed, failed, skipped, duration: 0 };
    }
  }

  async generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================\n');

    let totalPassed = 0,
      totalFailed = 0,
      totalSkipped = 0;

    this.testResults.suites.forEach((suite) => {
      const status = suite.failed > 0 ? '❌' : '✅';
      console.log(`${status} ${suite.name}`);
      console.log(
        `   Passed: ${suite.passed}, Failed: ${suite.failed}, Skipped: ${suite.skipped}`
      );

      if (suite.error) {
        console.log(`   Error: ${suite.error}`);
      }

      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalSkipped += suite.skipped;
    });

    console.log('\n📈 Overall Results');
    console.log('==================');
    console.log(`Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);

    // Update test results
    this.testResults.total = totalPassed + totalFailed + totalSkipped;
    this.testResults.passed = totalPassed;
    this.testResults.failed = totalFailed;
    this.testResults.skipped = totalSkipped;

    // Generate HTML report if requested
    if (process.env.GENERATE_HTML_REPORT) {
      await this.generateHTMLReport();
    }

    // Generate JUnit report for CI
    if (process.env.CI) {
      await this.generateJUnitReport();
    }
  }

  async generateHTMLReport() {
    const reportPath = path.join(process.cwd(), 'e2e-test-results.html');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>MTR E2E Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MTR E2E Test Results</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Duration: ${(this.testResults.duration / 1000).toFixed(2)}s</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <p>Total Tests: ${this.testResults.total}</p>
        <p class="passed">Passed: ${this.testResults.passed}</p>
        <p class="failed">Failed: ${this.testResults.failed}</p>
        <p class="skipped">Skipped: ${this.testResults.skipped}</p>
    </div>

    <h2>Test Suites</h2>
    ${this.testResults.suites
      .map(
        (suite) => `
        <div class="suite">
            <h3>${suite.name}</h3>
            <p>File: ${suite.file}</p>
            <p class="passed">Passed: ${suite.passed}</p>
            <p class="failed">Failed: ${suite.failed}</p>
            <p class="skipped">Skipped: ${suite.skipped}</p>
            ${suite.error ? `<p class="failed">Error: ${suite.error}</p>` : ''}
        </div>
    `
      )
      .join('')}
</body>
</html>`;

    fs.writeFileSync(reportPath, html);
    console.log(`\n📄 HTML report generated: ${reportPath}`);
  }

  async generateJUnitReport() {
    const reportPath = path.join(process.cwd(), 'e2e-junit-results.xml');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MTR E2E Tests" tests="${this.testResults.total}" failures="${
      this.testResults.failed
    }" time="${this.testResults.duration / 1000}">
${this.testResults.suites
  .map(
    (suite) => `
  <testsuite name="${suite.name}" tests="${
      suite.passed + suite.failed + suite.skipped
    }" failures="${suite.failed}" time="${suite.duration / 1000}">
    ${Array.from(
      { length: suite.passed },
      (_, i) => `
    <testcase name="Test ${i + 1}" classname="${suite.name}" time="0"/>
    `
    ).join('')}
    ${Array.from(
      { length: suite.failed },
      (_, i) => `
    <testcase name="Failed Test ${i + 1}" classname="${suite.name}" time="0">
      <failure message="${suite.error || 'Test failed'}">${
        suite.error || 'Test failed'
      }</failure>
    </testcase>
    `
    ).join('')}
  </testsuite>
`
  )
  .join('')}
</testsuites>`;

    fs.writeFileSync(reportPath, xml);
    console.log(`\n📄 JUnit report generated: ${reportPath}`);
  }

  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--headed') options.headed = true;
  if (arg === '--debug') options.debug = true;
  if (arg === '--ui') options.ui = true;
  if (arg === '--browser') options.browser = args[++i];
  if (arg === '--suite') options.suite = args[++i];
  if (arg === '--workers') options.workers = parseInt(args[++i]);
}

// Run tests
const runner = new E2ETestRunner();
runner.runTests(options).catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
