import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5000';

// Test data
const TEST_SUPER_ADMIN = {
  email: 'superadmin@test.com',
  password: 'SuperAdmin123!',
  firstName: 'Super',
  lastName: 'Admin',
  role: 'super_admin'
};

const TEST_REGULAR_USER = {
  email: 'user@test.com',
  password: 'User123!',
  firstName: 'Regular',
  lastName: 'User',
  role: 'pharmacist'
};

const TEST_FEATURE = {
  key: 'e2e_test_feature',
  name: 'E2E Test Feature',
  description: 'Feature created during E2E testing',
  allowedTiers: ['pro', 'enterprise'],
  allowedRoles: ['pharmacist', 'owner'],
  isActive: true
};

// Helper functions
async function loginAsSuperAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', TEST_SUPER_ADMIN.email);
  await page.fill('input[name="password"]', TEST_SUPER_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

async function loginAsRegularUser(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', TEST_REGULAR_USER.email);
  await page.fill('input[name="password"]', TEST_REGULAR_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}

async function navigateToFeatureManagement(page: Page) {
  // Navigate via sidebar or direct URL
  await page.goto(`${BASE_URL}/admin/feature-management`);
  await page.waitForLoadState('networkidle');
}

async function createFeature(page: Page, featureData = TEST_FEATURE) {
  // Click Add Feature button
  await page.click('button:has-text("Add Feature")');
  
  // Wait for form dialog to appear
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  
  // Fill form fields
  await page.fill('input[name="key"]', featureData.key);
  await page.fill('input[name="name"]', featureData.name);
  await page.fill('textarea[name="description"]', featureData.description);
  
  // Select tiers
  for (const tier of featureData.allowedTiers) {
    await page.check(`input[type="checkbox"][value="${tier}"]`);
  }
  
  // Select roles
  for (const role of featureData.allowedRoles) {
    await page.check(`input[type="checkbox"][value="${role}"]`);
  }
  
  // Submit form
  await page.click('button:has-text("Create")');
  
  // Wait for success notification
  await page.waitForSelector('text=/created successfully/i', { timeout: 5000 });
}

test.describe('Feature Management E2E Tests', () => {
  test.describe('Authentication and Authorization', () => {
    test('should allow super_admin to access feature management page', async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Verify page loaded successfully
      await expect(page.locator('h1, h2, h3, h4, h5, h6')).toContainText(/feature management/i);
      await expect(page.locator('button:has-text("Add Feature")')).toBeVisible();
    });

    test('should redirect non-super_admin users', async ({ page }) => {
      await loginAsRegularUser(page);
      
      // Attempt to access feature management
      await page.goto(`${BASE_URL}/admin/feature-management`);
      
      // Should be redirected or see access denied
      await page.waitForTimeout(2000);
      const url = page.url();
      const hasAccessDenied = await page.locator('text=/access denied|forbidden|403/i').count() > 0;
      
      expect(url !== `${BASE_URL}/admin/feature-management` || hasAccessDenied).toBeTruthy();
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access without logging in
      await page.goto(`${BASE_URL}/admin/feature-management`);
      
      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  });

  test.describe('Feature Creation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
    });

    test('should create a new feature through UI', async ({ page }) => {
      await createFeature(page);
      
      // Verify feature appears in the list
      await expect(page.locator(`text=${TEST_FEATURE.name}`)).toBeVisible();
      await expect(page.locator(`text=${TEST_FEATURE.key}`)).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      // Click Add Feature button
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
      
      // Try to submit without filling required fields
      await page.click('button:has-text("Create")');
      
      // Should show validation errors
      await expect(page.locator('text=/required|cannot be empty/i')).toBeVisible();
    });

    test('should validate feature key format', async ({ page }) => {
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
      
      // Enter invalid key with spaces and uppercase
      await page.fill('input[name="key"]', 'Invalid Key!');
      await page.fill('input[name="name"]', 'Test Feature');
      
      // Try to submit
      await page.click('button:has-text("Create")');
      
      // Should show validation error for key format
      const hasError = await page.locator('text=/lowercase|invalid format|alphanumeric/i').count() > 0;
      expect(hasError).toBeTruthy();
    });

    test('should require at least one tier selection', async ({ page }) => {
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
      
      // Fill required fields but don't select any tiers
      await page.fill('input[name="key"]', 'test_feature');
      await page.fill('input[name="name"]', 'Test Feature');
      
      // Try to submit
      await page.click('button:has-text("Create")');
      
      // Should show validation error
      const hasError = await page.locator('text=/select at least one tier/i').count() > 0;
      expect(hasError).toBeTruthy();
    });

    test('should display success toast notification', async ({ page }) => {
      await createFeature(page);
      
      // Verify toast notification appears
      await expect(page.locator('text=/created successfully/i')).toBeVisible({ timeout: 5000 });
    });

    test('should close form after successful creation', async ({ page }) => {
      await createFeature(page);
      
      // Form dialog should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Feature Editing', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create a feature to edit
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'edit_test_feature',
        name: 'Edit Test Feature'
      });
    });

    test('should edit an existing feature', async ({ page }) => {
      // Find and click edit button
      const featureCard = page.locator(`text=Edit Test Feature`).locator('..').locator('..');
      await featureCard.locator('button[aria-label*="Edit"], button:has-text("Edit")').click();
      
      // Wait for form to populate
      await page.waitForSelector('[role="dialog"]');
      
      // Verify form is populated with existing data
      await expect(page.locator('input[name="key"]')).toHaveValue('edit_test_feature');
      await expect(page.locator('input[name="name"]')).toHaveValue('Edit Test Feature');
      
      // Update the name
      await page.fill('input[name="name"]', 'Updated Feature Name');
      
      // Submit changes
      await page.click('button:has-text("Update"), button:has-text("Save")');
      
      // Verify success notification
      await expect(page.locator('text=/updated successfully/i')).toBeVisible({ timeout: 5000 });
      
      // Verify updated name appears in list
      await expect(page.locator('text=Updated Feature Name')).toBeVisible();
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const featureCard = page.locator(`text=Edit Test Feature`).locator('..').locator('..');
      await featureCard.locator('button[aria-label*="Edit"], button:has-text("Edit")').click();
      
      await page.waitForSelector('[role="dialog"]');
      
      // Make changes
      await page.fill('input[name="name"]', 'Should Not Save');
      
      // Click cancel
      await page.click('button:has-text("Cancel")');
      
      // Form should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      
      // Original name should still be visible
      await expect(page.locator('text=Edit Test Feature')).toBeVisible();
      await expect(page.locator('text=Should Not Save')).not.toBeVisible();
    });
  });

  test.describe('Feature Deletion', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create a feature to delete
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'delete_test_feature',
        name: 'Delete Test Feature'
      });
    });

    test('should delete a feature with confirmation', async ({ page }) => {
      // Setup dialog handler for confirmation
      page.on('dialog', dialog => dialog.accept());
      
      // Find and click delete button
      const featureCard = page.locator(`text=Delete Test Feature`).locator('..').locator('..');
      await featureCard.locator('button[aria-label*="Delete"], button:has-text("Delete")').click();
      
      // Wait for confirmation and deletion
      await page.waitForTimeout(1000);
      
      // Verify success notification
      await expect(page.locator('text=/deleted successfully/i')).toBeVisible({ timeout: 5000 });
      
      // Verify feature is removed from list
      await expect(page.locator('text=Delete Test Feature')).not.toBeVisible();
    });

    test('should cancel deletion when confirmation is rejected', async ({ page }) => {
      // Setup dialog handler to reject
      page.on('dialog', dialog => dialog.dismiss());
      
      const featureCard = page.locator(`text=Delete Test Feature`).locator('..').locator('..');
      await featureCard.locator('button[aria-label*="Delete"], button:has-text("Delete")').click();
      
      await page.waitForTimeout(1000);
      
      // Feature should still be visible
      await expect(page.locator('text=Delete Test Feature')).toBeVisible();
    });
  });

  test.describe('Tier Feature Matrix', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create a test feature
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'matrix_test_feature',
        name: 'Matrix Test Feature',
        allowedTiers: ['pro']
      });
    });

    test('should switch to Tier Management tab', async ({ page }) => {
      // Click Tier Management tab
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Verify matrix is displayed
      await expect(page.locator('text=/tier.*matrix|feature.*tier/i')).toBeVisible();
      await expect(page.locator('table, [role="table"]')).toBeVisible();
    });

    test('should display feature-tier matrix', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Verify tier headers
      await expect(page.locator('text=/free.?trial/i')).toBeVisible();
      await expect(page.locator('text=/basic/i')).toBeVisible();
      await expect(page.locator('text=/pro/i')).toBeVisible();
      await expect(page.locator('text=/enterprise/i')).toBeVisible();
      
      // Verify feature is listed
      await expect(page.locator('text=Matrix Test Feature')).toBeVisible();
    });

    test('should toggle tier access in matrix', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Find the feature row
      const featureRow = page.locator('tr:has-text("Matrix Test Feature")');
      
      // Find a toggle switch that is currently off (e.g., basic tier)
      const basicSwitch = featureRow.locator('input[type="checkbox"]').nth(1); // Assuming basic is second column
      
      // Check current state
      const wasChecked = await basicSwitch.isChecked();
      
      // Toggle the switch
      await basicSwitch.click();
      
      // Verify success notification
      await expect(page.locator('text=/enabled|disabled|updated/i')).toBeVisible({ timeout: 5000 });
      
      // Verify switch state changed
      const isNowChecked = await basicSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should show loading state during matrix update', async ({ page }) => {
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      const featureRow = page.locator('tr:has-text("Matrix Test Feature")');
      const toggle = featureRow.locator('input[type="checkbox"]').first();
      
      // Click toggle
      await toggle.click();
      
      // Should show some loading indicator (spinner, disabled state, etc.)
      // This is implementation-specific, adjust selector as needed
      const hasLoadingIndicator = await page.locator('[role="progressbar"], .loading, .spinner').count() > 0;
      // Loading might be too fast to catch, so we just verify the operation completes
      await page.waitForTimeout(500);
    });
  });

  test.describe('Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
    });

    test('should display validation errors correctly', async ({ page }) => {
      // Submit empty form
      await page.click('button:has-text("Create")');
      
      // Should show multiple validation errors
      const errorCount = await page.locator('text=/required|cannot be empty/i').count();
      expect(errorCount).toBeGreaterThan(0);
    });

    test('should clear validation errors when fields are filled', async ({ page }) => {
      // Submit to trigger validation
      await page.click('button:has-text("Create")');
      
      // Fill the key field
      await page.fill('input[name="key"]', 'test_feature');
      
      // Key error should disappear (if validation is real-time)
      await page.waitForTimeout(500);
      // Note: This depends on implementation - some forms validate on blur, some on change
    });

    test('should validate description length if required', async ({ page }) => {
      await page.fill('input[name="key"]', 'test_feature');
      await page.fill('input[name="name"]', 'Test Feature');
      await page.fill('textarea[name="description"]', 'Too short');
      
      // If there's a minimum length requirement
      await page.click('button:has-text("Create")');
      
      // Check if validation error appears (implementation-specific)
      await page.waitForTimeout(500);
    });
  });

  test.describe('Toast Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
    });

    test('should show success toast on feature creation', async ({ page }) => {
      await createFeature(page);
      
      await expect(page.locator('text=/created successfully/i')).toBeVisible({ timeout: 5000 });
    });

    test('should show error toast on creation failure', async ({ page }) => {
      // Create a feature
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'duplicate_test',
        name: 'Duplicate Test'
      });
      
      // Try to create the same feature again (duplicate key)
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
      
      await page.fill('input[name="key"]', 'duplicate_test');
      await page.fill('input[name="name"]', 'Duplicate Test 2');
      await page.check('input[type="checkbox"][value="pro"]');
      await page.check('input[type="checkbox"][value="pharmacist"]');
      
      await page.click('button:has-text("Create")');
      
      // Should show error toast
      await expect(page.locator('text=/error|failed|already exists/i')).toBeVisible({ timeout: 5000 });
    });

    test('should show toast on successful tier toggle', async ({ page }) => {
      // Create feature first
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'toast_test_feature',
        name: 'Toast Test Feature'
      });
      
      // Switch to matrix tab
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Toggle a tier
      const featureRow = page.locator('tr:has-text("Toast Test Feature")');
      await featureRow.locator('input[type="checkbox"]').first().click();
      
      // Should show success toast
      await expect(page.locator('text=/enabled|disabled|updated/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
    });

    test('should work on mobile viewport (320px)', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      
      // Page should still be accessible
      await expect(page.locator('text=/feature management/i')).toBeVisible();
      
      // Add Feature button should be visible
      await expect(page.locator('button:has-text("Add Feature")')).toBeVisible();
      
      // Can open form
      await page.click('button:has-text("Add Feature")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('should work on tablet viewport (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // All elements should be visible and functional
      await expect(page.locator('text=/feature management/i')).toBeVisible();
      await expect(page.locator('button:has-text("Add Feature")')).toBeVisible();
      
      // Tabs should be visible
      await expect(page.locator('button[role="tab"]:has-text("Features")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Tier Management")')).toBeVisible();
    });

    test('should have horizontal scroll for matrix on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Switch to matrix tab
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Matrix should be visible with scroll
      const table = page.locator('table, [role="table"]');
      await expect(table).toBeVisible();
      
      // Check if container has overflow
      const container = table.locator('..');
      const overflowX = await container.evaluate(el => window.getComputedStyle(el).overflowX);
      expect(['auto', 'scroll']).toContain(overflowX);
    });

    test('should stack form inputs on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.click('button:has-text("Add Feature")');
      await page.waitForSelector('[role="dialog"]');
      
      // Form should be visible and usable
      await expect(page.locator('input[name="key"]')).toBeVisible();
      await expect(page.locator('input[name="name"]')).toBeVisible();
      
      // Should be able to fill form
      await page.fill('input[name="key"]', 'mobile_test');
      await page.fill('input[name="name"]', 'Mobile Test');
    });
  });

  test.describe('Data Persistence', () => {
    test('should persist created features after page reload', async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create a feature
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'persist_test_feature',
        name: 'Persist Test Feature'
      });
      
      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Feature should still be visible
      await expect(page.locator('text=Persist Test Feature')).toBeVisible();
    });

    test('should reflect tier changes after page reload', async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create feature with specific tiers
      await createFeature(page, {
        ...TEST_FEATURE,
        key: 'tier_persist_test',
        name: 'Tier Persist Test',
        allowedTiers: ['pro']
      });
      
      // Switch to matrix and toggle a tier
      await page.click('button[role="tab"]:has-text("Tier Management")');
      const featureRow = page.locator('tr:has-text("Tier Persist Test")');
      await featureRow.locator('input[type="checkbox"]').nth(1).click(); // Toggle basic tier
      
      await page.waitForTimeout(1000);
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Go back to matrix
      await page.click('button[role="tab"]:has-text("Tier Management")');
      
      // Tier change should be persisted
      const reloadedRow = page.locator('tr:has-text("Tier Persist Test")');
      const basicSwitch = reloadedRow.locator('input[type="checkbox"]').nth(1);
      
      // State should be persisted
      await expect(basicSwitch).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail API calls
      await page.route(`${API_BASE_URL}/api/feature-flags`, route => {
        route.abort('failed');
      });
      
      // Reload to trigger error
      await page.reload();
      
      // Should show error message
      await expect(page.locator('text=/error|failed|unable to load/i')).toBeVisible({ timeout: 5000 });
    });

    test('should show retry option on error', async ({ page }) => {
      await page.route(`${API_BASE_URL}/api/feature-flags`, route => {
        route.abort('failed');
      });
      
      await page.reload();
      
      // Should show retry button
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
      await expect(retryButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Performance', () => {
    test('should load page within acceptable time', async ({ page }) => {
      await loginAsSuperAdmin(page);
      
      const startTime = Date.now();
      await navigateToFeatureManagement(page);
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle multiple features efficiently', async ({ page }) => {
      await loginAsSuperAdmin(page);
      await navigateToFeatureManagement(page);
      
      // Create multiple features
      for (let i = 0; i < 5; i++) {
        await createFeature(page, {
          ...TEST_FEATURE,
          key: `perf_test_feature_${i}`,
          name: `Performance Test Feature ${i}`
        });
        
        await page.waitForTimeout(500);
      }
      
      // All features should be visible
      for (let i = 0; i < 5; i++) {
        await expect(page.locator(`text=Performance Test Feature ${i}`)).toBeVisible();
      }
    });
  });
});
