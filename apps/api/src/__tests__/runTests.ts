#!/usr/bin/env ts-node

/**
 * Test Runner Script for MTR Backend Tests
 * 
 * This script provides a convenient way to run different types of tests
 * with proper setup and teardown.
 */

import { execSync } from 'child_process';
import path from 'path';

const testTypes = {
    unit: 'src/__tests__/models src/__tests__/services src/__tests__/validators',
    integration: 'src/__tests__/integration',
    controllers: 'src/__tests__/controllers',
    all: 'src/__tests__'
};

function runTests(type: keyof typeof testTypes = 'all', options: string[] = []) {
    const testPath = testTypes[type];
    const jestOptions = [
        '--config=jest.config.js',
        '--testPathPattern=' + testPath,
        ...options
    ].join(' ');

    console.log(`🧪 Running ${type} tests...`);
    console.log(`📁 Test path: ${testPath}`);
    console.log(`⚙️  Jest options: ${jestOptions}`);
    console.log('');

    try {
        execSync(`npx jest ${jestOptions}`, {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '../..')
        });

        console.log('');
        console.log(`✅ ${type} tests completed successfully!`);
    } catch (error) {
        console.log('');
        console.log(`❌ ${type} tests failed!`);
        process.exit(1);
    }
}

function showHelp() {
    console.log('MTR Backend Test Runner');
    console.log('');
    console.log('Usage: npm run test:mtr [type] [options]');
    console.log('');
    console.log('Test Types:');
    console.log('  unit         Run unit tests (models, services, validators)');
    console.log('  integration  Run integration tests');
    console.log('  controllers  Run controller tests');
    console.log('  all          Run all tests (default)');
    console.log('');
    console.log('Options:');
    console.log('  --watch      Run tests in watch mode');
    console.log('  --coverage   Generate coverage report');
    console.log('  --verbose    Show detailed test output');
    console.log('  --help       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm run test:mtr unit');
    console.log('  npm run test:mtr integration --coverage');
    console.log('  npm run test:mtr all --watch');
}

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args.find(arg => !arg.startsWith('--')) as keyof typeof testTypes || 'all';
const options = args.filter(arg => arg.startsWith('--'));

if (options.includes('--help')) {
    showHelp();
    process.exit(0);
}

// Validate test type
if (!testTypes[testType]) {
    console.error(`❌ Invalid test type: ${testType}`);
    console.error(`Valid types: ${Object.keys(testTypes).join(', ')}`);
    process.exit(1);
}

// Run tests
runTests(testType, options);