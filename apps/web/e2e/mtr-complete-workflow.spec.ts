import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { MTRHelper } from './utils/mtr-helper';
import { sampleMTRData, complexMTRData } from './utils/test-data';

test.describe('MTR Complete Workflow E2E Tests', () => {
    let authHelper: AuthHelper;
    let mtrHelper: MTRHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        mtrHelper = new MTRHelper(page);

        // Ensure user is logged in
        await authHelper.ensureLoggedIn();
    });

    test('should complete full MTR workflow from patient selection to completion', async () => {
        test.setTimeout(120000); // 2 minutes timeout for complete workflow

        console.log('🚀 Starting complete MTR workflow test...');

        // Navigate to MTR module
        await mtrHelper.navigateToMTR();

        // Start new MTR session
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Add medications
        await mtrHelper.addMedications(sampleMTRData.medications);

        // Perform therapy assessment
        await mtrHelper.performTherapyAssessment(sampleMTRData.problems);

        // Develop therapy plan
        await mtrHelper.developTherapyPlan();

        // Record interventions
        await mtrHelper.recordInterventions(sampleMTRData.interventions);

        // Schedule follow-up
        await mtrHelper.scheduleFollowUp();

        // Complete MTR session
        await mtrHelper.completeMTRSession();

        // Verify MTR appears in history
        await mtrHelper.verifyMTRInHistory(sampleMTRData.patient.mrn);

        console.log('✅ Complete MTR workflow test passed!');
    });

    test('should handle complex MTR with multiple medications and problems', async ({ page }) => {
        test.setTimeout(180000); // 3 minutes timeout for complex workflow

        console.log('🚀 Starting complex MTR workflow test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(complexMTRData.patient);
        await mtrHelper.addMedications(complexMTRData.medications);
        await mtrHelper.performTherapyAssessment(complexMTRData.problems);
        await mtrHelper.developTherapyPlan();
        await mtrHelper.recordInterventions(complexMTRData.interventions);
        await mtrHelper.scheduleFollowUp();
        await mtrHelper.completeMTRSession();

        // Verify all medications were added
        await page.click('[data-testid="mtr-history-tab"]');
        await page.fill('[data-testid="history-search-input"]', complexMTRData.patient.mrn);
        await page.click(`[data-testid="view-mtr-${complexMTRData.patient.mrn}"]`);

        // Verify medication count
        const medicationItems = await page.locator('[data-testid^="medication-item-"]').all();
        expect(medicationItems).toHaveLength(complexMTRData.medications.length);

        // Verify problem count
        const problemItems = await page.locator('[data-testid^="problem-item-"]').all();
        expect(problemItems.length).toBeGreaterThanOrEqual(complexMTRData.problems.length);

        console.log('✅ Complex MTR workflow test passed!');
    });

    test('should maintain data persistence across step navigation', async () => {
        console.log('🚀 Starting data persistence test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Test data persistence
        await mtrHelper.testDataPersistence();

        console.log('✅ Data persistence test passed!');
    });

    test('should handle step navigation correctly', async () => {
        console.log('🚀 Starting step navigation test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Test step navigation
        await mtrHelper.testStepNavigation();

        console.log('✅ Step navigation test passed!');
    });

    test('should auto-save progress during MTR session', async ({ page }) => {
        console.log('🚀 Starting auto-save test...');

        await mtrHelper.navigateToMTR();
        await mtrHelper.startNewMTRSession(sampleMTRData.patient);

        // Add a medication
        await page.click('[data-testid="add-medication-button"]');
        await page.fill('[data-testid="drug-name-input"]', 'Auto-save Test Med');
        await page.fill('[data-testid="strength-input"]', '10 mg');
        await page.click('[data-testid="save-medication-button"]');

        // Wait for auto-save indicator
        await expect(page.locator('[data-testid="auto-save-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="auto-save-indicator"]')).toContainText('Saved');

        // Refresh page to test persistence
        await page.reload();

        // Verify data is still there
        await expect(page.locator('[data-testid="medication-item-Auto-save Test Med"]')).toBeVisible();

        console.log('✅ Auto-save test passed!');
    });

    test('should validate required fields in each step', async ({ page }) => {
        console.log('🚀 Starting field validation test...');

        await mtrHelper.navigateToMTR();

        // Test patient selection validation
        await page.click('[data-testid="new-mtr-button"]');
        await page.click('[data-testid="confirm-patient-button"]');
        await expect(page.locator('[data-testid="patient-required-error"]')).toBeVisible();

        // Select a patient to proceed
        await page.fill('[data-testid="patient-search-input"]', sampleMTRData.patient.mrn);
        await page.waitForTimeout(1000);
        await page.click(`[data-testid="patient-result-${sampleMTRData.patient.mrn}"]`);
        await page.click('[data-testid="confirm-patient-button"]');

        // Test medication validation
        await page.click('[data-testid="add-medication-button"]');
        await page.click('[data-testid="save-medication-button"]');
        await expect(page.locator('[data-testid="drug-name-required-error"]')).toBeVisible();

        console.log('✅ Field validation test passed!');
    });

    test('should handle concurrent MTR sessions', async ({ page, context }) => {
        console.log('🚀 Starting concurrent sessions test...');

        // Open multiple tabs
        const page2 = await context.newPage();
        const authHelper2 = new AuthHelper(page2);
        const mtrHelper2 = new MTRHelper(page2);

        await authHelper2.ensureLoggedIn();

        // Start MTR sessions in both tabs
        await Promise.all([
            mtrHelper.navigateToMTR(),
            mtrHelper2.navigateToMTR()
        ]);

        await Promise.all([
            mtrHelper.startNewMTRSession(sampleMTRData.patient),
            mtrHelper2.startNewMTRSession(complexMTRData.patient)
        ]);

        // Verify both sessions are independent
        await expect(page.locator('[data-testid="medication-history-step"]')).toBeVisible();
        await expect(page2.locator('[data-testid="medication-history-step"]')).toBeVisible();

        // Add different medications in each session
        await page.click('[data-testid="add-medication-button"]');
        await page.fill('[data-testid="drug-name-input"]', 'Session 1 Med');
        await page.click('[data-testid="save-medication-button"]');

        await page2.click('[data-testid="add-medication-button"]');
        await page2.fill('[data-testid="drug-name-input"]', 'Session 2 Med');
        await page2.click('[data-testid="save-medication-button"]');

        // Verify medications are in correct sessions
        await expect(page.locator('[data-testid="medication-item-Session 1 Med"]')).toBeVisible();
        await expect(page2.locator('[data-testid="medication-item-Session 2 Med"]')).toBeVisible();

        await page2.close();

        console.log('✅ Concurrent sessions test passed!');
    });
});