import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

// Test data
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'Admin'
};

const TEST_TENANT = {
  name: 'E2E Test Tenant',
  domain: 'e2e-test.example.com',
  plan: 'premium',
  adminEmail: 'admin@e2e-test.com'
};

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"]', TEST_ADMIN.email);
  await page.fill('[data-testid="password-input"]', TEST_ADMIN.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function navigateToSaasSettings(page: Page) {
  await page.click('[data-testid="saas-settings-nav"]');
  await page.waitForURL(`${BASE_URL}/saas-settings`);
}

async function createTestTenant(page: Page, tenantData = TEST_TENANT) {
  await page.click('[data-testid="add-tenant-button"]');
  await page.waitForSelector('[data-testid="create-tenant-dialog"]');
  
  await page.fill('[data-testid="tenant-name-input"]', tenantData.name);
  await page.fill('[data-testid="tenant-domain-input"]', tenantData.domain);
  await page.selectOption('[data-testid="tenant-plan-select"]', tenantData.plan);
  await page.fill('[data-testid="admin-email-input"]', tenantData.adminEmail);
  
  await page.click('[data-testid="create-tenant-submit"]');
  await page.waitForSelector('[data-testid="success-message"]');
}

test.describe('SaaS Settings E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment
    await page.goto(BASE_URL);
  });

  test.describe('Authentication and Navigation', () => {
    test('should login and navigate to SaaS settings', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      
      // Verify we're on the SaaS settings page
      await expect(page.locator('[data-testid="saas-settings-title"]')).toHaveText('SaaS Settings');
      await expect(page.locator('[data-testid="system-overview-tab"]')).toBeVisible();
    });

    test('should redirect unauthorized users to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/saas-settings`);
      await page.waitForURL(`${BASE_URL}/login`);
      
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test.describe('System Overview', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
    });

    test('should display system metrics', async ({ page }) => {
      await page.click('[data-testid="system-overview-tab"]');
      
      // Wait for metrics to load
      await page.waitForSelector('[data-testid="system-metrics"]');
      
      // Verify key metrics are displayed
      await expect(page.locator('[data-testid="total-users-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-tenants-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="monthly-revenue-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-health-metric"]')).toBeVisible();
    });

    test('should display system health status', async ({ page }) => {
      await page.click('[data-testid="system-overview-tab"]');
      await page.waitForSelector('[data-testid="system-health-panel"]');
      
      // Verify health indicators
      await expect(page.locator('[data-testid="database-health"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-health"]')).toBeVisible();
      await expect(page.locator('[data-testid="cache-health"]')).toBeVisible();
      
      // Check that health status shows as healthy or has appropriate indicators
      const dbHealth = page.locator('[data-testid="database-health-status"]');
      await expect(dbHealth).toHaveText(/healthy|warning|critical/i);
    });

    test('should refresh metrics when refresh button is clicked', async ({ page }) => {
      await page.click('[data-testid="system-overview-tab"]');
      await page.waitForSelector('[data-testid="system-metrics"]');
      
      // Get initial metric value
      const initialValue = await page.locator('[data-testid="total-users-metric"] .metric-value').textContent();
      
      // Click refresh button
      await page.click('[data-testid="refresh-metrics-button"]');
      await page.waitForSelector('[data-testid="loading-indicator"]');
      await page.waitForSelector('[data-testid="loading-indicator"]', { state: 'hidden' });
      
      // Verify metrics are updated (at minimum, the refresh timestamp should change)
      await expect(page.locator('[data-testid="last-updated-timestamp"]')).toBeVisible();
    });
  });

  test.describe('Tenant Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      await page.click('[data-testid="tenant-management-tab"]');
    });

    test('should display tenant list', async ({ page }) => {
      await page.waitForSelector('[data-testid="tenant-table"]');
      
      // Verify table headers
      await expect(page.locator('[data-testid="tenant-name-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-domain-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-plan-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-status-header"]')).toBeVisible();
    });

    test('should create a new tenant', async ({ page }) => {
      await createTestTenant(page);
      
      // Verify tenant appears in the list
      await expect(page.locator(`[data-testid="tenant-row-${TEST_TENANT.name}"]`)).toBeVisible();
      await expect(page.locator(`text=${TEST_TENANT.domain}`)).toBeVisible();
    });

    test('should validate tenant creation form', async ({ page }) => {
      await page.click('[data-testid="add-tenant-button"]');
      await page.waitForSelector('[data-testid="create-tenant-dialog"]');
      
      // Try to submit empty form
      await page.click('[data-testid="create-tenant-submit"]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid="tenant-name-error"]')).toHaveText(/required/i);
      await expect(page.locator('[data-testid="tenant-domain-error"]')).toHaveText(/required/i);
      await expect(page.locator('[data-testid="admin-email-error"]')).toHaveText(/required/i);
    });

    test('should search and filter tenants', async ({ page }) => {
      // Create a test tenant first
      await createTestTenant(page);
      
      // Test search functionality
      await page.fill('[data-testid="tenant-search-input"]', TEST_TENANT.name);
      await page.waitForTimeout(500); // Wait for debounced search
      
      // Verify filtered results
      await expect(page.locator(`[data-testid="tenant-row-${TEST_TENANT.name}"]`)).toBeVisible();
      
      // Test status filter
      await page.selectOption('[data-testid="status-filter-select"]', 'active');
      await page.waitForTimeout(500);
      
      // Verify only active tenants are shown
      const tenantRows = page.locator('[data-testid^="tenant-row-"]');
      const count = await tenantRows.count();
      
      for (let i = 0; i < count; i++) {
        const statusBadge = tenantRows.nth(i).locator('[data-testid="tenant-status-badge"]');
        await expect(statusBadge).toHaveText(/active/i);
      }
    });

    test('should edit tenant details', async ({ page }) => {
      // Create a test tenant first
      await createTestTenant(page);
      
      // Click edit button for the tenant
      await page.click(`[data-testid="edit-tenant-${TEST_TENANT.name}"]`);
      await page.waitForSelector('[data-testid="edit-tenant-dialog"]');
      
      // Update tenant name
      const newName = 'Updated E2E Test Tenant';
      await page.fill('[data-testid="tenant-name-input"]', newName);
      
      // Submit changes
      await page.click('[data-testid="save-tenant-changes"]');
      await page.waitForSelector('[data-testid="success-message"]');
      
      // Verify changes are reflected
      await expect(page.locator(`text=${newName}`)).toBeVisible();
    });

    test('should suspend and reactivate tenant', async ({ page }) => {
      // Create a test tenant first
      await createTestTenant(page);
      
      // Suspend tenant
      await page.click(`[data-testid="tenant-actions-${TEST_TENANT.name}"]`);
      await page.click('[data-testid="suspend-tenant-action"]');
      
      // Confirm suspension
      await page.waitForSelector('[data-testid="confirm-suspension-dialog"]');
      await page.fill('[data-testid="suspension-reason-input"]', 'E2E test suspension');
      await page.click('[data-testid="confirm-suspend-button"]');
      
      // Verify tenant is suspended
      await page.waitForSelector('[data-testid="success-message"]');
      const statusBadge = page.locator(`[data-testid="tenant-row-${TEST_TENANT.name}"] [data-testid="tenant-status-badge"]`);
      await expect(statusBadge).toHaveText(/suspended/i);
      
      // Reactivate tenant
      await page.click(`[data-testid="tenant-actions-${TEST_TENANT.name}"]`);
      await page.click('[data-testid="reactivate-tenant-action"]');
      await page.click('[data-testid="confirm-reactivate-button"]');
      
      // Verify tenant is active again
      await page.waitForSelector('[data-testid="success-message"]');
      await expect(statusBadge).toHaveText(/active/i);
    });

    test('should delete tenant with confirmation', async ({ page }) => {
      // Create a test tenant first
      await createTestTenant(page);
      
      // Delete tenant
      await page.click(`[data-testid="tenant-actions-${TEST_TENANT.name}"]`);
      await page.click('[data-testid="delete-tenant-action"]');
      
      // Confirm deletion
      await page.waitForSelector('[data-testid="confirm-deletion-dialog"]');
      await page.fill('[data-testid="confirm-deletion-input"]', 'DELETE');
      await page.click('[data-testid="confirm-delete-button"]');
      
      // Verify tenant is removed
      await page.waitForSelector('[data-testid="success-message"]');
      await expect(page.locator(`[data-testid="tenant-row-${TEST_TENANT.name}"]`)).not.toBeVisible();
    });
  });

  test.describe('User Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      await page.click('[data-testid="user-management-tab"]');
    });

    test('should display user list with pagination', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-table"]');
      
      // Verify table structure
      await expect(page.locator('[data-testid="user-name-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-tenant-header"]')).toBeVisible();
      
      // Verify pagination controls
      await expect(page.locator('[data-testid="pagination-controls"]')).toBeVisible();
    });

    test('should filter users by role and status', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-table"]');
      
      // Filter by role
      await page.selectOption('[data-testid="role-filter-select"]', 'admin');
      await page.waitForTimeout(500);
      
      // Verify filtered results
      const userRows = page.locator('[data-testid^="user-row-"]');
      const count = await userRows.count();
      
      for (let i = 0; i < count; i++) {
        const roleBadge = userRows.nth(i).locator('[data-testid="user-role-badge"]');
        await expect(roleBadge).toHaveText(/admin/i);
      }
    });

    test('should manage user permissions', async ({ page }) => {
      // Find first user in the list
      await page.waitForSelector('[data-testid^="user-row-"]');
      const firstUserRow = page.locator('[data-testid^="user-row-"]').first();
      
      // Click manage permissions
      await firstUserRow.locator('[data-testid="manage-permissions-button"]').click();
      await page.waitForSelector('[data-testid="permissions-dialog"]');
      
      // Verify permissions interface
      await expect(page.locator('[data-testid="permissions-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-selector"]')).toBeVisible();
      
      // Update permissions
      await page.check('[data-testid="permission-tenant-read"]');
      await page.click('[data-testid="save-permissions-button"]');
      
      // Verify success
      await page.waitForSelector('[data-testid="success-message"]');
    });
  });

  test.describe('Billing & Subscriptions', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      await page.click('[data-testid="billing-subscriptions-tab"]');
    });

    test('should display billing overview', async ({ page }) => {
      await page.waitForSelector('[data-testid="billing-overview"]');
      
      // Verify key metrics
      await expect(page.locator('[data-testid="total-revenue-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-subscriptions-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="churn-rate-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="mrr-metric"]')).toBeVisible();
    });

    test('should display subscription list', async ({ page }) => {
      await page.waitForSelector('[data-testid="subscription-table"]');
      
      // Verify table headers
      await expect(page.locator('[data-testid="subscription-tenant-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="subscription-plan-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="subscription-status-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="subscription-amount-header"]')).toBeVisible();
    });

    test('should process manual payment', async ({ page }) => {
      await page.waitForSelector('[data-testid="subscription-table"]');
      
      // Click process payment button
      await page.click('[data-testid="process-payment-button"]');
      await page.waitForSelector('[data-testid="payment-dialog"]');
      
      // Fill payment form
      await page.fill('[data-testid="payment-amount-input"]', '99.99');
      await page.fill('[data-testid="payment-description-input"]', 'E2E test payment');
      
      // Submit payment
      await page.click('[data-testid="process-payment-submit"]');
      await page.waitForSelector('[data-testid="success-message"]');
      
      // Verify payment was processed
      await expect(page.locator('[data-testid="success-message"]')).toHaveText(/payment processed/i);
    });
  });

  test.describe('Analytics & Reports', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      await page.click('[data-testid="analytics-reports-tab"]');
    });

    test('should display analytics dashboard', async ({ page }) => {
      await page.waitForSelector('[data-testid="analytics-dashboard"]');
      
      // Verify chart components
      await expect(page.locator('[data-testid="user-growth-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-distribution-chart"]')).toBeVisible();
    });

    test('should filter analytics by date range', async ({ page }) => {
      await page.waitForSelector('[data-testid="analytics-dashboard"]');
      
      // Set date range
      await page.click('[data-testid="date-range-picker"]');
      await page.click('[data-testid="last-30-days-option"]');
      
      // Wait for charts to update
      await page.waitForSelector('[data-testid="loading-indicator"]');
      await page.waitForSelector('[data-testid="loading-indicator"]', { state: 'hidden' });
      
      // Verify charts are updated
      await expect(page.locator('[data-testid="user-growth-chart"]')).toBeVisible();
    });

    test('should export analytics report', async ({ page }) => {
      await page.waitForSelector('[data-testid="analytics-dashboard"]');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-report-button"]');
      
      // Select export format
      await page.click('[data-testid="export-csv-option"]');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/analytics.*\.csv$/);
    });
  });

  test.describe('Security Settings', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      await page.click('[data-testid="security-settings-tab"]');
    });

    test('should display security overview', async ({ page }) => {
      await page.waitForSelector('[data-testid="security-overview"]');
      
      // Verify security metrics
      await expect(page.locator('[data-testid="active-sessions-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="failed-logins-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-alerts-metric"]')).toBeVisible();
    });

    test('should update password policy', async ({ page }) => {
      await page.waitForSelector('[data-testid="password-policy-section"]');
      
      // Update password policy settings
      await page.fill('[data-testid="min-length-input"]', '12');
      await page.check('[data-testid="require-uppercase-checkbox"]');
      await page.check('[data-testid="require-numbers-checkbox"]');
      
      // Save changes
      await page.click('[data-testid="save-password-policy-button"]');
      await page.waitForSelector('[data-testid="success-message"]');
      
      // Verify changes are saved
      await expect(page.locator('[data-testid="min-length-input"]')).toHaveValue('12');
    });

    test('should view and manage active sessions', async ({ page }) => {
      await page.waitForSelector('[data-testid="active-sessions-section"]');
      
      // View active sessions
      await page.click('[data-testid="view-sessions-button"]');
      await page.waitForSelector('[data-testid="sessions-table"]');
      
      // Verify session information
      await expect(page.locator('[data-testid="session-user-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-ip-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-location-header"]')).toBeVisible();
      
      // Terminate a session (if any exist)
      const sessionRows = page.locator('[data-testid^="session-row-"]');
      const sessionCount = await sessionRows.count();
      
      if (sessionCount > 0) {
        await sessionRows.first().locator('[data-testid="terminate-session-button"]').click();
        await page.click('[data-testid="confirm-terminate-button"]');
        await page.waitForSelector('[data-testid="success-message"]');
      }
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept API calls and simulate network error
      await page.route(`${API_BASE_URL}/api/saas/tenants`, route => {
        route.abort('failed');
      });
      
      await page.click('[data-testid="tenant-management-tab"]');
      
      // Verify error message is displayed
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle validation errors', async ({ page }) => {
      await page.click('[data-testid="tenant-management-tab"]');
      await page.click('[data-testid="add-tenant-button"]');
      
      // Fill form with invalid data
      await page.fill('[data-testid="tenant-name-input"]', ''); // Empty name
      await page.fill('[data-testid="tenant-domain-input"]', 'invalid-domain'); // Invalid domain
      await page.fill('[data-testid="admin-email-input"]', 'invalid-email'); // Invalid email
      
      await page.click('[data-testid="create-tenant-submit"]');
      
      // Verify validation errors are displayed
      await expect(page.locator('[data-testid="tenant-name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-domain-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="admin-email-error"]')).toBeVisible();
    });

    test('should handle loading states', async ({ page }) => {
      // Intercept API calls to add delay
      await page.route(`${API_BASE_URL}/api/saas/tenants`, route => {
        setTimeout(() => route.continue(), 2000);
      });
      
      await page.click('[data-testid="tenant-management-tab"]');
      
      // Verify loading indicator is shown
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      
      // Wait for loading to complete
      await page.waitForSelector('[data-testid="loading-indicator"]', { state: 'hidden' });
      await expect(page.locator('[data-testid="tenant-table"]')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      
      // Verify mobile navigation
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Test mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Navigate to tenant management
      await page.click('[data-testid="mobile-tenant-management-link"]');
      await expect(page.locator('[data-testid="tenant-table"]')).toBeVisible();
    });

    test('should work on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await loginAsAdmin(page);
      await navigateToSaasSettings(page);
      
      // Verify tablet layout
      await expect(page.locator('[data-testid="saas-settings-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="saas-settings-content"]')).toBeVisible();
      
      // Test navigation
      await page.click('[data-testid="tenant-management-tab"]');
      await expect(page.locator('[data-testid="tenant-table"]')).toBeVisible();
    });
  });
});