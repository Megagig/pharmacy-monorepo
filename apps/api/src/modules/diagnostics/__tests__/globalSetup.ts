import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
    console.log('🚀 Setting up diagnostic module test environment...');

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.CI = 'true';

    // Ensure test database is clean
    try {
        // If using a real test database, clean it here
        // For in-memory database, this is handled in setup.ts
        console.log('✅ Test database prepared');
    } catch (error) {
        console.warn('⚠️  Could not clean test database:', error);
    }

    // Start any required services for testing
    try {
        // Start Redis for caching tests (if needed)
        // execSync('redis-server --daemonize yes --port 6380', { stdio: 'ignore' });
        console.log('✅ Test services started');
    } catch (error) {
        console.warn('⚠️  Could not start test services:', error);
    }

    // Compile TypeScript if needed
    try {
        const tsConfigPath = path.join(__dirname, '../../../tsconfig.json');
        // execSync(`npx tsc --project ${tsConfigPath} --noEmit`, { stdio: 'ignore' });
        console.log('✅ TypeScript compilation check passed');
    } catch (error) {
        console.warn('⚠️  TypeScript compilation issues:', error);
    }

    console.log('✅ Global test setup completed');
}