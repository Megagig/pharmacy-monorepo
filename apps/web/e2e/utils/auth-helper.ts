import { Page, expect } from '@playwright/test';

export class AuthHelper {
    constructor(private page: Page) { }

    async login(email?: string, password?: string) {
        const testEmail = email || process.env.E2E_TEST_USER_EMAIL || 'e2e.pharmacist@test.com';
        const testPassword = password || process.env.E2E_TEST_USER_PASSWORD || 'TestPassword123!';

        console.log(`🔐 Logging in as ${testEmail}...`);

        // Navigate to login page
        await this.page.goto('/login');

        // Fill login form
        await this.page.fill('[data-testid="email-input"]', testEmail);
        await this.page.fill('[data-testid="password-input"]', testPassword);

        // Submit login form
        await this.page.click('[data-testid="login-button"]');

        // Wait for successful login (redirect to dashboard)
        await this.page.waitForURL('/dashboard', { timeout: 10000 });

        // Verify we're logged in
        await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();

        console.log('✅ Login successful');
    }

    async logout() {
        console.log('🚪 Logging out...');

        // Click user menu
        await this.page.click('[data-testid="user-menu"]');

        // Click logout
        await this.page.click('[data-testid="logout-button"]');

        // Wait for redirect to login page
        await this.page.waitForURL('/login', { timeout: 10000 });

        console.log('✅ Logout successful');
    }

    async ensureLoggedIn() {
        try {
            // Check if we're already logged in
            await this.page.waitForSelector('[data-testid="user-menu"]', { timeout: 2000 });
            console.log('✅ Already logged in');
        } catch {
            // Not logged in, perform login
            await this.login();
        }
    }
}