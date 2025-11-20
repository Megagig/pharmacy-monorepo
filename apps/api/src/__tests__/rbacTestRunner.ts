#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestSuite {
    name: string;
    path: string;
    type: 'unit' | 'integration' | 'performance' | 'security';
    timeout?: number;
}

const RBAC_TEST_SUITES: TestSuite[] = [
    // Unit Tests
    {
        name: 'DynamicPermissionService Unit Tests',
        path: 'src/__tests__/services/DynamicPermissionService.test.ts',
        type: 'unit',
        timeout: 30000
    },
    {
        name: 'RoleHierarchyService Unit Tests',
        path: 'src/__tests__/services/RoleHierarchyService.test.ts',
        type: 'unit',
        timeout: 30000
    },
    {
        name: 'CacheManager Unit Tests',
        path: 'src/__tests__/services/CacheManager.test.ts',
        type: 'unit',
        timeout: 30000
    },
    {
        name: 'RBAC Migration Unit Tests',
        path: 'src/__tests__/migrations/rbacMigration.test.ts',
        type: 'unit',
        timeout: 30000
    },

    // Integration Tests
    {
        name: 'RBAC Workflows Integration Tests',
        path: 'src/__tests__/integration/rbacWorkflows.test.ts',
        type: 'integration',
        timeout: 60000
    },

    // Performance Tests
    {
        name: 'RBAC Performance Tests',
        path: 'src/__tests__/performance/rbacPerformance.test.ts',
        type: 'performance',
        timeout: 120000
    },

    // Security Tests
    {
        name: 'RBAC Security Tests',
        path: 'src/__tests__/security/rbacSecurity.test.ts',
        type: 'security',
        timeout: 90000
    }
];

class RBACTestRunner {
    private results: Map<string, { passed: boolean; duration: number; error?: string }> = new Map();

    async runAllTests(): Promise<void> {
        console.log('🚀 Starting RBAC Test Suite Execution\n');
        console.log('='.repeat(60));

        for (const suite of RBAC_TEST_SUITES) {
            await this.runTestSuite(suite);
        }

        this.printSummary();
    }

    async runTestsByType(type: TestSuite['type']): Promise<void> {
        const filteredSuites = RBAC_TEST_SUITES.filter(suite => suite.type === type);

        console.log(`🎯 Running ${type.toUpperCase()} tests\n`);
        console.log('='.repeat(60));

        for (const suite of filteredSuites) {
            await this.runTestSuite(suite);
        }

        this.printSummary();
    }

    private async runTestSuite(suite: TestSuite): Promise<void> {
        console.log(`\n📋 Running: ${suite.name}`);
        console.log(`   Type: ${suite.type.toUpperCase()}`);
        console.log(`   Path: ${suite.path}`);
        console.log('-'.repeat(50));

        const startTime = Date.now();

        try {
            // Check if test file exists
            const testPath = path.join(process.cwd(), suite.path);
            if (!fs.existsSync(testPath)) {
                throw new Error(`Test file not found: ${testPath}`);
            }

            // Run the test suite
            const command = this.buildTestCommand(suite);
            execSync(command, {
                stdio: 'inherit',
                timeout: suite.timeout || 60000,
                cwd: process.cwd()
            });

            const duration = Date.now() - startTime;
            this.results.set(suite.name, { passed: true, duration });

            console.log(`✅ PASSED (${duration}ms)`);

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.results.set(suite.name, { passed: false, duration, error: errorMessage });

            console.log(`❌ FAILED (${duration}ms)`);
            console.log(`   Error: ${errorMessage}`);
        }
    }

    private buildTestCommand(suite: TestSuite): string {
        const baseCommand = 'npx jest';
        const testFile = suite.path;
        const timeout = suite.timeout || 60000;

        let command = `${baseCommand} "${testFile}" --testTimeout=${timeout}`;

        // Add specific configurations based on test type
        switch (suite.type) {
            case 'unit':
                command += ' --coverage --coverageDirectory=coverage/unit';
                break;
            case 'integration':
                command += ' --runInBand --detectOpenHandles';
                break;
            case 'performance':
                command += ' --runInBand --detectOpenHandles --verbose';
                break;
            case 'security':
                command += ' --runInBand --detectOpenHandles --verbose';
                break;
        }

        return command;
    }

    private printSummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST EXECUTION SUMMARY');
        console.log('='.repeat(60));

        const totalTests = this.results.size;
        const passedTests = Array.from(this.results.values()).filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const totalDuration = Array.from(this.results.values()).reduce((sum, r) => sum + r.duration, 0);

        console.log(`\n📈 Overall Results:`);
        console.log(`   Total Test Suites: ${totalTests}`);
        console.log(`   Passed: ${passedTests} ✅`);
        console.log(`   Failed: ${failedTests} ❌`);
        console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

        console.log(`\n📋 Detailed Results:`);
        for (const [name, result] of this.results.entries()) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            const duration = `(${result.duration}ms)`;
            console.log(`   ${status} ${name} ${duration}`);

            if (!result.passed && result.error) {
                console.log(`      Error: ${result.error}`);
            }
        }

        if (failedTests > 0) {
            console.log(`\n⚠️  ${failedTests} test suite(s) failed. Please review the errors above.`);
            process.exit(1);
        } else {
            console.log(`\n🎉 All test suites passed successfully!`);
        }
    }

    async runCoverageReport(): Promise<void> {
        console.log('\n📊 Generating Coverage Report...');

        try {
            execSync('npx jest --coverage --coverageDirectory=coverage/rbac --testPathPattern="__tests__/(services|integration|migrations)/"', {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log('✅ Coverage report generated in coverage/rbac/');
        } catch (error) {
            console.log('❌ Failed to generate coverage report');
            console.error(error);
        }
    }
}

// CLI Interface
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const runner = new RBACTestRunner();

    if (args.length === 0) {
        await runner.runAllTests();
        return;
    }

    const command = args[0];

    switch (command) {
        case 'unit':
            await runner.runTestsByType('unit');
            break;
        case 'integration':
            await runner.runTestsByType('integration');
            break;
        case 'performance':
            await runner.runTestsByType('performance');
            break;
        case 'security':
            await runner.runTestsByType('security');
            break;
        case 'coverage':
            await runner.runCoverageReport();
            break;
        case 'help':
            printHelp();
            break;
        default:
            console.log(`❌ Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}

function printHelp(): void {
    console.log(`
🧪 RBAC Test Runner

Usage: npm run test:rbac [command]

Commands:
  (no args)    Run all RBAC test suites
  unit         Run only unit tests
  integration  Run only integration tests
  performance  Run only performance tests
  security     Run only security tests
  coverage     Generate coverage report
  help         Show this help message

Examples:
  npm run test:rbac                 # Run all tests
  npm run test:rbac unit           # Run unit tests only
  npm run test:rbac performance    # Run performance tests only
  npm run test:rbac coverage       # Generate coverage report
`);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

export default RBACTestRunner;