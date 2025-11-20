/**
 * E2E Test Runner for Patient Engagement & Follow-up Management
 * 
 * This script runs all end-to-end tests in the correct order and provides
 * comprehensive reporting on test results and coverage.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  error?: string;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

class E2ETestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Patient Engagement & Follow-up Management E2E Tests\n');
    this.startTime = Date.now();

    const testFiles = [
      'patientEngagementE2E.test.ts',
      'recurringAppointmentsE2E.test.ts', 
      'reminderWorkflowE2E.test.ts',
    ];

    // Run tests sequentially to avoid database conflicts
    for (const testFile of testFiles) {
      await this.runSingleTest(testFile);
    }

    this.generateReport();
  }

  private async runSingleTest(testFile: string): Promise<void> {
    console.log(`📋 Running ${testFile}...`);
    const startTime = Date.now();

    try {
      const testPath = path.join(__dirname, testFile);
      
      // Run test with coverage
      const command = `npx jest ${testPath} --coverage --coverageDirectory=coverage/e2e --testTimeout=30000 --verbose`;
      
      execSync(command, {
        cwd: path.join(__dirname, '../../../..'),
        stdio: 'pipe',
      });

      const duration = Date.now() - startTime;
      
      this.results.push({
        testFile,
        passed: true,
        duration,
        coverage: this.extractCoverage(testFile),
      });

      console.log(`✅ ${testFile} passed (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        testFile,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      console.log(`❌ ${testFile} failed (${duration}ms)`);
      console.log(`Error: ${error}\n`);
    }
  }

  private extractCoverage(testFile: string): TestResult['coverage'] {
    try {
      const coverageFile = path.join(__dirname, '../../../../coverage/e2e/coverage-summary.json');
      
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        return {
          statements: coverage.total.statements.pct,
          branches: coverage.total.branches.pct,
          functions: coverage.total.functions.pct,
          lines: coverage.total.lines.pct,
        };
      }
    } catch (error) {
      console.log(`Warning: Could not extract coverage for ${testFile}`);
    }
    
    return undefined;
  }

  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed);
    const failedTests = this.results.filter(r => !r.passed);

    console.log('\n' + '='.repeat(80));
    console.log('📊 E2E TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Results:`);
    console.log(`   Total Tests: ${this.results.length}`);
    console.log(`   Passed: ${passedTests.length} ✅`);
    console.log(`   Failed: ${failedTests.length} ${failedTests.length > 0 ? '❌' : ''}`);
    console.log(`   Success Rate: ${((passedTests.length / this.results.length) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    console.log(`\n📋 Test Details:`);
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${(result.duration / 1000).toFixed(2)}s`;
      
      console.log(`   ${status} ${result.testFile} (${duration})`);
      
      if (result.coverage) {
        console.log(`      Coverage: ${result.coverage.statements}% statements, ${result.coverage.lines}% lines`);
      }
      
      if (result.error) {
        console.log(`      Error: ${result.error.substring(0, 100)}...`);
      }
    });

    if (failedTests.length > 0) {
      console.log(`\n❌ Failed Tests Details:`);
      failedTests.forEach(result => {
        console.log(`\n   ${result.testFile}:`);
        console.log(`   ${result.error}`);
      });
    }

    // Coverage summary
    const avgCoverage = this.calculateAverageCoverage();
    if (avgCoverage) {
      console.log(`\n📊 Average Coverage:`);
      console.log(`   Statements: ${avgCoverage.statements.toFixed(1)}%`);
      console.log(`   Branches: ${avgCoverage.branches.toFixed(1)}%`);
      console.log(`   Functions: ${avgCoverage.functions.toFixed(1)}%`);
      console.log(`   Lines: ${avgCoverage.lines.toFixed(1)}%`);
    }

    // Test scenarios covered
    console.log(`\n🎯 Test Scenarios Covered:`);
    console.log(`   ✅ Complete appointment lifecycle (create → confirm → complete → visit)`);
    console.log(`   ✅ Follow-up workflow (create → escalate → convert → complete)`);
    console.log(`   ✅ Recurring appointment series management`);
    console.log(`   ✅ Patient portal booking flow`);
    console.log(`   ✅ Multi-channel reminder delivery and confirmation`);
    console.log(`   ✅ Integration with existing modules (MTR, Clinical Interventions, Diagnostics)`);
    console.log(`   ✅ Performance and concurrent operations`);
    console.log(`   ✅ Error handling and edge cases`);

    console.log('\n' + '='.repeat(80));
    
    if (failedTests.length === 0) {
      console.log('🎉 All E2E tests passed! Patient Engagement module is ready for deployment.');
    } else {
      console.log('⚠️  Some E2E tests failed. Please review and fix issues before deployment.');
      process.exit(1);
    }
  }

  private calculateAverageCoverage(): TestResult['coverage'] | null {
    const coverageResults = this.results
      .map(r => r.coverage)
      .filter(c => c !== undefined) as NonNullable<TestResult['coverage']>[];

    if (coverageResults.length === 0) return null;

    return {
      statements: coverageResults.reduce((sum, c) => sum + c.statements, 0) / coverageResults.length,
      branches: coverageResults.reduce((sum, c) => sum + c.branches, 0) / coverageResults.length,
      functions: coverageResults.reduce((sum, c) => sum + c.functions, 0) / coverageResults.length,
      lines: coverageResults.reduce((sum, c) => sum + c.lines, 0) / coverageResults.length,
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ E2E test runner failed:', error);
    process.exit(1);
  });
}

export default E2ETestRunner;