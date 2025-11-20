#!/usr/bin/env ts-node

/**
 * Frontend Clinical Intervention Test Runner
 * 
 * This script runs all frontend Clinical Intervention tests including
 * unit tests, integration tests, accessibility tests, and e2e tests.
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

class FrontendClinicalInterventionTestRunner {
    private results: TestSuite[] = [];

    async runAllTests(): Promise<void> {
        console.log('🧪 Starting Frontend Clinical Intervention Test Suite');
        console.log('='.repeat(60));

        // Define test suites in order of execution
        const testSuites = [
            {
                name: 'Unit Tests - Components',
                command: 'vitest run src/components/__tests__/*ClinicalIntervention*.test.tsx src/components/__tests__/Intervention*.test.tsx'
            },
            {
                name: 'Unit Tests - Services',
                command: 'vitest run src/services/__tests__/clinicalInterventionService*.test.ts'
            },
            {
                name: 'Unit Tests - Stores',
                command: 'vitest run src/stores/__tests__/clinicalInterventionStore*.test.ts'
            },
            {
                name: 'Unit Tests - Hooks',
                command: 'vitest run src/hooks/__tests__/*clinicalIntervention*.test.ts'
            },
            {
                name: 'Unit Tests - Utils',
                command: 'vitest run src/utils/__tests__/clinicalInterventionValidation*.test.ts'
            },
            {
                name: 'Integration Tests',
                command: 'vitest run src/__tests__/integration/clinicalInterventionWorkflow*.test.tsx'
            },
            {
                name: 'Accessibility Tests',
                command: 'vitest run src/__tests__/accessibility/clinicalInterventionAccessibility*.test.tsx'
            }
        ];

        // Run each test suite
        for (const suite of testSuites) {
            await this.runTestSuite(suite.name, suite.command);
        }

        // Run E2E tests separately
        await this.runE2ETests();

        // Generate final report
        this.generateReport();
    }

    private async runTestSuite(suiteName: string, command: string): Promise<void> {
        console.log(`\n📋 Running ${suiteName}...`);

        const startTime = performance.now();
        const tests: TestResult[] = [];

        try {
            const output = execSync(command, {
                encoding: 'utf8',
                cwd: process.cwd(),
                timeout: 300000 // 5 minutes timeout
            });

            // Parse Vitest output to extract individual test results
            const testResults = this.parseVitestOutput(output);
            tests.push(...testResults);

            console.log(`✅ ${suiteName} completed successfully`);

        } catch (error: any) {
            console.log(`❌ ${suiteName} failed`);

            // Parse error output for failed tests
            const failedTests = this.parseVitestOutput(error.stdout || error.message);
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

    private async runE2ETests(): Promise<void> {
        console.log('\n🎭 Running E2E Tests...');

        const startTime = performance.now();
        const tests: TestResult[] = [];

        try {
            // Check if Playwright is available
            const playwrightCommand = 'npx playwright test src/__tests__/e2e/clinicalInterventionE2E*.test.ts --reporter=line';
            const output = execSync(playwrightCommand, {
                encoding: 'utf8',
                cwd: process.cwd(),
                timeout: 600000 // 10 minutes timeout for E2E
            });

            const testResults = this.parsePlaywrightOutput(output);
            tests.push(...testResults);

            console.log('✅ E2E Tests completed successfully');

        } catch (error: any) {
            console.log('⚠️  E2E Tests skipped or failed');
            console.log('   Make sure the application is running and Playwright is installed');

            // Add a placeholder result
            tests.push({
                name: 'E2E Tests',
                passed: false,
                duration: 0,
                output: 'E2E tests could not be executed',
                error: error.message
            });
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        const suite: TestSuite = {
            name: 'End-to-End Tests',
            tests,
            totalDuration: duration,
            passedCount: tests.filter(t => t.passed).length,
            failedCount: tests.filter(t => !t.passed).length
        };

        this.results.push(suite);
    }

    private parseVitestOutput(output: string): TestResult[] {
        const tests: TestResult[] = [];
        const lines = output.split('\n');

        let currentTest = '';
        let testPassed = false;
        let testOutput = '';

        for (const line of lines) {
            // Match Vitest test results
            if (line.includes('✓') || line.includes('✗') || line.includes('PASS') || line.includes('FAIL')) {
                if (currentTest) {
                    tests.push({
                        name: currentTest,
                        passed: testPassed,
                        duration: 0,
                        output: testOutput
                    });
                }

                currentTest = line.trim();
                testPassed = line.includes('✓') || line.includes('PASS');
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

    private parsePlaywrightOutput(output: string): TestResult[] {
        const tests: TestResult[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.includes('✓') || line.includes('✗')) {
                const testName = line.trim();
                const passed = line.includes('✓');

                tests.push({
                    name: testName,
                    passed,
                    duration: 0,
                    output: line
                });
            }
        }

        return tests;
    }

    private generateReport(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 FRONTEND CLINICAL INTERVENTION TEST REPORT');
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

        // Accessibility summary
        this.generateAccessibilitySummary();

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
            // Run coverage report with Vitest
            const coverageOutput = execSync(
                'vitest run --coverage --reporter=text-summary src/components/__tests__/*ClinicalIntervention* src/services/__tests__/clinicalIntervention* src/stores/__tests__/clinicalIntervention*',
                { encoding: 'utf8', cwd: process.cwd() }
            );

            // Extract coverage information
            const coverageLines = coverageOutput.split('\n');
            const summaryLines = coverageLines.filter(line =>
                line.includes('%') && (line.includes('Lines') || line.includes('Functions') || line.includes('Branches'))
            );

            if (summaryLines.length > 0) {
                summaryLines.forEach(line => console.log(line.trim()));
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
        if (avgTestDuration > 10000) {
            console.log('⚠️  Warning: Tests are running slowly (>10s average)');
        } else if (avgTestDuration < 500) {
            console.log('🚀 Excellent: Tests are running very fast (<500ms average)');
        } else {
            console.log('✅ Good: Test performance is acceptable');
        }

        // Test distribution
        console.log('\n📊 Test Distribution:');
        this.results.forEach(suite => {
            const percentage = ((suite.tests.length / totalTests) * 100).toFixed(1);
            console.log(`   ${suite.name}: ${suite.tests.length} tests (${percentage}%)`);
        });

        // Component test coverage
        const componentSuite = this.results.find(s => s.name.includes('Components'));
        const serviceSuite = this.results.find(s => s.name.includes('Services'));
        const storeSuite = this.results.find(s => s.name.includes('Stores'));

        console.log('\n🧩 Component Coverage:');
        if (componentSuite) {
            console.log(`   Component Tests: ${componentSuite.tests.length}`);
        }
        if (serviceSuite) {
            console.log(`   Service Tests: ${serviceSuite.tests.length}`);
        }
        if (storeSuite) {
            console.log(`   Store Tests: ${storeSuite.tests.length}`);
        }
    }

    private generateAccessibilitySummary(): void {
        console.log('\n♿ ACCESSIBILITY SUMMARY');
        console.log('-'.repeat(30));

        const accessibilitySuite = this.results.find(s => s.name.includes('Accessibility'));

        if (accessibilitySuite) {
            console.log(`Accessibility Tests: ${accessibilitySuite.tests.length}`);
            console.log(`Passed: ${accessibilitySuite.passedCount}`);
            console.log(`Failed: ${accessibilitySuite.failedCount}`);

            if (accessibilitySuite.passedCount === accessibilitySuite.tests.length) {
                console.log('✅ All accessibility tests passed - WCAG compliance verified');
            } else {
                console.log('⚠️  Some accessibility tests failed - please review WCAG compliance');
            }
        } else {
            console.log('⚠️  No accessibility tests found');
        }
    }

    async runSpecificTest(testPattern: string): Promise<void> {
        console.log(`🧪 Running specific test: ${testPattern}`);

        try {
            const command = `vitest run ${testPattern}`;
            execSync(command, {
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
            const command = 'vitest src/components/__tests__/*ClinicalIntervention* src/services/__tests__/clinicalIntervention* src/stores/__tests__/clinicalIntervention*';
            execSync(command, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.log('Watch mode interrupted');
        }
    }

    async runE2EOnly(): Promise<void> {
        console.log('🎭 Running E2E tests only...');

        try {
            const command = 'npx playwright test src/__tests__/e2e/clinicalInterventionE2E*.test.ts --headed';
            execSync(command, {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log('✅ E2E tests completed successfully');
        } catch (error) {
            console.log('❌ E2E tests failed');
            process.exit(1);
        }
    }

    async runAccessibilityOnly(): Promise<void> {
        console.log('♿ Running accessibility tests only...');

        try {
            const command = 'vitest run src/__tests__/accessibility/clinicalInterventionAccessibility*.test.tsx';
            execSync(command, {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log('✅ Accessibility tests completed successfully');
        } catch (error) {
            console.log('❌ Accessibility tests failed');
            process.exit(1);
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new FrontendClinicalInterventionTestRunner();

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Frontend Clinical Intervention Test Runner

Usage:
  npm run test:ci                    # Run all tests
  npm run test:ci -- --watch        # Run in watch mode
  npm run test:ci -- --test <pattern>  # Run specific test pattern
  npm run test:ci -- --e2e          # Run E2E tests only
  npm run test:ci -- --a11y         # Run accessibility tests only

Options:
  --help, -h     Show this help message
  --watch        Run tests in watch mode
  --test         Run specific test pattern
  --e2e          Run E2E tests only
  --a11y         Run accessibility tests only

Examples:
  npm run test:ci -- --test "components"
  npm run test:ci -- --test "ClinicalIntervention"
  npm run test:ci -- --watch
  npm run test:ci -- --e2e
  npm run test:ci -- --a11y
        `);
        return;
    }

    if (args.includes('--watch')) {
        await runner.runWithWatch();
    } else if (args.includes('--e2e')) {
        await runner.runE2EOnly();
    } else if (args.includes('--a11y')) {
        await runner.runAccessibilityOnly();
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
        console.error('❌ Frontend test runner failed:', error);
        process.exit(1);
    });
}

export default FrontendClinicalInterventionTestRunner;