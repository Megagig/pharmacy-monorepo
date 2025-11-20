const fs = require('fs');
const path = require('path');

/**
 * Custom Jest test results processor for RBAC tests
 * Generates detailed reports and metrics for different test types
 */
module.exports = (results) => {
  const timestamp = new Date().toISOString();
  const reportDir = path.join(process.cwd(), 'test-reports', 'rbac');

  // Ensure report directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Process test results by type
  const testsByType = {
    unit: [],
    integration: [],
    performance: [],
    security: [],
  };

  results.testResults.forEach((testResult) => {
    const testPath = testResult.testFilePath;
    let testType = 'unit';

    if (testPath.includes('/integration/')) {
      testType = 'integration';
    } else if (testPath.includes('/performance/')) {
      testType = 'performance';
    } else if (testPath.includes('/security/')) {
      testType = 'security';
    }

    testsByType[testType].push({
      filePath: testPath,
      fileName: path.basename(testPath),
      numPassingTests: testResult.numPassingTests,
      numFailingTests: testResult.numFailingTests,
      numTodoTests: testResult.numTodoTests,
      perfStats: testResult.perfStats,
      testResults: testResult.testResults.map((test) => ({
        title: test.title,
        fullName: test.fullName,
        status: test.status,
        duration: test.duration,
        failureMessages: test.failureMessages,
      })),
    });
  });

  // Generate summary report
  const summary = {
    timestamp,
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    todoTests: results.numTodoTests,
    totalTime: results.testResults.reduce(
      (sum, result) =>
        sum + (result.perfStats?.end - result.perfStats?.start || 0),
      0
    ),
    success: results.success,
    coverageMap: results.coverageMap,
    testsByType: Object.keys(testsByType).reduce((acc, type) => {
      const tests = testsByType[type];
      acc[type] = {
        totalFiles: tests.length,
        totalTests: tests.reduce(
          (sum, test) => sum + test.numPassingTests + test.numFailingTests,
          0
        ),
        passedTests: tests.reduce((sum, test) => sum + test.numPassingTests, 0),
        failedTests: tests.reduce((sum, test) => sum + test.numFailingTests, 0),
        avgDuration:
          tests.length > 0
            ? tests.reduce(
                (sum, test) =>
                  sum + (test.perfStats?.end - test.perfStats?.start || 0),
                0
              ) / tests.length
            : 0,
      };
      return acc;
    }, {}),
  };

  // Write summary report
  fs.writeFileSync(
    path.join(
      reportDir,
      `rbac-test-summary-${timestamp.replace(/[:.]/g, '-')}.json`
    ),
    JSON.stringify(summary, null, 2)
  );

  // Write detailed reports for each test type
  Object.keys(testsByType).forEach((type) => {
    if (testsByType[type].length > 0) {
      fs.writeFileSync(
        path.join(
          reportDir,
          `rbac-${type}-tests-${timestamp.replace(/[:.]/g, '-')}.json`
        ),
        JSON.stringify(testsByType[type], null, 2)
      );
    }
  });

  // Generate performance metrics for performance tests
  if (testsByType.performance.length > 0) {
    const performanceMetrics = {
      timestamp,
      tests: testsByType.performance.map((test) => ({
        fileName: test.fileName,
        duration: test.perfStats?.end - test.perfStats?.start || 0,
        testResults: test.testResults.map((t) => ({
          name: t.title,
          duration: t.duration,
          status: t.status,
        })),
      })),
      thresholds: {
        permissionCheckMs: 100,
        bulkOperationMs: 5000,
        cacheHitRatio: 0.8,
        memoryUsageMb: 50,
      },
    };

    fs.writeFileSync(
      path.join(
        reportDir,
        `rbac-performance-metrics-${timestamp.replace(/[:.]/g, '-')}.json`
      ),
      JSON.stringify(performanceMetrics, null, 2)
    );
  }

  // Generate security test report
  if (testsByType.security.length > 0) {
    const securityReport = {
      timestamp,
      vulnerabilityTests: testsByType.security.map((test) => ({
        fileName: test.fileName,
        testResults: test.testResults.map((t) => ({
          vulnerability: t.title,
          status: t.status,
          duration: t.duration,
          failureMessages: t.failureMessages,
        })),
      })),
      securityCategories: [
        'Privilege Escalation Prevention',
        'Unauthorized Access Prevention',
        'Permission Bypass Vulnerabilities',
        'Audit Logging Security',
        'Session Security',
        'Input Validation Security',
        'Rate Limiting Security',
        'Data Integrity Security',
      ],
    };

    fs.writeFileSync(
      path.join(
        reportDir,
        `rbac-security-report-${timestamp.replace(/[:.]/g, '-')}.json`
      ),
      JSON.stringify(securityReport, null, 2)
    );
  }

  // Generate HTML report
  generateHtmlReport(summary, testsByType, reportDir, timestamp);

  // Console output
  console.log('\n📊 RBAC Test Results Summary:');
  console.log(`   Total Tests: ${summary.totalTests}`);
  console.log(`   Passed: ${summary.passedTests} ✅`);
  console.log(`   Failed: ${summary.failedTests} ❌`);
  console.log(
    `   Success Rate: ${(
      (summary.passedTests / summary.totalTests) *
      100
    ).toFixed(1)}%`
  );
  console.log(`   Total Duration: ${(summary.totalTime / 1000).toFixed(2)}s`);

  console.log('\n📋 Test Types:');
  Object.keys(summary.testsByType).forEach((type) => {
    const typeData = summary.testsByType[type];
    if (typeData.totalTests > 0) {
      console.log(
        `   ${type.toUpperCase()}: ${typeData.passedTests}/${
          typeData.totalTests
        } passed (${(typeData.avgDuration / 1000).toFixed(2)}s avg)`
      );
    }
  });

  console.log(`\n📁 Reports saved to: ${reportDir}`);

  return results;
};

function generateHtmlReport(summary, testsByType, reportDir, timestamp) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>RBAC Test Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.success { background: #d4edda; }
        .metric.failure { background: #f8d7da; }
        .test-type { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .test-list { margin: 10px 0; }
        .test-item { padding: 5px; margin: 2px 0; border-radius: 3px; }
        .test-item.passed { background: #d4edda; }
        .test-item.failed { background: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 RBAC Test Report</h1>
        <p>Generated: ${timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric ${summary.success ? 'success' : 'failure'}">
            <h3>Overall Status</h3>
            <p>${summary.success ? '✅ PASSED' : '❌ FAILED'}</p>
        </div>
        <div class="metric">
            <h3>Total Tests</h3>
            <p>${summary.totalTests}</p>
        </div>
        <div class="metric success">
            <h3>Passed</h3>
            <p>${summary.passedTests}</p>
        </div>
        <div class="metric ${summary.failedTests > 0 ? 'failure' : ''}">
            <h3>Failed</h3>
            <p>${summary.failedTests}</p>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <p>${((summary.passedTests / summary.totalTests) * 100).toFixed(
              1
            )}%</p>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <p>${(summary.totalTime / 1000).toFixed(2)}s</p>
        </div>
    </div>

    ${Object.keys(testsByType)
      .map((type) => {
        const tests = testsByType[type];
        if (tests.length === 0) return '';

        return `
        <div class="test-type">
            <h2>📋 ${type.toUpperCase()} Tests</h2>
            <table>
                <tr>
                    <th>Test File</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Duration</th>
                    <th>Status</th>
                </tr>
                ${tests
                  .map(
                    (test) => `
                    <tr>
                        <td>${test.fileName}</td>
                        <td>${test.numPassingTests}</td>
                        <td>${test.numFailingTests}</td>
                        <td>${(
                          (test.perfStats?.end - test.perfStats?.start || 0) /
                          1000
                        ).toFixed(2)}s</td>
                        <td>${
                          test.numFailingTests === 0 ? '✅ PASSED' : '❌ FAILED'
                        }</td>
                    </tr>
                `
                  )
                  .join('')}
            </table>
        </div>
      `;
      })
      .join('')}

</body>
</html>
  `;

  fs.writeFileSync(
    path.join(
      reportDir,
      `rbac-test-report-${timestamp.replace(/[:.]/g, '-')}.html`
    ),
    html
  );
}
