import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { MTRHelper } from './utils/mtr-helper';
import { sampleMTRData } from './utils/test-data';

test.describe('MTR Performance E2E Tests', () => {
    let authHelper: AuthHelper;
    let mtrHelper: MTRHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        mtrHelper = new MTRHelper(page);
        await authHelper.ensureLoggedIn();
    });

    test('should handle large medication lists efficiently', async ({ page }) => {
        test.setTimeout(180000); // 3 minutes timeout

        console.log('⚡ Starting large medication list performance test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const startTime = Date.now();

        // Add 50 medications
        for (let i = 0; i < 50; i++) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', `Performance Med ${i + 1}`);
            await page.fill('[data-testid="strength-input"]', `${10 + i} mg`);
            await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', `Performance test indication ${i + 1}`);
            await page.click('[data-testid="save-medication-button"]');

            // Log progress every 10 medications
            if ((i + 1) % 10 === 0) {
                console.log(`Added ${i + 1}/50 medications...`);
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`⏱️ Added 50 medications in ${totalTime}ms (${totalTime / 50}ms per medication)`);

        // Should complete within reasonable time (2 minutes for 50 medications)
        expect(totalTime).toBeLessThan(120000);

        // Verify all medications are displayed
        const medicationItems = await page.locator('[data-testid^="medication-item-Performance Med"]').all();
        expect(medicationItems).toHaveLength(50);

        // Test scrolling performance with large list
        const scrollStartTime = Date.now();
        await page.evaluate(() => {
            const container = document.querySelector('[data-testid="medication-list-container"]');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        });
        const scrollEndTime = Date.now();
        const scrollTime = scrollEndTime - scrollStartTime;

        console.log(`📜 Scrolled to bottom in ${scrollTime}ms`);
        expect(scrollTime).toBeLessThan(1000); // Should scroll smoothly

        // Test search performance
        const searchStartTime = Date.now();
        await page.fill('[data-testid="medication-search-input"]', 'Performance Med 25');
        await page.waitForTimeout(500); // Wait for search debounce
        const searchEndTime = Date.now();
        const searchTime = searchEndTime - searchStartTime;

        console.log(`🔍 Search completed in ${searchTime}ms`);
        expect(searchTime).toBeLessThan(2000);

        // Verify search results
        await expect(page.locator('[data-testid="medication-item-Performance Med 25"]')).toBeVisible();

        console.log('✅ Large medication list performance test passed!');
    });

    test('should maintain performance with multiple concurrent operations', async ({ page }) => {
        console.log('🔄 Starting concurrent operations performance test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const startTime = Date.now();

        // Perform multiple operations concurrently
        const operations = [];

        // Add medications
        for (let i = 0; i < 10; i++) {
            operations.push(
                (async () => {
                    await page.click('[data-testid="add-medication-button"]');
                    await page.fill('[data-testid="drug-name-input"]', `Concurrent Med ${i + 1}`);
                    await page.fill('[data-testid="strength-input"]', `${10 + i} mg`);
                    await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
                    await page.fill('[data-testid="frequency-input"]', 'once daily');
                    await page.fill('[data-testid="indication-input"]', `Concurrent test ${i + 1}`);
                    await page.click('[data-testid="save-medication-button"]');
                })()
            );
        }

        // Wait for all operations to complete
        await Promise.all(operations);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`⚡ Completed 10 concurrent operations in ${totalTime}ms`);
        expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

        // Verify all medications were added
        const medicationItems = await page.locator('[data-testid^="medication-item-Concurrent Med"]').all();
        expect(medicationItems).toHaveLength(10);

        console.log('✅ Concurrent operations performance test passed!');
    });

    test('should handle rapid user interactions without lag', async ({ page }) => {
        console.log('⚡ Starting rapid interaction test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const startTime = Date.now();

        // Rapid clicking and typing
        for (let i = 0; i < 20; i++) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', `Rapid Med ${i + 1}`);

            // Rapid typing
            await page.type('[data-testid="strength-input"]', `${10 + i} mg`, { delay: 10 });

            await page.click('[data-testid="save-medication-button"]');

            // Immediate next action without waiting
            if (i < 19) {
                await page.waitForTimeout(50); // Minimal delay
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`⚡ Completed 20 rapid interactions in ${totalTime}ms`);
        expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute

        // Verify UI remains responsive
        await expect(page.locator('[data-testid="medication-list-container"]')).toBeVisible();

        console.log('✅ Rapid interaction test passed!');
    });

    test('should optimize memory usage with large datasets', async ({ page }) => {
        console.log('🧠 Starting memory optimization test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Monitor memory usage
        const initialMemory = await page.evaluate(() => {
            return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory.usedJSHeapSize : 0;
        });

        // Add large dataset
        for (let i = 0; i < 100; i++) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', `Memory Test Med ${i + 1}`);
            await page.fill('[data-testid="strength-input"]', `${10 + i} mg`);
            await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', `Memory test indication ${i + 1}`);
            await page.click('[data-testid="save-medication-button"]');

            if ((i + 1) % 25 === 0) {
                console.log(`Added ${i + 1}/100 medications for memory test...`);
            }
        }

        const finalMemory = await page.evaluate(() => {
            return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory.usedJSHeapSize : 0;
        });

        if (initialMemory > 0 && finalMemory > 0) {
            const memoryIncrease = finalMemory - initialMemory;
            const memoryIncreaseKB = memoryIncrease / 1024;

            console.log(`📊 Memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);

            // Memory increase should be reasonable (less than 50MB for 100 items)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }

        // Test virtual scrolling if implemented
        const listContainer = page.locator('[data-testid="medication-list-container"]');
        const visibleItems = await listContainer.locator('[data-testid^="medication-item-"]').all();

        // Should not render all 100 items at once (virtual scrolling)
        console.log(`👁️ Visible items in viewport: ${visibleItems.length}`);
        expect(visibleItems.length).toBeLessThan(100);

        console.log('✅ Memory optimization test passed!');
    });

    test('should load initial data quickly', async ({ page }) => {
        console.log('🚀 Starting initial load performance test...');

        const startTime = Date.now();

        // Navigate to MTR and measure load time
        await mtrHelper.navigateToMTR();

        const loadTime = Date.now() - startTime;
        console.log(`⏱️ MTR module loaded in ${loadTime}ms`);

        // Should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);

        // Verify all critical elements are loaded
        await expect(page.locator('[data-testid="mtr-dashboard"]')).toBeVisible();
        await expect(page.locator('[data-testid="new-mtr-button"]')).toBeVisible();

        console.log('✅ Initial load performance test passed!');
    });

    test('should handle network latency gracefully', async ({ page }) => {
        console.log('🌐 Starting network latency test...');

        // Simulate slow network
        await page.route('**/api/**', async (route) => {
            // Add 2 second delay to all API calls
            await new Promise(resolve => setTimeout(resolve, 2000));
            route.continue();
        });

        await mtrHelper.navigateToMTR();

        const startTime = Date.now();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);
        const sessionStartTime = Date.now() - startTime;

        console.log(`🐌 MTR session started with 2s latency in ${sessionStartTime}ms`);

        // Should show loading indicators
        await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

        // Should eventually complete despite latency
        await expect(page.locator('[data-testid="medication-history-step"]')).toBeVisible();

        console.log('✅ Network latency test passed!');
    });

    test('should maintain performance during auto-save operations', async ({ page }) => {
        console.log('💾 Starting auto-save performance test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        const startTime = Date.now();

        // Add medications rapidly to trigger frequent auto-saves
        for (let i = 0; i < 20; i++) {
            await page.click('[data-testid="add-medication-button"]');
            await page.fill('[data-testid="drug-name-input"]', `AutoSave Med ${i + 1}`);
            await page.fill('[data-testid="strength-input"]', `${10 + i} mg`);
            await page.selectOption('[data-testid="dosage-form-select"]', 'tablet');
            await page.fill('[data-testid="frequency-input"]', 'once daily');
            await page.fill('[data-testid="indication-input"]', `Auto-save test ${i + 1}`);
            await page.click('[data-testid="save-medication-button"]');

            // Verify auto-save doesn't block UI
            await expect(page.locator('[data-testid="add-medication-button"]')).toBeEnabled();
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`💾 Completed 20 operations with auto-save in ${totalTime}ms`);
        expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute

        // Verify auto-save indicators appeared
        await expect(page.locator('[data-testid="auto-save-indicator"]')).toHaveText(/Saved|Saving/);

        console.log('✅ Auto-save performance test passed!');
    });
});