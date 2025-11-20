import { test, expect, devices } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { CommunicationHelper } from './utils/communication-helper';

test.describe('Communication Hub - Cross-Browser Compatibility', () => {
    let authHelper: AuthHelper;
    let communicationHelper: CommunicationHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        communicationHelper = new CommunicationHelper(page);
        await authHelper.login();
    });

    test.afterEach(async ({ page }) => {
        await authHelper.logout();
    });

    test('should load and display Communication Hub correctly', async ({ page, browserName }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Verify main components are visible
        await expect(page.locator('[data-testid="communication-hub"]')).toBeVisible();
        await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();

        console.log(`✅ Communication Hub loaded successfully on ${browserName}`);
    });

    test('should handle basic messaging functionality', async ({ page, browserName }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
            title: `Cross-browser test - ${browserName}`,
        });

        // Send message
        await communicationHelper.sendMessage(`Test message from ${browserName}`);

        // Verify message appears
        await expect(page.locator('[data-testid="message-item"]')).toContainText(`Test message from ${browserName}`);

        console.log(`✅ Basic messaging works on ${browserName}`);
    });

    test('should handle JavaScript features and polyfills', async ({ page, browserName }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Check for modern JavaScript features
        const jsFeatures = await page.evaluate(() => {
            return {
                promises: typeof Promise !== 'undefined',
                fetch: typeof fetch !== 'undefined',
                localStorage: typeof localStorage !== 'undefined',
                webSockets: typeof WebSocket !== 'undefined',
            };
        });

        // Verify essential features are available
        expect(jsFeatures.promises).toBeTruthy();
        expect(jsFeatures.fetch).toBeTruthy();
        expect(jsFeatures.localStorage).toBeTruthy();

        console.log(`✅ JavaScript features on ${browserName}:`, jsFeatures);
    });
});