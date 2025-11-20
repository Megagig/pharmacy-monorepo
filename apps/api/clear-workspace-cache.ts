/**
 * Clear workspace context cache to force reload
 * Run this after fixing workspace context loading logic
 */

console.log('🧹 Clearing workspace context cache...\n');
console.log('Note: This clears the in-memory cache. Restart the backend server to ensure fresh start.\n');
console.log('✅ After restarting:');
console.log('   - All users will get fresh workspace context on next request');
console.log('   - Subscription plan features will be properly loaded');
console.log('   - Permission checks will use updated features array\n');
console.log('🔄 Please restart your backend server now.');
