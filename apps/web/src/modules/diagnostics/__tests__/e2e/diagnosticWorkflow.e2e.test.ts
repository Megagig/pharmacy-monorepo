import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = 'e2e.pharmacist@test.com';
const TEST_USER_PASSWORD = 'password123';

// Helper functions
async function loginUser(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_USER_EMAIL);
    await page.fill('[data-testid="password-input"]', TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
}

async function navigateToDiagnostics(page: Page) {
    await page.click('[data-testid="sidebar-diagnostics-link"]');
    await page.waitForURL('**/pharmacy/diagnostics');
}

async function fillSymptomForm(page: Page) {
    // Fill in patient symptoms
    await page.fill('[data-testid="symptom-input"]', 'chest pain');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="symptom-input"]', 'shortness of breath');
    await page.keyboard.press('Enter');

    // Set duration and severity
    await page.selectOption('[data-testid="duration-select"]', '3 days');
    await page.selectOption('[data-testid="severity-select"]', 'moderate');
    await page.selectOption('[data-testid="onset-select"]', 'acute');
}

async function fillVitalSigns(page: Page) {
    await page.fill('[data-testid="blood-pressure-input"]', '140/90');
    await page.fill('[data-testid="heart-rate-input"]', '95');
    await page.fill('[data-testid="temperature-input"]', '98.8');
    await page.fill('[data-testid="respiratory-rate-input"]', '22');
}

async function fillMedicationHistory(page: Page) {
    await page.click('[data-testid="add-medication-button"]');
    await page.fill('[data-testid="medication-name-input"]', 'Metformin');
    await page.fill('[data-testid="medication-dosage-input"]', '500mg');
    await page.selectOption('[data-testid="medication-frequency-select"]', 'twice daily');

    await page.click('[data-testid="add-medication-button"]');
    await page.fill('[data-testid="medication-name-input"]:nth-child(2)', 'Lisinopril');
    await page.fill('[data-testid="medication-dosage-input"]:nth-child(2)', '10mg');
    await page.selectOption('[data-testid="medication-frequency-select"]:nth-child(2)', 'daily');
}

async function fillAllergies(page: Page) {
    await page.fill('[data-testid="allergy-input"]', 'sulfa drugs');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="allergy-input"]', 'shellfish');
    await page.keyboard.press('Enter');
}

test.describe('Diagnostic Workflow E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await loginUser(page);
    });

    test('should complete full diagnostic workflow from symptom entry to intervention', async ({ page }) => {
        // Step 1: Navigate to diagnostics
        await navigateToDiagnostics(page);

        // Verify we're on the diagnostic dashboard
        await expect(page.locator('[data-testid="diagnostic-dashboard"]')).toBeVisible();
        await expect(page.locator('h1')).toContainText('AI Diagnostics & Therapeutics');

        // Step 2: Start new case
        await page.click('[data-testid="new-case-button"]');
        await page.waitForURL('**/pharmacy/diagnostics/case/new');

        // Verify we're on the case intake page
        await expect(page.locator('[data-testid="case-intake-page"]')).toBeVisible();
        await expect(page.locator('h1')).toContainText('New Diagnostic Case');

        // Step 3: Select patient
        await page.click('[data-testid="patient-select"]');
        await page.click('[data-testid="patient-option"]:first-child');

        // Step 4: Fill symptom information
        await fillSymptomForm(page);
        await page.click('[data-testid="next-step-button"]');

        // Step 5: Fill vital signs
        await fillVitalSigns(page);
        await page.click('[data-testid="next-step-button"]');

        // Step 6: Fill medication history
        await fillMedicationHistory(page);
        await page.click('[data-testid="next-step-button"]');

        // Step 7: Fill allergies
        await fillAllergies(page);
        await page.click('[data-testid="next-step-button"]');

        // Step 8: Review and consent
        await expect(page.locator('[data-testid="review-summary"]')).toBeVisible();
        await page.check('[data-testid="consent-checkbox"]');
        await page.click('[data-testid="submit-case-button"]');

        // Step 9: Wait for processing
        await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();

        // Wait for results (with timeout)
        await page.waitForSelector('[data-testid="diagnostic-results"]', { timeout: 30000 });

        // Step 10: Verify results are displayed
        await expect(page.locator('[data-testid="diagnostic-results"]')).toBeVisible();
        await expect(page.locator('[data-testid="diagnosis-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="medication-suggestions"]')).toBeVisible();

        // Step 11: Pharmacist review
        await page.click('[data-testid="approve-results-button"]');
        await page.fill('[data-testid="review-comments"]', 'Approved with cardiology consultation recommendation');
        await page.click('[data-testid="confirm-approval-button"]');

        // Step 12: Integration options
        await expect(page.locator('[data-testid="integration-panel"]')).toBeVisible();

        // Create clinical note
        await page.click('[data-testid="create-clinical-note-button"]');
        await page.fill('[data-testid="note-title-input"]', 'Chest Pain Assessment - AI Diagnostic');
        await page.selectOption('[data-testid="note-type-select"]', 'consultation');
        await page.selectOption('[data-testid="note-priority-select"]', 'high');
        await page.check('[data-testid="follow-up-required-checkbox"]');
        await page.click('[data-testid="create-note-button"]');

        // Verify success message
        await expect(page.locator('[data-testid="success-message"]')).toContainText('Clinical note created successfully');

        // Create MTR
        await page.click('[data-testid="create-mtr-button"]');
        await page.selectOption('[data-testid="mtr-priority-select"]', 'urgent');
        await page.fill('[data-testid="mtr-reason-input"]', 'Chest pain assessment revealed medication optimization needs');
        await page.click('[data-testid="confirm-mtr-button"]');

        // Verify success message
        await expect(page.locator('[data-testid="success-message"]')).toContainText('MTR created successfully');

        // Step 13: View patient timeline
        await page.click('[data-testid="view-timeline-button"]');
        await expect(page.locator('[data-testid="patient-timeline"]')).toBeVisible();

        // Verify timeline contains our events
        await expect(page.locator('[data-testid="timeline-event"][data-type="diagnostic"]')).toBeVisible();
        await expect(page.locator('[data-testid="timeline-event"][data-type="clinical_note"]')).toBeVisible();
        await expect(page.locator('[data-testid="timeline-event"][data-type="mtr"]')).toBeVisible();
    });

    test('should handle error scenarios gracefully', async ({ page }) => {
        await navigateToDiagnostics(page);
        await page.click('[data-testid="new-case-button"]');

        // Test validation errors
        await page.click('[data-testid="next-step-button"]');
        await expect(page.locator('[data-testid="error-message"]')).toContainText('Patient selection is required');

        // Select patient and try to proceed without symptoms
        await page.click('[data-testid="patient-select"]');
        await page.click('[data-testid="patient-option"]:first-child');
        await page.click('[data-testid="next-step-button"]');
        await expect(page.locator('[data-testid="error-message"]')).toContainText('At least one symptom is required');

        // Fill minimum required data
        await page.fill('[data-testid="symptom-input"]', 'test symptom');
        await page.keyboard.press('Enter');
        await page.selectOption('[data-testid="duration-select"]', '1 day');
        await page.selectOption('[data-testid="severity-select"]', 'mild');
        await page.selectOption('[data-testid="onset-select"]', 'acute');

        // Should be able to proceed now
        await page.click('[data-testid="next-step-button"]');
        await expect(page.locator('[data-testid="vitals-step"]')).toBeVisible();
    });

    test('should support accessibility features', async ({ page }) => {
        await navigateToDiagnostics(page);

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="new-case-button"]')).toBeFocused();

        await page.keyboard.press('Enter');
        await page.waitForURL('**/pharmacy/diagnostics/case/new');

        // Test ARIA labels and roles
        await expect(page.locator('[role="main"]')).toBeVisible();
        await expect(page.locator('[aria-label="Patient selection"]')).toBeVisible();
        await expect(page.locator('[aria-label="Symptom input"]')).toBeVisible();

        // Test screen reader announcements
        await page.click('[data-testid="patient-select"]');
        await expect(page.locator('[aria-live="polite"]')).toBeVisible();

        // Test high contrast mode compatibility
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect(page.locator('[data-testid="case-intake-page"]')).toBeVisible();
    });

    test('should work on mobile devices', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await navigateToDiagnostics(page);

        // Mobile navigation should work
        await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
        await page.click('[data-testid="mobile-menu-button"]');
        await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible();

        // Start new case on mobile
        await page.click('[data-testid="new-case-button"]');
        await page.waitForURL('**/pharmacy/diagnostics/case/new');

        // Mobile form should be responsive
        await expect(page.locator('[data-testid="case-intake-form"]')).toBeVisible();

        // Touch interactions should work
        await page.tap('[data-testid="patient-select"]');
        await page.tap('[data-testid="patient-option"]:first-child');

        // Mobile stepper should be visible
        await expect(page.locator('[data-testid="mobile-stepper"]')).toBeVisible();
    });

    test('should handle concurrent user scenarios', async ({ browser }) => {
        // Create multiple browser contexts to simulate concurrent users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Login both users
        await loginUser(page1);
        await loginUser(page2);

        // Both users navigate to diagnostics
        await navigateToDiagnostics(page1);
        await navigateToDiagnostics(page2);

        // Both users start new cases simultaneously
        await Promise.all([
            page1.click('[data-testid="new-case-button"]'),
            page2.click('[data-testid="new-case-button"]'),
        ]);

        // Both should successfully reach the case intake page
        await Promise.all([
            page1.waitForURL('**/pharmacy/diagnostics/case/new'),
            page2.waitForURL('**/pharmacy/diagnostics/case/new'),
        ]);

        await Promise.all([
            expect(page1.locator('[data-testid="case-intake-page"]')).toBeVisible(),
            expect(page2.locator('[data-testid="case-intake-page"]')).toBeVisible(),
        ]);

        // Clean up
        await context1.close();
        await context2.close();
    });

    test('should maintain data consistency across page refreshes', async ({ page }) => {
        await navigateToDiagnostics(page);
        await page.click('[data-testid="new-case-button"]');

        // Fill some form data
        await page.click('[data-testid="patient-select"]');
        await page.click('[data-testid="patient-option"]:first-child');

        await page.fill('[data-testid="symptom-input"]', 'persistent symptom');
        await page.keyboard.press('Enter');
        await page.selectOption('[data-testid="duration-select"]', '2 days');

        // Refresh the page
        await page.reload();

        // Data should be restored from localStorage/sessionStorage
        await expect(page.locator('[data-testid="symptom-tag"]')).toContainText('persistent symptom');
        await expect(page.locator('[data-testid="duration-select"]')).toHaveValue('2 days');
    });

    test('should provide proper loading states and feedback', async ({ page }) => {
        await navigateToDiagnostics(page);

        // Loading state should be shown initially
        await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

        // Content should load
        await expect(page.locator('[data-testid="diagnostic-dashboard"]')).toBeVisible();
        await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();

        // Start new case
        await page.click('[data-testid="new-case-button"]');

        // Loading during navigation
        await expect(page.locator('[data-testid="page-loading"]')).toBeVisible();
        await page.waitForURL('**/pharmacy/diagnostics/case/new');
        await expect(page.locator('[data-testid="page-loading"]')).not.toBeVisible();

        // Fill form and submit
        await page.click('[data-testid="patient-select"]');
        await page.click('[data-testid="patient-option"]:first-child');
        await fillSymptomForm(page);
        await page.click('[data-testid="next-step-button"]');
        await fillVitalSigns(page);
        await page.click('[data-testid="next-step-button"]');
        await page.click('[data-testid="next-step-button"]'); // Skip medications
        await page.click('[data-testid="next-step-button"]'); // Skip allergies

        await page.check('[data-testid="consent-checkbox"]');
        await page.click('[data-testid="submit-case-button"]');

        // Processing state should be shown
        await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
        await expect(page.locator('[data-testid="processing-message"]')).toContainText('Analyzing symptoms');

        // Progress indicator should be visible
        await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    });

    test('should handle network failures gracefully', async ({ page }) => {
        await navigateToDiagnostics(page);
        await page.click('[data-testid="new-case-button"]');

        // Fill form
        await page.click('[data-testid="patient-select"]');
        await page.click('[data-testid="patient-option"]:first-child');
        await fillSymptomForm(page);
        await page.click('[data-testid="next-step-button"]');
        await page.click('[data-testid="next-step-button"]'); // Skip vitals
        await page.click('[data-testid="next-step-button"]'); // Skip medications
        await page.click('[data-testid="next-step-button"]'); // Skip allergies

        // Simulate network failure
        await page.route('**/api/diagnostics/requests', route => route.abort());

        await page.check('[data-testid="consent-checkbox"]');
        await page.click('[data-testid="submit-case-button"]');

        // Error message should be displayed
        await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
        await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

        // Restore network and retry
        await page.unroute('**/api/diagnostics/requests');
        await page.click('[data-testid="retry-button"]');

        // Should proceed normally
        await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    });
});