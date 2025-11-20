#!/usr/bin/env node

/**
 * Test runner for Reports & Analytics module
 * Runs all test suites and generates coverage reports
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const testDir = path.resolve(__dirname);
const rootDir = path.resolve(__dirname, '../../../..');

interface TestSuite {
    name: string;
    pattern: string;
    description: string;
}

const testSuites: TestSuite[] = [
    {
        name: 'Unit Tests',
        pattern: '**/*.test.{ts,tsx}',
        description: 'Component and utility unit tests',
    },
    {
        name: 'Integration Tests',
        pattern: '**/*.integration.test.{ts,tsx}',
        description: 'Store and service integration tests',
    },
    {
        name: 'Snapshot Tests',
        pattern: '**/*.snapshot.test.{ts,tsx}',
        description: 'Component snapshot tests',
    },
    {
        name: 'Accessibility Tests',
        pattern: '**/accessibility/*.test.{ts,tsx}',
        description: 'Accessibility compliance tests',
    },
    {
        name: 'Performance Tests',
        pattern: '**/performance/*.test.{ts,tsx}',
        description: 'Performance and optimization tests',
    },
];

async function runTestSuite(suite: TestSuite): Promise<boolean> {
    console.log(`\n🧪 Running ${suite.name}...`);
    console.log(`📝 ${suite.description}`);

    try {
        const command = `npx vitest run --config ${testDir}/vitest.config.ts "${suite.pattern}"`;
        execSync(command, {
            cwd: rootDir,
            stdio: 'inherit',
        });

        console.log(`✅ ${suite.name} passed`);
        return true;
    } catch (error) {
        console.error(`❌ ${suite.name} failed`);
        return false;
    }
}

async function generateCoverageReport(): Promise<void> {
    console.log('\n📊 Generating coverage report...');

    try {
        const command = `npx vitest run --coverage --config ${testDir}/vitest.config.ts`;
        execSync(command, {
            cwd: rootDir,
            stdio: 'inherit',
        });

        console.log('✅ Coverage report generated');
    } catch (error) {
        console.error('❌ Coverage report generation failed');
    }
}

async function runAllTests(): Promise<void> {
    console.log('🚀 Starting Reports & Analytics Module Test Suite');
    console.log('='.repeat(60));

    const results: boolean[] = [];

    // Run each test suite
    for (const suite of testSuites) {
        const result = await runTestSuite(suite);
        results.push(result);
    }

    // Generate coverage report
    await generateCoverageReport();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Results Summary');
    console.log('='.repeat(60));

    testSuites.forEach((suite, index) => {
        const status = results[index] ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${suite.name}`);
    });

    const passedCount = results.filter(Boolean).length;
    const totalCount = results.length;

    console.log(`\n📊 Overall: ${passedCount}/${totalCount} test suites passed`);

    if (passedCount === totalCount) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed');
        process.exit(1);
    }
}

// Check if running specific test suite
const args = process.argv.slice(2);
if (args.length > 0) {
    const suiteName = args[0];
    const suite = testSuites.find(s => s.name.toLowerCase().includes(suiteName.toLowerCase()));

    if (suite) {
        runTestSuite(suite).then(success => {
            process.exit(success ? 0 : 1);
        });
    } else {
        console.error(`❌ Test suite "${suiteName}" not found`);
        console.log('Available test suites:');
        testSuites.forEach(s => console.log(`  - ${s.name}`));
        process.exit(1);
    }
} else {
    runAllTests();
}

export { runTestSuite, generateCoverageReport, testSuites };