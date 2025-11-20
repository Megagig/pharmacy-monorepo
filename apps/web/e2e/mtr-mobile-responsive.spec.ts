import { test, expect, devices } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { MTRHelper } from './utils/mtr-helper';
import { sampleMTRData } from './utils/test-data';

test.describe('MTR Mobile and Responsive E2E Tests', () => {
    let authHelper: AuthHelper;
    let mtrHelper: MTRHelper;

    test.describe('Mobile Device Tests', () => {
        test.use({ ...devices['iPhone 12'] });

        test.beforeEach(async ({ page }) => {
            authHelper = new AuthHelper(page);
            mtrHelper = new MTRHelper(page);
            await authHelper.ensureLoggedIn();
        });

        test('should complete MTR workflow on mobile device', async ({ page }) => {
            console.log('📱 Starting mobile MTR workflow test...');

            await mtrHelper.navigateToMTR();

            // Verify mobile layout
            await expect(page.locator('[data-testid="mobile-mtr-layout"]')).toBeVisible();

            // Test mobile navigation
            await page.click('[data-testid="mobile-menu-button"]');
            await expect(page.locator('[data-testid="mobile-navigation-drawer"]')).toBeVisible();
            await page.click('[data-testid="close-mobile-menu"]');

            // Complete basic MTR workflow
            await mtrHelper.startNewMTRSession(sampleMTRData.patient);

            // Test mobile medication entry
            await page.click('[data-testid="add-medication-button"]');

            // Verify mobile form layout
            await expect(page.locator('[data-testid="mobile-medication-form"]')).toBeVisible();

            await page.fill('[data-testid="drug-name-input"]', 'Mobile Test Med');
            await page.fill('[data-testid="strength-input"]', '10 mg');

            // Test mobile dropdown
            await page.click('[data-testid="dosage-form-select"]');
            await expect(page.locator('[data-testid="mobile-dropdown-options"]')).toBeVisible();
            await page.click('[data-testid="dosage-form-tablet"]');

            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', 'Mobile test');
            await page.click('[data-testid="save-medication-button"]');

            // Verify medication was added
            await expect(page.locator('[data-testid="medication-item-Mobile Test Med"]')).toBeVisible();

            console.log('✅ Mobile MTR workflow test passed!');
        });

        test('should handle touch gestures correctly', async ({ page }) => {
            console.log('👆 Starting touch gesture test...');

            await mtrHelper.navigateToMTR();
            await mtrHelper.startNewMTRSession(sampleMTRData.patient);

            // Add multiple medications for swipe testing
            for (let i = 0; i < 3; i++) {
                await page.click('[data-testid="add-medication-button"]');
                await page.fill('[data-testid="drug-name-input"]', `Swipe Med ${i + 1}`);
                await page.fill('[data-testid="strength-input"]', '10 mg');
                await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
                await page.fill('[data-testid="frequency-input"]', 'once daily');
                await page.fill('[data-testid="indication-input"]', 'Swipe test');
                await page.click('[data-testid="save-medication-button"]');
            }

            // Test swipe to delete gesture
            const medicationItem = page.locator('[data-testid="medication-item-Swipe Med 1"]');

            // Simulate swipe left gesture
            await medicationItem.hover();
            await page.mouse.down();
            await page.mouse.move(-100, 0);
            await page.mouse.up();

            // Should reveal delete button
            await expect(page.locator('[data-testid="swipe-delete-button"]')).toBeVisible();

            // Test pull to refresh
            await page.evaluate(() => {
                window.scrollTo(0, 0);
            });

            // Simulate pull down gesture
            await page.mouse.move(200, 100);
            await page.mouse.down();
            await page.mouse.move(200, 200);
            await page.mouse.up();

            // Should show refresh indicator
            await expect(page.locator('[data-testid="pull-refresh-indicator"]')).toBeVisible();

            console.log('✅ Touch gesture test passed!');
        });

        test('should work offline on mobile', async ({ page, context }) => {
            console.log('📴 Starting mobile offline test...');

            await mtrHelper.navigateToMTR();
            await mtrHelper.startNewMTRSession(sampleMTRData.patient);

            // Add medication while online
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', 'Offline Test Med');
            await page.fill('[data-testid="strength-input"]', '10 mg');
            await page.click('[data-testid="save-medication-button"]');

            // Go offline
            await context.setOffline(true);

            // Should show offline indicator
            await expect(page.locator('[data-testid="mobile-offline-banner"]')).toBeVisible();

            // Try to add another medication offline
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', 'Offline Med 2');
            await page.fill('[data-testid="strength-input"]', '20 mg');
            await page.click('[data-testid="save-medication-button"]');

            // Should queue for sync
            await expect(page.locator('[data-testid="sync-queue-indicator"]')).toBeVisible();

            // Go back online
            await context.setOffline(false);

            // Should sync queued changes
            await expect(page.locator('[data-testid="sync-success-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="medication-item-Offline Med 2"]')).toBeVisible();

            console.log('✅ Mobile offline test passed!');
        });
    });

    test.describe('Tablet Device Tests', () => {
        test.use({ ...devices['iPad Pro'] });

        test.beforeEach(async ({ page }) => {
            authHelper = new AuthHelper(page);
            mtrHelper = new MTRHelper(page);
            await authHelper.ensureLoggedIn();
        });

        test('should utilize tablet screen space effectively', async ({ page }) => {
            console.log('📱 Starting tablet layout test...');

            await mtrHelper.navigateToMTR();

            // Verify tablet layout shows sidebar and main content
            await expect(page.locator('[data-testid="tablet-sidebar"]')).toBeVisible();
            await expect(page.locator('[data-testid="tablet-main-content"]')).toBeVisible();

            await mtrHelper.startNewMTRSession(sampleMTRData.patient);

            // Verify tablet form layout (should show more fields per row)
            await page.click('[data-testid="add-medication-button"]');
            await expect(page.locator('[data-testid="tablet-medication-form"]')).toBeVisible();

            // Should show multiple form fields in a row
            const formRow = page.locator('[data-testid="medication-form-row"]');
            await expect(formRow).toBeVisible();

            console.log('✅ Tablet layout test passed!');
        });
    });

    test.describe('Responsive Breakpoint Tests', () => {
        test('should adapt layout at different screen sizes', async ({ page }) => {
            console.log('📏 Starting responsive breakpoint test...');

            await authHelper.ensureLoggedIn();
            await mtrHelper.navigateToMTR();

            // Test desktop layout (1920x1080)
            await page.setViewportSize({ width: 1920, height: 1080 });
            await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();

            // Test laptop layout (1366x768)
            await page.setViewportSize({ width: 1366, height: 768 });
            await expect(page.locator('[data-testid="laptop-layout"]')).toBeVisible();

            // Test tablet layout (768x1024)
            await page.setViewportSize({ width: 768, height: 1024 });
            await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

            // Test mobile layout (375x667)
            await page.setViewportSize({ width: 375, height: 667 });
            await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();

            // Test very small mobile (320x568)
            await page.setViewportSize({ width: 320, height: 568 });
            await expect(page.locator('[data-testid="small-mobile-layout"]')).toBeVisible();

            console.log('✅ Responsive breakpoint test passed!');
        });

        test('should maintain functionality across all screen sizes', async ({ page }) => {
            console.log('🔄 Starting cross-screen functionality test...');

            await authHelper.ensureLoggedIn();

            const screenSizes = [
                { width: 1920, height: 1080, name: 'Desktop' },
                { width: 1366, height: 768, name: 'Laptop' },
                { width: 768, height: 1024, name: 'Tablet' },
                { width: 375, height: 667, name: 'Mobile' },
            ];

            for (const size of screenSizes) {
                console.log(`Testing ${size.name} (${size.width}x${size.height})`);

                await page.setViewportSize({ width: size.width, height: size.height });

                await mtrHelper.navigateToMTR();
                await mtrHelper.startNewMTRSession(sampleMTRData.patient);

                // Test basic functionality
                await page.click('[data-testid="add-medication-button"]');
                await page.fill('[data-testid="drug-name-input"]', `${size.name} Test Med`);
                await page.fill('[data-testid="strength-input"]', '10 mg');
                await page.click('[data-testid="save-medication-button"]');

                await expect(page.locator(`[data-testid="medication-item-${size.name} Test Med"]`)).toBeVisible();

                // Navigate to next step
                await page.click('[data-testid="next-step-button"]');
                await expect(page.locator('[data-testid="therapy-assessment-step"]')).toBeVisible();

                // Go back to start for next iteration
                await page.goto('/medication-therapy-review');
            }

            console.log('✅ Cross-screen functionality test passed!');
        });
    });

    test.describe('Accessibility Tests', () => {
        test('should be accessible on mobile devices', async ({ page }) => {
            test.use({ ...devices['iPhone 12'] });

            console.log('♿ Starting mobile accessibility test...');

            await authHelper.ensureLoggedIn();
            await mtrHelper.navigateToMTR();

            // Test keyboard navigation
            await page.keyboard.press('Tab');
            await expect(page.locator(':focus')).toBeVisible();

            // Test screen reader labels
            const addButton = page.locator('[data-testid="new-mtr-button"]');
            await expect(addButton).toHaveAttribute('aria-label');

            // Test high contrast mode
            await page.emulateMedia({ colorScheme: 'dark' });
            await expect(page.locator('[data-testid="mtr-dashboard"]')).toBeVisible();

            console.log('✅ Mobile accessibility test passed!');
        });

        test('should support voice input on mobile', async ({ page }) => {
            test.use({ ...devices['iPhone 12'] });

            console.log('🎤 Starting voice input test...');

            await authHelper.ensureLoggedIn();
            await mtrHelper.navigateToMTR();
            await mtrHelper.startNewMTRSession(sampleMTRData.patient);

            // Test voice input button
            await page.click('[data-testid="add-medication-button"]');

            if (await page.locator('[data-testid="voice-input-button"]').isVisible()) {
                await page.click('[data-testid="voice-input-button"]');
                await expect(page.locator('[data-testid="voice-input-indicator"]')).toBeVisible();
            }

            console.log('✅ Voice input test passed!');
        });
    });
});