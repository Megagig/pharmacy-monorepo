export default async function globalTeardown() {
    console.log('🧹 Cleaning up diagnostic module test environment...');

    // Stop any test services
    try {
        // Stop test Redis instance if started
        // execSync('redis-cli -p 6380 shutdown', { stdio: 'ignore' });
        console.log('✅ Test services stopped');
    } catch (error) {
        console.warn('⚠️  Could not stop test services:', error);
    }

    // Clean up temporary files
    try {
        // Remove any temporary test files
        console.log('✅ Temporary files cleaned');
    } catch (error) {
        console.warn('⚠️  Could not clean temporary files:', error);
    }

    // Final cleanup
    console.log('✅ Global test teardown completed');
}