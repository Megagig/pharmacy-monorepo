import { test, expect } from '@playwright/test';

test.describe('E2E Setup Verification', () => {
    test('should verify basic setup is working', async ({ page }) => {
        // This is a simple test to verify the E2E setup is working
        console.log('🔍 Verifying E2E test setup...');

        // Navigate to the application
        await page.goto('/');

        // Check if the page loads
        await expect(page).toHaveTitle(/Pharmaceutical Care|Vite/);

        console.log('✅ E2E setup verification passed!');
    });

    test('should verify test framework is working', async ({ page }) => {
        console.log('🔍 Verifying test framework...');

        // Simple test to verify Playwright is working
        await page.setContent('<h1>Test Page</h1>');
        await expect(page.locator('h1')).toHaveText('Test Page');

        console.log('✅ Test framework verification passed!');
    });
});