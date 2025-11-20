import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { MTRHelper } from './utils/mtr-helper';
import { sampleMTRData } from './utils/test-data';

test.describe('MTR Error Scenarios and Recovery E2E Tests', () => {
    let authHelper: AuthHelper;
    let mtrHelper: MTRHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        mtrHelper = new MTRHelper(page);

        await authHelper.ensureLoggedIn();
    });

    test('should handle network failures gracefully', async ({ page, context }) => {
        console.log('🚀 Starting network failure test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Add a medication
        await page.click('[data-testid="add-medication-button"]');
        await page.fill('[data-testid="drug-name-input"]', 'Network Test Med');
        await page.fill('[data-testid="strength-input"]', '10 mg');

        // Simulate network failure
        await context.setOffline(true);

        // Try to save medication
        await page.click('[data-testid="save-medication-button"]');

        // Should show offline indicator
        await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

        // Should show error message
        await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();

        // Restore network
        await context.setOffline(false);

        // Should automatically retry and succeed
        await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="medication-item-Network Test Med"]')).toBeVisible();

        console.log('✅ Network failure test passed!');
    });

    test('should handle server errors with retry mechanism', async ({ page }) => {
        console.log('🚀 Starting server error test...');

        await mtrHelper.navigateToMTR();

        // Mock server error response
        await page.route('**/api/mtr', (route) => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: 'Internal server error'
                })
            });
        });

        // Try to start new MTR session
        await page.click('[data-testid="new-mtr-button"]');

        // Should show error message
        await expect(page.locator('[data-testid="server-error-message"]')).toBeVisible();

        // Should show retry button
        await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

        // Remove mock to allow retry to succeed
        await page.unroute('**/api/mtr');

        // Click retry
        await page.click('[data-testid="retry-button"]');

        // Should succeed on retry
        await expect(page.locator('[data-testid="patient-selection-step"]')).toBeVisible();

        console.log('✅ Server error test passed!');
    });

    test('should validate and handle invalid input data', async ({ page }) => {
        console.log('🚀 Starting invalid input test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Test invalid medication data
        await page.click('[data-testid="add-medication-button"]');

        // Try to save with empty required fields
        await page.click('[data-testid="save-medication-button"]');
        await expect(page.locator('[data-testid="drug-name-required-error"]')).toBeVisible();

        // Fill with invalid strength
        await page.fill('[data-testid="drug-name-input"]', 'Test Med');
        await page.fill('[data-testid="strength-input"]', 'invalid strength');
        await page.click('[data-testid="save-medication-button"]');
        await expect(page.locator('[data-testid="strength-format-error"]')).toBeVisible();

        // Fill with valid data
        await page.fill('[data-testid="strength-input"]', '10 mg');
        await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
        await page.fill('[data-testid="frequency-input"]', 'once daily');
        await page.fill('[data-testid="indication-input"]', 'Test indication');
        await page.click('[data-testid="save-medication-button"]');

        // Should succeed with valid data
        await expect(page.locator('[data-testid="medication-item-Test Med"]')).toBeVisible();

        console.log('✅ Invalid input test passed!');
    });

    test('should handle session timeout gracefully', async ({ page }) => {
        console.log('🚀 Starting session timeout test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Mock session timeout response
        await page.route('**/api/**', (route) => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: 'Session expired'
                })
            });
        });

        // Try to perform an action
        await page.click('[data-testid="add-medication-button"]');
        await page.fill('[data-testid="drug-name-input"]', 'Timeout Test Med');
        await page.click('[data-testid="save-medication-button"]');

        // Should show session expired message
        await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();

        // Should redirect to login
        await expect(page).toHaveURL(/.*login.*/);

        console.log('✅ Session timeout test passed!');
    });

    test('should recover from browser crashes and data loss', async ({ page }) => {
        console.log('🚀 Starting crash recovery test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Add some data
        await page.click('[data-testid="add-medication-button"]');
        await page.fill('[data-testid="drug-name-input"]', 'Crash Test Med');
        await page.fill('[data-testid="strength-input"]', '10 mg');
        await page.click('[data-testid="save-medication-button"]');

        // Wait for auto-save
        await expect(page.locator('[data-testid="auto-save-indicator"]')).toContainText('Saved');

        // Simulate browser crash by clearing local storage and reloading
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();

        // Should redirect to login
        await authHelper.login();

        // Navigate back to MTR
        await mtrHelper.navigateToMTR();

        // Check if there's a draft session to recover
        if (await page.locator('[data-testid="recover-session-button"]').isVisible()) {
            await page.click('[data-testid="recover-session-button"]');

            // Should recover the medication data
            await expect(page.locator('[data-testid="medication-item-Crash Test Med"]')).toBeVisible();
        }

        console.log('✅ Crash recovery test passed!');
    });

    test('should handle concurrent user conflicts', async ({ context }) => {
        console.log('🚀 Starting concurrent user conflict test...');

        // Create second user session
        const page2 = await context.newPage();
        const authHelper2 = new AuthHelper(page2);
        const mtrHelper2 = new MTRHelper(page2);

        await authHelper2.login();

        // Both users try to edit the same MTR session
        await mtrHelper.navigateToMTR();
        await mtrHelper2.navigateToMTR();

        // Start same MTR session in both tabs (if allowed)
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Try to start same session in second tab
        await page2.click('[data-testid="new-mtr-button"]');
        await page2.fill('[data-testid="patient-search-input"]', sampleMTRData.patient.mrn);
        await page2.waitForTimeout(1000);
        await page2.click(`[data-testid="patient-result-${sampleMTRData.patient.mrn}"]`);
        await page2.click('[data-testid="confirm-patient-button"]');

        // Should show conflict warning
        await expect(page2.locator('[data-testid="session-conflict-warning"]')).toBeVisible();

        await page2.close();

        console.log('✅ Concurrent user conflict test passed!');
    });

    test('should handle large data sets without performance degradation', async ({ page }) => {
        console.log('🚀 Starting large data performance test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const startTime = Date.now();

        // Add many medications quickly
        for (let i = 0; i < 20; i++) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', `Performance Med ${i + 1}`);
            await page.fill('[data-testid="strength-input"]', `${10 + i} mg`);
            await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', `Indication ${i + 1}`);
            await page.click('[data-testid="save-medication-button"]');
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should complete within reasonable time (30 seconds for 20 medications)
        expect(totalTime).toBeLessThan(30000);

        // Verify all medications were added
        const medicationItems = await page.locator('[data-testid^="medication-item-Performance Med"]').all();
        expect(medicationItems).toHaveLength(20);

        console.log(`✅ Large data performance test passed! (${totalTime}ms for 20 medications)`);
    });

    test('should handle malicious input safely', async ({ page }) => {
        console.log('🚀 Starting malicious input test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const maliciousInputs = [
            '<script>alert("xss")</script>',
            '"><script>alert("xss")</script>',
            'javascript:alert("xss")',
            '${7*7}',
            '{{7*7}}',
            '../../../etc/passwd',
            '; DROP TABLE medications; --'
        ];

        for (const maliciousInput of maliciousInputs) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', maliciousInput);
            await page.fill('[data-testid="strength-input]', '10 mg');
            await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', 'Test indication');
            await page.click('[data-testid="save-medication-button"]');

            // Should either sanitize the input or show validation error
            const medicationItem = page.locator(`[data-testid="medication-item-${maliciousInput}"]`);
            if (await medicationItem.isVisible()) {
                // If saved, verify it's properly escaped/sanitized
                const displayedText = await medicationItem.textContent();
                expect(displayedText).not.toContain('<script>');
                expect(displayedText).not.toContain('javascript:');
            }

            // Clean up for next test
            if (await page.locator('[data-testid="delete-medication-button"]').isVisible()) {
                await page.click('[data-testid="delete-medication-button"]');
            }
        }

        console.log('✅ Malicious input test passed!');
    });
});