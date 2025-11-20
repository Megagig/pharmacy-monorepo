#!/usr/bin/env ts-node

/**
 * Clinical Intervention Test Runner
 * 
 * This script runs all Clinical Intervention tests in a specific order
 * and provides comprehensive reporting on test results.
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    output: string;
    error?: string;
}

interface TestSuite {
    name: string;
    tests: TestResult[];
    totalDuration: number;
    passedCount: number;
    failedCount: number;
}

class ClinicalInterventionTestRunner {
    private results: TestSuite[] = [];

    async runAllTests(): Promise<void> {
        console.log('🧪 Starting Clinical Intervention Test Suite');
        console.log('='.repeat(60));

        // Define test suites in order of execution
        const testSuites = [
            {
                name: 'Unit Tests - Models',
                pattern: '__tests__/models/ClinicalIntervention*.test.ts'
            },
            {
                name: 'Unit Tests - Services',
                pattern: '__tests__/services/clinicalInterventionService*.test.ts'
            },
            {
                name: 'Unit Tests - Controllers',
                pattern: '__tests__/controllers/clinicalInterventionController*.test.ts'
            },
            {
                name: 'Unit Tests - Validators',
                pattern: '__tests__/validators/clinicalInterventionValidators*.test.ts'
            },
            {
                name: 'Unit Tests - Middlewares',
                pattern: '__tests__/middlewares/clinicalInterventionErrorHandler*.test.ts'
            },
            {
                name: 'Integration Tests',
                pattern: '__tests__/integration/clinicalInterventionIntegration*.test.ts'
            },
            {
                name: 'Database Tests',
                pattern: '__tests__/database/clinicalInterventionDatabase*.test.ts'
            },
            {
                name: 'Performance Tests',
                pattern: '__tests__/performance/clinicalInterventionPerformance*.test.ts'
            }
        ];

        // Run each test suite
        for (const suite of testSuites) {
            await this.runTestSuite(suite.name, suite.pattern);
        }

        // Generate final report
        this.generateReport();
    }

    private async runTestSuite(suiteName: string, pattern: string): Promise<void> {
        console.log(`\n📋 Running ${suiteName}...`);

        const startTime = performance.now();
        const tests: TestResult[] = [];

        try {
            // Run Jest with specific pattern
            const command = `npx jest --testPathPattern="${pattern}" --verbose --coverage=false --silent`;
            const output = execSync(command, {
                encoding: 'utf8',
                cwd: process.cwd(),
                timeout: 300000 // 5 minutes timeout
            });

            // Parse Jest output to extract individual test results
            const testResults = this.parseJestOutput(output);
            tests.push(...testResults);

            console.log(`✅ ${suiteName} completed successfully`);

        } catch (error: any) {
            console.log(`❌ ${suiteName} failed`);

            // Parse error output for failed tests
            const failedTests = this.parseJestOutput(error.stdout || error.message);
            tests.push(...failedTests);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        const suite: TestSuite = {
            name: suiteName,
            tests,
            totalDuration: duration,
            passedCount: tests.filter(t => t.passed).length,
            failedCount: tests.filter(t => !t.passed).length
        };

        this.results.push(suite);
    }

    private parseJestOutput(output: string): TestResult[] {
        const tests: TestResult[] = [];
        const lines = output.split('\n');

        let currentTest = '';
        let testPassed = false;
        let testOutput = '';

        for (const line of lines) {
            // Match test descriptions
            if (line.includes('✓') || line.includes('✗')) {
                if (currentTest) {
                    tests.push({
                        name: currentTest,
                        passed: testPassed,
                        duration: 0, // Jest doesn't provide individual test durations easily
                        output: testOutput
                    });
                }

                currentTest = line.trim();
                testPassed = line.includes('✓');
                testOutput = '';
            } else if (currentTest) {
                testOutput += line + '\n';
            }
        }

        // Add the last test
        if (currentTest) {
            tests.push({
                name: currentTest,
                passed: testPassed,
                duration: 0,
                output: testOutput
            });
        }

        return tests;
    }

    private generateReport(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 CLINICAL INTERVENTION TEST REPORT');
        console.log('='.repeat(60));

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;

        // Suite-by-suite breakdown
        for (const suite of this.results) {
            console.log(`\n📁 ${suite.name}`);
            console.log(`   Tests: ${suite.tests.length}`);
            console.log(`   Passed: ${suite.passedCount}`);
            console.log(`   Failed: ${suite.failedCount}`);
            console.log(`   Duration: ${(suite.totalDuration / 1000).toFixed(2)}s`);

            if (suite.failedCount > 0) {
                console.log('   ❌ Failed Tests:');
                suite.tests
                    .filter(t => !t.passed)
                    .forEach(test => {
                        console.log(`      - ${test.name}`);
                    });
            }

            totalTests += suite.tests.length;
            totalPassed += suite.passedCount;
            totalFailed += suite.failedCount;
            totalDuration += suite.totalDuration;
        }

        // Overall summary
        console.log('\n' + '-'.repeat(60));
        console.log('📈 OVERALL SUMMARY');
        console.log('-'.repeat(60));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
        console.log(`Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
        console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

        // Test coverage summary
        this.generateCoverageSummary();

        // Quality metrics
        this.generateQualityMetrics();

        // Exit with appropriate code
        if (totalFailed > 0) {
            console.log('\n❌ Some tests failed. Please review and fix failing tests.');
            process.exit(1);
        } else {
            console.log('\n✅ All tests passed successfully!');
            process.exit(0);
        }
    }

    private generateCoverageSummary(): void {
        console.log('\n📊 COVERAGE SUMMARY');
        console.log('-'.repeat(30));

        try {
            // Run coverage report
            const coverageOutput = execSync(
                'npx jest --testPathPattern="__tests__.*clinicalIntervention.*" --coverage --coverageReporters=text-summary --silent',
                { encoding: 'utf8', cwd: process.cwd() }
            );

            // Extract coverage percentages
            const coverageLines = coverageOutput.split('\n');
            const summaryLine = coverageLines.find(line => line.includes('All files'));

            if (summaryLine) {
                console.log(summaryLine);
            } else {
                console.log('Coverage data not available');
            }

        } catch (error) {
            console.log('Could not generate coverage summary');
        }
    }

    private generateQualityMetrics(): void {
        console.log('\n🎯 QUALITY METRICS');
        console.log('-'.repeat(30));

        const totalTests = this.results.reduce((sum, suite) => sum + suite.tests.length, 0);
        const totalDuration = this.results.reduce((sum, suite) => sum + suite.totalDuration, 0);
        const avgTestDuration = totalDuration / totalTests;

        console.log(`Average Test Duration: ${(avgTestDuration / 1000).toFixed(3)}s`);

        // Performance benchmarks
        if (avgTestDuration > 5000) {
            console.log('⚠️  Warning: Tests are running slowly (>5s average)');
        } else if (avgTestDuration < 100) {
            console.log('🚀 Excellent: Tests are running very fast (<100ms average)');
        } else {
            console.log('✅ Good: Test performance is acceptable');
        }

        // Test distribution
        console.log('\n📊 Test Distribution:');
        this.results.forEach(suite => {
            const percentage = ((suite.tests.length / totalTests) * 100).toFixed(1);
            console.log(`   ${suite.name}: ${suite.tests.length} tests (${percentage}%)`);
        });
    }

    async runSpecificTest(testPattern: string): Promise<void> {
        console.log(`🧪 Running specific test: ${testPattern}`);

        try {
            const command = `npx jest --testPathPattern="${testPattern}" --verbose`;
            const output = execSync(command, {
                encoding: 'utf8',
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log('✅ Test completed successfully');
        } catch (error) {
            console.log('❌ Test failed');
            process.exit(1);
        }
    }

    async runWithWatch(): Promise<void> {
        console.log('🔍 Running tests in watch mode...');

        try {
            const command = 'npx jest --testPathPattern="__tests__.*clinicalIntervention.*" --watch';
            execSync(command, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.log('Watch mode interrupted');
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new ClinicalInterventionTestRunner();

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Clinical Intervention Test Runner

Usage:
  npm run test:ci                    # Run all tests
  npm run test:ci -- --watch        # Run in watch mode
  npm run test:ci -- --test <pattern>  # Run specific test pattern

Options:
  --help, -h     Show this help message
  --watch        Run tests in watch mode
  --test         Run specific test pattern

Examples:
  npm run test:ci -- --test "models"
  npm run test:ci -- --test "ClinicalIntervention.test"
  npm run test:ci -- --watch
        `);
        return;
    }

    if (args.includes('--watch')) {
        await runner.runWithWatch();
    } else if (args.includes('--test')) {
        const testIndex = args.indexOf('--test');
        const testPattern = args[testIndex + 1];
        if (!testPattern) {
            console.error('❌ Please provide a test pattern after --test');
            process.exit(1);
        }
        await runner.runSpecificTest(testPattern);
    } else {
        await runner.runAllTests();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

export default ClinicalInterventionTestRunner;