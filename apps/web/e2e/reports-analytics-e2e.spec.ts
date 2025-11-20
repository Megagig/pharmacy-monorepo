import { test, expect, Page } from '@playwright/test';

// Test data setup
const testUser = {
    email: 'test@pharmacy.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'pharmacist',
};

const testWorkplace = {
    name: 'Test Pharmacy',
    address: 'Test Address',
    phone: '+1234567890',
    email: 'test@pharmacy.com',
};

test.describe('Reports & Analytics Module E2E Tests', () => {
    let page: Page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();

        // Setup test data via API
        await setupTestData(page);

        // Login
        await loginUser(page, testUser.email, testUser.password);

        // Navigate to Reports & Analytics
        await page.goto('/reports-analytics');
    });

    test.afterEach(async () => {
        await cleanupTestData(page);
        await page.close();
    });

    test.describe('Dashboard Navigation', () => {
        test('should display Reports & Analytics in sidebar', async () => {
            await expect(page.locator('[data-testid="sidebar-reports-analytics"]')).toBeVisible();
        });

        test('should navigate to reports dashboard', async () => {
            await page.click('[data-testid="sidebar-reports-analytics"]');
            await expect(page.locator('h1:has-text("Reports & Analytics")')).toBeVisible();
        });

        test('should display report type cards', async () => {
            await expect(page.locator('[data-testid="report-card-patient-outcomes"]')).toBeVisible();
            await expect(page.locator('[data-testid="report-card-pharmacist-interventions"]')).toBeVisible();
            await expect(page.locator('[data-testid="report-card-therapy-effectiveness"]')).toBeVisible();
        });
    });

    test.describe('Patient Outcomes Report', () => {
        test.beforeEach(async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');
            await page.waitForLoadState('networkidle');
        });

        test('should display patient outcomes report', async () => {
            await expect(page.locator('h2:has-text("Patient Outcome Analytics")')).toBeVisible();
        });

        test('should show summary metrics', async () => {
            await expect(page.locator('[data-testid="metric-total-patients"]')).toBeVisible();
            await expect(page.locator('[data-testid="metric-success-rate"]')).toBeVisible();
            await expect(page.locator('[data-testid="metric-cost-savings"]')).toBeVisible();
        });

        test('should display charts', async () => {
            await expect(page.locator('[data-testid="chart-therapy-effectiveness"]')).toBeVisible();
            await expect(page.locator('[data-testid="chart-clinical-parameters"]')).toBeVisible();
            await expect(page.locator('[data-testid="chart-adverse-events"]')).toBeVisible();
        });

        test('should handle chart interactions', async () => {
            const chart = page.locator('[data-testid="chart-therapy-effectiveness"]');
            await chart.hover();

            // Should show tooltip on hover
            await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
        });

        test('should filter data by date range', async () => {
            // Open filter panel
            await page.click('[data-testid="filter-toggle"]');

            // Change date range
            await page.fill('[data-testid="date-picker-start"]', '2024-06-01');
            await page.fill('[data-testid="date-picker-end"]', '2024-06-30');

            // Apply filters
            await page.click('[data-testid="apply-filters"]');

            // Wait for data to update
            await page.waitForLoadState('networkidle');

            // Verify data updated
            await expect(page.locator('[data-testid="filter-summary"]')).toContainText('Jun 2024');
        });

        test('should export report as PDF', async () => {
            // Start download
            const downloadPromise = page.waitForEvent('download');
            await page.click('[data-testid="export-pdf"]');

            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/patient-outcomes.*\.pdf$/);
        });

        test('should export report as CSV', async () => {
            const downloadPromise = page.waitForEvent('download');
            await page.click('[data-testid="export-csv"]');

            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/patient-outcomes.*\.csv$/);
        });
    });

    test.describe('Filter Panel', () => {
        test.beforeEach(async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');
            await page.click('[data-testid="filter-toggle"]');
        });

        test('should display all filter options', async () => {
            await expect(page.locator('[data-testid="filter-date-range"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-therapy-type"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-pharmacist"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-priority"]')).toBeVisible();
        });

        test('should apply multiple filters', async () => {
            // Set date range
            await page.fill('[data-testid="date-picker-start"]', '2024-01-01');
            await page.fill('[data-testid="date-picker-end"]', '2024-03-31');

            // Select therapy type
            await page.click('[data-testid="filter-therapy-type"]');
            await page.click('[data-testid="therapy-option-medication-review"]');

            // Select priority
            await page.click('[data-testid="filter-priority"]');
            await page.click('[data-testid="priority-option-high"]');

            // Apply filters
            await page.click('[data-testid="apply-filters"]');

            await page.waitForLoadState('networkidle');

            // Verify filters applied
            await expect(page.locator('[data-testid="active-filters"]')).toContainText('Q1 2024');
            await expect(page.locator('[data-testid="active-filters"]')).toContainText('Medication Review');
            await expect(page.locator('[data-testid="active-filters"]')).toContainText('High Priority');
        });

        test('should reset filters', async () => {
            // Apply some filters first
            await page.fill('[data-testid="date-picker-start"]', '2024-06-01');
            await page.click('[data-testid="apply-filters"]');

            // Reset filters
            await page.click('[data-testid="reset-filters"]');

            await page.waitForLoadState('networkidle');

            // Verify filters reset
            await expect(page.locator('[data-testid="active-filters"]')).not.toBeVisible();
        });

        test('should validate date range', async () => {
            // Set invalid date range (end before start)
            await page.fill('[data-testid="date-picker-start"]', '2024-12-31');
            await page.fill('[data-testid="date-picker-end"]', '2024-01-01');

            await page.click('[data-testid="apply-filters"]');

            // Should show validation error
            await expect(page.locator('[data-testid="date-range-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="date-range-error"]')).toContainText('End date must be after start date');
        });
    });

    test.describe('Chart Interactions', () => {
        test.beforeEach(async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');
            await page.waitForLoadState('networkidle');
        });

        test('should display tooltips on hover', async () => {
            const chart = page.locator('[data-testid="chart-therapy-effectiveness"]');

            // Hover over chart data point
            await chart.hover();

            // Should show tooltip
            await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
        });

        test('should support chart drill-down', async () => {
            const chart = page.locator('[data-testid="chart-therapy-effectiveness"]');

            // Click on chart data point
            await chart.click();

            // Should navigate to detailed view or show drill-down data
            await expect(page.locator('[data-testid="drill-down-modal"]')).toBeVisible();
        });

        test('should toggle chart legend', async () => {
            const legend = page.locator('[data-testid="chart-legend"]');
            const legendItem = legend.locator('[data-testid="legend-item-outcomes"]');

            // Click legend item to toggle series
            await legendItem.click();

            // Series should be hidden/shown
            await expect(legendItem).toHaveClass(/inactive/);
        });

        test('should support chart zoom and pan', async () => {
            const chart = page.locator('[data-testid="chart-therapy-effectiveness"]');

            // Simulate zoom (wheel event)
            await chart.hover();
            await page.mouse.wheel(0, -100);

            // Should show zoom controls
            await expect(page.locator('[data-testid="chart-zoom-controls"]')).toBeVisible();
        });
    });

    test.describe('Report Scheduling', () => {
        test('should create a scheduled report', async () => {
            await page.click('[data-testid="schedule-report"]');

            // Fill schedule form
            await page.fill('[data-testid="schedule-name"]', 'Weekly Patient Report');
            await page.selectOption('[data-testid="schedule-frequency"]', 'weekly');
            await page.fill('[data-testid="schedule-recipients"]', 'manager@pharmacy.com');
            await page.check('[data-testid="format-pdf"]');

            // Save schedule
            await page.click('[data-testid="save-schedule"]');

            // Should show success message
            await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="success-message"]')).toContainText('Schedule created successfully');
        });

        test('should validate schedule form', async () => {
            await page.click('[data-testid="schedule-report"]');

            // Try to save without required fields
            await page.click('[data-testid="save-schedule"]');

            // Should show validation errors
            await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="recipients-error"]')).toBeVisible();
        });

        test('should manage existing schedules', async () => {
            // Create a schedule first
            await createTestSchedule(page);

            // Navigate to schedule management
            await page.click('[data-testid="manage-schedules"]');

            // Should show existing schedules
            await expect(page.locator('[data-testid="schedule-list"]')).toBeVisible();
            await expect(page.locator('[data-testid="schedule-item"]')).toBeVisible();
        });
    });

    test.describe('Template Management', () => {
        test('should create a custom template', async () => {
            await page.click('[data-testid="create-template"]');

            // Fill template form
            await page.fill('[data-testid="template-name"]', 'Custom Patient Report');
            await page.fill('[data-testid="template-description"]', 'Custom template for patient outcomes');

            // Configure layout (drag and drop)
            await page.dragAndDrop(
                '[data-testid="component-summary-card"]',
                '[data-testid="template-canvas"]'
            );

            await page.dragAndDrop(
                '[data-testid="component-line-chart"]',
                '[data-testid="template-canvas"]'
            );

            // Save template
            await page.click('[data-testid="save-template"]');

            // Should show success message
            await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
        });

        test('should preview template', async () => {
            await createTestTemplate(page);

            // Open template preview
            await page.click('[data-testid="preview-template"]');

            // Should show template preview
            await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();
            await expect(page.locator('[data-testid="preview-summary-card"]')).toBeVisible();
            await expect(page.locator('[data-testid="preview-chart"]')).toBeVisible();
        });
    });

    test.describe('Performance and Loading', () => {
        test('should load reports within acceptable time', async () => {
            const startTime = Date.now();

            await page.click('[data-testid="report-card-patient-outcomes"]');
            await page.waitForLoadState('networkidle');

            const loadTime = Date.now() - startTime;

            // Should load within 5 seconds
            expect(loadTime).toBeLessThan(5000);
        });

        test('should show loading states', async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Should show loading skeleton
            await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();

            // Wait for data to load
            await page.waitForLoadState('networkidle');

            // Loading skeleton should be hidden
            await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible();
        });

        test('should handle large datasets efficiently', async () => {
            // Create large dataset
            await createLargeTestDataset(page);

            const startTime = Date.now();

            await page.click('[data-testid="report-card-patient-outcomes"]');
            await page.waitForLoadState('networkidle');

            const loadTime = Date.now() - startTime;

            // Should still load within reasonable time
            expect(loadTime).toBeLessThan(10000);

            // Should show pagination or virtualization
            await expect(page.locator('[data-testid="data-pagination"]')).toBeVisible();
        });
    });

    test.describe('Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            // Simulate network failure
            await page.route('**/api/reports/**', route => route.abort());

            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Should show error message
            await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load report data');

            // Should show retry button
            await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
        });

        test('should retry failed requests', async () => {
            let requestCount = 0;

            // Fail first request, succeed on retry
            await page.route('**/api/reports/patient-outcomes', route => {
                requestCount++;
                if (requestCount === 1) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Should show error first
            await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

            // Click retry
            await page.click('[data-testid="retry-button"]');

            // Should load successfully
            await page.waitForLoadState('networkidle');
            await expect(page.locator('h2:has-text("Patient Outcome Analytics")')).toBeVisible();
        });

        test('should handle permission errors', async () => {
            // Simulate permission denied
            await page.route('**/api/reports/**', route =>
                route.fulfill({ status: 403, body: JSON.stringify({ error: 'Access denied' }) })
            );

            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Should show permission error
            await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="permission-error"]')).toContainText('Access denied');
        });
    });

    test.describe('Accessibility', () => {
        test('should be keyboard navigable', async () => {
            // Navigate using keyboard
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Enter'); // Should open first report

            await expect(page.locator('h2:has-text("Patient Outcome Analytics")')).toBeVisible();
        });

        test('should have proper ARIA labels', async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Check for ARIA labels on charts
            await expect(page.locator('[aria-label*="chart"]')).toBeVisible();
            await expect(page.locator('[aria-label*="Patient outcomes"]')).toBeVisible();
        });

        test('should support screen readers', async () => {
            await page.click('[data-testid="report-card-patient-outcomes"]');

            // Should have descriptive text for screen readers
            await expect(page.locator('[data-testid="chart-description"]')).toBeVisible();
            await expect(page.locator('[data-testid="data-table-alternative"]')).toBeVisible();
        });
    });
});

// Helper functions
async function setupTestData(page: Page) {
    // Create test data via API calls
    await page.request.post('/api/test/setup', {
        data: {
            workplace: testWorkplace,
            user: testUser,
            patients: 50,
            interventions: 200,
            mtrs: 100,
        },
    });
}

async function cleanupTestData(page: Page) {
    await page.request.delete('/api/test/cleanup');
}

async function loginUser(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
}

async function createTestSchedule(page: Page) {
    await page.request.post('/api/reports/schedule', {
        data: {
            name: 'Test Schedule',
            reportType: 'patient-outcomes',
            frequency: 'weekly',
            recipients: ['test@example.com'],
            format: ['pdf'],
        },
    });
}

async function createTestTemplate(page: Page) {
    await page.request.post('/api/reports/templates', {
        data: {
            name: 'Test Template',
            description: 'Test template',
            reportType: 'patient-outcomes',
            layout: { sections: [] },
            filters: [],
            charts: [],
            tables: [],
        },
    });
}

async function createLargeTestDataset(page: Page) {
    await page.request.post('/api/test/large-dataset', {
        data: {
            patients: 1000,
            interventions: 5000,
            mtrs: 2000,
        },
    });
}