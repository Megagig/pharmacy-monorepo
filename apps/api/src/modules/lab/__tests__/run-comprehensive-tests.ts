#!/usr/bin/env ts-node

/**
 * Comprehensive Test Runner for Manual Lab Module
 * 
 * This script runs all comprehensive tests for the manual lab order workflow
 * including unit tests, integration tests, and end-to-end workflow tests.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestSuite {
    name: string;
    file: string;
    description: string;
    timeout?: number;
}

const testSuites: TestSuite[] = [
    {
        name: 'Unit Tests - Models',
        file: 'comprehensive-models.test.ts',
        description: 'Tests for ManualLabOrder, ManualLabResult, and TestCatalog models',
        timeout: 30000
    },
    {
        name: 'Unit Tests - Services',
        file: 'comprehensive-services.test.ts',
        description: 'Tests for ManualLabService and related business logic',
        timeout: 45000
    },
    {
        name: 'Unit Tests - Token Service',
        file: 'comprehensive-token-service.test.ts',
        description: 'Tests for TokenService security and functionality',
        timeout: 30000
    },
    {
        name: 'Integration Tests - API',
        file: 'comprehensive-api-integration.test.ts',
        description: 'Tests for API endpoints with authentication and validation',
        timeout: 60000
    },
    {
        name: 'End-to-End Tests - Workflow',
        file: 'comprehensive-e2e-workflow.test.ts',
        description: 'Complete workflow tests from order creation to AI interpretation',
        timeout: 120000
    }
];

interface TestResult {
    suite: string;
    passed: boolean;
    duration: number;
    output: string;
    error?: string;
}

class TestRunner {
    private results: TestResult[] = [];
    private startTime: number = 0;

    constructor() {
        this.startTime = Date.now();
    }

    async runAllTests(): Promise<void> {
        console.log('🧪 Manual Lab Module - Comprehensive Test Suite');
        console.log('='.repeat(60));
        console.log(`Starting comprehensive tests at ${new Date().toISOString()}`);
        console.log(`Test suites to run: ${testSuites.length}`);
        console.log('');

        for (const suite of testSuites) {
            await this.runTestSuite(suite);
        }

        this.printSummary();
    }

    private async runTestSuite(suite: TestSuite): Promise<void> {
        console.log(`📋 Running: ${suite.name}`);
        console.log(`   Description: ${suite.description}`);
        console.log(`   File: ${suite.file}`);

        const startTime = Date.now();
        let result: TestResult;

        try {
            const testFilePath = path.join(__dirname, suite.file);

            // Check if test file exists
            if (!fs.existsSync(testFilePath)) {
                throw new Error(`Test file not found: ${testFilePath}`);
            }

            // Run the test with Jest
            const jestCommand = [
                'npx jest',
                `"${testFilePath}"`,
                '--verbose',
                '--no-cache',
                '--detectOpenHandles',
                '--forceExit',
                suite.timeout ? `--testTimeout=${suite.timeout}` : '--testTimeout=30000'
            ].join(' ');

            const output = execSync(jestCommand, {
                cwd: path.join(__dirname, '../../../..'),
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const duration = Date.now() - startTime;
            result = {
                suite: suite.name,
                passed: true,
                duration,
                output
            };

            console.log(`   ✅ PASSED (${duration}ms)`);

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            result = {
                suite: suite.name,
                passed: false,
                duration,
                output: '',
                error: errorMessage
            };

            console.log(`   ❌ FAILED (${duration}ms)`);
            console.log(`   Error: ${errorMessage.split('\n')[0]}`);
        }

        this.results.push(result);
        console.log('');
    }

    private printSummary(): void {
        const totalDuration = Date.now() - this.startTime;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = this.results.filter(r => !r.passed).length;

        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`Total test suites: ${this.results.length}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
        console.log('');

        if (failedTests > 0) {
            console.log('❌ Failed Test Suites:');
            this.results
                .filter(r => !r.passed)
                .forEach(result => {
                    console.log(`   - ${result.suite}`);
                    if (result.error) {
                        console.log(`     Error: ${result.error.split('\n')[0]}`);
                    }
                });
            console.log('');
        }

        if (passedTests > 0) {
            console.log('✅ Passed Test Suites:');
            this.results
                .filter(r => r.passed)
                .forEach(result => {
                    console.log(`   - ${result.suite} (${result.duration}ms)`);
                });
            console.log('');
        }

        // Coverage summary
        console.log('📈 Coverage Information:');
        console.log('   Run with --coverage flag for detailed coverage report');
        console.log('   Target coverage: >90% statements, >85% branches');
        console.log('');

        // Exit with appropriate code
        if (failedTests > 0) {
            console.log('❌ Some tests failed. Please review the errors above.');
            process.exit(1);
        } else {
            console.log('🎉 All tests passed successfully!');
            process.exit(0);
        }
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch(error => {
        console.error('Fatal error running tests:', error);
        process.exit(1);
    });
}

export default TestRunner;